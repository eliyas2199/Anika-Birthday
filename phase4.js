/* =========================================================
   STAGE 4 : The Royal Magical Gift Box (one stage: letter, portrait, hijab, Dairy Milk, pen, final letter, ending)
   Order of events (the moon is the only control; one click = one step):

     click A  (Stage 3's moon)   the lower scene fades in
     click B  the lid opens, the first royal letter rises out, opens, the quill writes
     click C  the letter rolls up and returns into the box
     click D / E   Anika's portrait comes out / goes back in
     click F / G   the black hijab comes out / goes back in
     click H / I   Dairy Milk comes out / goes back in
     click J / K   the pen comes out / goes back in
     click L  the final letter comes out and is written
     click M  the final letter returns; the cinematic ending then starts BY ITSELF (no click)

   Sound: "magical-reveal.mp3" whenever something leaves the box, "magical-return.mp3" when it goes back in.

   Public API:  window.Phase4
     Phase4.start({ moon })      begin (used when merged: adopts the existing moon)
     Phase4.getState()           current state name (Part 1 and Part 2 states)
     Phase4.destroy()            stop everything and remove the listeners
   Events on document:  "phase4:part1-complete" (hijab returned), "phase4:part2-complete" (ending finished)

   Test switches (only in the address bar):  ?fast  (4x faster)   ?jump  (auto-click to the chocolate)
   ========================================================= */
