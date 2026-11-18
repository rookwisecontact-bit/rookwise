# Rookwise

Free, private chess game review that runs entirely in the browser.
Import games by username, every move is analysed by Stockfish 19 (WebAssembly)
on the visitor's own device – no analysis server needed.

## Struktura

```
public/            ← to idzie na hosting (strona statyczna)
  index.html, app.css, js/ (chess.js, analysis.js, app.js, pieces.js)
  about.html, privacy.html, terms.html, page.css, _headers
  engine/          ← Stockfish 19 lite (pobierany przez serve.py)
  data/book.json   ← książka debiutów (lichess chess-openings, CC0)
functions/proxy/   ← Cloudflare Pages Function: pośrednik do publicznego API z partiami
serve.py           ← lokalny podgląd (to samo co online), port 8790
LICENSE            ← GPL-3.0 (wymagana, bo dystrybuujemy Stockfisha)
```

## Lokalnie

```
python serve.py
```
Pierwsze uruchomienie pobiera pliki silnika do `public/engine/`.

## Przed publikacją – podmień
- `TWOJA_NAZWA` w `public/js/config.js` → link do Twojego Ko-fi (dopóki nie podmienisz, przycisk Support jest ukryty)
- `CHANGE_ME@example.com` w `functions/proxy/[[path]].js` i `serve.py`
- `CONTACT_EMAIL` w `about.html`, `privacy.html`, `terms.html`
- `LAST_UPDATED` w `privacy.html`, `terms.html` (dzisiejsza data)
- `SOURCE_CODE_URL` w `about.html` → adres Twojego repozytorium na GitHubie

## Publikacja (Cloudflare Pages, za darmo)
1. Konto na github.com → nowe **publiczne** repozytorium `chess-review`.
2. Wgraj zawartość tego folderu (Add file → Upload files, przeciągnij wszystko) (razem z `public/engine/` i `public/data/`).
3. dash.cloudflare.com → Workers & Pages → Create → Pages → **Connect to Git** → wybierz repo. Project name: `rookwise` → adres `rookwise.pages.dev`.
4. Build command: *(puste)*, Build output directory: `public`. Deploy.
5. Folder `functions/` zostanie wykryty automatycznie (proxy `/proxy/*`).
6. Strona działa pod `https://<nazwa>.pages.dev`. Własna domena: Custom domains → dodaj.

Każdy `git push` = automatyczna nowa wersja strony.
