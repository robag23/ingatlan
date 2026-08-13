TELJES V3 – ELŐZŐ JAVÍTÁSOK + KIRAKATI MÓD

Benne van:
- 43 aktív hirdetés
- főoldalon csak 50M+ ingatlanok
- jobb felső kártyacímkék
- nagyobb/tisztább fejléc logó
- kirakati /display/ nézet valódi ingatlan.com CDN képekkel
- 3 ingatlanonként saját reklám
- saját kép reklám lehetőség

Ha az előző V2 már fent van, minimum ezt cseréld:

1. display/index.html
2. display/display.css
3. display/display.js

és ADD HOZZÁ:

4. display/ads.json
5. display/ads/README.txt

Mivel viszont ez a ZIP az előző javításokat is tartalmazza, a legegyszerűbb és legbiztosabb:
A TELJES ZIP tartalmával írd felül a jelenlegi repositoryt.

SAJÁT REKLÁM:
display/ads.json

Szöveges reklám:
{
  "active": true,
  "type": "text",
  "eyebrow": "Sziget-Baracsi Ingatlan",
  "title": "Eladná ingatlanát?",
  "text": "Ide jön a reklámszöveg.",
  "phone": "+36 70 319 6582",
  "address": "7900 Szigetvár, József A. utca 35.",
  "website": "www.szigetvaringatlan.hu"
}

Képes reklám:
- kép feltöltése display/ads/ mappába
- ads.json:
{
  "active": true,
  "type": "image",
  "image": "ads/reklam.jpg",
  "alt": "Saját reklám"
}

A kijelző jelenleg 10 másodpercenként vált, és 3 ingatlanonként tesz be egy saját reklámot.
