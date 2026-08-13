#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IMAGES = ROOT / "assets" / "images"
PROPERTIES = DATA / "properties.json"

def listing_id(value: str) -> str:
    nums = re.findall(r"\d{7,10}", value)
    return nums[0] if nums else ""

def canonical_url(value: str) -> str:
    pid = listing_id(value)
    return f"https://ingatlan.com/{pid}" if pid else ""

def read_links(path: Path) -> list[str]:
    by_id = {}
    if not path.exists():
        return []
    for raw in path.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if s.isdigit():
            s = f"https://ingatlan.com/{s}"
        pid = listing_id(s)
        if pid:
            by_id[pid] = canonical_url(s)
    return list(by_id.values())

def load_existing() -> dict[str, dict]:
    if not PROPERTIES.exists():
        return {}
    try:
        data = json.loads(PROPERTIES.read_text(encoding="utf-8"))
        return {str(x.get("id")): x for x in data if x.get("id")}
    except Exception:
        return {}

def clean(s) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", BeautifulSoup(str(s), "html.parser").get_text(" ", strip=True)).strip()

def meta(soup: BeautifulSoup, key: str) -> str:
    tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
    return clean(tag.get("content")) if tag and tag.get("content") else ""

def fetch(url: str):
    r = curl_requests.get(
        url,
        impersonate="chrome",
        headers={
            "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.7,en;q=0.6",
            "Referer": "https://ingatlan.com/",
            "Cache-Control": "no-cache",
        },
        timeout=45,
        allow_redirects=True,
    )
    r.raise_for_status()
    return r.text

def parse_price(text: str) -> str:
    for pat in [
        r"\bÁr\s+(\d+(?:[,.]\d+)?)\s*millió\s*Ft\b",
        r"\b(\d+(?:[,.]\d+)?)\s*millió\s*Ft\b",
        r"\b(\d+(?:[,.]\d+)?)\s*M\s*Ft\b",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            n = round(float(m.group(1).replace(",", ".")) * 1_000_000)
            return f"{n:,}".replace(",", " ") + " Ft"

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
        r"(\d+(?:[,.]\d+)?)\s*m(?:²|2)\s*[•|]\s*\d+\s*szoba",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1).replace(',', '.')} m²"
    return ""

def parse_plot(text: str) -> str:
    m = re.search(r"Telekterület\s+(\d+(?:[,.]\d+)?)\s*m(?:²|2)", text, re.I)
    return f"{m.group(1).replace(',', '.')} m² telek" if m else ""

