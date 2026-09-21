/* ==========================================================================
   bank-read.js — the reading item bank, both grade bands.

   MAP reports reading in different areas depending on the band:

     K-2   found  Foundational skills   (letters, sounds, print concepts)
           lang   Language and writing  (capitals, marks, grammar)
           lit    Literature and informational text
           vocab  Vocabulary

     2-5   lit    Literary text
           info   Informational text
           vocab  Vocabulary

   Two things here do not exist anywhere else on this site. The first is
   **print concepts** -- where you start reading, which way you go, what
   counts as a word -- which is a real strand of the K-2 test and is
   genuinely the kind of thing a five-year-old is asked. The second, and far
   bigger, is **passages with questions attached**. Story Quest is a
   choose-your-path adventure, not a comprehension passage, so all 16
   passages below are written for this.

   Passages are deliberately reused across several consecutive items, because
   that is what the real test does -- NWEA's own proctor script warns students
   that "the same passage appears again and again, but look carefully, because
   you will see a different question for the same passage."

   AUTHORING RULE, and the only one that matters: **the answer must be findable
   in the text.** Never guessable from genre convention, never a trick, never
   two defensible answers. This is the same rule Story Quest's scenes follow
   and for the same reason -- careful reading has to be the thing that wins.
   ========================================================================== */

