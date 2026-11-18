/* Rookwise – logika szachowa (FEN, ruchy, SAN, PGN). Bez zależności. */
(function (root) {
  "use strict";
  const FILES = "abcdefgh";
  const sqName = (s) => FILES[s & 7] + ((s >> 3) + 1);
  const sqIndex = (n) => FILES.indexOf(n[0]) + 8 * (+n[1] - 1);
  const isWhite = (p) => p !== null && p === p.toUpperCase();
  const colorOf = (p) => (p === null ? null : isWhite(p) ? "w" : "b");
  const N_OFF = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const K_OFF = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const B_DIR = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const R_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function off(s, df, dr) {
    const f = (s & 7) + df, r = (s >> 3) + dr;
    return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
  }

  class Board {
    constructor(fen) {
      this.sq = new Array(64).fill(null);
      this.load(fen || START);
    }
    clone() {
      const b = Object.create(Board.prototype);
      b.sq = this.sq.slice();
      b.turn = this.turn; b.castling = this.castling; b.ep = this.ep;
      b.half = this.half; b.full = this.full;
      return b;
    }
    load(fen) {
      const [pl, turn, cast, ep, half, full] = fen.trim().split(/\s+/);
      this.sq.fill(null);
      const rows = pl.split("/");
      for (let r = 0; r < 8; r++) {
        let f = 0;
        for (const ch of rows[r]) {
          if (/\d/.test(ch)) f += +ch;
          else { this.sq[(7 - r) * 8 + f] = ch; f++; }
        }
      }
      this.turn = turn || "w";
      this.castling = cast && cast !== "-" ? cast : "";
      this.ep = ep && ep !== "-" ? sqIndex(ep) : -1;
      this.half = +(half || 0);
      this.full = +(full || 1);
    }
    placement() {
      let out = "";
      for (let r = 7; r >= 0; r--) {
        let e = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.sq[r * 8 + f];
          if (!p) { e++; continue; }
          if (e) { out += e; e = 0; }
          out += p;
        }
        if (e) out += e;
        if (r) out += "/";
      }
      return out;
    }
    legalEp() { // pole en passant tylko gdy bicie w przelocie jest legalne (jak python-chess)
      if (this.ep < 0) return -1;
      return this.moves().some((m) => m.flag === "e") ? this.ep : -1;
    }
    fen() {
      const ep = this.legalEp();
      return `${this.placement()} ${this.turn} ${this.castling || "-"} ${ep >= 0 ? sqName(ep) : "-"} ${this.half} ${this.full}`;
    }
    epd() {
      const ep = this.legalEp();
      return `${this.placement()} ${this.turn} ${this.castling || "-"} ${ep >= 0 ? sqName(ep) : "-"}`;
    }
    king(color) {
      const k = color === "w" ? "K" : "k";
      return this.sq.indexOf(k);
    }
    // czy pole s jest atakowane przez stronę by
    attacked(s, by) {
      return this.attackers(by, s, true).length > 0;
    }
    attackers(by, s, firstOnly) {
      const out = [], w = by === "w", sq = this.sq;
      const add = (t) => { out.push(t); return firstOnly; };
      // pionki
      const pr = w ? -1 : 1, pawn = w ? "P" : "p";
      for (const df of [-1, 1]) {
        const t = off(s, df, pr);
        if (t >= 0 && sq[t] === pawn && add(t)) return out;
      }
      const kn = w ? "N" : "n";
      for (const [df, dr] of N_OFF) {
        const t = off(s, df, dr);
        if (t >= 0 && sq[t] === kn && add(t)) return out;
      }
      const kg = w ? "K" : "k";
      for (const [df, dr] of K_OFF) {
        const t = off(s, df, dr);
        if (t >= 0 && sq[t] === kg && add(t)) return out;
      }
      const slide = (dirs, a, b) => {
        for (const [df, dr] of dirs) {
          let t = off(s, df, dr);
          while (t >= 0) {
            const p = sq[t];
            if (p) { if (p === a || p === b) { if (add(t)) return true; } break; }
            t = off(t, df, dr);
          }
        }
        return false;
      };
      if (slide(B_DIR, w ? "B" : "b", w ? "Q" : "q")) return out;
      if (slide(R_DIR, w ? "R" : "r", w ? "Q" : "q")) return out;
      return out;
    }
    inCheck(color) {
      color = color || this.turn;
      const k = this.king(color);
      return k >= 0 && this.attacked(k, color === "w" ? "b" : "w");
    }
    pseudo() {
      const out = [], us = this.turn, them = us === "w" ? "b" : "w", sq = this.sq;
      const push = (from, to, flag, promo) => out.push({ from, to, flag: flag || "n", promo: promo || null, piece: sq[from], captured: flag === "e" ? (us === "w" ? "p" : "P") : sq[to] });
      for (let s = 0; s < 64; s++) {
        const p = sq[s];
        if (!p || colorOf(p) !== us) continue;
        const t = p.toLowerCase();
        if (t === "p") {
          const dir = us === "w" ? 1 : -1, startR = us === "w" ? 1 : 6, lastR = us === "w" ? 7 : 0;
          const one = off(s, 0, dir);
          const promoPush = (from, to, flag) => {
            if ((to >> 3) === lastR) for (const pr of "qrbn") push(from, to, flag, pr);
            else push(from, to, flag);
          };
          if (one >= 0 && !sq[one]) {
            promoPush(s, one, "n");
            const two = off(s, 0, 2 * dir);
            if ((s >> 3) === startR && !sq[two]) push(s, two, "b");
          }
          for (const df of [-1, 1]) {
            const t2 = off(s, df, dir);
            if (t2 < 0) continue;
            if (sq[t2] && colorOf(sq[t2]) === them) promoPush(s, t2, "c");
            else if (t2 === this.ep) push(s, t2, "e");
          }
        } else if (t === "n" || t === "k") {
          for (const [df, dr] of (t === "n" ? N_OFF : K_OFF)) {
            const t2 = off(s, df, dr);
            if (t2 < 0) continue;
            if (!sq[t2]) push(s, t2, "n");
            else if (colorOf(sq[t2]) === them) push(s, t2, "c");
          }
          if (t === "k") {
            const r = us === "w" ? 0 : 56;
            if (s === r + 4 && !this.attacked(s, them)) {
              const kSide = us === "w" ? "K" : "k", qSide = us === "w" ? "Q" : "q";
              if (this.castling.includes(kSide) && !sq[r + 5] && !sq[r + 6] && sq[r + 7] === (us === "w" ? "R" : "r") &&
                  !this.attacked(r + 5, them) && !this.attacked(r + 6, them)) push(s, r + 6, "k");
              if (this.castling.includes(qSide) && !sq[r + 3] && !sq[r + 2] && !sq[r + 1] && sq[r] === (us === "w" ? "R" : "r") &&
                  !this.attacked(r + 3, them) && !this.attacked(r + 2, them)) push(s, r + 2, "q");
            }
          }
        } else {
          const dirs = t === "b" ? B_DIR : t === "r" ? R_DIR : B_DIR.concat(R_DIR);
          for (const [df, dr] of dirs) {
            let t2 = off(s, df, dr);
            while (t2 >= 0) {
              if (!sq[t2]) push(s, t2, "n");
              else { if (colorOf(sq[t2]) === them) push(s, t2, "c"); break; }
              t2 = off(t2, df, dr);
            }
          }
        }
      }
      return out;
    }
    moves() {
      const us = this.turn;
      return this.pseudo().filter((m) => {
        const b = this.clone();
        b._apply(m);
        return !b.inCheck(us);
      });
    }
    _apply(m) {
      const sq = this.sq, us = this.turn;
      const p = sq[m.from];
      sq[m.to] = m.promo ? (us === "w" ? m.promo.toUpperCase() : m.promo) : p;
      sq[m.from] = null;
      if (m.flag === "e") sq[m.to + (us === "w" ? -8 : 8)] = null;
      if (m.flag === "k") { sq[m.to - 1] = sq[m.to + 1]; sq[m.to + 1] = null; }
      if (m.flag === "q") { sq[m.to + 1] = sq[m.to - 2]; sq[m.to - 2] = null; }
      // prawa do roszady
      let c = this.castling;
      if (p === "K") c = c.replace(/[KQ]/g, "");
      if (p === "k") c = c.replace(/[kq]/g, "");
      const lose = { 0: "Q", 7: "K", 56: "q", 63: "k" };
      if (lose[m.from] !== undefined) c = c.replace(lose[m.from], "");
      if (lose[m.to] !== undefined) c = c.replace(lose[m.to], "");
      this.castling = c;
      this.ep = m.flag === "b" ? (m.from + m.to) / 2 : -1;
      this.half = (p.toLowerCase() === "p" || m.captured) ? 0 : this.half + 1;
      if (us === "b") this.full++;
      this.turn = us === "w" ? "b" : "w";
    }
    push(m) { this._apply(m); return this; }
    isCapture(m) { return !!m.captured || m.flag === "e"; }
    isCheckmate() { return this.inCheck() && this.moves().length === 0; }
    isStalemate() { return !this.inCheck() && this.moves().length === 0; }
    insufficient() {
      const pcs = this.sq.filter((p) => p && p.toLowerCase() !== "k");
      if (pcs.length === 0) return true;
      if (pcs.length === 1 && "nNbB".includes(pcs[0])) return true;
      if (pcs.every((p) => p.toLowerCase() === "b")) {
        const colors = new Set();
        this.sq.forEach((p, i) => { if (p && p.toLowerCase() === "b") colors.add(((i & 7) + (i >> 3)) % 2); });
        return colors.size === 1;
      }
      return false;
    }
    isGameOver() { return this.moves().length === 0 || this.insufficient(); }
    uci(m) { return sqName(m.from) + sqName(m.to) + (m.promo || ""); }
    fromUci(u) {
      const f = sqIndex(u.slice(0, 2)), t = sqIndex(u.slice(2, 4)), pr = u[4] || null;
      return this.moves().find((m) => m.from === f && m.to === t && (m.promo || null) === pr) || null;
    }
    san(m) {
      let s;
      if (m.flag === "k") s = "O-O";
      else if (m.flag === "q") s = "O-O-O";
      else {
        const p = this.sq[m.from], t = p.toLowerCase(), cap = this.isCapture(m);
        if (t === "p") {
          s = (cap ? FILES[m.from & 7] + "x" : "") + sqName(m.to) + (m.promo ? "=" + m.promo.toUpperCase() : "");
        } else {
          const others = this.moves().filter((o) => o.to === m.to && o.from !== m.from && this.sq[o.from] === p);
          let dis = "";
          if (others.length) {
            const sameFile = others.some((o) => (o.from & 7) === (m.from & 7));
            const sameRank = others.some((o) => (o.from >> 3) === (m.from >> 3));
            if (!sameFile) dis = FILES[m.from & 7];
            else if (!sameRank) dis = String((m.from >> 3) + 1);
            else dis = sqName(m.from);
          }
          s = t.toUpperCase() + dis + (cap ? "x" : "") + sqName(m.to);
        }
      }
      const b = this.clone();
      b._apply(m);
      if (b.inCheck()) s += b.moves().length ? "+" : "#";
      return s;
    }
    parseSan(text) {
      let t = text.replace(/[!?+#]+$/g, "").replace(/0/g, "O").trim();
      const legal = this.moves();
      for (const m of legal) if (this.san(m).replace(/[+#]/g, "") === t) return m;
      // luźniejsze dopasowanie (np. zbędna dookreślenie, brak "=")
      const mm = t.match(/^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])=?([NBRQ])?$/i);
      if (!mm) return null;
      const [, pc, ff, fr, to, pr] = mm;
      const cand = legal.filter((m) => {
        const p = this.sq[m.from].toUpperCase();
        if ((pc ? pc.toUpperCase() : "P") !== p) return false;
        if (sqName(m.to) !== to) return false;
        if (ff && FILES[m.from & 7] !== ff) return false;
        if (fr && String((m.from >> 3) + 1) !== fr) return false;
        if ((m.promo || "") !== (pr ? pr.toLowerCase() : "")) return false;
        return true;
      });
      return cand.length === 1 ? cand[0] : null;
    }
    // czy figura na polu s jest związana z własnym królem
    isPinned(color, s) {
      const k = this.king(color);
      if (k < 0 || this.sq[s] === null) return false;
      const them = color === "w" ? "b" : "w";
      if (this.attacked(k, them)) return false;
      const b = this.clone();
      b.sq[s] = null;
      return b.attacked(k, them);
    }
  }

  // ---------- PGN ----------
  function parsePGN(text) {
    const headers = {};
    text.replace(/\[(\w+)\s+"([^"]*)"\]/g, (_, k, v) => { headers[k] = v; return ""; });
    let body = text.replace(/\[(\w+)\s+"([^"]*)"\]/g, "");
    const board = new Board(headers.FEN || START);
    const start = board.fen();
    const moves = [], clocks = [];
    // usuń warianty (zagnieżdżone nawiasy)
    let depth = 0, clean = "";
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === "{") { const j = body.indexOf("}", i); clean += body.slice(i, j + 1); i = j; continue; }
      if (ch === "(") { depth++; continue; }
      if (ch === ")") { depth--; continue; }
      if (depth === 0) clean += ch;
    }
    const re = /\{([^}]*)\}|(\$\d+)|(\d+\.(?:\.\.)?)|(1-0|0-1|1\/2-1\/2|\*)|([^\s{}]+)/g;
    let m;
    while ((m = re.exec(clean))) {
      if (m[1] !== undefined) {
        const c = m[1].match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);
        if (c && moves.length) clocks[moves.length - 1] = (+c[1]) * 3600 + (+c[2]) * 60 + parseFloat(c[3]);
        continue;
      }
      if (m[2] || m[3] || m[4]) continue;
      const tok = m[5].replace(/^\d+\.+/, "");
      if (!tok) continue;
      const mv = board.parseSan(tok);
      if (!mv) throw new Error("Illegal move in PGN: " + tok);
      moves.push(mv);
      board._apply(mv);
    }
    return { headers, startFen: start, moves, clocks };
  }

  const API = { Board, parsePGN, sqName, sqIndex, START };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.ChessLib = API;
})(typeof self !== "undefined" ? self : this);
