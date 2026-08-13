#!/usr/bin/env python3
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

def listing_id(value: str) -> str:
    m = re.search(r"(?:^|/)(\d{7,10})(?:$|[/?#])", value.strip())
    if m:
        return m.group(1)
    nums = re.findall(r"\d{7,10}", value)
    return nums[0] if nums else ""

def canonical_url(value: str) -> str:
    pid = listing_id(value)
    return f"https://ingatlan.com/{pid}" if pid else ""

def read_links(path: Path) -> list[str]:
    """
    Deduplikálás NEM teljes URL, hanem ingatlan.com hirdetésazonosító alapján.
    Így a rövid és hosszú URL ugyanahhoz a hirdetéshez csak egyszer kerül be.
    """
    if not path.exists():
        return []
    by_id = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.isdigit():
            line = f"https://ingatlan.com/{line}"
        pid = listing_id(line)
        if not pid:
            print(f"FIGYELEM: érvénytelen sor kihagyva: {line}")
            continue
        by_id[pid] = canonical_url(line)
    return list(by_id.values())

def load_existing() -> dict[str, dict]:
    if not PROPERTIES.exists():
        return {}
    try:
        data = json.loads(PROPERTIES.read_text(encoding="utf-8"))
        return {str(x.get("id")): x for x in data if x.get("id")}
    except Exception as e:
        print("Nem sikerült beolvasni a properties.json-t:", e)
        return {}

def clean(text) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", BeautifulSoup(str(text), "html.parser").get_text(" ", strip=True)).strip()

def meta(soup: BeautifulSoup, name: str) -> str:
    tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
    return clean(tag.get("content")) if tag and tag.get("content") else ""

def parse_price(text: str) -> str:
    # "Ár 46 millió Ft"
    m = re.search(r"\bÁr\s+(\d+(?:[,.]\d+)?)\s*millió\s*Ft\b", text, re.I)
    if not m:
        m = re.search(r"\b(\d+(?:[,.]\d+)?)\s*millió\s*Ft\b", text, re.I)
    if m:
        n = round(float(m.group(1).replace(",", ".")) * 1_000_000)
        return f"{n:,}".replace(",", " ") + " Ft"

    # "32,5 M Ft"
    m = re.search(r"\b(\d+(?:[,.]\d+)?)\s*M\s*Ft\b", text, re.I)
    if m:
        n = round(float(m.group(1).replace(",", ".")) * 1_000_000)
        return f"{n:,}".replace(",", " ") + " Ft"

    # "129 000 000 Ft"
    for m in re.finditer(r"\b([0-9][0-9 .]{4,})\s*Ft\b", text, re.I):
        digits = re.sub(r"\D", "", m.group(1))
        if digits:
            n = int(digits)
            if 1_000_000 <= n <= 10_000_000_000:
                return f"{n:,}".replace(",", " ") + " Ft"
    return ""

def parse_area(text: str) -> str:
    for pat in [
        r"Alapterület\s+(\d+(?:[,.]\d+)?)\s*m(?:²|2)",
        r"(\d+(?:[,.]\d+)?)\s*m(?:²|2)\s*(?:•|\|)\s*\d+\s*szoba",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1).replace(',', '.')} m²"
    return ""

def parse_plot(text: str) -> str:
    m = re.search(r"Telekterület\s+(\d+(?:[,.]\d+)?)\s*m(?:²|2)", text, re.I)
    if m:
        return f"{m.group(1).replace(',', '.')} m² telek"
    return ""

def parse_rooms(text: str) -> str:
    for pat in [
        r"Szobák\s+(\d+)",
        r"(?:•|\|)\s*(\d+)\s*szoba",
        r"\b(\d+)\s+szoba\b",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1)} szoba"
    return ""

def parse_location_and_type(text: str, title: str, old: dict) -> tuple[str,str,str]:
    city = old.get("city") or ("Szigetvár" if "Szigetvár" in text or "Szigetvár" in title else "")
    location = old.get("location", "")

    # The first heading usually looks like:
    # "Szigetvár, Nyugati városrész Eladó családi ház"
    m = re.search(r"Szigetvár,\s*([^#\n]{2,70}?)\s+Eladó\s+([^\n#]{2,60})", text, re.I)
    ptype = old.get("type", "")
    if m:
        location = clean(m.group(1))
        raw_type = clean(m.group(2))
        # stop at obvious separators / next UI words
        raw_type = re.split(r"\s+(?:Google|Image|Ár|Alapterület)\b", raw_type, 1)[0]
        if raw_type:
            ptype = raw_type[0].upper() + raw_type[1:].lower()

    if not ptype:
        low = f"{title} {text[:1200]}".lower()
        for needle, val in [
            ("családi ház","Családi ház"),
            ("tégla lakás","Tégla lakás"),
            ("téglalakás","Tégla lakás"),
            ("panel lakás","Panel lakás"),
            ("lakás","Lakás"),
            ("üzletház","Lakó- és üzletház"),
            ("telek","Telek"),
            ("garázs","Garázs"),
        ]:
            if needle in low:
                ptype = val
                break
    return city or "Szigetvár", location, ptype or "Ingatlan"

def short_description(text: str, old: dict) -> str:
    # Keep curated existing text if present.
    if old.get("description") and "További részletekért" not in old["description"]:
        return old["description"]

    m = re.search(r"\bLeírás\b\s+(.*?)(?:Extra információk|Térkép|Lépj kapcsolatba)", text, re.I)
    if m:
        desc = clean(m.group(1))
        # Strip repeated heading if it occurs.
        desc = re.sub(r"^ELADÓ\s+", "", desc, flags=re.I)
        if len(desc) > 260:
            desc = desc[:257].rsplit(" ",1)[0] + "..."
        return desc
    return ""

