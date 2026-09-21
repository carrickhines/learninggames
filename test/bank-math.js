/* ==========================================================================
   bank-math.js — the mathematics item bank, both grade bands.

   MAP Growth reports maths in four instructional areas at every grade, and
   the test deals items round-robin across them so all four are sampled
   however the child is doing:

     oa   Operations and Algebraic Thinking
     nbt  Number and Operations   (counting, place value, fractions)
     md   Measurement and Data
     geo  Geometry

   Half of that is content this site has never taught. There is no geometry
   anywhere in Math RPG, no measurement beyond coins and a clock, and no data
   at all -- so `md` and `geo` are written from scratch here, and `oa`/`nbt`
   port the logic of the existing MAKERS rather than importing it (those live
   inside an IIFE in math/index.html and are not reachable across pages; a
   copy also keeps the shipped games untouched).

   An item is:

     { id, b, a, d, t, make(R) }

       b  which band it belongs to: 'k', 'g', or 'kg' for one that serves both
       a  instructional area
       d  difficulty on the RIT-ish scale the engine estimates on
       t  item type -- 'choice' unless stated
       R  a seeded random function, so a second sitting is not a memory test

   `d` is eyeballed against NWEA's published norms: ~136 is a typical
   kindergartner in the autumn, ~150 a strong one, ~168 first grade, ~180
   second, ~190 third, ~205 fifth. The engine only needs these to be right
   *relative to each other*; content.py checks each area covers its band's
   whole range with no gap a climbing child could fall into.
   ========================================================================== */

