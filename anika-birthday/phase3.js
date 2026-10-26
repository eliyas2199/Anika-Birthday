/* =========================================================
   PHASE 3 — "Happy Birthday, Anika!" + portrait reveal.

   PUBLIC API (window.Phase3)
     Phase3.start(options)     Begin Phase 3. Call it from the moon-click handler
                               (a real user gesture) so the song may start.
                               options.moon (optional): an existing moon <button>
                               to adopt, so the SAME moon stays on screen.
     Phase3.unlockAudio()      Optional: call inside any earlier user gesture
                               (e.g. Phase 1's first tap) to unlock the song early.
     Phase3.onNextStage        Assign a function here: it runs when the moon is
                               clicked at the very end (see transitionToPhase4).
     Phase3.destroy()          Stop everything and free resources.
     Phase3.getState()         Current state name.
     Phase3.CONFIG             All timing values (edit the object below).

   Also fired on the document:  CustomEvent "phase3:next-stage"

   STANDALONE TEST: open phase3.html and click the moon (it behaves like the end
   of Phase 2). Add ?autostart to the URL to begin without clicking
   (the song may then be blocked by the browser).
   ========================================================= */
(function () {
  'use strict';

  /* =========================================================
     CONFIG — all timing values (milliseconds, from Phase3.start())
     ========================================================= */
  const CONFIG = {
    // ---- Birthday message ----
    MESSAGE_FADE_IN_MS: 1600,         // gentle fade-in (starts together with the song)
    MESSAGE_VISIBLE_UNTIL_MS: 5000,   // the message starts fading out at this moment
    MESSAGE_FADE_OUT_MS: 1200,

    // ---- Portrait ----
    PORTRAIT_START_MS: 5600,          // portrait starts to appear (message is already fading)
    PORTRAIT_FADE_IN_MS: 2800,
    PORTRAIT_ZOOM_MS: 14000,          // length of the slow zoom
    PORTRAIT_ZOOM_SCALE: 1.06,        // 1 = no zoom
    PORTRAIT_MIN_VISIBLE_MS: 3000,    // portrait is shown at least this long once fully visible
    PORTRAIT_FADE_OUT_MS: 2000,

    // ---- After the portrait is gone ----
    READY_DELAY_MS: 400,              // calm pause before the moon becomes clickable

    // ---- Safety nets (only used if the audio misbehaves) ----
    FALLBACK_SONG_MS: 15000,          // assumed song length if audio can't play at all
    WATCHDOG_GRACE_MS: 3000,          // extra wait after the real duration if "ended" never arrives
    WATCHDOG_UNKNOWN_MS: 25000,       // watchdog when the duration is unknown

    // ---- Files ----
    AUDIO_SRC: './assets/happy-birthday-anika.mp3',
    PORTRAIT_SRC: './assets/anika-portrait.jpg'
  };

  /* =========================================================
     STATE MACHINE
     ========================================================= */
  const State = Object.freeze({
    IDLE: 'IDLE',
    BIRTHDAY_MESSAGE: 'BIRTHDAY_MESSAGE',
    PORTRAIT_REVEAL: 'PORTRAIT_REVEAL',
    PORTRAIT_DISPLAY: 'PORTRAIT_DISPLAY',
    PORTRAIT_FADE_OUT: 'PORTRAIT_FADE_OUT',
    READY_FOR_PHASE4: 'READY_FOR_PHASE4',
    TRANSITIONING: 'TRANSITIONING'
  });
  let state = State.IDLE;

  function setState(next) {
    state = next;
    if (document.body) document.body.setAttribute('data-p3-state', next);
  }

  /* =========================================================
     VARIABLES
     ========================================================= */
  const $ = (id) => document.getElementById(id);
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let root, moon, ownMoon, img, audioEl;
  let t0 = 0;                       // moment Phase 3 started
  let portraitFullAt = 0;           // moment the portrait became fully visible
  let songRequested = false;        // the song is only ever requested once
  let songEnded = false;
  let audioFailed = false;          // the file could not be loaded (noticed possibly before start)
  let timers = [];
  let fadeCheckTimer = 0;
  let watchdogTimer = 0;
  let fallbackTimer = 0;
  let destroyed = false;

  /* =========================================================
     TIMERS (all tracked so they can be cleaned up)
     ========================================================= */
  function later(ms, fn) {
    const id = window.setTimeout(function () {
      timers = timers.filter(function (t) { return t !== id; });
      if (!destroyed) fn();
    }, Math.max(0, ms));
    timers.push(id);
    return id;
  }
  function clearTimers() {
    timers.forEach(function (id) { window.clearTimeout(id); });
    timers = [];
    window.clearTimeout(fadeCheckTimer);
    window.clearTimeout(watchdogTimer);
    window.clearTimeout(fallbackTimer);
    fadeCheckTimer = watchdogTimer = fallbackTimer = 0;
  }

  /* =========================================================
     BACKGROUND STARS
     ========================================================= */
  function buildStars() {
    const box = $('p3-stars');
    if (!box) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 120; i++) {
      const s = document.createElement('span');
      const big = Math.random() < 0.12;
      s.className = 'p3-star' + (big ? ' p3-star--big' : '');
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
     MOON
     ========================================================= */
  function lockMoon() {
    moon.disabled = true;
    moon.classList.remove('is-ready');
    moon.setAttribute('tabindex', '-1');
    moon.setAttribute('aria-label', 'The moon');
  }

  function unlockMoon() {
    moon.disabled = false;
    moon.removeAttribute('tabindex');
    moon.setAttribute('aria-label', 'The moon. Press to continue.');
    moon.classList.remove('is-activated');
    moon.classList.add('is-ready');
  }

  function adoptMoon(el) {
    if (!el || el === moon) return;
    moon.removeEventListener('click', onMoonClick);
    if (ownMoon && ownMoon.parentNode) ownMoon.parentNode.removeChild(ownMoon);   // keep only ONE moon
    ownMoon = null;
    moon = el;
    moon.addEventListener('click', onMoonClick);
  }

  function onMoonClick() {
    if (state === State.IDLE) { start(); return; }              // standalone test: moon starts Phase 3
    if (state !== State.READY_FOR_PHASE4) return;               // ignored while the sequence plays
    setState(State.TRANSITIONING);                              // repeated clicks do nothing
    moon.classList.remove('is-ready');
    moon.classList.add('is-activated');
    moon.disabled = true;
    transitionToPhase4();
  }

  /* ---------------------------------------------------------
     >>>  INTEGRATION POINT for Phase 4  <<<
     Runs exactly once, when the moon is clicked after the portrait has faded out.
     Connect Phase 4 in ONE of these ways:
       1) Phase3.onNextStage = function () { ...start phase 4... };
       2) document.addEventListener('phase3:next-stage', ...);
       3) Edit this function directly.
     Phase 3 never moves on by itself.
     --------------------------------------------------------- */
  function transitionToPhase4() {
    if (typeof api.onNextStage === 'function') {
      try { api.onNextStage(); } catch (e) { console.error('[Phase3] onNextStage failed', e); }
    }
    document.dispatchEvent(new CustomEvent('phase3:next-stage'));
  }

  /* =========================================================
     SONG  (played once; "ended" decides when the portrait leaves)
     ========================================================= */
  function createAudio() {
    try {
      audioEl = new Audio();
      audioEl.preload = 'auto';
      audioEl.loop = false;
      audioEl.addEventListener('ended', function () { onSongEnded('ended'); });
      audioEl.addEventListener('error', function () {
        audioFailed = true;                                 // may happen at page load, long before start()
        if (songRequested) startFallback('error');
      });
      audioEl.addEventListener('loadedmetadata', function () {
        if (songRequested && !songEnded) armWatchdog();     // real duration is now known
      });
      audioEl.src = CONFIG.AUDIO_SRC;
    } catch (e) {
      audioEl = null;
    }
  }

  function playSong() {
    if (songRequested) return;                              // never play twice
    songRequested = true;
    if (!audioEl) { startFallback('no-audio'); return; }
    if (audioFailed) { startFallback('missing-file'); return; }
    try { audioEl.muted = false; audioEl.currentTime = 0; } catch (e) { /* ignore */ }
    let p;
    try { p = audioEl.play(); } catch (e) { startFallback('play-threw'); return; }
    if (p && typeof p.then === 'function') {
      p.then(function () { armWatchdog(); }, function () { startFallback('blocked'); });
    } else {
      armWatchdog();
    }
  }

  // If "ended" never arrives (stalled stream), do not stay stuck forever.
  function armWatchdog() {
    window.clearTimeout(watchdogTimer);
    if (songEnded || destroyed) return;
    const d = audioEl && isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration * 1000 : 0;
    const total = d ? d + CONFIG.WATCHDOG_GRACE_MS : CONFIG.WATCHDOG_UNKNOWN_MS;
    const remaining = Math.max(500, total - (performance.now() - t0));
    watchdogTimer = window.setTimeout(function () { onSongEnded('watchdog'); }, remaining);
  }

  // The song cannot play (blocked, missing file...): keep the visuals going on a timer.
  function startFallback(reason) {
    if (songEnded || fallbackTimer) return;
    window.clearTimeout(watchdogTimer);
    console.info('[Phase3] song not playing (' + reason + '); using a timer instead.');
    const remaining = Math.max(0, CONFIG.FALLBACK_SONG_MS - (performance.now() - t0));
    fallbackTimer = window.setTimeout(function () { onSongEnded('fallback'); }, remaining);
  }

  function onSongEnded(reason) {
    if (songEnded || destroyed) return;
    songEnded = true;
    window.clearTimeout(watchdogTimer);
    window.clearTimeout(fallbackTimer);
    watchdogTimer = fallbackTimer = 0;
    maybeFadeOut();
  }

  // Early unlock from an earlier tap (optional).
  function unlockAudio() {
    if (!audioEl || songRequested) return;
    audioEl.muted = true;
    let p;
    try { p = audioEl.play(); } catch (e) { audioEl.muted = false; return; }
    const done = function (ok) {
      if (ok && !songRequested) {
        try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) { /* ignore */ }
      }
      audioEl.muted = false;
    };
    if (p && typeof p.then === 'function') p.then(function () { done(true); }, function () { done(false); });
    else done(true);
  }

  /* =========================================================
     SEQUENCE
     ========================================================= */
  function start(options) {
    if (state !== State.IDLE || destroyed) return;
    if (options && options.moon) adoptMoon(options.moon);

    setState(State.BIRTHDAY_MESSAGE);
    lockMoon();
    t0 = performance.now();

    // Song and message begin together, inside the same call (keeps the user gesture).
    playSong();
    root.classList.add('is-message-in');

    later(CONFIG.MESSAGE_VISIBLE_UNTIL_MS, hideMessage);
    later(CONFIG.PORTRAIT_START_MS, revealPortrait);
  }

  function hideMessage() {
    root.classList.remove('is-message-in');                 // fades out (CSS)
  }

  function revealPortrait() {
    setState(State.PORTRAIT_REVEAL);
    root.classList.add('has-portrait');                     // starts the slow zoom + glow
    root.classList.add('is-portrait-in');                   // fade-in (CSS)
    portraitFullAt = performance.now() + CONFIG.PORTRAIT_FADE_IN_MS;
    later(CONFIG.PORTRAIT_FADE_IN_MS, function () {
      if (state === State.PORTRAIT_REVEAL) setState(State.PORTRAIT_DISPLAY);
      maybeFadeOut();
    });
  }

  // The portrait leaves only when the song has really ended AND it was shown long enough.
  function maybeFadeOut() {
    if (!songEnded || state !== State.PORTRAIT_DISPLAY) return;
    const wait = portraitFullAt + CONFIG.PORTRAIT_MIN_VISIBLE_MS - performance.now();
    if (wait > 0) {
      window.clearTimeout(fadeCheckTimer);
      fadeCheckTimer = window.setTimeout(maybeFadeOut, wait + 20);
      return;
    }
    fadeOutPortrait();
  }

  function fadeOutPortrait() {
    if (state !== State.PORTRAIT_DISPLAY) return;
    setState(State.PORTRAIT_FADE_OUT);
    root.classList.remove('is-portrait-in');                // fades out (CSS)
    later(CONFIG.PORTRAIT_FADE_OUT_MS + CONFIG.READY_DELAY_MS, makeReady);
  }

  function makeReady() {
    if (state !== State.PORTRAIT_FADE_OUT) return;
    setState(State.READY_FOR_PHASE4);
    unlockMoon();                                           // the moon is the button again
  }

  /* =========================================================
     CLEANUP
     ========================================================= */
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearTimers();
    if (moon) moon.removeEventListener('click', onMoonClick);
    if (audioEl) {
      try { audioEl.pause(); } catch (e) { /* ignore */ }
    }
  }

  /* =========================================================
     BOOT
     ========================================================= */
  const api = {
    CONFIG: CONFIG,
    State: State,
    onNextStage: null,
    start: start,
    unlockAudio: unlockAudio,
    destroy: destroy,
    getState: function () { return state; }
  };
  window.Phase3 = api;

  function applyConfigToCss() {
    const k = reducedMotion ? 0.5 : 1;                      // calmer, shorter fades if motion is reduced
    const s = root.style;
    s.setProperty('--p3-msg-in', Math.round(CONFIG.MESSAGE_FADE_IN_MS * k) + 'ms');
    s.setProperty('--p3-msg-out', Math.round(CONFIG.MESSAGE_FADE_OUT_MS * k) + 'ms');
    s.setProperty('--p3-portrait-in', Math.round(CONFIG.PORTRAIT_FADE_IN_MS * k) + 'ms');
    s.setProperty('--p3-portrait-out', Math.round(CONFIG.PORTRAIT_FADE_OUT_MS * k) + 'ms');
    s.setProperty('--p3-zoom-ms', CONFIG.PORTRAIT_ZOOM_MS + 'ms');
    s.setProperty('--p3-zoom-scale', reducedMotion ? '1' : String(CONFIG.PORTRAIT_ZOOM_SCALE));
  }

  function init() {
    root = $('p3-root');
    moon = ownMoon = $('p3-moon');
    img = $('p3-img');

    applyConfigToCss();
    buildStars();
    createAudio();

    // Portrait: show a graceful fallback frame if the file cannot be loaded.
    img.addEventListener('error', function () { root.classList.add('p3-no-image'); });
    img.addEventListener('load', function () { root.classList.remove('p3-no-image'); });
    img.src = CONFIG.PORTRAIT_SRC;

    moon.addEventListener('click', onMoonClick);
    setState(State.IDLE);

    if (/[?&]autostart/.test(window.location.search)) start();   // sound may be blocked in this mode
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();