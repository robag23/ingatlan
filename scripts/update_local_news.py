from __future__ import annotations
import json, re
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from datetime import date

URL="https://www.szigetvar.hu/hu/node/1"
OUT=Path("display/local-news.json")
SAFE_WORDS=("program","zrínyi","áramszünet","vágányzár","menetrend","kiállítás","ünnep","rendezvény","közérdek","tájékoztat")
BLOCK_WORDS=("baleset","halál","gyilkoss","rendőrség","politika","párt","választás")

def main():
    old={}
    if OUT.exists():
        try: old=json.loads(OUT.read_text(encoding="utf-8"))
        except Exception: pass
    try:
        html=requests.get(URL,timeout=20,headers={"User-Agent":"Mozilla/5.0"}).text
        soup=BeautifulSoup(html,"html.parser")
        items=[]
        seen=set()
        for heading in soup.find_all(["h2","h3"]):
            title=" ".join(heading.get_text(" ",strip=True).split())
            low=title.lower()
            if not title or title in seen: continue
            if any(x in low for x in BLOCK_WORDS): continue
            if not any(x in low for x in SAFE_WORDS): continue
            seen.add(title)
            date_text=""
            prev=heading.find_previous(string=re.compile(r"(jan|feb|már|ápr|máj|jún|júl|aug|szept|okt|nov|dec)",re.I))
            if prev: date_text=" ".join(str(prev).split())[:24]
            items.append({"date":date_text,"title":title})
            if len(items)>=5: break
        if items:
            OUT.write_text(json.dumps({"updated":date.today().isoformat(),"source":URL,"news":items},ensure_ascii=False,indent=2),encoding="utf-8")
            return
    except Exception as e:
        print("news update failed:",e)
    if old:
        print("Keeping previous local-news.json")
main()
