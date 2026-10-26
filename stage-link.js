/* =====================================================================
   The link between the stages.  Nothing here changes how a stage works:
   it only tells the next stage to begin (and passes the moon on).

     Stage 1  ->  Stage 2    (inside script.js, as before)
     Stage 2  ->  Stage 3    Phase2.onNextStage  ->  Phase3.start({ moon })
     Stage 3  ->  Stage 4    Phase3.onNextStage  ->  Phase4.start({ moon })

   The moon is ONE element for the whole experience (Stage 2's moon).
   ===================================================================== */
(function () {
  'use strict';
  var body = document.body;
  var P2 = window.Phase2, P3 = window.Phase3, P4 = window.Phase4;
  if (!P2 || !P3 || !P4) {
    if (window.console) console.error('[stage-link] a stage script is missing (Phase2 / Phase3 / Phase4).');
    return;
  }

  function theMoon() { return document.getElementById('p2-moon'); }

  /* ---------- Moon click sound (Stages 1 - 3) ----------
     Plays when a click on the moon is really accepted. In Stage 4 every click already has its own
     sound (reveal / return), so nothing is added there. */
  var CLICK = { SRC: './assets/moon-click.mp3', VOLUME: 0.5 };
  var clickAudio = null, clickBad = false;
  try {
    clickAudio = new Audio();
    clickAudio.preload = 'auto';
    clickAudio.volume = CLICK.VOLUME;
    clickAudio.addEventListener('error', function () { clickBad = true; });
    clickAudio.src = CLICK.SRC;
  } catch (e) { clickAudio = null; }
  function playClick() {
    if (!clickAudio || clickBad) return;
    try {
      clickAudio.currentTime = 0;
      var p = clickAudio.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* stay silent */ });
    } catch (e) { /* stay silent */ }
  }

  // Stage 1: the first tap (the moon). It also unlocks Stage 3's song, so it can start without delay later.
  var firstMoon = document.getElementById('moon');
  var firstDone = false;
  if (firstMoon) {
    firstMoon.addEventListener('click', function () {
      if (firstDone) return;
      firstDone = true;
      playClick();
      try { P3.unlockAudio(); } catch (e) { /* ignore */ }
    }, true);
  }

  // Stage 2 -> 3 and Stage 3 -> 4: only the click that is really accepted makes the sound
  var sharedMoon = theMoon();
  if (sharedMoon) {
    sharedMoon.addEventListener('click', function () {
      if (P2.getState() === 'READY_FOR_NEXT_STAGE' || P3.getState() === 'READY_FOR_PHASE4') playClick();
    }, true);
  }

  // Stage 2 -> Stage 3 (runs inside the moon click, so the song may start)
  P2.onNextStage = function () {
    body.classList.add('is-phase3', 'is-p2-leaving');
    P3.start({ moon: theMoon() });
    // Stage 2's animation loop is no longer needed once its lettering has dissolved
    window.setTimeout(function () { try { P2.destroy(); } catch (e) { /* ignore */ } }, 2600);
  };

  // Stage 3 -> Stage 4 (runs inside the moon click)
  P3.onNextStage = function () {
    body.classList.add('is-phase4');
    P4.start({ moon: theMoon() });
    window.setTimeout(function () { try { P3.destroy(); } catch (e) { /* ignore */ } }, 400);
  };
})();