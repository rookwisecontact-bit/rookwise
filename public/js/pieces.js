/* Rookwise – grafika wektorowa: figury, ikony ocen ruchów, ikony tempa, logo.
   Wszystko rysowane w SVG, więc jest ostre w każdej rozdzielczości. */
(function () {
  "use strict";

  // Zestaw "Turned": masywne figury, cieniowanie jak toczone drewno (0..100, rysowane od tyłu do przodu)
  const RING = ["P","M27 80 C27 76.5 30 74 34 74 H66 C70 74 73 76.5 73 80 Z","c"];
  const BASEP = ["P","M19 91.5 C19 85.5 22.5 82 27.5 81.5 H72.5 C77.5 82 81 85.5 81 91.5 C81 93.8 79.5 95 77 95 H23 C20.5 95 19 93.8 19 91.5 Z","c"];
  const LOWER = ["P","M30.5 68.5 C32 71 31.5 72.5 29.5 74 H70.5 C68.5 72.5 68 71 69.5 68.5 Z","c"];
  const SH = {
    p: [["P","M38.5 45 C38.5 56.5 34 66 28.5 74.5 H71.5 C66 66 61.5 56.5 61.5 45 Z","c"], RING, BASEP,
        ["E",50,44.5,16.5,4.8,"c"], ["C",50,28,13.5,"s"]],
    r: [["P","M31 74.5 L33.5 41 H66.5 L69 74.5 Z","c"], RING, BASEP,
        ["P","M25.5 17.5 H37 V25 H44.5 V17.5 H55.5 V25 H63 V17.5 H74.5 V33 C74.5 38.5 70.5 42 65 42 H35 C29.5 42 25.5 38.5 25.5 33 Z","c"]],
    b: [["P","M41 61 C41 66.5 36.5 71 32 74.5 H68 C63.5 71 59 66.5 59 61 Z","c"], RING, BASEP,
        ["P","M50 17 C38.5 25 32.5 35.5 34 46.5 C35 53.5 41.5 57.5 50 57.5 C58.5 57.5 65 53.5 66 46.5 C67.5 35.5 61.5 25 50 17 Z","c"],
        ["E",50,60,16.5,4.6,"c"], ["C",50,12,5.2,"s"]],
    q: [LOWER, RING, BASEP,
        ["P","M28.5 64.5 C26 52 22 40 16 28 L35.5 46 L31.5 19.5 L45.5 44 L50 15.5 L54.5 44 L68.5 19.5 L64.5 46 L84 28 C78 40 74 52 71.5 64.5 Z","c"],
        ["E",50,66,22.5,5,"c"],
        ["C",16,25,5.2,"s"],["C",31,16,5.2,"s"],["C",50,12,5.4,"s"],["C",69,16,5.2,"s"],["C",84,25,5.2,"s"]],
    k: [LOWER, RING, BASEP,
        ["P","M50 27.5 C44 20.5 32 20.5 25 27.5 C17 35.5 19.5 47.5 28 54.5 L30 64 H70 L72 54.5 C80.5 47.5 83 35.5 75 27.5 C68 20.5 56 20.5 50 27.5 Z","c"],
        ["E",50,66,22.5,5,"c"],
        ["P","M47 3.5 H53 V8.5 H58 V14.5 H53 V22 H47 V14.5 H42 V8.5 H47 Z","c"]],
    n: [["P","M30 74.5 C29 64 32 57 39 51 C42.5 48 44.5 45.5 44.5 42.5 C39.5 46 32 50 25 51 C18.5 52 14 47.5 15.5 41.5 C16.5 37 21 34 26 29.5 C30 26 32.5 21.5 34.5 16 L33.5 7.5 L40 12.5 C42.5 9.5 46 9 49 10.5 L50 15.5 C63 17 73.5 27 77.5 41 C80.5 52 79 63 75.5 74.5 Z","c"],
        RING, BASEP],
  };
  const DT = {
    p: [], r: [["L","M33.5 41.5 H66.5"]], q: [], k: [["L","M50 30 V58"]],
    b: [["L","M56.5 28.5 L46.5 41"]],
    n: [["L","M53 18.5 C65 24 72 36 73.5 50 C74.5 60 73.5 68 71.5 74"],["D",36,29,3],["D",20.5,45.5,1.9],["L","M16.5 49.5 L23 50.4"]],
  };
  function prim(p, a) {
    a = a || "";
    if (p[0] === "P" || p[0] === "L") return `<path d="${p[1]}" ${a}/>`;
    if (p[0] === "C" || p[0] === "D") return `<circle cx="${p[1]}" cy="${p[2]}" r="${p[3]}" ${a}/>`;
    if (p[0] === "E") return `<ellipse cx="${p[1]}" cy="${p[2]}" rx="${p[3]}" ry="${p[4]}" ${a}/>`;
    return "";
  }
  function pieceSVG(t, white) {
    const c = white
      ? { a: "#cdbb9c", b: "#fffdf8", m: "#f3e9d7", d: "#b9a37f", edge: "#2a2017", line: "#3b2e22", sp: "#ffffff" }
      : { a: "#141312", b: "#605b56", m: "#2c2a28", d: "#080807", edge: "#000000", line: "#d8cfc2", sp: "#9a948d" };
    const id = "t" + t + (white ? "w" : "b");
    const parts = SH[t];
    const all = parts.map((p) => prim(p)).join("");
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104"><defs>` +
      `<linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0">` +
      `<stop offset="0" stop-color="${c.a}"/><stop offset=".28" stop-color="${c.b}"/><stop offset=".55" stop-color="${c.m}"/><stop offset="1" stop-color="${c.d}"/></linearGradient>` +
      `<radialGradient id="${id}s" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="${c.sp}"/><stop offset=".25" stop-color="${c.b}"/><stop offset=".6" stop-color="${c.m}"/><stop offset="1" stop-color="${c.d}"/></radialGradient>` +
      `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${white ? 0.25 : 0.08}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${white ? 0.12 : 0.3}"/></linearGradient>` +
      `<clipPath id="${id}k">${all}</clipPath></defs>`;
    s += `<g fill="${c.edge}" stroke="${c.edge}" stroke-width="4.6" stroke-linejoin="round">${all}</g>`;
    for (const p of parts) {
      s += prim(p, `fill="url(#${id}${p[p.length - 1] === "s" ? "s" : "c"})" stroke="${c.edge}" stroke-width="1.3" stroke-linejoin="round"`);
    }
    s += `<rect x="-2" y="-2" width="104" height="104" fill="url(#${id}v)" clip-path="url(#${id}k)"/>`;
    for (const d of DT[t]) {
      if (d[0] === "L") s += prim(d, `fill="none" stroke="${c.line}" stroke-width="2.2" stroke-linecap="round" opacity=".85"`);
      else s += prim(d, `fill="${white ? c.edge : c.line}"`);
    }
    return s + `</svg>`;
  }

  // Style materiałów dla figur (kształty SH/DT z set2.js)
  const STYLES = {
    turned: { name: "Turned (classic)",
      w: { a: "#cdbb9c", b: "#fffdf8", m: "#f3e9d7", d: "#b9a37f", edge: "#2a2017", line: "#3b2e22", sp: "#ffffff" },
      k: { a: "#141312", b: "#605b56", m: "#2c2a28", d: "#080807", edge: "#000000", line: "#d8cfc2", sp: "#9a948d" } },
    ivory: { name: "Ivory & Espresso",
      w: { a: "#d6c4a3", b: "#fffaf0", m: "#f4e8d2", d: "#c2a982", edge: "#2a1d12", line: "#3b2a1b", sp: "#ffffff" },
      k: { a: "#24150c", b: "#7a5236", m: "#3f2617", d: "#120a05", edge: "#0b0603", line: "#e8cfae", sp: "#a77c5a" } },
    pearl: { name: "Pearl & Graphite",
      w: { a: "#c9ccd1", b: "#ffffff", m: "#eceef1", d: "#aeb3bb", edge: "#1e2126", line: "#2a2e35", sp: "#ffffff" },
      k: { a: "#16181b", b: "#5b6068", m: "#30343a", d: "#0a0b0d", edge: "#000000", line: "#d5dae2", sp: "#8d939c" } },
    bone: { name: "Bone & Mahogany",
      w: { a: "#d3c19f", b: "#fffbf1", m: "#f1e5cd", d: "#bca57c", edge: "#2b1d10", line: "#3c2b19", sp: "#ffffff" },
      k: { a: "#3a0f08", b: "#a3412b", m: "#6b2214", d: "#240804", edge: "#160402", line: "#f2c9b4", sp: "#d06a4f" } },
    snow: { name: "Snow & Onyx",
      w: { a: "#d8d8d8", b: "#ffffff", m: "#f7f7f7", d: "#c4c4c4", edge: "#111111", line: "#1b1b1b", sp: "#ffffff" },
      k: { a: "#060606", b: "#4a4a4a", m: "#1a1a1a", d: "#000000", edge: "#000000", line: "#ededed", sp: "#7a7a7a" } },
    cream: { name: "Cream & Forest",
      w: { a: "#d8c9a6", b: "#fffcf2", m: "#f3ead6", d: "#c3ad84", edge: "#24201a", line: "#33291c", sp: "#ffffff" },
      k: { a: "#0e1f15", b: "#4f7a5c", m: "#25412f", d: "#07120b", edge: "#030805", line: "#d9ead9", sp: "#86ab8f" } },
    wood: { name: "Wood", grain: true,
      w: { a: "#c99a5b", b: "#f6dcaa", m: "#e6bf80", d: "#a87437", edge: "#3b2410", line: "#5a3a1c", sp: "#fff1d2" },
      k: { a: "#2e170b", b: "#7a4a2b", m: "#4f2b16", d: "#1c0d05", edge: "#140904", line: "#e2b98a", sp: "#a8714a" } },
    marble: { name: "Marble", veins: true,
      w: { a: "#d9dde2", b: "#ffffff", m: "#f1f3f6", d: "#c1c7cf", edge: "#2b3038", line: "#3a414c", sp: "#ffffff" },
      k: { a: "#121418", b: "#4a5160", m: "#262a33", d: "#08090b", edge: "#000000", line: "#c9d1de", sp: "#7d8698" } },
    royal: { name: "Royal",
      w: { a: "#b9bec6", b: "#ffffff", m: "#e3e7ec", d: "#8f97a3", edge: "#1f2329", line: "#2b3038", sp: "#ffffff" },
      k: { a: "#7a4f12", b: "#ffd77a", m: "#d9a23c", d: "#6b420b", edge: "#2b1a03", line: "#fff1c9", sp: "#fff4cf" } },
    flat: { name: "Flat", flat: true,
      w: { fill: "#ffffff", edge: "#22201d", line: "#22201d" },
      k: { fill: "#3d3a37", edge: "#141312", line: "#f2efe9" } },
  };
  function pieceStyled(t, white, styleKey) {
    const st = STYLES[styleKey] || STYLES.turned;
    const c = white ? st.w : st.k;
    const id = "x" + styleKey + t + (white ? "w" : "b");
    const parts = SH[t];
    const all = parts.map((p) => prim(p)).join("");
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104"><defs><clipPath id="${id}k">${all}</clipPath>`;
    if (st.flat) {
      s += `</defs><g fill="${c.edge}" stroke="${c.edge}" stroke-width="5.4" stroke-linejoin="round">${all}</g>`;
      for (const p of parts) s += prim(p, `fill="${c.fill}" stroke="${c.edge}" stroke-width="1.6" stroke-linejoin="round"`);
    } else {
      s += `<linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${c.a}"/><stop offset=".28" stop-color="${c.b}"/><stop offset=".55" stop-color="${c.m}"/><stop offset="1" stop-color="${c.d}"/></linearGradient>` +
        `<radialGradient id="${id}s" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="${c.sp}"/><stop offset=".25" stop-color="${c.b}"/><stop offset=".6" stop-color="${c.m}"/><stop offset="1" stop-color="${c.d}"/></radialGradient>` +
        `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${white ? 0.22 : 0.08}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${white ? 0.12 : 0.3}"/></linearGradient>`;
      if (st.grain) s += `<filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.7" numOctaves="2" seed="7"/>` +
        `<feColorMatrix values="0 0 0 0 ${white ? 0.45 : 0.1} 0 0 0 0 ${white ? 0.25 : 0.05} 0 0 0 0 ${white ? 0.08 : 0.02} 0 0 0 ${white ? 0.9 : 1.1} -${white ? 0.42 : 0.45}"/></filter>`;
      if (st.veins) s += `<filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="3" seed="11"/>` +
        `<feColorMatrix values="0 0 0 0 ${white ? 0.45 : 0.85} 0 0 0 0 ${white ? 0.48 : 0.88} 0 0 0 0 ${white ? 0.55 : 0.95} -2.2 0 0 0 ${white ? 0.62 : 0.55}"/></filter>`;
      s += `</defs><g fill="${c.edge}" stroke="${c.edge}" stroke-width="4.6" stroke-linejoin="round">${all}</g>`;
      for (const p of parts) s += prim(p, `fill="url(#${id}${p[p.length - 1] === "s" ? "s" : "c"})" stroke="${c.edge}" stroke-width="1.3" stroke-linejoin="round"`);
      s += `<g clip-path="url(#${id}k)">` + ((st.grain || st.veins) ? `<rect x="-2" y="-2" width="104" height="104" filter="url(#${id}g)"/>` : "") +
        `<rect x="-2" y="-2" width="104" height="104" fill="url(#${id}v)"/></g>`;
    }
    for (const d of DT[t]) {
      if (d[0] === "L") s += prim(d, `fill="none" stroke="${c.line}" stroke-width="2.2" stroke-linecap="round" opacity=".85"`);
      else s += prim(d, `fill="${white ? c.edge : c.line}"`);
    }
    return s + `</svg>`;
  }

  const cache = {};
  let pieceStyle = "turned";
  function setPieceStyle(k) { if (STYLES[k]) pieceStyle = k; }
  function pieceURL(t, white, styleKey) {
    const st = styleKey || pieceStyle;
    const k = st + t + (white ? "w" : "b");
    if (!cache[k]) cache[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(pieceStyled(t, white, st));
    return cache[k];
  }

  // ---------- Oceny ruchów ----------
  const CLASSES = {
    Brilliant:  { color: "#1bada6", label: "Brilliant",  pl: "brilliant move" },
    Great:      { color: "#5c8bb0", label: "Great",      pl: "great move" },
    Best:       { color: "#81b64c", label: "Best",       pl: "best move" },
    Excellent:  { color: "#96bc4b", label: "Excellent",  pl: "excellent move" },
    Good:       { color: "#8ba57a", label: "Good",       pl: "good move" },
    Book:       { color: "#a88764", label: "Book",       pl: "book move" },
    Inaccuracy: { color: "#f0c040", label: "Inaccuracy", pl: "inaccuracy" },
    Mistake:    { color: "#ff9a3c", label: "Mistake",    pl: "mistake" },
    Miss:       { color: "#ee6b5a", label: "Miss",       pl: "missed win" },
    Blunder:    { color: "#e23b2e", label: "Blunder",    pl: "blunder" },
    Forced:     { color: "#8ba57a", label: "Forced",     pl: "forced move" },
  };

  function glyph(text, size) {
    return `<text x="12" y="${size > 10 ? 16.4 : 16}" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="800" font-size="${size}" fill="#fff" letter-spacing="-0.6">${text}</text>`;
  }
  const INNER = {
    Brilliant: glyph("!!", 11.5),
    Great: glyph("!", 13),
    Best: `<path d="M12 5.2l2.05 4.3 4.7.6-3.45 3.25.88 4.65L12 15.75 7.82 18l.88-4.65L5.25 10.1l4.7-.6z" fill="#fff"/>`,
    Excellent: `<path d="M6.6 11h2.6v7.4H6.6zM10.4 18.4h5.8c.7 0 1.3-.5 1.45-1.2l.95-4.55c.18-.9-.5-1.75-1.42-1.75H14.2l.45-2.6c.12-.75-.3-1.5-1.02-1.75l-.5-.17-2.73 4.45z" fill="#fff"/>`,
    Good: `<path d="M6.5 12.4l3.6 3.6 7.4-7.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    Book: `<path d="M12 8.1C10.2 6.8 7.6 6.4 5.3 6.9v9.9c2.3-.5 4.9-.1 6.7 1.2z" fill="#fff"/>` +
          `<path d="M12 8.1c1.8-1.3 4.4-1.7 6.7-1.2v9.9c-2.3-.5-4.9-.1-6.7 1.2z" fill="#fff" opacity=".82"/>`,
    Inaccuracy: glyph("?!", 11),
    Mistake: glyph("?", 13),
    Miss: `<path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,
    Blunder: glyph("??", 11),
    Forced: `<path d="M6.5 12h9M12.5 8l4 4-4 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };

  function iconSVG(cls) {
    const c = CLASSES[cls];
    if (!c) return "";
    return `<svg class="ico" viewBox="0 0 24 24" aria-label="${c.label}"><circle cx="12" cy="12" r="11.2" fill="${c.color}"/>` +
      `<circle cx="12" cy="12" r="11.2" fill="url(#icoShade)" />${INNER[cls]}</svg>`;
  }

  // ---------- Ikony tempa i inne ----------
  const TC = {
    bullet: `<svg class="tci" viewBox="0 0 24 24"><path d="M5 19l3-3m-1.5-3.5 8-8c1.6-1.6 4.2-1.2 4.2-1.2s.4 2.6-1.2 4.2l-8 8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    blitz: `<svg class="tci" viewBox="0 0 24 24"><path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z" fill="currentColor"/></svg>`,
    rapid: `<svg class="tci" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4.5l3 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    daily: `<svg class="tci" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  };

  const UI = {
    first: `<svg viewBox="0 0 24 24"><path d="M6 5v14M18 6l-8 6 8 6z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    prev: `<svg viewBox="0 0 24 24"><path d="M16 5l-9 7 9 7z" fill="currentColor"/></svg>`,
    next: `<svg viewBox="0 0 24 24"><path d="M8 5l9 7-9 7z" fill="currentColor"/></svg>`,
    last: `<svg viewBox="0 0 24 24"><path d="M18 5v14M6 6l8 6-8 6z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    flip: `<svg viewBox="0 0 24 24"><path d="M7 4v13m0 0-3.5-3.5M7 17l3.5-3.5M17 20V7m0 0-3.5 3.5M17 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`,
    stop: `<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    target: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>`,
    power: `<svg viewBox="0 0 24 24"><path d="M12 3v8M7 6.3a7.5 7.5 0 1 0 10 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    sound: `<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    mute: `<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    chart: `<svg viewBox="0 0 24 24"><path d="M4 19h16M6 16l4-5 3.5 3 5-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bulb: `<svg viewBox="0 0 24 24"><path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    key: `<svg viewBox="0 0 24 24"><path d="M12 3.5l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.7 5.4-.7z" fill="currentColor"/></svg>`,
  };

  const LOGO = `<svg viewBox="0 0 100 100" class="logo-svg"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2c066"/><stop offset="1" stop-color="#b9792a"/></linearGradient></defs>` +
    `<rect x="4" y="4" width="92" height="92" rx="24" fill="url(#lg1)"/>` +
    `<path d="M30 22h8v7h7v-7h10v7h7v-7h8v16l-6 5v19l5 6v6H31v-6l5-6V43l-6-5z" fill="#fff"/><rect x="27" y="74" width="46" height="8" rx="3" fill="#fff"/>` +
    `<rect x="41" y="47" width="18" height="3.5" rx="1.5" fill="#c58a33"/></svg>`;

  window.CR = { pieceURL, setPieceStyle, STYLES, iconSVG, CLASSES, TC, UI, LOGO };
})();