async def fetch_with_playwright(url: str) -> tuple[str,str]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": 1440, "height": 1200},
            locale="hu-HU",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
        )
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                await page.wait_for_load_state("networkidle", timeout=12000)
            except PlaywrightTimeoutError:
                pass
            return await page.content(), await page.locator("body").inner_text(timeout=10000)
        finally:
            await browser.close()

def fetch_with_requests(url: str) -> tuple[str,str]:
    r = requests.get(
        url,
        headers={
            "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
            "Accept-Language":"hu-HU,hu;q=0.9,en;q=0.7",
            "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
        timeout=35,
        allow_redirects=True,
    )
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    return r.text, soup.get_text(" ", strip=True)

async def get_page(url: str) -> tuple[str,str]:
    # First try simple HTTP; it is faster and often returns the full public page.
    try:
        html,text = fetch_with_requests(url)
        if listing_id(url) in text and ("Alapterület" in text or "millió Ft" in text):
            return html,text
    except Exception as e:
        print("HTTP próbálkozás nem sikerült:", e)

    # Browser fallback.
    return await fetch_with_playwright(url)

def save_image(url: str, pid: str) -> str:
    if not url:
        return ""
    out = IMAGES / f"{pid}.jpg"
    try:
        r = requests.get(url, headers={"User-Agent":"Mozilla/5.0","Referer":"https://ingatlan.com/"}, timeout=35)
        r.raise_for_status()
        if len(r.content) < 5000:
            return ""
        IMAGES.mkdir(parents=True, exist_ok=True)
        out.write_bytes(r.content)
        return f"assets/images/{pid}.jpg"
    except Exception as e:
        print("Kép letöltési hiba:", e)
        return ""

async def build(url: str, status: str, old: dict) -> dict | None:
    pid = listing_id(url)
    print(f"\n--- {pid} ({status}) ---")

    try:
        html, raw_text = await get_page(url)
    except Exception as e:
        print("A hirdetés nem volt beolvasható:", e)
        # Existing known listing: keep it, only update status/url.
        if old:
            copy = dict(old)
            copy["status"] = status
            copy["url"] = canonical_url(url)
            if status == "sold":
                if copy.get("price") != "Eladva":
                    copy["oldPrice"] = copy.get("price","")
                copy["price"] = "Eladva"
                copy["badge"] = "ELADVA"
            return copy
        # New unknown listing: DO NOT create an empty fake card.
        return None

    soup = BeautifulSoup(html, "html.parser")
    text = clean(raw_text)
    title = meta(soup,"og:title") or clean(soup.title.string if soup.title else "")

    price = parse_price(text)
    area = parse_area(text)
    rooms = parse_rooms(text)
    plot = parse_plot(text)

    # Critical fields: if these were not parsed, don't create a new blank card.
    enough = bool(price and area and rooms)
    if not enough and not old:
        print("Nem sikerült elegendő adatot kiolvasni. Új üres kártya NEM készül.")
        print("  price =", price, " area =", area, " rooms =", rooms)
        return None

    city, location, ptype = parse_location_and_type(text, title, old)
    desc = short_description(text, old) or meta(soup,"og:description") or old.get("description","")
    if desc and len(desc)>260:
        desc = desc[:257].rsplit(" ",1)[0] + "..."

    image_rel = old.get("image","")
    local = IMAGES / f"{pid}.jpg"
    if local.exists():
        image_rel = f"assets/images/{pid}.jpg"
    else:
        ogimg = meta(soup,"og:image")
        downloaded = save_image(ogimg,pid)
        if downloaded:
            image_rel = downloaded

    if status == "sold":
        final_price = "Eladva"
        old_price = old.get("oldPrice") or old.get("price") or price
        badge = "ELADVA"
    else:
        final_price = price or old.get("price") or "Ár a hirdetésben"
        old_price = old.get("oldPrice","")
        badge = old.get("badge") or "ÚJ"

    return {
        "id":pid,
        "status":status,
        "badge":badge,
        "featured":old.get("featured", status=="active"),
        "city":city,
        "location":location,
        "type":ptype,
        "price":final_price,
        "oldPrice":old_price,
        "area":area or old.get("area","—"),
        "rooms":rooms or old.get("rooms","—"),
        "plot":plot or old.get("plot",""),
        "description":desc or "További részletekért nyissa meg a teljes hirdetést.",
        "image":image_rel or old.get("image","assets/images/logo-brand.jpeg"),
        "url":canonical_url(url),
    }

async def main():
    active = read_links(DATA/"active.txt")
    sold = read_links(DATA/"sold.txt")

    active_ids={listing_id(x) for x in active}
    sold_ids={listing_id(x) for x in sold}
    dup=active_ids & sold_ids
    if dup:
        print("HIBA: ugyanaz a hirdetés aktív és eladott is:", ", ".join(sorted(dup)))
        sys.exit(2)

    existing=load_existing()
    final=[]

    for status,links in (("active",active),("sold",sold)):
        for url in links:
            pid=listing_id(url)
            rec=await build(url,status,dict(existing.get(pid,{})))
            if rec:
                final.append(rec)
            else:
                print(f"KIHAGYVA: {pid}")

    # final safety dedupe by ID
    dedup={}
    for rec in final:
        dedup[rec["id"]]=rec
    final=list(dedup.values())

    PROPERTIES.write_text(json.dumps(final,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"\nKész: {len(final)} egyedi ingatlan.")

if __name__=="__main__":
    asyncio.run(main())
