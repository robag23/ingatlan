# Sziget-Baracsi Ingatlan – GitHub Pages + automatikus linklista

## Neked később csak ezt kell szerkesztened

### Új / aktív ingatlan
Nyisd meg:

`data/active.txt`

és új sorba másold be:

`https://ingatlan.com/XXXXXXXX`

Ezután GitHubon **Commit changes**.

A GitHub Action automatikusan:
1. megnyitja a linket,
2. megpróbálja beolvasni az alapadatokat,
3. megpróbálja letölteni a fő képet,
4. frissíti a `data/properties.json` fájlt,
5. elmenti a változást,
6. a GitHub Pages oldal ezután az új adatot mutatja,
7. a `/display/` kirakati oldal is ugyanebből frissül.

### Ha eladtátok
A linket:
- töröld az `data/active.txt` fájlból,
- másold át az `data/sold.txt` fájlba,
- Commit changes.

Ezután eltűnik az Eladó ingatlanok és a TV-kijelző listájából, és átkerül az Eladott ingatlanok közé.

## Jelenleg benne lévő aktív linkek
- https://ingatlan.com/31702370
- https://ingatlan.com/35247706
- https://ingatlan.com/35045761

## Jelenleg eladott
- https://ingatlan.com/35334800

## Első GitHub feltöltés
A ZIP teljes tartalmát töltsd fel a repository gyökerébe, tehát a `.github`, `data`, `scripts`, `assets`, `display` mappákat is.

GitHub Pages:
Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## GitHub Actions jogosultság
Ha az Action lefut, de nem tud vissza-commitolni:
Settings → Actions → General → Workflow permissions →
**Read and write permissions**.

## Kézi újrafuttatás
GitHub → Actions → `Ingatlanok automatikus frissítése` →
Run workflow.

## Fontos
Az ingatlan.com külső oldal. Ha a webhely később megváltoztatja a HTML-struktúrát vagy automatizált hozzáférését korlátozza, a beolvasó programot módosítani kellhet. A jelenlegi ismert ingatlanok adatai tartalékként bent maradnak a `properties.json` fájlban, így egy átmeneti beolvasási hiba nem üríti ki a weboldalt.
