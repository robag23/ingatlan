#!/usr/bin/env python3
from pathlib import Path
import json
import sys
import time

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
PROP = ROOT / "data" / "properties.json"
IMGDIR = ROOT / "assets" / "images"

def main():
    if not PROP.exists():
        print("HIBA: data/properties.json nem található.")
        sys.exit(1)

    data = json.loads(PROP.read_text(encoding="utf-8"))
    IMGDIR.mkdir(parents=True, exist_ok=True)

    ok = 0
    skipped = 0
    failed = []

    for p in data:
        if p.get("status") != "active":
            continue

        pid = str(p.get("id", "")).strip()
        url = str(p.get("image", "")).strip()

        if not pid:
            continue

        # Már helyi kép.
        if url.startswith("assets/images/"):
            target = ROOT / url
            if target.exists():
                print(f"[{pid}] már helyi kép → kihagyva")
                skipped += 1
                continue

        if not url.startswith("http"):
            print(f"[{pid}] nincs letölthető külső kép")
            failed.append(pid)
            continue

        target = IMGDIR / f"{pid}.jpg"

        try:
            print(f"[{pid}] kép letöltése...")
            r = requests.get(
                url,
                impersonate="chrome",
                headers={
                    "Referer": "https://ingatlan.com/",
                    "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.7",
                },
                timeout=45,
                allow_redirects=True
            )
            r.raise_for_status()

            if len(r.content) < 5000:
                raise RuntimeError(f"túl kicsi válasz: {len(r.content)} byte")

            target.write_bytes(r.content)
            p["image"] = f"assets/images/{pid}.jpg"
            ok += 1
            print(f"  OK → {target.name}")
        except Exception as e:
            print(f"  HIBA → {e}")
            failed.append(pid)

        time.sleep(0.15)

    PROP.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )

    print()
    print("==============================================")
    print("KÉPLETÖLTÉS KÉSZ")
    print("==============================================")
    print("Sikeres:", ok)
    print("Már helyi:", skipped)
    print("Sikertelen:", len(failed))
    if failed:
        print("Sikertelen ID-k:", ", ".join(failed))
    print()
    print("Most töltsd fel GitHubra:")
    print("  assets/images/")
    print("  data/properties.json")

if __name__ == "__main__":
    main()