var BANK_MATH = (function () {
  'use strict';

  var D = Draw;

  // ---------- the small change ----------
  function ri(R, lo, hi) { return lo + Math.floor(R() * (hi - lo + 1)); }
  function pick(R, a) { return a[Math.floor(R() * a.length)]; }

  function shuffle(R, a) {
    var out = a.slice(), i, j, t;
    for (i = out.length - 1; i > 0; i--) {
      j = Math.floor(R() * (i + 1));
      t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  var big = function (v) { return '<span class="big">' + v + '</span>'; };

  /* Build a multiple choice from one right answer and some wrong ones.

     Duplicates are dropped keeping the right answer, so a distractor that
     happens to collide can never produce two correct options -- the bug this
     helper exists to make impossible.

     Capped at four options. Several items hand in four distractors, which
     quietly produced a five-option question sitting next to four-option ones;
     the real test is consistently four, and a stray fifth reads as a mistake
     even when it is not. Items that deliberately offer two (this one or that
     one) build their choices directly and do not come through here. */
  function mc(R, right, wrongs, fmt) {
    fmt = fmt || String;
    var list = [right], seen = {}, i;
    seen[String(right)] = 1;
    for (i = 0; i < wrongs.length && list.length < 4; i++) {
      if (!seen[String(wrongs[i])]) { seen[String(wrongs[i])] = 1; list.push(wrongs[i]); }
    }
    var sh = shuffle(R, list), idx = -1;
    for (i = 0; i < sh.length; i++) if (String(sh[i]) === String(right)) idx = i;
    return { choices: sh.map(function (v) { return { html: fmt(v) }; }), answer: idx };
  }

  /* Wrong numbers near a right one: the off-by-ones and the common slips,
     never the answer itself and never below `lo`. */
  function near(R, right, n, lo, hi) {
    lo = lo == null ? 0 : lo;
    var out = [], tries = 0, v;
    var offs = shuffle(R, [1, -1, 2, -2, 3, -3, 10, -10]);
    while (out.length < n && tries < 40) {
      v = right + offs[tries % offs.length] + (tries > 7 ? ri(R, -4, 4) : 0);
      tries++;
      if (v === right || v < lo || (hi != null && v > hi)) continue;
      if (out.indexOf(v) >= 0) continue;
      out.push(v);
    }
    return out;
  }

  var ITEMS = [];
  function item(o) { ITEMS.push(o); return o; }

  /* ======================================================================
     KINDERGARTEN · Operations and Algebraic Thinking
     ====================================================================== */

  var THINGS = ['🍎', '🐟', '🐻', '⭐', '🍪', '🦋', '🎈', '🐢', '🌸', '🚗'];

  item({ id: 'k-oa-onemore', b: 'k', a: 'oa', d: 114, make: function (R) {
    var e = pick(R, THINGS), n = ri(R, 2, 6);
    var q = mc(R, n + 1, near(R, n + 1, 3, 1, 10), big);
    return {
      stem: 'There are ' + n + '. One more comes. How many now?',
      say: 'There are ' + n + '. One more comes. How many are there now?',
      art: D.counters(n, e),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-join5', b: 'k', a: 'oa', d: 120, make: function (R) {
    var e = pick(R, THINGS), a = ri(R, 1, 3), b = ri(R, 1, 5 - a);
    var q = mc(R, a + b, near(R, a + b, 3, 1, 12), big);
    return {
      stem: 'How many altogether?',
      say: 'How many altogether?',
      art: D.groups(a, b, e, e, '', ''),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-sum10', b: 'k', a: 'oa', d: 132, make: function (R) {
    var e = pick(R, THINGS), a = ri(R, 2, 6), b = ri(R, 2, 10 - a);
    var q = mc(R, a + b, near(R, a + b, 3, 1, 20), big);
    return {
      stem: a + ' and ' + b + ' more. How many altogether?',
      say: a + ' and ' + b + ' more. How many altogether?',
      art: D.groups(a, b, e, e, '', ''),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-take5', b: 'k', a: 'oa', d: 128, make: function (R) {
    var e = pick(R, THINGS), n = ri(R, 3, 5), g = ri(R, 1, n - 1);
    var q = mc(R, n - g, near(R, n - g, 3, 0, 10), big);
    return {
      stem: 'There were ' + n + '. Then ' + g + ' went away. How many are left?',
      say: 'There were ' + n + '. Then ' + g + ' went away. How many are left?',
      art: D.counters(n, e),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-take10', b: 'k', a: 'oa', d: 140, make: function (R) {
    var e = pick(R, THINGS), n = ri(R, 6, 10), g = ri(R, 2, n - 1);
    var q = mc(R, n - g, near(R, n - g, 3, 0, 14), big);
    return {
      stem: n + ' take away ' + g + ' is how many?',
      say: n + ' take away ' + g + ' is how many?',
      art: D.counters(n, e),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-story', b: 'k', a: 'oa', d: 148, make: function (R) {
    var s = pick(R, [
      { t: 'Mia had {a} stickers. She gave {b} to her friend. How many does she have now?', op: -1 },
      { t: 'There were {a} birds on a branch. {b} more flew in. How many birds are there now?', op: 1 },
      { t: 'Sam baked {a} muffins. He ate {b}. How many muffins are left?', op: -1 },
      { t: 'A box has {a} crayons. You put {b} more in. How many crayons are in the box?', op: 1 }
    ]);
    var a = ri(R, 4, 9), b = ri(R, 1, s.op < 0 ? a - 1 : 10 - a);
    var ans = a + s.op * b;
    var q = mc(R, ans, near(R, ans, 3, 0, 20), big);
    return {
      stem: s.t.replace('{a}', a).replace('{b}', b),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-make10', b: 'k', a: 'oa', d: 152, make: function (R) {
    var a = ri(R, 4, 9);
    var q = mc(R, 10 - a, near(R, 10 - a, 3, 0, 10), big);
    return {
      stem: a + ' and how many more makes 10?',
      say: a + ' and how many more makes ten?',
      art: D.tenFrame(a),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-oa-three', b: 'k', a: 'oa', d: 160, make: function (R) {
    var a = ri(R, 1, 5), b = ri(R, 1, 5), c = ri(R, 1, 5);
    var q = mc(R, a + b + c, near(R, a + b + c, 3, 1, 25), big);
    return { stem: a + ' + ' + b + ' + ' + c + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-oa-add20', b: 'kg', a: 'oa', d: 168, make: function (R) {
    var a = ri(R, 8, 14), b = ri(R, 3, 8);
    var q = mc(R, a + b, near(R, a + b, 3, 1, 30), big);
    return { stem: a + ' + ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-oa-missing', b: 'kg', a: 'oa', d: 174, make: function (R) {
    var a = ri(R, 4, 9), s = a + ri(R, 3, 9);
    var q = mc(R, s - a, near(R, s - a, 3, 1, 20), big);
    return { stem: a + ' + <b>?</b> = ' + s, say: a + ' plus what makes ' + s + '?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-oa-sub20', b: 'kg', a: 'oa', d: 178, make: function (R) {
    var a = ri(R, 12, 20), b = ri(R, 3, 9);
    var q = mc(R, a - b, near(R, a - b, 3, 0, 25), big);
    return { stem: a + ' − ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  /* ======================================================================
     KINDERGARTEN · Number and Operations
     ====================================================================== */

  item({ id: 'k-nbt-count5', b: 'k', a: 'nbt', d: 110, make: function (R) {
    var e = pick(R, THINGS), n = ri(R, 2, 5);
    var q = mc(R, n, near(R, n, 3, 1, 9), big);
    return { stem: 'How many do you see?', say: 'How many do you see?',
             art: D.counters(n, e), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-count10', b: 'k', a: 'nbt', d: 122, make: function (R) {
    var e = pick(R, THINGS), n = ri(R, 6, 10);
    var q = mc(R, n, near(R, n, 3, 1, 15), big);
    return { stem: 'How many do you see?', say: 'How many do you see?',
             art: D.counters(n, e), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-numeral', b: 'k', a: 'nbt', d: 126, make: function (R) {
    var e = pick(R, THINGS), n = ri(R, 3, 9);
    var wrongs = shuffle(R, near(R, n, 3, 1, 12)).slice(0, 3);
    var all = shuffle(R, [n].concat(wrongs));
    return {
      stem: 'Which group has ' + n + '?',
      say: 'Which group has ' + n + '?',
      choices: all.map(function (v) { return { html: '<span style="font-size:26px">' + new Array(v + 1).join(e) + '</span>' }; }),
      answer: all.indexOf(n), cols: 2, pic: true
    };
  } });

  item({ id: 'k-nbt-morefewer', b: 'k', a: 'nbt', d: 128, make: function (R) {
    var ea = pick(R, THINGS), eb = pick(R, THINGS);
    var a = ri(R, 3, 9), b = ri(R, 3, 9);
    while (b === a) b = ri(R, 3, 9);
    var more = R() < 0.5;
    var right = more ? (a > b ? 'A' : 'B') : (a < b ? 'A' : 'B');
    return {
      stem: 'Which group has ' + (more ? '<b>more</b>' : '<b>fewer</b>') + '?',
      say: 'Which group has ' + (more ? 'more' : 'fewer') + '?',
      art: D.groups(a, b, ea, eb, 'Group A', 'Group B'),
      choices: [{ html: 'Group A' }, { html: 'Group B' }],
      answer: right === 'A' ? 0 : 1, cols: 2
    };
  } });

  item({ id: 'k-nbt-next', b: 'k', a: 'nbt', d: 134, make: function (R) {
    var n = ri(R, 4, 28);
    var q = mc(R, n + 1, near(R, n + 1, 3, 1, 40), big);
    return { stem: n - 2 + ', ' + (n - 1) + ', ' + n + ', <b>?</b>',
             say: 'What number comes next? ' + (n - 2) + ', ' + (n - 1) + ', ' + n + '.',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-oneless', b: 'k', a: 'nbt', d: 142, make: function (R) {
    var n = ri(R, 6, 20), less = R() < 0.5;
    var ans = less ? n - 1 : n + 1;
    var q = mc(R, ans, near(R, ans, 3, 0, 30), big);
    return { stem: 'What is one ' + (less ? '<b>less</b>' : '<b>more</b>') + ' than ' + n + '?',
             say: 'What is one ' + (less ? 'less' : 'more') + ' than ' + n + '?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-order', b: 'k', a: 'nbt', d: 148, t: 'order', make: function (R) {
    var base = ri(R, 3, 14);
    var ns = shuffle(R, [base, base + ri(R, 2, 4), base + ri(R, 6, 9)]);
    var sorted = ns.slice().sort(function (x, y) { return x - y; });
    return {
      stem: 'Tap the numbers in order, smallest first.',
      say: 'Tap the numbers in order. Start with the smallest.',
      cards: ns.map(function (v) { return { html: '<span class="big">' + v + '</span>', r: sorted.indexOf(v) }; })
    };
  } });

  item({ id: 'k-nbt-between', b: 'k', a: 'nbt', d: 154, make: function (R) {
    var n = ri(R, 5, 25);
    var q = mc(R, n, [n - 2, n + 2, n + 3, n - 3], big);
    return { stem: 'Which number comes between ' + (n - 1) + ' and ' + (n + 1) + '?',
             say: 'Which number comes between ' + (n - 1) + ' and ' + (n + 1) + '?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-skip', b: 'k', a: 'nbt', d: 158, make: function (R) {
    var by = pick(R, [2, 5, 10]), start = by * ri(R, 1, 4);
    var ans = start + by * 3;
    var q = mc(R, ans, [ans + by, ans - by, ans + 1, ans - 1], big);
    return { stem: start + ', ' + (start + by) + ', ' + (start + by * 2) + ', <b>?</b>',
             say: 'Counting by ' + by + '. ' + start + ', ' + (start + by) + ', ' +
                  (start + by * 2) + '. What comes next?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-tens', b: 'kg', a: 'nbt', d: 164, make: function (R) {
    var t = ri(R, 2, 8), o = ri(R, 1, 9);
    var ans = t * 10 + o;
    var q = mc(R, ans, [o * 10 + t, ans + 10, ans - 10, ans + 1], big);
    return { stem: t + ' tens and ' + o + ' ones make what number?',
             say: t + ' tens and ' + o + ' ones make what number?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-nbt-compare2d', b: 'kg', a: 'nbt', d: 172, make: function (R) {
    var a = ri(R, 21, 89), b = ri(R, 21, 89);
    while (b === a) b = ri(R, 21, 89);
    var greater = R() < 0.5;
    return {
      stem: 'Which number is ' + (greater ? '<b>greater</b>' : '<b>less</b>') + '?',
      say: 'Which number is ' + (greater ? 'greater' : 'less') + '?',
      choices: [{ html: big(a) }, { html: big(b) }],
      answer: (greater ? a > b : a < b) ? 0 : 1, cols: 2
    };
  } });

  item({ id: 'k-nbt-howmanytens', b: 'kg', a: 'nbt', d: 178, make: function (R) {
    var t = ri(R, 3, 9), o = ri(R, 1, 9), n = t * 10 + o;
    var q = mc(R, t, [o, t + 1, n, t - 1], big);
    return { stem: 'How many <b>tens</b> are in ' + n + '?',
             say: 'How many tens are in ' + n + '?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  /* ======================================================================
     KINDERGARTEN · Measurement and Data          (nothing like this exists)
     ====================================================================== */

  item({ id: 'k-md-longer', b: 'k', a: 'md', d: 112, make: function (R) {
    var a = ri(R, 3, 6), b = ri(R, 7, 12), longer = R() < 0.5;
    var first = R() < 0.5;
    var list = first ? [{ len: a, label: 'A' }, { len: b, label: 'B' }]
                     : [{ len: b, label: 'A' }, { len: a, label: 'B' }];
    var longA = list[0].len > list[1].len;
    return {
      stem: 'Which one is ' + (longer ? '<b>longer</b>' : '<b>shorter</b>') + '?',
      say: 'Which one is ' + (longer ? 'longer' : 'shorter') + '?',
      art: D.lengths(list),
      choices: [{ html: 'A' }, { html: 'B' }],
      answer: (longer ? longA : !longA) ? 0 : 1, cols: 2
    };
  } });

  item({ id: 'k-md-taller', b: 'k', a: 'md', d: 120, make: function (R) {
    var a = ri(R, 3, 6), b = ri(R, 8, 13), taller = R() < 0.5;
    var first = R() < 0.5;
    var list = first ? [{ len: a, label: 'A' }, { len: b, label: 'B' }]
                     : [{ len: b, label: 'A' }, { len: a, label: 'B' }];
    var tallA = list[0].len > list[1].len;
    return {
      stem: 'Which one is ' + (taller ? '<b>taller</b>' : '<b>shorter</b>') + '?',
      say: 'Which one is ' + (taller ? 'taller' : 'shorter') + '?',
      art: D.heights(list),
      choices: [{ html: 'A' }, { html: 'B' }],
      answer: (taller ? tallA : !tallA) ? 0 : 1, cols: 2
    };
  } });

  /* Real-world weight and capacity. The pairs are chosen so the answer is not
     a judgement call for a five-year-old: a feather against a brick, never a
     book against a shoe. */
  var HEAVY = [
    ['🪶', 'feather', '🧱', 'brick'], ['🍃', 'leaf', '🚗', 'car'],
    ['🎈', 'balloon', '🐘', 'elephant'], ['📎', 'paper clip', '🪑', 'chair'],
    ['🐜', 'ant', '🐄', 'cow']
  ];
  item({ id: 'k-md-heavier', b: 'k', a: 'md', d: 126, make: function (R) {
    var p = pick(R, HEAVY), heavier = R() < 0.5, flip = R() < 0.5;
    var opts = flip ? [{ e: p[0], n: p[1] }, { e: p[2], n: p[3] }]
                    : [{ e: p[2], n: p[3] }, { e: p[0], n: p[1] }];
    var heavyIdx = opts[0].n === p[3] ? 0 : 1;
    return {
      stem: 'Which one is ' + (heavier ? '<b>heavier</b>' : '<b>lighter</b>') + '?',
      say: 'Which one is ' + (heavier ? 'heavier' : 'lighter') + '?',
      choices: opts.map(function (o) { return { html: '<span class="big">' + o.e + '</span>' + o.n }; }),
      answer: heavier ? heavyIdx : 1 - heavyIdx, cols: 2, pic: true
    };
  } });

  var HOLDS = [
    ['🥄', 'spoon', '🪣', 'bucket'], ['🥤', 'cup', '🛁', 'bathtub'],
    ['🍶', 'small jug', '🏊', 'swimming pool'], ['🧴', 'bottle', '🚿', 'bath']
  ];
  item({ id: 'k-md-holds', b: 'k', a: 'md', d: 132, make: function (R) {
    var p = pick(R, HOLDS), more = R() < 0.5, flip = R() < 0.5;
    var opts = flip ? [{ e: p[0], n: p[1] }, { e: p[2], n: p[3] }]
                    : [{ e: p[2], n: p[3] }, { e: p[0], n: p[1] }];
    var bigIdx = opts[0].n === p[3] ? 0 : 1;
    return {
      stem: 'Which one holds ' + (more ? '<b>more</b>' : '<b>less</b>') + '?',
      say: 'Which one holds ' + (more ? 'more' : 'less') + '?',
      choices: opts.map(function (o) { return { html: '<span class="big">' + o.e + '</span>' + o.n }; }),
      answer: more ? bigIdx : 1 - bigIdx, cols: 2, pic: true
    };
  } });

  item({ id: 'k-md-sortcount', b: 'k', a: 'md', d: 138, make: function (R) {
    var kinds = shuffle(R, ['🔺', '🟦', '🟡', '🟩']).slice(0, 3);
    var counts = [ri(R, 2, 5), ri(R, 2, 5), ri(R, 2, 5)];
    var all = [], i, k;
    for (k = 0; k < 3; k++) for (i = 0; i < counts[k]; i++) all.push(kinds[k]);
    all = shuffle(R, all);
    var want = ri(R, 0, 2);
    var q = mc(R, counts[want], near(R, counts[want], 3, 1, 12), big);
    return {
      stem: 'How many ' + kinds[want] + ' are there?',
      say: 'Count how many of this shape there are.',
      art: '<div class="counters" style="max-width:340px;margin:0 auto">' + all.join('') + '</div>',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-md-order3', b: 'k', a: 'md', d: 144, t: 'order', make: function (R) {
    var lens = shuffle(R, [4, 8, 12]);
    var sorted = lens.slice().sort(function (a, b) { return a - b; });
    return {
      stem: 'Tap them in order, shortest first.',
      say: 'Tap them in order. Start with the shortest.',
      /* Drawn here rather than through Draw.lengths, which scales each figure
         to its own longest bar -- three cards drawn that way would all come
         out the same length, which is the one thing this item must not do. */
      cards: lens.map(function (v) {
        return { html: '<div style="height:18px;width:' + (v * 8) +
                       'px;margin:14px auto;background:#bcd3f2;border:2px solid #16202e;' +
                       'border-radius:4px"></div>',
                 r: sorted.indexOf(v) };
      })
    };
  } });

  var PICTO_SETS = [
    { title: 'Pets in our class', rows: ['Cats', 'Dogs', 'Fish'], emoji: '🐾' },
    { title: 'Fruit we ate', rows: ['Apples', 'Pears', 'Plums'], emoji: '🍏' },
    { title: 'Ways we get to school', rows: ['Walk', 'Bus', 'Car'], emoji: '🚩' }
  ];
  item({ id: 'k-md-picto', b: 'k', a: 'md', d: 150, make: function (R) {
    var s = pick(R, PICTO_SETS);
    var vals = [ri(R, 2, 6), ri(R, 2, 6), ri(R, 2, 6)];
    while (vals[0] === vals[1]) vals[1] = ri(R, 2, 6);
    var data = s.rows.map(function (r, i) { return { label: r, v: vals[i] }; });
    var which = ri(R, 0, 2);
    var q = mc(R, vals[which], near(R, vals[which], 3, 0, 12), big);
    return {
      stem: 'How many ' + s.rows[which].toLowerCase() + '?',
      say: 'Look at the chart. How many ' + s.rows[which].toLowerCase() + '?',
      art: '<b>' + s.title + '</b><br>' + D.pictograph(data, s.emoji, 1),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-md-pictomore', b: 'k', a: 'md', d: 162, make: function (R) {
    var s = pick(R, PICTO_SETS);
    var a = ri(R, 4, 8), b = ri(R, 1, a - 1), c = ri(R, 1, 8);
    var data = [{ label: s.rows[0], v: a }, { label: s.rows[1], v: b }, { label: s.rows[2], v: c }];
    var q = mc(R, a - b, near(R, a - b, 3, 0, 12), big);
    return {
      stem: 'How many <b>more</b> ' + s.rows[0].toLowerCase() + ' than ' + s.rows[1].toLowerCase() + '?',
      say: 'How many more ' + s.rows[0].toLowerCase() + ' than ' + s.rows[1].toLowerCase() + '?',
      art: '<b>' + s.title + '</b><br>' + D.pictograph(data, s.emoji, 1),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-md-clockhour', b: 'k', a: 'md', d: 154, make: function (R) {
    var h = ri(R, 1, 12);
    var q = mc(R, h + ":00", [((h % 12) + 1) + ':00', (((h + 10) % 12) + 1) + ':00', h + ':30']);
    return { stem: 'What time does the clock show?', say: 'What time does the clock show?',
             art: D.clock(h, 0), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-md-clockhalf', b: 'kg', a: 'md', d: 168, make: function (R) {
    var h = ri(R, 1, 12);
    var q = mc(R, h + ':30', [h + ':00', (((h % 12) + 1)) + ':30', h + ':06', (((h % 12) + 1)) + ':00']);
    return { stem: 'What time does the clock show?', say: 'What time does the clock show?',
             art: D.clock(h, 30), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-md-coins', b: 'kg', a: 'md', d: 164, make: function (R) {
    var d10 = ri(R, 0, 3), n5 = ri(R, 0, 3), p1 = ri(R, 1, 4);
    var total = d10 * 10 + n5 * 5 + p1;
    var art = '<div class="counters" style="max-width:320px;margin:0 auto">' +
      new Array(d10 + 1).join('🪙') + new Array(n5 + 1).join('⚪') + new Array(p1 + 1).join('🟤') +
      '</div><div class="small soft" style="margin-top:8px">🪙 = 10c &nbsp; ⚪ = 5c &nbsp; 🟤 = 1c</div>';
    var q = mc(R, total + 'c', [(total + 5) + 'c', (total - 1) + 'c', (d10 + n5 + p1) + 'c', (total + 10) + 'c']);
    return { stem: 'How much money is this?', say: 'How much money is this altogether?',
             art: art, choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-md-cubeslong', b: 'kg', a: 'md', d: 174, make: function (R) {
    var n = ri(R, 3, 8);
    var art = '<div style="display:inline-block">' +
      '<div style="height:16px;width:' + (n * 30) + 'px;background:#f3c98b;border:2px solid #16202e;border-radius:4px"></div>' +
      '<div class="counters" style="gap:0;font-size:26px;justify-content:flex-start">' +
      new Array(n + 1).join('🟦') + '</div></div>';
    var q = mc(R, n, near(R, n, 3, 1, 12), big);
    return { stem: 'How many cubes long is the stick?', say: 'How many cubes long is the stick?',
             art: art, choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-md-bargraph', b: 'kg', a: 'md', d: 178, make: function (R) {
    var names = ['Red', 'Blue', 'Green', 'Yellow'];
    var vals = [ri(R, 2, 9), ri(R, 2, 9), ri(R, 2, 9), ri(R, 2, 9)];
    var data = names.map(function (n, i) { return { label: n, v: vals[i] }; });
    var most = 0, i;
    for (i = 1; i < 4; i++) if (vals[i] > vals[most]) most = i;
    var tie = vals.filter(function (v) { return v === vals[most]; }).length > 1;
    if (tie) { vals[most] += 1; data[most].v = vals[most]; }
    var q = mc(R, names[most], names.filter(function (n, i) { return i !== most; }));
    return {
      stem: 'Which colour did the <b>most</b> children pick?',
      say: 'Look at the chart. Which colour did the most children pick?',
      art: D.barGraph(data, { title: 'Favourite colour' }),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  /* ======================================================================
     KINDERGARTEN · Geometry                       (nothing like this exists)
     ====================================================================== */

  var BASIC4 = ['circle', 'square', 'triangle', 'rectangle'];
  var MORE4 = ['hexagon', 'pentagon', 'rhombus', 'trapezoid', 'oval', 'octagon'];

  item({ id: 'k-geo-name2d', b: 'k', a: 'geo', d: 112, make: function (R) {
    var want = pick(R, BASIC4);
    var others = shuffle(R, BASIC4.filter(function (s) { return s !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Which one is a <b>' + want + '</b>?',
      say: 'Which one is a ' + want + '?',
      choices: all.map(function (s) { return { html: D.shape(s, { size: 78 }) }; }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-geo-position', b: 'k', a: 'geo', d: 122, make: function (R) {
    var want = pick(R, ['above', 'below', 'beside']);
    var others = ['above', 'below', 'beside'].filter(function (w) { return w !== want; });
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Which picture shows the ball <b>' + want + '</b> the box?',
      say: 'Which picture shows the ball ' + want + ' the box?',
      choices: all.map(function (w) { return { html: D.position(w) }; }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-geo-inside', b: 'k', a: 'geo', d: 128, make: function (R) {
    var all = shuffle(R, ['inside', 'above', 'below', 'beside']);
    return {
      stem: 'Which picture shows the ball <b>inside</b> the box?',
      say: 'Which picture shows the ball inside the box?',
      choices: all.map(function (w) { return { html: D.position(w) }; }),
      answer: all.indexOf('inside'), cols: 4, pic: true
    };
  } });

  item({ id: 'k-geo-namemore', b: 'k', a: 'geo', d: 136, make: function (R) {
    var want = pick(R, MORE4);
    var others = shuffle(R, MORE4.concat(BASIC4).filter(function (s) { return s !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Which one is a <b>' + want + '</b>?',
      say: 'Which one is a ' + want + '?',
      choices: all.map(function (s) { return { html: D.shape(s, { size: 78 }) }; }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-geo-sides', b: 'k', a: 'geo', d: 142, make: function (R) {
    var s = pick(R, ['triangle', 'square', 'pentagon', 'hexagon', 'rectangle']);
    var n = D.sidesOf(s);
    var q = mc(R, n, near(R, n, 3, 1, 10), big);
    return { stem: 'How many <b>sides</b> does this shape have?',
             say: 'How many sides does this shape have?',
             art: D.shape(s, { size: 120 }), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-geo-corners', b: 'k', a: 'geo', d: 148, make: function (R) {
    var s = pick(R, ['triangle', 'square', 'pentagon', 'hexagon', 'octagon']);
    var n = D.sidesOf(s);
    var q = mc(R, n, near(R, n, 3, 1, 12), big);
    return { stem: 'How many <b>corners</b> does this shape have?',
             say: 'How many corners does this shape have?',
             art: D.shape(s, { size: 120 }), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  var SOLIDS = [
    { e: '🎲', n: 'cube' }, { e: '⚽', n: 'sphere' },
    { e: '🍦', n: 'cone' }, { e: '🥫', n: 'cylinder' }
  ];
  item({ id: 'k-geo-name3d', b: 'k', a: 'geo', d: 152, make: function (R) {
    var want = pick(R, SOLIDS);
    var all = shuffle(R, SOLIDS.slice());
    return {
      stem: 'Which one is shaped like a <b>' + want.n + '</b>?',
      say: 'Which one is shaped like a ' + want.n + '?',
      choices: all.map(function (s) { return { html: '<span class="big">' + s.e + '</span>' }; }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-geo-rotated', b: 'k', a: 'geo', d: 158, make: function (R) {
    var want = pick(R, ['triangle', 'square', 'rectangle', 'hexagon']);
    var others = shuffle(R, BASIC4.concat(MORE4).filter(function (s) {
      return s !== want && D.sidesOf(s) !== D.sidesOf(want);
    })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Which one is a <b>' + want + '</b>?',
      say: 'Which one is a ' + want + '? Look carefully, some of them are turned around.',
      choices: all.map(function (s) {
        return { html: D.shape(s, { size: 78, rot: pick(R, [20, 35, 50, 70, 110]) }) };
      }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-geo-compose', b: 'kg', a: 'geo', d: 164, make: function (R) {
    var q = mc(R, 'square', ['circle', 'triangle', 'hexagon']);
    return {
      stem: 'Two of these triangles are put together along their long sides. What shape do they make?',
      say: 'Two of these triangles are put together along their long sides. What shape do they make?',
      art: D.shape('rightTriangle', { size: 96 }),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-geo-halves', b: 'kg', a: 'geo', d: 170, make: function (R) {
    var right = D.fracBar(2, 0, { w: 150, h: 48 });
    var all = shuffle(R, [
      { html: right, ok: true },
      { html: D.fracBar(2, 0, { w: 150, h: 48, uneven: true }), ok: false },
      { html: D.fracBar(3, 0, { w: 150, h: 48 }), ok: false },
      { html: D.fracBar(4, 0, { w: 150, h: 48, uneven: true }), ok: false }
    ]);
    var idx = -1, i;
    for (i = 0; i < all.length; i++) if (all[i].ok) idx = i;
    return {
      stem: 'Which one is cut into <b>two equal parts</b>?',
      say: 'Which one is cut into two equal parts?',
      choices: all.map(function (o) { return { html: o.html }; }),
      answer: idx, cols: 2, pic: true
    };
  } });

  item({ id: 'k-geo-equalparts', b: 'kg', a: 'geo', d: 176, make: function (R) {
    var n = pick(R, [2, 3, 4, 6]);
    var q = mc(R, n, near(R, n, 3, 2, 10), big);
    return { stem: 'How many <b>equal parts</b> is this shape cut into?',
             say: 'How many equal parts is this shape cut into?',
             art: R() < 0.5 ? D.fracBar(n, 0) : D.fracPie(n, 0),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'k-geo-fourside', b: 'kg', a: 'geo', d: 180, t: 'multi', make: function (R) {
    var four = shuffle(R, ['square', 'rectangle', 'rhombus', 'trapezoid']).slice(0, 2);
    var not = shuffle(R, ['triangle', 'pentagon', 'hexagon', 'circle']).slice(0, 2);
    var all = shuffle(R, four.concat(not));
    var ans = [];
    all.forEach(function (s, i) { if (four.indexOf(s) >= 0) ans.push(i); });
    return {
      stem: 'Tap <b>all</b> the shapes that have exactly 4 sides.',
      say: 'Tap all the shapes that have exactly four sides.',
      choices: all.map(function (s) { return { html: D.shape(s, { size: 78 }) }; }),
      answer: ans, cols: 4, pic: true
    };
  } });

  /* ======================================================================
     THIRD GRADE · Operations and Algebraic Thinking
     ====================================================================== */

  item({ id: 'g-oa-groups', b: 'g', a: 'oa', d: 156, make: function (R) {
    var n = ri(R, 2, 5), per = ri(R, 2, 5);
    var q = mc(R, n * per, [n + per, n * per + per, n * per - per, n * per + 1], big);
    return {
      stem: 'How many altogether?',
      art: D.equalGroups(n, per, pick(R, ['🍓', '⭐', '🐞', '🔵'])),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-oa-array', b: 'g', a: 'oa', d: 164, make: function (R) {
    var c = ri(R, 3, 7), r = ri(R, 2, 6);
    var q = mc(R, c * r, [c + r, c * r + c, c * r - r, (c + 1) * r], big);
    return {
      stem: 'How many dots are there?',
      art: D.array(c, r),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-oa-facts-easy', b: 'g', a: 'oa', d: 172, make: function (R) {
    var a = pick(R, [2, 5, 10]), b = ri(R, 2, 9);
    var q = mc(R, a * b, [a * b + a, a * b - a, a + b, a * (b + 1)], big);
    return { stem: a + ' × ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-oa-facts', b: 'g', a: 'oa', d: 186, make: function (R) {
    var a = ri(R, 3, 9), b = ri(R, 3, 9);
    var q = mc(R, a * b, [a * b + a, a * b - b, a * (b + 1), (a + 1) * b], big);
    return { stem: a + ' × ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-oa-facts-hard', b: 'g', a: 'oa', d: 200, t: 'number', make: function (R) {
    var a = ri(R, 6, 12), b = ri(R, 6, 12);
    return { stem: a + ' × ' + b + ' = ?', answer: a * b };
  } });

  item({ id: 'g-oa-div', b: 'g', a: 'oa', d: 192, make: function (R) {
    var b = ri(R, 2, 9), ans = ri(R, 2, 9), a = b * ans;
    var q = mc(R, ans, [ans + 1, ans - 1, a - b, b], big);
    return { stem: a + ' ÷ ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-oa-missing', b: 'g', a: 'oa', d: 196, make: function (R) {
    var a = ri(R, 3, 9), ans = ri(R, 3, 9);
    var q = mc(R, ans, [ans + 1, ans - 1, a * ans, ans + 2], big);
    return { stem: a + ' × <b>?</b> = ' + (a * ans), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-oa-word1', b: 'g', a: 'oa', d: 188, make: function (R) {
    var s = pick(R, [
      { t: 'There are {a} shelves. Each shelf holds {b} books. How many books are there?', f: function (a, b) { return a * b; } },
      { t: '{c} cookies are shared equally between {a} children. How many does each child get?', f: function (a, b, c) { return c / a; } },
      { t: 'A packet holds {b} stickers. How many stickers are in {a} packets?', f: function (a, b) { return a * b; } },
      { t: '{c} pencils are put into boxes of {b}. How many boxes are filled?', f: function (a, b, c) { return c / b; } }
    ]);
    var a = ri(R, 3, 8), b = ri(R, 3, 8), c = a * b;
    var ans = s.f(a, b, c);
    var q = mc(R, ans, near(R, ans, 3, 1, 90), big);
    return { stem: s.t.replace('{a}', a).replace('{b}', b).replace('{c}', c),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-oa-word2', b: 'g', a: 'oa', d: 204, make: function (R) {
    var a = ri(R, 3, 7), b = ri(R, 3, 8), c = ri(R, 2, 9);
    var ans = a * b + c;
    var q = mc(R, ans, [a * b, a * b - c, (a + c) * b, ans + b], big);
    return {
      stem: 'A baker puts ' + b + ' buns on each of ' + a + ' trays. Then he bakes ' + c +
            ' more buns. How many buns does he have?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-oa-word2b', b: 'g', a: 'oa', d: 214, make: function (R) {
    var per = ri(R, 4, 9), boxes = ri(R, 3, 7), taken = ri(R, 2, 9);
    var ans = per * boxes - taken;
    var q = mc(R, ans, [per * boxes, ans + taken * 2, ans - per, per * boxes + taken], big);
    return {
      stem: 'There are ' + boxes + ' boxes with ' + per + ' apples in each. ' + taken +
            ' apples are eaten. How many apples are left?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-oa-pattern', b: 'g', a: 'oa', d: 178, make: function (R) {
    var step = pick(R, [3, 4, 6, 7, 8]), start = step * ri(R, 1, 3);
    var ans = start + step * 4;
    var q = mc(R, ans, [ans + step, ans - step, ans + 1, ans - 1], big);
    return { stem: start + ', ' + (start + step) + ', ' + (start + step * 2) + ', ' +
                   (start + step * 3) + ', <b>?</b>',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-oa-rule', b: 'g', a: 'oa', d: 206, make: function (R) {
    var step = pick(R, [3, 4, 5, 6, 7, 8, 9]);
    var n = ri(R, 6, 10);
    var ans = step * n;
    var q = mc(R, ans, [step * (n + 1), step * (n - 1), step + n, ans + 1], big);
    return {
      stem: step + ', ' + step * 2 + ', ' + step * 3 + ', ' + step * 4 +
            ' … What is the <b>' + n + 'th</b> number in this pattern?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-oa-prop', b: 'g', a: 'oa', d: 198, make: function (R) {
    var a = ri(R, 3, 9), b = ri(R, 3, 9);
    var q = mc(R, b + ' × ' + a, [a + b, (a + 1) + ' × ' + b, a + ' × ' + (b + 1), (a * b) + ' × 2']);
    return { stem: 'Which one has the <b>same answer</b> as ' + a + ' × ' + b + '?',
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-oa-equal', b: 'g', a: 'oa', d: 218, t: 'number', make: function (R) {
    var a = pick(R, [4, 6, 8, 12]), b = ri(R, 3, 9);
    var prod = a * b, other = a / 2;
    return { stem: a + ' × ' + b + ' = ' + other + ' × <b>?</b>', answer: prod / other };
  } });

  item({ id: 'g-oa-remainder', b: 'g', a: 'oa', d: 222, make: function (R) {
    var per = ri(R, 4, 8), full = ri(R, 4, 8), extra = ri(R, 1, per - 1);
    var total = per * full + extra;
    var q = mc(R, full + 1, [full, per, extra, full + 2], big);
    return {
      stem: total + ' children go on a trip. Each van holds ' + per +
            ' children. How many vans are needed so that everybody goes?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  /* ======================================================================
     THIRD GRADE · Number and Operations
     ====================================================================== */

  item({ id: 'g-nbt-place3', b: 'g', a: 'nbt', d: 158, make: function (R) {
    var digits = [ri(R, 1, 9), ri(R, 0, 9), ri(R, 0, 9)];
    var n = digits[0] * 100 + digits[1] * 10 + digits[2];
    var which = ri(R, 0, 2);
    var names = ['hundreds', 'tens', 'ones'];
    var q = mc(R, digits[which], digits.filter(function (d, i) { return i !== which; }).concat([digits[which] + 1]), big);
    return { stem: 'In the number <b>' + n + '</b>, which digit is in the <b>' + names[which] + '</b> place?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-add2d', b: 'g', a: 'nbt', d: 162, make: function (R) {
    var a = ri(R, 23, 78), b = ri(R, 14, 49);
    var q = mc(R, a + b, near(R, a + b, 3, 10, 200), big);
    return { stem: a + ' + ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-sub2d', b: 'g', a: 'nbt', d: 172, make: function (R) {
    var a = ri(R, 42, 95), b = ri(R, 13, 38);
    var q = mc(R, a - b, near(R, a - b, 3, 0, 120), big);
    return { stem: a + ' − ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-fracname', b: 'g', a: 'nbt', d: 176, make: function (R) {
    var parts = pick(R, [2, 3, 4, 6, 8]), sh = ri(R, 1, parts - 1);
    var right = sh + '/' + parts;
    var q = mc(R, right, [(parts - sh) + '/' + parts, sh + '/' + (parts - sh),
                          (sh + 1) + '/' + parts, parts + '/' + sh]);
    return { stem: 'What fraction of the shape is shaded?',
             art: R() < 0.5 ? D.fracBar(parts, sh) : D.fracPie(parts, sh),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-round10', b: 'g', a: 'nbt', d: 182, make: function (R) {
    var n = ri(R, 21, 289);
    var ans = Math.round(n / 10) * 10;
    if (n % 10 === 5) ans = (Math.floor(n / 10) + 1) * 10;   // JS rounds .5 up; so do schools
    var q = mc(R, ans, [ans + 10, ans - 10, Math.round(n / 100) * 100, n], big);
    return { stem: 'Round <b>' + n + '</b> to the nearest <b>ten</b>.',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-add3d', b: 'g', a: 'nbt', d: 188, make: function (R) {
    var a = ri(R, 145, 689), b = ri(R, 118, 359);
    var q = mc(R, a + b, near(R, a + b, 3, 100, 1200), big);
    return { stem: a + ' + ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-round100', b: 'g', a: 'nbt', d: 192, make: function (R) {
    var n = ri(R, 130, 2890);
    var ans = Math.round(n / 100) * 100;
    if (n % 100 === 50) ans = (Math.floor(n / 100) + 1) * 100;
    var q = mc(R, ans, [ans + 100, ans - 100, Math.round(n / 10) * 10, n], big);
    return { stem: 'Round <b>' + n + '</b> to the nearest <b>hundred</b>.',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-fracline', b: 'g', a: 'nbt', d: 198, make: function (R) {
    var parts = pick(R, [3, 4, 6, 8]), at = ri(R, 1, parts - 1);
    var right = at + '/' + parts;
    var q = mc(R, right, [(parts - at) + '/' + parts, at + '/' + (at + parts),
                          (at + 1) + '/' + parts, parts + '/' + at]);
    return { stem: 'What fraction does the arrow point to?',
             art: D.numberLine(0, 1, parts, at, { fromLabel: '0', toLabel: '1' }),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-sub3d', b: 'g', a: 'nbt', d: 200, make: function (R) {
    var a = ri(R, 320, 905), b = ri(R, 118, 289);
    var q = mc(R, a - b, near(R, a - b, 3, 0, 900), big);
    return { stem: a + ' − ' + b + ' = ?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-fraccmp', b: 'g', a: 'nbt', d: 202, make: function (R) {
    /* Same numerator, different denominator -- the one that trips everybody:
       more pieces means smaller pieces. */
    var num = ri(R, 1, 3), d1 = num + ri(R, 1, 3), d2 = d1 + ri(R, 1, 4);
    var bigger = R() < 0.5;
    var a = num + '/' + d1, b = num + '/' + d2;
    return {
      stem: 'Which fraction is <b>' + (bigger ? 'greater' : 'less') + '</b>?',
      choices: [{ html: big(a) }, { html: big(b) }],
      answer: bigger ? 0 : 1, cols: 2
    };
  } });

  item({ id: 'g-nbt-fraceq', b: 'g', a: 'nbt', d: 206, make: function (R) {
    var base = pick(R, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]);
    var k = ri(R, 2, 4);
    var right = (base[0] * k) + '/' + (base[1] * k);
    var q = mc(R, right, [(base[0] * k) + '/' + (base[1] * k + 1),
                          (base[0] + k) + '/' + (base[1] + k),
                          (base[0] * k + 1) + '/' + (base[1] * k),
                          base[1] + '/' + base[0]]);
    return { stem: 'Which fraction is equal to <b>' + base[0] + '/' + base[1] + '</b>?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-fracset', b: 'g', a: 'nbt', d: 210, make: function (R) {
    var parts = pick(R, [2, 3, 4, 6]), each = ri(R, 2, 6), total = parts * each;
    var q = mc(R, each, [total - each, parts, total / 2, each + parts], big);
    return { stem: 'What is <b>1/' + parts + '</b> of ' + total + '?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-nbt-expanded', b: 'g', a: 'nbt', d: 214, make: function (R) {
    var th = ri(R, 1, 9), h = ri(R, 0, 9), t = ri(R, 0, 9), o = ri(R, 0, 9);
    var n = th * 1000 + h * 100 + t * 10 + o;
    var right = th * 1000 + ' + ' + h * 100 + ' + ' + t * 10 + ' + ' + o;
    var q = mc(R, right, [th + ' + ' + h + ' + ' + t + ' + ' + o,
                          th * 1000 + ' + ' + h * 10 + ' + ' + t * 100 + ' + ' + o,
                          th * 100 + ' + ' + h * 100 + ' + ' + t * 10 + ' + ' + o]);
    return { stem: 'Which shows <b>' + n + '</b> in expanded form?',
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-nbt-multten', b: 'g', a: 'nbt', d: 218, t: 'number', make: function (R) {
    var a = ri(R, 3, 9), b = ri(R, 2, 9) * 10;
    return { stem: a + ' × ' + b + ' = ?', answer: a * b, calc: true };
  } });

  item({ id: 'g-nbt-fracmixed', b: 'g', a: 'nbt', d: 224, make: function (R) {
    var whole = ri(R, 1, 3), parts = pick(R, [2, 4]), at = ri(R, 1, parts - 1);
    var right = whole + ' ' + at + '/' + parts;
    var q = mc(R, right, [(whole + 1) + ' ' + at + '/' + parts,
                          whole + ' ' + (parts - at) + '/' + parts,
                          at + '/' + parts]);
    return {
      stem: 'What number does the arrow point to?',
      art: D.numberLine(whole, whole + 1, parts, at,
                        { fromLabel: String(whole), toLabel: String(whole + 1) }),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  /* ======================================================================
     THIRD GRADE · Measurement and Data            (nothing like this exists)
     ====================================================================== */

  item({ id: 'g-md-time5', b: 'g', a: 'md', d: 156, make: function (R) {
    var h = ri(R, 1, 12), m = ri(R, 1, 11) * 5;
    var two = function (x) { return x < 10 ? '0' + x : String(x); };
    var right = h + ':' + two(m);
    var q = mc(R, right, [h + ':' + two((m + 5) % 60), h + ':' + two((m + 55) % 60),
                          ((h % 12) + 1) + ':' + two(m)]);
    return { stem: 'What time does the clock show?', art: D.clock(h, m),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-units', b: 'g', a: 'md', d: 166, make: function (R) {
    var s = pick(R, [
      { t: 'the mass of an apple', a: 'grams', w: ['litres', 'kilograms', 'centimetres'] },
      { t: 'the mass of a person', a: 'kilograms', w: ['grams', 'litres', 'metres'] },
      { t: 'how much water is in a bottle', a: 'litres', w: ['grams', 'metres', 'kilograms'] },
      { t: 'the length of a pencil', a: 'centimetres', w: ['kilograms', 'litres', 'kilometres'] },
      { t: 'how far it is to the next town', a: 'kilometres', w: ['centimetres', 'grams', 'litres'] }
    ]);
    var q = mc(R, s.a, s.w);
    return { stem: 'Which unit would you use to measure <b>' + s.t + '</b>?',
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-md-time1', b: 'g', a: 'md', d: 174, make: function (R) {
    var h = ri(R, 1, 12), m = ri(R, 1, 59);
    while (m % 5 === 0) m = ri(R, 1, 59);
    var two = function (x) { return x < 10 ? '0' + x : String(x); };
    var right = h + ':' + two(m);
    var q = mc(R, right, [h + ':' + two((m + 1) % 60), h + ':' + two((m + 5) % 60),
                          h + ':' + two((m + 59) % 60)]);
    return { stem: 'What time does the clock show?', art: D.clock(h, m),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-bargraph', b: 'g', a: 'md', d: 178, make: function (R) {
    var names = ['Mon', 'Tue', 'Wed', 'Thu'];
    var step = pick(R, [2, 5]);
    var vals = names.map(function () { return ri(R, 1, 8) * step; });
    var data = names.map(function (n, i) { return { label: n, v: vals[i] }; });
    var which = ri(R, 0, 3);
    var q = mc(R, vals[which], [vals[which] + step, vals[which] - step, vals[which] / step], big);
    return {
      stem: 'How many books were read on <b>' + names[which] + '</b>?',
      art: D.barGraph(data, { step: step, title: 'Books read' }),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-md-perim', b: 'g', a: 'md', d: 184, make: function (R) {
    var w = ri(R, 3, 9), h = ri(R, 2, 8);
    var q = mc(R, 2 * (w + h), [w * h, w + h, 2 * w + h, 2 * (w + h) + 2], big);
    return { stem: 'What is the <b>perimeter</b> of this rectangle, in cm?',
             art: D.labelledRect(w, h, 'cm'),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-picto', b: 'g', a: 'md', d: 186, make: function (R) {
    var each = pick(R, [2, 5, 10]);
    var rows = ['Year 1', 'Year 2', 'Year 3'];
    var vals = rows.map(function () { return ri(R, 2, 6) * each; });
    var data = rows.map(function (r, i) { return { label: r, v: vals[i] }; });
    var which = ri(R, 0, 2);
    var q = mc(R, vals[which], [vals[which] / each, vals[which] + each, vals[which] - each], big);
    return {
      stem: 'How many trees did <b>' + rows[which] + '</b> plant?',
      art: D.pictograph(data, '🌳', each),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-md-areacount', b: 'g', a: 'md', d: 190, make: function (R) {
    var w = ri(R, 3, 7), h = ri(R, 2, 5);
    var q = mc(R, w * h, [2 * (w + h), w + h, w * h + w], big);
    return { stem: 'Each square is 1 square centimetre. What is the <b>area</b>?',
             art: D.areaGrid(w, h), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-elapsed', b: 'g', a: 'md', d: 194, make: function (R) {
    var h = ri(R, 1, 10), m = pick(R, [0, 10, 15, 20, 30, 45]);
    var add = pick(R, [20, 25, 30, 40, 45, 50]);
    var tot = m + add, nh = h + Math.floor(tot / 60), nm = tot % 60;
    if (nh > 12) nh -= 12;
    var two = function (x) { return x < 10 ? '0' + x : String(x); };
    var right = nh + ':' + two(nm);
    var q = mc(R, right, [nh + ':' + two((nm + 10) % 60), (nh === 12 ? 1 : nh + 1) + ':' + two(nm),
                          h + ':' + two(nm)]);
    return {
      stem: 'The film starts at ' + h + ':' + two(m) + '. It lasts ' + add +
            ' minutes. What time does it finish?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-md-ruler', b: 'g', a: 'md', d: 196, make: function (R) {
    var qtr = ri(R, 3, 18);
    var whole = Math.floor(qtr / 4), rem = qtr % 4;
    var right = rem === 0 ? String(whole)
      : rem === 2 ? (whole ? whole + ' 1/2' : '1/2')
      : (whole ? whole + ' ' + rem + '/4' : rem + '/4');
    var wrongs = [];
    [qtr + 1, qtr - 1, qtr + 2].forEach(function (v) {
      if (v < 1) return;
      var w2 = Math.floor(v / 4), r2 = v % 4;
      wrongs.push(r2 === 0 ? String(w2) : r2 === 2 ? (w2 ? w2 + ' 1/2' : '1/2')
        : (w2 ? w2 + ' ' + r2 + '/4' : r2 + '/4'));
    });
    var q = mc(R, right, wrongs);
    return { stem: 'How long is the strip, in <b>inches</b>?', art: D.ruler(qtr),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-volmass', b: 'g', a: 'md', d: 200, make: function (R) {
    var a = ri(R, 120, 480), b = ri(R, 60, 250);
    var unit = pick(R, ['ml', 'g']);
    var q = mc(R, (a + b) + ' ' + unit, [(a - b) + ' ' + unit, (a + b + 100) + ' ' + unit,
                                         (a + b - 10) + ' ' + unit]);
    return { stem: 'A jug holds ' + a + ' ' + unit + '. Another holds ' + b + ' ' + unit +
                   '. How much is that altogether?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-areamul', b: 'g', a: 'md', d: 204, make: function (R) {
    var w = ri(R, 4, 12), h = ri(R, 3, 9);
    var q = mc(R, w * h, [2 * (w + h), w + h, w * h - h, w * (h + 1)], big);
    return { stem: 'What is the <b>area</b> of this rectangle, in square metres?',
             art: D.labelledRect(w, h, 'm'), choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-md-bargraph2', b: 'g', a: 'md', d: 208, make: function (R) {
    var names = ['Ants', 'Bees', 'Bugs', 'Moths'];
    var step = pick(R, [2, 5]);
    var vals = names.map(function () { return ri(R, 1, 9) * step; });
    while (vals[0] === vals[2]) vals[2] = ri(R, 1, 9) * step;
    var data = names.map(function (n, i) { return { label: n, v: vals[i] }; });
    var diff = Math.abs(vals[0] - vals[2]);
    var q = mc(R, diff, [diff + step, vals[0] + vals[2], Math.abs(vals[1] - vals[3])], big);
    return {
      stem: 'How many <b>more or fewer</b> ' + names[0].toLowerCase() + ' than ' +
            names[2].toLowerCase() + ' were counted?',
      art: D.barGraph(data, { step: step, title: 'Minibeasts counted' }),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-md-lineplot', b: 'g', a: 'md', d: 212, make: function (R) {
    var marks = [{ v: 1, n: ri(R, 1, 3) }, { v: 1.5, n: ri(R, 1, 4) },
                 { v: 2, n: ri(R, 1, 3) }, { v: 2.5, n: ri(R, 1, 3) }];
    var most = marks[0], i;
    for (i = 1; i < marks.length; i++) if (marks[i].n > most.n) most = marks[i];
    var tie = marks.filter(function (m) { return m.n === most.n; }).length > 1;
    if (tie) { most.n += 1; }
    var lab = function (v) { return v === Math.round(v) ? String(v) : (v - 0.5) + '½'; };
    var q = mc(R, lab(most.v), marks.filter(function (m) { return m !== most; }).map(function (m) { return lab(m.v); }));
    return {
      stem: 'Each &#215; is one pencil. Which length was <b>most common</b>?',
      art: D.linePlot(marks, 1, 3, function (v) { return String(v); }),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-md-arearect', b: 'g', a: 'md', d: 218, make: function (R) {
    /* An L-shape: area by splitting it in two, which is the whole skill. */
    var aw = ri(R, 2, 4), ah = ri(R, 2, 3), bw = ri(R, 2, 4), bh = ri(R, 1, 2);
    var cells = [], c, r;
    for (r = 0; r < ah; r++) for (c = 0; c < aw; c++) cells.push([c, r]);
    for (r = ah; r < ah + bh; r++) for (c = 0; c < bw; c++) cells.push([c, r]);
    var area = aw * ah + bw * bh;
    var q = mc(R, area, [aw * ah, (aw + bw) * (ah + bh), area + aw, area - bh], big);
    return {
      stem: 'Each square is 1 square unit. What is the <b>area</b> of this shape?',
      art: D.areaGrid(Math.max(aw, bw), ah + bh, cells),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-md-perimmissing', b: 'g', a: 'md', d: 224, t: 'number', make: function (R) {
    var w = ri(R, 4, 11), h = ri(R, 3, 9);
    return {
      stem: 'A rectangle has a perimeter of ' + (2 * (w + h)) + ' cm. One side is ' + w +
            ' cm. How long is the side next to it, in cm?',
      answer: h, calc: true
    };
  } });

  /* ======================================================================
     THIRD GRADE · Geometry                        (nothing like this exists)
     ====================================================================== */

  item({ id: 'g-geo-name', b: 'g', a: 'geo', d: 154, make: function (R) {
    var want = pick(R, ['pentagon', 'hexagon', 'octagon', 'rhombus', 'trapezoid']);
    var others = shuffle(R, ['pentagon', 'hexagon', 'octagon', 'rhombus', 'trapezoid', 'triangle']
      .filter(function (s) { return s !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Which one is a <b>' + want + '</b>?',
      choices: all.map(function (s) { return { html: D.shape(s, { size: 78 }) }; }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'g-geo-sides', b: 'g', a: 'geo', d: 162, make: function (R) {
    var s = pick(R, ['pentagon', 'hexagon', 'octagon', 'trapezoid', 'rhombus']);
    var n = D.sidesOf(s);
    var q = mc(R, n, near(R, n, 3, 3, 12), big);
    return { stem: 'How many <b>sides</b> does this shape have?', art: D.shape(s, { size: 118 }),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-geo-3d', b: 'g', a: 'geo', d: 170, make: function (R) {
    var s = pick(R, [
      { q: 'How many <b>faces</b> does a cube have?', a: 6 },
      { q: 'How many <b>edges</b> does a cube have?', a: 12 },
      { q: 'How many <b>corners</b> does a cube have?', a: 8 }
    ]);
    var q = mc(R, s.a, [s.a + 2, s.a - 2, s.a + 4, 4], big);
    return { stem: s.q, art: '<span style="font-size:70px">🎲</span>',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-geo-quad', b: 'g', a: 'geo', d: 180, t: 'multi', make: function (R) {
    var quads = shuffle(R, ['square', 'rectangle', 'rhombus', 'trapezoid']).slice(0, 2);
    var not = shuffle(R, ['triangle', 'pentagon', 'hexagon', 'circle', 'octagon']).slice(0, 2);
    var all = shuffle(R, quads.concat(not));
    var ans = [];
    all.forEach(function (s, i) { if (quads.indexOf(s) >= 0) ans.push(i); });
    return {
      stem: 'Tap <b>all</b> the quadrilaterals.',
      choices: all.map(function (s) { return { html: D.shape(s, { size: 78 }) }; }),
      answer: ans, cols: 4, pic: true
    };
  } });

  item({ id: 'g-geo-partition', b: 'g', a: 'geo', d: 188, make: function (R) {
    var parts = pick(R, [3, 4, 6, 8]);
    var q = mc(R, '1/' + parts, ['1/' + (parts - 1), '1/' + (parts + 1), parts + '/1']);
    return {
      stem: 'This shape is cut into equal parts. What fraction is <b>one part</b>?',
      art: D.fracPie(parts, 1),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-geo-symmetry', b: 'g', a: 'geo', d: 194, make: function (R) {
    var kind = pick(R, ['square', 'triangle', 'rectangle', 'hexagon']);
    var all = shuffle(R, [
      { html: D.symmetry(kind, true), ok: true },
      { html: D.symmetry('trapezoid', false), ok: false },
      { html: D.symmetry('rightTriangle', false), ok: false },
      { html: D.symmetry('rhombus', false), ok: false }
    ]);
    var idx = -1, i;
    for (i = 0; i < all.length; i++) if (all[i].ok) idx = i;
    return {
      stem: 'On which shape is the dashed line a <b>line of symmetry</b>?',
      choices: all.map(function (o) { return { html: o.html }; }),
      answer: idx, cols: 2, pic: true
    };
  } });

  item({ id: 'g-geo-quadname', b: 'g', a: 'geo', d: 198, make: function (R) {
    var s = pick(R, [
      { q: 'four equal sides and four right angles', a: 'square', w: ['rectangle', 'rhombus', 'trapezoid'] },
      { q: 'exactly one pair of parallel sides', a: 'trapezoid', w: ['square', 'rectangle', 'rhombus'] },
      { q: 'four equal sides but no right angles', a: 'rhombus', w: ['square', 'rectangle', 'trapezoid'] },
      { q: 'two pairs of equal sides and four right angles', a: 'rectangle', w: ['rhombus', 'trapezoid', 'pentagon'] }
    ]);
    var q = mc(R, s.a, s.w);
    return { stem: 'Which shape has <b>' + s.q + '</b>?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-geo-fourths', b: 'g', a: 'geo', d: 202, make: function (R) {
    var all = shuffle(R, [
      { html: D.fracBar(4, 0, { w: 150, h: 46 }), ok: true },
      { html: D.fracBar(4, 0, { w: 150, h: 46, uneven: true }), ok: false },
      { html: D.fracBar(3, 0, { w: 150, h: 46 }), ok: false },
      { html: D.fracBar(6, 0, { w: 150, h: 46 }), ok: false }
    ]);
    var idx = -1, i;
    for (i = 0; i < all.length; i++) if (all[i].ok) idx = i;
    return {
      stem: 'Which shape is divided into <b>fourths</b>?',
      choices: all.map(function (o) { return { html: o.html }; }),
      answer: idx, cols: 2, pic: true
    };
  } });

  item({ id: 'g-geo-angle', b: 'g', a: 'geo', d: 208, make: function (R) {
    var kinds = [{ n: 'right', d: 90 }, { n: 'acute', d: ri(R, 25, 70) },
                 { n: 'obtuse', d: ri(R, 110, 155) }];
    var want = pick(R, kinds);
    var q = mc(R, want.n, kinds.filter(function (k) { return k !== want; }).map(function (k) { return k.n; }));
    return { stem: 'What kind of angle is this?', art: D.angle(want.d),
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-geo-tiling', b: 'g', a: 'geo', d: 214, make: function (R) {
    var w = ri(R, 3, 6), h = ri(R, 2, 5);
    var q = mc(R, w + ' × ' + h, [w + ' + ' + h, (2 * (w + h)) + ' × 2',
                                        (w + h) + ' × 2', w + ' × ' + (h + 1)]);
    return {
      stem: 'Which number sentence gives the <b>area</b> of this rectangle?',
      art: D.areaGrid(w, h),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'g-geo-always', b: 'g', a: 'geo', d: 220, make: function (R) {
    var s = pick(R, [
      { q: 'A square is always a', a: 'rectangle', w: ['triangle', 'trapezoid', 'pentagon'] },
      { q: 'A rhombus is always a', a: 'quadrilateral', w: ['square', 'rectangle', 'triangle'] },
      { q: 'A rectangle is always a', a: 'quadrilateral', w: ['square', 'rhombus', 'trapezoid'] }
    ]);
    var q = mc(R, s.a, s.w);
    return { stem: s.q + ' … what?', choices: q.choices, answer: q.answer, cols: 4 };
  } });

  return ITEMS;
})();
