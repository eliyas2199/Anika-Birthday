(function () {
  'use strict';

  /* =========================================================
     CONSTANTS
     ========================================================= */
  const NS = 'http://www.w3.org/2000/svg';
  const CX = 350;               // clock centre (shared SVG coordinate system)
  const CY = 320;
  const SEQUENCE_MS = 5000;     // exact length of the countdown
  const FADE_DELAY_MS = 1400;   // must match --fade-delay in style.css
  const FADE_MS = 3600;         // must match --fade-time in style.css
  const PHASE2_DELAY_MS = 600;  // quiet dark beat between the cake fading out and Phase 2 starting

  const State = Object.freeze({
    INTRO: 'INTRO',
    CLOCK_RUNNING: 'CLOCK_RUNNING',
    MIDNIGHT: 'MIDNIGHT',
    PHASE_ONE_COMPLETE: 'PHASE_ONE_COMPLETE'
  });
  let state = State.INTRO;

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Simulated time, in minutes. 12:00 === 720.
  const START_MINUTES = reducedMotion ? 690 : 540;   // 11:30  /  09:00
  const END_MINUTES = 720;                           // 12:00

  /* =========================================================
     SMALL SVG HELPERS
     ========================================================= */
  const $ = (id) => document.getElementById(id);
  const rad = (d) => (d * Math.PI) / 180;
  const f = (n) => Math.round(n * 100) / 100;

  function svgEl(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      for (const key in attrs) node.setAttribute(key, attrs[key]);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  // angle a: degrees clockwise from 12 o'clock
  function polar(cx, cy, r, a) {
    return [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))];
  }
  const onTop = (r, a) => polar(CX, CY, r, a);

  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* =========================================================
     DECORATION BUILDERS
     ========================================================= */
  function pearl(parent, x, y, r) {
    svgEl('circle', {
      cx: f(x), cy: f(y), r: r,
      fill: 'url(#pearl)', stroke: 'rgba(120,80,40,.35)', 'stroke-width': 0.4
    }, parent);
  }

  function rose(parent, x, y, s, grad) {
    const g = svgEl('g', { transform: 'translate(' + f(x) + ' ' + f(y) + ')' }, parent);
    svgEl('ellipse', {
      cx: 0, cy: f(s * 0.22), rx: f(s * 1.02), ry: f(s * 0.9),
      fill: 'rgba(30,8,30,.35)'
    }, g);
    svgEl('circle', { r: s, fill: 'url(#' + grad + ')' }, g);

    const rings = [[0.82, 20], [0.6, 140], [0.4, 260], [0.2, 80]];
    rings.forEach(function (pair) {
      const k = pair[0];
      const len = 2 * Math.PI * s * k;
      svgEl('circle', {
        r: f(s * k), fill: 'none',
        stroke: 'rgba(20,0,25,.3)', 'stroke-width': 1.1,
        'stroke-dasharray': f(len * 0.55) + ' ' + f(len * 0.45),
        transform: 'rotate(' + pair[1] + ')'
      }, g);
      svgEl('circle', {
        r: f(s * k * 0.93), fill: 'none',
        stroke: 'rgba(255,255,255,.22)', 'stroke-width': 0.9,
        'stroke-dasharray': f(len * 0.3) + ' ' + f(len * 0.7),
        transform: 'rotate(' + (pair[1] + 170) + ')'
      }, g);
    });
    svgEl('ellipse', {
      cx: f(-s * 0.3), cy: f(-s * 0.36), rx: f(s * 0.36), ry: f(s * 0.17),
      fill: 'rgba(255,255,255,.16)', transform: 'rotate(-30 ' + f(-s * 0.3) + ' ' + f(-s * 0.36) + ')'
    }, g);
  }

  function blossom(parent, x, y, s, grad) {
    const g = svgEl('g', { transform: 'translate(' + f(x) + ' ' + f(y) + ')' }, parent);
    for (let k = 0; k < 5; k++) {
      svgEl('ellipse', {
        cx: 0, cy: f(-s * 0.5), rx: f(s * 0.46), ry: f(s * 0.58),
        fill: 'url(#' + grad + ')',
        stroke: 'rgba(120,50,80,.35)', 'stroke-width': 0.8,
        transform: 'rotate(' + k * 72 + ')'
      }, g);
    }
    svgEl('circle', { r: f(s * 0.22), fill: '#E8C987', stroke: '#A87532', 'stroke-width': 0.6 }, g);
    svgEl('circle', { cx: f(-s * 0.06), cy: f(-s * 0.06), r: f(s * 0.07), fill: '#FFF1C2' }, g);
  }

  function leaf(parent, x, y, len, deg) {
    const g = svgEl('g', {
      transform: 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(deg) + ') scale(' + f(len / 28) + ')'
    }, parent);
    svgEl('path', {
      d: 'M0 0 C7 -9 20 -9 28 0 C20 9 7 9 0 0 Z',
      fill: 'url(#leafGold)', stroke: '#8A5A25', 'stroke-width': 0.6
    }, g);
    svgEl('path', {
      d: 'M2 0 L24 0', stroke: '#FFF1C2', 'stroke-opacity': 0.6, 'stroke-width': 0.6, fill: 'none'
    }, g);
  }

  function star(parent, x, y, s) {
    const k = s * 0.28;
    const d =
      'M0 ' + -s + ' L' + k + ' ' + -k + ' L' + s + ' 0 L' + k + ' ' + k +
      ' L0 ' + s + ' L' + -k + ' ' + k + ' L' + -s + ' 0 L' + -k + ' ' + -k + ' Z';
    svgEl('path', {
      d: d, fill: '#E8C987', stroke: '#A87532', 'stroke-width': 0.4,
      transform: 'translate(' + f(x) + ' ' + f(y) + ')'
    }, parent);
  }

  /* ---------- Piping (rope border around the clock) ---------- */
  function buildPiping() {
    const g = $('piping');
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a = (i * 360) / N;
      const p = onTop(240, a);
      const grp = svgEl('g', {
        transform: 'translate(' + f(p[0]) + ' ' + f(p[1]) + ') rotate(' + f(a) + ')'
      }, g);
      svgEl('ellipse', {
        rx: 27, ry: 15,
        fill: i % 2 ? 'url(#pipeLav)' : 'url(#pipePink)',
        stroke: 'rgba(110,50,80,.28)', 'stroke-width': 1
      }, grp);
      svgEl('path', {
        d: 'M-18 4 Q0 -8 18 4', fill: 'none',
        stroke: 'rgba(110,50,80,.25)', 'stroke-width': 1, 'stroke-linecap': 'round'
      }, grp);
      svgEl('ellipse', { cx: -4, cy: -5, rx: 13, ry: 3.2, fill: 'rgba(255,255,255,.45)' }, grp);
    }
  }

  /* ---------- Clock face: minute markers + numerals ---------- */
  function buildFace() {
    const marks = $('marks');
    for (let m = 0; m < 60; m++) {
      const a = m * 6;
      if (m % 5 === 0) {
        const p1 = onTop(181, a);
        const p2 = onTop(196, a);
        svgEl('line', {
          x1: f(p1[0]), y1: f(p1[1]), x2: f(p2[0]), y2: f(p2[1]),
          stroke: '#B98534', 'stroke-width': 2.2, 'stroke-linecap': 'round'
        }, marks);
      } else {
        const p = onTop(190, a);
        svgEl('circle', { cx: f(p[0]), cy: f(p[1]), r: 1.5, fill: '#C99A4E' }, marks);
      }
    }

    const nums = $('numerals');
    for (let n = 1; n <= 12; n++) {
      const p = onTop(158, n * 30);
      const t = svgEl('text', {
        x: f(p[0]), y: f(p[1]), dy: '0.35em', 'class': 'numeral'
      }, nums);
      t.textContent = String(n);
    }
  }

  /* ---------- Ring of pearls + gold quatrefoils around the face ---------- */
  function buildOrnaments() {
    const g = $('ornaments');
    for (let i = 0; i < 72; i++) {
      const a = i * 5;
      if (a % 90 === 0) continue;
      const p = onTop(218, a);
      pearl(g, p[0], p[1], 2.3);
    }
    [0, 90, 180, 270].forEach(function (a) {
      const p = onTop(216, a);
      const q = svgEl('g', { transform: 'translate(' + f(p[0]) + ' ' + f(p[1]) + ')' }, g);
      [[4, 0], [-4, 0], [0, 4], [0, -4]].forEach(function (o) {
        svgEl('circle', { cx: o[0], cy: o[1], r: 3, fill: '#D9B15F', stroke: '#A87532', 'stroke-width': 0.4 }, q);
      });
      svgEl('circle', { r: 2, fill: '#A87532' }, q);
    });
  }

  /* ---------- Flowers, leaves and pearls along the rim ---------- */
  function buildFlowers() {
    const leaves = $('leaves');
    const flowers = $('flowers');
    const pearls = $('pearls');

    const roses = [
      { a: 324, r: 238, s: 29, g: 'rosePlum' },
      { a: 309, r: 243, s: 19, g: 'roseIvory' },
      { a: 62,  r: 238, s: 27, g: 'rosePlum' },
      { a: 42,  r: 244, s: 20, g: 'roseIvory' },
      { a: 232, r: 238, s: 29, g: 'rosePlum' },
      { a: 212, r: 244, s: 21, g: 'roseIvory' },
      { a: 142, r: 240, s: 26, g: 'rosePlum' },
      { a: 160, r: 245, s: 16, g: 'roseIvory' }
    ];
    const blossoms = [
      { a: 296, r: 241, s: 21, g: 'blossomPink' },
      { a: 341, r: 246, s: 14, g: 'blossomLav' },
      { a: 84,  r: 243, s: 19, g: 'blossomPink' },
      { a: 100, r: 247, s: 14, g: 'blossomLav' },
      { a: 256, r: 243, s: 19, g: 'blossomPink' },
      { a: 272, r: 247, s: 14, g: 'blossomLav' },
      { a: 124, r: 244, s: 19, g: 'blossomPink' },
      { a: 110, r: 248, s: 13, g: 'blossomLav' }
    ];

    // Leaves first (behind flowers)
    roses.forEach(function (fl, i) {
      [-15, 15].forEach(function (off, j) {
        const a = fl.a + off;
        const p = onTop(230, a);
        const tilt = (j === 0 ? -1 : 1) * (28 + ((i * 7) % 18));
        leaf(leaves, p[0], p[1], 27, a - 90 + tilt);
      });
    });

    blossoms.forEach(function (fl) {
      const p = onTop(fl.r, fl.a);
      blossom(flowers, p[0], p[1], fl.s, fl.g);
    });
    roses.forEach(function (fl) {
      const p = onTop(fl.r, fl.a);
      rose(flowers, p[0], p[1], fl.s, fl.g);
    });

    // Scattered pearls and tiny lavender buds near each cluster
    const rand = rng(20240);
    [316, 52, 232, 138].forEach(function (centre) {
      for (let i = 0; i < 6; i++) {
        const a = centre + (rand() - 0.5) * 56;
        const r = 236 + (rand() - 0.5) * 44;
        const p = onTop(r, a);
        pearl(pearls, p[0], p[1], 2.4 + rand() * 1.2);
      }
      for (let i = 0; i < 5; i++) {
        const a = centre + (rand() - 0.5) * 60;
        const r = 238 + (rand() - 0.5) * 40;
        const p = onTop(r, a);
        svgEl('circle', { cx: f(p[0]), cy: f(p[1]), r: 2.5, fill: '#7B4F9E', 'fill-opacity': 0.9 }, pearls);
      }
    });
  }

  /* ---------- Bottom edge pearls + tiny gold stars on the side ---------- */
  function buildSideDeco() {
    const g = $('side-deco');
    for (let a = 90; a <= 270; a += 4) {
      const p = polar(350, 380, 260, a);
      pearl(g, p[0], p[1], 4.4);
    }
    [105, 128, 152, 208, 232, 255].forEach(function (a) {
      const p = polar(350, 371, 260, a);
      star(g, p[0], p[1], 4.6);
    });
  }

  function buildScene() {
    buildPiping();
    buildFace();
    buildOrnaments();
    buildFlowers();
    buildSideDeco();
  }

  /* =========================================================
     CLOCK HANDS  (both rotate about the same pivot: CX, CY)
     ========================================================= */
  let hourHand = null;
  let minuteHand = null;

  function setHands(hourAngle, minuteAngle) {
    hourHand.setAttribute('transform', 'rotate(' + hourAngle.toFixed(3) + ' ' + CX + ' ' + CY + ')');
    minuteHand.setAttribute('transform', 'rotate(' + minuteAngle.toFixed(3) + ' ' + CX + ' ' + CY + ')');
  }

  // totalMinutes: simulated clock time, minutes after 12:00 (720 === 12:00 again)
  function applyTime(totalMinutes) {
    const minuteAngle = (totalMinutes % 60) * 6;
    const hourAngle = (totalMinutes % 720) * 0.5;
    setHands(hourAngle, minuteAngle);
  }

  const ease = (t) => (reducedMotion ? t : 0.5 - Math.cos(Math.PI * t) / 2);

  /* =========================================================
     AUDIO ENGINE  (shared by every phase)
     ---------------------------------------------------------
     Browsers only allow sound after a real user gesture. The moon
     click is that gesture. Inside it we start the first sound and
     "prime" every other registered sound (muted play -> pause), so
     later phases can call audio.play(name) with no further taps.
     Any <audio> or <video> element can be registered the same way.
     ========================================================= */
  const audio = (function () {
    const tracks = {};

    function safePlay(el) {
      try {
        const p = el.play();
        if (p && typeof p.then === 'function') {
          return p.then(function () { return true; }, function () { return false; });
        }
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    }

    function reset(el) {
      try { el.pause(); el.currentTime = 0; } catch (e) { /* ignore */ }
    }

    // Register a sound (src) or an existing media element (e.g. a <video>).
    function add(name, srcOrElement, opts) {
      let el = srcOrElement;
      if (typeof srcOrElement === 'string') {
        try {
          el = new Audio();
          el.preload = 'auto';
          el.src = srcOrElement;
        } catch (e) { return; }
      }
      el.loop = !!(opts && opts.loop);
      el.addEventListener('error', function () { /* missing file: stay silent */ });
      tracks[name] = { el: el, wanted: false };
    }

    function play(name) {
      const t = tracks[name];
      if (!t) return Promise.resolve(false);
      t.wanted = true;
      try {
        t.el.muted = false;
        if (!t.el.loop) t.el.currentTime = 0;
      } catch (e) { /* ignore */ }
      return safePlay(t.el).then(function (ok) {
        if (ok && !t.wanted) reset(t.el);          // stop() arrived while play() was pending
        return ok;
      });
    }

    function stop(name) {
      const t = tracks[name];
      if (!t) return;
      t.wanted = false;
      reset(t.el);
    }

    // Call synchronously inside a user gesture.
    function prime(except) {
      Object.keys(tracks).forEach(function (name) {
        if (except && except.indexOf(name) !== -1) return;
        const t = tracks[name];
        if (t.wanted) return;
        t.el.muted = true;
        safePlay(t.el).then(function (ok) {
          if (ok && !t.wanted) reset(t.el);
          t.el.muted = false;
        });
      });
    }

    // Tab hidden / shown: pause and resume whatever should be playing.
    function suspend() {
      Object.keys(tracks).forEach(function (n) {
        if (tracks[n].wanted && tracks[n].el.loop) tracks[n].el.pause();
      });
    }
    function resume() {
      Object.keys(tracks).forEach(function (n) {
        if (tracks[n].wanted && tracks[n].el.loop) safePlay(tracks[n].el);
      });
    }

    function stopAll() {
      Object.keys(tracks).forEach(stop);
    }

    return { add: add, play: play, stop: stop, prime: prime, suspend: suspend, resume: resume, stopAll: stopAll };
  })();

  /* =========================================================
     TIMELINE  (single authoritative requestAnimationFrame loop)
     ========================================================= */
  let rafId = 0;
  let t0 = null;
  let fallbackTimer = 0;

  function frame(now) {
    if (state !== State.CLOCK_RUNNING) return;
    if (t0 === null) t0 = now;

    const progress = Math.min((now - t0) / SEQUENCE_MS, 1);
    if (progress >= 1) {
      finishClock();
      return;
    }
    applyTime(START_MINUTES + (END_MINUTES - START_MINUTES) * ease(progress));
    rafId = requestAnimationFrame(frame);
  }

  function finishClock() {
    if (state !== State.CLOCK_RUNNING) return;   // each transition runs once
    state = State.MIDNIGHT;

    cancelAnimationFrame(rafId);
    setHands(0, 0);                              // exact 12:00, set explicitly

    audio.stop('tick');                          // tick is silenced first...
    audio.play('chime');                         // ...then the chime plays once

    const stage = $('stage');
    stage.addEventListener('transitionend', onStageTransitionEnd);
    document.body.classList.add('is-midnight');  // graceful dissolve starts (CSS)

    fallbackTimer = window.setTimeout(completePhase, FADE_DELAY_MS + FADE_MS + 400);
  }

  function onStageTransitionEnd(e) {
    if (e.target === $('stage') && e.propertyName === 'opacity') completePhase();
  }

  function completePhase() {
    if (state !== State.MIDNIGHT) return;
    state = State.PHASE_ONE_COMPLETE;
    window.clearTimeout(fallbackTimer);
    $('stage').removeEventListener('transitionend', onStageTransitionEnd);
    document.body.classList.add('is-complete');
    window.setTimeout(startPhase2, PHASE2_DELAY_MS);   // hand over to Phase 2 (no tap needed)
  }

  function removeIntro() {
    const el = $('intro');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // Called by the moon click. Audio calls must stay synchronous here (user gesture).
  function startPhase2() {
    document.body.classList.add('is-phase2');                  // Phase 2 sky fades in (CSS)
    if (window.Phase2 && typeof window.Phase2.start === 'function') window.Phase2.start();
  }

  function start() {
    if (state !== State.INTRO) return;           // never run twice
    state = State.CLOCK_RUNNING;

    audio.play('tick');                          // first sound, started inside the gesture
    audio.prime(['tick']);                       // unlock every other sound for later phases
    if (window.Phase2 && typeof window.Phase2.unlockAudio === 'function') {
      window.Phase2.unlockAudio();               // unlock Phase 2's sounds with this same tap
    }

    document.body.classList.add('is-running');   // intro fades out, cake fades in (CSS)
    window.setTimeout(removeIntro, 1200);
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- Intro starfield ---------- */
  function buildStars() {
    const box = $('stars');
    if (!box) return;
    const rand = rng(777);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      const size = 1 + rand() * 2.2;
      s.style.cssText =
        'left:' + (rand() * 100).toFixed(2) + '%;' +
        'top:' + (rand() * 100).toFixed(2) + '%;' +
        '--s:' + size.toFixed(1) + 'px;' +
        '--d:' + (2 + rand() * 4).toFixed(1) + 's;' +
        '--delay:-' + (rand() * 6).toFixed(1) + 's';
      frag.appendChild(s);
    }
    box.appendChild(frag);
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function init() {
    hourHand = $('hourHand');
    minuteHand = $('minuteHand');
    buildScene();
    buildStars();
    applyTime(START_MINUTES);   // initial pose, ready behind the intro

    audio.add('tick', './assets/clock-tick.mp3', { loop: true });
    audio.add('chime', './assets/midnight-chime.mp3');
    // Phase 2+: register more sounds / videos here, e.g.
    // audio.add('music2', './assets/phase2-song.mp3', { loop: true });

    document.addEventListener('visibilitychange', function () {
      if (state !== State.CLOCK_RUNNING) return;
      if (document.hidden) audio.suspend(); else audio.resume();
    });

    $('moon').addEventListener('click', start, { once: true });
  }

  window.addEventListener('pagehide', function () {
    cancelAnimationFrame(rafId);
    audio.stopAll();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =========================================================
   PHASE 2
   ========================================================= */
/* =========================================================
   PHASE 2 — Moon rises, rocket launches, fireworks explode and
   the same sparks write "Happy Birthday / Anika" across the sky.

   PUBLIC API (window.Phase2)
     Phase2.start()            Begin the sequence. Call it from a real user
                               gesture (tap/click) so audio is allowed.
                               Standalone test: the first tap on the page does it.
     Phase2.onNextStage        Assign a function here: it runs when the moon is
                               clicked after the reveal.  (see transitionToNextStage)
     Phase2.destroy()          Stop everything and free resources.
     Phase2.getState()         Current state name.
     Phase2.CONFIG             All timing values (edit the object below).

   Also fired on the document:  CustomEvent "phase2:next-stage"
   ========================================================= */
(function () {
  'use strict';

  /* =========================================================
     CONFIG — every timing you may want to fine-tune lives here
     (milliseconds, measured from Phase2.start())
     ========================================================= */
  const CONFIG = {
    // ---- Opening ----
    MOON_RISE_MS: 4000,                 // the moon rises for this long
    ROCKET_DELAY_AFTER_MOON_MS: 1000,   // quiet beat after the moon settles, then launch
    ROCKET_FLIGHT_MS: 2500,             // rocket travel time (≈ length of the whoosh sound)
    REVEAL_DELAY_AFTER_BURST_MS: 3000,  // firework glows this long, then sparks start forming letters

    // ---- Reveal (relative to the moment magical-sparkle.mp3 starts) ----
    // [start, end] of the "writing" of each line. The audio is 6 s: 1 s of sparkle,
    // then "Happy Birthday" is sung/spoken.
    LINE_WINDOWS_MS: [[1000, 3300],     // "Happy Birthday"
                      [3300, 5600]],    // "Anika"
    SETTLE_END_MS: 6200,                // moon becomes clickable this long after the reveal starts
    WIPE_LAG_MS: 350,                   // how far the solid letters trail behind the flying sparks
    FLOW_MIN_MS: 1000,                  // each spark's flight time towards its letter spot
    FLOW_MAX_MS: 1500,

    // ---- Audio ----
    // Play a sound this many ms EARLIER than its visual event (compensates device latency).
    AUDIO_LEAD_MS: { whoosh: 0, burst: 0, sparkle: 0 },
    AUDIO: {
      whoosh: './assets/rocket-whoosh.mp3',
      burst: './assets/fireworks-burst.mp3',
      sparkle: './assets/magical-sparkle.mp3'
    },

    // ---- Text ----
    LINE1: 'Happy Birthday',
    LINE2: 'Anika',
    FONT_LINE1: "'Parisienne', 'Great Vibes', 'Snell Roundhand', 'Apple Chancery', 'Segoe Script', 'Brush Script MT', cursive",
    FONT_LINE2: "'Great Vibes', 'Parisienne', 'Snell Roundhand', 'Apple Chancery', 'Segoe Script', 'Brush Script MT', cursive",

    // ---- Performance bounds ----
    TEXT_PARTICLES_DESKTOP: 1500,
    TEXT_PARTICLES_MOBILE: 900,
    FREE_PARTICLES_DESKTOP: 260,
    FREE_PARTICLES_MOBILE: 150,
    SPARK_CAP_DESKTOP: 650,
    SPARK_CAP_MOBILE: 380,
    MAX_DPR_DESKTOP: 2,
    MAX_DPR_MOBILE: 1.5
  };

  /* =========================================================
     STATE MACHINE
     ========================================================= */
  const State = Object.freeze({
    IDLE: 'IDLE',
    MOON_RISING: 'MOON_RISING',
    ROCKET_LAUNCH: 'ROCKET_LAUNCH',
    FIREWORKS_BURST: 'FIREWORKS_BURST',
    BIRTHDAY_REVEAL: 'BIRTHDAY_REVEAL',
    READY_FOR_NEXT_STAGE: 'READY_FOR_NEXT_STAGE',
    TRANSITIONING: 'TRANSITIONING'
  });
  let state = State.IDLE;

  function setState(next) {
    state = next;
    if (document.body) document.body.setAttribute('data-p2-state', next);
  }

  /* =========================================================
     SMALL HELPERS
     ========================================================= */
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeInOutSine = (t) => 0.5 - Math.cos(Math.PI * clamp(t, 0, 1)) / 2;
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small =
    Math.min(window.innerWidth, window.innerHeight) < 600 ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');

  /* =========================================================
     AUDIO ENGINE  (each sound can be played only once)
     ========================================================= */
  function createAudioEngine() {
    const tracks = {};

    function safePlay(el) {
      try {
        const p = el.play();
        if (p && typeof p.then === 'function') {
          return p.then(function () { return true; }, function () { return false; });
        }
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    }
    function reset(el) {
      try { el.pause(); el.currentTime = 0; } catch (e) { /* ignore */ }
    }

    function add(name, src) {
      let el;
      try {
        el = new Audio();
        el.preload = 'auto';
        el.src = src;
      } catch (e) { return; }
      const t = { el: el, wanted: false, played: false };
      el.addEventListener('ended', function () { t.wanted = false; });
      el.addEventListener('error', function () { /* missing file: stay silent */ });
      tracks[name] = t;
    }

    // Call synchronously inside the user's tap: unlocks every sound for later.
    function prime() {
      Object.keys(tracks).forEach(function (name) {
        const t = tracks[name];
        if (t.wanted || t.played) return;
        t.el.muted = true;
        safePlay(t.el).then(function (ok) {
          if (ok && !t.wanted) reset(t.el);
          t.el.muted = false;
        });
      });
    }

    function playOnce(name) {
      const t = tracks[name];
      if (!t || t.played) return;           // never play a track twice
      t.played = true;
      t.wanted = true;
      try { t.el.muted = false; t.el.currentTime = 0; } catch (e) { /* ignore */ }
      safePlay(t.el).then(function (ok) { if (!ok) t.wanted = false; });
    }

    function suspend() {
      Object.keys(tracks).forEach(function (n) { if (tracks[n].wanted) tracks[n].el.pause(); });
    }
    function resume() {
      Object.keys(tracks).forEach(function (n) { if (tracks[n].wanted) safePlay(tracks[n].el); });
    }
    function stopAll() {
      Object.keys(tracks).forEach(function (n) { tracks[n].wanted = false; reset(tracks[n].el); });
    }

    return { add: add, prime: prime, playOnce: playOnce, suspend: suspend, resume: resume, stopAll: stopAll };
  }

  const audio = createAudioEngine();

  /* =========================================================
     GLOW SPRITES  (pre-rendered, drawn with additive blending)
     ========================================================= */
  const PALETTE = [
    [255, 205, 120],   // 0 champagne gold
    [255, 150, 64],    // 1 golden orange
    [255, 240, 205],   // 2 pale champagne
    [255, 166, 186],   // 3 rose   (rare)
    [196, 168, 255]    // 4 lavender (rare)
  ];
  const SPR = [];
  const STROKE = PALETTE.map(function (c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; });

  function buildSprites() {
    PALETTE.forEach(function (c) {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.16, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.95)');
      grad.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.26)');
      grad.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      SPR.push(s);
    });
  }

  function pickColor() {
    const r = Math.random();
    return r < 0.38 ? 0 : r < 0.62 ? 1 : r < 0.90 ? 2 : r < 0.95 ? 3 : 4;
  }

  /* =========================================================
     RUNTIME VARIABLES
     ========================================================= */
  let root, cvs, ctx, moon;
  let W = 0, H = 0, dpr = 1, U = 1;               // viewport, pixel ratio, size unit
  let layout = null;                              // text layout + target points
  let fontsReady = Promise.resolve();
  const maskCv = document.createElement('canvas');

  let particles = [];
  let textParts = [];
  let sparkCount = 0;
  const sparkCap = small ? CONFIG.SPARK_CAP_MOBILE : CONFIG.SPARK_CAP_DESKTOP;

  let started = false;
  let primed = false;                             // true once unlockAudio() ran inside a user gesture
  let rafId = 0;
  let t0 = null;
  let lastNow = 0;
  let hiddenAt = 0;
  let sch = null;                                 // schedule (absolute ms)
  const fired = { whoosh: false, burst: false, sparkle: false, rocket: false, reveal: false };
  let rocketOn = false;
  let revealOn = false;
  let burstInfo = null;                           // { x, y, rMax }
  let riseStart = 0;
  let moonDone = false;
  let nextMicro = 0;
  let pens = [null, null];
  let resizeTimer = 0;
  let lowFx = false;
  let slowFrames = 0;
  let destroyed = false;

  /* =========================================================
     BACKGROUND STARS
     ========================================================= */
  function buildStars() {
    const box = $('p2-stars');
    if (!box) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 120; i++) {
      const s = document.createElement('span');
      const big = Math.random() < 0.12;
      s.className = 'p2-star' + (big ? ' p2-star--big' : '');
      const size = big ? 2 + Math.random() * 1.4 : 0.8 + Math.random() * 1.6;
      s.style.cssText =
        'left:' + (Math.random() * 100).toFixed(2) + '%;' +
        'top:' + (Math.random() * 88).toFixed(2) + '%;' +
        '--s:' + size.toFixed(1) + 'px;' +
        '--d:' + (2 + Math.random() * 4).toFixed(1) + 's;' +
        '--delay:-' + (Math.random() * 6).toFixed(1) + 's';
      frag.appendChild(s);
    }
    box.appendChild(frag);
  }

  /* =========================================================
     CANVAS SIZE
     ========================================================= */
  function sizeCanvas() {
    W = Math.max(1, root.clientWidth);
    H = Math.max(1, root.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, small ? CONFIG.MAX_DPR_MOBILE : CONFIG.MAX_DPR_DESKTOP);
    cvs.width = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    U = clamp(Math.min(W, H) / 800, 0.7, 1.4);
  }

  /* =========================================================
     TEXT LAYOUT + TARGET POINTS
     Renders the words offscreen, samples the lit pixels (evenly spaced
     jittered grid) and prepares a glowing "solid" copy of each line.
     ========================================================= */
  function resampleTo(xs, ys, n, fallbackX, fallbackY) {
    const len = xs.length;
    const ox = [], oy = [];
    if (len === 0) {
      for (let i = 0; i < n; i++) { ox.push(fallbackX); oy.push(fallbackY); }
      return { xs: ox, ys: oy };
    }
    if (len >= n) {
      const idx = [];
      for (let i = 0; i < len; i++) idx.push(i);
      for (let i = len - 1; i > 0; i--) {                 // shuffle, keep first n
        const j = (Math.random() * (i + 1)) | 0;
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
      }
      for (let i = 0; i < n; i++) { ox.push(xs[idx[i]]); oy.push(ys[idx[i]]); }
    } else {
      for (let i = 0; i < len; i++) { ox.push(xs[i]); oy.push(ys[i]); }
      for (let i = len; i < n; i++) {
        const k = (Math.random() * len) | 0;
        ox.push(xs[k] + (Math.random() - 0.5) * 3);
        oy.push(ys[k] + (Math.random() - 0.5) * 3);
      }
    }
    return { xs: ox, ys: oy };
  }

  function buildLayout(lockN) {
    const mctx = maskCv.getContext('2d', { willReadFrequently: true });
    const REF = 100;
    const defs = [
      { text: CONFIG.LINE1, font: CONFIG.FONT_LINE1 },
      { text: CONFIG.LINE2, font: CONFIG.FONT_LINE2 }
    ];

    function measure(d) {
      mctx.font = REF + 'px ' + d.font;
      const m = mctx.measureText(d.text);
      const ok = isFinite(m.actualBoundingBoxRight) && isFinite(m.actualBoundingBoxLeft);
      return {
        l: ok ? m.actualBoundingBoxLeft : 0,
        r: ok ? m.actualBoundingBoxRight : m.width,
        a: isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : REF * 0.78,
        d: isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : REF * 0.3
      };
    }
    const m = defs.map(measure);
    const portrait = H > W;

    const maxW1 = portrait ? W * 0.9 : Math.min(W * 0.62, 900);
    let s1 = REF * maxW1 / Math.max(1, m[0].l + m[0].r);
    let s2 = REF * maxW1 * (portrait ? 0.78 : 0.7) / Math.max(1, m[1].l + m[1].r);
    s2 = Math.min(s2, s1 * 2.1);

    const inkH = function (mm, s) { return (mm.a + mm.d) * s / REF; };
    const budget = H * (portrait ? 0.40 : 0.50);
    let gap = Math.max(10, s1 * 0.14);
    let total = inkH(m[0], s1) + gap + inkH(m[1], s2);
    if (total > budget) {
      const f = budget / total;
      s1 *= f; s2 *= f;
      gap = Math.max(10, s1 * 0.14);
      total = inkH(m[0], s1) + gap + inkH(m[1], s2);
    }
    const centerY = H * (portrait ? 0.61 : 0.58);
    const top = centerY - total / 2;
    const sizes = [s1, s2];

    const lines = defs.map(function (d, i) {
      const sc = sizes[i] / REF;
      const mm = m[i];
      const base = i === 0
        ? top + mm.a * sc
        : top + inkH(m[0], s1) + gap + mm.a * sc;
      const x = W / 2 - ((mm.r - mm.l) / 2) * sc;
      return {
        text: d.text, font: d.font, size: sizes[i], x: x, base: base,
        x0: x - mm.l * sc, x1: x + mm.r * sc,
        y0: base - mm.a * sc, y1: base + mm.d * sc
      };
    });

    // --- Offscreen masks ---
    lines.forEach(function (line) {
      const pad = 6;
      line.rx = Math.floor(line.x0 - pad);
      line.ry = Math.floor(line.y0 - pad);
      line.rw = Math.ceil(line.x1 - line.x0) + pad * 2;
      line.rh = Math.ceil(line.y1 - line.y0) + pad * 2;
      maskCv.width = line.rw;
      maskCv.height = line.rh;
      mctx.clearRect(0, 0, line.rw, line.rh);
      mctx.font = line.size + 'px ' + line.font;
      mctx.textBaseline = 'alphabetic';
      mctx.textAlign = 'left';
      mctx.fillStyle = '#fff';
      mctx.fillText(line.text, line.x - line.rx, line.base - line.ry);
      const data = mctx.getImageData(0, 0, line.rw, line.rh).data;
      let c = 0;
      for (let k = 3; k < data.length; k += 4) if (data[k] > 110) c++;
      line.mask = data;
      line.npix = c;
    });

    // --- How many particles per line ---
    let n1, n2;
    if (lockN) {
      n1 = lockN[0]; n2 = lockN[1];
    } else {
      const total = small ? CONFIG.TEXT_PARTICLES_MOBILE : CONFIG.TEXT_PARTICLES_DESKTOP;
      const np = Math.max(1, lines[0].npix + lines[1].npix);
      n1 = clamp(Math.round(total * lines[0].npix / np), 60, total - 60);
      n2 = total - n1;
    }
    const counts = [n1, n2];

    // --- Sample target points (even jittered grid) ---
    lines.forEach(function (line, i) {
      const n = counts[i];
      const g = Math.max(2, Math.sqrt(line.npix / n));
      const xs = [], ys = [];
      for (let gy = g / 2; gy < line.rh; gy += g) {
        for (let gx = g / 2; gx < line.rw; gx += g) {
          const jx = gx + (Math.random() - 0.5) * g * 0.6;
          const jy = gy + (Math.random() - 0.5) * g * 0.6;
          const ix = jx | 0, iy = jy | 0;
          if (ix < 0 || iy < 0 || ix >= line.rw || iy >= line.rh) continue;
          if (line.mask[(iy * line.rw + ix) * 4 + 3] > 110) {
            xs.push(line.rx + jx);
            ys.push(line.ry + jy);
          }
        }
      }
      const rs = resampleTo(xs, ys, n, (line.x0 + line.x1) / 2, (line.y0 + line.y1) / 2);
      const order = [];
      for (let k = 0; k < n; k++) order.push(k);
      order.sort(function (a, b) { return rs.xs[a] - rs.xs[b]; });   // left -> right
      line.tx = order.map(function (k) { return rs.xs[k]; });
      line.ty = order.map(function (k) { return rs.ys[k]; });
      line.n = n;
      line.mask = null;                                            // free memory
    });

    // --- Solid glowing copy of each line ---
    lines.forEach(function (line) {
      const padF = 26;
      line.fx = line.rx - padF;
      line.fy = line.ry - padF;
      line.fw = line.rw + padF * 2;
      line.fh = line.rh + padF * 2;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(line.fw * dpr);
      cv.height = Math.ceil(line.fh * dpr);
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      g.font = line.size + 'px ' + line.font;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      const ex = line.x - line.fx, ey = line.base - line.fy;
      const grad = g.createLinearGradient(0, line.y0 - line.fy, 0, line.y1 - line.fy);
      grad.addColorStop(0, '#FFF7DC');
      grad.addColorStop(0.5, '#F7D88F');
      grad.addColorStop(1, '#F0A24A');
      g.fillStyle = grad;
      g.shadowColor = 'rgba(255,165,60,0.9)';
      g.shadowBlur = 26 * dpr;
      g.fillText(line.text, ex, ey);
      g.shadowColor = 'rgba(255,224,160,0.9)';
      g.shadowBlur = 8 * dpr;
      g.fillText(line.text, ex, ey);
      g.shadowBlur = 0;
      g.fillText(line.text, ex, ey);
      line.fcv = cv;
    });

    return { lines: lines, centerY: centerY, n: counts };
  }

  function rebuildLayout() {
    const lock = textParts.length ? [layout.n[0], layout.n[1]] : null;
    layout = buildLayout(lock);
  }

  /* =========================================================
     FONT LOADING (never blocks for long)
     ========================================================= */
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const jobs = [
      document.fonts.load('100px "Parisienne"', CONFIG.LINE1),
      document.fonts.load('100px "Great Vibes"', CONFIG.LINE2)
    ].map(function (p) { return p.catch(function () { /* offline: use fallbacks */ }); });
    const timeout = new Promise(function (res) { window.setTimeout(res, 2500); });
    return Promise.race([Promise.all(jobs), timeout]);
  }

  /* =========================================================
     SCHEDULE
     ========================================================= */
  function buildSchedule() {
    if (reducedMotion) {
      return { moon: 1200, rocket: Infinity, burst: Infinity, reveal: 1500 };
    }
    const rocket = CONFIG.MOON_RISE_MS + CONFIG.ROCKET_DELAY_AFTER_MOON_MS;
    const burst = rocket + CONFIG.ROCKET_FLIGHT_MS;
    return { moon: CONFIG.MOON_RISE_MS, rocket: rocket, burst: burst, reveal: burst + CONFIG.REVEAL_DELAY_AFTER_BURST_MS };
  }

  /* =========================================================
     PARTICLES
     ========================================================= */
  function newP(kind, x, y, vx, vy, c, size, life) {
    return {
      kind: kind, x: x, y: y, px: x, py: y, vx: vx, vy: vy, c: c, size: size,
      age: 0, life: life, mode: 0, ph: Math.random() * TAU,
      td: 0, ta: 0, tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0, sw: Math.random() < 0.5 ? -1 : 1
    };
  }

  function spawnSpark(x, y, vx, vy, life, size, c) {
    if (sparkCount >= sparkCap) return;
    sparkCount++;
    particles.push(newP('spark', x, y, vx, vy, c, size, life));
  }

  function explode(T) {
    const ex = W / 2, ey = layout.centerY;
    const rMax = Math.min(W * 0.46, H * 0.40);
    burstInfo = { x: ex, y: ey, rMax: rMax, t: T };
    const shells = [0.5, 0.78, 1.0];
    const K = 1.9;

    function velocity() {
      const th = Math.random() * TAU;
      let rf;
      if (Math.random() < 0.55) rf = shells[(Math.random() * 3) | 0] * (0.94 + Math.random() * 0.12);
      else rf = 0.04 + 0.96 * Math.sqrt(Math.random());
      const sp = rMax * rf * K;
      return [Math.cos(th) * sp, Math.sin(th) * sp];
    }

    // Letter particles: they burst out, hover, then become the lettering.
    const total = layout.n[0] + layout.n[1];
    for (let i = 0; i < total; i++) {
      const v = velocity();
      const p = newP('text', ex, ey, v[0], v[1], pickColor(), 3.4 + Math.random() * 2.6, 0);
      particles.push(p);
      textParts.push(p);
    }
    // Free sparks: pure fireworks, they fall and fade.
    const free = small ? CONFIG.FREE_PARTICLES_MOBILE : CONFIG.FREE_PARTICLES_DESKTOP;
    for (let i = 0; i < free; i++) {
      const v = velocity();
      particles.push(newP('free', ex, ey, v[0] * 0.95, v[1] * 0.95, pickColor(), 2.6 + Math.random() * 3, 2.4 + Math.random() * 2.2));
    }
    // Fast glitter
    const glitter = small ? 90 : 150;
    for (let i = 0; i < glitter; i++) {
      const th = Math.random() * TAU, sp = 220 + Math.random() * 520;
      spawnSpark(ex, ey, Math.cos(th) * sp, Math.sin(th) * sp, 0.6 + Math.random() * 0.9, 2 + Math.random() * 2.4, Math.random() < 0.5 ? 2 : 0);
    }
  }

  function microBurst() {
    if (sparkCount + 16 > sparkCap || !layout) return;
    const line = layout.lines[(Math.random() * 2) | 0];
    const x = line.x0 + Math.random() * (line.x1 - line.x0);
    const y = line.y0 - 30 + Math.random() * (line.y1 - line.y0 + 60);
    const n = 12 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * TAU, sp = 50 + Math.random() * 190;
      spawnSpark(x, y, Math.cos(th) * sp, Math.sin(th) * sp, 0.5 + Math.random() * 0.7, 2 + Math.random() * 2.2, pickColor() % 3);
    }
  }

  // Give every letter particle its spot on the text and its flight schedule.
  function assignTargets(T) {
    if (!layout || !textParts.length) return;
    const byY = textParts.slice().sort(function (a, b) { return a.y - b.y; });
    const groups = [byY.slice(0, layout.n[0]), byY.slice(layout.n[0])];
    groups.forEach(function (group, li) {
      group.sort(function (a, b) { return a.x - b.x; });
      const line = layout.lines[li];
      const ls = sch.reveal + CONFIG.LINE_WINDOWS_MS[li][0];
      const le = sch.reveal + CONFIG.LINE_WINDOWS_MS[li][1];
      const n = group.length;
      for (let i = 0; i < n; i++) {
        const p = group[i];
        p.tx = line.tx[i]; p.ty = line.ty[i];
        const f = clamp((i + 0.5) / n + (Math.random() - 0.5) * 0.05, 0, 1);
        p.ta = ls + (le - ls) * f;
        const dur = CONFIG.FLOW_MIN_MS + Math.random() * (CONFIG.FLOW_MAX_MS - CONFIG.FLOW_MIN_MS);
        p.td = Math.max(sch.reveal, p.ta - dur);
        if (p.ta - p.td < 200) p.ta = p.td + 200;
        // restore the right mode if we are re-assigning mid-animation (resize)
        if (T >= p.ta) { p.mode = 2; p.x = p.tx; p.y = p.ty; }
        else if (T >= p.td) { startFlow(p); }
        else p.mode = 0;
      }
    });
  }

  function startFlow(p) {
    p.mode = 1;
    p.sx = p.x; p.sy = p.y;
    const dx = p.tx - p.sx, dy = p.ty - p.sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const off = p.sw * dist * (0.25 + Math.random() * 0.35);
    p.cx = (p.sx + p.tx) / 2 + (-dy / dist) * off;
    p.cy = (p.sy + p.ty) / 2 + (dx / dist) * off;
  }

  /* =========================================================
     ROCKET
     ========================================================= */
  function rocketPath(u) {
    const L = rocketSize();
    const sx = W * 0.5 - W * (H > W ? 0.18 : 0.14), sy = H + L;
    const ex = burstInfo ? burstInfo.x : W / 2, ey = layout.centerY;
    const cx = sx - W * 0.06, cy = sy + (ey - sy) * 0.55;
    const p = 0.3 * u + 0.7 * u * u;                  // gentle acceleration
    const m = 1 - p;
    const x = m * m * sx + 2 * m * p * cx + p * p * ex;
    const y = m * m * sy + 2 * m * p * cy + p * p * ey;
    const dx = 2 * m * (cx - sx) + 2 * p * (ex - cx);
    const dy = 2 * m * (cy - sy) + 2 * p * (ey - cy);
    return { x: x, y: y, ang: Math.atan2(dy, dx) };
  }
  function rocketSize() { return clamp(Math.min(W, H) * 0.075, 30, 60); }

  function drawRocket(x, y, ang) {
    const L = rocketSize();
    // glow
    ctx.globalAlpha = 0.65;
    ctx.drawImage(SPR[0], x - L * 1.2, y - L * 1.2, L * 2.4, L * 2.4);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2);
    // flame (additive)
    const fl = L * (0.6 + Math.random() * 0.4);
    const fg = ctx.createLinearGradient(0, L * 0.4, 0, L * 0.4 + fl);
    fg.addColorStop(0, 'rgba(255,240,190,0.95)');
    fg.addColorStop(0.5, 'rgba(255,150,50,0.7)');
    fg.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-L * 0.13, L * 0.4);
    ctx.lineTo(0, L * 0.4 + fl);
    ctx.lineTo(L * 0.13, L * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // fins
    ctx.fillStyle = '#6B2D5E';
    ctx.strokeStyle = '#E8C987';
    ctx.lineWidth = 1;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s * L * 0.15, L * 0.1);
      ctx.lineTo(s * L * 0.36, L * 0.46);
      ctx.lineTo(s * L * 0.15, L * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    // body
    const bg = ctx.createLinearGradient(-L * 0.18, 0, L * 0.18, 0);
    bg.addColorStop(0, '#B88A52');
    bg.addColorStop(0.4, '#FFF3DD');
    bg.addColorStop(1, '#D9B27A');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.58);
    ctx.quadraticCurveTo(L * 0.22, -L * 0.2, L * 0.17, L * 0.42);
    ctx.lineTo(-L * 0.17, L * 0.42);
    ctx.quadraticCurveTo(-L * 0.22, -L * 0.2, 0, -L * 0.58);
    ctx.closePath();
    ctx.fill();
    // band + window
    ctx.fillStyle = '#6B2D5E';
    ctx.fillRect(-L * 0.18, L * 0.2, L * 0.36, L * 0.07);
    ctx.fillStyle = '#E8C987';
    ctx.beginPath();
    ctx.arc(0, -L * 0.1, L * 0.075, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
  }

  /* =========================================================
     UPDATE
     ========================================================= */
  function updateParticles(T, dt) {
    const dragText = Math.exp(-1.9 * dt);
    const dragSpark = Math.exp(-2.2 * dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.px = p.x; p.py = p.y;

      if (p.kind === 'text') {
        if (p.mode === 0) {
          p.vx *= dragText; p.vy *= dragText;
          p.x += p.vx * dt + Math.sin(T * 0.0013 + p.ph) * 0.10;
          p.y += p.vy * dt + Math.cos(T * 0.0011 + p.ph) * 0.10;
          if (revealOn && T >= p.td) startFlow(p);
        }
        if (p.mode === 1) {
          const u = (T - p.td) / (p.ta - p.td);
          if (u >= 1) {
            p.mode = 2;
            if (p.c > 2) p.c = p.c === 3 ? 2 : 0;
          } else {
            const e = u * u * (3 - 2 * u), m = 1 - e;
            p.x = m * m * p.sx + 2 * m * e * p.cx + e * e * p.tx;
            p.y = m * m * p.sy + 2 * m * e * p.cy + e * e * p.ty;
          }
        }
        if (p.mode === 2) {
          p.x = p.tx + Math.sin(T * 0.004 + p.ph) * 0.45;
          p.y = p.ty + Math.cos(T * 0.0037 + p.ph) * 0.45;
        }
      } else {
        p.age += dt;
        if (p.age >= p.life) {
          if (p.kind === 'spark') sparkCount--;
          particles[i] = particles[particles.length - 1];
          particles.pop();
          continue;
        }
        const d = p.kind === 'spark' ? dragSpark : dragText;
        p.vx *= d; p.vy *= d;
        p.vy += (p.kind === 'free' ? 38 : 20) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
  }

  // Bright "pen" that sweeps along each line while the letters are being written.
  function updatePens(T) {
    for (let li = 0; li < 2; li++) {
      const line = layout.lines[li];
      const ls = sch.reveal + CONFIG.LINE_WINDOWS_MS[li][0];
      const le = sch.reveal + CONFIG.LINE_WINDOWS_MS[li][1];
      if (T < ls - 150 || T > le + 250) { pens[li] = null; continue; }
      const frac = clamp((T - ls) / (le - ls), 0, 1);
      const idx = Math.floor(frac * (line.n - 1));
      const span = Math.max(3, Math.floor(line.n * 0.02));
      for (let k = 0; k < 2; k++) {
        const j = clamp(idx + Math.floor((Math.random() * 2 - 1) * span), 0, line.n - 1);
        const x = line.tx[j], y = line.ty[j];
        if (k === 0) pens[li] = { x: x, y: y };
        for (let s = 0; s < 2; s++) {
          const th = Math.random() * TAU, sp = 25 + Math.random() * 70;
          spawnSpark(x, y, Math.cos(th) * sp, Math.sin(th) * sp - 20, 0.3 + Math.random() * 0.35, 2 + Math.random() * 2, Math.random() < 0.5 ? 2 : 0);
        }
      }
    }
  }

  function updateRocketTrail(pos, dt) {
    const L = rocketSize();
    const n = Math.max(1, Math.round(dt * 220));
    for (let i = 0; i < n; i++) {
      const tx = pos.x - Math.cos(pos.ang) * L * (0.45 + Math.random() * 0.2);
      const ty = pos.y - Math.sin(pos.ang) * L * (0.45 + Math.random() * 0.2);
      spawnSpark(
        tx + (Math.random() - 0.5) * 4, ty + (Math.random() - 0.5) * 4,
        -Math.cos(pos.ang) * 60 + (Math.random() - 0.5) * 60,
        -Math.sin(pos.ang) * 60 + (Math.random() - 0.5) * 60 + 20,
        0.45 + Math.random() * 0.5, 3 + Math.random() * 3.5, Math.random() < 0.6 ? 1 : 0
      );
    }
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function drawLines(T) {
    for (let li = 0; li < 2; li++) {
      const line = layout.lines[li];
      const ls = sch.reveal + CONFIG.LINE_WINDOWS_MS[li][0];
      const le = sch.reveal + CONFIG.LINE_WINDOWS_MS[li][1];
      if (reducedMotion) {
        const a = smooth((T - ls) / (le - ls));
        if (a <= 0.003) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(line.fcv, line.fx, line.fy, line.fw, line.fh);
        ctx.globalAlpha = 1;
        continue;
      }
      const frac = clamp((T - ls - CONFIG.WIPE_LAG_MS) / (le - ls), 0, 1);
      if (frac <= 0) continue;
      const wipeX = line.x0 - 10 + (line.x1 - line.x0 + 20) * frac;
      ctx.save();
      ctx.beginPath();
      ctx.rect(line.fx, line.fy, Math.max(0, wipeX - line.fx), line.fh);
      ctx.clip();
      ctx.globalAlpha = 0.35 + 0.65 * smooth(frac * 1.4);
      ctx.drawImage(line.fcv, line.fx, line.fy, line.fw, line.fh);
      ctx.restore();
    }
  }

  function drawParticles(T) {
    const lastEnd = sch.reveal + CONFIG.LINE_WINDOWS_MS[1][1];
    const settleMul = 1 - 0.35 * smooth((T - lastEnd) / 1200);
    ctx.lineCap = 'round';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      let a, s;
      if (p.kind === 'text') {
        if (p.mode === 0) {
          a = 0.5 + 0.5 * Math.sin(T * 0.008 + p.ph * 3);
          s = p.size * U;
        } else if (p.mode === 1) {
          a = 1; s = p.size * U * 1.3;
        } else {
          const tw = 0.5 + 0.5 * Math.sin(T * 0.007 + p.ph * 5);
          a = (0.25 + 0.75 * tw) * settleMul;
          s = p.size * U * 0.62 * (0.7 + 0.5 * tw);
        }
      } else {
        const k = 1 - p.age / p.life;
        a = k * k;
        s = p.size * U * (0.5 + 0.5 * k);
      }
      if (a <= 0.01) continue;
      ctx.globalAlpha = a > 1 ? 1 : a;

      if (!lowFx && p.mode !== 2) {
        const dx = p.x - p.px, dy = p.y - p.py;
        if (dx * dx + dy * dy > 1.5) {
          ctx.strokeStyle = STROKE[p.c];
          ctx.lineWidth = Math.max(1, s * 0.3);
          ctx.beginPath();
          ctx.moveTo(p.x - dx * 2.4, p.y - dy * 2.4);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
      ctx.drawImage(SPR[p.c], p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  function render(T) {
    ctx.clearRect(0, 0, W, H);

    if (revealOn && layout) drawLines(T);

    ctx.globalCompositeOperation = 'lighter';

    if (burstInfo) {
      const age = (T - burstInfo.t) / 1000;
      if (age < 0.8) {
        const k = 1 - age / 0.8;
        const r = burstInfo.rMax * (0.5 + age * 0.55);
        ctx.globalAlpha = 0.85 * k * k;
        ctx.drawImage(SPR[2], burstInfo.x - r, burstInfo.y - r, r * 2, r * 2);
      }
      const ra = (T - burstInfo.t) / 1300;
      if (ra < 1) {
        ctx.globalAlpha = 0.55 * (1 - ra);
        ctx.strokeStyle = STROKE[0];
        ctx.lineWidth = 0.6 + 2.2 * (1 - ra);
        ctx.beginPath();
        ctx.arc(burstInfo.x, burstInfo.y, burstInfo.rMax * easeOutCubic(ra), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (rocketOn) {
      const pos = rocketPath(clamp((T - sch.rocket) / CONFIG.ROCKET_FLIGHT_MS, 0, 1));
      drawRocket(pos.x, pos.y, pos.ang);
    }

    drawParticles(T);

    for (let li = 0; li < 2; li++) {
      const pen = pens[li];
      if (!pen) continue;
      const flick = 0.75 + Math.random() * 0.25;
      ctx.globalAlpha = 0.35 * flick;
      ctx.drawImage(SPR[0], pen.x - 34 * U, pen.y - 34 * U, 68 * U, 68 * U);
      ctx.globalAlpha = 0.95 * flick;
      ctx.drawImage(SPR[2], pen.x - 15 * U, pen.y - 15 * U, 30 * U, 30 * U);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* =========================================================
     MAIN LOOP — one requestAnimationFrame loop drives everything
     ========================================================= */
  function tick(now) {
    if (destroyed) return;
    rafId = requestAnimationFrame(tick);

    if (t0 === null) { t0 = now; lastNow = now; }
    const T = now - t0;
    const dtRaw = (now - lastNow) / 1000;
    const dt = clamp(dtRaw, 0, 0.05);
    lastNow = now;

    // simple adaptive quality
    if (dtRaw > 0.032) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 40) lowFx = true;

    // ---- Moon ----
    if (!moonDone && !reducedMotion) {
      const u = T / sch.moon;
      if (u >= 1) {
        moonDone = true;
        root.style.setProperty('--p2-rise', '0px');
      } else {
        root.style.setProperty('--p2-rise', (riseStart * (1 - easeInOutSine(u))).toFixed(1) + 'px');
      }
    }

    // ---- Rocket launch ----
    if (!fired.whoosh && T >= sch.rocket - CONFIG.AUDIO_LEAD_MS.whoosh) {
      fired.whoosh = true;
      audio.playOnce('whoosh');
    }
    if (!fired.rocket && T >= sch.rocket) {
      fired.rocket = true;
      rocketOn = true;
      setState(State.ROCKET_LAUNCH);
    }
    if (rocketOn) {
      updateRocketTrail(rocketPath(clamp((T - sch.rocket) / CONFIG.ROCKET_FLIGHT_MS, 0, 1)), dt);
    }

    // ---- Explosion ----
    if (!fired.burst && T >= sch.burst - CONFIG.AUDIO_LEAD_MS.burst) {
      fired.burst = true;
      audio.playOnce('burst');
    }
    if (rocketOn && T >= sch.burst) {
      rocketOn = false;
      setState(State.FIREWORKS_BURST);
      explode(T);
      nextMicro = T + 700;
    }

    // ---- Reveal ----
    if (!fired.sparkle && T >= sch.reveal - CONFIG.AUDIO_LEAD_MS.sparkle) {
      fired.sparkle = true;
      audio.playOnce('sparkle');                 // the only place this sound is ever played
    }
    if (!fired.reveal && T >= sch.reveal) {
      fired.reveal = true;
      revealOn = true;
      setState(State.BIRTHDAY_REVEAL);
      assignTargets(T);
    }

    // ---- Ambient micro bursts around the lettering ----
    if (revealOn && !lowFx && T >= nextMicro && T < sch.reveal + CONFIG.SETTLE_END_MS - 800) {
      microBurst();
      nextMicro = T + 380 + Math.random() * 380;
    } else if (!revealOn && burstInfo && !lowFx && T >= nextMicro && T < sch.reveal) {
      nextMicro = T + 450 + Math.random() * 500;   // keep the gap between burst and reveal alive
      const th = Math.random() * TAU, rr = burstInfo.rMax * (0.35 + Math.random() * 0.6);
      const x = burstInfo.x + Math.cos(th) * rr, y = burstInfo.y + Math.sin(th) * rr * 0.8;
      for (let i = 0; i < 9 && sparkCount < sparkCap; i++) {
        const a = Math.random() * TAU, sp = 40 + Math.random() * 120;
        spawnSpark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.6, 2 + Math.random() * 2, pickColor() % 3);
      }
    }

    updateParticles(T, dt);
    if (revealOn && layout && !reducedMotion) updatePens(T);

    // ---- Ready for the next stage ----
    if (state === State.BIRTHDAY_REVEAL && T >= sch.reveal + CONFIG.SETTLE_END_MS) {
      makeReady();
    }

    render(T);
  }

  /* =========================================================
     MOON = NEXT-STAGE SWITCH
     ========================================================= */
  function makeReady() {
    setState(State.READY_FOR_NEXT_STAGE);
    pens = [null, null];
    moon.disabled = false;
    moon.removeAttribute('tabindex');
    moon.setAttribute('aria-label', 'The moon. Press to continue.');
    moon.classList.add('is-ready');
  }

  function onMoonClick() {
    if (state !== State.READY_FOR_NEXT_STAGE) return;   // ignore early / repeated clicks
    setState(State.TRANSITIONING);
    moon.classList.remove('is-ready');
    moon.classList.add('is-activated');
    moon.disabled = true;
    transitionToNextStage();
  }

  /* ---------------------------------------------------------
     >>>  INTEGRATION POINT  <<<
     Runs exactly once, when the moon is clicked after the reveal.
     Connect your next phase in ONE of these ways:
       1) Phase2.onNextStage = function () { ...start phase 3... };
       2) document.addEventListener('phase2:next-stage', ...);
       3) Edit this function directly.
     Call Phase2.destroy() inside your handler if you want to remove
     Phase 2's canvas loop once the next scene has taken over.
     --------------------------------------------------------- */
  function transitionToNextStage() {
    if (typeof api.onNextStage === 'function') {
      try { api.onNextStage(); } catch (e) { console.error('[Phase2] onNextStage failed', e); }
    }
    document.dispatchEvent(new CustomEvent('phase2:next-stage'));
  }

  /* =========================================================
     START / RESIZE / CLEANUP
     ========================================================= */
  function onFirstInput(e) {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    start();
  }
  function removeFirstInput() {
    document.removeEventListener('click', onFirstInput);
    document.removeEventListener('keydown', onFirstInput);
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    removeFirstInput();

    // Audio must be unlocked synchronously inside the user's tap
    // (when embedded, Phase 1's moon tap already did this via unlockAudio()).
    if (!primed) audio.prime();

    root.classList.add('is-started');
    sch = buildSchedule();

    if (!reducedMotion) {
      root.style.setProperty('--p2-rise', '0px');
      riseStart = H - moon.offsetTop + 30;
      root.style.setProperty('--p2-rise', riseStart + 'px');
    }
    setState(State.MOON_RISING);

    fontsReady.then(function () {
      if (destroyed) return;
      if (!layout) layout = buildLayout(null);
      t0 = null;
      rafId = requestAnimationFrame(tick);
    });
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (destroyed || !root) return;
      const oldW = W, oldH = H;
      sizeCanvas();
      const fx = W / oldW, fy = H / oldH;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x *= fx; p.px *= fx; p.vx *= fx; p.sx *= fx; p.cx *= fx;
        p.y *= fy; p.py *= fy; p.vy *= fy; p.sy *= fy; p.cy *= fy;
      }
      if (burstInfo) {
        burstInfo.x *= fx; burstInfo.y *= fy;
        burstInfo.rMax = Math.min(W * 0.46, H * 0.40);
      }
      if (layout) {
        rebuildLayout();
        if (revealOn && t0 !== null) assignTargets(performance.now() - t0);
      }
      if (started && !moonDone && !reducedMotion) riseStart = H - moon.offsetTop + 30;
    }, 140);
  }

  function onVisibility() {
    if (!started || destroyed) return;
    if (document.hidden) {
      hiddenAt = performance.now();
      audio.suspend();
    } else {
      if (t0 !== null && hiddenAt) t0 += performance.now() - hiddenAt;   // freeze the timeline while hidden
      hiddenAt = 0;
      audio.resume();
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    window.clearTimeout(resizeTimer);
    removeFirstInput();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (moon) moon.removeEventListener('click', onMoonClick);
    audio.stopAll();
    particles = [];
    textParts = [];
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  /* =========================================================
     BOOT
     ========================================================= */
  const api = {
    CONFIG: CONFIG,
    State: State,
    onNextStage: null,
    start: start,
    unlockAudio: function () { audio.prime(); primed = true; },   // call inside a user gesture
    destroy: destroy,
    getState: function () { return state; }
  };
  window.Phase2 = api;

  function init() {
    root = $('p2-root');
    cvs = $('p2-canvas');
    moon = $('p2-moon');
    ctx = cvs.getContext('2d');

    if (reducedMotion) root.classList.add('is-reduced');

    buildSprites();
    buildStars();
    sizeCanvas();

    audio.add('whoosh', CONFIG.AUDIO.whoosh);
    audio.add('burst', CONFIG.AUDIO.burst);
    audio.add('sparkle', CONFIG.AUDIO.sparkle);

    fontsReady = loadFonts().then(function () {
      if (destroyed) return;
      layout = buildLayout(null);
    });
    // If a web font arrives late, rebuild the layout (only before the reveal needs it).
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', function () {
        if (!destroyed && layout && !revealOn) rebuildLayout();
      });
    }

    moon.addEventListener('click', onMoonClick);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    // Standalone testing: the first tap anywhere starts Phase 2 (no visible UI).
    // When embedded in the full experience, Phase 1 calls Phase2.start() itself.
    const embedded = root.hasAttribute('data-embedded');
    if (!embedded) {
      document.addEventListener('click', onFirstInput);
      document.addEventListener('keydown', onFirstInput);
    }

    setState(State.IDLE);
    if (!embedded && /[?&]autostart/.test(window.location.search)) start();   // sound may be blocked in this mode
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();