# Rookwise

**Free, private chess game analysis that runs entirely in your browser.**

Enter a username, pick a game and get every move rated by Stockfish 19 – brilliant moves, best moves, inaccuracies, mistakes and blunders – plus accuracy for both players, an evaluation graph and the better continuations you missed.

🌐 **Live:** https://rookwise.pages.dev

## Features

- Import your recent games by username
- Move-by-move classification with explanations and engine lines
- Accuracy and performance rating for both players
- Evaluation bar and game graph, key moments, opening name
- Wooden board themes and several piece sets
- Reviews are saved on your device – reopen them instantly later
- Works on desktop and mobile, no account, no ads

## Privacy

All analysis happens **on your own device** (Stockfish compiled to WebAssembly). The server only forwards requests for public game data; it does not store usernames, games or results. See [privacy.html](public/privacy.html).

## Project structure

```
public/              static website (deployed as-is)
  index.html, app.css
  js/                chess logic, analysis, user interface, piece graphics
  engine/            Stockfish 19 (lite, single-threaded WebAssembly build)
  data/book.json     opening book used to mark theory moves
functions/proxy/     tiny serverless proxy for public game data
serve.py             local preview server (same behaviour as the live site)
```

## Run locally

Requires Python 3.

```
python serve.py
```

Then open http://127.0.0.1:8790.

## Deploy

The site is hosted on Cloudflare Pages:

- Build command: *(none)*
- Build output directory: `public`
- The `functions/` folder is picked up automatically

## Credits

- [Stockfish](https://stockfishchess.org) – GPL-3.0
- [stockfish.js](https://github.com/nmrugg/stockfish.js) – WebAssembly build of Stockfish
- Opening names from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) – CC0

## License

Rookwise distributes Stockfish, so this project is released under the **GNU General Public License v3.0** – see [LICENSE](LICENSE).

## Disclaimer

Rookwise is an independent project and is not affiliated with, endorsed by or sponsored by Chess.com or any other chess platform. Games are loaded from the public Chess.com Published-Data API.

Contact: rookwise.contact@gmail.com · Support the project: https://ko-fi.com/rookwise
