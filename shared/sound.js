/* ==========================================================================
   Sound — every effect synthesized at runtime with the Web Audio API.

   There are no audio files to ship, so the games stay self-contained and work
   from file://. One module for all three games; each game calls the subset of
   effects it needs.

   The mute preference is shared across the whole site (one key, `lg_muted`),
   so muting in the hub keeps the games quiet too.

   Usage:
     Sound.unlock();        // once, from a user gesture (browser autoplay rules)
     Sound.hit();
     Sound.muted = true;    // settable property; persists automatically
   ========================================================================== */

var Sound = (function () {
  'use strict';

  var KEY = 'lg_muted';
  var ctx = null;
  var alarmTimer = null;

  function readMuted() {
    try {
      var v = localStorage.getItem(KEY);
      if (v !== null) return v === '1';
      // First run after the merge: inherit whichever per-game preference existed.
      return localStorage.getItem('mathrpg_muted') === '1' ||
             localStorage.getItem('langrpg_muted') === '1' ||
             localStorage.getItem('storyquest_muted') === '1';
    } catch (e) {
      return false;   // private mode / storage disabled: just play sound
    }
  }

  var muted = readMuted();

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* One tone with a quick attack/decay envelope and an optional pitch slide.
     Accepts either shape, because the games were written against both:
       tone(freq, dur, { type, vol, delay, slideTo })
       tone(freq, dur, type, vol, delay)                */
  function tone(freq, dur, a, b, c2) {
    var o = (typeof a === 'string') ? { type: a, vol: b, delay: c2 } : (a || {});
    var c = ensure();
    if (!c || muted) return;
    var type = o.type || 'square';
    var vol = o.vol == null ? 0.2 : o.vol;
    var delay = o.delay || 0;
    var slideTo = o.slideTo || null;
    var t0 = c.currentTime + delay;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* Decaying white-noise burst — impacts, poofs, the push-together whoosh. */
  function noise(dur, opts) {
    var o = opts || {};
    var c = ensure();
    if (!c || muted) return;
    var vol = o.vol == null ? 0.2 : o.vol;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    g.gain.value = vol;
    src.connect(g).connect(c.destination);
    src.start(c.currentTime + (o.delay || 0));
  }

  var S = {
    tone: tone,
    noise: noise,

    /* Call once from a user gesture so the audio context is unlocked. */
    unlock: function () { ensure(); },

    isMuted: function () { return muted; },
    toggle: function () { S.muted = !muted; return muted; },

    /* ---------- UI ---------- */
    click: function () { tone(660, 0.06, { type: 'triangle', vol: 0.12 }); },
    tap: function () { tone(880, 0.08, { type: 'triangle', vol: 0.12 }); },
    page: function () { tone(880, 0.05, { type: 'triangle', vol: 0.08 }); },

    /* ---------- Combat ---------- */
    hit: function () {
      tone(190, 0.12, { type: 'square', vol: 0.25, slideTo: 90 });
      noise(0.12, { vol: 0.14 });
    },
    super: function () {
      tone(523, 0.08, { type: 'square', vol: 0.2 });
      tone(784, 0.08, { type: 'square', vol: 0.2, delay: 0.08 });
      tone(1047, 0.14, { type: 'square', vol: 0.22, delay: 0.16 });
      noise(0.16, { vol: 0.16, delay: 0.16 });
    },
    hurt: function () { tone(150, 0.25, { type: 'sawtooth', vol: 0.22, slideTo: 70 }); },
    wrong: function () {
      tone(330, 0.12, { type: 'sine', vol: 0.18 });
      tone(247, 0.18, { type: 'sine', vol: 0.18, delay: 0.12 });
    },
    ko: function () {
      noise(0.25, { vol: 0.2 });
      tone(420, 0.22, { type: 'triangle', vol: 0.18, slideTo: 120 });
    },

    /* ---------- Answers ---------- */
    right: function () {
      tone(660, 0.1, { type: 'triangle', vol: 0.16 });
      tone(990, 0.14, { type: 'triangle', vol: 0.16, delay: 0.09 });
    },
    chest: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.12, { type: 'triangle', vol: 0.16, delay: i * 0.08 });
      });
    },

    /* ---------- Number blocks (math) ---------- */
    blockTap: function () { tone(600, 0.08, { type: 'triangle', vol: 0.14 }); },
    count: function (i) { tone(440 + i * 45, 0.07, { type: 'triangle', vol: 0.16 }); },
    push: function () {
      noise(0.3, { vol: 0.12 });
      tone(220, 0.3, { type: 'sine', vol: 0.12, slideTo: 440 });
    },

    /* ---------- Progression ---------- */
    coin: function () {
      tone(988, 0.07, { type: 'square', vol: 0.13 });
      tone(1319, 0.11, { type: 'square', vol: 0.13, delay: 0.06 });
    },
    levelUp: function () {
      [523, 659, 784, 1047, 1319].forEach(function (f, i) {
        tone(f, 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.1 });
      });
    },
    buy: function () {
      tone(784, 0.09, { type: 'triangle', vol: 0.16 });
      tone(1175, 0.13, { type: 'triangle', vol: 0.16, delay: 0.08 });
      noise(0.1, { vol: 0.07, delay: 0.02 });
    },
    cardGet: function () {
      [659, 880, 1319].forEach(function (f, i) {
        tone(f, 0.15, { type: 'triangle', vol: 0.18, delay: i * 0.11 });
      });
      noise(0.18, { vol: 0.08 });
    },
    denied: function () { tone(200, 0.16, { type: 'square', vol: 0.14, slideTo: 140 }); },

    /* ---------- End of run ---------- */
    victory: function () {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) {
        tone(f, 0.2, { type: 'triangle', vol: 0.18, delay: i * 0.14 });
      });
    },
    gameover: function () {
      [392, 330, 262, 196].forEach(function (f, i) {
        tone(f, 0.3, { type: 'triangle', vol: 0.18, delay: i * 0.25 });
      });
    },

    /* Looping "time's up" alarm: a classic two-tone beep that repeats until
       stopAlarm() is called. Respects the mute toggle like every other sound.
       (Only rings while the page is in the foreground — iOS suspends audio in
       backgrounded tabs. That limitation is documented, not a bug.) */
    startAlarm: function () {
      S.stopAlarm();
      var ring = function () {
        tone(880, 0.18, { type: 'square', vol: 0.3 });
        tone(660, 0.20, { type: 'square', vol: 0.3, delay: 0.22 });
      };
      ring();
      alarmTimer = setInterval(ring, 750);
    },
    stopAlarm: function () {
      if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
    }
  };

  /* Aliases so each game keeps calling the effect by the name it always used. */
  S.win = S.victory;
  S.lose = S.gameover;
  S.superHit = S.super;

  /* `muted` is a real property: games do `Sound.muted = !Sound.muted`, and
     that has to persist without them knowing the storage key. */
  Object.defineProperty(S, 'muted', {
    get: function () { return muted; },
    set: function (v) {
      muted = !!v;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* storage off */ }
      if (!muted) tone(660, 0.08, { type: 'triangle', vol: 0.15 });
      if (muted) S.stopAlarm();
    }
  });

  return S;
})();
