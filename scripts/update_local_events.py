#!/usr/bin/env python3
import json, re
from datetime import date, datetime
from pathlib import Path
import requests
from bs4 import BeautifulSoup

URL="https://www.szigetvar.hu/hu/esemenyek"
OUT=Path("display/local-events.json")
MONTHS={"január":1,"február":2,"március":3,"április":4,"május":5,"június":6,"július":7,"augusztus":8,"szeptember":9,"október":10,"november":11,"december":12}

def iso(y,m,d): return f"{y:04d}-{m:02d}-{d:02d}"

def main():
    r=requests.get(URL,timeout=30,headers={"User-Agent":"Sziget-Baracsi-display/1.0"})
    r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser")
    text=soup.get_text(" ",strip=True)
    events=[]
    # Robust fallback for the most important annual event if present in official page text.
    m=re.search(r"Zrínyi Napok\s+(\d{4}).{0,160}?(\d{1,2})[./-](\d{1,2})\s*[-–]\s*(\d{1,2})",text,re.I)
    if m:
        y=int(m.group(1)); mo=int(m.group(2)); d1=int(m.group(3)); d2=int(m.group(4))
        events.append({"title":f"Zrínyi Napok {y}","start":iso(y,mo,d1),"end":iso(y,mo,d2),"location":"Szigetvár","description":"Szigetvár kiemelt történelmi és közösségi rendezvénye.","url":URL})
    # Parse event cards/headings when machine-readable date attributes exist.
    for node in soup.select("article, .event, .views-row"):
        title_node=node.find(["h2","h3","h4"])
        if not title_node: continue
        title=title_node.get_text(" ",strip=True)
        raw=node.get_text(" ",strip=True)
        dm=re.search(r"(20\d{2})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})",raw)
        if dm:
            y,mo,d=map(int,dm.groups())
            if not any(e["title"]==title for e in events):
                events.append({"title":title,"start":iso(y,mo,d),"end":iso(y,mo,d),"location":"Szigetvár","description":"","url":URL})
    # Keep future/recent events, deduplicate, and never wipe a valid previous file on parsing failure.
    today=date.today()
    clean=[]
    seen=set()
    for e in events:
        try: end=datetime.fromisoformat(e["end"]).date()
        except: continue
        key=(e["title"],e["start"])
        if end>=today and key not in seen:
            seen.add(key); clean.append(e)
    if clean:
        OUT.write_text(json.dumps({"updated":today.isoformat(),"source":URL,"events":clean[:12]},ensure_ascii=False,indent=2),encoding="utf-8")
        print(f"Saved {len(clean[:12])} events")
    else:
        print("No safe parse result; keeping previous local-events.json")

if __name__=="__main__": main()
