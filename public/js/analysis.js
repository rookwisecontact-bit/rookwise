/* Rookwise – analiza w przeglądarce: Stockfish (WebAssembly), ocena ruchów, celność, zapis. */
(function () {
  "use strict";
  const { Board, parsePGN, sqName } = window.ChessLib;

  // ------------------------------------------------------------ ustawienia
  const ENGINE_URL = "engine/stockfish-19-lite-single.js";
  const TIME_CAP_MS = 700;           // maks. czas silnika na jedną pozycję
  const MATE_CP = 100000;
  // Parametry celności dopasowane do 168 wyników referencyjnych, policzonych TYM silnikiem
  // (Stockfish 19 lite w przeglądarce, głębokość 14). Średni błąd na nieznanych partiach ≈ 3,1 pkt.
  // Model celności jest stały – użytkownik nie może go zmieniać.
  const MODEL = Object.freeze({ k: 0.00241435693595941, c: 0.11320046600040513, p: -0.1411161325187747,
                  floor: 15.327595943086683, book: 1, bestzero: 1 });
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const CLASS_NAMES = ["Brilliant", "Great", "Best", "Excellent", "Good", "Book",
                       "Inaccuracy", "Mistake", "Miss", "Blunder", "Forced"];

  // ------------------------------------------------------------ matematyka celności
  const winPercent = (cp) => {
    cp = Math.max(-MATE_CP, Math.min(MATE_CP, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  };
  const epK = (rating) => (rating ? Math.max(0.0020, Math.min(0.0042, 0.0016 + 0.000001 * rating)) : 0.0031);
  const expectedPoints = (cp, k) => 100 / (1 + Math.exp(-k * Math.max(-2000, Math.min(2000, cp))));
  const EP_K_ACC = 0.0024;
  function powerMean(vals, p) {
    if (!vals.length) return 0;
    return Math.pow(vals.reduce((s, v) => s + Math.pow(Math.max(v, 0.01), p), 0) / vals.length, 1 / p);
  }
  function playerAccuracy(raw, m) {
    m = MODEL;
    const vals = [];
    for (const [cpb, cpa, best, fixed] of raw) {
      if (fixed) { if (m.book) vals.push(100); continue; }
      const loss = (best && m.bestzero) ? 0 : Math.max(0, expectedPoints(cpb, m.k) - expectedPoints(cpa, m.k));
      vals.push(Math.max(m.floor, 100 * Math.exp(-m.c * loss)));
    }
    return vals.length ? powerMean(vals, m.p) : 100;
  }
  function gameRating(acc, real) {
    let est;
    if (real) {
      const expected = 55 + 0.013 * real;
      est = real + Math.max(-600, Math.min(600, (acc - expected) * 45));
    } else {
      est = 2.05 + 12.9 * acc - 0.256 * acc * acc + 0.00401 * acc ** 3;
    }
    return Math.round(Math.max(100, Math.min(3300, est)) / 10) * 10;
  }
  const scoreText = (cpw, mateW) => {
    if (mateW !== null && mateW !== undefined) return mateW > 0 ? `M${mateW}` : `-M${-mateW}`;
    return (cpw >= 0 ? "+" : "") + (cpw / 100).toFixed(1);
  };

  // ------------------------------------------------------------ silnik (pula workerów)
  class Engine {
    constructor() {
      this.w = new Worker(ENGINE_URL);
      this.listeners = [];
      this.w.onmessage = (e) => { const line = typeof e.data === "string" ? e.data : String(e.data); this.listeners.slice().forEach((f) => f(line)); };
      this.ready = this.cmd("uci", (l) => l === "uciok").then(() => {
        this.send("setoption name Hash value 16");
        return this.cmd("isready", (l) => l === "readyok");
      });
    }
    send(s) { this.w.postMessage(s); }
    cmd(s, until) {
      return new Promise((res) => {
        const f = (l) => { if (until(l)) { this.listeners = this.listeners.filter((x) => x !== f); res(); } };
        this.listeners.push(f);
        this.send(s);
      });
    }
    analyse(fen, depth, multipv) {
      return new Promise((res) => {
        const lines = {};
        const f = (l) => {
          if (l.startsWith("info") && l.includes(" pv ") && l.includes(" score ")) {
            const mp = +(l.match(/ multipv (\d+)/) || [0, 1])[1];
            const sc = l.match(/ score (cp|mate) (-?\d+)/);
            const pv = l.split(" pv ")[1].trim().split(/\s+/);
            lines[mp] = { type: sc[1], v: +sc[2], pv };
          } else if (l.startsWith("bestmove")) {
            this.listeners = this.listeners.filter((x) => x !== f);
            res(lines);
          }
        };
        this.listeners.push(f);
        this.send(`setoption name MultiPV value ${multipv}`);
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth} movetime ${TIME_CAP_MS}`);
      });
    }
    terminate() { this.w.terminate(); }
  }
  let pool = null;
  function getPool() {
    if (!pool) {
      const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
      pool = { engines: Array.from({ length: n }, () => new Engine()), free: [] };
      pool.free = pool.engines.slice();
      pool.waiters = [];
    }
    return pool;
  }
  async function withEngine(fn) {
    const p = getPool();
    let e = p.free.pop();
    if (!e) e = await new Promise((r) => p.waiters.push(r));
    await e.ready;
    try { return await fn(e); }
    finally { const w = p.waiters.shift(); if (w) w(e); else p.free.push(e); }
  }

  // ------------------------------------------------------------ baza debiutów
  let bookP = null;
  function getBook() {
    if (!bookP) bookP = fetch("data/book.json").then((r) => r.json())
      .then((d) => ({ positions: new Set(d.positions), names: d.names })).catch(() => null);
    return bookP;
  }

  // ------------------------------------------------------------ zapis (IndexedDB)
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((res, rej) => {
      const r = indexedDB.open("chess-review", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("reviews", { keyPath: "url" }); r.result.createObjectStore("cache", { keyPath: "key" }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbP;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode), st = tx.objectStore(store);
      const req = fn(st);
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  const putReview = (rec) => idb("reviews", "readwrite", (s) => s.put(rec));
  const getReviewRec = (url) => idb("reviews", "readonly", (s) => s.get(url));
  const allReviewUrls = () => idb("reviews", "readonly", (s) => s.getAllKeys());

  // ------------------------------------------------------------ dane z chess.com (przez pośrednika /proxy)
  async function getJSON(path) {
    let last;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch("proxy/" + path);
        if (r.status === 404) throw Object.assign(new Error("Player not found."), { fatal: true });
        if (r.ok) return await r.json();
        last = new Error("Games service error " + r.status);
      } catch (e) { if (e.fatal) throw e; last = e; }
      await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
    }
    throw new Error("Can't reach the games service. Try again in a minute. (" + (last && last.message) + ")");
  }
  async function fetchMonth(url) {
    const path = url.replace(/^https:\/\/api\.chess\.com\//, "");
    const m = path.match(/(\d{4})\/(\d{2})$/), now = new Date();
    const finished = m && (+m[1] * 12 + +m[2]) < (now.getFullYear() * 12 + now.getMonth() + 1);
    if (finished) {
      const c = await idb("cache", "readonly", (s) => s.get(path)).catch(() => null);
      if (c) return c.data;
    }
    const data = await getJSON(path);
    if (finished) idb("cache", "readwrite", (s) => s.put({ key: path, data })).catch(() => {});
    return data;
  }

  const RESULT_DRAW = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);
  const REASON = { checkmated: "Checkmate", resigned: "Resignation", timeout: "Timeout", abandoned: "Abandoned",
    agreed: "Agreement", repetition: "Repetition", stalemate: "Stalemate", insufficient: "Insufficient material",
    "50move": "50-move rule", timevsinsufficient: "Timeout vs insufficient material" };
  function tcText(tc) {
    tc = tc || "";
    if (tc.includes("/")) { const d = Math.round(+tc.split("/")[1] / 86400); return d + (d === 1 ? " day" : " days"); }
    if (tc.includes("+")) { const [b, i] = tc.split("+"); return (+b >= 60 ? (+b / 60) : b + "s") + "+" + i; }
    if (/^\d+$/.test(tc)) return +tc >= 60 ? (+tc / 60) + " min" : tc + " sec";
    return tc;
  }

  const S = { user: "", games: [], archives: [], next: 0, reviewed: new Set(), accCache: {} };

  function summary(g) {
    const meWhite = g.white.username.toLowerCase() === S.user.toLowerCase();
    const color = meWhite ? "white" : "black", me = g[color], opp = g[meWhite ? "black" : "white"];
    let result, code;
    if (me.result === "win") { result = "win"; code = opp.result; }
    else if (RESULT_DRAW.has(me.result)) { result = "draw"; code = me.result; }
    else { result = "loss"; code = me.result; }
    // numery ruchów z samego zapisu (bez komentarzy z zegarem, np. {[%clk 0:09:59.9]})
    const body = g.pgn.split("\n\n").slice(1).join(" ").replace(/\{[^}]*\}/g, " ").replace(/\([^)]*\)/g, " ");
    const nums = (body.match(/(?:^|\s)(\d+)\.(?!\d)/g) || []).map((x) => parseInt(x, 10));
    return {
      url: g.url, result, reason: REASON[code] || code, color, moves: nums.length ? Math.max(...nums) : 0,
      me: { name: me.username, rating: me.rating }, opp: { name: opp.username, rating: opp.rating },
      tc: g.time_class || "", tc_text: tcText(g.time_control), end_time: g.end_time || 0,
      acc: S.accCache[g.url] != null ? S.accCache[g.url][color] : null, analyzed: S.reviewed.has(g.url),
    };
  }

  async function loadGames(user, more) {
    user = user.trim();
    if (!more || user.toLowerCase() !== S.user.toLowerCase()) {
      const a = await getJSON(`pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`);
      Object.assign(S, { user, games: [], archives: (a.archives || []).slice().reverse(), next: 0 });
      try { localStorage.setItem("nick", user); } catch (e) { /* brak */ }
    }
    const urls = await allReviewUrls().catch(() => []);
    S.reviewed = new Set(urls);
    let added = 0;
    while (S.next < S.archives.length && added < 40) {
      const d = await fetchMonth(S.archives[S.next]);
      const gs = (d.games || []).filter((g) => g.rules === "chess" && g.pgn).reverse();
      S.games.push(...gs);
      added += gs.length;
      S.next++;
    }
    await fillAcc();
    return { user: S.user, games: S.games.map(summary), has_more: S.next < S.archives.length };
  }
  async function fillAcc() {
    for (const url of S.reviewed) {
      if (S.accCache[url]) continue;
      const rec = await getReviewRec(url);
      if (rec && rec.acc_raw) S.accCache[url] = { white: +playerAccuracy(rec.acc_raw.white).toFixed(1), black: +playerAccuracy(rec.acc_raw.black).toFixed(1) };
    }
  }
  const findGame = (url) => S.games.find((g) => g.url === url);

  // ------------------------------------------------------------ analiza partii
  function replay(pgn) {
    const g = parsePGN(pgn);
    const boards = [new Board(g.startFen)];
    for (const m of g.moves) boards.push(boards[boards.length - 1].clone().push(m));
    return { ...g, boards };
  }
  function infoFromLines(lines, board) {
    const sign = board.turn === "w" ? 1 : -1;
    const conv = (L) => {
      if (!L) return null;
      if (L.type === "mate") return { cpw: sign * (L.v > 0 ? MATE_CP - L.v : -MATE_CP - L.v), mateW: sign * L.v, mateStm: L.v };
      return { cpw: sign * L.v, mateW: null, mateStm: null };
    };
    const a = conv(lines[1]) || { cpw: 0, mateW: null, mateStm: null }, b = conv(lines[2]);
    return { cpw: a.cpw, disp: scoreText(a.cpw, a.mateW), pv: lines[1] ? lines[1].pv : [], second: b ? b.cpw : null, mate: a.mateStm };
  }
  function terminalInfo(b) {
    if (b.isCheckmate()) { const cpw = b.turn === "w" ? -MATE_CP : MATE_CP; return { cpw, disp: cpw > 0 ? "1-0" : "0-1", pv: [], second: null, mate: null }; }
    return { cpw: 0, disp: "½-½", pv: [], second: null, mate: null };
  }

  function material(b, color) {
    let t = 0;
    for (const p of b.sq) if (p) t += (p === p.toUpperCase() ? "w" : "b") === color ? VAL[p.toLowerCase()] : -VAL[p.toLowerCase()];
    return t;
  }
  function hangingGain(b, s) {
    const p = b.sq[s];
    if (!p || "pPkK".includes(p)) return 0;
    const color = p === p.toUpperCase() ? "w" : "b", them = color === "w" ? "b" : "w";
    const v = VAL[p.toLowerCase()];
    const defended = b.attackers(color, s).length > 0;
    const vals = [];
    for (const a of b.attackers(them, s)) {
      const q = b.sq[a];
      if (q.toLowerCase() === "k") { if (!defended) vals.push(0); }
      else if (!b.isPinned(them, a)) vals.push(VAL[q.toLowerCase()]);
    }
    if (!vals.length) return 0;
    return defended ? Math.max(0, v - Math.min(...vals)) : v;
  }
  function isSacrifice(b, m) {
    const mover = b.turn, capV = m.captured ? VAL[m.captured.toLowerCase()] : 0;
    const after = b.clone().push(m);
    if (after.isCheckmate()) return false;
    let best = 0;
    after.sq.forEach((p, s) => {
      if (!p || (p === p.toUpperCase() ? "w" : "b") !== mover) return;
      const gain = hangingGain(after, s);
      if (gain < 2) return;
      if (s !== m.to && hangingGain(b, s) >= gain) return;
      best = Math.max(best, gain);
    });
    return best - capV >= 2;
  }
  function pvSacrifice(b, m, pvAfter) {
    const mover = b.turn, before = material(b, mover);
    const bb = b.clone().push(m);
    let worst = material(bb, mover);
    for (const u of (pvAfter || []).slice(0, 6)) {
      const mv = bb.fromUci(u);
      if (!mv) break;
      bb.push(mv);
      if (bb.turn === mover) worst = Math.min(worst, material(bb, mover));
    }
    const end = material(bb, mover);
    return before - end >= 2 && before - worst >= 2;
  }

  async function evaluate(boards, moves, depth, onProgress, book) {
    const n = boards.length, infos = new Array(n);
    const todo = [];
    boards.forEach((b, i) => { if (b.isGameOver()) infos[i] = terminalInfo(b); else todo.push(i); });
    let done = 0;
    await Promise.all(todo.map((i) => withEngine(async (e) => {
      const b = boards[i];
      const d = (book && i <= 24 && book.positions.has(b.epd())) ? Math.min(depth, 9) : depth;
      infos[i] = infoFromLines(await e.analyse(b.fen(), d, 1), b);
      onProgress(Math.round(85 * ++done / Math.max(1, todo.length)));
    })));
    const need = [];
    for (let i = 0; i < moves.length; i++) {
      const b = boards[i];
      if (!infos[i].pv.length || b.moves().length < 2) continue;
      if (b.uci(moves[i]) === infos[i].pv[0] || isSacrifice(b, moves[i]) || pvSacrifice(b, moves[i], infos[i + 1].pv)) need.push(i);
    }
    done = 0;
    await Promise.all(need.map((i) => withEngine(async (e) => {
      const lines = await e.analyse(boards[i].fen(), depth, 2);
      const inf = infoFromLines(lines, boards[i]);
      infos[i].second = inf.second;
      onProgress(85 + Math.round(15 * ++done / Math.max(1, need.length)));
    })));
    return infos;
  }

  function classify(g, infos, book) {
    const { boards, moves, headers: h } = g;
    const elo = (k) => parseInt(h[k + "Elo"], 10) || 0;
    const ratings = { w: elo("White"), b: elo("Black") };
    const out = [];
    let inBook = true, last = null;
    moves.forEach((mv, i) => {
      const b = boards[i], color = b.turn, sign = color === "w" ? 1 : -1;
      const bef = infos[i], aft = infos[i + 1], k = epK(ratings[color]);
      const cpB = bef.cpw * sign, cpA = aft.cpw * sign;
      const epB = expectedPoints(cpB, k), epA = expectedPoints(cpA, k);
      const best = bef.pv[0] || null, u = b.uci(mv);
      let isBest = best !== null && u === best;
      if (!isBest && bef.second !== null && best !== null && Math.abs(bef.cpw - bef.second) <= 10 && Math.abs(aft.cpw - bef.cpw) <= 10) isBest = true;
      const loss = isBest ? 0 : Math.max(0, epB - epA);
      const epSecond = bef.second !== null ? expectedPoints(bef.second * sign, k) : null;
      if (book) inBook = inBook && book.positions.has(boards[i + 1].epd());
      else inBook = i < 8 && loss <= 3;
      const afterB = boards[i + 1];
      let cls;
      if (b.moves().length === 1) cls = "Forced";
      else if (inBook) cls = "Book";
      else if (loss <= 2 && epA >= 50 && epB < 95 && !afterB.isCheckmate() &&
               (isSacrifice(b, mv) || pvSacrifice(b, mv, aft.pv)) && (epSecond === null || epSecond < 90)) cls = "Brilliant";
      else if (isBest && epSecond !== null && ((epB - epSecond >= 18 && epA >= 40 && epB < 95) ||
               (["Mistake", "Blunder", "Miss"].includes(last) && epB - epSecond >= 10 && epA >= 60))) cls = "Great";
      else if (isBest) cls = "Best";
      else if (loss < 2) cls = "Excellent";
      else if (loss < 5) cls = "Good";
      else if (loss < 10) cls = "Inaccuracy";
      else if (loss < 20) cls = "Mistake";
      else cls = "Blunder";
      if (["Inaccuracy", "Mistake", "Blunder"].includes(cls) && ["Mistake", "Blunder"].includes(last) && epB >= 65 && epA < 60) cls = "Miss";
      if (bef.mate === 1 && !afterB.isCheckmate() && cls !== "Forced" && cls !== "Book") cls = "Miss";
      let note = "";
      if (aft.mate !== null && aft.mate > 0 && ["Mistake", "Blunder", "Miss"].includes(cls)) note = ` Allows mate in ${aft.mate}.`;
      if (bef.mate === 1 && cls === "Miss") note = " Mate in 1 was available!";
      const fixed = cls === "Book" || cls === "Forced";
      const clamp = (x) => Math.round(Math.max(-2000, Math.min(2000, x)));
      const bestMove = best ? b.fromUci(best) : null;
      out.push({ mv, san: b.san(mv), color, cls, raw: [clamp(cpB), clamp(cpA), isBest, fixed],
                 best: bestMove ? b.uci(bestMove) : null, best_san: bestMove ? b.san(bestMove) : null,
                 best_from: bestMove ? sqName(bestMove.from) : null, best_to: bestMove ? sqName(bestMove.to) : null, note });
      last = cls;
    });
    const stats = {};
    for (const [c, key] of [["w", "White"], ["b", "Black"]]) {
      const mine = out.filter((m) => m.color === c);
      const raw = mine.map((m) => m.raw);
      const acc = mine.length ? playerAccuracy(raw) : 0;
      const counts = {};
      CLASS_NAMES.forEach((n) => { counts[n] = mine.filter((m) => m.cls === n).length; });
      stats[c] = { name: h[key] || "?", elo: h[key + "Elo"] || "?", real: ratings[c], raw, acc, counts };
    }
    let opening = "";
    if (book) for (const b of boards) { const nm = book.names[b.epd()]; if (nm) opening = nm; }
    if (!opening && h.ECOUrl) opening = h.ECOUrl.replace(/\/$/, "").split("/").pop().replace(/-/g, " ");
    return { out, stats, opening };
  }

  function reviewJSON(rec, g, infos, cl) {
    const plies = g.boards.map((b, i) => {
      const inf = infos[i], line = [], bb = b.clone();
      for (const u of (inf.pv || []).slice(0, 10)) {
        const m = bb.fromUci(u);
        if (!m) break;
        const san = bb.san(m);
        bb.push(m);
        line.push({ uci: u, san, fen: bb.fen(), from: sqName(m.from), to: sqName(m.to) });
      }
      return { fen: b.fen(), eval: inf.disp, wp: +winPercent(inf.cpw).toFixed(2), line, check: b.inCheck(), move_no: b.full, turn: b.turn };
    });
    const moves = cl.out.map((m, i) => ({
      san: m.san, uci: g.boards[i].uci(m.mv), from: sqName(m.mv.from), to: sqName(m.mv.to), color: m.color, cls: m.cls,
      best: m.best, best_san: m.best_san, best_from: m.best_from, best_to: m.best_to, note: m.note,
      capture: g.boards[i].isCapture(m.mv), clock: g.clocks[i] !== undefined ? g.clocks[i] : null,
    }));
    const st = (c) => ({ name: cl.stats[c].name, elo: cl.stats[c].elo, acc: +cl.stats[c].acc.toFixed(1),
                         rating: gameRating(cl.stats[c].acc, cl.stats[c].real), counts: cl.stats[c].counts });
    return { url: rec.url, user_color: rec.user_color, opening: cl.opening, result: g.headers.Result || "*",
             termination: g.headers.Termination || "", date: g.headers.Date || "", time_control: g.headers.TimeControl || "",
             depth: rec.depth, white: st("w"), black: st("b"), plies, moves };
  }

  async function analyze(url, depth, onProgress) {
    const gm = findGame(url);
    if (!gm) throw new Error("Game not found – reload your games.");
    const g = replay(gm.pgn);
    const book = await getBook();
    onProgress(1, "Starting engine…");
    const infos = await evaluate(g.boards, g.moves, depth, (p) => onProgress(p, "Analyzing game…"), book);
    const meWhite = gm.white.username.toLowerCase() === S.user.toLowerCase();
    const rec = { url, pgn: gm.pgn, user_color: meWhite ? "white" : "black", depth, created: Date.now(),
                  infos: infos.map((x) => ({ cpw: x.cpw, disp: x.disp, pv: x.pv, second: x.second, mate: x.mate })) };
    const cl = classify(g, rec.infos, book);
    rec.acc_raw = { white: cl.stats.w.raw, black: cl.stats.b.raw };
    await putReview(rec);
    S.reviewed.add(url);
    S.accCache[url] = { white: +cl.stats.w.acc.toFixed(1), black: +cl.stats.b.acc.toFixed(1) };
    return true;
  }
  async function review(url) {
    const rec = await getReviewRec(url);
    if (!rec) throw new Error("This game has not been analyzed yet.");
    const g = replay(rec.pgn), book = await getBook();
    return reviewJSON(rec, g, rec.infos, classify(g, rec.infos, book));
  }
  function gameSummary(url) { const g = findGame(url); return g ? summary(g) : null; }

  window.Backend = { loadGames, analyze, review, gameSummary, lastUser: () => { try { return localStorage.getItem("nick") || ""; } catch (e) { return ""; } } };
  window.__test = { winPercent, playerAccuracy, gameRating, classify, replay, isSacrifice, pvSacrifice, infoFromLines, MODEL };
})();
