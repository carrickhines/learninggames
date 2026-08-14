/* ==========================================================================
   The iPad-game-time countdown.

   One implementation for the whole site. It renders its own markup, so every
   game shows the identical reward panel and there is only one place to fix a
   timer bug.

   Usage:
     Reward.mount(document.getElementById('reward'));   // once, at load
     Reward.offer(8);                                   // "you earned 8 minutes"
     Reward.clear();                                    // on any navigation away

   Known iOS limitation, by design: this only runs while the page is open and
   in the foreground. iOS Safari freezes JS timers and Web Audio in
   backgrounded tabs, and a web page cannot bring itself to the front. That's
   why the panel nudges the player to keep the screen open or ask Siri. Don't
   try to "fix" it with notifications — that needs an installed PWA and still
   can't schedule a future alarm without live JS.
   ========================================================================== */

var Reward = (function () {
  'use strict';

  var root = null;      // the container we rendered into
  var n = {};           // our nodes
  var mins = 0;
  var tickId = null;
  var endAt = 0;
  var onDone = null;

  function fmtClock(totalSec) {
    var m = Math.floor(totalSec / 60), s = totalSec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function mount(el, opts) {
    root = el;
    onDone = (opts && opts.onDone) || null;
    root.classList.add('reward');
    root.innerHTML =
      '<div class="reward-line">🎮 You earned <b class="r-mins">7</b> minutes of iPad game time!</div>' +
      '<div id="rewardStart">' +
        '<button class="r-start">⏱️ Start the timer</button>' +
        '<div class="reward-hint">Keep this screen open so the alarm can ring — or ' +
          'ask Siri to set a timer for <span class="r-mins">7</span> minutes.</div>' +
      '</div>' +
      '<div id="countdownBox" class="hidden">' +
        '<div class="countdown">7:00</div>' +
        '<div class="countdown-label">iPad time left</div>' +
        '<button class="r-cancel ghost-btn">Cancel</button>' +
      '</div>';

    n = {
      minsAll: root.querySelectorAll('.r-mins'),
      start: root.querySelector('.r-start'),
      startBox: root.querySelector('#rewardStart'),
      box: root.querySelector('#countdownBox'),
      clock: root.querySelector('.countdown'),
      label: root.querySelector('.countdown-label'),
      cancel: root.querySelector('.r-cancel')
    };

    n.start.addEventListener('click', function () {
      Sound.unlock();
      Sound.click();
      begin();
    });
    n.cancel.addEventListener('click', dismiss);
    return Reward;
  }

  /* Show the "you earned N minutes" state with the Start button. */
  function offer(m) {
    if (!root) return;
    mins = m;
    clear();
    Array.prototype.forEach.call(n.minsAll, function (s) { s.textContent = m; });
    root.classList.remove('hidden');
    n.startBox.classList.remove('hidden');
    n.box.classList.add('hidden');
  }

  function hide() {
    if (!root) return;
    clear();
    root.classList.add('hidden');
  }

  function begin() {
    if (!root) return;
    n.startBox.classList.add('hidden');
    n.box.classList.remove('hidden', 'ringing');
    n.cancel.textContent = 'Cancel';
    n.label.textContent = 'iPad time left';
    n.clock.textContent = fmtClock(mins * 60);
    // Track a wall-clock end time so a delayed tick can't drift the total.
    endAt = Date.now() + mins * 60 * 1000;
    tickId = setInterval(function () {
      var left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      n.clock.textContent = fmtClock(left);
      if (left <= 0) ring();
    }, 250);
  }

  function ring() {
    if (tickId) { clearInterval(tickId); tickId = null; }
    n.clock.textContent = '0:00';
    n.label.textContent = "⏰ TIME'S UP!";
    n.box.classList.add('ringing');
    n.cancel.textContent = '🔕 Stop alarm';
    Sound.startAlarm();
    if (onDone) onDone();
  }

  /* Cancel mid-countdown, or silence the alarm, then reset to the offer state. */
  function dismiss() {
    Sound.click();
    clear();
    n.box.classList.add('hidden');
    n.startBox.classList.remove('hidden');
  }

  /* Stop everything. Safe to call any time, including before mount() — every
     navigation away from a reward screen must call this so the alarm can
     never bleed into the next screen. */
  function clear() {
    if (tickId) { clearInterval(tickId); tickId = null; }
    if (typeof Sound !== 'undefined') Sound.stopAlarm();
    if (root && n.box) n.box.classList.remove('ringing');
  }

  return {
    mount: mount,
    offer: offer,
    hide: hide,
    clear: clear,
    isMounted: function () { return !!root; },
    fmtClock: fmtClock
  };
})();
