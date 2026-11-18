/* Rookwise – logika interfejsu */
(function () {
  "use strict";
  const { pieceURL, setPieceStyle, STYLES, iconSVG, CLASSES, TC, UI, LOGO } = window.CR;

  // ---------------------------------------------------------------- stan
  const store = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* brak */ } };
  const S = {
    nick: "", games: [], hasMore: false, loading: false,
    filter: { tc: "all", res: "all", q: "" },
    depth: +store("depth3", 14), theme: store("theme2", "classic"), pieces: store("pieces2", "turned"), sound: store("sound", "1") === "1",
    review: null, url: null, ply: 0, flipped: false, follow: null, tab: "summary",
    analyzing: null, anim: null,
  };
  const THEMES = {
    classic: ["#ead6b1", "#b28864"], green: ["#ebecd0", "#739552"],
    blue: ["#dee3e6", "#8ca2ad"], slate: ["#d6d6d0", "#86837d"],
  };
  const SUMMARY_ORDER = ["Brilliant", "Great", "Best", "Excellent", "Good", "Book",
                         "Inaccuracy", "Mistake", "Miss", "Blunder"];
  const BAD = ["Inaccuracy", "Mistake", "Miss", "Blunder"];
  const KEY = ["Brilliant", "Great", "Miss", "Mistake", "Blunder"];
  const TEXT = {
    Brilliant: ["is brilliant!!", "A great sacrifice – material is given up and the position gets even better."],
    Great: ["is a great move!", "The only good move in this position. Everything else made things clearly worse."],
    Best: ["is best", "Exactly what the engine would play."],
    Excellent: ["is excellent", "Almost as good as the engine's top move."],
    Good: ["is good", "A solid move, though there was something better."],
    Book: ["is a book move", "A known move from opening theory."],
    Inaccuracy: ["is an inaccuracy", "Not losing, but it gives away part of the advantage."],
    Mistake: ["is a mistake", "This move clearly worsens the position."],
    Miss: ["is a miss", "The opponent made an error, but the chance was missed."],
    Blunder: ["is a blunder", "This move seriously damages the position."],
    Forced: ["was forced", "There was no other legal move."],
  };

  // ---------------------------------------------------------------- narzędzia
  const SUPPORT = (window.ROOKWISE && window.ROOKWISE.supportUrl) || "";
  const HAS_SUPPORT = /^https:\/\//.test(SUPPORT) && !SUPPORT.includes("TWOJA_NAZWA");
  const supportCard = () => HAS_SUPPORT ?
    `<div class="support-card"><div><b>Enjoying Rookwise?</b><small>It's free, has no ads and runs on your own device. A small tip keeps it that way.</small></div>` +
    `<a class="btn primary" href="${SUPPORT}" target="_blank" rel="noopener">♥ Support</a></div>` : "";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function fillUI(root) {
    (root || document).querySelectorAll("[data-ui]").forEach((n) => { if (!n.firstChild) n.innerHTML = UI[n.dataset.ui] || ""; });
  }
  function toast(msg, err) {
    const t = document.createElement("div");
    t.className = "toast" + (err ? " err" : "");
    t.textContent = msg;
    $("toasts").appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, err ? 6000 : 3200);
  }
  function modal(html, onReady) {
    $("modal").innerHTML = html;
    $("modalBack").classList.remove("hidden");
    fillUI($("modal"));
    $("modal").querySelectorAll("[data-close]").forEach((b) => b.onclick = closeModal);
    if (onReady) onReady($("modal"));
  }
  function closeModal() { $("modalBack").classList.add("hidden"); }
  $("modalBack").addEventListener("mousedown", (e) => { if (e.target.id === "modalBack") closeModal(); });
  const fmtClock = (s) => {
    if (s == null) return "";
    s = Math.max(0, s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    if (s < 20) return `${m}:${String(sec).padStart(2, "0")}.${Math.floor((s * 10) % 10)}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };
  function whenText(ts) {
    if (!ts) return "";
    const d = new Date(ts * 1000), now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diff = Math.round((day(now) - day(d)) / 86400000);
    const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (diff === 0) return "Today " + hm;
    if (diff === 1) return "Yesterday " + hm;
    if (diff < 7) return diff + " days ago";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  const accColor = (a) => a >= 85 ? "#81b64c" : a >= 70 ? "#a9c94a" : a >= 55 ? "#f0c040" : "#ee6b5a";

  // ---------------------------------------------------------------- dźwięk
  let audio = null;
  // Dźwięk ciężkich drewnianych bierek: krótki impuls (uderzenie) przepuszczony przez rezonatory drewna.
  // Każde stuknięcie generowane od nowa z lekką losowością – brzmi naturalnie, nigdy identycznie.
  const PLACE = [[470, .018, 1], [780, .013, .8], [1240, .009, .55], [1900, .006, .35], [2800, .004, .2], [180, .012, .3]];
  const CLACK = [[1100, .011, 1], [1750, .008, .7], [2600, .005, .4], [3700, .003, .2]];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function strikeInto(out, sr, start, res, excMs, bright, amp) {
    const m = out.length - start; if (m <= 0) return;
    const k = Math.max(2, Math.floor(excMs / 1000 * sr)), x = new Float32Array(m);
    let p = 0, q = 0, hpMax = 1e-9;
    for (let i = 0; i < k && i < m; i++) {               // impuls szumu, rozjaśniony filtrem górnoprzepustowym
      const b = (Math.random() * 2 - 1) * Math.exp(-i / (k / 3));
      q = bright * (q + b - p); p = b; x[i] = q; hpMax = Math.max(hpMax, Math.abs(q));
    }
    const sum = new Float32Array(m), y = new Float32Array(m);
    for (const [f, tau, g] of res) {                      // rezonator dwubiegunowy = jedno drganie drewna
      const r = Math.exp(-1 / (tau * sr)), c = 2 * r * Math.cos(2 * Math.PI * f / sr), r2 = r * r;
      let y1 = 0, y2 = 0, mx = 1e-9;
      for (let i = 0; i < m; i++) { const y0 = x[i] + c * y1 - r2 * y2; y[i] = y0; y2 = y1; y1 = y0; mx = Math.max(mx, Math.abs(y0)); }
      for (let i = 0; i < m; i++) sum[i] += g * y[i] / mx;
    }
    for (let i = 0; i < m; i++) out[start + i] += amp * (sum[i] + 0.5 * x[i] / hpMax);   // + trzask kontaktu
  }
  const jit = (res, s) => res.map(([f, tau, g]) => [f * s * rnd(.975, 1.025), tau * rnd(.9, 1.1), g]);
  function moveBuffer(capture) {
    const sr = audio.sampleRate, L = capture ? 0.17 : 0.09, n = Math.floor(sr * L);
    const buf = audio.createBuffer(1, n, sr), d = buf.getChannelData(0);
    if (capture) {
      strikeInto(d, sr, 0, jit(CLACK, 1), .8, .9, 1);                        // bierka uderza w bierkę
      strikeInto(d, sr, Math.floor(.045 * sr), jit(PLACE, .97), 1.8, .75, .85); // i staje na polu
    } else strikeInto(d, sr, 0, jit(PLACE, 1), 1.8, .75, 1);                 // bierka stawiana na planszy
    let peak = 0;
    for (let i = 0; i < n; i++) { d[i] *= Math.min(1, (L - i / sr) / 0.01); peak = Math.max(peak, Math.abs(d[i])); }
    for (let i = 0; i < n; i++) d[i] *= 0.2 / (peak || 1);   // głośność
    return buf;
  }
  function sound(capture) {
    if (!S.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const src = audio.createBufferSource(); src.buffer = moveBuffer(!!capture);
      src.connect(audio.destination); src.start();
    } catch (e) { /* bez dźwięku */ }
  }

  // ---------------------------------------------------------------- plansza
  const FILES = "abcdefgh";
  function parseFen(fen) {
    const out = {};
    const rows = fen.split(" ")[0].split("/");
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) { f += +ch; continue; }
        out[FILES[f] + (8 - r)] = { t: ch.toLowerCase(), w: ch === ch.toUpperCase() };
        f++;
      }
    }
    return out;
  }
  function xy(sq) { // pozycja pola na ekranie (0..7)
    const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
    return S.flipped ? { x: 7 - f, y: r } : { x: f, y: 7 - r };
  }
  function applyTheme() {
    const [a, b] = THEMES[S.theme] || THEMES.classic;
    document.documentElement.style.setProperty("--light-sq", a);
    document.documentElement.style.setProperty("--dark-sq", b);
  }
  function buildSquares() {
    let h = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const f = S.flipped ? 7 - x : x, r = S.flipped ? y : 7 - y;
        const light = (f + r) % 2 === 1;
        let c = "";
        if (y === 7) c += `<span class="coord f">${FILES[f]}</span>`;
        if (x === 0) c += `<span class="coord r">${r + 1}</span>`;
        h += `<div class="sq ${light ? "l" : "d"}">${c}</div>`;
      }
    }
    $("squares").innerHTML = h;
    $("evalbar").classList.toggle("flipped", S.flipped);
  }

  const isPhone = () => window.innerWidth <= 760;
  function boardSize() {
    const st = $("stage");
    if (isPhone()) {   // telefon: szachownica na całą szerokość, ale zostawia miejsce na komentarze i przyciski
      const availW = st.clientWidth - 16 - 26 - 8;
      const availH = window.innerHeight - 56 - 2 * 34 - 44 - 76 - 150;
      return Math.max(200, Math.floor(Math.min(availW, availH) / 8) * 8);
    }
    const availW = st.clientWidth - 48 - 36;
    const availH = st.clientHeight - 28 - 92 - 86;
    return Math.max(280, Math.floor(Math.min(availW, availH) / 8) * 8);
  }
  function layout() {
    const size = boardSize();
    $("board").style.width = $("board").style.height = size + "px";
    $("evalbar").style.height = size + "px";
    $("graph").style.width = (size + 36) + "px";
    $("graph").style.height = isPhone() ? "44px" : "74px";
    document.querySelectorAll(".player").forEach((p) => p.style.width = (size + 36) + "px");
    S.sq = size / 8;
    render(false);
  }

  function currentView() {
    const r = S.review;
    if (!r) return { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" };
    if (S.follow) {
      const f = S.follow, it = f.idx > 0 ? f.line[f.idx - 1] : null;
      return { fen: it ? it.fen : f.baseFen, last: it ? { from: it.from, to: it.to } : null, follow: true };
    }
    const p = r.plies[S.ply];
    if (S.ply === 0) return { fen: p.fen, check: p.check };
    const m = r.moves[S.ply - 1];
    const arrow = (m.best && m.best !== m.uci && m.cls !== "Book" && m.cls !== "Forced")
      ? { from: m.best_from, to: m.best_to } : null;
    return { fen: p.fen, last: { from: m.from, to: m.to }, cls: m.cls, arrow, check: p.check };
  }

  function arrowSVG(from, to, color) {
    const a = xy(from), b = xy(to);
    const x1 = a.x * 100 + 50, y1 = a.y * 100 + 50, x2 = b.x * 100 + 50, y2 = b.y * 100 + 50;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const sw = 9, hw = 24, hl = 34, start = 18;
    const sx = x1 + ux * start, sy = y1 + uy * start, bx = x2 - ux * hl, by = y2 - uy * hl;
    const pts = [[sx + px * sw, sy + py * sw], [bx + px * sw, by + py * sw], [bx + px * hw, by + py * hw], [x2, y2],
                 [bx - px * hw, by - py * hw], [bx - px * sw, by - py * sw], [sx - px * sw, sy - py * sw]];
    return `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${color}" opacity=".88" stroke="rgba(0,0,0,.25)" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  function render(withAnim) {
    const v = currentView();
    const pos = parseFen(v.fen);
    const q = S.sq || 64;
    // podświetlenia
    let hl = "";
    const cls = v.cls ? CLASSES[v.cls] : null;
    const hlColor = cls ? hexA(cls.color, 0.5) : "rgba(255, 236, 64, .42)";
    if (v.last) {
      for (const s of [v.last.from, v.last.to]) {
        const p = xy(s);
        hl += `<div class="hl" style="left:${p.x * q}px;top:${p.y * q}px;width:${q}px;height:${q}px;background:${hlColor}"></div>`;
      }
    }
    if (v.check) {
      const turn = v.fen.split(" ")[1];
      for (const s in pos) if (pos[s].t === "k" && pos[s].w === (turn === "w")) {
        const p = xy(s);
        hl += `<div class="hl check" style="left:${p.x * q}px;top:${p.y * q}px;width:${q}px;height:${q}px"></div>`;
      }
    }
    $("hl").innerHTML = hl;
    // figury
    let pcs = "";
    for (const s in pos) {
      const p = xy(s), pc = pos[s];
      pcs += `<img class="pc" data-sq="${s}" src="${pieceURL(pc.t, pc.w)}" style="left:${p.x * q}px;top:${p.y * q}px;width:${q}px;height:${q}px" draggable="false" alt="">`;
    }
    $("pieces").innerHTML = pcs;
    // strzałka najlepszego ruchu
    $("arrows").setAttribute("viewBox", "0 0 800 800");
    $("arrows").innerHTML = v.arrow ? arrowSVG(v.arrow.from, v.arrow.to, "#7fbf3f") : "";
    // znaczek oceny
    if (v.cls && v.last) {
      const p = xy(v.last.to), size = Math.round(q * 0.42);
      $("badges").innerHTML = `<div class="badge" style="left:${(p.x + 1) * q - size}px;top:${p.y * q}px;width:${size}px;height:${size}px">${iconSVG(v.cls)}</div>`;
    } else $("badges").innerHTML = "";
    // animacja ruchu
    if (withAnim && S.anim) {
      const { from, to } = S.anim;
      const img = $("pieces").querySelector(`[data-sq="${to}"]`);
      if (img) {
        const a = xy(from), b = xy(to);
        img.style.transform = `translate(${(a.x - b.x) * q}px, ${(a.y - b.y) * q}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => { img.classList.add("anim"); img.style.transform = "translate(0,0)"; }));
      }
    }
    S.anim = null;
    renderEval();
    renderPlayers(pos);
    renderGraph();
    if (S.review) { renderCoach(); markMove(); }
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  function renderEval() {
    let wp = 50, txt = "0.0";
    if (S.review) {
      const p = S.review.plies[S.follow ? S.follow.basePly : S.ply];
      wp = p.wp; txt = p.eval;
    }
    const h = Math.max(3, Math.min(97, wp));
    $("evalFill").style.height = h + "%";
    const whiteBetter = wp >= 50;
    const t = $("evalTxt");
    t.textContent = txt.replace("+", "").replace(/^-/, "");
    const atBottom = whiteBetter !== S.flipped;
    t.style.top = atBottom ? "auto" : "6px";
    t.style.bottom = atBottom ? "6px" : "auto";
    t.style.color = whiteBetter ? "#2a2825" : "#f2f0eb";
  }

  function material(pos) {
    const val = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let d = 0;
    for (const s in pos) d += (pos[s].w ? 1 : -1) * val[pos[s].t];
    return d;
  }
  function clockAt(color) {
    const r = S.review;
    if (!r) return null;
    for (let i = Math.min(S.ply, r.moves.length) - 1; i >= 0; i--) {
      if (r.moves[i].color === color && r.moves[i].clock != null) return r.moves[i].clock;
    }
    const base = parseInt((r.time_control || "").split("+")[0], 10);
    return isNaN(base) || (r.time_control || "").includes("/") ? null : base;
  }
  function renderPlayers(pos) {
    const r = S.review;
    const mk = (color) => {
      const st = r ? (color === "w" ? r.white : r.black) : null;
      const name = st ? st.name : (color === "w" ? "White" : "Black");
      const you = r && ((r.user_color === "white") === (color === "w"));
      const diff = material(pos) * (color === "w" ? 1 : -1);
      const clk = r ? clockAt(color) : null;
      const active = S.review && S.review.plies[S.ply] && S.review.plies[S.ply].turn === color;
      return `<div class="avatar ${color}">${esc(name[0] || "?").toUpperCase()}</div>` +
        `<span class="p-name">${esc(name)}</span>` + (st && st.elo ? `<span class="p-elo">(${esc(st.elo)})</span>` : "") +
        (you ? `<span class="p-you">YOU</span>` : "") + (diff > 0 ? `<span class="p-mat">+${diff}</span>` : "") +
        (clk != null ? `<span class="clock ${color === "w" ? "w" : ""} ${active ? "on" : ""}">${fmtClock(clk)}</span>` : "");
    };
    $("playerTop").innerHTML = mk(S.flipped ? "w" : "b");
    $("playerBottom").innerHTML = mk(S.flipped ? "b" : "w");
  }

  // ---------------------------------------------------------------- wykres
  function renderGraph() {
    const svg = $("graphSvg"), g = $("graph");
    const W = g.clientWidth || 600, H = g.clientHeight || 74;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!S.review) { svg.innerHTML = `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#6b6762" stroke-dasharray="3 4"/>`; return; }
    const pl = S.review.plies, n = Math.max(1, pl.length - 1);
    const X = (i) => i / n * W, Y = (wp) => H - wp / 100 * H;
    let d = `M0 ${H} `;
    pl.forEach((p, i) => { d += `L${X(i).toFixed(1)} ${Y(p.wp).toFixed(1)} `; });
    d += `L${W} ${H} Z`;
    let s = `<path d="${d}" fill="#f4f2ec"/>`;
    s += `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#8d8982" stroke-dasharray="3 4" stroke-width="1"/>`;
    const x = X(S.follow ? S.follow.basePly : S.ply);
    s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#81b64c" stroke-width="2.5"/>`;
    S.review.moves.forEach((m, i) => {
      if (KEY.includes(m.cls)) {
        s += `<circle cx="${X(i + 1).toFixed(1)}" cy="${Y(pl[i + 1].wp).toFixed(1)}" r="4.5" fill="${CLASSES[m.cls].color}" stroke="#1d1c1a" stroke-width="1.5"/>`;
      }
    });
    svg.innerHTML = s;
  }
  function graphPly(e) {
    const g = $("graph"), rect = g.getBoundingClientRect();
    const n = S.review.plies.length - 1;
    return Math.max(0, Math.min(n, Math.round((e.clientX - rect.left) / rect.width * n)));
  }
  $("graph").addEventListener("mousemove", (e) => {
    if (!S.review) return;
    const p = graphPly(e), tip = $("graphTip"), rect = $("graph").getBoundingClientRect();
    if (p === 0) { tip.classList.add("hidden"); return; }
    const m = S.review.moves[p - 1], pl = S.review.plies[p];
    tip.innerHTML = `${iconSVG(m.cls)}<span>${S.review.plies[p - 1].move_no}${m.color === "w" ? "." : "…"} ${esc(m.san)}</span><span style="color:#a39f97">${esc(pl.eval)}</span>`;
    tip.classList.remove("hidden");
    const x = e.clientX - rect.left;
    tip.style.left = Math.min(rect.width - tip.offsetWidth - 6, Math.max(6, x - tip.offsetWidth / 2)) + "px";
  });
  $("graph").addEventListener("mouseleave", () => $("graphTip").classList.add("hidden"));
  $("graph").addEventListener("click", (e) => { if (S.review) goto(graphPly(e)); });

  // ---------------------------------------------------------------- nawigacja
  function goto(ply, animate) {
    if (!S.review) return;
    stopFollow();
    const n = S.review.moves.length;
    ply = Math.max(0, Math.min(n, ply));
    if (ply === S.ply) { render(false); return; }
    let anim = false;
    if (animate !== false && Math.abs(ply - S.ply) === 1) {
      if (ply > S.ply) {
        const m = S.review.moves[ply - 1];
        S.anim = { from: m.from, to: m.to };
        sound(m.capture);
      } else {
        const m = S.review.moves[S.ply - 1];
        S.anim = { from: m.to, to: m.from };
      }
      anim = true;
    }
    S.ply = ply;
    render(anim);
  }
  function startFollow(basePly, title) {
    const r = S.review, line = r.plies[basePly].line;
    if (!line || !line.length) { toast("The engine has no further line here."); return; }
    stopFollow();
    S.follow = { line, idx: 0, baseFen: r.plies[basePly].fen, basePly, title, timer: null };
    setTab("moves");
    const step = () => {
      const f = S.follow;
      if (!f) return;
      if (f.idx < f.line.length) {
        f.idx++;
        const it = f.line[f.idx - 1];
        S.anim = { from: it.from, to: it.to };
        sound(it.san.includes("x"));
        render(true);
        f.timer = setTimeout(step, 1000);
      }
    };
    render(false);
    S.follow.timer = setTimeout(step, 450);
  }
  function stopFollow() {
    if (S.follow) { clearTimeout(S.follow.timer); S.follow = null; }
  }
  function jumpMistake(dir) {
    const r = S.review;
    if (!r) return;
    const me = r.user_color === "white" ? "w" : "b";
    const idx = r.moves.map((m, i) => (BAD.includes(m.cls) && m.color === me) ? i + 1 : 0).filter(Boolean);
    if (!idx.length) { toast("No mistakes by you in this game – well played!"); return; }
    const nxt = dir > 0 ? (idx.find((p) => p > S.ply) || idx[0]) : ([...idx].reverse().find((p) => p < S.ply) || idx[idx.length - 1]);
    setTab("moves");
    goto(nxt, false);
  }

  // ---------------------------------------------------------------- panel: analiza
  function renderCoach() {
    const r = S.review, c = $("coach");
    if (S.follow) {
      const f = S.follow;
      c.innerHTML = `<div class="coach-top"><div class="bigico" style="color:#e0a83e">${UI.bulb}</div><div><h4>${esc(f.title)}</h4>` +
        `<p>The engine shows the best continuation.</p></div></div>` +
        `<div class="line-moves">${f.line.map((it, i) => `<span class="${i === f.idx - 1 ? "on" : ""}">${esc(it.san)}</span>`).join("")}</div>` +
        `<div class="coach-actions"><button class="btn" id="cStop">${UI.stop.replace("<svg", '<svg style="width:14px;height:14px;display:inline;vertical-align:-2px;margin-right:6px"')}Stop</button></div>`;
      $("cStop").onclick = () => { stopFollow(); render(false); };
      return;
    }
    if (S.ply === 0) {
      c.innerHTML = `<div class="coach-top"><div class="bigico">${iconSVG("Book")}</div><div><h4>Start of the game</h4>` +
        `<p>${esc(r.opening || "Opening")}</p><p style="color:#a39f97;margin-top:6px">Click ▶ or use the ← → keys to step through the game.</p></div></div>` +
        `<div class="coach-actions"><button class="btn primary" id="cGo">Start from move 1</button><button class="btn" id="cMis">Show my first mistake</button></div>`;
      $("cGo").onclick = () => goto(1);
      $("cMis").onclick = () => jumpMistake(1);
      return;
    }
    const m = r.moves[S.ply - 1], p = r.plies[S.ply];
    const t = TEXT[m.cls] || ["", ""];
    const neg = p.wp < 50;
    let h = `<div class="coach-top"><div class="bigico">${iconSVG(m.cls)}</div><div style="min-width:0">` +
      `<h4 style="color:${CLASSES[m.cls].color}">${esc(m.san)} ${t[0]}</h4><p>${t[1]}${esc(m.note || "")}</p></div>` +
      `<span class="evalchip ${neg ? "neg" : ""}">${esc(p.eval)}</span></div>`;
    const showBest = m.best && m.best !== m.uci && m.cls !== "Book" && m.cls !== "Forced";
    if (showBest) h += `<div class="best-line">Best was <b>${esc(m.best_san)}</b></div>`;
    h += `<div class="coach-actions">`;
    if (showBest) h += `<button class="btn primary" id="cBest">Show best line</button>`;
    else h += `<button class="btn" id="cCont">Show continuation</button>`;
    h += `<button class="btn ghost" id="cNext">Next mistake ▸</button></div>`;
    c.innerHTML = h;
    if (showBest) $("cBest").onclick = () => startFollow(S.ply - 1, `Better than ${m.san} was:`);
    else $("cCont").onclick = () => startFollow(S.ply, "Best continuation");
    $("cNext").onclick = () => jumpMistake(1);
  }

  function buildMoveList() {
    const r = S.review, ml = $("moveList");
    let h = "", i = 0;
    while (i < r.moves.length) {
      const no = r.plies[i].move_no;
      h += `<div class="mrow"><span class="mnum">${no}.</span>`;
      if (r.moves[i].color === "b") h += `<span class="mv empty">…</span>`;
      const cells = r.moves[i].color === "w" ? 2 : 1;
      for (let k = 0; k < cells; k++) {
        if (i >= r.moves.length) { h += `<span class="mv empty"></span>`; break; }
        const m = r.moves[i];
        const ic = ["Excellent", "Good", "Forced"].includes(m.cls) ? "" : iconSVG(m.cls);
        h += `<span class="mv" data-ply="${i + 1}">${ic}<span>${esc(m.san)}</span></span>`;
        i++;
      }
      h += `</div>`;
    }
    ml.innerHTML = h;
    ml.querySelectorAll(".mv[data-ply]").forEach((n) => n.onclick = () => goto(+n.dataset.ply, false));
  }
  function markMove() {
    const ml = $("moveList");
    ml.querySelectorAll(".mv.cur").forEach((n) => n.classList.remove("cur"));
    if (S.follow || S.ply === 0) return;
    const n = ml.querySelector(`.mv[data-ply="${S.ply}"]`);
    if (n) {
      n.classList.add("cur");
      const top = n.offsetTop - ml.offsetTop, bottom = top + n.offsetHeight;
      if (top < ml.scrollTop + 8 || bottom > ml.scrollTop + ml.clientHeight - 8) ml.scrollTop = top - ml.clientHeight / 2;
    }
  }

  // ---------------------------------------------------------------- panel: podsumowanie
  function ring(acc) {
    const C = 2 * Math.PI * 40, off = C * (1 - acc / 100);
    return `<div class="ring"><svg viewBox="0 0 92 92"><circle class="bg" cx="46" cy="46" r="40"/>` +
      `<circle class="fg" cx="46" cy="46" r="40" stroke="${accColor(acc)}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/></svg><b>${acc.toFixed(1)}</b></div>`;
  }
  function buildSummary() {
    const r = S.review, el = $("tabSummary");
    const meWhite = r.user_color === "white";
    const pc = (st, color) => {
      const me = (color === "w") === meWhite;
      return `<div class="pcard ${me ? "me" : ""}"><div class="who"><div class="avatar ${color}">${esc(st.name[0].toUpperCase())}</div><span>${esc(st.name)}</span></div>` +
        ring(st.acc) + `<div class="lbl">accuracy</div>` +
        `<div class="gr">Performance <b>${st.rating}</b></div>` +
        `</div>`;
    };
    let h = `<div class="sum-head"><h3>Game summary</h3><p>${esc(r.opening || "")}</p>` +
      `<p>${esc(resultText(r))}</p></div>`;
    h += `<div class="players2">${pc(r.white, "w")}${pc(r.black, "b")}</div>`;
    h += `<div class="cls-table">`;
    for (const c of SUMMARY_ORDER) {
      const a = r.white.counts[c] || 0, b = r.black.counts[c] || 0;
      h += `<div class="cls-row"><span class="n ${a ? "" : "zero"}" style="${a ? `color:${CLASSES[c].color}` : ""}">${a}</span>` +
        `<span class="mid">${iconSVG(c)}${CLASSES[c].label}</span>` +
        `<span class="n ${b ? "" : "zero"}" style="${b ? `color:${CLASSES[c].color}` : ""}">${b}</span></div>`;
    }
    h += `</div><button class="btn primary lg start-btn" id="startReview">▶  Start review</button>`;
    const km = r.moves.map((m, i) => ({ m, i })).filter((o) => KEY.includes(o.m.cls));
    if (km.length) {
      h += `<div class="km"><h4>Key moments</h4>`;
      for (const { m, i } of km.slice(0, 12)) {
        const who = m.color === "w" ? r.white.name : r.black.name;
        h += `<div class="km-item" data-ply="${i + 1}">${iconSVG(m.cls)}<div><b>${r.plies[i].move_no}${m.color === "w" ? "." : "…"} ${esc(m.san)}</b>` +
          `<small>${esc(who)} · ${CLASSES[m.cls].pl}</small></div></div>`;
      }
      h += `</div>`;
    }
    h += supportCard();
    h += `<p style="color:#77736c;font-size:11.5px;margin-top:16px">Analysis depth: ${r.depth || "?"} · Stockfish 19 running in your browser</p>`;
    el.innerHTML = h;
    requestAnimationFrame(() => el.querySelectorAll(".ring .fg").forEach((c) => c.style.strokeDashoffset = c.dataset.off));
    $("startReview").onclick = () => { setTab("moves"); goto(1); };
    el.querySelectorAll(".km-item").forEach((n) => n.onclick = () => { setTab("moves"); goto(+n.dataset.ply, false); });
  }
  function resultText(r) {
    const res = r.result === "1-0" ? "White won" : r.result === "0-1" ? "Black won" : r.result === "1/2-1/2" ? "Draw" : "";
    const term = (r.termination || "").replace(/^.* won by /, "").replace(/^Game drawn by /, "");
    const map = { time: "timeout" };
    let t = map[term] || term;
    t = t ? t[0].toUpperCase() + t.slice(1) : t;
    return [res, t, r.date ? r.date.replace(/\./g, "-") : ""].filter(Boolean).join(" · ");
  }
  function welcome() {
    const legend = SUMMARY_ORDER.map((c) => `<div>${iconSVG(c)}${CLASSES[c].label}</div>`).join("");
    $("tabSummary").innerHTML = `<div class="welcome"><h3>Welcome to Rookwise 👋</h3>` +
      `<p>Free, private chess analysis. Import your games by username and get every move rated by Stockfish – right in your browser.</p>` +
      `<div class="steps">` +
      `<div class="step"><i>1</i><div><b>Enter your Chess.com username</b><small>in the search box at the top</small></div></div>` +
      `<div class="step"><i>2</i><div><b>Pick a game from the list</b><small>analysis takes about 15 seconds</small></div></div>` +
      `<div class="step"><i>3</i><div><b>Step through the moves</b><small>← → keys, the graph or the move list</small></div></div>` +
      `</div><div class="legend">${legend}</div>` +
      `<p class="legal">Rookwise is an independent project and is not affiliated with, endorsed by or sponsored by Chess.com. ` +
      `Games are loaded from the public Chess.com Published-Data API.</p>` +
      supportCard() +
      `<p class="legal"><a href="about.html">About &amp; licenses</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p></div>`;
    $("coach").innerHTML = `<div class="coach-top"><div class="bigico" style="color:#e0a83e">${UI.bulb}</div><div><h4>Move comments appear here</h4><p>Pick a game to see a rating for every move and better continuations.</p></div></div>`;
    $("moveList").innerHTML = "";
  }
  function setTab(t) {
    S.tab = t;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    $("tabSummary").classList.toggle("hidden", t !== "summary");
    $("tabMoves").classList.toggle("hidden", t !== "moves");
    if (t === "moves") markMove();
  }
  document.querySelectorAll("#tabs button").forEach((b) => b.onclick = () => setTab(b.dataset.tab));

  // ---------------------------------------------------------------- lista partii
  function renderFilters() {
    const present = new Set(S.games.map((g) => g.tc));
    const items = [["all", "All", ""]].concat(
      ["bullet", "blitz", "rapid", "daily"].filter((k) => present.has(k)).map((k) => [k, k[0].toUpperCase() + k.slice(1), TC[k]]));
    $("filters").innerHTML = items.map(([k, l, ic]) => `<button class="chip ${S.filter.tc === k ? "on" : ""}" data-tc="${k}">${ic}${l}</button>`).join("");
    $("filters").querySelectorAll(".chip").forEach((b) => b.onclick = () => { S.filter.tc = b.dataset.tc; renderFilters(); renderGames(); });
  }
  document.querySelectorAll("#resultSeg button").forEach((b) => b.onclick = () => {
    S.filter.res = b.dataset.r;
    document.querySelectorAll("#resultSeg button").forEach((x) => x.classList.toggle("on", x === b));
    renderGames();
  });
  $("oppSearch").addEventListener("input", (e) => { S.filter.q = e.target.value.trim().toLowerCase(); renderGames(); });

  function visibleGames() {
    return S.games.filter((g) => (S.filter.tc === "all" || g.tc === S.filter.tc) &&
      (S.filter.res === "all" || g.result === S.filter.res) &&
      (!S.filter.q || g.opp.name.toLowerCase().includes(S.filter.q)));
  }
  function cardHTML(g) {
    const cls = g.result;
    const sym = cls === "win" ? "+" : cls === "loss" ? "−" : "=";
    const busy = S.analyzing && S.analyzing.url === g.url;
    const go = busy ? `<div class="spin"></div>` : UI.next;
    return `<div class="card ${cls} ${g.analyzed ? "analyzed" : ""} ${S.url === g.url ? "active" : ""}" data-url="${esc(g.url)}">` +
      `<div class="res">${sym}</div><div class="c-main">` +
      `<div class="c-top"><span class="c-opp">${esc(g.opp.name)} <span class="rt">(${esc(g.opp.rating || "?")})</span></span><span class="c-when">${esc(whenText(g.end_time))}</span></div>` +
      `<div class="c-meta">${TC[g.tc] || ""}<span>${esc(g.tc_text)}</span><span>·</span><span>${esc(g.reason)}</span><span>·</span><span>${g.moves} move${g.moves === 1 ? "" : "s"}</span></div>` +
      `<div class="c-pills"><span class="pill"><i class="cdot" style="background:${g.color === "white" ? "#f2f0eb" : "#1d1c1a"}"></i>You ${esc(g.me.rating || "")}</span>` +
      (g.acc != null ? `<span class="pill acc">Review ${Math.round(g.acc)}%</span>` : "") +
      `</div></div><div class="go">${go}</div>` +
      (busy ? `<div class="prog" style="width:${S.analyzing.progress || 0}%"></div>` : "") + `</div>`;
  }
  function renderGames() {
    const list = $("gameList");
    if (S.loading && !S.games.length) {
      list.innerHTML = Array(6).fill('<div class="skel"></div>').join("");
      return;
    }
    if (!S.games.length) {
      list.innerHTML = `<div class="empty"><b>No games yet</b>Enter your Chess.com username at the top to import your games.</div>`;
      $("gameCount").textContent = "";
      return;
    }
    const vis = visibleGames();
    $("gameCount").textContent = `${vis.length} of ${S.games.length}`;
    let h = vis.slice(0, 250).map(cardHTML).join("");
    if (!vis.length) h = `<div class="empty"><b>Nothing matches</b>Change the filters to see more games.</div>`;
    if (S.hasMore) h += `<button class="load-more" id="loadMore">${S.loading ? "Loading…" : "Load older games"}</button>`;
    list.innerHTML = h;
    list.querySelectorAll(".card").forEach((c) => c.onclick = () => openGame(c.dataset.url));
    if ($("loadMore")) $("loadMore").onclick = () => loadGames(true);
  }
  function updateCard(url) {
    const g = S.games.find((x) => x.url === url), old = document.querySelector(`.card[data-url="${CSS.escape(url)}"]`);
    if (!g || !old) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = cardHTML(g);
    const nw = tmp.firstChild;
    nw.onclick = () => openGame(url);
    old.replaceWith(nw);
  }

  async function loadGames(more) {
    const nick = $("nick").value.trim();
    if (!nick || S.loading) return;
    S.loading = true;
    if (!more) { S.games = []; S.nick = nick; }
    renderGames();
    try {
      const r = await Backend.loadGames(more ? S.nick : nick, more);
      S.games = r.games; S.hasMore = r.has_more;
      if (!more) $("gameList").scrollTop = 0;
    } catch (e) {
      toast(e.message, true);
    }
    S.loading = false;
    renderFilters();
    renderGames();
  }
  $("searchForm").addEventListener("submit", (e) => { e.preventDefault(); loadGames(false); $("nick").blur(); });

  // ---------------------------------------------------------------- analiza
  function showOverlay(pct, msg) {
    $("overlay").classList.remove("hidden");
    const C = 2 * Math.PI * 52;
    $("ovRing").style.strokeDasharray = C;
    $("ovRing").style.strokeDashoffset = C * (1 - pct / 100);
    $("ovPct").textContent = pct + "%";
    $("ovMsg").textContent = msg || "Analyzing game…";
  }
  const hideOverlay = () => $("overlay").classList.add("hidden");

  async function openGame(url) {
    const g = S.games.find((x) => x.url === url);
    if (!g) return;
    $("gamesPane").classList.remove("show");
    if (g.analyzed) { await loadReview(url); return; }
    if (S.analyzing) { toast("Please wait until the current analysis finishes."); return; }
    S.analyzing = { url, progress: 0 };
    updateCard(url);
    showOverlay(0, "Preparing analysis…");
    try {
      await Backend.analyze(url, S.depth, (pct, msg) => {
        S.analyzing.progress = pct;
        showOverlay(pct, msg);
        const bar = document.querySelector(`.card[data-url="${CSS.escape(url)}"] .prog`);
        if (bar) bar.style.width = pct + "%";
      });
      S.analyzing = null;
      const sm = Backend.gameSummary(url);
      if (sm) Object.assign(g, sm);
      hideOverlay();
      updateCard(url);
      await loadReview(url);
    } catch (e) {
      S.analyzing = null;
      hideOverlay();
      updateCard(url);
      toast("Analysis failed: " + e.message, true);
    }
  }

  async function loadReview(url, keepPly) {
    try {
      const r = await Backend.review(url);
      const sameGame = S.url === url;
      stopFollow();
      S.review = r; S.url = url;
      if (!(keepPly && sameGame)) { S.ply = 0; S.flipped = r.user_color === "black"; }
      buildSquares();
      buildSummary();
      buildMoveList();
      if (!(keepPly && sameGame)) setTab("summary");
      document.querySelectorAll(".card.active").forEach((c) => c.classList.remove("active"));
      const c = document.querySelector(`.card[data-url="${CSS.escape(url)}"]`);
      if (c) c.classList.add("active");
      render(false);
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ---------------------------------------------------------------- ustawienia
  if (HAS_SUPPORT) { $("supportBtn").href = SUPPORT; $("supportBtn").classList.remove("hidden"); }
  $("settingsBtn").onclick = () => {
    const sw = Object.entries(THEMES).map(([k, [a, b]]) => `<div class="theme-sw ${S.theme === k ? "on" : ""}" data-th="${k}" style="--a:${a};--b:${b}"><i></i><i></i><i></i><i></i></div>`).join("");
    modal(`<h3>Settings</h3>` +
      `<div class="opt-row"><span>Board colors</span><div class="themes">${sw}</div></div>` +
      `<div class="opt-row"><span>Piece style</span><div class="themes">${Object.keys(STYLES).map((k) => `<div class="piece-sw ${S.pieces === k ? "on" : ""}" data-ps="${k}" title="${STYLES[k].name}"><img src="${pieceURL("n", true, k)}"><img src="${pieceURL("n", false, k)}"></div>`).join("")}</div></div>` +
      `<div class="opt-row"><span>Analysis depth</span><select class="field" id="depthSel" style="width:200px">` +
      `<option value="10">Fast (10)</option><option value="14">Standard (14)</option><option value="18">Deep (18)</option></select></div>` +
      `<div class="opt-row"><span>Move sounds</span><div class="toggle ${S.sound ? "on" : ""}" id="sndT"></div></div>` +
      `<div class="row"><button class="btn primary" data-close>Done</button></div>`,
    (m) => {
      $("depthSel").value = String(S.depth);
      $("depthSel").onchange = (e) => { S.depth = +e.target.value; save("depth3", S.depth); };
      $("sndT").onclick = () => { S.sound = !S.sound; save("sound", S.sound ? "1" : "0"); $("sndT").classList.toggle("on", S.sound); };
      m.querySelectorAll(".piece-sw").forEach((n) => n.onclick = () => {
        S.pieces = n.dataset.ps; save("pieces2", S.pieces); setPieceStyle(S.pieces); render(false);
        m.querySelectorAll(".piece-sw").forEach((x) => x.classList.toggle("on", x === n));
      });
      m.querySelectorAll(".theme-sw").forEach((n) => n.onclick = () => {
        S.theme = n.dataset.th; save("theme2", S.theme); applyTheme();
        m.querySelectorAll(".theme-sw").forEach((x) => x.classList.toggle("on", x === n));
      });
    });
  };
  // ---------------------------------------------------------------- klawiatura i przyciski
  $("navFirst").onclick = () => goto(0, false);
  $("navPrev").onclick = () => goto(S.ply - 1);
  $("navNext").onclick = () => { if (S.ply === 0 && S.tab === "summary") setTab("moves"); goto(S.ply + 1); };
  $("navLast").onclick = () => S.review && goto(S.review.moves.length, false);
  $("navFlip").onclick = flip;
  if (isPhone()) $("nick").placeholder = "Username";
  // telefon: przesunięcie palcem po szachownicy = następny / poprzedni ruch
  (() => {
    let x0 = null, y0 = null;
    const bw = $("boardWrap");
    bw.addEventListener("touchstart", (e) => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    bw.addEventListener("touchend", (e) => {
      if (x0 === null || !S.review) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) { if (dx < 0) $("navNext").onclick(); else goto(S.ply - 1); }
    }, { passive: true });
  })();
  function flip() { S.flipped = !S.flipped; buildSquares(); render(false); }
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "Escape") { closeModal(); stopFollow(); render(false); return; }
    if (!$("modalBack").classList.contains("hidden")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); $("navNext").onclick(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goto(S.ply - 1); }
    else if (e.key === "Home") goto(0, false);
    else if (e.key === "End" && S.review) goto(S.review.moves.length, false);
    else if (e.key === "f" || e.key === "F") flip();
    else if (e.key === "ArrowDown") { e.preventDefault(); jumpMistake(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); jumpMistake(-1); }
  });

  $("menuBtn").onclick = () => $("gamesPane").classList.toggle("show");
  document.addEventListener("click", (e) => {
    const g = $("gamesPane");
    if (g.classList.contains("show") && !g.contains(e.target) && !$("menuBtn").contains(e.target)) g.classList.remove("show");
  });

  // ---------------------------------------------------------------- start
  async function init() {
    $("logo").innerHTML = LOGO;
    setPieceStyle(S.pieces);
    fillUI();
    applyTheme();
    buildSquares();
    welcome();
    renderGames();
    new ResizeObserver(() => layout()).observe($("stage"));
    layout();
    const nick = Backend.lastUser();
    if (nick) { $("nick").value = nick; loadGames(false); }
    else $("nick").focus();
  }
  init();
})();
