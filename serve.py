"""Rookwise – lokalny podgląd strony (dokładnie to, co pójdzie online).

Uruchom:  python serve.py      → otworzy http://127.0.0.1:8790
Przy pierwszym starcie pobiera Stockfish 19 (wersja WASM do przeglądarki),
kopiuje książkę debiutów i licencję GPL. Potem działa jak strona na Cloudflare:
statyczne pliki z public/ + pośrednik /proxy/* do publicznego API z partiami.
"""
import json, os, re, shutil, sys, threading, time, urllib.request, webbrowser, hashlib
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "public")
PARENT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, ".proxy_cache")
PORT = 8790
CONTACT = "CHANGE_ME@example.com"  # ten sam e-mail co w functions/proxy/[[path]].js

SF = "https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/"
ENGINE_FILES = ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]
ALLOWED = re.compile(r"^pub/player/[a-z0-9_-]{2,40}/games/(archives|\d{4}/\d{2})$")


def prepare():
    eng = os.path.join(PUBLIC, "engine"); os.makedirs(eng, exist_ok=True)
    for f in ENGINE_FILES:
        p = os.path.join(eng, f)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            print("Pobieram", f, "...", flush=True)
            req = urllib.request.Request(SF + f, headers={"User-Agent": "Rookwise-setup"})
            with urllib.request.urlopen(req, timeout=120) as r, open(p + ".part", "wb") as o:
                shutil.copyfileobj(r, o)
            os.replace(p + ".part", p)
    data = os.path.join(PUBLIC, "data"); os.makedirs(data, exist_ok=True)
    book = os.path.join(data, "book.json")
    src = os.path.join(PARENT, "openings", "book.json")
    if not os.path.exists(book) and os.path.exists(src):
        shutil.copy(src, book)
    if not os.path.exists(book):
        print("UWAGA: brak public/data/book.json (książka debiutów) – ruchy 'Book' nie będą oznaczane.")
    lic = os.path.join(HERE, "LICENSE")
    if not os.path.exists(lic):
        for cand in [os.path.join(PARENT, "stockfish", "stockfish", "Copying.txt"),
                     os.path.join(PARENT, "stockfish", "Copying.txt")]:
            if os.path.exists(cand):
                shutil.copy(cand, lic); break


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "application/javascript", ".wasm": "application/wasm",
                      ".json": "application/json", ".css": "text/css"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=PUBLIC, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/proxy/"):
            return self.proxy(self.path[7:].split("?")[0].lower())
        return super().do_GET()

    def proxy(self, path):
        if not ALLOWED.match(path):
            return self.send_json(404, b'{"error":"not allowed"}')
        key = os.path.join(CACHE, hashlib.sha1(path.encode()).hexdigest() + ".json")
        finished = not path.endswith("archives") and path[-7:] < time.strftime("%Y/%m")
        if os.path.exists(key) and (finished or time.time() - os.path.getmtime(key) < 300):
            return self.send_json(200, open(key, "rb").read())
        try:
            req = urllib.request.Request("https://api.chess.com/" + path,
                                         headers={"User-Agent": f"Rookwise/1.0 (contact: {CONTACT})"})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            os.makedirs(CACHE, exist_ok=True)
            open(key, "wb").write(body)
            return self.send_json(200, body)
        except urllib.error.HTTPError as e:
            return self.send_json(e.code, json.dumps({"error": e.reason}).encode())
        except Exception as e:
            return self.send_json(502, json.dumps({"error": str(e)}).encode())

    def send_json(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    prepare()
    url = f"http://127.0.0.1:{PORT}/"
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Rookwise działa:", url, "(zamknij to okno, żeby zatrzymać)", flush=True)
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    srv.serve_forever()
