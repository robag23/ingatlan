#!/usr/bin/env python3
"""
Sziget–Baracsi Ingatlan – GitHub-only synchroniser

Forrás:
  data/active.txt
  data/sold.txt

Kimenet:
  data/properties.json
  assets/images/<ingatlan_id>.jpg

Működés:
- A linkekből megpróbálja kiolvasni a nyilvánosan elérhető hirdetési adatokat.
- A meglévő properties.json rekordokat tartalék adatként megtartja.
- Ha egy már létező hirdetés beolvasása átmenetileg nem sikerül, a weboldal nem törik el:
  a korábbi adatok megmaradnak.
- Új linknél a hirdetés legalább alapadatait megpróbálja létrehozni.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IMAGES = ROOT / "assets" / "images"
PROPERTIES = DATA / "properties.json"

PHONE = "+36 70 319 6582"

def read_links(path: Path) -> list[str]:
    if not path.exists():
        return []
    result = []
    seen = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # Accept full URLs or just numeric ingatlan.com IDs.
        if line.isdigit():
            line = f"https://ingatlan.com/{line}"
        m = re.search(r"https?://(?:www\.)?ingatlan\.com/[^\s#?]+", line)
        if not m:
            print(f"FIGYELEM: kihagyva, nem ingatlan.com link: {line}")
            continue
        url = m.group(0).rstrip("/")
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result

def listing_id(url: str) -> str:
    nums = re.findall(r"(\d{6,})", url)
    return nums[-1] if nums else re.sub(r"\W+", "-", url).strip("-")[-32:]

def load_existing() -> dict[str, dict]:
    if not PROPERTIES.exists():
        return {}
    try:
        data = json.loads(PROPERTIES.read_text(encoding="utf-8"))
        return {str(x.get("id")): x for x in data if x.get("id")}
    except Exception as e:
        print("Nem sikerült beolvasni a meglévő properties.json fájlt:", e)
        return {}

def clean_text(value) -> str:
    if value is None:
        return ""
    text = BeautifulSoup(str(value), "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()

def first_nonempty(*values):
    for v in values:
        if v is not None and str(v).strip():
            return v
    return ""

def parse_numbered_value(text: str, label_patterns: list[str], unit: str = "") -> str:
    for label in label_patterns:
        pat = rf"{label}\s*[:\-]?\s*([0-9][0-9\s.,]*)\s*{re.escape(unit)}"
        m = re.search(pat, text, re.I)
        if m:
            val = re.sub(r"\s+", " ", m.group(1)).strip()
            return f"{val} {unit}".strip()
    return ""

def parse_price(text: str) -> str:
    # Prefer explicit Ft amounts, usually the largest useful match near the top.
    matches = re.findall(r"([0-9][0-9 .]{3,})\s*Ft", text, re.I)
    vals = []
    for m in matches:
        digits = re.sub(r"\D", "", m)
        if digits:
            try:
                n = int(digits)
                if n >= 100000:
                    vals.append(n)
            except ValueError:
                pass
    if vals:
        n = vals[0]
        return f"{n:,}".replace(",", " ") + " Ft"

    # "46 millió Ft", "32,5 M Ft" fallback.
    m = re.search(r"(\d+(?:[,.]\d+)?)\s*(?:millió|M)\s*Ft", text, re.I)
    if m:
        val = float(m.group(1).replace(",", "."))
        n = round(val * 1_000_000)
        return f"{n:,}".replace(",", " ") + " Ft"
    return ""

def parse_rooms(text: str) -> str:
    # Common Hungarian page patterns.
    for pat in [
        r"(\d+)\s*(?:db\s*)?szoba",
        r"szobák?\s*[:\-]?\s*(\d+)",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1)} szoba"
    return ""

def parse_area(text: str) -> str:
    # Prioritise labeled floor-area values.
    for pat in [
        r"alapterület\s*[:\-]?\s*(\d+(?:[,.]\d+)?)\s*m²",
        r"lakóterület\s*[:\-]?\s*(\d+(?:[,.]\d+)?)\s*m²",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1).replace(',', '.')} m²"
    # First plausible area.
    for m in re.finditer(r"(\d+(?:[,.]\d+)?)\s*m²", text, re.I):
        try:
            v = float(m.group(1).replace(",", "."))
            if 10 <= v <= 5000:
                return f"{m.group(1).replace(',', '.')} m²"
        except ValueError:
            pass
    return ""

def parse_plot(text: str) -> str:
    for pat in [
        r"telekterület\s*[:\-]?\s*(\d+(?:[,.]\d+)?)\s*m²",
        r"telek\s*[:\-]?\s*(\d+(?:[,.]\d+)?)\s*m²",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1).replace(',', '.')} m² telek"
    return ""

def infer_type(title: str, text: str) -> str:
    source = f"{title} {text[:2000]}".lower()
    mapping = [
        ("családi ház", "Családi ház"),
        ("téglalakás", "Tégla lakás"),
        ("tégla lakás", "Tégla lakás"),
        ("panellakás", "Panel lakás"),
        ("panel lakás", "Panel lakás"),
        ("lakás", "Lakás"),
        ("üzletház", "Lakó- és üzletház"),
        ("üzlethelyiség", "Üzlethelyiség"),
        ("telek", "Telek"),
        ("garázs", "Garázs"),
        ("nyaraló", "Nyaraló"),
        ("ház", "Családi ház"),
    ]
    for needle, name in mapping:
        if needle in source:
            return name
    return "Ingatlan"

def extract_jsonld(soup: BeautifulSoup) -> list[dict]:
    out = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = tag.string or tag.get_text()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
            if isinstance(obj, list):
                out.extend(x for x in obj if isinstance(x, dict))
            elif isinstance(obj, dict):
                if isinstance(obj.get("@graph"), list):
                    out.extend(x for x in obj["@graph"] if isinstance(x, dict))
                out.append(obj)
        except Exception:
            continue
    return out

def meta_content(soup: BeautifulSoup, key: str) -> str:
    tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
    return clean_text(tag.get("content")) if tag else ""

def location_from_title(title: str, existing: dict) -> tuple[str, str]:
    city = existing.get("city", "")
    location = existing.get("location", "")
    # Szigetvár is the principal market. Preserve existing finer location if known.
    if "szigetvár" in title.lower():
        city = "Szigetvár"
    return city or "Szigetvár", location

async def fetch_rendered(url: str) -> tuple[str, str]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": 1440, "height": 1200},
            locale="hu-HU",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0 Safari/537.36"
            ),
        )
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except PlaywrightTimeoutError:
                pass
            html = await page.content()
            body = await page.locator("body").inner_text(timeout=10000)
            return html, body
        finally:
            await browser.close()

def download_image(image_url: str, out_path: Path) -> bool:
    if not image_url:
        return False
    try:
        r = requests.get(
            image_url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=30,
        )
        r.raise_for_status()
        ctype = r.headers.get("content-type", "").lower()
        if "image" not in ctype and len(r.content) < 5000:
            return False
        out_path.write_bytes(r.content)
        return True
    except Exception as e:
        print("Kép letöltési hiba:", image_url, e)
        return False

async def scrape(url: str, status: str, existing: dict) -> dict:
    pid = listing_id(url)
    print(f"Beolvasás: {pid} ({status})")
    try:
        html, visible_text = await fetch_rendered(url)
    except Exception as e:
        print(f"  HIBA a hirdetés megnyitásakor: {e}")
        html, visible_text = "", ""

    soup = BeautifulSoup(html, "html.parser") if html else BeautifulSoup("", "html.parser")
    title = first_nonempty(
        meta_content(soup, "og:title"),
        clean_text(soup.title.string if soup.title else ""),
        existing.get("type", ""),
    )
    description = first_nonempty(
        meta_content(soup, "og:description"),
        meta_content(soup, "description"),
        existing.get("description", ""),
    )
    image_url = meta_content(soup, "og:image")

    # Try structured data too.
    structured = extract_jsonld(soup)
    for obj in structured:
        title = first_nonempty(title, obj.get("name"), obj.get("headline"))
        description = first_nonempty(description, obj.get("description"))
        image = obj.get("image")
        if not image_url:
            if isinstance(image, str):
                image_url = image
            elif isinstance(image, list) and image:
                image_url = image[0] if isinstance(image[0], str) else ""
        offers = obj.get("offers")
        if isinstance(offers, dict) and not existing.get("price"):
            price = offers.get("price")
            currency = offers.get("priceCurrency", "HUF")
            if price and currency in ("HUF", "Ft"):
                try:
                    n = int(float(price))
                    existing["price"] = f"{n:,}".replace(",", " ") + " Ft"
                except Exception:
                    pass

    text = clean_text(visible_text)
    city, location = location_from_title(title, existing)

    # Extract key public data, falling back to the current record.
    price = first_nonempty(parse_price(text), existing.get("price"))
    area = first_nonempty(parse_area(text), existing.get("area"))
    rooms = first_nonempty(parse_rooms(text), existing.get("rooms"))
    plot = first_nonempty(parse_plot(text), existing.get("plot"))
    ptype = first_nonempty(infer_type(title, text), existing.get("type"), "Ingatlan")

    # Keep manually curated short description when available; otherwise use page meta.
    short_desc = existing.get("description") or description
    if short_desc and len(short_desc) > 260:
        short_desc = short_desc[:257].rstrip() + "..."

    # Existing local image is preferred; new listings get downloaded automatically.
    image_rel = existing.get("image", "")
    local_image = IMAGES / f"{pid}.jpg"
    if local_image.exists():
        image_rel = f"assets/images/{pid}.jpg"
    elif image_url:
        IMAGES.mkdir(parents=True, exist_ok=True)
        if download_image(image_url, local_image):
            image_rel = f"assets/images/{pid}.jpg"

    badge = existing.get("badge", "")
    if status == "sold":
        badge = "ELADVA"
    elif not badge:
        badge = "ÚJ"

    record = {
        "id": pid,
        "status": status,
        "badge": badge,
        "featured": existing.get("featured", status == "active"),
        "city": city,
        "location": location,
        "type": ptype,
        "price": "Eladva" if status == "sold" else (price or "Ár a hirdetésben"),
        "oldPrice": existing.get("oldPrice", ""),
        "area": area or "—",
        "rooms": rooms or "—",
        "plot": plot or "",
        "description": short_desc or "További részletekért nyissa meg a teljes hirdetést.",
        "image": image_rel or "assets/images/logo-brand.jpeg",
        "url": url,
    }
    return record

async def main():
    active = read_links(DATA / "active.txt")
    sold = read_links(DATA / "sold.txt")

    duplicates = set(active) & set(sold)
    if duplicates:
        print("HIBA: ugyanaz a link az active.txt és sold.txt fájlban is szerepel:")
        for x in sorted(duplicates):
            print(" -", x)
        sys.exit(2)

    existing = load_existing()
    records = []

    # Stable order: active first, then sold.
    for status, links in (("active", active), ("sold", sold)):
        for url in links:
            pid = listing_id(url)
            old = dict(existing.get(pid, {}))
            records.append(await scrape(url, status, old))

    PROPERTIES.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Kész: {len(records)} ingatlan → {PROPERTIES.relative_to(ROOT)}")

if __name__ == "__main__":
    asyncio.run(main())