(function () {
  'use strict';

  /* =========================================================
     ADJUSTABLE SETTINGS
     ========================================================= */
  const CONFIG = {

    /* ---------------------------------------------------------------
       >>>  FIRST LETTER  <<<   (shown exactly as written)
       - A blank line starts a new paragraph. A single line break stays a line break.
       - Bengali, English and emoji may be mixed; the text is shown exactly as typed.
       --------------------------------------------------------------- */
    LETTER_TEXT: "প্রিয় Anika,\nশুভ জন্মদিন!(ইং শা আল্লহ) ❤️🎂\nরিক্ত আমি, নিঃস্ব আমি, দেওয়ার মতো তেমন কিছু  নাই। \nআছে শুধু কিছু আন্তরিক অনুভূতি,\nএকটু যত্ন আর অনেকখানি ভালোবাসা।\nদিয়ে গেলাম তাই।\nতাই ছোট্ট এই উপহারগুলোর সঙ্গে আমার মনের কিছু কথাও দিয়ে গেলাম।\nজীবনে অনেক মানুষের সঙ্গে পরিচয় হয়, কিন্তু সবার সঙ্গে সুন্দর একটা বন্ধুত্ব তৈরি হয় না। তোর সাথে  এই Friendship টা আমার কাছে Special। দোয়া করি, আমাদের Friendship টা সারাজীবন এমনই সুন্দর থাকে (ইং শা আল্লহ)।\nকখনো আমার কোনো কথায় বা কাজে কষ্ট পেয়ে থাকলে আমাকে ক্ষমা করে দিস এবং  ভুল হলে আমাকে বুঝিয়ে বলিস, ভুলটা ধরিয়ে দিস। আমি চাই, ভুল বোঝাবুঝি হলে সেটা যেন সুন্দরভাবে মিটিয়ে নিতে পারি।\nতোর জীবনের প্রতিটি দিন আনন্দে কাটুক। তোর স্বপ্নগুলো পূরণ হোক, তুই সুস্থ থাকিস, ভালো থাকিস,হাসিখুশি থাকিস(ইং শা আল্লহ) \n\nঅনেক দোয়া ও শুভকামনা রইল তোর জন্য।\nশুভ জন্মদিন(ইং শা আল্লহ) , Anika! 🌸\nইতি,\nতোর বন্ধু",

    /* ---- Assets ---- */
    PORTRAIT_SRC: './assets/anika-portrait-1.jpg',
    REVEAL_SRC: './assets/magical-reveal.mp3',    // plays when a gift or letter leaves the box
    RETURN_SRC: './assets/magical-return.mp3',    // plays when it goes back in
    REVEAL_VOLUME: 0.55,
    RETURN_VOLUME: 0.5,
    PROJECTOR_SRC: './assets/projector-reveal.mp3',   // the ending: the light rises and the message appears
    PROJECTOR_VOLUME: 0.7,
    SOUND_FADE_MS: 260,

    /* ---- Where gifts leave the box (set from the drawn box when the page starts) ---- */
    SEAM_X: 0.47,
    SEAM_Y: 0.41,
    BOX_AREA: { x0: 0.17, x1: 0.73, y0: 0.28, y1: 0.604 },   // where the ornaments sparkle

    /* ---- Timing (milliseconds) ---- */
    SCENE_IN_MS: 2600,        // lower scene fades in
    RISE_MS: 1150,            // item climbs out of the box (still sealed at the lid line)
    FLY_MS: 1750,             // item floats to its place
    RETURN_FLY_MS: 1500,      // item floats back above the box
    RETURN_SINK_MS: 1050,     // item sinks into the box
    LID_OPEN_MS: 1900,        // the lid swings open
    LID_ANGLE: 112,           // how far the lid opens (degrees)
    UNROLL_MS: 2400,          // scroll opens
    ROLLUP_MS: 1900,          // scroll closes
    START_SCALE: 0.14,        // size while inside the box
    HOVER_SCALE: 0.34,        // size just after leaving the box

    /* ---- Quill and writing ---- */
    MS_PER_GRAPHEME: 85,      // writing speed (bigger = slower)
    MIN_WORD_MS: 170,
    WORD_GAP_MS: 55,
    LINE_PAUSE_MS: 300,
    PARAGRAPH_PAUSE_MS: 620,
    WRITE_MAX_MS: 38000,      // a long letter is written faster so that writing never takes longer than this

    /* ---- Reading pause (minimum; the letter never closes by itself) ---- */
    READ_WAIT_MS: 5000        // after a letter is fully written the moon becomes clickable this long after (same on every device)
  };

  const State = {
    IDLE: 'IDLE',
    ENTERING_PART1: 'ENTERING_PART1',
    READY_FOR_LETTER: 'READY_FOR_LETTER',
    BOX_OPENING: 'BOX_OPENING',
    LETTER_OPENING: 'LETTER_OPENING',
    LETTER_WRITING: 'LETTER_WRITING',
    LETTER_READING: 'LETTER_READING',
    LETTER_CLOSING: 'LETTER_CLOSING',
    READY_FOR_PORTRAIT: 'READY_FOR_PORTRAIT',
    PORTRAIT_ENTERING: 'PORTRAIT_ENTERING',
    PORTRAIT_SHOWN: 'PORTRAIT_SHOWN',
    PORTRAIT_RETURNING: 'PORTRAIT_RETURNING',
    READY_FOR_HIJAB: 'READY_FOR_HIJAB',
    HIJAB_ENTERING: 'HIJAB_ENTERING',
    HIJAB_SHOWN: 'HIJAB_SHOWN',
    HIJAB_RETURNING: 'HIJAB_RETURNING',
    PART1_COMPLETE: 'PART1_COMPLETE'
  };

  /* =========================================================
     BASICS
     ========================================================= */
  const params = new URLSearchParams(location.search);
  const FAST = params.has('fast');
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TS = FAST ? 0.22 : (REDUCED ? 0.5 : 1);          // global time scale
  if (params.has('long')) {
    let more = '';
    for (let i = 0; i < 6; i++) more += '\n\nএটি পরীক্ষার জন্য আরও একটি অনুচ্ছেদ। লম্বা লেখা হলে চিঠির ভেতরেই স্ক্রল হবে, আর কলম লেখার সাথে সাথে নিচে নামবে। (' + (i + 1) + ')';
    CONFIG.LETTER_TEXT += more;
  }

  const $ = function (id) { return document.getElementById(id); };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const ABORT = { aborted: true };

  const root = $('p4-root');
  const el = {
    scene: $('p4-scene'),
    bgsvg: $('p4-bgsvg'),
    backsvg: $('p4-backsvg'),
    frontsvg: $('p4-frontsvg'),
    spots: $('p4-spots'),
    gifts: $('p4-gifts'),
    letter: $('p4-letter'),
    sheet: $('p4-sheet'),
    reader: $('p4-reader'),
    text: $('p4-text'),
    rollerB: $('p4-roller-b'),
    rollerT: root ? root.querySelector('.p4-roller--top') : null,
    stars: $('p4-stars'),
    probe: $('p4-probe')
  };
  const items = {
    portrait: { el: $('p4-portrait') },
    hijab: { el: $('p4-hijab') }
  };
  items.portrait.fl = items.portrait.el.querySelector('.p4-gift-float');
  items.hijab.fl = items.hijab.el.querySelector('.p4-gift-float');

  let state = State.IDLE;
  let alive = true;
  let inited = false;
  let moon = $('p4-moon');
  let ownMoon = moon;
  let moonReady = false;
  let external = false;          // set by Part 2 through Phase4.kit.claim(true)
  const timers = new Set();
  const liveAnims = new Set();

  function setState(s) {
    state = s;
    if (root) root.setAttribute('data-p4-state', s);
  }
  function guard() { if (!alive) throw ABORT; }

  function sleep(ms) {
    return new Promise(function (resolve) {
      guard();
      const id = window.setTimeout(function () { timers.delete(id); resolve(); }, Math.max(0, ms * TS));
      timers.add(id);
    }).then(guard);
  }

  /* Plays a Web Animation, then writes the last frame into inline style and removes the animation */
  const SKIP_KEYS = { offset: 1, easing: 1, composite: 1 };
  function play(node, frames, duration, easing) {
    guard();
    const last = frames[frames.length - 1];
    function commit() {
      Object.keys(last).forEach(function (k) { if (!SKIP_KEYS[k]) node.style[k] = last[k]; });
    }
    if (!node.animate) { commit(); return Promise.resolve(); }
    const a = node.animate(frames, { duration: Math.max(1, duration * TS), easing: easing || 'ease', fill: 'both' });
    liveAnims.add(a);
    return a.finished.then(function () {
      liveAnims.delete(a);
      if (!alive) throw ABORT;
      commit();
      a.cancel();
    }, function () {
      liveAnims.delete(a);
      throw ABORT;
    });
  }

  const EASE_RISE = 'cubic-bezier(0.32, 0.04, 0.4, 1)';
  const EASE_FLY = 'cubic-bezier(0.22, 0.68, 0.2, 1)';
  const EASE_SOFT = 'cubic-bezier(0.45, 0.05, 0.25, 1)';

  /* =========================================================
     BACKGROUND STARS (only when this page draws its own sky)
     ========================================================= */
  function buildStars() {
    if (!el.stars || root.hasAttribute('data-embedded')) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 120; i++) {
      const s = document.createElement('span');
      const big = Math.random() < 0.12;
      s.className = 'p4-star' + (big ? ' p4-star--big' : '');
      const size = big ? 2 + Math.random() * 1.4 : 0.8 + Math.random() * 1.6;
      s.style.cssText =
        'left:' + (Math.random() * 100).toFixed(2) + '%;' +
        'top:' + (Math.random() * 88).toFixed(2) + '%;' +
        '--s:' + size.toFixed(1) + 'px;' +
        '--d:' + (2 + Math.random() * 4).toFixed(1) + 's;' +
        '--delay:-' + (Math.random() * 6).toFixed(1) + 's';
      frag.appendChild(s);
    }
    el.stars.appendChild(frag);
  }

  /* =========================================================
     THE SCENE AND THE GIFT BOX
     Everything here is drawn with SVG (no photograph).
     The box is built from flat faces placed with exact 3-D maths, so the lid is a real
     hinged lid that swings open and the gifts rise out of a real, open mouth.
     Three layers (back / gifts / front) make the gifts pass BEHIND the front wall of the box.
     ========================================================= */
  const SVGW = 940, SVGH = 1192;
  function rnd(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  const f1 = function (n) { return (Math.round(n * 100) / 100).toString(); };

  const DEFS =
    '<defs>' +
    '<linearGradient id="p4bGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0BF"/><stop offset=".45" stop-color="#E2B95C"/><stop offset="1" stop-color="#9C7122"/></linearGradient>' +
    '<linearGradient id="p4bFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1b57"/><stop offset="1" stop-color="#080726"/></linearGradient>' +
    '<linearGradient id="p4bSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101042"/><stop offset="1" stop-color="#05041a"/></linearGradient>' +
    '<linearGradient id="p4bTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2972"/><stop offset="1" stop-color="#14134c"/></linearGradient>' +
    '<linearGradient id="p4bLin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26246c"/><stop offset="1" stop-color="#0f0e3a"/></linearGradient>' +
    '<linearGradient id="p4bInA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0b2e"/><stop offset="1" stop-color="#03030f"/></linearGradient>' +
    '<linearGradient id="p4bBand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101046"/><stop offset=".5" stop-color="#2c2b88"/><stop offset="1" stop-color="#0e0e3c"/></linearGradient>' +
    '<linearGradient id="p4bSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".10"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="p4bSatin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3c3aa2"/><stop offset=".5" stop-color="#1f1e66"/><stop offset="1" stop-color="#0c0c30"/></linearGradient>' +
    '<radialGradient id="p4bMed" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#FFF3C4"/><stop offset=".5" stop-color="#E3B858"/><stop offset="1" stop-color="#8d6424"/></radialGradient>' +
    '<linearGradient id="p4bDia" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#bfd4ff"/><stop offset="1" stop-color="#7f8fd0"/></linearGradient>' +
    '<radialGradient id="p4bGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF1BC" stop-opacity="1"/><stop offset=".4" stop-color="#FFC866" stop-opacity=".55"/><stop offset="1" stop-color="#FFAA44" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="p4bHaze" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8e5aa8" stop-opacity=".55"/><stop offset=".55" stop-color="#4a2c78" stop-opacity=".25"/><stop offset="1" stop-color="#2a1a50" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="p4bHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2760"/><stop offset="1" stop-color="#14123a"/></linearGradient>' +
    '<linearGradient id="p4bLake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4388" stop-opacity=".85"/><stop offset="1" stop-color="#241f58" stop-opacity=".85"/></linearGradient>' +
    '<linearGradient id="p4bRockTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3560"/><stop offset="1" stop-color="#211d40"/></linearGradient>' +
    '<linearGradient id="p4bRockFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#242040"/><stop offset=".6" stop-color="#12102a"/><stop offset="1" stop-color="#08071a"/></linearGradient>' +
    '<linearGradient id="p4bCloth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#242276"/><stop offset=".55" stop-color="#121150"/><stop offset="1" stop-color="#070628"/></linearGradient>' +
    '<linearGradient id="p4bVig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04030e" stop-opacity="0"/><stop offset="1" stop-color="#04030e" stop-opacity=".7"/></linearGradient>' +
    '<linearGradient id="p4bGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd890" stop-opacity=".55"/><stop offset="1" stop-color="#a8581c" stop-opacity=".55"/></linearGradient>' +
    '<linearGradient id="p4bRoof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b25a"/><stop offset="1" stop-color="#6e4c16"/></linearGradient>' +
    '<filter id="p4bBlur6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>' +
    '<filter id="p4bBlur12" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>' +
    '<path id="p4bStar" d="M0 -7 L1.7 -1.7 L7 0 L1.7 1.7 L0 7 L-1.7 1.7 L-7 0 L-1.7 -1.7Z" fill="#E8C987"/>' +
    '<g id="p4bCorner" fill="none" stroke="url(#p4bGold)" stroke-width="2" stroke-linecap="round">' +
      '<path d="M2 2 L52 2 M2 2 L2 52"/>' +
      '<path d="M10 10 C34 8 48 22 42 38 C38 48 24 46 26 36 C27 30 34 30 35 34"/>' +
      '<path d="M10 10 C8 34 22 48 38 42"/>' +
      '<circle cx="15" cy="15" r="2.4" fill="#E8C987" stroke="none"/>' +
    '</g>' +
    '<symbol id="p4bLantern" viewBox="0 0 100 220" overflow="visible">' +
      '<circle cx="50" cy="12" r="6" fill="url(#p4bGold)"/>' +
      '<path d="M50 18V32" stroke="#c9a24a" stroke-width="3"/>' +
      '<path d="M16 72 Q50 22 84 72Z" fill="url(#p4bRoof)" stroke="#E8C987" stroke-width="1.5"/>' +
      '<rect x="22" y="72" width="56" height="112" fill="url(#p4bGlass)" stroke="url(#p4bGold)" stroke-width="3"/>' +
      '<path d="M36 72V184M64 72V184" stroke="#c9a24a" stroke-width="2.4" opacity=".85"/>' +
      '<rect x="43" y="142" width="14" height="42" rx="2" fill="#fff4dc"/>' +
      '<path d="M50 120 Q60 133 50 145 Q40 133 50 120Z" fill="#ffd27a"/>' +
      '<path d="M14 184H86L78 202H22Z" fill="url(#p4bGold)"/>' +
      '<rect x="30" y="202" width="40" height="9" rx="2" fill="#8d6424"/>' +
    '</symbol>' +
    '</defs>';

  /* ---- Decorations (drawn in a face's own flat coordinates) ---- */
  function decStars(w, h, seed, n, avoid) {
    const r = rnd(seed);
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = 16 + r() * (w - 32), y = 16 + r() * (h - 32);
      const k = 0.5 + r() * 0.9, o = 0.55 + r() * 0.4, hang = r() < 0.4, L = 16 + r() * 40;
      if (avoid && x > avoid[0] && x < avoid[1]) continue;
      s += '<use href="#p4bStar" transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + f1(k) + ')" opacity="' + f1(o) + '"/>';
      if (hang) {
        s += '<path d="M' + f1(x) + ' ' + f1(y + 6) + 'v' + f1(L) + '" stroke="#E8C987" stroke-width=".8" opacity=".45"/>' +
             '<circle cx="' + f1(x) + '" cy="' + f1(y + 6 + L) + '" r="1.4" fill="#E8C987" opacity=".7"/>';
      }
    }
    return s;
  }
  function decCorners(w, h) {
    return '<use href="#p4bCorner" transform="translate(7 7)"/>' +
      '<use href="#p4bCorner" transform="translate(' + (w - 7) + ' 7) scale(-1 1)"/>' +
      '<use href="#p4bCorner" transform="translate(7 ' + (h - 7) + ') scale(1 -1)"/>' +
      '<use href="#p4bCorner" transform="translate(' + (w - 7) + ' ' + (h - 7) + ') scale(-1 -1)"/>';
  }
  function decFrame(w, h) {
    return '<rect x="6" y="6" width="' + (w - 12) + '" height="' + (h - 12) + '" fill="none" stroke="url(#p4bGold)" stroke-width="2.4"/>' +
      '<rect x="13" y="13" width="' + (w - 26) + '" height="' + (h - 26) + '" fill="none" stroke="#E8C987" stroke-opacity=".5" stroke-width=".9"/>';
  }
  function decBand(w, h) {
    const bw = 70, x = (w - bw) / 2;
    return '<rect x="' + x + '" y="0" width="' + bw + '" height="' + h + '" fill="url(#p4bBand)"/>' +
      '<path d="M' + x + ' 0V' + h + 'M' + (x + bw) + ' 0V' + h + '" stroke="url(#p4bGold)" stroke-width="2"/>';
  }
  function sheen(w, h) { return '<rect width="' + w + '" height="' + h + '" fill="url(#p4bSheen)"/>'; }

  const BOW =
    '<path d="M-14 8 C-40 42 -64 92 -80 170 L-60 152 L-46 178 C-36 114 -20 64 2 16Z" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.6"/>' +
    '<path d="M14 8 C40 40 72 82 98 152 L76 142 L72 172 C54 112 28 62 6 16Z" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.6"/>' +
    '<path d="M0 -4 C-20 -66 -72 -90 -98 -66 C-112 -50 -92 -18 -30 -6Z" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.6" transform="rotate(-16)"/>' +
    '<path d="M0 -4 C20 -66 72 -90 98 -66 C112 -50 92 -18 30 -6Z" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.6" transform="rotate(16)"/>' +
    '<path d="M0 0 C-24 -46 -88 -60 -120 -34 C-140 -14 -114 26 -44 16 C-24 12 -8 6 0 0Z" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.8"/>' +
    '<path d="M0 0 C24 -46 88 -60 120 -34 C140 -14 114 26 44 16 C24 12 8 6 0 0Z" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.8"/>' +
    '<path d="M-8 0 C-42 -22 -82 -30 -110 -24 M-8 7 C-42 5 -78 5 -106 5 M8 0 C42 -22 82 -30 110 -24 M8 7 C42 5 78 5 106 5" fill="none" stroke="#9a98f0" stroke-opacity=".32" stroke-width="1.2"/>' +
    '<ellipse cx="0" cy="2" rx="25" ry="21" fill="url(#p4bSatin)" stroke="url(#p4bGold)" stroke-width="1.8"/>' +
    '<circle cx="0" cy="2" r="16" fill="url(#p4bMed)" stroke="#8d6424" stroke-width=".8"/>' +
    '<circle cx="0" cy="2" r="11" fill="#12123e"/>' +
    '<path d="M3 -6.5 A9 9 0 1 0 3 10.5 A7 7 0 1 1 3 -6.5Z" fill="url(#p4bMed)"/>' +
    '<path d="M0 22V72" stroke="#E8C987" stroke-width="1.4"/><circle cx="0" cy="36" r="2.2" fill="#E8C987"/><circle cx="0" cy="52" r="2.2" fill="#E8C987"/>' +
    '<path d="M0 72L10 92L0 122L-10 92Z" fill="url(#p4bDia)" stroke="url(#p4bGold)" stroke-width="1.4"/>' +
    '<path d="M0 72L0 122M-10 92H10" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>';

  /* ---- Backdrop: distant lights, rocky ledge, velvet cloth, lanterns, flowers ---- */
  function flowerCluster(cx, cy, w, h, n, seed) {
    const r = rnd(seed);
    let leaves = '', fl = '';
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * w, y = cy + (r() - 0.5) * h;
      leaves += '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(9 + r() * 6) + '" ry="4" fill="#13291f" opacity=".9" transform="rotate(' + f1(r() * 180) + ' ' + f1(x) + ' ' + f1(y) + ')"/>';
    }
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * w, y = cy + (r() - 0.5) * h, s = 0.55 + r() * 0.8;
      fl += '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + f1(s) + ')">';
      for (let k = 0; k < 5; k++) {
        const a = k * 72 * Math.PI / 180 + r() * 0.5;
        fl += '<circle cx="' + f1(Math.cos(a) * 6) + '" cy="' + f1(Math.sin(a) * 6) + '" r="5.2" fill="#f6efe6" opacity=".93"/>';
      }
      fl += '<circle r="2.6" fill="#e8c46a"/></g>';
    }
    return leaves + fl;
  }

  function buildBackdrop(svg) {
    const r = rnd(7), r2 = rnd(31);
    let lights = '', glow = '', refl = '', cracks = '', clothStars = '';
    for (let i = 0; i < 46; i++) {
      const x = 640 + r() * 300, y = 392 + r() * 46, rad = 1.2 + r() * 1.5;
      lights += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(rad) + '" fill="#ffd58a" opacity="' + f1(0.6 + r() * 0.4) + '"/>';
      if (i % 5 === 0) glow += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="7" fill="#ffc870" opacity=".35"/>';
    }
    for (let i = 0; i < 14; i++) {
      const x = 650 + r() * 270, y = 442 + r() * 28;
      refl += '<path d="M' + f1(x) + ' ' + f1(y) + 'h' + f1(10 + r() * 24) + '" stroke="#ffcf84" stroke-opacity="' + f1(0.12 + r() * 0.2) + '" stroke-width="1.4"/>';
    }
    for (let i = 0; i < 16; i++) {
      const x0 = 480 + r2() * 440, y0 = 790 + r2() * 360;
      let d = 'M' + f1(x0) + ' ' + f1(y0);
      for (let k = 0; k < 4; k++) d += 'l' + f1((r2() - 0.4) * 46) + ' ' + f1(14 + r2() * 38);
      cracks += '<path d="' + d + '" fill="none" stroke="#050411" stroke-opacity=".6" stroke-width="' + f1(1.2 + r2() * 1.8) + '" stroke-linejoin="round"/>';
      cracks += '<path d="' + d + '" fill="none" stroke="#b9a8e8" stroke-opacity=".07" stroke-width="1" transform="translate(2 1.5)"/>';
    }
    for (let i = 0; i < 12; i++) {
      const x = 30 + r2() * 360, y = 700 + r2() * 420;
      clothStars += '<use href="#p4bStar" transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + f1(0.7 + r2() * 1.1) + ')" opacity="' + f1(0.5 + r2() * 0.45) + '"/>';
    }
    const cloth = 'M0 660 C130 668 270 708 372 744 C446 772 506 800 486 862 C456 962 384 1064 322 1192 L0 1192Z';
    svg.innerHTML = DEFS +
      '<ellipse cx="470" cy="430" rx="640" ry="190" fill="url(#p4bHaze)"/>' +
      '<path d="M0 440 L110 404 L250 428 L396 384 L548 418 L690 372 L820 398 L940 362 L940 540 L0 540Z" fill="url(#p4bHill)" opacity=".92"/>' +
      '<g fill="#2a2466" opacity=".95"><rect x="800" y="338" width="72" height="62"/><rect x="814" y="304" width="11" height="40"/><rect x="838" y="282" width="14" height="62"/><path d="M836 282L845 254L854 282Z"/><rect x="860" y="312" width="9" height="34"/><path d="M812 304L819.5 286L827 304Z"/></g>' +
      '<g fill="#ffd58a" opacity=".85"><rect x="808" y="352" width="3" height="5"/><rect x="822" y="360" width="3" height="5"/><rect x="842" y="300" width="3" height="5"/><rect x="842" y="318" width="3" height="5"/><rect x="852" y="352" width="3" height="5"/><rect x="866" y="362" width="3" height="5"/><rect x="818" y="318" width="3" height="5"/></g>' +
      '<rect x="620" y="402" width="330" height="86" fill="url(#p4bLake)"/>' +
      '<g filter="url(#p4bBlur6)">' + glow + '</g>' + lights + refl +
      '<path d="M0 478 C100 452 170 486 240 506 L430 572 C600 548 760 520 940 534 L940 700 L0 700Z" fill="#0e0d29"/>' +
      '<ellipse cx="445" cy="742" rx="330" ry="58" fill="#000" opacity=".5" filter="url(#p4bBlur12)"/>' +
      '<path d="M0 640 C200 618 450 626 700 608 C800 602 900 600 940 604 L940 724 C880 740 800 752 700 764 C560 780 420 774 300 786 C180 796 80 784 0 806Z" fill="url(#p4bRockTop)"/>' +
      '<path d="M0 806 C80 784 180 796 300 786 C420 774 560 780 700 764 C800 752 880 740 940 724 L940 1192 L0 1192Z" fill="url(#p4bRockFace)"/>' +
      '<path d="M0 806 C80 784 180 796 300 786 C420 774 560 780 700 764 C800 752 880 740 940 724" fill="none" stroke="#c4b4ee" stroke-opacity=".28" stroke-width="2.4"/>' +
      cracks +
      '<path d="' + cloth + '" fill="url(#p4bCloth)"/>' +
      '<g fill="none" stroke-linecap="round">' +
        '<path d="M60 680 C120 780 150 940 130 1192" stroke="#8c8aff" stroke-opacity=".16" stroke-width="3"/>' +
        '<path d="M170 700 C250 800 260 960 220 1192" stroke="#05041c" stroke-opacity=".5" stroke-width="5"/>' +
        '<path d="M260 724 C340 820 360 980 300 1192" stroke="#8c8aff" stroke-opacity=".14" stroke-width="3"/>' +
        '<path d="M340 748 C420 830 430 930 380 1060" stroke="#05041c" stroke-opacity=".45" stroke-width="4"/>' +
        '<path d="M486 862 C456 962 384 1064 322 1192" stroke="#E8C987" stroke-opacity=".75" stroke-width="2.4"/>' +
        '<path d="M372 744 C446 772 506 800 486 862" stroke="#E8C987" stroke-opacity=".75" stroke-width="2.4"/>' +
      '</g>' + clothStars +
      '<use href="#p4bLantern" x="10" y="190" width="130" height="286"/>' +
      '<use href="#p4bLantern" x="-45" y="780" width="190" height="418"/>' +
      flowerCluster(95, 500, 150, 70, 14, 5) + flowerCluster(735, 590, 90, 50, 7, 9) +
      flowerCluster(860, 1050, 170, 200, 16, 13) + flowerCluster(250, 1120, 120, 90, 7, 17) +
      '<rect x="0" y="880" width="940" height="312" fill="url(#p4bVig)"/>';
  }

  /* ---- The box ---- */
  const BX = (function () {
    const W = 420, H = 270, D = 300, S = 1;
    const LID_T = 46, OV = 8, WL = W + 2 * OV, DL = D + 2 * OV;
    const psi = 26 * Math.PI / 180, phi = 24 * Math.PI / 180;
    const cp = Math.cos(psi), sp = Math.sin(psi), ch = Math.cos(phi), sh = Math.sin(phi);
    const CX = 445, CY = 680;
    const HX = 0, HY = H + 4, HZ = -D / 2 - OV;   // lid hinge (back, top)

    function V(x, y, z) {                             // direction -> screen (no shift)
      const x1 = x * cp + z * sp, z1 = -x * sp + z * cp;
      return [x1 * S, -(y * ch - z1 * sh) * S, y * sh + z1 * ch];
    }
    function P(x, y, z) { const v = V(x, y, z); return [CX + v[0], CY + v[1], v[2]]; }
    function M(o, u, v) {
      const p = P(o[0], o[1], o[2]), a = V(u[0], u[1], u[2]), c = V(v[0], v[1], v[2]);
      return 'matrix(' + [a[0], a[1], c[0], c[1], p[0], p[1]].map(f1).join(' ') + ')';
    }
    function pts(list) { return list.map(function (q) { const p = P(q[0], q[1], q[2]); return f1(p[0]) + ',' + f1(p[1]); }).join(' '); }

    const g = {};                                      // lid pieces
    let frontSvg = null, backSvg = null, lidG = null;

    function faceG(id, w, h, inner) {
      return '<g id="' + id + '">' + inner + '</g>';
    }

    function build(front, back) {
      frontSvg = front; backSvg = back;

      /* body (static) */
      const bodyFront = M([-W / 2, H, D / 2], [1, 0, 0], [0, -1, 0]);
      const bodyLeft = M([-W / 2, H, -D / 2], [0, 0, 1], [0, -1, 0]);
      const inBack = M([-W / 2, H, -D / 2], [1, 0, 0], [0, -1, 0]);
      const inRight = M([W / 2, H, D / 2], [0, 0, -1], [0, -1, 0]);
      const rim = pts([[-W / 2, H, -D / 2], [W / 2, H, -D / 2], [W / 2, H, D / 2], [-W / 2, H, D / 2]]);
      const rc = P(0, H, 0);

      back.innerHTML =
        '<polygon points="' + rim + '" fill="#04040f"/>' +
        '<g transform="' + inBack + '"><rect width="' + W + '" height="' + H + '" fill="url(#p4bInA)"/>' + decStars(W, H, 71, 14) + '</g>' +
        '<g transform="' + inRight + '"><rect width="' + D + '" height="' + H + '" fill="#06061a"/></g>' +
        '<ellipse class="p4-inner-glow" cx="' + f1(rc[0]) + '" cy="' + f1(rc[1] + 8) + '" rx="190" ry="84" fill="url(#p4bGlow)"/>';

      front.innerHTML =
        '<g transform="' + bodyLeft + '"><rect width="' + D + '" height="' + H + '" fill="url(#p4bSide)"/>' +
          decStars(D, H, 12, 16) + decFrame(D, H) + decCorners(D, H) + sheen(D, H) + '</g>' +
        '<g transform="' + bodyFront + '"><rect width="' + W + '" height="' + H + '" fill="url(#p4bFront)"/>' +
          decStars(W, H, 5, 26, [W / 2 - 46, W / 2 + 46]) + decBand(W, H) + decFrame(W, H) + decCorners(W, H) + sheen(W, H) + '</g>' +
        '<g fill="none" stroke="url(#p4bGold)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="' + pts([[-W / 2, H, -D / 2], [-W / 2, H, D / 2], [W / 2, H, D / 2]]) + '"/>' +
          '<polyline points="' + pts([[-W / 2, 0, -D / 2], [-W / 2, 0, D / 2], [W / 2, 0, D / 2]]) + '"/>' +
          '<path d="M' + pts([[-W / 2, H, D / 2]]) + 'L' + pts([[-W / 2, 0, D / 2]]) + 'M' + pts([[W / 2, H, D / 2]]) + 'L' + pts([[W / 2, 0, D / 2]]) + '"/>' +
        '</g>' +
        '<g id="p4b-lid">' +
          '<g id="p4b-l-top">' + '</g>' +
        '</g>';

      /* the lid: top, lining, skirts, bow */
      lidG = front.querySelector('#p4b-lid');
      lidG.innerHTML =
        '<g id="p4b-l-topO"><rect width="' + WL + '" height="' + DL + '" fill="url(#p4bTop)"/>' +
          decStars(WL, DL, 21, 12, [WL / 2 - 46, WL / 2 + 46]) + decBand(WL, DL) + decFrame(WL, DL) + decCorners(WL, DL) + sheen(WL, DL) + '</g>' +
        '<g id="p4b-l-topI"><rect width="' + WL + '" height="' + DL + '" fill="url(#p4bLin)"/>' +
          decStars(WL, DL, 33, 34) + decFrame(WL, DL) + sheen(WL, DL) + '</g>' +
        '<g id="p4b-l-left"><rect width="' + DL + '" height="' + LID_T + '" fill="url(#p4bFront)"/>' +
          '<path d="M0 3H' + DL + 'M0 ' + (LID_T - 3) + 'H' + DL + '" stroke="url(#p4bGold)" stroke-width="2.6"/>' + decStars(DL, LID_T, 41, 5) + '</g>' +
        '<g id="p4b-l-right"><rect width="' + DL + '" height="' + LID_T + '" fill="url(#p4bSide)"/>' +
          '<path d="M0 3H' + DL + 'M0 ' + (LID_T - 3) + 'H' + DL + '" stroke="url(#p4bGold)" stroke-width="2.6"/></g>' +
        '<g id="p4b-l-front"><rect width="' + WL + '" height="' + LID_T + '" fill="url(#p4bFront)"/>' + decBand(WL, LID_T) +
          '<path d="M0 3H' + WL + 'M0 ' + (LID_T - 3) + 'H' + WL + '" stroke="url(#p4bGold)" stroke-width="2.6"/>' + decStars(WL, LID_T, 43, 6, [WL / 2 - 46, WL / 2 + 46]) + '</g>' +
        '<g id="p4b-bow">' + BOW + '</g>';
      ['topO', 'topI', 'left', 'right', 'front'].forEach(function (k) { g[k] = lidG.querySelector('#p4b-l-' + (k === 'topO' ? 'topO' : k === 'topI' ? 'topI' : k)); });
      g.bow = lidG.querySelector('#p4b-bow');
      setLid(0);
    }

    /* Puts the lid at opening angle 'deg' (0 = closed) */
    function setLid(deg) {
      const al = deg * Math.PI / 180, c = Math.cos(al), s = Math.sin(al);
      function R(v) { return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]; }
      function world(l) { const r = R(l); return [HX + r[0], HY + r[1], HZ + r[2]]; }
      function place(el, o, u, v, n, twoSided) {
        const ow = world(o), uw = R(u), vw = R(v), nz = V.apply(null, R(n))[2];
        el.setAttribute('transform', M(ow, uw, vw));
        el.style.display = (nz > 0 || twoSided) ? '' : 'none';
        return nz;
      }
      const nzTop = place(g.topO, [-WL / 2, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], true);
      g.topO.style.display = nzTop > 0 ? '' : 'none';
      place(g.topI, [-WL / 2, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], true);
      g.topI.style.display = nzTop > 0 ? 'none' : '';
      place(g.left, [-WL / 2, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], false);
      place(g.right, [WL / 2, 0, DL], [0, 0, -1], [0, -1, 0], [1, 0, 0], false);
      place(g.front, [-WL / 2, 0, DL], [1, 0, 0], [0, -1, 0], [0, 0, 1], false);
      // the bow rides on the lid: it stands on the top face and turns away with it
      const an = world([0, 0, DL / 2 - 6]), xa = V.apply(null, R([1, 0, 0])), na = V.apply(null, R([0, 1, 0])), pa = P(an[0], an[1], an[2]);
      g.bow.setAttribute('transform', 'matrix(' + [xa[0], xa[1], -na[0], -na[1], pa[0], pa[1]].map(f1).join(' ') + ')');
      g.bow.style.opacity = f1(clamp(1 - (deg - 52) / 36, 0, 1));
      g.bow.style.display = deg > 92 ? 'none' : '';
    }

    return {
      build: build,
      setLid: setLid,
      toBack: function () { if (backSvg && lidG) backSvg.appendChild(lidG); },
      toFront: function () { if (frontSvg && lidG) frontSvg.appendChild(lidG); },
      rimFront: function () { const p = P(0, H, D / 2); return { x: p[0], y: p[1] }; },
      glowSpots: function () {
        return [P(-W / 2 + 40, H - 40, D / 2), P(W / 2 - 40, H - 40, D / 2), P(-W / 2 + 36, H - 120, D / 2), P(W / 2 - 60, H - 40, D / 2), P(0, 40, D / 2)]
          .map(function (p) { return [p[0] / SVGW * 100, p[1] / SVGH * 100]; });
      }
    };
  })();

  function animateLid(from, to, ms) {
    return new Promise(function (resolve, reject) {
      const t0 = performance.now(), dur = Math.max(1, ms * TS);
      function step(now) {
        if (!alive) { reject(ABORT); return; }
        const k = clamp((now - t0) / dur, 0, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        BX.setLid(from + (to - from) * e);
        if (k < 1) window.requestAnimationFrame(step); else resolve();
      }
      window.requestAnimationFrame(step);
    });
  }

  /* The lid swings open (the box then stays open). Afterwards the lid stands BEHIND the gifts. */
  async function openBox() {
    root.classList.add('is-box-opening');
    await animateLid(0, CONFIG.LID_ANGLE, CONFIG.LID_OPEN_MS);
    BX.toBack();
    root.classList.remove('is-box-opening');
    root.classList.add('is-box-open');
  }

  /* =========================================================
     GEOMETRY
     ========================================================= */
  function seamPoint() {
    const r = el.scene.getBoundingClientRect();
    return { x: r.left + r.width * CONFIG.SEAM_X, y: r.top + r.height * CONFIG.SEAM_Y };
  }

  /* Transforms that put an item "inside the box" (A), "just out of the box" (B) and "in place" (C) */
  function plan(rect) {
    const O = seamPoint();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const h0 = rect.height * CONFIG.START_SCALE;
    const h1 = rect.height * CONFIG.HOVER_SCALE;
    function mk(ty, s) {
      return 'translate(' + (O.x - cx).toFixed(1) + 'px, ' + ty.toFixed(1) + 'px) scale(' + s + ')';
    }
    return {
      A: mk(O.y + h0 / 2 - cy, CONFIG.START_SCALE),               // entirely below the lid line
      B: mk(O.y - h1 / 2 - 26 - cy, CONFIG.HOVER_SCALE),          // entirely above the lid line
      C: 'translate(0px, 0px) scale(1)',
      sealY: O.y,
      origin: O
    };
  }

  /* While "sealed", the gifts layer sits BETWEEN the back and the front of the box:
     the front wall hides the part that is still inside, so the item really comes out of the open mouth */
  function seal(on) {
    el.gifts.classList.toggle('is-sealed', !!on);
  }
  function litSeam(on) { root.classList.toggle('is-seam-lit', !!on); }
  function glow(on) { root.classList.toggle('is-glow', !!on); }

  /* =========================================================
     GOLDEN SPARKLES (small canvas, capped particle count)
     ========================================================= */
  const fx = (function () {
    const cv = $('p4-fx');
    const ctx = cv ? cv.getContext('2d') : null;
    let W = 0, H = 0, dpr = 1;
    let parts = [];
    let raf = 0, last = 0, running = false;
    let amb = false, ambAcc = 0;
    let sprite = null;

    const small = function () { return window.innerWidth < 700; };

    function makeSprite() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,248,222,1)');
      gr.addColorStop(0.25, 'rgba(255,216,134,0.85)');
      gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    function resize() {
      if (!cv) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }

    function add(p) {
      if (REDUCED || !ctx) return;
      if (parts.length >= (small() ? 60 : 110)) return;
      parts.push(p);
      kick();
    }

    function burst(x, y, n) {
      if (REDUCED || !ctx) return;
      const count = small() ? Math.round(n * 0.65) : n;
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
        const sp = 40 + Math.random() * 150;
        add({
          x: x + (Math.random() - 0.5) * 70, y: y + (Math.random() - 0.5) * 8,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          g: 18, life: 0, max: 0.9 + Math.random() * 1.2,
          size: 6 + Math.random() * 12
        });
      }
    }

    function ambientSpawn() {
      const r = el.scene.getBoundingClientRect();
      const b = CONFIG.BOX_AREA;
      add({
        x: r.left + r.width * (b.x0 + Math.random() * (b.x1 - b.x0)),
        y: r.top + r.height * (b.y0 + Math.random() * (b.y1 - b.y0)),
        vx: (Math.random() - 0.5) * 8, vy: -(6 + Math.random() * 16),
        g: 0, life: 0, max: 2.4 + Math.random() * 2.6,
        size: 4 + Math.random() * 8
      });
    }

    function tick(now) {
      raf = 0;
      if (!alive || document.hidden) { running = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (amb) {
        ambAcc += dt * (small() ? 7 : 12);
        while (ambAcc >= 1) { ambAcc -= 1; ambientSpawn(); }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.max;
        const a = Math.sin(Math.PI * k) * 0.85;
        const s = p.size * (0.6 + 0.4 * (1 - k));
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      if (parts.length || amb) {
        raf = window.requestAnimationFrame(tick);
      } else {
        running = false;
        ctx.clearRect(0, 0, W, H);
      }
    }

    function kick() {
      if (running || !alive || !ctx) return;
      if (!sprite) sprite = makeSprite();
      running = true;
      last = performance.now();
      raf = window.requestAnimationFrame(tick);
    }

    return {
      resize: resize,
      burst: burst,
      ambient: function (on) { amb = !!on && !REDUCED; if (amb) kick(); },
      resume: function () { if (parts.length || amb) kick(); },
      destroy: function () { if (raf) window.cancelAnimationFrame(raf); parts = []; running = false; }
    };
  })();

  /* =========================================================
     THE HISTORICAL QUILL (drawn here with SVG)
     Nib tip is at (18, 346) in a 160 x 360 drawing; the feather leans up and to the right.
     ========================================================= */
  const Q = { W: 90, k: 90 / 160, ax: 18 * 90 / 160, ay: 346 * 90 / 160, L: 345 * 90 / 160, BASE: 18.2 };
  const quillEl = $('p4-quill');

  function quillBuild() {
    const svg = $('p4-quill-svg');
    if (!svg) return;
    const P0 = [18, 346], P1 = [42, 250], P2 = [84, 128], P3 = [128, 16];
    function B(t) {
      const u = 1 - t;
      return [
        u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
        u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]
      ];
    }
    function T(t) {
      const u = 1 - t;
      const dx = 3 * u * u * (P1[0] - P0[0]) + 6 * u * t * (P2[0] - P1[0]) + 3 * t * t * (P3[0] - P2[0]);
      const dy = 3 * u * u * (P1[1] - P0[1]) + 6 * u * t * (P2[1] - P1[1]) + 3 * t * t * (P3[1] - P2[1]);
      const m = Math.sqrt(dx * dx + dy * dy) || 1;
      return [dx / m, dy / m];
    }
    function mix(a, b, f) {
      return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
    }
    const stops = [
      [0.24, [118, 86, 34]], [0.42, [52, 120, 88]], [0.66, [24, 128, 120]], [0.86, [150, 150, 70]], [1, [214, 176, 84]]
    ];
    function colorAt(t) {
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const f = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
          return mix(stops[i - 1][1], stops[i][1], clamp(f, 0, 1));
        }
      }
      return stops[stops.length - 1][1];
    }

    const t0 = 0.24, t1 = 0.985, N = 70;
    const left = [], right = [];
    let barbs = '';
    for (let i = 0; i <= N; i++) {
      const t = t0 + (t1 - t0) * (i / N);
      const p = B(t), tg = T(t);
      const nR = [-tg[1], tg[0]];                       // points to the right of the shaft
      const u = (t - t0) / (t1 - t0);
      const len = 3 + 36 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.9) * (1 - 0.12 * u);
      const jit = 1 + 0.12 * Math.sin(i * 12.9898);
      const c = colorAt(t);
      [[1, 1.0], [-1, 0.78]].forEach(function (side) {
        const L = len * side[1] * jit;
        const tip = [p[0] + nR[0] * side[0] * L + tg[0] * L * 0.72, p[1] + nR[1] * side[0] * L + tg[1] * L * 0.72];
        (side[0] === 1 ? right : left).push(tip);
        barbs += '<path d="M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'L' + tip[0].toFixed(1) + ' ' + tip[1].toFixed(1) +
          '" stroke="rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')" stroke-opacity="' + (0.55 + 0.35 * Math.abs(Math.sin(i * 1.7))).toFixed(2) +
          '" stroke-width="' + (1.1 + 0.5 * (1 - u)).toFixed(2) + '" fill="none" stroke-linecap="round"/>';
      });
    }
    const outline = left.concat(right.slice().reverse()).map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');

    const eP = B(0.8), eT = T(0.8);
    const eAng = Math.atan2(eT[1], eT[0]) * 180 / Math.PI + 90;
    const eC = [eP[0] + 5, eP[1] - 1];
    const shaft = 'M' + P0[0] + ' ' + P0[1] + 'C' + P1[0] + ' ' + P1[1] + ',' + P2[0] + ' ' + P2[1] + ',' + P3[0] + ' ' + P3[1];

    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="p4qBody" x1="0" y1="1" x2="0.6" y2="0">' +
          '<stop offset="0" stop-color="#6e5220" stop-opacity=".95"/>' +
          '<stop offset=".4" stop-color="#2f7a58" stop-opacity=".85"/>' +
          '<stop offset=".75" stop-color="#17807a" stop-opacity=".85"/>' +
          '<stop offset="1" stop-color="#d9b552" stop-opacity=".9"/>' +
        '</linearGradient>' +
        '<linearGradient id="p4qShaft" x1="0" y1="1" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#f3e6c2"/><stop offset=".5" stop-color="#d8c493"/><stop offset="1" stop-color="#9c8a55"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<polygon points="' + outline + '" fill="url(#p4qBody)" opacity=".62"/>' +
      barbs +
      '<g transform="translate(' + eC[0].toFixed(1) + ' ' + eC[1].toFixed(1) + ') rotate(' + eAng.toFixed(1) + ')">' +
        '<ellipse rx="14" ry="19" fill="#c9a24a" opacity=".95"/>' +
        '<ellipse rx="11" ry="15.5" fill="#2e8a78"/>' +
        '<ellipse rx="8" ry="11.5" fill="#1b4f86"/>' +
        '<ellipse rx="4.6" ry="6.8" fill="#0d1d3e"/>' +
        '<ellipse cx="-1.4" cy="-2.4" rx="1.6" ry="2.4" fill="#7fd0e0" opacity=".8"/>' +
      '</g>' +
      '<path d="' + shaft + '" fill="none" stroke="#5b4a26" stroke-width="5.2" stroke-linecap="round" opacity=".55"/>' +
      '<path d="' + shaft + '" fill="none" stroke="url(#p4qShaft)" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M18 346C24 322 30 300 36 282" fill="none" stroke="#f7edd2" stroke-width="5.4" stroke-linecap="round"/>' +
      '<path d="M14.5 352L18 346L22 349.5Z" fill="#2a1d0c"/>' +
      '<circle cx="18" cy="346" r="1.7" fill="#d9b552"/>';
  }

  function quillLayout() {
    if (!quillEl) return;
    const W = clamp(Math.min(window.innerWidth, window.innerHeight) * 0.14, 54, 104);   // small enough not to hide the words
    Q.W = W;
    Q.k = W / 160;
    Q.ax = 18 * Q.k;
    Q.ay = 346 * Q.k;
    Q.L = 345 * Q.k;
    quillEl.style.width = W + 'px';
    quillEl.style.height = (W * 360 / 160) + 'px';
    quillEl.style.transformOrigin = Q.ax + 'px ' + Q.ay + 'px';
  }

  /* Puts the nib tip at (x, y). 'a' is the total lean of the feather in degrees. */
  function quillPlace(x, y, a, opacity) {
    // keep the feather inside the screen on the right-hand side
    const sMax = clamp((window.innerWidth - 10 - x) / Q.L, -1, 1);
    const aMax = Math.asin(sMax) * 180 / Math.PI;
    const ang = clamp(Math.min(a, aMax), -24, 40);
    quillEl.style.transform = 'translate(' + (x - Q.ax).toFixed(1) + 'px,' + (y - Q.ay).toFixed(1) + 'px) rotate(' + (ang - Q.BASE).toFixed(2) + 'deg)';
    quillEl.style.opacity = opacity.toFixed(3);
  }

  /* =========================================================
     LETTER: text, scroll, quill writing
     ========================================================= */
  const words = [];
  let segmenter = null;
  try { if (window.Intl && Intl.Segmenter) segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); } catch (e) { segmenter = null; }

  function graphemeCount(s) {
    if (segmenter) { let n = 0; for (const _ of segmenter.segment(s)) n++; return n; }
    return Array.from(s).length;
  }

  /* Every word is laid out in its final place from the start (the page never re-flows);
     words are made visible one by one while the quill writes. */
  function buildText() {
    el.text.textContent = '';
    words.length = 0;
    const paras = String(CONFIG.LETTER_TEXT).replace(/\r/g, '').trim().split(/\n[ \t]*\n/);
    paras.forEach(function (ptxt, pi) {
      const p = document.createElement('p');
      ptxt.split('\n').forEach(function (line, li) {
        if (li > 0) p.appendChild(document.createElement('br'));
        line.trim().split(/\s+/).filter(Boolean).forEach(function (w) {
          const s = document.createElement('span');
          s.className = 'p4-w';
          s.textContent = w;
          p.appendChild(s);
          p.appendChild(document.createTextNode(' '));
          words.push({ el: s, para: pi, n: graphemeCount(w) });
        });
      });
      el.text.appendChild(p);
    });
  }

  function setMask(w, p) {
    const r = w.el.getBoundingClientRect();
    const edge = Math.min(14, r.width * 0.3) / Math.max(1, r.width) * 100;
    const a = (p * (100 + edge)).toFixed(1);
    const b = Math.max(0, p * (100 + edge) - edge).toFixed(1);
    const g = 'linear-gradient(90deg,#000 ' + b + '%,transparent ' + a + '%)';
    w.el.style.webkitMaskImage = g;
    w.el.style.maskImage = g;
    w.el.style.opacity = '1';
  }
  function setDone(w) {
    w.el.style.webkitMaskImage = '';
    w.el.style.maskImage = '';
    w.el.style.opacity = '';
    w.el.classList.add('is-done');
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const timeout = new Promise(function (r) { window.setTimeout(r, 2500); });
    const load = Promise.all([
      document.fonts.load('600 1em "Noto Serif Bengali"', 'অআকখ'),
      document.fonts.load('600 1em "Cormorant Garamond"', 'Abc')
    ]).then(function () { return document.fonts.ready; }).catch(function () {});
    return Promise.race([load, timeout]);
  }

  function rollerH() { return el.rollerT ? el.rollerT.getBoundingClientRect().height : 28; }
  function closedRect() {
    const L = el.letter.getBoundingClientRect();
    return { left: L.left, top: L.top, width: L.width, height: rollerH() * 2 };
  }
  function openDistance() {
    return el.letter.getBoundingClientRect().height - rollerH() * 2;
  }
  function setClosedLook() {
    const D = openDistance();
    el.rollerB.style.transform = 'translateY(' + (-D).toFixed(1) + 'px)';
    el.sheet.style.clipPath = 'inset(0 0 ' + D.toFixed(1) + 'px 0)';
  }

  /* The scroll leaves the box as a small roll, travels beneath the moon, then unrolls to the bottom of the screen */
  async function letterOpen() {
    await fontsReady();
    guard();
    buildText();
    el.reader.scrollTop = 0;

    const R = rollerH();
    el.letter.style.transformOrigin = '50% ' + R + 'px';
    setClosedLook();
    el.letter.classList.add('is-on');
    const P = plan(closedRect());
    el.letter.style.transform = P.A;
    el.letter.style.opacity = '0';
    seal(true, P.sealY);
    fx.burst(P.origin.x, P.origin.y, 26);
    await play(el.letter, [
      { transform: P.A, opacity: 0 },
      { opacity: 1, offset: 0.4 },
      { transform: P.B, opacity: 1 }
    ], CONFIG.RISE_MS, EASE_RISE);

    seal(false);
    await play(el.letter, [{ transform: P.B }, { transform: P.C }], CONFIG.FLY_MS, EASE_FLY);
    el.letter.style.transform = 'none';
    el.letter.style.opacity = '';

    const D = openDistance();
    await Promise.all([
      play(el.rollerB, [{ transform: 'translateY(' + (-D) + 'px)' }, { transform: 'translateY(0px)' }], CONFIG.UNROLL_MS, EASE_SOFT),
      play(el.sheet, [{ clipPath: 'inset(0 0 ' + D + 'px 0)' }, { clipPath: 'inset(0 0 0px 0)' }], CONFIG.UNROLL_MS, EASE_SOFT)
    ]);
    el.rollerB.style.transform = '';
    el.sheet.style.clipPath = 'none';
  }

  async function letterClose() {
    el.reader.style.overflowY = 'hidden';
    const D = openDistance();
    await Promise.all([
      play(el.rollerB, [{ transform: 'translateY(0px)' }, { transform: 'translateY(' + (-D) + 'px)' }], CONFIG.ROLLUP_MS, EASE_SOFT),
      play(el.sheet, [{ clipPath: 'inset(0 0 0px 0)' }, { clipPath: 'inset(0 0 ' + D + 'px 0)' }], CONFIG.ROLLUP_MS, EASE_SOFT)
    ]);
    const R = rollerH();
    el.letter.style.transformOrigin = '50% ' + R + 'px';
    const P = plan(closedRect());
    await play(el.letter, [{ transform: P.C }, { transform: P.B }], CONFIG.RETURN_FLY_MS, EASE_FLY);
    seal(true, P.sealY);
    fx.burst(P.origin.x, P.origin.y, 18);
    await play(el.letter, [
      { transform: P.B, opacity: 1 },
      { opacity: 1, offset: 0.6 },
      { transform: P.A, opacity: 0 }
    ], CONFIG.RETURN_SINK_MS, EASE_RISE);
    el.letter.classList.remove('is-on');
    el.letter.style.transform = '';
    el.letter.style.opacity = '';
    seal(false);
    el.reader.style.overflowY = '';
    el.reader.scrollTop = 0;
  }

  /* The quill enters, writes word by word (the nib follows the edge of the visible text),
     lifts at the end of every line, and flies away when the letter is finished. */
  /* How much faster than normal the letter is written, so the whole letter takes at most WRITE_MAX_MS */
  function writingSpeed() {
    let est = 0, prevTop = null, prevPara = 0;
    words.forEach(function (w, k) {
      est += Math.max(CONFIG.MIN_WORD_MS, w.n * CONFIG.MS_PER_GRAPHEME);
      const top = w.el.getBoundingClientRect().top;
      if (k > 0) {
        if (w.para !== prevPara) est += CONFIG.PARAGRAPH_PAUSE_MS;
        else if (top - prevTop > 4) est += CONFIG.LINE_PAUSE_MS;
        else est += CONFIG.WORD_GAP_MS;
      }
      prevTop = top; prevPara = w.para;
    });
    if (!est) return 1;
    return clamp(CONFIG.WRITE_MAX_MS / est, 0.4, 1);
  }

  function writeLetter() {
    return new Promise(function (resolve, reject) {
      const rd = el.reader;
      const T = function (ms) { return ms * TS; };
      let i = 0;
      let mode = 'enter';
      let modeT = performance.now();
      let wordT0 = 0, wordDur = 0;
      let pauseLine = false;
      let scrollTarget = rd.scrollTop;
      const speedK = writingSpeed();            // long letters are written faster so they do not take too long
      let last = performance.now();
      const rr0 = rd.getBoundingClientRect();
      let qx = window.innerWidth + 70, qy = rr0.top - 50, qa = 34, qo = 0;
      let raf = 0;

      quillEl.style.visibility = 'visible';
      quillPlace(qx, qy, qa, 0);

      function tip(w, p) {
        const r = w.el.getBoundingClientRect();
        return { x: r.left + r.width * p, y: r.top + r.height * 0.66, h: r.height, top: r.top };
      }
      function ensureVisible(w) {
        if (rd.scrollHeight <= rd.clientHeight + 2) return;
        const rr = rd.getBoundingClientRect();
        const r = w.el.getBoundingClientRect();
        // follow the writing line by line: when the line being written passes the middle of the sheet,
        // the sheet moves up by about one line (smooth, no big jumps)
        if (r.bottom > rr.top + rr.height * 0.5) {
          scrollTarget = clamp(rd.scrollTop + (r.top - (rr.top + rr.height * 0.44)), 0, rd.scrollHeight - rd.clientHeight);
        }
      }
      function beginWord() {
        const w = words[i];
        mode = 'word';
        wordT0 = performance.now();
        wordDur = T(Math.max(CONFIG.MIN_WORD_MS, w.n * CONFIG.MS_PER_GRAPHEME) * speedK);
        ensureVisible(w);
      }
      function finish() {
        words.forEach(setDone);
        quillEl.style.visibility = 'hidden';
        quillEl.style.opacity = '0';
        resolve();
      }

      function frame(now) {
        raf = 0;
        if (!alive) { reject(ABORT); return; }
        const dt = Math.min(64, now - last);
        last = now;

        const sd = scrollTarget - rd.scrollTop;
        if (Math.abs(sd) > 0.5) {
          let step = sd * (1 - Math.exp(-dt / (REDUCED ? 60 : 240)));
          // browsers round scrollTop; never let the easing shrink below one pixel per frame
          if (Math.abs(step) < 1) step = Math.sign(sd) * Math.min(1, Math.abs(sd));
          rd.scrollTop += step;
        }

        let tx = qx, ty = qy, ta = Q.BASE + 4, tau = T(95), to = 1;
        const wob = REDUCED ? 0 : 1;

        if (mode === 'enter') {
          const w = words[0];
          const t0 = tip(w, 0);
          tx = t0.x; ty = t0.y - t0.h * 0.9; ta = Q.BASE + 8; tau = T(300);
          ensureVisible(w);
          if (Math.hypot(tx - qx, ty - qy) < 14 || now - modeT > T(1700)) beginWord();
        } else if (mode === 'word') {
          const w = words[i];
          const p = clamp((now - wordT0) / wordDur, 0, 1);
          const t = tip(w, p);
          tx = t.x; ty = t.y + Math.sin(now / 38 * (1 / Math.max(TS, 0.3))) * 1.1 * wob; ta = Q.BASE + 3 + Math.sin(now / 90) * 1.3 * wob;
          setMask(w, p);
          if (p >= 1) {
            setDone(w);
            i++;
            if (i >= words.length) {
              mode = 'end'; modeT = now;
              if (rd.scrollHeight > rd.clientHeight + 2) scrollTarget = rd.scrollHeight - rd.clientHeight;
            } else {
              const nw = words[i];
              const r0 = w.el.getBoundingClientRect();
              const r1 = nw.el.getBoundingClientRect();
              pauseLine = (r1.top - r0.top) > r0.height * 0.5;
              const newPara = nw.para !== w.para;
              mode = 'pause'; modeT = now;
              wordDur = T((newPara ? CONFIG.PARAGRAPH_PAUSE_MS : (pauseLine ? CONFIG.LINE_PAUSE_MS : CONFIG.WORD_GAP_MS)) * speedK);
              ensureVisible(nw);
            }
          }
        } else if (mode === 'pause') {
          const nw = words[i];
          const t = tip(nw, 0);
          tx = t.x; ty = t.y - (pauseLine ? t.h * 0.7 : 0); ta = Q.BASE + (pauseLine ? 9 : 4);
          tau = pauseLine ? T(150) : T(80);
          if (now - modeT >= wordDur) beginWord();
        } else if (mode === 'end') {
          tx = window.innerWidth + 90; ty = rd.getBoundingClientRect().top - 60; ta = Q.BASE + 22; tau = T(420);
          if (now - modeT > T(500)) to = 0;
          const settled = Math.abs(scrollTarget - rd.scrollTop) < 1.5;
          if ((now - modeT > T(1250) && settled) || now - modeT > T(5000)) { finish(); return; }
        }

        const f = 1 - Math.exp(-dt / Math.max(1, tau));
        qx += (tx - qx) * f;
        qy += (ty - qy) * f;
        qa += (ta - qa) * f;
        qo += (to - qo) * (1 - Math.exp(-dt / T(220)));
        quillPlace(qx, qy, qa, qo);
        raf = window.requestAnimationFrame(frame);
      }
      raf = window.requestAnimationFrame(frame);
    });
  }

  /* Minimum reading time, then wait until the last line can be seen. The letter never closes by itself. */
  async function readingPause() {
    el.letter.classList.add('is-readable');
    const readMs = CONFIG.READ_WAIT_MS;
    await sleep(readMs);
    const lastWord = words[words.length - 1];
    function lastVisible() {
      if (!lastWord) return true;
      const rr = el.reader.getBoundingClientRect();
      const r = lastWord.el.getBoundingClientRect();
      return r.bottom <= rr.bottom + 2 && r.top >= rr.top - 2;
    }
    let waited = 0;
    while (!lastVisible() && waited < 1000) {   // normally already true: the sheet ends scrolled to the last line
      await sleep(250);
      waited += 250;
    }
  }

  /* =========================================================
     GIFTS (portrait, hijab): rise out of the box, float to the front, return
     ========================================================= */
  function unitOf(g) {
    const list = g.querySelectorAll('img, .p4-ph, svg');
    for (let k = 0; k < list.length; k++) {
      if (window.getComputedStyle(list[k]).display !== 'none') return list[k];
    }
    return list[0];
  }

  async function giftEnter(item) {
    const g = item.el, fl = item.fl;
    fl.style.transform = 'none';
    fl.style.opacity = '';
    g.classList.add('is-on');
    const P = plan(unitOf(g).getBoundingClientRect());
    fl.style.transform = P.A;
    fl.style.opacity = '0';
    seal(true, P.sealY);
    fx.burst(P.origin.x, P.origin.y, 30);
    await play(fl, [
      { transform: P.A, opacity: 0 },
      { opacity: 1, offset: 0.4 },
      { transform: P.B, opacity: 1 }
    ], CONFIG.RISE_MS, EASE_RISE);
    seal(false);
    await play(fl, [{ transform: P.B }, { transform: P.C }], CONFIG.FLY_MS, EASE_FLY);
    fl.style.transform = 'none';
    g.classList.add('is-shown');
  }

  async function giftExit(item) {
    const g = item.el, fl = item.fl;
    g.classList.remove('is-shown');
    fl.style.transform = 'none';
    const P = plan(unitOf(g).getBoundingClientRect());
    await play(fl, [{ transform: P.C }, { transform: P.B }], CONFIG.RETURN_FLY_MS, EASE_FLY);
    seal(true, P.sealY);
    fx.burst(P.origin.x, P.origin.y, 20);
    await play(fl, [
      { transform: P.B, opacity: 1 },
      { opacity: 1, offset: 0.6 },
      { transform: P.A, opacity: 0 }
    ], CONFIG.RETURN_SINK_MS, EASE_RISE);
    g.classList.remove('is-on');
    fl.style.transform = '';
    fl.style.opacity = '';
    seal(false);
  }

  /* Waits (at most 3 s) for the portrait file; if it is missing a neutral placeholder is shown instead */
  let portraitReady = Promise.resolve();
  function loadPortrait() {
    const img = $('p4-portrait-img');
    portraitReady = new Promise(function (resolve) {
      img.addEventListener('load', function () { resolve(); }, { once: true });
      img.addEventListener('error', function () {
        items.portrait.el.classList.add('is-missing');
        console.warn('[Phase4] Portrait not found: ' + CONFIG.PORTRAIT_SRC + ' (showing a placeholder)');
        resolve();
      }, { once: true });
    });
    img.src = CONFIG.PORTRAIT_SRC;
  }

  /* =========================================================
     SOUND: two files, one voice at a time, nothing before the first click.
     Used for every gift and letter: "reveal" when it leaves the box, "return" when it goes back in.
     ========================================================= */
  const sound = { reveal: null, ret: null, projector: null, current: null, fade: 0 };

  function makeAudio(src, vol) {
    let a = null;
    try {
      a = new Audio();
      a.preload = 'auto';
      a.volume = vol;
      a.__vol = vol;
      a.__bad = false;
      a.addEventListener('error', function () { a.__bad = true; });
      a.src = src;
    } catch (e) { a = null; }
    return a;
  }
  function soundInit() {
    if (sound.reveal) return;               // creating Audio objects does not play anything
    sound.reveal = makeAudio(CONFIG.REVEAL_SRC, CONFIG.REVEAL_VOLUME);
    sound.ret = makeAudio(CONFIG.RETURN_SRC, CONFIG.RETURN_VOLUME);
    sound.projector = makeAudio(CONFIG.PROJECTOR_SRC, CONFIG.PROJECTOR_VOLUME);
  }
  function soundCancelFade() {
    if (sound.fade) { window.clearInterval(sound.fade); sound.fade = 0; }
  }
  function soundStop() {
    soundCancelFade();
    [sound.reveal, sound.ret, sound.projector].forEach(function (a) {
      if (!a) return;
      try { a.pause(); a.currentTime = 0; a.volume = a.__vol; } catch (e) { /* ignore */ }
    });
    sound.current = null;
  }
  /* Called straight from the click handler (a user gesture), so phones allow it */
  function soundPlay(kind) {
    const a = kind === 'reveal' ? sound.reveal : (kind === 'projector' ? sound.projector : sound.ret);
    soundStop();
    if (!a || a.__bad) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* blocked or missing: stay silent */ });
      sound.current = a;
    } catch (e) { /* stay silent */ }
  }
  /* The ending's sound starts by itself (no click), and phones only allow that for a file that was
     "unlocked" during a tap. So the file is started silently and stopped again inside an earlier tap. */
  function soundPrime(kind) {
    const a = kind === 'projector' ? sound.projector : null;
    if (!a || a.__bad || a.__primed) return;
    a.__primed = true;
    try {
      a.muted = true;
      const p = a.play();
      const done = function () {
        if (sound.current !== a) { try { a.pause(); a.currentTime = 0; } catch (e) { /* ignore */ } }
        a.muted = false;
      };
      if (p && typeof p.then === 'function') p.then(done, function () { a.muted = false; a.__primed = false; });
      else done();
    } catch (e) { a.muted = false; }
  }
  /* If a sound is longer than its animation, it is faded out when the animation ends */
  function soundFadeOut() {
    const a = sound.current;
    soundCancelFade();
    if (!a || a.paused || a.ended) { sound.current = null; return; }
    const ms = Math.max(60, CONFIG.SOUND_FADE_MS), t0 = Date.now(), v0 = a.volume;
    sound.fade = window.setInterval(function () {
      const f = Math.min(1, (Date.now() - t0) / ms);
      try { a.volume = Math.max(0, v0 * (1 - f)); } catch (e) { /* ignore */ }
      if (f >= 1) {
        soundCancelFade();
        try { a.pause(); a.currentTime = 0; a.volume = a.__vol; } catch (e) { /* ignore */ }
        if (sound.current === a) sound.current = null;
      }
    }, 30);
  }

  /* =========================================================
     MOON (the only control)
     ========================================================= */
  function setMoonReady(on) {
    moonReady = !!on;
    if (!moon) return;
    moon.classList.toggle('p4-moon-ready', moonReady);
    moon.setAttribute('aria-disabled', moonReady ? 'false' : 'true');
  }

  function adoptMoon(m) {
    if (!m || m === moon) return;
    if (moon) {
      moon.removeEventListener('click', onMoonClick);
      moon.classList.remove('p4-moon-ready');
    }
    if (ownMoon && ownMoon !== m) ownMoon.style.display = 'none';
    moon = m;
    // The earlier stage's own "ready" look is switched off; this stage uses its own classes.
    m.classList.remove('is-ready', 'is-activated');
    m.disabled = false;                         // the earlier stage may have left the moon button disabled
    m.removeAttribute('tabindex');
    m.addEventListener('click', onMoonClick);
  }

  function onMoonClick() {
    if (external || !alive || !moonReady) return;   // ignored while an animation runs, or when Part 2 has taken over
    setMoonReady(false);                         // locked at once: fast repeated clicks cannot get through
    moon.classList.remove('p4-moon-activate');
    void moon.offsetWidth;
    moon.classList.add('p4-moon-activate');
    window.setTimeout(function () { if (moon) moon.classList.remove('p4-moon-activate'); }, 950);

    switch (state) {
      case State.IDLE:               run(doEnter); break;
      case State.READY_FOR_LETTER:   soundPlay('reveal'); run(doLetterOpen); break;
      case State.LETTER_READING:     soundPlay('return'); run(doLetterClose); break;
      case State.READY_FOR_PORTRAIT: soundPlay('reveal'); run(doPortraitEnter); break;
      case State.PORTRAIT_SHOWN:     soundPlay('return'); run(doPortraitExit); break;
      case State.READY_FOR_HIJAB:    soundPlay('reveal'); run(doHijabEnter); break;
      case State.HIJAB_SHOWN:        soundPlay('return'); run(doHijabExit); break;
      default: break;
    }
  }

  /* Runs one step; if something goes wrong the sequence still moves on, so the moon can never stay locked */
  function run(fn) {
    fn().catch(function (e) {
      if (e !== ABORT) console.error('[Phase4]', e);
    });
  }

  /* =========================================================
     THE SEQUENCE
     ========================================================= */
  async function safe(fn) {
    try { await fn(); } catch (e) { if (e === ABORT) throw e; console.error('[Phase4]', e); }
  }

  async function doEnter() {
    setState(State.ENTERING_PART1);
    root.classList.add('is-entered');
    await sleep(CONFIG.SCENE_IN_MS);
    fx.ambient(true);
    setState(State.READY_FOR_LETTER);
    setMoonReady(true);
  }

  async function doLetterOpen() {
    setState(State.BOX_OPENING);
    fx.ambient(false);
    glow(true); litSeam(true);
    await safe(openBox);
    setState(State.LETTER_OPENING);
    await safe(letterOpen);

    glow(false); litSeam(false);
    soundFadeOut();
    setState(State.LETTER_WRITING);
    el.letter.classList.remove('is-readable');
    if (words.length) await safe(writeLetter);

    setState(State.LETTER_READING);
    await safe(readingPause);
    setMoonReady(true);
  }

  async function doLetterClose() {
    setState(State.LETTER_CLOSING);
    glow(true); litSeam(true);
    el.letter.classList.remove('is-readable');
    await safe(letterClose);
    glow(false); litSeam(false);
    soundFadeOut();
    fx.ambient(true);
    setState(State.READY_FOR_PORTRAIT);
    setMoonReady(true);
  }

  async function doPortraitEnter() {
    setState(State.PORTRAIT_ENTERING);
    fx.ambient(false);
    glow(true); litSeam(true);
    await Promise.race([portraitReady, sleep(3000)]);
    await safe(function () { return giftEnter(items.portrait); });
    glow(false); litSeam(false);
    soundFadeOut();
    setState(State.PORTRAIT_SHOWN);
    setMoonReady(true);
  }

  async function doPortraitExit() {
    setState(State.PORTRAIT_RETURNING);
    glow(true); litSeam(true);
    await safe(function () { return giftExit(items.portrait); });
    glow(false); litSeam(false);
    soundFadeOut();
    fx.ambient(true);
    setState(State.READY_FOR_HIJAB);
    setMoonReady(true);
  }

  async function doHijabEnter() {
    setState(State.HIJAB_ENTERING);
    fx.ambient(false);
    glow(true); litSeam(true);
    await safe(function () { return giftEnter(items.hijab); });
    glow(false); litSeam(false);
    soundFadeOut();
    setState(State.HIJAB_SHOWN);
    setMoonReady(true);
  }

  async function doHijabExit() {
    setState(State.HIJAB_RETURNING);
    glow(true); litSeam(true);
    await safe(function () { return giftExit(items.hijab); });
    glow(false); litSeam(false);
    soundFadeOut();
    fx.ambient(true);
    completePart1();
  }

  /* Part 1 ends here. Nothing starts by itself: Part 2 is added later. */
  function completePart1() {
    setState(State.PART1_COMPLETE);
    setMoonReady(false);
    root.classList.add('is-part1-complete');
    if (typeof api.onPart1Complete === 'function') {
      try { api.onPart1Complete(); } catch (e) { console.error('[Phase4] onPart1Complete failed', e); }
    }
    document.dispatchEvent(new CustomEvent('phase4:part1-complete'));
    part2.start();                       // Stage 4 continues with the chocolate (same scene, same moon)
  }

  /* =========================================================
     SET-UP
     ========================================================= */
  function onResize() {
    quillLayout();
    fx.resize();
  }

  function init() {
    if (inited || !root) return;
    inited = true;

    root.style.setProperty('--p4-seam-x', (CONFIG.SEAM_X * 100).toFixed(2) + '%');
    root.style.setProperty('--p4-seam-y', (CONFIG.SEAM_Y * 100).toFixed(2) + '%');
    if (el.probe) {
      const h = el.probe.getBoundingClientRect().height;
      if (h) root.style.setProperty('--p4-safe-b', h + 'px');
    }

    buildBackdrop(el.bgsvg);
    BX.build(el.frontsvg, el.backsvg);
    const rim = BX.rimFront();
    CONFIG.SEAM_X = rim.x / SVGW;
    CONFIG.SEAM_Y = rim.y / SVGH;
    root.style.setProperty('--p4-seam-x', (CONFIG.SEAM_X * 100).toFixed(2) + '%');
    root.style.setProperty('--p4-seam-y', (CONFIG.SEAM_Y * 100).toFixed(2) + '%');
    if (el.spots) {
      el.spots.innerHTML = BX.glowSpots().map(function (p) { return '<i style="left:' + p[0].toFixed(1) + '%;top:' + p[1].toFixed(1) + '%"></i>'; }).join('');
    }

    buildStars();
    quillBuild();
    quillLayout();
    fx.resize();
    loadPortrait();
    soundInit();

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    if (moon) moon.addEventListener('click', onMoonClick);
    setState(State.IDLE);
  }

  function onVisibility() { if (!document.hidden) fx.resume(); }

  const api = {
    CONFIG: CONFIG,
    State: State,
    onPart1Complete: null,

    /* Begin Stage 4. When merged, call this from the Stage 3 moon click: Phase4.start({ moon }) */
    start: function (options) {
      if (!alive) return;
      init();
      if (options && options.moon) adoptMoon(options.moon);
      if (state !== State.IDLE) return;
      setMoonReady(false);
      run(doEnter);
    },

    getState: function () { return state; },

    destroy: function () {
      alive = false;
      timers.forEach(function (id) { window.clearTimeout(id); });
      timers.clear();
      liveAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      liveAnims.clear();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (moon) moon.removeEventListener('click', onMoonClick);
      try { part2.destroy(); } catch (e) { /* ignore */ }
      soundStop();
      fx.destroy();
    }
  };

  /* The helpers Part 2 shares with Part 1 (internal: nothing is exposed on window) */
  const K = {
    el: el, CONFIG: CONFIG, fx: fx, TS: TS, REDUCED: REDUCED, ABORT: ABORT, words: words,
    EASE_RISE: EASE_RISE, EASE_FLY: EASE_FLY, EASE_SOFT: EASE_SOFT,
    play: play, sleep: sleep, guard: guard, safe: safe, run: run, plan: plan, seal: seal,
    glow: glow, litSeam: litSeam, setState: setState, setMoonReady: setMoonReady,
    letterOpen: letterOpen, letterClose: letterClose, writeLetter: writeLetter, readingPause: readingPause,
    root: root, seamPoint: seamPoint, clamp: clamp,
    isAlive: function () { return alive; },
    getMoon: function () { return moon; },
    claim: function (on) { external = !!on; }
  };

  /* =========================================================
     PART 2: Dairy Milk -> pen -> final letter -> cinematic ending
     (same scene, same box, same moon; it starts when the last Part 1 gift has returned)
     ========================================================= */
  const part2 = (function () {
  'use strict';

  /* =========================================================
     ADJUSTABLE SETTINGS
     ========================================================= */
  var CONFIG = {
    /* Assets (relative paths, so they work on GitHub Pages) */
    CHOCOLATE_SRC: './assets/dairy-milk.png',
    PEN_SRC: './assets/premium-pen.png',

    /* Final letter: shown exactly as written (blank line = new paragraph) */
    FINAL_LETTER: "একটু ছোট্ট সারপ্রাইজ, শুধু তোর জন্য ❤️\n\nউপহারগুলো হয়তো খুব সাধারণ, কিন্তু এগুলোর পেছনে আছে অনেক আন্তরিকতা আর তোর জন্য একটুখানি যত্ন। তুই আমার বোনের থেকে কোনো অংশে কম নয়😊। A sister From another mother😊🌼.\n\nতোর মুখে হাসি ফুটুক, তোর প্রতিটি দিন সুন্দর হোক। আমাদের বন্ধুত্বটা যেন সবসময় এমনই সুন্দর থাকে (ইন শা আল্লাহ)। 🌸\n\nভালো থাকিস, হাসিখুশি থাকিস।\n\nশুভ জন্মদিন(ইং শা আল্লহ), Anika ❤️",

    /* Ending: the three lines, exactly as written. "✨" is drawn as a little star shape. */
    END_TITLE: 'The End',
    END_SUB: 'A little world, made just for you.',
    END_WISH: 'May your days always be filled with happiness, Anika. ',
    END_WISH_STAR: '✨',

    /* Pen and chocolate: start / hover tilt (degrees) while leaving the box */
    CHOC_TILT: [-10, -5],
    PEN_TILT: [-26, -14],

    /* Ending timing (milliseconds; scaled by the same time scale as Part 1) */
    END_GLOW_MS: 3000,
    END_LIGHT_MS: 2000,
    END_BEAM_MS: 2500,
    END_SWIRL_MS: 2000,
    END_GATHER_MS: 2600,
    END_TEXT_STAGGER_MS: 650,
    END_SETTLE_MS: 1800,
    PARTICLES_SMALL: 70,
    PARTICLES_LARGE: 120
  };

  var State = {
    WAITING: 'P2_WAITING',
    READY_FOR_CHOCOLATE: 'READY_FOR_CHOCOLATE',
    CHOCOLATE_ENTERING: 'CHOCOLATE_ENTERING',
    CHOCOLATE_SHOWN: 'CHOCOLATE_SHOWN',
    CHOCOLATE_RETURNING: 'CHOCOLATE_RETURNING',
    READY_FOR_PEN: 'READY_FOR_PEN',
    PEN_ENTERING: 'PEN_ENTERING',
    PEN_SHOWN: 'PEN_SHOWN',
    PEN_RETURNING: 'PEN_RETURNING',
    READY_FOR_FINAL_LETTER: 'READY_FOR_FINAL_LETTER',
    FINAL_LETTER_OPENING: 'FINAL_LETTER_OPENING',
    FINAL_LETTER_WRITING: 'FINAL_LETTER_WRITING',
    FINAL_LETTER_READING: 'FINAL_LETTER_READING',
    FINAL_LETTER_CLOSING: 'FINAL_LETTER_CLOSING',
    ENDING_GLOW: 'ENDING_GLOW',
    ENDING_LIGHT: 'ENDING_LIGHT',
    ENDING_BEAM: 'ENDING_BEAM',
    ENDING_PARTICLES: 'ENDING_PARTICLES',
    ENDING_TEXT: 'ENDING_TEXT',
    ENDING_COMPLETE: 'ENDING_COMPLETE'
  };

  /* =========================================================
     BASICS
     ========================================================= */
  var root = K.root;
  var el = K.el;
  var REDUCED = K.REDUCED;
  var ABORT = K.ABORT;
  var state = State.WAITING;
  var started = false;
  var dead = false;
  var moon = null;
  var built = false;
  var ending = false;
  var cleanups = [];
  var imgReady = {};

  function setState(s) { state = s; K.setState(s); }
  function alive() { return !dead && K.isAlive(); }
  function mk(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function sleep(ms) { return K.sleep(ms); }

  /* =========================================================
     BUILD (own DOM, added once)
     ========================================================= */
  var items = {};
  var under, over, halo, beam, beamCore, fxCanvas, msg, lTitle, lSub, lWish;

  function makeGift(id, cls, src, alt) {
    var g = mk('div', 'p4-gift p4p2-gift ' + cls, el.gifts);
    g.id = id;
    g.setAttribute('aria-hidden', 'true');
    var fl = mk('div', 'p4-gift-float', g);
    var img = mk('img', '', fl);
    img.alt = alt;
    img.decoding = 'async';
    img.draggable = false;
    mk('div', 'p4p2-ph', fl);
    imgReady[id] = new Promise(function (resolve) {
      img.addEventListener('load', function () { resolve(true); }, { once: true });
      img.addEventListener('error', function () { g.classList.add('is-missing'); resolve(false); }, { once: true });
    });
    img.src = src;
    return { el: g, fl: fl, img: img, id: id };
  }

  function build() {
    if (built) return;
    built = true;

    items.choc = makeGift('p4p2-choc', 'p4p2-gift--choc', CONFIG.CHOCOLATE_SRC, 'Cadbury Dairy Milk chocolate');
    items.pen = makeGift('p4p2-pen', 'p4p2-gift--pen', CONFIG.PEN_SRC, 'A black and gold pen');

    under = mk('div', 'p4p2-under', root);
    under.setAttribute('aria-hidden', 'true');
    halo = mk('div', 'p4p2-halo', under);
    beam = mk('div', 'p4p2-beam', under);
    beamCore = mk('div', 'p4p2-beam-core', under);

    over = mk('div', 'p4p2-over', root);
    fxCanvas = mk('canvas', 'p4p2-fx', over);
    fxCanvas.setAttribute('aria-hidden', 'true');

    msg = mk('div', 'p4p2-msg', over);
    msg.setAttribute('role', 'status');
    lTitle = mk('h2', 'p4p2-line p4p2-line--title', msg);
    lTitle.textContent = CONFIG.END_TITLE;
    lSub = mk('p', 'p4p2-line p4p2-line--sub', msg);
    lSub.textContent = CONFIG.END_SUB;
    lWish = mk('p', 'p4p2-line p4p2-line--wish', msg);
    lWish.appendChild(document.createTextNode(CONFIG.END_WISH));
    var star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('class', 'p4p2-star');
    star.setAttribute('viewBox', '0 0 24 24');
    star.setAttribute('aria-hidden', 'true');
    star.setAttribute('focusable', 'false');
    star.innerHTML = '<path fill="#f8dd9b" d="M12 1.2l2.1 8.7 8.7 2.1-8.7 2.1L12 22.8l-2.1-8.7L1.2 12l8.7-2.1z"/>' +
      '<path fill="#fff4cf" d="M12 6.2l1 4.8 4.8 1-4.8 1-1 4.8-1-4.8-4.8-1 4.8-1z"/>';
    lWish.appendChild(star);
    var sr = mk('span', 'p4p2-sr', lWish);
    sr.textContent = CONFIG.END_WISH_STAR;
  }

  /* =========================================================
     GIFTS: same flight as Part 1 (rise out of the open mouth, float to the front, return)
     ========================================================= */
  function unit(g) { return g.querySelector('img') || g; }

  function rotateOf(tilt, i) { return ' rotate(' + tilt[i] + 'deg)'; }

  async function giftEnter(it, tilt) {
    var g = it.el, fl = it.fl;
    fl.style.transform = 'none';
    fl.style.opacity = '';
    g.classList.add('is-on');
    var P = K.plan(g.classList.contains('is-missing') ? g.querySelector('.p4p2-ph').getBoundingClientRect() : unit(g).getBoundingClientRect());
    var A = P.A + rotateOf(tilt, 0), B = P.B + rotateOf(tilt, 1), C = 'translate(0px, 0px) scale(1) rotate(0deg)';
    fl.style.transform = A;
    fl.style.opacity = '0';
    K.seal(true);
    K.fx.burst(P.origin.x, P.origin.y, 28);
    await K.play(fl, [
      { transform: A, opacity: 0 },
      { opacity: 1, offset: 0.4 },
      { transform: B, opacity: 1 }
    ], K.CONFIG.RISE_MS, K.EASE_RISE);
    K.seal(false);
    await K.play(fl, [{ transform: B }, { transform: C }], K.CONFIG.FLY_MS, K.EASE_FLY);
    fl.style.transform = 'none';
    g.classList.add('is-shown');
  }

  async function giftExit(it, tilt) {
    var g = it.el, fl = it.fl;
    g.classList.remove('is-shown');
    fl.style.transform = 'none';
    var P = K.plan(g.classList.contains('is-missing') ? g.querySelector('.p4p2-ph').getBoundingClientRect() : unit(g).getBoundingClientRect());
    var A = P.A + rotateOf(tilt, 0), B = P.B + rotateOf(tilt, 1), C = 'translate(0px, 0px) scale(1) rotate(0deg)';
    await K.play(fl, [{ transform: C }, { transform: B }], K.CONFIG.RETURN_FLY_MS, K.EASE_FLY);
    K.seal(true);
    K.fx.burst(P.origin.x, P.origin.y, 18);
    await K.play(fl, [
      { transform: B, opacity: 1 },
      { opacity: 1, offset: 0.6 },
      { transform: A, opacity: 0 }
    ], K.CONFIG.RETURN_SINK_MS, K.EASE_RISE);
    g.classList.remove('is-on');
    fl.style.transform = '';
    fl.style.opacity = '';
    K.seal(false);
  }

  /* =========================================================
     THE STEPS (one click = one step; the moon is locked while a step runs)
     ========================================================= */
  function lit(on) { K.glow(on); K.litSeam(on); }

  async function stepGiftEnter(it, tilt, enterState, shownState) {
    setState(enterState);
    K.fx.ambient(false);
    lit(true);
    await Promise.race([imgReady[it.id] || Promise.resolve(), sleep(3000)]);
    await K.safe(function () { return giftEnter(it, tilt); });
    lit(false);
    soundFadeOut();
    setState(shownState);
    K.setMoonReady(true);
  }

  async function stepGiftExit(it, tilt, returnState, nextState) {
    setState(returnState);
    lit(true);
    await K.safe(function () { return giftExit(it, tilt); });
    lit(false);
    K.fx.ambient(true);
    soundFadeOut();
    setState(nextState);
    K.setMoonReady(true);
  }

  async function stepLetterOpen() {
    setState(State.FINAL_LETTER_OPENING);
    K.fx.ambient(false);
    lit(true);
    K.CONFIG.LETTER_TEXT = CONFIG.FINAL_LETTER;
    await K.safe(K.letterOpen);
    lit(false);
    soundFadeOut();
    setState(State.FINAL_LETTER_WRITING);
    el.letter.classList.remove('is-readable');
    if (K.words.length) await K.safe(K.writeLetter);
    setState(State.FINAL_LETTER_READING);
    await K.safe(K.readingPause);
    K.setMoonReady(true);
  }

  async function stepLetterClose() {
    setState(State.FINAL_LETTER_CLOSING);
    lit(true);
    el.letter.classList.remove('is-readable');
    await K.safe(K.letterClose);
    soundFadeOut();
    /* The letter is back in the box: the ending starts by itself, no further click */
    await endingRun();
  }

  function run(fn) {
    fn().catch(function (e) {
      if (e !== ABORT && window.console) console.error('[Phase4Part2]', e);
    });
  }

  /* =========================================================
     MOON (the only control)
     ========================================================= */
  function onMoonClick() {
    if (!alive() || ending) return;
    var ready = moon && moon.classList.contains('p4-moon-ready');
    if (!ready) return;                           // ignored while an animation is running
    K.setMoonReady(false);                        // locked at once: rapid clicks cannot get through
    moon.classList.remove('p4-moon-activate');
    void moon.offsetWidth;
    moon.classList.add('p4-moon-activate');
    window.setTimeout(function () { if (moon) moon.classList.remove('p4-moon-activate'); }, 950);

    switch (state) {
      case State.READY_FOR_CHOCOLATE:
        soundPlay('reveal');
        run(function () { return stepGiftEnter(items.choc, CONFIG.CHOC_TILT, State.CHOCOLATE_ENTERING, State.CHOCOLATE_SHOWN); });
        break;
      case State.CHOCOLATE_SHOWN:
        soundPlay('return');
        run(function () { return stepGiftExit(items.choc, CONFIG.CHOC_TILT, State.CHOCOLATE_RETURNING, State.READY_FOR_PEN); });
        break;
      case State.READY_FOR_PEN:
        soundPlay('reveal');
        run(function () { return stepGiftEnter(items.pen, CONFIG.PEN_TILT, State.PEN_ENTERING, State.PEN_SHOWN); });
        break;
      case State.PEN_SHOWN:
        soundPlay('return');
        run(function () { return stepGiftExit(items.pen, CONFIG.PEN_TILT, State.PEN_RETURNING, State.READY_FOR_FINAL_LETTER); });
        break;
      case State.READY_FOR_FINAL_LETTER:
        soundPlay('reveal');
        soundPrime('projector');
        run(stepLetterOpen);
        break;
      case State.FINAL_LETTER_READING:
        soundPlay('return');
        soundPrime('projector');
        run(stepLetterClose);
        break;
      default:
        K.setMoonReady(false);
        break;
    }
  }

  /* =========================================================
     ENDING: glow -> warm light -> beam -> swirling gold -> message -> calm
     ========================================================= */
  var region = { x: 0, y: 0, w: 0, h: 0 };
  var seam = { x: 0, y: 0 };
  var lidTop = 0;

  function lockMoonForever() {
    ending = true;
    K.setMoonReady(false);
    if (moon) {
      moon.classList.remove('p4-moon-activate');
      moon.classList.add('p4p2-moon-off');
      moon.setAttribute('aria-disabled', 'true');
      moon.setAttribute('tabindex', '-1');
    }
  }

  /* Where the message may sit: the open sky between the moon and the box
     (on a wide, low screen: the free area beside the box) */
  function measureEnding() {
    var W = window.innerWidth, H = window.innerHeight;
    var sp = K.seamPoint();
    seam.x = sp.x; seam.y = sp.y;
    var mr = moon ? moon.getBoundingClientRect() : { top: 0, bottom: H * 0.3, left: W / 2, right: W / 2 };
    var lid = document.getElementById('p4b-lid');
    var sc = el.scene.getBoundingClientRect();
    lidTop = lid ? lid.getBoundingClientRect().top : sc.top + sc.height * 0.3;
    if (!(lidTop > mr.bottom)) lidTop = seam.y - sc.height * 0.2;

    var landscape = W > H * 1.15;                  // wide screen: the message sits beside the box
    if (landscape) {
      var left = 18, right = Math.max(left + 180, sc.left + sc.width * 0.12 - 8);
      region.x = left; region.w = right - left;
      region.y = 14; region.h = H - 28;
    } else {
      region.x = 16; region.w = W - 32;
      region.y = mr.bottom + 8;
      region.h = Math.max(70, lidTop - 8 - region.y);
    }
  }

  function fitMessage() {
    msg.style.left = region.x + 'px';
    msg.style.top = region.y + 'px';
    msg.style.width = region.w + 'px';
    msg.style.height = region.h + 'px';
    var fs = Math.min(26, Math.max(15, Math.min(window.innerWidth, 760) * 0.048));
    msg.classList.add('is-laid-out');
    for (var i = 0; i < 30; i++) {
      msg.style.setProperty('--p4p2-fs', fs.toFixed(1) + 'px');
      var inner = 0;
      [lTitle, lSub, lWish].forEach(function (n) { inner += n.getBoundingClientRect().height; });
      var wide = Math.max(lTitle.scrollWidth, lSub.scrollWidth, lWish.scrollWidth);
      if ((inner <= region.h - 4 && wide <= region.w + 1) || fs <= 11) break;
      fs -= 0.8;
    }
  }

  function layoutEnding() {
    measureEnding();
    fitMessage();

    var W = window.innerWidth, H = window.innerHeight;
    var topY = Math.min(region.y + 4, seam.y - 60);
    var bw = Math.max(70, Math.min(W * 0.26, 200));
    beam.style.left = (seam.x - bw / 2) + 'px';
    beam.style.width = bw + 'px';
    beam.style.top = topY + 'px';
    beam.style.height = Math.max(40, seam.y - topY) + 'px';
    var cw = bw * 0.34;
    beamCore.style.left = (seam.x - cw / 2) + 'px';
    beamCore.style.width = cw + 'px';
    beamCore.style.top = topY + 'px';
    beamCore.style.height = Math.max(40, seam.y - topY) + 'px';
    beamCore.style.clipPath = 'polygon(30% 100%, 70% 100%, 100% 0, 0 0)';

    var sc = el.scene.getBoundingClientRect();
    var hw = sc.width * 0.95, hh = sc.height * 0.34;
    halo.style.left = (seam.x - hw / 2) + 'px';
    halo.style.width = hw + 'px';
    halo.style.top = (seam.y - hh * 0.62) + 'px';
    halo.style.height = hh + 'px';

    sizeCanvas();
  }

  /* ---- particles ---- */
  var cv = { ctx: null, w: 0, h: 0, dpr: 1, raf: 0, parts: [], sprite: null, phase: 'idle', t0: 0, fade: 1 };

  function sizeCanvas() {
    var W = window.innerWidth, H = window.innerHeight;
    cv.dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    fxCanvas.width = Math.round(W * cv.dpr);
    fxCanvas.height = Math.round(H * cv.dpr);
    cv.w = W; cv.h = H;
    cv.ctx = fxCanvas.getContext('2d');
  }
  function makeSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = 48;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, 'rgba(255,246,214,1)');
    g.addColorStop(0.28, 'rgba(255,214,130,0.75)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 48, 48);
    return c;
  }

  /* Points that lie on the letters of the message (text is drawn once, off-screen, at the
     place where the real lines will appear) */
  function textTargets(n) {
    var off = document.createElement('canvas');
    off.width = cv.w; off.height = cv.h;
    var x = off.getContext('2d');
    x.fillStyle = '#000';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    [lTitle, lSub, lWish].forEach(function (node) {
      var cs = window.getComputedStyle(node);
      var r = node.getBoundingClientRect();
      var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      var lines = Math.max(1, Math.round(r.height / lh));
      var text = node.textContent.replace(/✨/g, '').replace(/\s+/g, ' ').trim();
      x.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var words = text.split(' '), row = '', rows = [];
      words.forEach(function (w) {
        var t = row ? row + ' ' + w : w;
        if (x.measureText(t).width > r.width && row) { rows.push(row); row = w; } else row = t;
      });
      if (row) rows.push(row);
      var top = r.top + (r.height - rows.length * lh) / 2;
      rows.forEach(function (rw, i) { x.fillText(rw, r.left + r.width / 2, top + (i + 0.5) * lh); });
    });
    var img = x.getImageData(0, 0, off.width, off.height).data;
    var pts = [], step = 2;
    for (var yy = 0; yy < off.height; yy += step) {
      for (var xx = 0; xx < off.width; xx += step) {
        if (img[(yy * off.width + xx) * 4 + 3] > 140) pts.push([xx, yy]);
      }
    }
    for (var i = pts.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pts[i]; pts[i] = pts[j]; pts[j] = tmp;
    }
    if (!pts.length) pts.push([region.x + region.w / 2, region.y + region.h / 2]);
    var out = [];
    for (var k = 0; k < n; k++) out.push(pts[k % pts.length]);
    return out;
  }

  function makeParticles() {
    var n = window.innerWidth < 700 ? CONFIG.PARTICLES_SMALL : CONFIG.PARTICLES_LARGE;
    var T = textTargets(n);
    var rad = Math.max(30, Math.min(cv.w * 0.16, 90));
    cv.parts = [];
    for (var i = 0; i < n; i++) {
      cv.parts.push({
        a: Math.random() * Math.PI * 2,
        w: (0.8 + Math.random() * 1.4) * (Math.random() < 0.5 ? 1 : -1),
        r: rad * (0.15 + Math.random() * 0.85),
        h: Math.random(),
        v: 0.16 + Math.random() * 0.2,
        size: 7 + Math.random() * 9,
        delay: Math.random() * 0.6,
        tx: T[i][0], ty: T[i][1],
        gd: Math.random() * 0.4, gs: 0.7 + Math.random() * 0.3,
        side: (Math.random() - 0.5) * 2,
        sx: 0, sy: 0, x: seam.x, y: seam.y, alpha: 0, tw: Math.random() * 6.28
      });
    }
  }

  function swirlPos(p, t) {
    var top = region.y + region.h * 0.5;
    var span = Math.max(40, seam.y - top);
    var h = (p.h + t * p.v) % 1;
    var spread = 0.35 + 0.65 * h;
    p.x = seam.x + Math.sin(p.a + t * p.w * 3.2) * p.r * spread;
    p.y = seam.y - h * span;
    p.alpha = Math.min(1, Math.max(0, (t - p.delay) * 2.2)) * (h < 0.1 ? h * 10 : (h > 0.9 ? (1 - h) * 10 : 1));
  }

  function drawParticles(now) {
    cv.raf = 0;
    if (!alive()) return;
    var ctx = cv.ctx;
    if (!ctx) return;
    var t = (now - cv.t0) / 1000;
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    ctx.clearRect(0, 0, cv.w, cv.h);
    ctx.globalCompositeOperation = 'lighter';
    var swirlS = (CONFIG.END_SWIRL_MS * K.TS) / 1000;
    var gatherS = (CONFIG.END_GATHER_MS * K.TS) / 1000;
    var any = false;
    cv.parts.forEach(function (p) {
      var a = 0, s = p.size;
      if (cv.phase === 'swirl') {
        swirlPos(p, t);
        a = p.alpha;
      } else if (cv.phase === 'gather') {
        var g = (t - cv.gt0 - p.gd * gatherS * 0.5) / (gatherS * p.gs);
        if (g < 0) { swirlPos(p, t); a = p.alpha; p.sx = p.x; p.sy = p.y; }
        else {
          var u = Math.min(1, g);
          var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          var cx = (p.sx + p.tx) / 2 + p.side * 70, cy = Math.min(p.sy, p.ty) - 30 - Math.abs(p.side) * 30;
          var m = 1 - e;
          p.x = m * m * p.sx + 2 * m * e * cx + e * e * p.tx;
          p.y = m * m * p.sy + 2 * m * e * cy + e * e * p.ty;
          a = 0.45 + 0.55 * u;
          s = p.size * (1 - 0.45 * u);
          if (u >= 1) { p.tw += 0.05; a = 0.7 + 0.3 * Math.sin(p.tw * 3); s = p.size * 0.5; }
        }
      } else if (cv.phase === 'rest') {
        p.tw += 0.05;
        a = (0.7 + 0.3 * Math.sin(p.tw * 3)) * cv.fade;
        s = p.size * 0.5;
      }
      if (a > 0.01) {
        any = true;
        ctx.globalAlpha = Math.min(1, a) * 0.9;
        ctx.drawImage(cv.sprite, p.x - s, p.y - s, s * 2, s * 2);
      }
    });
    ctx.globalAlpha = 1;
    if (cv.phase !== 'idle' && (any || cv.phase === 'swirl' || cv.phase === 'gather')) {
      cv.raf = window.requestAnimationFrame(drawParticles);
    } else {
      ctx.clearRect(0, 0, cv.w, cv.h);
    }
  }
  function particlesPhase(ph) {
    cv.phase = ph;
    if (ph === 'swirl') { cv.t0 = performance.now(); cv.gt0 = 0; }
    if (ph === 'gather') cv.gt0 = (performance.now() - cv.t0) / 1000;
    if (!cv.raf) cv.raf = window.requestAnimationFrame(drawParticles);
  }
  function particlesStop() {
    cv.phase = 'idle';
    if (cv.raf) { window.cancelAnimationFrame(cv.raf); cv.raf = 0; }
    if (cv.ctx) { cv.ctx.setTransform(1, 0, 0, 1, 0, 0); cv.ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height); }
  }

  async function endingRun() {
    if (ending) return;
    lockMoonForever();
    var T = K.TS;
    setState(State.ENDING_GLOW);
    K.fx.ambient(false);
    layoutEnding();
    cv.sprite = cv.sprite || makeSprite();
    root.classList.add('p4p2-ornaments');
    K.glow(true); K.litSeam(true);
    await sleep(CONFIG.END_GLOW_MS);

    setState(State.ENDING_LIGHT);
    halo.classList.add('is-on');
    await sleep(CONFIG.END_LIGHT_MS);

    setState(State.ENDING_BEAM);
    soundPlay('projector');                          // the sound swells with the rising light (its loud part is about 0.7 s - 2.5 s in)
    layoutEnding();                                   // measure again (the window may have changed)
    beam.style.opacity = '1';
    beamCore.style.opacity = '0.9';
    /* reveal from the box upwards by animating a mask (works with the trapezoid shape) */
    [beam, beamCore].forEach(function (b) {
      b.style.webkitMaskImage = 'linear-gradient(0deg,#000 0%,#000 var(--p4p2-r,0%),transparent calc(var(--p4p2-r,0%) + 18%))';
      b.style.maskImage = b.style.webkitMaskImage;
    });
    await growBeam(CONFIG.END_BEAM_MS);
    [beam, beamCore].forEach(function (b) { b.style.webkitMaskImage = ''; b.style.maskImage = ''; });

    if (!REDUCED) {
      setState(State.ENDING_PARTICLES);
      makeParticles();
      particlesPhase('swirl');
      await sleep(CONFIG.END_SWIRL_MS);
    }

    setState(State.ENDING_TEXT);
    if (!REDUCED) {
      particlesPhase('gather');
      await sleep(CONFIG.END_GATHER_MS * 0.78);
    }
    [lTitle, lSub, lWish].forEach(function (n, i) {
      window.setTimeout(function () { if (alive()) n.classList.add('is-in'); }, i * CONFIG.END_TEXT_STAGGER_MS * T);
    });
    await sleep(CONFIG.END_TEXT_STAGGER_MS * 2 + 1500);
    if (!REDUCED) {
      particlesPhase('rest');
      await fadeParticles(1400);
      particlesStop();
    }

    beamCore.style.transition = 'opacity 2.4s ease';
    beam.style.transition = 'opacity 2.4s ease';
    beamCore.style.opacity = '0';
    beam.style.opacity = '0.28';
    halo.classList.remove('is-on');
    halo.classList.add('is-calm', 'is-on');
    root.classList.add('p4p2-ornaments-calm');
    await sleep(CONFIG.END_SETTLE_MS);
    setState(State.ENDING_COMPLETE);
    root.classList.add('is-p4p2-complete');
    document.dispatchEvent(new CustomEvent('phase4:part2-complete'));
  }

  function growBeam(ms) {
    return new Promise(function (resolve, reject) {
      var t0 = performance.now(), dur = Math.max(1, ms * K.TS);
      function f(now) {
        if (!alive()) { reject(ABORT); return; }
        var u = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - u, 2.2);
        var pct = (e * 100).toFixed(1) + '%';
        beam.style.setProperty('--p4p2-r', pct);
        beamCore.style.setProperty('--p4p2-r', pct);
        if (u < 1) window.requestAnimationFrame(f); else resolve();
      }
      window.requestAnimationFrame(f);
    });
  }
  function fadeParticles(ms) {
    return new Promise(function (resolve, reject) {
      var t0 = performance.now(), dur = Math.max(1, ms * K.TS);
      function f(now) {
        if (!alive()) { reject(ABORT); return; }
        var u = Math.min(1, (now - t0) / dur);
        cv.fade = 1 - u;
        if (u < 1) window.requestAnimationFrame(f); else resolve();
      }
      cv.fade = 1;
      window.requestAnimationFrame(f);
    });
  }

  /* =========================================================
     START / RESIZE / CLEAN-UP
     ========================================================= */
  function onResize() {
    if (!built) return;
    if (ending) {
      measureEnding();
      fitMessage();
      var sc = el.scene.getBoundingClientRect();
      var topY = Math.min(region.y + 4, seam.y - 60);
      var bw = Math.max(70, Math.min(window.innerWidth * 0.26, 200));
      beam.style.left = (seam.x - bw / 2) + 'px'; beam.style.width = bw + 'px';
      beam.style.top = topY + 'px'; beam.style.height = Math.max(40, seam.y - topY) + 'px';
      var cw = bw * 0.34;
      beamCore.style.left = (seam.x - cw / 2) + 'px'; beamCore.style.width = cw + 'px';
      beamCore.style.top = topY + 'px'; beamCore.style.height = Math.max(40, seam.y - topY) + 'px';
      var hw = sc.width * 0.95, hh = sc.height * 0.34;
      halo.style.left = (seam.x - hw / 2) + 'px'; halo.style.width = hw + 'px';
      halo.style.top = (seam.y - hh * 0.62) + 'px'; halo.style.height = hh + 'px';
      if (cv.phase === 'idle') sizeCanvas();
    }
  }

  function start() {
    if (started || dead) return;
    started = true;
    moon = K.getMoon();
    build();
    K.claim(true);                                    // Part 2 handles the moon from now on
    moon.addEventListener('click', onMoonClick);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    cleanups.push(function () {
      moon.removeEventListener('click', onMoonClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    });
    setState(State.READY_FOR_CHOCOLATE);
    K.fx.ambient(true);
    window.setTimeout(function () { if (alive() && state === State.READY_FOR_CHOCOLATE) K.setMoonReady(true); }, 700 * K.TS);
  }

  function destroy() {
    dead = true;
    soundStop();
    particlesStop();
    cleanups.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    cleanups = [];
    [items.choc && items.choc.el, items.pen && items.pen.el, under, over].forEach(function (n) {
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    K.claim(false);
  }

  var api = {
    CONFIG: CONFIG,
    State: State,
    start: start,
    getState: function () { return state; },
    destroy: destroy
  };
  return api;
  })();

  api.part2 = part2;
  window.Phase4 = api;

  // Standalone test page: set up at once; the moon starts "ready" (it stands for the Stage 3 click)
  if (root && !root.hasAttribute('data-embedded')) {
    init();
    setMoonReady(true);
  }
})();