def parse_rooms(text: str) -> str:
    for pat in [
        r"Szobák\s+(\d+)",
        r"[•|]\s*(\d+)\s*szoba",
        r"\b(\d+)\s+szoba\b",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            return f"{m.group(1)} szoba"
    return ""

def parse_heading(soup: BeautifulSoup, text: str, old: dict):
    h1 = clean(soup.find("h1").get_text(" ", strip=True)) if soup.find("h1") else ""
    heading = h1 or meta(soup, "og:title")
    city = old.get("city") or ("Szigetvár" if "Szigetvár" in heading or "Szigetvár" in text else "Szigetvár")
    location = old.get("location", "")
    ptype = old.get("type", "")

    m = re.search(r"Szigetvár,\s*(.*?)\s+Eladó\s+(.+)", heading, re.I)
    if m:
        location = clean(m.group(1))
        ptype = clean(m.group(2))
        ptype = re.sub(r"\s*#?\d{7,10}.*$", "", ptype).strip()
        if ptype:
            ptype = ptype[0].upper() + ptype[1:].lower()

    if not ptype:
        low = (heading + " " + text[:1600]).lower()
        for needle, val in [
            ("családi ház", "Családi ház"),
            ("tégla lakás", "Tégla lakás"),
            ("téglalakás", "Tégla lakás"),
            ("panel lakás", "Panel lakás"),
            ("lakás", "Lakás"),
            ("üzletház", "Lakó- és üzletház"),
            ("üzlethelyiség", "Üzlethelyiség"),
            ("telek", "Telek"),
            ("garázs", "Garázs"),
            ("nyaraló", "Nyaraló"),
        ]:
            if needle in low:
                ptype = val
                break

    return city, location, ptype or "Ingatlan"

def parse_description(soup: BeautifulSoup, text: str, old: dict) -> str:
    m = re.search(r"\bLeírás\b\s+(.*?)(?:Extra információk|Térkép|Lépj kapcsolatba)", text, re.I)
    if m:
        d = clean(m.group(1))
        if len(d) > 280:
            d = d[:277].rsplit(" ", 1)[0] + "..."
        return d
    og = meta(soup, "og:description")
    if og:
        return og[:280]
    return old.get("description", "") or "További részletekért nyissa meg a teljes hirdetést."

def find_main_image(soup: BeautifulSoup) -> str:
    og = meta(soup, "og:image")
    if og and ("ingatlancdn" in og or og.startswith("http")):
        return og

    candidates = []
    for img in soup.find_all("img"):
        for attr in ("src", "data-src", "data-lazy-src"):
            src = img.get(attr)
            if src and "ingatlancdn" in src:
                candidates.append(src)
        srcset = img.get("srcset", "")
        for part in srcset.split(","):
            u = part.strip().split(" ")[0]
            if u and "ingatlancdn" in u:
                candidates.append(u)

    for u in candidates:
        if "ip.ingatlancdn.com" in u:
            return u
    return candidates[0] if candidates else ""

def download_image(url: str, pid: str) -> str:
    if not url:
        return ""
    try:
        r = curl_requests.get(
            url,
            impersonate="chrome",
            headers={"Referer": "https://ingatlan.com/"},
            timeout=45,
        )
        r.raise_for_status()
        if len(r.content) < 5000:
            return ""
        IMAGES.mkdir(parents=True, exist_ok=True)
        out = IMAGES / f"{pid}.jpg"
        out.write_bytes(r.content)
        return f"assets/images/{pid}.jpg"
    except Exception as e:
        print(f"  Kép letöltése sikertelen: {e}")
        return ""

def fetch_record(url: str, status: str, old: dict):
    pid = listing_id(url)
    print(f"\n[{pid}] {status}")

    try:
        html = fetch(url)
    except Exception as e:
        print(f"  HIBA: {e}")
        if old:
            rec = dict(old)
            rec["status"] = status
            rec["url"] = canonical_url(url)
            if status == "sold":
                if rec.get("price") != "Eladva":
                    rec["oldPrice"] = rec.get("price", "")
                rec["price"] = "Eladva"
                rec["badge"] = "ELADVA"
            return rec
        return None

    soup = BeautifulSoup(html, "html.parser")
    text = clean(soup.get_text(" ", strip=True))

    price = parse_price(text)
    area = parse_area(text)
    rooms = parse_rooms(text)
    plot = parse_plot(text)

    print(f"  Ár: {price or '—'} | Méret: {area or '—'} | Szobák: {rooms or '—'}")

    if status == "active" and not (price and area and rooms) and not old:
        print("  KIHAGYVA: nem sikerült elegendő adatot kiolvasni.")
        return None

    city, location, ptype = parse_heading(soup, text, old)
    desc = parse_description(soup, text, old)

    image_rel = old.get("image", "")
    local = IMAGES / f"{pid}.jpg"
    if local.exists():
        image_rel = f"assets/images/{pid}.jpg"
    else:
        image_rel = download_image(find_main_image(soup), pid) or image_rel

    if status == "sold":
        old_price = old.get("oldPrice") or old.get("price") or price
        final_price = "Eladva"
        badge = "ELADVA"
    else:
        old_price = old.get("oldPrice", "")
        final_price = price or old.get("price") or "Ár a hirdetésben"
        badge = old.get("badge") or "ÚJ"

    return {
        "id": pid,
        "status": status,
        "badge": badge,
        "featured": old.get("featured", True),
        "city": city,
        "location": location,
        "type": ptype,
        "price": final_price,
        "oldPrice": old_price,
        "area": area or old.get("area", "—"),
        "rooms": rooms or old.get("rooms", "—"),
        "plot": plot or old.get("plot", ""),
        "description": desc,
        "image": image_rel or old.get("image", "assets/images/logo-brand.jpeg"),
        "url": canonical_url(url),
    }

def run_git_push():
    try:
        subprocess.run(["git", "--version"], cwd=ROOT, check=True, capture_output=True, text=True)
    except Exception:
        print("\nGit nincs telepítve vagy ez nem Git repository. A fájlok frissültek, de kézzel kell feltölteni őket GitHubra.")
        return

    try:
        subprocess.run(["git", "add", "data/properties.json", "assets/images"], cwd=ROOT, check=True)
        diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
        if diff.returncode == 0:
            print("\nNincs új Git változás.")
            return
        subprocess.run(["git", "commit", "-m", "Ingatlanok helyi frissítése"], cwd=ROOT, check=True)
        subprocess.run(["git", "push"], cwd=ROOT, check=True)
        print("\nGitHub feltöltés kész.")
    except Exception as e:
        print(f"\nA Git automatikus feltöltés nem sikerült: {e}")
        print("A fájlok ettől még elkészültek; GitHub Desktopból vagy kézzel Commit/Push használható.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh-all", action="store_true", help="A már létező hirdetéseket is újra beolvassa.")
    parser.add_argument("--push", action="store_true", help="A végén megpróbál automatikusan git commit + push műveletet.")
    args = parser.parse_args()

    active = read_links(DATA / "active.txt")
    sold = read_links(DATA / "sold.txt")
    existing = load_existing()

    active_ids = {listing_id(x) for x in active}
    sold_ids = {listing_id(x) for x in sold}
    dup = active_ids & sold_ids
    if dup:
        print("HIBA: ugyanaz a hirdetés az active.txt és sold.txt fájlban is szerepel:")
        print(", ".join(sorted(dup)))
        sys.exit(2)

    final = []

    for status, links in (("active", active), ("sold", sold)):
        for url in links:
            pid = listing_id(url)
            old = dict(existing.get(pid, {}))

            # Fast path: existing active listing doesn't need to be downloaded again.
            if old and not args.refresh_all:
                old["status"] = status
                old["url"] = canonical_url(url)
                if status == "sold":
                    if old.get("price") != "Eladva":
                        old["oldPrice"] = old.get("price", "")
                    old["price"] = "Eladva"
                    old["badge"] = "ELADVA"
                final.append(old)
                print(f"[{pid}] már létezik → kihagyva")
                continue

            rec = fetch_record(url, status, old)
            if rec:
                final.append(rec)

    by_id = {x["id"]: x for x in final}
    final = list(by_id.values())

    PROPERTIES.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nKÉSZ: {len(final)} ingatlan a properties.json fájlban.")

    if args.push:
        run_git_push()

if __name__ == "__main__":
    main()
