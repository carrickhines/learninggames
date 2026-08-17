/* ==========================================================================
   Log — what was played, when, and how it went.

   This exists for the grown-ups: a record of every session and every question
   answered, so a parent can see which games were played, at what time of day,
   and — the useful part — exactly which questions were missed and what was
   answered instead.

   Why a separate storage key
   --------------------------
   Save.write() re-serializes the entire save blob on every correct answer. A
   few thousand question records in that blob would mean stringifying hundreds
   of kilobytes per answer on an iPad. So the log lives in its own key, is
   buffered in memory while playing, and is written only at the end of a run
   (or when the page goes away).

   Usage:
     Log.startSession({ game, track, mode });   // at the start of a run
     Log.answer({ q, given, ok, ms });          // per question, buffered
     Log.endSession({ won, gold });             // flushes

   Nothing here may throw. A parent losing a record is a shame; a child losing
   a battle to a storage error is not acceptable.
   ========================================================================== */

var Log = (function () {
  'use strict';

  var KEY = 'lg_log_v1';

  /* A rolling cap, oldest dropped first. ~3,000 answers is a couple of months
     of daily play at roughly 250 KB — comfortably inside the localStorage
     budget, and far more history than anyone reviews. */
  var MAX_ANSWERS = 3000;
  var MAX_SESSIONS = 300;

  /* Records are stored with short keys because there are thousands of them:
       answers   { t: when, g: game, k: track, q: question, a: given,
                   r: the right answer, c: correct(1/0), ms: time taken }

     `r` is what makes The Rematch possible: without the right answer on
     record, a missed question can be shown again but not marked. It is only
     set for questions that can be re-asked as they were — typed answers.
     Records written before this existed simply aren't replayable.
       sessions  { t: started, e: ended, g: game, k: track, m: mode,
                   r: right, w: wrong, gold: earned, won: 1/0 } */

  var buffer = [];        // answers not yet written
  var session = null;     // the run in progress
  var cache = null;       // the parsed store

  function read() {
    if (cache) return cache;
    try {
      var raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : {};
      if (!cache || typeof cache !== 'object') cache = {};
    } catch (e) {
      cache = {};         // unreadable: start a fresh log rather than crash
    }
    return cache;
  }

  function bucket(profileId) {
    var store = read();
    if (!store[profileId]) store[profileId] = { answers: [], sessions: [] };
    if (!store[profileId].answers) store[profileId].answers = [];
    if (!store[profileId].sessions) store[profileId].sessions = [];
    return store[profileId];
  }

  function activeId() {
    try {
      var d = Save.load();
      return d && d.active;
    } catch (e) {
      return null;
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(read()));
      return true;
    } catch (e) {
      /* Out of room. Drop the oldest half and try once more — a truncated
         history beats a log that silently stops recording forever. */
      try {
        var store = read();
        Object.keys(store).forEach(function (id) {
          var b = store[id];
          b.answers = b.answers.slice(Math.floor(b.answers.length / 2));
          b.sessions = b.sessions.slice(Math.floor(b.sessions.length / 2));
        });
        localStorage.setItem(KEY, JSON.stringify(store));
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  /* ---------- Recording ---------------------------------------------------
     answer() only pushes onto an array. No JSON, no storage, nothing that
     could be felt mid-battle. */

  function startSession(info) {
    flush();                       // never let one run bleed into the next
    session = {
      t: Date.now(), e: 0,
      g: (info && info.game) || '?',
      k: (info && info.track) || '',
      m: (info && info.mode) || '',
      r: 0, w: 0, gold: 0, won: 0
    };
  }

  function answer(rec) {
    if (!rec) return;
    var ok = rec.ok ? 1 : 0;
    if (session) {
      if (ok) session.r++; else session.w++;
    }
    buffer.push({
      t: Date.now(),
      g: (session && session.g) || (rec.game || '?'),
      // a re-asked question is recorded against the track it came from, so
      // the parent report doesn't fill with a track called "rematch"
      k: rec.track || (session && session.k) || '',
      q: String(rec.q == null ? '' : rec.q).slice(0, 80),
      a: String(rec.given == null ? '' : rec.given).slice(0, 40),
      r: rec.right == null ? '' : String(rec.right).slice(0, 40),
      c: ok,
      ms: Math.max(0, Math.round(rec.ms || 0))
    });
  }

  function endSession(result) {
    if (session) {
      session.e = Date.now();
      session.won = (result && result.won) ? 1 : 0;
      session.gold = (result && result.gold) || 0;
    }
    flush();
  }

  /* Write everything buffered. Safe to call any time, including with nothing
     to write. */
  function flush() {
    var id = activeId();
    if (!id) { buffer = []; session = null; return; }
    if (!buffer.length && !session) return;

    var b = bucket(id);
    if (buffer.length) {
      b.answers = b.answers.concat(buffer);
      if (b.answers.length > MAX_ANSWERS) {
        b.answers = b.answers.slice(b.answers.length - MAX_ANSWERS);
      }
      buffer = [];
    }
    if (session) {
      if (!session.e) session.e = Date.now();
      b.sessions.push(session);
      if (b.sessions.length > MAX_SESSIONS) {
        b.sessions = b.sessions.slice(b.sessions.length - MAX_SESSIONS);
      }
      session = null;
    }
    persist();
  }

  /* Closing the iPad mid-battle shouldn't lose the morning's work. */
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  /* ---------- Reading it back (the parent view) ---------------------------- */

  function forProfile(id) {
    id = id || activeId();
    if (!id) return { answers: [], sessions: [] };
    var b = bucket(id);
    return { answers: b.answers.slice(), sessions: b.sessions.slice() };
  }

  /* Sessions newest first, with the derived bits the view wants. */
  function sessions(id) {
    return forProfile(id).sessions.slice().reverse().map(function (s) {
      var total = s.r + s.w;
      return {
        when: s.t,
        minutes: Math.max(1, Math.round(((s.e || s.t) - s.t) / 60000)),
        game: s.g, track: s.k, mode: s.m,
        right: s.r, wrong: s.w,
        accuracy: total ? Math.round((s.r / total) * 100) : 0,
        gold: s.gold, won: !!s.won
      };
    });
  }

  /* Accuracy per track, worst first — a weak spot should be obvious. */
  function byTrack(id) {
    var rows = {};
    forProfile(id).answers.forEach(function (a) {
      var key = a.g + '/' + a.k;
      if (!rows[key]) rows[key] = { game: a.g, track: a.k, right: 0, wrong: 0, ms: 0 };
      if (a.c) rows[key].right++; else rows[key].wrong++;
      rows[key].ms += a.ms;
    });
    return Object.keys(rows).map(function (k) {
      var r = rows[k];
      var total = r.right + r.wrong;
      r.total = total;
      r.accuracy = total ? Math.round((r.right / total) * 100) : 0;
      r.avgSec = total ? (r.ms / total / 1000) : 0;
      return r;
    }).sort(function (a, b) { return a.accuracy - b.accuracy; });
  }

  /* The review list: questions actually missed, most-missed first, with what
     was answered instead. This is the point of the whole module. */
  function missed(id, limit) {
    var answers = forProfile(id).answers;
    var rows = {};

    /* Two passes on purpose. Counting the right answers as we go would only
       catch the ones that came AFTER the first miss, which quietly undercounts
       — and "missed 3 times but has since got it right 8 times" is a very
       different report from "missed 3 times out of 3". */
    answers.forEach(function (a) {
      var key = a.g + '|' + a.q;
      if (!rows[key]) {
        rows[key] = { game: a.g, track: a.k, q: a.q,
                      misses: 0, right: 0, gave: [], last: 0 };
      }
      var r = rows[key];
      if (a.c) {
        r.right++;
      } else {
        r.misses++;
        r.last = Math.max(r.last, a.t);
        if (a.a && r.gave.indexOf(a.a) === -1 && r.gave.length < 4) r.gave.push(a.a);
      }
    });

    return Object.keys(rows)
      .map(function (k) { return rows[k]; })
      .filter(function (r) { return r.misses > 0; })
      .sort(function (a, b) { return b.misses - a.misses || b.last - a.last; })
      .slice(0, limit || 40);
  }

  /* Headline numbers for the top of the parent view. */
  function summary(id) {
    var a = forProfile(id).answers;
    var right = a.filter(function (x) { return x.c; }).length;
    var ss = forProfile(id).sessions;
    var minutes = ss.reduce(function (n, s) {
      return n + Math.max(1, Math.round(((s.e || s.t) - s.t) / 60000));
    }, 0);
    return {
      answers: a.length,
      right: right,
      accuracy: a.length ? Math.round((right / a.length) * 100) : 0,
      sessions: ss.length,
      minutes: minutes,
      since: a.length ? a[0].t : 0
    };
  }

  /* ---------- The Rematch ----------------------------------------------
     Which questions are owed another go.

     A question is due once it has been missed and hasn't yet been answered
     correctly `RETIRE` times in a row since. The streak is read straight back
     out of the answer log, so a Rematch answer counts towards retiring the
     question simply by being recorded — there is no second store to keep in
     step with the first.

     Only questions with a right answer on record can be served. A question
     answered by tapping a picture can't be reconstructed from a log line, and
     serving it with a guessed answer would ask the wrong question. */

  var RETIRE = 3;

  function due(game, limit) {
    var rows = {};
    forProfile().answers.forEach(function (a) {
      if (game && a.g !== game) return;
      if (!a.r) return;                    // not replayable
      var key = a.g + '|' + a.q;
      if (!rows[key]) {
        rows[key] = { game: a.g, track: a.k, q: a.q, r: a.r,
                      misses: 0, streak: 0, last: 0 };
      }
      var row = rows[key];
      row.r = a.r;                         // the answer as most recently known
      row.track = a.k;
      if (a.c) {
        row.streak++;
      } else {
        row.streak = 0;
        row.misses++;
        row.last = a.t;
      }
    });

    return Object.keys(rows)
      .map(function (k) { return rows[k]; })
      .filter(function (r) { return r.misses > 0 && r.streak < RETIRE; })
      .sort(function (a, b) { return b.misses - a.misses || b.last - a.last; })
      .slice(0, limit || 40);
  }

  function dueCount(game) { return due(game, 999).length; }

  /* Everything, as CSV, for anyone who wants a spreadsheet. */
  function csv(id) {
    var out = ['when,game,track,question,answered,right answer,correct,seconds'];
    forProfile(id).answers.forEach(function (a) {
      out.push([
        new Date(a.t).toISOString(),
        a.g, a.k,
        '"' + String(a.q).replace(/"/g, '""') + '"',
        '"' + String(a.a).replace(/"/g, '""') + '"',
        '"' + String(a.r || '').replace(/"/g, '""') + '"',
        a.c ? 'yes' : 'no',
        (a.ms / 1000).toFixed(1)
      ].join(','));
    });
    return out.join('\n');
  }

  function clear(id) {
    id = id || activeId();
    var store = read();
    delete store[id];
    buffer = [];
    session = null;
    persist();
  }

  return {
    startSession: startSession,
    answer: answer,
    endSession: endSession,
    flush: flush,

    forProfile: forProfile,
    sessions: sessions,
    byTrack: byTrack,
    missed: missed,
    due: due,
    dueCount: dueCount,
    RETIRE: RETIRE,
    summary: summary,
    csv: csv,
    clear: clear,

    _key: KEY,
    _max: MAX_ANSWERS,
    _buffered: function () { return buffer.length; },
    _reload: function () { cache = null; }
  };
})();