var BANK_READ = (function () {
  'use strict';

  function ri(R, lo, hi) { return lo + Math.floor(R() * (hi - lo + 1)); }
  function pick(R, a) { return a[Math.floor(R() * a.length)]; }
  function shuffle(R, a) {
    var out = a.slice(), i, j, t;
    for (i = out.length - 1; i > 0; i--) {
      j = Math.floor(R() * (i + 1)); t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
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

  var big = function (v) { return '<span class="big">' + v + '</span>'; };
  var ITEMS = [];
  function item(o) { ITEMS.push(o); return o; }

  /* Read the options aloud after the question. The real K-2 test plays audio
     for the answer choices too, and a five-year-old who cannot read them has
     no way in otherwise. */
  function sayWith(stem, opts) {
    return stem + ' ' + opts.join('. ') + '.';
  }

  /* ======================================================================
     KINDERGARTEN · Foundational skills
     ====================================================================== */

  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  item({ id: 'k-found-letterup', b: 'k', a: 'found', d: 110, make: function (R) {
    var want = pick(R, ALPHA);
    var others = shuffle(R, ALPHA.filter(function (l) { return l !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Find the letter <b>' + want + '</b>.',
      say: 'Find the letter ' + want + '.',
      choices: all.map(function (l) { return { html: big(l) }; }),
      answer: all.indexOf(want), cols: 4
    };
  } });

  item({ id: 'k-found-letterlow', b: 'k', a: 'found', d: 120, make: function (R) {
    var want = pick(R, ALPHA);
    var others = shuffle(R, ALPHA.filter(function (l) { return l !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Find the little letter <b>' + want.toLowerCase() + '</b>.',
      say: 'Find the little letter ' + want + '.',
      choices: all.map(function (l) { return { html: big(l.toLowerCase()) }; }),
      answer: all.indexOf(want), cols: 4
    };
  } });

  /* Print concepts: a strand of the real K-2 test, and nothing on this site
     has ever asked it. A page of text is drawn so the question has something
     to point at. */
  var PAGE = '<div style="display:inline-block;border:2px solid #8794aa;border-radius:6px;' +
    'padding:14px 18px;background:#fff;text-align:left;max-width:300px">' +
    '<div style="font-weight:bold;font-size:19px;margin-bottom:8px">My Red Boat</div>' +
    '<div style="font-size:17px;line-height:1.8">I have a little red boat.<br>' +
    'It goes on the pond.<br>I like my boat.</div></div>';

  item({ id: 'k-found-print-start', b: 'k', a: 'found', d: 124, make: function (R) {
    var q = mc(R, 'At the top, on the left', [
      'At the bottom, on the right', 'In the middle', 'At the top, on the right'
    ]);
    return {
      stem: 'Where do you start reading a page?',
      say: sayWith('Where do you start reading a page?',
                   q.choices.map(function (c) { return c.html; })),
      art: PAGE, choices: q.choices, answer: q.answer, cols: 2
    };
  } });

  item({ id: 'k-found-print-title', b: 'k', a: 'found', d: 130, make: function (R) {
    var q = mc(R, 'My Red Boat', ['I like my boat.', 'It goes on the pond.', 'a little red boat']);
    return {
      stem: 'What is the <b>title</b> of this story?',
      say: sayWith('What is the title of this story?',
                   q.choices.map(function (c) { return c.html; })),
      art: PAGE, choices: q.choices, answer: q.answer, cols: 2
    };
  } });

  item({ id: 'k-found-print-words', b: 'k', a: 'found', d: 138, make: function (R) {
    var sents = [
      { t: 'I like my boat.', n: 4 },
      { t: 'The dog ran fast.', n: 4 },
      { t: 'We went to the park.', n: 5 },
      { t: 'My cat is black.', n: 4 },
      { t: 'He can jump.', n: 3 }
    ];
    var s = pick(R, sents);
    var q = mc(R, s.n, [s.n + 1, s.n - 1, s.n + 2], big);
    return {
      stem: 'How many <b>words</b> are in this sentence?',
      say: 'How many words are in this sentence? ' + s.t,
      art: '<div style="font-size:24px;letter-spacing:1px">' + s.t + '</div>',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-found-match', b: 'k', a: 'found', d: 132, make: function (R) {
    var want = pick(R, ALPHA);
    var others = shuffle(R, ALPHA.filter(function (l) { return l !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Which little letter goes with <b>' + want + '</b>?',
      say: 'Which little letter goes with big ' + want + '?',
      choices: all.map(function (l) { return { html: big(l.toLowerCase()) }; }),
      answer: all.indexOf(want), cols: 4
    };
  } });

  /* One initial sound per family and no emoji in two families -- the same
     authoring rule Language RPG's Beginning Sounds track follows, because a
     shared emoji makes a decoy secretly right. */
  var SOUNDS = [
    { l: 'B', s: 'b', words: [['🐻', 'bear'], ['🦇', 'bat'], ['🎈', 'balloon']] },
    { l: 'C', s: 'k', words: [['🐱', 'cat'], ['🚗', 'car'], ['🥕', 'carrot']] },
    { l: 'D', s: 'd', words: [['🐶', 'dog'], ['🦆', 'duck'], ['🚪', 'door']] },
    { l: 'F', s: 'f', words: [['🐟', 'fish'], ['🦶', 'foot'], ['🍴', 'fork']] },
    { l: 'H', s: 'h', words: [['🏠', 'house'], ['🎩', 'hat'], ['🖐️', 'hand']] },
    { l: 'M', s: 'm', words: [['🌜', 'moon'], ['🐭', 'mouse'], ['🥛', 'milk']] },
    { l: 'P', s: 'p', words: [['🐷', 'pig'], ['🖊️', 'pen'], ['🍐', 'pear']] },
    { l: 'S', s: 's', words: [['☀️', 'sun'], ['🧦', 'sock'], ['🐍', 'snake']] },
    { l: 'T', s: 't', words: [['🌳', 'tree'], ['🐅', 'tiger'], ['🚂', 'train']] },
    { l: 'R', s: 'r', words: [['🐰', 'rabbit'], ['💍', 'ring'], ['🌈', 'rainbow']] }
  ];

  item({ id: 'k-found-lettersound', b: 'k', a: 'found', d: 136, make: function (R) {
    var f = pick(R, SOUNDS);
    var others = shuffle(R, SOUNDS.filter(function (x) { return x.l !== f.l; })).slice(0, 3);
    var all = shuffle(R, [f].concat(others));
    return {
      stem: 'Which letter makes the sound at the start of <b>' + f.words[0][1] + '</b>? ' +
            '<span class="big">' + f.words[0][0] + '</span>',
      say: 'Which letter makes the sound at the start of ' + f.words[0][1] + '?',
      choices: all.map(function (x) { return { html: big(x.l) }; }),
      answer: all.indexOf(f), cols: 4
    };
  } });

  item({ id: 'k-found-begin', b: 'k', a: 'found', d: 142, make: function (R) {
    var f = pick(R, SOUNDS);
    var two = shuffle(R, f.words).slice(0, 2);
    var others = shuffle(R, SOUNDS.filter(function (x) { return x.l !== f.l; })).slice(0, 3);
    var opts = shuffle(R, [two[1]].concat(others.map(function (o) { return pick(R, o.words); })));
    return {
      stem: 'Which one starts with the same sound as <b>' + two[0][1] + '</b>? ' +
            '<span class="big">' + two[0][0] + '</span>',
      say: sayWith('Which one starts with the same sound as ' + two[0][1] + '?',
                   opts.map(function (o) { return o[1]; })),
      choices: opts.map(function (o) {
        return { html: '<span class="big">' + o[0] + '</span>' + o[1] };
      }),
      answer: opts.indexOf(two[1]), cols: 4, pic: true
    };
  } });

  /* Rhyme families are complete: two words that rhyme never sit in different
     families, or a decoy would be right too. */
  var RHYMES = [
    ['cat', 'hat', 'bat', 'mat'], ['dog', 'log', 'frog', 'hog'],
    ['sun', 'run', 'bun', 'fun'], ['bed', 'red', 'head', 'bread'],
    ['cake', 'lake', 'snake', 'rake'], ['tree', 'bee', 'key', 'knee'],
    ['star', 'car', 'jar', 'far'], ['ball', 'wall', 'tall', 'fall'],
    ['boat', 'coat', 'goat', 'float'], ['pig', 'wig', 'dig', 'big']
  ];

  item({ id: 'k-found-rhyme', b: 'k', a: 'found', d: 146, make: function (R) {
    var fam = pick(R, RHYMES);
    var two = shuffle(R, fam).slice(0, 2);
    var others = shuffle(R, RHYMES.filter(function (f) { return f !== fam; }))
      .slice(0, 3).map(function (f) { return pick(R, f); });
    var opts = shuffle(R, [two[1]].concat(others));
    return {
      stem: 'Which word <b>rhymes</b> with <b>' + two[0] + '</b>?',
      say: sayWith('Which word rhymes with ' + two[0] + '?', opts),
      choices: opts.map(function (w) { return { html: w }; }),
      answer: opts.indexOf(two[1]), cols: 4
    };
  } });

  var SIGHT = ['the', 'and', 'you', 'was', 'for', 'are', 'said', 'they',
               'have', 'with', 'this', 'that', 'come', 'some', 'here', 'there'];

  item({ id: 'k-found-sight', b: 'k', a: 'found', d: 150, make: function (R) {
    var want = pick(R, SIGHT);
    var others = shuffle(R, SIGHT.filter(function (w) { return w !== want; })).slice(0, 3);
    var all = shuffle(R, [want].concat(others));
    return {
      stem: 'Tap the word <b>' + want + '</b>.',
      say: 'Tap the word ' + want + '.',
      choices: all.map(function (w) { return { html: big(w) }; }),
      answer: all.indexOf(want), cols: 4
    };
  } });

  var SYLL = [
    ['cat', 1], ['dog', 1], ['tree', 1], ['rabbit', 2], ['pencil', 2], ['table', 2],
    ['butterfly', 3], ['banana', 3], ['elephant', 3], ['computer', 3],
    ['window', 2], ['sun', 1], ['dinosaur', 3], ['apple', 2], ['crocodile', 3]
  ];

  item({ id: 'k-found-syll', b: 'k', a: 'found', d: 156, make: function (R) {
    var w = pick(R, SYLL);
    var q = mc(R, w[1], [w[1] + 1, w[1] - 1, w[1] + 2].filter(function (n) { return n > 0; }), big);
    return {
      stem: 'How many <b>syllables</b> (claps) are in <b>' + w[0] + '</b>?',
      say: 'How many claps are in the word ' + w[0] + '?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  var CVC = [
    ['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['bed', '🛏️'], ['pig', '🐷'],
    ['bus', '🚌'], ['hat', '🎩'], ['cup', '☕'], ['fox', '🦊'], ['web', '🕸️'],
    ['bat', '🦇'], ['jet', '✈️'], ['pen', '🖊️'], ['log', '🪵'], ['net', '🥅']
  ];

  item({ id: 'k-found-blend', b: 'k', a: 'found', d: 160, make: function (R) {
    var w = pick(R, CVC);
    var others = shuffle(R, CVC.filter(function (x) { return x[0] !== w[0]; })).slice(0, 3);
    var all = shuffle(R, [w].concat(others));
    return {
      stem: 'Put the sounds together: <b>' + w[0].split('').join(' · ') + '</b>. What is the word?',
      say: 'Put the sounds together. ' + w[0].split('').join('. ') + '. What is the word?',
      choices: all.map(function (x) { return { html: '<span class="big">' + x[1] + '</span>' + x[0] }; }),
      answer: all.indexOf(w), cols: 4, pic: true
    };
  } });

  item({ id: 'k-found-read', b: 'k', a: 'found', d: 166, make: function (R) {
    var w = pick(R, CVC);
    var others = shuffle(R, CVC.filter(function (x) { return x[0] !== w[0]; })).slice(0, 3);
    var all = shuffle(R, [w].concat(others));
    return {
      stem: 'Read the word, then tap the picture: <b>' + w[0] + '</b>',
      say: 'Read the word by yourself, then tap the picture that matches.',
      choices: all.map(function (x) { return { html: '<span class="big">' + x[1] + '</span>' }; }),
      answer: all.indexOf(w), cols: 4, pic: true
    };
  } });

  item({ id: 'k-found-spell', b: 'k', a: 'found', d: 172, make: function (R) {
    var w = pick(R, CVC);
    var word = w[0];
    var swap = { a: 'e', e: 'a', i: 'o', o: 'u', u: 'i' };
    var bad1 = word[0] + swap[word[1]] + word[2];
    var bad2 = word[2] + word[1] + word[0];
    var bad3 = word[0] + word[1];
    var q = mc(R, word, [bad1, bad2, bad3], big);
    return {
      stem: 'Which one spells <b>' + word + '</b>? <span class="big">' + w[1] + '</span>',
      say: 'Which one spells ' + word + '?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  var DIGRAPH = [
    ['ship', '🚢', 'sh'], ['chair', '🪑', 'ch'], ['thumb', '👍', 'th'],
    ['shell', '🐚', 'sh'], ['cheese', '🧀', 'ch'], ['whale', '🐳', 'wh'],
    ['shoe', '👟', 'sh'], ['chick', '🐤', 'ch']
  ];

  item({ id: 'k-found-digraph', b: 'k', a: 'found', d: 178, make: function (R) {
    var w = pick(R, DIGRAPH);
    var q = mc(R, w[2], shuffle(R, ['sh', 'ch', 'th', 'wh'].filter(function (d) { return d !== w[2]; })).slice(0, 3), big);
    return {
      stem: 'Which two letters make the sound at the start of <b>' + w[0] + '</b>? ' +
            '<span class="big">' + w[1] + '</span>',
      say: 'Which two letters make the sound at the start of ' + w[0] + '?',
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  /* ======================================================================
     KINDERGARTEN · Language and writing
     ====================================================================== */

  var NAMES = ['Sam', 'Mia', 'Ben', 'Ava', 'Tom', 'Lily', 'Max', 'Rosa'];

  /* The bottom of the language ladder. A child who is genuinely at the start
     of kindergarten needs somewhere to stand, and the grammar items proper
     all begin well above him -- the coverage check fails without these. */
  item({ id: 'k-lang-onemany', b: 'k', a: 'lang', d: 118, make: function (R) {
    var e = pick(R, [['🐱', 'cat'], ['🐶', 'dog'], ['⭐', 'star'], ['🍎', 'apple'], ['🐟', 'fish']]);
    var counts = shuffle(R, [1, 2, 3, 5]);
    var many = R() < 0.5;
    var want = many ? Math.max.apply(null, counts) : 1;
    return {
      stem: many ? 'Which picture shows <b>' + e[1] + 's</b> &mdash; more than one?'
                 : 'Which picture shows just <b>one ' + e[1] + '</b>?',
      say: many ? 'Which picture shows more than one ' + e[1] + '?'
                : 'Which picture shows just one ' + e[1] + '?',
      choices: counts.map(function (n) {
        return { html: '<span style="font-size:26px">' + new Array(n + 1).join(e[0]) + '</span>' };
      }),
      answer: counts.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-lang-tells', b: 'k', a: 'lang', d: 126, make: function (R) {
    var s = pick(R, [
      { e: '🐕', a: 'The dog runs.', w: ['The fish swims.', 'The bird sings.', 'The cat sleeps.'] },
      { e: '🐟', a: 'The fish swims.', w: ['The dog runs.', 'The bee flies.', 'The boy jumps.'] },
      { e: '☀️', a: 'The sun is hot.', w: ['The snow is cold.', 'The cake is sweet.', 'The bell is loud.'] },
      { e: '🚌', a: 'The bus is big.', w: ['The ant is small.', 'The tree is green.', 'The cup is full.'] }
    ]);
    var q = mc(R, s.a, s.w);
    return {
      stem: 'Which sentence tells about the picture?',
      say: sayWith('Which sentence tells about the picture?', [s.a].concat(s.w)),
      art: '<span style="font-size:64px">' + s.e + '</span>',
      choices: q.choices, answer: q.answer, cols: 2
    };
  } });

  item({ id: 'k-lang-name', b: 'k', a: 'lang', d: 132, make: function (R) {
    var n = pick(R, NAMES);
    var others = shuffle(R, ['dog', 'apple', 'chair', 'cup', 'bird', 'shoe']).slice(0, 3);
    var all = shuffle(R, [n].concat(others));
    return {
      stem: 'Which word needs a <b>capital letter</b>?',
      say: sayWith('Which word needs a capital letter?', all),
      choices: all.map(function (w) { return { html: w }; }),
      answer: all.indexOf(n), cols: 4
    };
  } });

  item({ id: 'k-lang-capital', b: 'k', a: 'lang', d: 142, make: function (R) {
    var s = pick(R, [
      ['The bus is red.', 'the bus is red.'],
      ['My cat can jump.', 'my cat can jump.'],
      ['We went home.', 'we went home.'],
      ['Dogs like to run.', 'dogs like to run.']
    ]);
    var all = shuffle(R, [s[0], s[1], s[1].toUpperCase(), s[0].replace('.', '')]);
    return {
      stem: 'Which sentence is written <b>correctly</b>?',
      say: sayWith('Which sentence is written correctly?', [s[0]]),
      choices: all.map(function (w) { return { html: w }; }),
      answer: all.indexOf(s[0]), cols: 2
    };
  } });

  item({ id: 'k-lang-plural', b: 'k', a: 'lang', d: 146, make: function (R) {
    var w = pick(R, [['cat', 'cats'], ['dog', 'dogs'], ['book', 'books'],
                     ['star', 'stars'], ['bird', 'birds'], ['cup', 'cups']]);
    var q = mc(R, w[1], [w[0], w[0] + 'es', w[0] + "'s"], big);
    return {
      stem: 'One ' + w[0] + '. Two <b>___</b>.',
      say: sayWith('One ' + w[0] + '. Two what?', q.choices.map(function (c) {
        return c.html.replace(/<[^>]+>/g, '');
      })),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-lang-prep', b: 'k', a: 'lang', d: 152, make: function (R) {
    var where = pick(R, ['above', 'below', 'beside']);
    var word = { above: 'over', below: 'under', beside: 'next to' }[where];
    var others = ['over', 'under', 'next to'].filter(function (w) { return w !== word; });
    var all = shuffle(R, [word].concat(others));
    return {
      stem: 'Where is the ball?',
      say: sayWith('Where is the ball?', all),
      art: Draw.position(where),
      choices: all.map(function (w) { return { html: w + ' the box' }; }),
      answer: all.indexOf(word), cols: 4
    };
  } });

  item({ id: 'k-lang-endmark', b: 'k', a: 'lang', d: 156, make: function (R) {
    var s = pick(R, [
      { t: 'What is your name', m: '?' }, { t: 'I like cake', m: '.' },
      { t: 'Where is my hat', m: '?' }, { t: 'The sun is hot', m: '.' },
      { t: 'Can you jump', m: '?' }, { t: 'My dog is big', m: '.' }
    ]);
    var q = mc(R, s.m, ['.', '?', ','].filter(function (m) { return m !== s.m; }), big);
    return {
      stem: 'Which mark belongs at the end? <br><b>' + s.t + ' ___</b>',
      say: 'Which mark belongs at the end of this sentence? ' + s.t,
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-lang-verb', b: 'k', a: 'lang', d: 160, make: function (R) {
    var s = pick(R, [
      { t: 'The dog ___ fast.', a: 'runs', w: ['run', 'running', 'ran to'] },
      { t: 'The birds ___ in the sky.', a: 'fly', w: ['flies', 'flying', 'flew to'] },
      { t: 'She ___ a book.', a: 'reads', w: ['read to', 'reading', 'readed'] },
      { t: 'We ___ to school.', a: 'walk', w: ['walks', 'walking', 'walked to the'] }
    ]);
    var q = mc(R, s.a, s.w);
    return {
      stem: 'Which word finishes the sentence? <br><b>' + s.t + '</b>',
      say: sayWith('Which word finishes the sentence? ' + s.t.replace('___', 'blank'),
                   [s.a].concat(s.w)),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-lang-pronoun', b: 'k', a: 'lang', d: 166, make: function (R) {
    var s = pick(R, [
      { t: 'Ben lost his hat. ___ looked under the bed.', a: 'He', w: ['She', 'They', 'It'] },
      { t: 'Mia has a bike. ___ rides it to school.', a: 'She', w: ['He', 'They', 'It'] },
      { t: 'The boys ran outside. ___ played football.', a: 'They', w: ['He', 'She', 'It'] },
      { t: 'The cat was hungry. ___ ate all its food.', a: 'It', w: ['He', 'She', 'They'] }
    ]);
    var q = mc(R, s.a, s.w);
    return {
      stem: 'Which word finishes the sentence? <br><b>' + s.t + '</b>',
      say: sayWith('Which word finishes the sentence? ' + s.t.replace('___', 'blank'),
                   [s.a].concat(s.w)),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-lang-question', b: 'k', a: 'lang', d: 172, make: function (R) {
    var s = pick(R, [
      { t: '___ is your birthday?', a: 'When', w: ['Because', 'And', 'The'] },
      { t: '___ did you put my shoes?', a: 'Where', w: ['Because', 'And', 'That'] },
      { t: '___ took the last biscuit?', a: 'Who', w: ['Because', 'And', 'Very'] },
      { t: '___ are you sad?', a: 'Why', w: ['And', 'The', 'Some'] }
    ]);
    var q = mc(R, s.a, s.w);
    return {
      stem: 'Which word starts this question? <br><b>' + s.t + '</b>',
      say: sayWith('Which word starts this question?', [s.a].concat(s.w)),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-lang-sentence', b: 'k', a: 'lang', d: 176, make: function (R) {
    var good = pick(R, ['The frog jumped into the pond.', 'My sister found a shell.',
                        'We ate lunch in the garden.', 'A bird sang in the tree.']);
    var words = good.replace('.', '').split(' ');
    var jumble = shuffle(R, words).join(' ') + '.';
    var frag = words.slice(0, 2).join(' ');
    var all = shuffle(R, [good, jumble, frag, words.slice(1).join(' ')]);
    return {
      stem: 'Which one is a complete <b>sentence</b>?',
      say: sayWith('Which one is a complete sentence?', all),
      choices: all.map(function (w) { return { html: w }; }),
      answer: all.indexOf(good), cols: 2
    };
  } });

  /* ======================================================================
     KINDERGARTEN · Vocabulary
     ====================================================================== */

  var CATS = [
    { name: 'a fruit', in: [['🍎', 'apple'], ['🍌', 'banana'], ['🍇', 'grapes'], ['🍐', 'pear']],
      out: [['🐶', 'dog'], ['🚗', 'car'], ['👟', 'shoe'], ['🪑', 'chair']] },
    { name: 'an animal', in: [['🐶', 'dog'], ['🐱', 'cat'], ['🐴', 'horse'], ['🐸', 'frog']],
      out: [['🍎', 'apple'], ['🚌', 'bus'], ['🎩', 'hat'], ['🥄', 'spoon']] },
    { name: 'something you wear', in: [['👟', 'shoe'], ['🎩', 'hat'], ['🧦', 'sock'], ['🧥', 'coat']],
      out: [['🐟', 'fish'], ['🌳', 'tree'], ['🚂', 'train'], ['🍞', 'bread']] },
    { name: 'something that goes', in: [['🚗', 'car'], ['🚌', 'bus'], ['✈️', 'plane'], ['🚲', 'bike']],
      out: [['🍐', 'pear'], ['🐱', 'cat'], ['🧦', 'sock'], ['🪑', 'chair']] }
  ];

  item({ id: 'k-vocab-pic', b: 'k', a: 'vocab', d: 116, make: function (R) {
    var c = pick(R, CATS), w = pick(R, c.in);
    var others = shuffle(R, c.out).slice(0, 3);
    var all = shuffle(R, [w].concat(others));
    return {
      stem: 'Tap the <b>' + w[1] + '</b>.',
      say: 'Tap the ' + w[1] + '.',
      choices: all.map(function (x) { return { html: '<span class="big">' + x[0] + '</span>' }; }),
      answer: all.indexOf(w), cols: 4, pic: true
    };
  } });

  var ACTIONS = [['🏃', 'running'], ['🏊', 'swimming'], ['😴', 'sleeping'],
                 ['🍽️', 'eating'], ['📖', 'reading'], ['🎨', 'painting']];

  item({ id: 'k-vocab-size', b: 'k', a: 'vocab', d: 124, make: function (R) {
    var set = pick(R, [
      [['🐜', 'ant'], ['🐈', 'cat'], ['🐘', 'elephant']],
      [['🌱', 'seed'], ['🌳', 'tree'], ['🏔️', 'mountain']],
      [['🪙', 'coin'], ['📕', 'book'], ['🚌', 'bus']]
    ]);
    var biggest = R() < 0.5;
    var want = biggest ? set[2] : set[0];
    var all = shuffle(R, set.slice());
    return {
      stem: 'Which one is really the <b>' + (biggest ? 'biggest' : 'smallest') + '</b>?',
      say: sayWith('Which one is really the ' + (biggest ? 'biggest' : 'smallest') + '?',
                   all.map(function (x) { return x[1]; })),
      choices: all.map(function (x) { return { html: '<span class="big">' + x[0] + '</span>' + x[1] }; }),
      answer: all.indexOf(want), cols: 4, pic: true
    };
  } });

  item({ id: 'k-vocab-verb', b: 'k', a: 'vocab', d: 130, make: function (R) {
    var w = pick(R, ACTIONS);
    var others = shuffle(R, ACTIONS.filter(function (x) { return x[1] !== w[1]; })).slice(0, 3);
    var all = shuffle(R, [w].concat(others));
    return {
      stem: 'Which picture shows someone <b>' + w[1] + '</b>?',
      say: 'Which picture shows someone ' + w[1] + '?',
      choices: all.map(function (x) { return { html: '<span class="big">' + x[0] + '</span>' }; }),
      answer: all.indexOf(w), cols: 4, pic: true
    };
  } });

  item({ id: 'k-vocab-cat', b: 'k', a: 'vocab', d: 140, make: function (R) {
    var c = pick(R, CATS), w = pick(R, c.in);
    var others = shuffle(R, c.out).slice(0, 3);
    var all = shuffle(R, [w].concat(others));
    return {
      stem: 'Which one is <b>' + c.name + '</b>?',
      say: sayWith('Which one is ' + c.name + '?', all.map(function (x) { return x[1]; })),
      choices: all.map(function (x) { return { html: '<span class="big">' + x[0] + '</span>' + x[1] }; }),
      answer: all.indexOf(w), cols: 4, pic: true
    };
  } });

  item({ id: 'k-vocab-notbelong', b: 'k', a: 'vocab', d: 154, make: function (R) {
    var c = pick(R, CATS);
    var three = shuffle(R, c.in).slice(0, 3);
    var odd = pick(R, c.out);
    var all = shuffle(R, three.concat([odd]));
    return {
      stem: 'Which one does <b>not</b> belong?',
      say: sayWith('Which one does not belong?', all.map(function (x) { return x[1]; })),
      choices: all.map(function (x) { return { html: '<span class="big">' + x[0] + '</span>' + x[1] }; }),
      answer: all.indexOf(odd), cols: 4, pic: true
    };
  } });

  var OPPO = [['big', 'small'], ['hot', 'cold'], ['up', 'down'], ['day', 'night'],
              ['fast', 'slow'], ['happy', 'sad'], ['open', 'shut'], ['wet', 'dry'],
              ['full', 'empty'], ['old', 'new'], ['loud', 'quiet'], ['hard', 'soft']];

  item({ id: 'k-vocab-opp', b: 'k', a: 'vocab', d: 148, make: function (R) {
    var p = pick(R, OPPO), flip = R() < 0.5;
    var word = flip ? p[1] : p[0], ans = flip ? p[0] : p[1];
    var others = shuffle(R, OPPO.filter(function (x) { return x !== p; }))
      .slice(0, 3).map(function (x) { return R() < 0.5 ? x[0] : x[1]; });
    var q = mc(R, ans, others);
    return {
      stem: 'What is the <b>opposite</b> of <b>' + word + '</b>?',
      say: sayWith('What is the opposite of ' + word + '?',
                   q.choices.map(function (c) { return c.html; })),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-vocab-sent', b: 'k', a: 'vocab', d: 162, make: function (R) {
    var s = pick(R, [
      { t: 'Ben could not find his dog, so he felt ___.', a: 'worried', w: ['hungry', 'sleepy', 'funny'] },
      { t: 'The cake was gone. Mia was ___ because she wanted a piece.', a: 'disappointed', w: ['excited', 'thirsty', 'early'] },
      { t: 'It was raining, so we stayed ___.', a: 'inside', w: ['outside', 'upside', 'beside'] },
      { t: 'The box was too ___ to carry, so Dad helped.', a: 'heavy', w: ['light', 'soft', 'clean'] }
    ]);
    var q = mc(R, s.a, s.w);
    return {
      stem: 'Which word finishes the sentence best? <br><b>' + s.t + '</b>',
      say: sayWith('Which word finishes the sentence best? ' + s.t.replace('___', 'blank'),
                   [s.a].concat(s.w)),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-vocab-syn', b: 'k', a: 'vocab', d: 170, make: function (R) {
    var s = pick(R, [
      { w: 'big', a: 'huge', x: ['tiny', 'quiet', 'round'] },
      { w: 'small', a: 'little', x: ['giant', 'loud', 'warm'] },
      { w: 'glad', a: 'happy', x: ['angry', 'tired', 'wet'] },
      { w: 'quick', a: 'fast', x: ['slow', 'heavy', 'soft'] },
      { w: 'chilly', a: 'cold', x: ['boiling', 'sunny', 'noisy'] }
    ]);
    var q = mc(R, s.a, s.x);
    return {
      stem: 'Which word means almost the <b>same</b> as <b>' + s.w + '</b>?',
      say: sayWith('Which word means almost the same as ' + s.w + '?', [s.a].concat(s.x)),
      choices: q.choices, answer: q.answer, cols: 4
    };
  } });

  item({ id: 'k-vocab-multi', b: 'k', a: 'vocab', d: 178, make: function (R) {
    var s = pick(R, [
      { t: 'The bat flew out of the cave.', w: 'bat', a: 'an animal', x: ['a thing you hit a ball with', 'a kind of hat', 'a small boat'] },
      { t: 'Sam hit the ball with his bat.', w: 'bat', a: 'a thing you hit a ball with', x: ['an animal', 'a kind of hat', 'a small boat'] },
      { t: 'I saw a duck swim across the pond.', w: 'duck', a: 'a bird', x: ['to bend down quickly', 'a kind of boat', 'a loud noise'] },
      { t: 'Please park the car here.', w: 'park', a: 'to leave something in a place', x: ['a place with grass and swings', 'a kind of tree', 'to run fast'] }
    ]);
    var q = mc(R, s.a, s.x);
    return {
      stem: 'What does <b>' + s.w + '</b> mean in this sentence? <br><b>' + s.t + '</b>',
      say: 'What does the word ' + s.w + ' mean in this sentence? ' + s.t,
      choices: q.choices, answer: q.answer, cols: 2
    };
  } });

  /* ======================================================================
     KINDERGARTEN · Literature and informational text

     Read aloud, two to four sentences, with the answer plainly in the text.
     A five-year-old is being asked to *listen* and hold on to what he heard,
     which is exactly the strand.
     ====================================================================== */

  var K_PASSAGES = [
    /* The two shortest ones exist to give a child at the very start of
       kindergarten somewhere to stand -- one sentence he can hold in his head
       while he hears the question. Without them the listening strand begins
       at a four-sentence passage, which for a five-year-old in September is a
       wall rather than a first rung. */
    { id: 'kp-cat', kind: 'lit', title: 'The Warm Mat',
      text: ['The cat sat on the mat by the fire. It was warm there.'],
      qs: [
        { d: 116, q: 'Where did the cat sit?', a: 'on the mat', w: ['in a box', 'on the bed', 'under a chair'] },
        { d: 128, q: 'Why did the cat like the mat?', a: 'It was warm.', w: ['It was soft.', 'It was red.', 'It was big.'] }
      ] },
    { id: 'kp-ball', kind: 'lit', title: 'Over the Fence',
      text: ['Tom kicked the ball hard. It went right over the fence.'],
      qs: [
        { d: 122, q: 'What did Tom kick?', a: 'the ball', w: ['the fence', 'the gate', 'a stone'] },
        { d: 130, q: 'Where did the ball go?', a: 'over the fence', w: ['into the house', 'up a tree', 'into the pond'] }
      ] },
    { id: 'kp-mitten', kind: 'lit', title: 'The Lost Mitten',
      text: ['Tam lost one red mitten in the snow. She looked by the gate. She looked ' +
             'under the slide. At last she found it in her coat pocket.'],
      qs: [
        { d: 134, q: 'What did Tam lose?', a: 'a mitten', w: ['a hat', 'a boot', 'a book'] },
        { d: 146, q: 'Where did she find it?', a: 'in her coat pocket', w: ['by the gate', 'under the slide', 'in the snow'] }
      ] },
    { id: 'kp-seed', kind: 'info', title: 'A Seed',
      text: ['A seed is very small. You put it in the soil. You give it water. ' +
             'Soon a little green shoot comes up.'],
      qs: [
        { d: 138, q: 'What do you give the seed?', a: 'water', w: ['milk', 'sand', 'paper'] },
        { d: 152, q: 'What comes up at the end?', a: 'a green shoot', w: ['a stone', 'a bird', 'more seeds'] }
      ] },
    { id: 'kp-dog', kind: 'lit', title: 'Max and the Puddle',
      text: ['Max the dog saw a big puddle. He ran straight through it. ' +
             'Mud went all over his legs. Mum had to give him a bath.'],
      qs: [
        { d: 132, q: 'Who ran through the puddle?', a: 'Max the dog', w: ['Mum', 'a cat', 'a boy'] },
        { d: 156, q: 'Why did Max need a bath?', a: 'He was muddy.', w: ['He was cold.', 'He was tired.', 'He was hungry.'] }
      ] },
    { id: 'kp-bees', kind: 'info', title: 'Bees',
      text: ['Bees live together in a hive. They fly out to find flowers. ' +
             'They bring back sweet nectar. The nectar becomes honey.'],
      qs: [
        { d: 142, q: 'Where do bees live?', a: 'in a hive', w: ['in a nest in a tree', 'under a stone', 'in a pond'] },
        { d: 160, q: 'What does the nectar become?', a: 'honey', w: ['flowers', 'water', 'wax'] }
      ] },
    { id: 'kp-kite', kind: 'lit', title: 'The Kite',
      text: ['Jo made a kite out of paper and string. The wind was strong. ' +
             'The kite went up and up. Then the string broke and the kite flew away.'],
      qs: [
        { d: 140, q: 'What did Jo make the kite from?', a: 'paper and string', w: ['wood and nails', 'cloth and wool', 'leaves and mud'] },
        { d: 164, q: 'What happened at the end?', a: 'The string broke.', w: ['The kite fell in a tree.', 'It started to rain.', 'Jo caught the kite.'] }
      ] },
    { id: 'kp-frogs', kind: 'info', title: 'Baby Frogs',
      text: ['A frog lays eggs in the water. Tiny tadpoles come out of the eggs. ' +
             'Tadpoles have tails and no legs. Later they grow legs and become frogs.'],
      qs: [
        { d: 148, q: 'What comes out of the eggs?', a: 'tadpoles', w: ['fish', 'frogs', 'birds'] },
        { d: 170, q: 'Which happens FIRST?', a: 'The frog lays eggs.', w: ['The tadpole grows legs.', 'It becomes a frog.', 'The tail goes away.'] }
      ] },
    { id: 'kp-cake', kind: 'lit', title: 'The Birthday Cake',
      text: ['Nan made a cake for Ollie. She put six candles on the top. ' +
             'Ollie took a big breath and blew them all out. Everybody clapped.'],
      qs: [
        { d: 136, q: 'How many candles were on the cake?', a: 'six', w: ['three', 'ten', 'one'] },
        { d: 158, q: 'How do you think Ollie felt?', a: 'happy', w: ['angry', 'frightened', 'bored'] }
      ] },
    { id: 'kp-rain', kind: 'info', title: 'Rain',
      text: ['The sun warms the water in the sea. The water goes up into the air. ' +
             'It makes clouds. When the clouds get heavy, rain falls down.'],
      qs: [
        { d: 154, q: 'What makes the water go up?', a: 'the sun', w: ['the wind', 'the rain', 'the sea'] },
        { d: 174, q: 'When does the rain fall?', a: 'when the clouds get heavy', w: ['when the sun goes down', 'when the sea is cold', 'when the wind stops'] }
      ] },
    { id: 'kp-shoe', kind: 'lit', title: 'One Shoe',
      text: ['Pip could only find one shoe. He hopped all the way to the kitchen. ' +
             'The other shoe was by the door, full of the cat.'],
      qs: [
        { d: 144, q: 'What was in the other shoe?', a: 'the cat', w: ['a sock', 'some food', 'a mouse'] },
        { d: 166, q: 'How did Pip get to the kitchen?', a: 'He hopped.', w: ['He ran.', 'He crawled.', 'He walked slowly.'] }
      ] },
    { id: 'kp-teeth', kind: 'info', title: 'Shark Teeth',
      text: ['A shark has many rows of teeth. When one tooth falls out, a new one ' +
             'moves forward to take its place. A shark can lose thousands of teeth.'],
      qs: [
        { d: 162, q: 'What happens when a tooth falls out?', a: 'A new one moves forward.', w: ['The shark stops eating.', 'The shark grows bigger.', 'Nothing happens.'] },
        { d: 178, q: 'What is this passage mostly about?', a: "how a shark's teeth work", w: ['what sharks eat', 'where sharks live', 'how big sharks are'] }
      ] }
  ];

  /* ======================================================================
     THIRD GRADE · Literary text
     ====================================================================== */

  var G_LIT = [
    { id: 'gl-mitten', title: 'The Last Seat',
      lvl: 2,
      text: [
        'The bus was nearly full when Nora climbed on. There was one empty seat, right at ' +
        'the back, next to a boy she did not know. He had a cast on his arm, covered in ' +
        'signatures in every colour of pen.',
        'Nora sat down and said nothing for three whole stops. Then the boy held out a ' +
        'green marker without looking at her.',
        '"You can sign it if you want," he said. "There\'s room near the thumb."',
        'Nora took the pen. By the time the bus reached school she had drawn a small dog ' +
        'wearing a crown, and the boy was laughing so hard the driver looked up.'
      ],
      qs: [
        { d: 152, q: 'Where does this story take place?', a: 'on a bus', w: ['at school', 'in a hospital', 'in a park'] },
        { d: 162, q: 'What did the boy have on his arm?', a: 'a cast covered in signatures', w: ['a watch', 'a bandage with no writing', 'a green marker'] },
        { d: 156, q: 'What did Nora draw on the cast?', a: 'a small dog wearing a crown', w: ['her own name', 'a green marker', 'a school bus'] },
        { d: 170, q: 'Why was there only one empty seat?', a: 'The bus was nearly full.', w: ['The boy was saving it.', 'Nobody liked the back.', 'The driver said so.'] },
        { d: 178, q: 'How does Nora feel at the START of the story?', a: 'shy', w: ['angry', 'excited', 'frightened'] },
        { d: 196, q: 'What does the boy offering the pen show about him?', a: 'He is friendly.', w: ['He is bored.', 'He is in a hurry.', 'He is unkind.'] }
      ] },
    { id: 'gl-race', title: 'Second Place',
      lvl: 3,
      text: [
        'Dev had trained all summer for the school race. He had run in the rain and run ' +
        'in the heat, and on the morning of the race his legs felt light and fast.',
        'For most of the race he was in front. Then, on the last bend, he heard footsteps ' +
        'behind him and saw a flash of red: Priya, who had never beaten him once.',
        'She passed him ten steps from the line.',
        'Dev bent over, hands on his knees, and waited for the hot, sick feeling of losing ' +
        'to arrive. It did not come. Instead he found himself grinning at the grass. He had ' +
        'run faster than he ever had in his life, and somebody had still been better. ' +
        'Somewhere in that was a thing worth knowing.'
      ],
      qs: [
        { d: 166, q: 'Who won the race?', a: 'Priya', w: ['Dev', 'nobody', 'the reader is not told'] },
        { d: 180, q: 'How long had Dev been training?', a: 'all summer', w: ['one week', 'since the last bend', 'for three years'] },
        { d: 198, q: 'Why does Dev grin at the end?', a: 'He ran his best race even though he lost.', w: ['He is glad the race is over.', 'He thinks Priya cheated.', 'He is pretending not to mind.'] },
        { d: 212, q: 'What is the message of this story?', a: 'Doing your best can matter more than winning.', w: ['Training does not help.', 'Always run faster than your friends.', 'Losing is nothing to worry about.'] }
      ] },
    { id: 'gl-attic', title: 'The Letter in the Wall',
      lvl: 3,
      text: [
        'When the builders took down the old plaster in the hallway, something fluttered out ' +
        'and landed at Sam\'s feet. It was a folded paper, brown at the edges and soft as cloth.',
        'The writing was faded but he could read it. "To whoever finds this," it began. ' +
        '"My name is Elsie Mercer and I am nine years old. It is the third of June, 1931. ' +
        'I am hiding this here because I want somebody a long time from now to know I was here."',
        'Sam read it four times. Then he went to find a pen, because it seemed rude not to answer.'
      ],
      qs: [
        { d: 186, q: 'Where was the letter found?', a: 'behind the plaster in a wall', w: ['in an attic box', 'under a floorboard', 'in the garden'] },
        { d: 196, q: 'Why did Elsie hide the letter?', a: 'She wanted someone in the future to know she existed.', w: ['She was hiding from her family.', 'She wanted to keep it safe from the builders.', 'She had no envelope.'] },
        { d: 206, q: 'What does Sam do at the end?', a: 'He goes to write a reply.', w: ['He throws the letter away.', 'He shows it to the builders.', 'He puts it back in the wall.'] },
        { d: 218, q: 'What does "it seemed rude not to answer" tell you about Sam?', a: 'He treats the letter as a real message to him.', w: ['He is annoyed by the letter.', 'He does not believe the letter is real.', 'He is worried about the builders.'] }
      ] },
    { id: 'gl-storm', title: 'Ada and the Storm',
      lvl: 4,
      text: [
        'The power went out at half past six, and the whole street went quiet in a way Ada ' +
        'had never heard before. No hum from the fridge. No television through the wall.',
        'Dad lit three candles and set them in jars on the kitchen table. In the shifting ' +
        'light the ordinary room turned strange and soft, and the shadows of the mugs stretched ' +
        'right up the wall like tall thin people.',
        'They played cards for two hours. Ada won twice, which had never happened before either, ' +
        'and Dad told a story about a dog he had owned when he was eight.',
        'When the lights snapped back on at nine, everything in the room looked flat and ' +
        'yellow and wrong. "Oh," said Ada, disappointed, and then felt silly for saying it.'
      ],
      qs: [
        { d: 194, q: 'What time did the power come back on?', a: 'nine o\'clock', w: ['half past six', 'eight o\'clock', 'the next morning'] },
        { d: 204, q: 'The shadows are described as "tall thin people". This is an example of —', a: 'a comparison to make a picture in your mind', w: ['a fact about shadows', 'a warning of danger', 'a mistake by the writer'] },
        { d: 214, q: 'Why is Ada disappointed when the lights come back?', a: 'The evening had become special and now it was over.', w: ['She wanted to keep winning at cards.', 'She was frightened of the light.', 'She had not finished her homework.'] },
        { d: 224, q: 'Which detail best shows that the evening was unusual for Ada?', a: 'She noticed how quiet the street was.', w: ['Dad lit three candles.', 'They sat at the kitchen table.', 'The fridge stopped humming.'] }
      ] },
    { id: 'gl-shop', title: "Mr Pim's Shop",
      lvl: 3,
      text: [
        'Mr Pim\'s shop sold everything and nothing. There were drawers of buttons, a barrel of ' +
        'wooden spoons, a shelf of jars with no labels, and one enormous stuffed owl that had ' +
        'watched the door since before anyone could remember.',
        'Every child in the town knew the rule: if you could name a thing Mr Pim did not have, ' +
        'you got a penny sweet, free.',
        'Nobody had ever won. Tilly had tried "a saddle for a goat" and Mr Pim had produced one ' +
        'in under a minute, faintly dusty. Her brother had tried "yesterday\'s newspaper" and ' +
        'Mr Pim had handed it over without even standing up.'
      ],
      qs: [
        { d: 172, q: 'What do you win if Mr Pim does not have the thing you name?', a: 'a free penny sweet', w: ['the thing itself', 'a wooden spoon', 'nothing at all'] },
        { d: 166, q: 'Name one thing the shop sells.', a: 'wooden spoons', w: ['bicycles', 'fresh bread', 'shoes'] },
        { d: 184, q: 'What did Tilly ask for?', a: 'a saddle for a goat', w: ["yesterday's newspaper", 'a stuffed owl', 'a jar with no label'] },
        { d: 200, q: 'Why does the writer mention the owl "that had watched the door since before anyone could remember"?', a: 'To show the shop is very old and full of odd things.', w: ['To warn that the owl is dangerous.', 'To explain why nobody shops there.', 'To show Mr Pim likes birds.'] },
        { d: 210, q: 'What can you tell about Mr Pim from this passage?', a: 'He is well prepared and enjoys the game.', w: ['He is forgetful and untidy.', 'He dislikes children.', 'He is losing money on the shop.'] }
      ] },
    { id: 'gl-swim', title: 'The Deep End',
      lvl: 2,
      text: [
        'Kofi had swum the width of the pool a hundred times. Today the teacher asked him to ' +
        'swim the length, from the shallow end to the deep end, where the floor dropped away.',
        'He stood on the tiles with his toes curled over the edge. The water at the far end ' +
        'looked a darker blue.',
        '"You can put your feet down any time," said the teacher.',
        '"I know," said Kofi. He did not put his feet down once.'
      ],
      qs: [
        { d: 158, q: 'What is Kofi asked to do that is new for him?', a: 'swim the length of the pool', w: ['swim the width of the pool', 'dive into the deep end', 'swim without a teacher'] },
        { d: 170, q: 'Why does the water at the far end look darker?', a: 'It is deeper there.', w: ['It is dirty.', 'It is colder.', 'The lights are off.'] },
        { d: 162, q: 'How many times had Kofi swum the width of the pool?', a: 'about a hundred', w: ['once', 'never', 'three times'] },
        { d: 176, q: 'What did the teacher say Kofi could do?', a: 'put his feet down any time', w: ['stop and rest at the side', 'swim only half way', 'use a float'] },
        { d: 188, q: 'What does the last line show?', a: 'Kofi was brave and did not give up.', w: ['Kofi could not reach the floor.', 'Kofi did not hear the teacher.', 'Kofi was a slow swimmer.'] },
        { d: 202, q: 'How does Kofi most likely feel standing on the tiles?', a: 'nervous but determined', w: ['completely relaxed', 'angry with the teacher', 'bored'] }
      ] },
    { id: 'gl-sock', title: 'The Sock Thief',
      lvl: 1,
      text: [
        'Socks kept going missing. Not pairs — always one of a pair, so that the drawer ' +
        'filled up with lonely socks that matched nothing.',
        'Dad blamed the washing machine. Nell did not. She set her alarm for six in the ' +
        'morning and sat on the stairs in the dark with a torch.',
        'At twenty past six the cat came down the hall with a striped sock in her mouth, ' +
        'walked straight past Nell without looking at her, and posted it under the ' +
        'bookcase in the front room.',
        'There were nineteen socks under there. Nell counted them twice.'
      ],
      qs: [
        { d: 152, q: 'What kept going missing?', a: 'socks', w: ['shoes', 'gloves', 'torches'] },
        { d: 158, q: 'Who did Dad blame?', a: 'the washing machine', w: ['the cat', 'Nell', 'nobody'] },
        { d: 166, q: 'Where did the cat put the sock?', a: 'under the bookcase', w: ['under the stairs', 'in the drawer', 'in the washing machine'] },
        { d: 174, q: 'Why did Nell sit on the stairs in the dark?', a: 'to find out what was taking the socks', w: ['to hide from the cat', 'because she could not sleep', 'to wait for Dad'] },
        { d: 186, q: 'What does "walked straight past Nell without looking at her" suggest about the cat?', a: 'It did not think it was doing anything wrong.', w: ['It was frightened of Nell.', 'It could not see in the dark.', 'It was looking for Dad.'] }
      ] },
    { id: 'gl-clock', title: 'The Keeper of the Clocks',
      lvl: 5,
      text: [
        'Grandpa Ilya owned forty-one clocks, and not one of them agreed with another.',
        'Visitors found this unbearable. They would stand in the hallway while the house ticked ' +
        'around them in forty-one different rhythms, and eventually somebody would ask, politely, ' +
        'whether he had thought of setting them all to the same time.',
        '"I have thought of it," Grandpa Ilya always said, and changed the subject.',
        'It was Mira who worked it out, the summer she turned eleven. Each clock was set to the ' +
        'time in a place he had once lived: the kitchen clock to Odessa, the landing clock to ' +
        'Lisbon, the small brass one by his bed to a town whose name he would not say. He was not ' +
        'keeping bad time. He was keeping all his time at once.'
      ],
      qs: [
        { d: 202, q: 'How many clocks does Grandpa Ilya own?', a: '41', w: ['14', '11', '40'] },
        { d: 212, q: 'Why are the clocks set to different times?', a: 'Each one shows the time in a place he used to live.', w: ['They are all broken.', 'He forgets to set them.', 'He likes the sound they make.'] },
        { d: 220, q: 'What does "He was keeping all his time at once" mean?', a: 'He is holding on to every part of his past life.', w: ['He owns too many clocks.', 'He never knows what time it is.', 'He wants to live in the future.'] },
        { d: 226, q: 'Why does the writer mention the town "whose name he would not say"?', a: 'To hint that some memories are painful for him.', w: ['To show he has forgotten the name.', 'To show the clock is broken.', 'To show Mira was not listening.'] }
      ] },
    { id: 'gl-fox', title: 'The Fox in the Car Park',
      lvl: 3,
      text: [
        'Every evening at about eight, the fox came across the supermarket car park. It moved ' +
        'like water poured slowly, never hurrying, stopping now and then with one front paw lifted.',
        'Jamie watched from the flat above. He had named it Biscuit, which his sister said was a ' +
        'stupid name for something wild.',
        'One evening Jamie left half a sandwich at the edge of the car park. The fox came, looked ' +
        'at the sandwich for a long moment, and walked around it.',
        'Jamie was oddly pleased. Biscuit did not need him. That was, he decided, the whole point ' +
        'of a fox.'
      ],
      qs: [
        { d: 176, q: 'What time does the fox usually appear?', a: 'about eight in the evening', w: ['early in the morning', 'at midnight', 'at different times each day'] },
        { d: 190, q: 'What did the fox do with the sandwich?', a: 'It walked around it.', w: ['It ate it quickly.', 'It carried it away.', 'It buried it.'] },
        { d: 206, q: 'Why is Jamie pleased that the fox ignored the food?', a: 'It showed the fox was still wild and independent.', w: ['He wanted to eat the sandwich himself.', 'He was glad the fox was not hungry.', 'He wanted his sister to be wrong.'] },
        { d: 216, q: 'The phrase "like water poured slowly" describes —', a: 'how smoothly the fox moved', w: ['how wet the car park was', 'how fast the fox ran', 'how the fox drank'] }
      ] }
  ];

  /* ======================================================================
     THIRD GRADE · Informational text
     ====================================================================== */

  var G_INFO = [
    { id: 'gi-bats', title: 'Bats in the Dark',
      text: [
        'Bats hunt at night, when it is far too dark to see a flying insect. They find their ' +
        'food using sound instead of sight.',
        'A hunting bat makes a series of very high squeaks, most of them too high for people to ' +
        'hear. The sound travels out, hits whatever is in front of the bat, and bounces back. ' +
        'From that echo the bat learns where the object is, how big it is, and which way it is ' +
        'moving. This is called echolocation.',
        'A bat can catch hundreds of insects in a single night this way, in complete darkness, ' +
        'without ever bumping into a branch.'
      ],
      qs: [
        { d: 154, q: 'When do bats hunt?', a: 'at night', w: ['in the early morning', 'at midday', 'only in winter'] },
        { d: 168, q: 'What is the name for finding things by echo?', a: 'echolocation', w: ['migration', 'hibernation', 'navigation'] },
        { d: 158, q: 'What do bats use instead of sight?', a: 'sound', w: ['smell', 'touch', 'moonlight'] },
        { d: 176, q: 'How many insects can a bat catch in one night?', a: 'hundreds', w: ['three or four', 'about twenty', 'none at all'] },
        { d: 184, q: 'Why can people not usually hear a hunting bat?', a: 'Most of its squeaks are too high for human ears.', w: ['The bat is too far away.', 'The bat makes no sound at all.', 'The sound is blocked by branches.'] },
        { d: 198, q: 'What does the echo tell the bat?', a: 'where an object is, its size, and which way it is moving', w: ['only how far away an object is', 'what colour an object is', 'how warm an object is'] }
      ] },
    { id: 'gi-honey', title: 'How Honey Is Made',
      text: [
        'A honey bee visits about fifty flowers on a single trip. From each one she drinks a ' +
        'sweet liquid called nectar and stores it in a special stomach kept just for carrying.',
        'Back at the hive, she passes the nectar to another bee, who passes it to another. Each ' +
        'time it is passed along, a little water leaves the nectar and it grows thicker.',
        'At last it is put into a wax cell. The bees fan it with their wings until it is thick ' +
        'enough to keep, and then they seal the cell with a wax lid.',
        'It takes the work of about three hundred bees, all summer long, to make one jar of honey.'
      ],
      qs: [
        { d: 160, q: 'What is the sweet liquid in flowers called?', a: 'nectar', w: ['honey', 'wax', 'pollen'] },
        { d: 174, q: 'How do the bees make the nectar thicker at the end?', a: 'They fan it with their wings.', w: ['They heat it over a fire.', 'They add wax to it.', 'They leave it in the sun.'] },
        { d: 168, q: 'About how many flowers does a bee visit on one trip?', a: 'about fifty', w: ['about five', 'about five hundred', 'just one'] },
        { d: 190, q: 'About how many bees does it take to fill one jar of honey?', a: 'about three hundred', w: ['about fifty', 'about fifty thousand', 'about three'] },
        { d: 204, q: 'What is the main idea of this passage?', a: 'Making honey is a long process that takes many bees.', w: ['Bees prefer some flowers to others.', 'Honey is good to eat.', 'Bees live together in hives.'] }
      ] },
    { id: 'gi-leaves', title: 'Why Leaves Change Colour',
      text: [
        'The green in a leaf comes from a substance called chlorophyll, which the tree uses to ' +
        'turn sunlight into food. All summer the leaf is packed with it.',
        'Yellow and orange colours are in the leaf all along, hidden underneath the green.',
        'As the days grow shorter in autumn, the tree begins to shut down for winter. It stops ' +
        'making chlorophyll, and the green slowly fades away. What is left are the yellows and ' +
        'oranges that were always there.',
        'Red is different. Some trees make red colouring fresh in the autumn, in the last warm ' +
        'days, which is why the reddest autumns follow sunny Septembers.'
      ],
      qs: [
        { d: 172, q: 'What makes a leaf green?', a: 'chlorophyll', w: ['sunlight', 'water', 'red colouring'] },
        { d: 186, q: 'Where do the yellow colours come from?', a: 'They were in the leaf all along, hidden by the green.', w: ['The tree makes them in autumn.', 'They come from the soil.', 'They come from the cold.'] },
        { d: 200, q: 'How is red different from yellow in this passage?', a: 'Red is made fresh in autumn; yellow was already there.', w: ['Red appears first.', 'Red comes from chlorophyll.', 'Red only appears on old trees.'] },
        { d: 214, q: 'Why would a sunny September make a redder autumn?', a: 'Warm sunny days help the tree make red colouring.', w: ['Sunlight burns the leaves.', 'The tree keeps its chlorophyll longer.', 'Sunny days make leaves fall sooner.'] }
      ] },
    { id: 'gi-bridge', title: 'Building a Bridge',
      text: [
        'A suspension bridge does not stand on its roadway. It hangs from it.',
        'First, engineers build two tall towers, one at each end. Then an enormous cable is ' +
        'strung over the top of both towers and anchored deep into the ground at either side.',
        'From that main cable, hundreds of thinner vertical cables drop down, and the roadway is ' +
        'hung from them, section by section, usually starting from the middle and working outwards.',
        'Because the weight is carried by the cables and pulled down through the towers, a ' +
        'suspension bridge can cross a much wider gap than a bridge that has to stand on legs.'
      ],
      qs: [
        { d: 178, q: 'What is built first?', a: 'the two towers', w: ['the roadway', 'the main cable', 'the anchors'] },
        { d: 192, q: 'Where does the roadway usually start being hung?', a: 'in the middle', w: ['at one end', 'at both towers', 'at the anchors'] },
        { d: 206, q: 'Why can a suspension bridge cross a wider gap?', a: 'Its weight hangs from cables instead of standing on legs.', w: ['It is made of lighter material.', 'It has more towers.', 'It is built more slowly.'] },
        { d: 220, q: 'The writer says a suspension bridge "does not stand on its roadway. It hangs from it." Why begin this way?', a: 'To point out the surprising idea the passage will explain.', w: ['To warn that the bridge is unsafe.', 'To describe how it looks from below.', 'To list the parts of a bridge.'] }
      ] },
    { id: 'gi-volcano', title: 'Under a Volcano',
      text: [
        'Deep below the ground, rock is so hot that it melts. Melted rock is called magma, and ' +
        'it is lighter than the solid rock around it, so it slowly rises.',
        'Magma collects in a large space called a magma chamber, a few kilometres under the ' +
        'surface. Pressure builds there, the way it builds in a shaken bottle of fizzy drink.',
        'When the pressure grows too great, the magma forces its way up through a crack and out ' +
        'of the top. Once it reaches the air, it is no longer called magma. It is called lava.',
        'Scientists watch for small earthquakes and for the ground swelling slightly, because ' +
        'both can mean magma is on the move.'
      ],
      qs: [
        { d: 182, q: 'What is melted rock called before it reaches the surface?', a: 'magma', w: ['lava', 'ash', 'crust'] },
        { d: 194, q: 'Why does magma rise?', a: 'It is lighter than the solid rock around it.', w: ['It is pushed by earthquakes.', 'It is pulled by the sun.', 'Scientists pump it up.'] },
        { d: 208, q: 'What do scientists watch for as a warning?', a: 'small earthquakes and swelling ground', w: ['heavy rain', 'changes in the wind', 'more lava in the chamber'] },
        { d: 222, q: 'Why does the writer compare the magma chamber to a fizzy drink bottle?', a: 'To show how pressure builds until something bursts out.', w: ['To show that magma is a liquid.', 'To show that volcanoes are small.', 'To show that magma is sweet.'] }
      ] },
    { id: 'gi-rover', title: 'Driving on Mars',
      text: [
        'A rover on Mars cannot be driven the way a car is driven. Mars is so far away that a ' +
        'radio signal takes between four and twenty-four minutes to arrive, depending on where ' +
        'the two planets are.',
        'That means if a driver on Earth saw a rock in the way and turned the wheel, the message ' +
        'would reach the rover long after it had hit the rock.',
        'Instead, engineers send a whole plan for the day at once: drive forward six metres, turn ' +
        'left, photograph that ridge. The rover carries out the plan on its own and reports back ' +
        'what happened.',
        'The rovers also steer themselves around obstacles they spot, which is why they are given ' +
        'a destination rather than a route.'
      ],
      qs: [
        { d: 196, q: 'How long can a signal take to reach Mars?', a: 'between four and twenty-four minutes', w: ['a few seconds', 'about one hour', 'a whole day'] },
        { d: 208, q: 'Why can a driver on Earth not steer the rover directly?', a: 'The message would arrive too late to help.', w: ['The rover has no steering wheel.', 'Mars has no radio signals.', 'The rover moves too fast.'] },
        { d: 218, q: 'What do engineers send instead?', a: 'a whole plan of actions for the day', w: ['one instruction at a time', 'a new map of Mars', 'a repair robot'] },
        { d: 226, q: 'Why is the rover given "a destination rather than a route"?', a: 'It can find its own way around obstacles.', w: ['Engineers do not have a map.', 'Routes take longer to send.', 'The rover cannot turn.'] }
      ] },
    { id: 'gi-teeth', title: 'Two Sets of Teeth',
      text: [
        'A child grows two complete sets of teeth. The first set, twenty small teeth, is finished ' +
        'by about the age of three.',
        'Those teeth are not wasted. They hold open the space in the jaw where the adult tooth ' +
        'will later grow, a bit like a bookmark holding a page.',
        'From about the age of six, the root of each baby tooth is slowly dissolved from ' +
        'underneath by the adult tooth pushing up. That is why a baby tooth wobbles before it ' +
        'comes out, and why the tooth that falls out has almost no root left on it.',
        'The adult set has thirty-two teeth, and it has to last the rest of your life.'
      ],
      qs: [
        { d: 164, q: 'How many teeth are in the first set?', a: '20', w: ['32', '6', '12'] },
        { d: 156, q: 'By what age is the first set of teeth finished?', a: 'about three', w: ['about six', 'about ten', 'at birth'] },
        { d: 172, q: 'How many teeth are in the adult set?', a: '32', w: ['20', '16', '40'] },
        { d: 180, q: 'What job do baby teeth do besides chewing?', a: 'They hold open the space for the adult tooth.', w: ['They make the jaw grow.', 'They help a child speak.', 'They protect the gums from food.'] },
        { d: 196, q: 'Why does a baby tooth wobble before it falls out?', a: 'Its root is being dissolved from underneath.', w: ['It is being pushed sideways by chewing.', 'The gum is growing.', 'It has become too big for the jaw.'] },
        { d: 210, q: 'The writer compares a baby tooth to a bookmark to show that it —', a: 'keeps a place for something that comes later', w: ['is thin and flat', 'is easy to lose', 'is made of paper'] }
      ] },
    { id: 'gi-owls', title: 'Silent Wings',
      text: [
        'Most birds make a whooshing sound when they fly. An owl makes almost none.',
        'The front edge of an owl\'s wing feather is not smooth. It is fringed, like a tiny ' +
        'comb, and it breaks up the rush of air that would otherwise make a noise. The rest ' +
        'of the feather is soft and velvety, which soaks up the sound that is left.',
        'This matters twice over. A mouse cannot hear the owl coming, and the owl can hear ' +
        'the mouse, because it is not deafened by the sound of its own flying.'
      ],
      qs: [
        { d: 152, q: 'What sound does an owl make when it flies?', a: 'almost none', w: ['a loud whoosh', 'a sharp click', 'a soft hoot'] },
        { d: 160, q: 'What is the front edge of the feather like?', a: 'fringed, like a tiny comb', w: ['smooth and hard', 'wet and shiny', 'sharp like a knife'] },
        { d: 168, q: 'What does the soft, velvety part of the feather do?', a: 'soaks up the sound that is left', w: ['keeps the owl warm', 'makes the owl fly faster', 'helps the owl steer'] },
        { d: 176, q: 'Why is silent flight useful to the owl twice over?', a: 'The mouse cannot hear it, and it can hear the mouse.', w: ['It flies faster and further.', 'It stays warm and dry.', 'Other owls cannot find it.'] }
      ] },
    { id: 'gi-weather', title: 'Reading a Weather Map',
      text: [
        'A weather map uses symbols so that a great deal of information fits into a small space.',
        'A line with small triangles along it is a cold front. Cold air is pushing forward, and ' +
        'behind it the temperature usually drops. A line with small half-circles is a warm front, ' +
        'where warmer air is moving in.',
        'The thin curving lines that never cross one another join places with the same air ' +
        'pressure. Where they are packed closely together, the wind is strong; where they are far ' +
        'apart, the air is calm.',
        'A large blue H marks high pressure, which usually brings settled, dry weather. A red L ' +
        'marks low pressure, which often brings cloud and rain.'
      ],
      qs: [
        { d: 200, q: 'What does a line with small triangles show?', a: 'a cold front', w: ['a warm front', 'high pressure', 'strong wind'] },
        { d: 212, q: 'What does it mean when the curving pressure lines are close together?', a: 'The wind is strong there.', w: ['It is about to rain.', 'The air is calm.', 'A warm front is arriving.'] },
        { d: 220, q: 'Which weather would you expect near a large blue H?', a: 'dry and settled', w: ['heavy rain', 'strong wind and cloud', 'snow'] },
        { d: 226, q: 'Why does a weather map use symbols instead of words?', a: 'A great deal of information fits into a small space.', w: ['Symbols are more accurate than words.', 'Not everybody can read.', 'Symbols are quicker to draw.'] }
      ] }
  ];

  /* Expand every passage into its questions. The item keeps `pid`, which the
     engine uses to serve the rest of a passage's questions before moving on --
     the "same passage, different question" the proctor script warns about. */
  function addPassages(list, band, areaOf) {
    list.forEach(function (p) {
      var passage = {
        title: p.title,
        html: p.text.map(function (t) { return '<p>' + t + '</p>'; }).join('')
      };
      p.qs.forEach(function (q, n) {
        item({
          id: p.id + '-q' + (n + 1), b: band, a: areaOf(p), d: q.d, pid: p.id, once: true,
          make: (function (qq) {
            return function (R) {
              var m = mc(R, qq.a, qq.w);
              return {
                passage: passage,
                stem: qq.q,
                say: qq.q,
                choices: m.choices, answer: m.answer,
                cols: 2
              };
            };
          })(q)
        });
      });
    });
  }

  addPassages(K_PASSAGES, 'k', function () { return 'lit'; });
  addPassages(G_LIT, 'g', function () { return 'lit'; });
  addPassages(G_INFO, 'g', function () { return 'info'; });

  /* ======================================================================
     THIRD GRADE · Vocabulary

     Generators rather than a fixed list, because vocabulary is the one area
     with only one strand feeding it -- it has to fill a third of the test on
     its own without repeating itself.
     ====================================================================== */

  var CONTEXT = [
    { s: 'The path was so <b>narrow</b> that we had to walk in single file.', w: 'narrow',
      a: 'not wide', x: ['very long', 'very steep', 'covered in mud'] },
    { s: 'She spoke in a <b>feeble</b> voice, barely louder than a whisper.', w: 'feeble',
      a: 'weak', x: ['angry', 'cheerful', 'fast'] },
    { s: 'The crowd <b>dispersed</b> once the music stopped and the square was soon empty.', w: 'dispersed',
      a: 'spread out and went away', x: ['grew larger', 'began to sing', 'sat down'] },
    { s: 'He gave a <b>reluctant</b> nod, as if he would rather have said no.', w: 'reluctant',
      a: 'unwilling', x: ['eager', 'sleepy', 'polite'] },
    { s: 'The old bridge was <b>sturdy</b> and did not shake at all when the lorry crossed.', w: 'sturdy',
      a: 'strong', x: ['narrow', 'ancient', 'beautiful'] },
    { s: 'The instructions were so <b>vague</b> that nobody knew which way to turn.', w: 'vague',
      a: 'unclear', x: ['very long', 'printed badly', 'written in pencil'] },
    { s: 'Rain fell <b>persistently</b> all week and never once stopped for long.', w: 'persistently',
      a: 'again and again without stopping', x: ['very heavily', 'only at night', 'without a sound'] },
    { s: 'The soup was <b>bland</b>, so Dad added pepper and a little salt.', w: 'bland',
      a: 'lacking flavour', x: ['too hot to eat', 'burnt', 'very spicy'] },
    { s: 'She was <b>bewildered</b> by the map and turned it round three times.', w: 'bewildered',
      a: 'confused', x: ['delighted', 'bored', 'frightened'] },
    { s: 'The cat approached the strange dog <b>cautiously</b>, one slow step at a time.', w: 'cautiously',
      a: 'carefully', x: ['quickly', 'loudly', 'happily'] },
    { s: 'After the long climb their legs were <b>weary</b> and they sat down on a rock.', w: 'weary',
      a: 'tired', x: ['muddy', 'cold', 'shaky with excitement'] },
    { s: 'The hall was <b>vast</b> — you could have fitted the whole school inside it.', w: 'vast',
      a: 'very large', x: ['very old', 'very dark', 'very noisy'] }
  ];

  item({ id: 'g-vocab-everyday', b: 'g', a: 'vocab', d: 166, make: function (R) {
    var s = pick(R, [
      { s: 'The puppy was <b>timid</b> and hid behind the sofa when visitors came.', w: 'timid',
        a: 'shy', x: ['noisy', 'hungry', 'clever'] },
      { s: 'The shed was <b>crammed</b> with tools, and nothing else would fit.', w: 'crammed',
        a: 'very full', x: ['empty', 'broken', 'locked'] },
      { s: 'She <b>seized</b> the rope and held on as hard as she could.', w: 'seized',
        a: 'grabbed', x: ['dropped', 'cut', 'looked at'] },
      { s: 'The path was <b>slippery</b> after the rain, so we walked carefully.', w: 'slippery',
        a: 'easy to slide on', x: ['very long', 'covered in stones', 'uphill'] },
      { s: 'He was <b>famished</b> and ate three slices of toast.', w: 'famished',
        a: 'very hungry', x: ['very tired', 'very late', 'very pleased'] }
    ]);
    var q = mc(R, s.a, s.x);
    return { stem: 'What does <b>' + s.w + '</b> mean in this sentence?<br>' + s.s,
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-vocab-context', b: 'g', a: 'vocab', d: 174, make: function (R) {
    var c = pick(R, CONTEXT.slice(0, 6));
    var q = mc(R, c.a, c.x);
    return { stem: 'What does <b>' + c.w + '</b> mean in this sentence?<br>' + c.s,
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-vocab-context2', b: 'g', a: 'vocab', d: 200, make: function (R) {
    var c = pick(R, CONTEXT.slice(6));
    var q = mc(R, c.a, c.x);
    return { stem: 'What does <b>' + c.w + '</b> mean in this sentence?<br>' + c.s,
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  var AFFIX = [
    { w: 'unhappy', p: 'un-', a: 'not happy', x: ['very happy', 'happy again', 'happy before'] },
    { w: 'rewrite', p: 're-', a: 'write again', x: ['write badly', 'stop writing', 'write first'] },
    { w: 'careless', p: '-less', a: 'without care', x: ['full of care', 'caring again', 'a little careful'] },
    { w: 'helpful', p: '-ful', a: 'full of help', x: ['without help', 'helping again', 'needing help'] },
    { w: 'preview', p: 'pre-', a: 'look at before', x: ['look at again', 'look at carefully', 'refuse to look'] },
    { w: 'disagree', p: 'dis-', a: 'not agree', x: ['agree strongly', 'agree again', 'agree later'] },
    { w: 'painter', p: '-er', a: 'a person who paints', x: ['a kind of paint', 'painted long ago', 'without paint'] },
    { w: 'misplace', p: 'mis-', a: 'put in the wrong place', x: ['put back', 'put down gently', 'find again'] }
  ];

  item({ id: 'g-vocab-affix', b: 'g', a: 'vocab', d: 186, make: function (R) {
    var f = pick(R, AFFIX);
    var q = mc(R, f.a, f.x);
    return { stem: 'What does <b>' + f.w + '</b> mean?', choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-vocab-affixpart', b: 'g', a: 'vocab', d: 206, make: function (R) {
    var f = pick(R, AFFIX);
    var others = shuffle(R, AFFIX.filter(function (x) { return x.p !== f.p; }))
      .slice(0, 3).map(function (x) { return x.p; });
    var q = mc(R, f.p, others);
    return { stem: 'Which word part in <b>' + f.w + '</b> changes what the word means?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  var SYNANT = [
    { w: 'enormous', syn: 'huge', ant: 'tiny', x: ['noisy', 'gentle', 'round'] },
    { w: 'ancient', syn: 'very old', ant: 'brand new', x: ['very tall', 'very clean', 'very fast'] },
    { w: 'furious', syn: 'very angry', ant: 'calm', x: ['very fast', 'very hungry', 'very quiet'] },
    { w: 'timid', syn: 'shy', ant: 'bold', x: ['clever', 'cheerful', 'strong'] },
    { w: 'scarce', syn: 'hard to find', ant: 'plentiful', x: ['expensive', 'heavy', 'unwanted'] },
    { w: 'depart', syn: 'leave', ant: 'arrive', x: ['wait', 'hurry', 'return slowly'] }
  ];

  item({ id: 'g-vocab-syn', b: 'g', a: 'vocab', d: 164, make: function (R) {
    var s = pick(R, SYNANT);
    var q = mc(R, s.syn, [s.ant].concat(s.x.slice(0, 2)));
    return { stem: 'Which words mean almost the <b>same</b> as <b>' + s.w + '</b>?',
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  item({ id: 'g-vocab-ant', b: 'g', a: 'vocab', d: 192, make: function (R) {
    var s = pick(R, SYNANT);
    var q = mc(R, s.ant, [s.syn].concat(s.x.slice(0, 2)));
    return { stem: 'Which words mean the <b>opposite</b> of <b>' + s.w + '</b>?',
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  var HOMOGRAPH = [
    { s: 'The wind was so strong it bent the young trees.', w: 'wind', a: 'moving air',
      x: ['to turn a handle', 'a long road', 'to wrap around'] },
    { s: 'Please wind the string back onto the reel.', w: 'wind', a: 'to wrap around',
      x: ['moving air', 'a loud noise', 'to cut in half'] },
    { s: 'She left a note on the kitchen table.', w: 'note', a: 'a short written message',
      x: ['a musical sound', 'to notice something', 'a bank card'] },
    { s: 'He sang the last note perfectly.', w: 'note', a: 'a musical sound',
      x: ['a short written message', 'to write down', 'a warning'] },
    { s: 'The bark of the old oak was rough and deeply lined.', w: 'bark',
      a: 'the outside covering of a tree', x: ['the sound a dog makes', 'a small boat', 'to shout an order'] },
    { s: 'Do not trip over the box in the hallway.', w: 'trip', a: 'to stumble and fall',
      x: ['a journey', 'a mistake', 'to run quickly'] }
  ];

  item({ id: 'g-vocab-homograph', b: 'g', a: 'vocab', d: 212, make: function (R) {
    var h = pick(R, HOMOGRAPH);
    var q = mc(R, h.a, h.x);
    return { stem: 'What does <b>' + h.w + '</b> mean in this sentence?<br><b>' + h.s + '</b>',
             choices: q.choices, answer: q.answer, cols: 2 };
  } });

  /* Tap the word in the sentence: the "hot text" item type the real test
     uses, and an answer format that cannot be faked with a guess between
     four buttons. */
  var HOT = [
    /* "slowly" was in this sentence and answers the question just as well as
       "plodded" does -- two right answers, caught in the first screenshot
       pass. The adverb is gone. */
    { s: 'The tired old donkey plodded up the steep hill.', want: 'plodded',
      ask: 'Tap the word that tells you <b>how the donkey moved</b>.' },
    { s: 'Marla whispered the answer so that nobody else would hear.', want: 'whispered',
      ask: 'Tap the word that shows she spoke <b>quietly</b>.' },
    { s: 'A sudden gust flung the door open and scattered the papers.', want: 'flung',
      ask: 'Tap the word that shows the door was opened <b>with force</b>.' },
    { s: 'The enormous grey elephant drank calmly from the muddy river.', want: 'enormous',
      ask: 'Tap the word that tells you the elephant was <b>very big</b>.' },
    { s: 'He gobbled his lunch and ran straight back outside.', want: 'gobbled',
      ask: 'Tap the word that shows he ate <b>very quickly</b>.' },
    { s: 'The ancient map crumbled when she unfolded it.', want: 'crumbled',
      ask: 'Tap the word that shows the map <b>fell apart</b>.' }
  ];

  item({ id: 'g-vocab-hottext', b: 'g', a: 'vocab', d: 180, t: 'hottext', make: function (R) {
    var h = pick(R, HOT);
    var words = h.s.split(' ');
    var idx = -1, i;
    for (i = 0; i < words.length; i++) if (words[i].replace(/[.,;]/g, '') === h.want) idx = i;
    return { stem: h.ask, words: words, answer: idx };
  } });

  item({ id: 'g-vocab-hottext2', b: 'g', a: 'vocab', d: 218, t: 'hottext', make: function (R) {
    var s = pick(R, [
      { s: 'Although the sky was clear, Dad packed an umbrella.', want: 'Although',
        ask: 'Tap the word that shows two ideas are being <b>contrasted</b>.' },
      { s: 'The bridge was closed because the river had risen overnight.', want: 'because',
        ask: 'Tap the word that shows a <b>reason</b>.' },
      { s: 'We waited outside until the bell finally rang.', want: 'until',
        ask: 'Tap the word that tells you <b>when</b> the waiting stopped.' },
      { s: 'She practised every day; consequently her playing improved.', want: 'consequently',
        ask: 'Tap the word that shows a <b>result</b>.' }
    ]);
    var words = s.s.split(' ');
    var idx = -1, i;
    for (i = 0; i < words.length; i++) if (words[i].replace(/[.,;]/g, '') === s.want) idx = i;
    return { stem: s.ask, words: words, answer: idx };
  } });

  item({ id: 'g-vocab-shades', b: 'g', a: 'vocab', d: 224, make: function (R) {
    var s = pick(R, [
      { q: 'Which word shows someone was the <b>most</b> pleased?', a: 'delighted',
        x: ['content', 'satisfied', 'pleased'] },
      { q: 'Which word shows the <b>strongest</b> dislike?', a: 'loathed',
        x: ['disliked', 'minded', 'avoided'] },
      { q: 'Which word describes the <b>heaviest</b> rain?', a: 'downpour',
        x: ['shower', 'drizzle', 'mist'] },
      { q: 'Which word shows someone spoke the <b>most</b> loudly?', a: 'bellowed',
        x: ['said', 'called', 'spoke up'] }
    ]);
    var q = mc(R, s.a, s.x);
    return { stem: s.q, choices: q.choices, answer: q.answer, cols: 4 };
  } });

  item({ id: 'g-vocab-root', b: 'g', a: 'vocab', d: 156, make: function (R) {
    var s = pick(R, [
      { w: 'kindness', a: 'kind', x: ['ness', 'kindn', 'indne'] },
      { w: 'quickly', a: 'quick', x: ['ly', 'uickl', 'quic'] },
      { w: 'rebuilding', a: 'build', x: ['re', 'ing', 'rebuild'] },
      { w: 'unlocked', a: 'lock', x: ['un', 'ed', 'unlock'] },
      { w: 'hopeless', a: 'hope', x: ['less', 'opel', 'hopel'] }
    ]);
    var q = mc(R, s.a, s.x);
    return { stem: 'What is the <b>root word</b> in <b>' + s.w + '</b>?',
             choices: q.choices, answer: q.answer, cols: 4 };
  } });

  return ITEMS;
})();
