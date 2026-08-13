#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

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

def load_existing():
    if not PROPERTIES.exists():
        return {}
    try:
        data = json.loads(PROPERTIES.read_text(encoding="utf-8"))
        return {str(x["id"]): x for x in data if x.get("id")}
    except Exception:
        return {}

def clean(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", BeautifulSoup(str(s), "html.parser").get_text(" ", strip=True)).strip()

def fetch(url: str):
    # Chrome TLS / HTTP2 impersonation. This is much closer to a normal browser
    # than Python requests and often avoids generic bot pages.
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
    return r.text, r.url

def meta(soup, key):
    tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
    return clean(tag.get("content")) if tag and tag.get("content") else ""

def parse_price(text):
    patterns = [
        r"\bÁr\s+(\d+(?:[,.]\d+)?)\s*millió\s*Ft\b",
        r"\b(\d+(?:[,.]\d+)?)\s*millió\s*Ft\b",
        r"\b(\d+(?:[,.]\d+)?)\s*M\s*Ft\b",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            n = round(float(m.group(1).replace(",", "."))*1_000_000)
            return f"{n:,}".replace(",", " ")+" Ft"
    for m in re.finditer(r"\b([0-9][0-9 .]{4,})\s*Ft\b", text):
        digits = re.sub(r"\D", "", m.group(1))
        if digits:
            n=int(digits)
            if 1_000_000 <= n <= 10_000_000_000:
                return f"{n:,}".replace(",", " ")+" Ft"
    return ""

def parse_area(text):
    for pat in [r"Alapterület\s+(\d+(?:[,.]\d+)?)\s*m(?:²|2)", r"(\d+(?:[,.]\d+)?)\s*m(?:²|2)\s*[•|]\s*\d+\s*szoba"]:
        m=re.search(pat,text,re.I)
        if m:return f"{m.group(1).replace(',','.')} m²"
    return ""

def parse_plot(text):
    m=re.search(r"Telekterület\s+(\d+(?:[,.]\d+)?)\s*m(?:²|2)",text,re.I)
    return f"{m.group(1).replace(',','.')} m² telek" if m else ""

def parse_rooms(text):
    for pat in [r"Szobák\s+(\d+)", r"[•|]\s*(\d+)\s*szoba", r"\b(\d+)\s+szoba\b"]:
        m=re.search(pat,text,re.I)
        if m:return f"{m.group(1)} szoba"
    return ""

def parse_heading(soup, text, old):
    h1 = clean(soup.find("h1").get_text(" ", strip=True)) if soup.find("h1") else ""
    heading = h1 or meta(soup,"og:title")
    city = old.get("city") or ("Szigetvár" if "Szigetvár" in heading or "Szigetvár" in text else "Szigetvár")
    location = old.get("location","")
    ptype = old.get("type","")

    m = re.search(r"Szigetvár,\s*(.*?)\s+Eladó\s+(.+)", heading, re.I)
    if m:
        location = clean(m.group(1))
        ptype = clean(m.group(2))
        ptype = re.sub(r"\s*#?\d{7,10}.*$", "", ptype).strip()
        if ptype:
            ptype = ptype[0].upper()+ptype[1:].lower()

    if not ptype:
        lo=(heading+" "+text[:1500]).lower()
        for needle,val in [
            ("családi ház","Családi ház"),
            ("tégla lakás","Tégla lakás"),
            ("téglalakás","Tégla lakás"),
            ("panel lakás","Panel lakás"),
            ("lakás","Lakás"),
            ("üzletház","Lakó- és üzletház"),
            ("telek","Telek"),
            ("garázs","Garázs"),
        ]:
            if needle in lo:
                ptype=val;break
    return city,location,ptype or "Ingatlan"

def description(text, old):
    if old.get("description") and "További részletekért" not in old["description"]:
        return old["description"]
    m=re.search(r"\bLeírás\b\s+(.*?)(?:Extra információk|Térkép|Lépj kapcsolatba)",text,re.I)
    if m:
        d=clean(m.group(1))
        if len(d)>280:
            d=d[:277].rsplit(" ",1)[0]+"..."
        return d
    return ""

def find_main_image(soup):
    # Prefer OG image when it is a property CDN image.
    og = meta(soup,"og:image")
    if og and "ingatlancdn.com" in og:
        return og

    # Then find actual listing photos.
    candidates=[]
    for img in soup.find_all("img"):
        for attr in ("src","data-src","data-lazy-src"):
            src=img.get(attr)
            if src and "ingatlancdn.com" in src:
                candidates.append(src)
        srcset=img.get("srcset","")
        if srcset:
            for part in srcset.split(","):
                u=part.strip().split(" ")[0]
                if "ingatlancdn.com" in u:
                    candidates.append(u)

    # Prefer ip.ingatlancdn.com, which commonly hosts listing photos.
    for u in candidates:
        if "ip.ingatlancdn.com" in u:
            return u
    return candidates[0] if candidates else ""

def download_image(url,pid):
    if not url:return ""
    try:
        r=curl_requests.get(
            url,
            impersonate="chrome",
            headers={"Referer":"https://ingatlan.com/"},
            timeout=45
        )
        r.raise_for_status()
        if len(r.content)<5000:
            return ""
        IMAGES.mkdir(parents=True,exist_ok=True)
        out=IMAGES/f"{pid}.jpg"
        out.write_bytes(r.content)
        return f"assets/images/{pid}.jpg"
    except Exception as e:
        print("Kép hiba:",e)
        return ""

def build(url,status,old):
    pid=listing_id(url)
    print(f"\n=== {pid} / {status} ===")
    try:
        html,final_url=fetch(url)
    except Exception as e:
        print("LETÖLTÉSI HIBA:",e)
        if old:
            rec=dict(old)
            rec["status"]=status
            rec["url"]=canonical_url(url)
            if status=="sold":
                if rec.get("price")!="Eladva":
                    rec["oldPrice"]=rec.get("price","")
                rec["price"]="Eladva"
                rec["badge"]="ELADVA"
            return rec
        return None

    print("HTTP bytes:",len(html.encode("utf-8")))
    print("Final URL:",final_url)

    soup=BeautifulSoup(html,"html.parser")
    text=clean(soup.get_text(" ",strip=True))

    # Write debug excerpt to Actions log.
    print("DEBUG text:",text[:600].replace("\n"," "))

    price=parse_price(text)
    area=parse_area(text)
    rooms=parse_rooms(text)
    plot=parse_plot(text)
    print("PARSED:",price,"|",area,"|",rooms,"|",plot)

    if not (price and area and rooms) and not old:
        print("Új kártya kihagyva: nem jött vissza elég adat.")
        return None

    city,location,ptype=parse_heading(soup,text,old)
    desc=description(text,old) or meta(soup,"og:description") or old.get("description","")

    image_rel=old.get("image","")
    local=IMAGES/f"{pid}.jpg"
    if local.exists():
        image_rel=f"assets/images/{pid}.jpg"
    else:
        main_img=find_main_image(soup)
        print("IMAGE:",main_img[:180] if main_img else "NONE")
        image_rel=download_image(main_img,pid) or image_rel

    if status=="sold":
        final_price="Eladva"
        old_price=old.get("oldPrice") or old.get("price") or price
        badge="ELADVA"
    else:
        final_price=price or old.get("price") or "Ár a hirdetésben"
        old_price=old.get("oldPrice","")
        badge=old.get("badge") or "ÚJ"

    return {
        "id":pid,"status":status,"badge":badge,
        "featured":old.get("featured",status=="active"),
        "city":city,"location":location,"type":ptype,
        "price":final_price,"oldPrice":old_price,
        "area":area or old.get("area","—"),
        "rooms":rooms or old.get("rooms","—"),
        "plot":plot or old.get("plot",""),
        "description":desc or "További részletekért nyissa meg a teljes hirdetést.",
        "image":image_rel or old.get("image","assets/images/logo-brand.jpeg"),
        "url":canonical_url(url),
    }

def main():
    active=read_links(DATA/"active.txt")
    sold=read_links(DATA/"sold.txt")
    a_ids={listing_id(x) for x in active}
    s_ids={listing_id(x) for x in sold}
    dup=a_ids&s_ids
    if dup:
        print("HIBA: ugyanaz az ID aktív és eladott:",dup)
        sys.exit(2)

    existing=load_existing()
    final=[]

    for status,links in (("active",active),("sold",sold)):
        for url in links:
            pid=listing_id(url)
            rec=build(url,status,dict(existing.get(pid,{})))
            if rec: final.append(rec)

    # hard dedupe by listing ID
    by_id={}
    for rec in final:
        by_id[rec["id"]]=rec
    final=list(by_id.values())

    PROPERTIES.write_text(json.dumps(final,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("\nDONE:",len(final),"egyedi rekord")

if __name__=="__main__":
    main()
