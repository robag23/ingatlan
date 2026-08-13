# Sziget–Baracsi Ingatlan – GitHub Pages + helyi importer

## Mi van ebben a verzióban?

- 43 aktív ingatlan linkje: `data/active.txt`
- Eladott ingatlanok: `data/sold.txt`
- Összes aktív ingatlan: `properties.html`
- Főoldal: csak a `featured=true` ÉS legalább 50 000 000 Ft-os aktív ingatlanok
- Kirakati kijelző: `/display/`
- Helyi Windows importer: `scripts/local_import.py`

## ELSŐ ALKALOMMAL – a 43 hirdetés beolvasása

1. Csomagold ki / másold ezt a teljes projektet a Git repository mappádba.
2. A régi fájlokat nyugodtan cseréld le ezzel a teljes verzióval.
3. Windowsban dupla kattintás:

   `FRISSITS_MINDEN_HIRDETEST.bat`

4. Az első indulás létrehozza a `.venv` Python környezetet és telepíti a szükséges csomagokat.
5. Ezután végigpróbálja mind a 43 aktív hirdetést és az eladott listát.
6. A sikeresen beolvasott hirdetések bekerülnek a `data/properties.json` fájlba, a képek pedig az `assets/images/` mappába.
7. Ellenőrzés után GitHub Desktopból Commit + Push, vagy használd:

   `IMPORT_ES_GITHUBRA_FELTOLT.bat`

## KÉSŐBB – új hirdetés

1. `data/active.txt`
2. új sorba:
   `https://ingatlan.com/XXXXXXXX`
3. dupla kattintás:
   `IMPORT_UJ_INGATLANOK.bat`
4. Commit + Push

Az importer ilyenkor a már meglévő hirdetéseket kihagyja és csak az új ID-ket próbálja beolvasni.

## ELADOTT INGATLAN

Vágd ki a linket:
`data/active.txt`

és tedd át:
`data/sold.txt`

Utána futtasd:
`IMPORT_UJ_INGATLANOK.bat`

Az ingatlan eltűnik:
- az Eladó ingatlanok oldalról
- a kirakati kijelzőről

és megjelenik:
- az Eladott ingatlanok oldalon.

## FŐOLDAL

A főoldalon csak:
- `status = active`
- `featured = true`
- ár >= 50 000 000 Ft

ingatlanok jelennek meg.

Az `properties.html` oldalon minden aktív hirdetés megjelenik.

## FONTOS

A GitHub Actions-os automatikus ingatlan.com scraper törölve lett, mert az ingatlan.com a GitHub runner IP-címeknek HTTP 403 választ adott.

A linkek feldolgozása ezért a saját Windows számítógépen történik, majd a kész JSON és képek kerülnek fel GitHubra.
