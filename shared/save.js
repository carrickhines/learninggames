/* ==========================================================================
   Save — per-kid profiles, the gold/XP economy, inventory, and the monster
   card collection. Everything persistent in the site lives here.

   Storage is one localStorage key holding one JSON blob. No server, no
   database, no accounts. The whole site is one origin, so a profile earned in
   Math RPG is the same profile the shop and Story Quest see.

   localStorage can be wiped by clearing browsing data, so the hub offers
   Export / Import Progress — crude, but it means a cleared iPad isn't a lost
   character.

   Every write is wrapped in try/catch. If storage is full or disabled the
   games must stay playable and simply forget — never crash.
   ========================================================================== */

var Save = (function () {
  'use strict';

  var KEY = 'lg_save_v1';

  /* ---------- Tuning ------------------------------------------------------
     All the numbers that decide how fast progress feels, in one place. Watch
     the kids play, then change these. */

  var ECONOMY = {
    correct:      { gold: 2,  xp: 1 },   // a normal hit
    correctFast:  { gold: 4,  xp: 2 },   // answered inside the double-hit window
    foeDefeated:  { gold: 10, xp: 5 },
    runWon:       { gold: 25, xp: 25 },  // beat every foe in a run
    storyChoice:  { gold: 2,  xp: 2 },   // right choice in a Story Quest scene
    storyChest:   { gold: 5,  xp: 3 },
    questDone:    { gold: 30, xp: 30 },

    // Wrong answers cost nothing. Progress only ever goes up — the games are
    // already punishing enough with lost hearts.

    /* ---- Monster cards ----
       Cards are rare on purpose: a collection you finish in a week isn't a
       collection. A beaten monster rolls `cardChance`, scaled down for the
       rarer ones, so a world's nine cards take weeks and its legendaries are
       the ones you actually chase.

       The pity counter is what keeps rare from meaning miserable: go
       `cardPity` monsters with nothing to show and the next one drops for
       certain. A floor you can feel, without capping the ceiling. */
    cardChance: 0.12,
    cardRarityOdds: { 1: 1, 2: 0.5, 3: 0.25 },   // common, rare, legendary
    cardPity: 30,
    foilChance: 0.05,        // any drop can come back shiny

    // What the Card Trader pays for a spare, by rarity. A foil counts triple.
    cardValue: { 1: 40, 2: 120, 3: 400 },
    foilWorth: 3,
    wildCardCost: 12,        // spare cards traded for one you're missing

    baseXpToLevel: 100,   // XP for level 1 -> 2
    xpStepPerLevel: 50    // each level costs this much more than the last
  };

  /* ---------- Worlds and their monsters ----------------------------------
     A world is a foe lineup, a look, and a payout. Math RPG fights four
     monsters per run and Language RPG five, so each world lists both.

     `gold` multiplies everything earned while fighting there. Harder worlds
     paying more is what keeps the late shop from becoming a grind — without
     it, a 12,000-gold sword at the starting rate is a month of nothing.

     Every foe `id` is also its collectible card id, so it must stay unique
     across the site. `r` is the card's rarity: 1 common, 2 rare, 3 legendary.
     Each world's last foe is its boss and is always legendary. */

  var WORLDS = [
    {
      id: 'meadow', name: 'Sunny Meadow', emoji: '🌳', gold: 1,
      sub: 'Where every hero starts',
      foes: {
        math: [
          { id: 'm-slime',  name: 'Slime',   emoji: '🟢', hp: 3, scale: 0.80, r: 1 },
          { id: 'm-bat',    name: 'Bat',     emoji: '🦇', hp: 4, scale: 1.05, r: 1 },
          { id: 'm-ghost',  name: 'Ghost',   emoji: '👻', hp: 4, scale: 0.92, r: 2 },
          { id: 'm-dragon', name: 'Dragon',  emoji: '🐉', hp: 5, scale: 1.16, r: 3 }
        ],
        language: [
          { id: 'l-slime',  name: 'Slow Slime',     emoji: '🐌', hp: 3, scale: 0.90, r: 1 },
          { id: 'l-imp',    name: 'Pixel Imp',      emoji: '👾', hp: 3, scale: 0.95, r: 1 },
          { id: 'l-ghost',  name: 'Giggly Ghost',   emoji: '👻', hp: 4, scale: 0.95, r: 1 },
          { id: 'l-rex',    name: 'Chompy Rex',     emoji: '🦖', hp: 5, scale: 1.05, r: 2 },
          { id: 'l-dragon', name: 'The Big Dragon', emoji: '🐉', hp: 6, scale: 1.16, r: 3 }
        ]
      }
    },
    {
      id: 'cave', name: 'Crystal Cave', emoji: '💎', gold: 1.4,
      sub: 'Darker, and the monsters are tougher',
      foes: {
        math: [
          { id: 'm-crab',   name: 'Rock Crab',    emoji: '🦀', hp: 4, scale: 0.95, r: 1 },
          { id: 'm-spider', name: 'Cave Spider',  emoji: '🕷️', hp: 4, scale: 0.90, r: 1 },
          { id: 'm-golem',  name: 'Gem Golem',    emoji: '🗿', hp: 5, scale: 1.05, r: 2 },
          { id: 'm-kraken', name: 'Deep Kraken',  emoji: '🦑', hp: 6, scale: 1.10, r: 3 }
        ],
        language: [
          { id: 'l-bug',    name: 'Grumble Bug',  emoji: '🐛', hp: 4, scale: 0.90, r: 1 },
          { id: 'l-bat',    name: 'Echo Bat',     emoji: '🦇', hp: 4, scale: 1.00, r: 1 },
          { id: 'l-troll',  name: 'Mumble Troll', emoji: '🧌', hp: 5, scale: 1.05, r: 1 },
          { id: 'l-squid',  name: 'Inky Squid',   emoji: '🦑', hp: 5, scale: 1.05, r: 2 },
          { id: 'l-wyrm',   name: 'Cave Wyrm',    emoji: '🐉', hp: 7, scale: 1.16, r: 3 }
        ]
      }
    },
    {
      id: 'sky', name: 'Sky Castle', emoji: '🏰', gold: 1.8,
      sub: 'Monsters above the clouds',
      foes: {
        math: [
          { id: 'm-cloud',  name: 'Storm Cloud',   emoji: '🌩️', hp: 5, scale: 0.95, r: 1 },
          { id: 'm-bird',   name: 'Sky Screecher', emoji: '🦅', hp: 5, scale: 1.00, r: 1 },
          { id: 'm-robot',  name: 'Clockwork',     emoji: '🤖', hp: 6, scale: 1.00, r: 2 },
          { id: 'm-star',   name: 'Star Tyrant',   emoji: '🌟', hp: 7, scale: 1.10, r: 3 }
        ],
        language: [
          { id: 'l-owl',    name: 'Riddle Owl',   emoji: '🦉', hp: 5, scale: 0.95, r: 1 },
          { id: 'l-genie',  name: 'Word Genie',   emoji: '🧞', hp: 5, scale: 1.05, r: 1 },
          { id: 'l-knight', name: 'Iron Knight',  emoji: '🛡️', hp: 6, scale: 0.95, r: 1 },
          { id: 'l-phoenix',name: 'Phoenix',      emoji: '🔥', hp: 6, scale: 1.05, r: 2 },
          { id: 'l-titan',  name: 'Sky Titan',    emoji: '👹', hp: 8, scale: 1.16, r: 3 }
        ]
      }
    },
    {
      id: 'reef', name: 'Sunken Reef', emoji: '🌊', gold: 2.3,
      sub: 'Down where the light runs out',
      foes: {
        math: [
          { id: 'm-jelly',  name: 'Zap Jelly',    emoji: '🪼', hp: 6, scale: 0.95, r: 1 },
          { id: 'm-puffer', name: 'Puffer',       emoji: '🐡', hp: 6, scale: 0.95, r: 1 },
          { id: 'm-shark',  name: 'Gnash',        emoji: '🦈', hp: 7, scale: 1.10, r: 2 },
          { id: 'm-leviath',name: 'Leviathan',    emoji: '🐋', hp: 9, scale: 1.16, r: 3 }
        ],
        language: [
          { id: 'l-crab',   name: 'Clacky Crab',  emoji: '🦀', hp: 6, scale: 0.95, r: 1 },
          { id: 'l-eel',    name: 'Mumble Eel',   emoji: '🐍', hp: 6, scale: 1.00, r: 1 },
          { id: 'l-turtle', name: 'Old Shellback',emoji: '🐢', hp: 7, scale: 1.00, r: 1 },
          { id: 'l-siren',  name: 'Siren',        emoji: '🧜', hp: 7, scale: 1.05, r: 2 },
          { id: 'l-maw',    name: 'The Deep Maw', emoji: '🐙', hp: 10, scale: 1.16, r: 3 }
        ]
      }
    },
    {
      id: 'ember', name: 'Ember Peak', emoji: '🌋', gold: 3,
      sub: 'The last mountain. Bring everything.',
      foes: {
        math: [
          { id: 'm-imp',    name: 'Cinder Imp',   emoji: '👺', hp: 7, scale: 0.95, r: 1 },
          { id: 'm-magma',  name: 'Magma Blob',   emoji: '🟠', hp: 8, scale: 1.00, r: 1 },
          { id: 'm-titan',  name: 'Ash Titan',    emoji: '🗿', hp: 9, scale: 1.10, r: 2 },
          { id: 'm-wyrm',   name: 'Emberwyrm',    emoji: '🐲', hp: 11, scale: 1.16, r: 3 }
        ],
        language: [
          { id: 'l-spark',  name: 'Spark Sprite', emoji: '✨', hp: 7, scale: 0.90, r: 1 },
          { id: 'l-hound',  name: 'Ash Hound',    emoji: '🐕', hp: 8, scale: 1.00, r: 1 },
          { id: 'l-golem',  name: 'Slag Golem',   emoji: '🪨', hp: 9, scale: 1.05, r: 1 },
          { id: 'l-djinn',  name: 'Fire Djinn',   emoji: '🔥', hp: 9, scale: 1.05, r: 2 },
          { id: 'l-emberk', name: 'Ember King',   emoji: '👑', hp: 12, scale: 1.16, r: 3 }
        ]
      }
    }
  ];

  /* Story Quest has no combat, so each quest awards its own card instead. */
  var STORY_CARDS = [
    { id: 's-troll',   name: 'Bridge Troll',  emoji: '🌉' },
    { id: 's-dragon',  name: 'Librarian Dragon', emoji: '🐉' },
    { id: 's-ghost',   name: 'Ship Ghost',    emoji: '👻' },
    { id: 's-wizard',  name: 'Maze Wizard',   emoji: '🧙' },
    { id: 's-robot',   name: 'Baker Bot',     emoji: '🤖' },
    { id: 's-yeti',    name: 'Birthday Yeti', emoji: '🧊' },
    { id: 's-moon',    name: 'Moon Rover',    emoji: '🚀' },
    { id: 's-volcano', name: 'Cloud Dragon',  emoji: '🌋' },
    // the two little-hero games; kept after the quests so the first eight
    // still line up with QUESTS by index
    { id: 's-order',   name: 'Story Sorter',  emoji: '🃏' },
    { id: 's-finish',  name: 'Storyteller',   emoji: '🌱' }
  ];

  /* ---------- The shop ----------------------------------------------------
     Five tiers per slot, each roughly 3x the last, so there is always
     something affordable soon and something a long way off. The top tier of
     each slot also needs a completed card set (`set`), which is what makes
     "the best gear" a matter of months rather than a big number.

     Buffs stay mild on purpose. Owning something that grows is the point;
     making the math easy is not. */

  var SHOP = [
    // ---- Weapons: a chance at extra damage, and the slash effect you see ----
    { id: 'stick', kind: 'weapon', name: 'Wooden Stick', emoji: '🪵', cost: 0,
      sub: 'Your trusty starter', slash: '💥' },
    { id: 'sword', kind: 'weapon', name: 'Sharp Sword', emoji: '⚔️', cost: 250,
      sub: 'Sometimes hits extra hard', slash: '⚔️', crit: 0.12 },
    { id: 'axe', kind: 'weapon', name: 'Battle Axe', emoji: '🪓', cost: 900,
      sub: 'Extra hits more often', slash: '🪓', crit: 0.20 },
    { id: 'flame', kind: 'weapon', name: 'Flame Blade', emoji: '🔥', cost: 3000,
      sub: 'DOUBLE hits do 3 damage', slash: '🔥', crit: 0.22, superDamage: 3 },
    { id: 'frost', kind: 'weapon', name: 'Frost Fang', emoji: '❄️', cost: 9000,
      sub: 'Crits often, DOUBLEs do 3', slash: '❄️', crit: 0.32, superDamage: 3 },
    { id: 'storm', kind: 'weapon', name: 'Storm Breaker', emoji: '⚡', cost: 30000,
      set: 'ember', sub: 'DOUBLE hits do 4', slash: '⚡', crit: 0.35, superDamage: 4 },

    // ---- Armor: more hearts ----
    { id: 'tunic', kind: 'armor', name: 'Cloth Tunic', emoji: '👕', cost: 0,
      sub: '5 hearts', bonusHp: 0 },
    { id: 'vest', kind: 'armor', name: 'Leather Vest', emoji: '🦺', cost: 250,
      sub: '6 hearts', bonusHp: 1 },
    { id: 'chain', kind: 'armor', name: 'Chain Mail', emoji: '⛓️', cost: 1100,
      sub: '7 hearts', bonusHp: 2 },
    { id: 'plate', kind: 'armor', name: 'Shiny Plate', emoji: '🛡️', cost: 3400,
      sub: '8 hearts', bonusHp: 3 },
    { id: 'scale', kind: 'armor', name: 'Dragon Scale', emoji: '🐲', cost: 10000,
      sub: '9 hearts', bonusHp: 4 },
    { id: 'aegis', kind: 'armor', name: 'Star Aegis', emoji: '🌟', cost: 26000,
      set: 'sky', sub: '10 hearts', bonusHp: 5 },

    // ---- Pets: a companion in the arena, plus one small passive ----
    { id: 'chick', kind: 'pet', name: 'Cheep', emoji: '🐣', cost: 200,
      sub: '+2 seconds to think', bonusTime: 2000 },
    { id: 'cat', kind: 'pet', name: 'Whiskers', emoji: '🐱', cost: 950,
      sub: '+3 seconds to think', bonusTime: 3000 },
    { id: 'drake', kind: 'pet', name: 'Ember', emoji: '🐲', cost: 3000,
      sub: 'Blocks one hit each run', shield: 1, bonusTime: 1000 },
    { id: 'griffin', kind: 'pet', name: 'Skyclaw', emoji: '🦅', cost: 8000,
      sub: 'Blocks a hit, +3 seconds', shield: 1, bonusTime: 3000 },
    { id: 'phoenix', kind: 'pet', name: 'Blaze', emoji: '🔥', cost: 22000,
      set: 'reef', sub: 'Blocks two hits, +4 seconds', shield: 2, bonusTime: 4000 },

    // ---- Trinkets: a fourth slot, and the effects that don't touch damage ----
    { id: 'coin', kind: 'trinket', name: 'Lucky Coin', emoji: '🪙', cost: 400,
      sub: '+10% gold', goldBonus: 0.10 },
    { id: 'lens', kind: 'trinket', name: "Finder's Lens", emoji: '🔎', cost: 1600,
      sub: 'Monster cards drop more often', cardBonus: 0.5 },
    { id: 'hourglass', kind: 'trinket', name: 'Hourglass', emoji: '⏳', cost: 4200,
      sub: 'A wider DOUBLE window', fastBonus: 1500 },
    { id: 'clover', kind: 'trinket', name: 'Four-Leaf Clover', emoji: '🍀', cost: 11000,
      sub: '+25% gold, better card luck', goldBonus: 0.25, cardBonus: 0.5 },
    { id: 'crown', kind: 'trinket', name: "Hero's Crown", emoji: '👑', cost: 28000,
      set: 'cave', sub: '+50% gold, wide DOUBLE window',
      goldBonus: 0.50, fastBonus: 2000, cardBonus: 0.5 },

    // ---- Worlds: new monsters, new cards, and better pay ----
    { id: 'world-cave', kind: 'world', world: 'cave', name: 'Crystal Cave',
      emoji: '💎', cost: 1200, sub: 'New monsters · 1.4× gold' },
    { id: 'world-sky', kind: 'world', world: 'sky', name: 'Sky Castle',
      emoji: '🏰', cost: 5000, sub: 'New monsters · 1.8× gold' },
    { id: 'world-reef', kind: 'world', world: 'reef', name: 'Sunken Reef',
      emoji: '🌊', cost: 14000, sub: 'New monsters · 2.3× gold' },
    { id: 'world-ember', kind: 'world', world: 'ember', name: 'Ember Peak',
      emoji: '🌋', cost: 30000, sub: 'New monsters · 3× gold' },

    // The old automatic win reward, now something you choose to spend on.
    { id: 'ipad', kind: 'token', name: 'iPad Time Token', emoji: '🎟️', cost: 600,
      sub: '5–10 minutes, redeem any time' }
  ];

  var AVATARS = ['🦸', '🦹', '🧙', '🧝', '🦊', '🐯', '🐸', '🦖', '🐙', '🦄', '🐧', '🤖'];

  /* ---------- Storage ---------------------------------------------------- */

  function blankProfile(name, avatar) {
    return {
      name: name || 'Hero',
      avatar: avatar || '🦸',
      created: Date.now(),
      xp: 0,
      gold: 0,
      inventory: {
        owned: ['stick', 'tunic'],
        weapon: 'stick',
        armor: 'tunic',
        pet: null,
        trinket: null,
        tokens: 0
      },
      cards: {},                     // card id -> copies held (foils included)
      foils: {},                     // card id -> how many of those are shiny
      progress: {
        world: 'meadow',
        unlockedWorlds: ['meadow'],
        runsWon: {},                 // game id -> wins
        questsDone: [],              // Story Quest quest indexes
        seqTier: 1,                  // Rule Hunter rung (math), 1-5
        seqCorrect: 0,               // correct answers on the current rung
        skipMastered: false,         // unlocks skip-counting by 2s and 3s
        koSinceCard: 0               // pity counter for card drops
      },
      settings: { modeByGame: {}, lastTrack: {} },
      stats: { correct: 0, wrong: 0, streak: 0, bestStreak: 0 }
    };
  }

  var VERSION = 2;
  var V2_GOLD_SCALE = 20;   // see migrate(): the v2 price rebalance factor

  function blankSave() {
    return { v: VERSION, active: null, profiles: {} };
  }

  var data = null;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blankSave();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object' || !d.profiles) return blankSave();
      return migrate(d);
    } catch (e) {
      return blankSave();          // corrupt or unreadable: start clean
    }
  }

  /* Bring an older save forward. Runs once — `v` is bumped and written back,
     so a hero can't be paid the migration bonus twice. */
  function migrate(d) {
    var v = d.v || 1;
    if (v >= VERSION) return d;

    if (v < 2) {
      // Prices went up roughly 20x in the v2 rebalance (the whole shop moved
      // from ~1,900 gold to ~40,000). Scale what everyone already has by the
      // same factor, so the change neither strands a saver nor makes anyone
      // instantly rich.
      Object.keys(d.profiles).forEach(function (id) {
        var p = d.profiles[id];
        p.gold = Math.round((p.gold || 0) * V2_GOLD_SCALE);
        // fields added in v2
        if (!p.inventory) p.inventory = {};
        if (p.inventory.trinket === undefined) p.inventory.trinket = null;
        if (!p.progress) p.progress = {};
        if (p.progress.koSinceCard === undefined) p.progress.koSinceCard = 0;
        if (!p.foils) p.foils = {};
      });
    }

    d.v = VERSION;
    return d;
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;                // full or disabled: play on, just forget
    }
  }

  function load() {
    if (!data) {
      var before = null;
      try { before = localStorage.getItem(KEY); } catch (e) { /* storage off */ }
      data = read();
      // if read() migrated, write the result back so it only happens once
      if (before && data.v === VERSION && before.indexOf('"v":' + VERSION) === -1) write();
    }
    return data;
  }

  /* The active profile, or null if nobody has been picked yet. Games call
     `Save.me()` and bounce to the hub when it returns null. */
  function me() {
    load();
    return (data.active && data.profiles[data.active]) || null;
  }

  /* Mutate the active profile and persist. The callback gets the profile. */
  function update(fn) {
    var p = me();
    if (!p) return null;
    fn(p);
    write();
    return p;
  }

  /* ---------- Profiles --------------------------------------------------- */

  function profiles() {
    load();
    return Object.keys(data.profiles).map(function (id) {
      var p = data.profiles[id];
      return { id: id, name: p.name, avatar: p.avatar, level: levelOf(p).level, gold: p.gold };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function createProfile(name, avatar) {
    load();
    var id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    data.profiles[id] = blankProfile(name, avatar);
    data.active = id;
    write();
    return id;
  }

  function setActive(id) {
    load();
    if (!data.profiles[id]) return false;
    data.active = id;
    write();
    return true;
  }

  function deleteProfile(id) {
    load();
    delete data.profiles[id];
    if (data.active === id) data.active = Object.keys(data.profiles)[0] || null;
    write();
  }

  function renameProfile(id, name, avatar) {
    load();
    var p = data.profiles[id];
    if (!p) return false;
    if (name) p.name = name;
    if (avatar) p.avatar = avatar;
    write();
    return true;
  }

  /* ---------- Levels ------------------------------------------------------
     XP is stored as a lifetime total and the level is derived, so the two can
     never drift apart. */

  function xpForLevel(level) {
    return ECONOMY.baseXpToLevel + (level - 1) * ECONOMY.xpStepPerLevel;
  }

  function levelOf(p) {
    var total = (p && p.xp) || 0;
    var level = 1, spent = 0, need = xpForLevel(1);
    while (total >= spent + need) {
      spent += need;
      level++;
      need = xpForLevel(level);
    }
    return { level: level, into: total - spent, need: need };
  }

  /* ---------- Earning -----------------------------------------------------
     award() returns what actually happened so the caller can animate it:
       { gold, xp, leveledTo }   leveledTo is null unless a level was gained. */

  /* Which game is being played right now. The world's gold multiplier only
     applies where you actually fight in a world, so parking in Ember Peak
     can't inflate Story Quest's payouts. Games set this at run start. */
  var context = null;
  function setContext(game) { context = game; }

  function goldRate() {
    var p = me();
    if (!p) return 1;
    var mult = 1;
    if (context === 'math' || context === 'language') {
      var w = world(p.progress.world);
      if (w) mult = w.gold || 1;
    }
    return mult * (1 + loadout().goldBonus);
  }

  function award(gold, xp) {
    var p = me();
    if (!p) return { gold: 0, xp: 0, leveledTo: null };
    var paid = Math.round(gold * goldRate());
    var before = levelOf(p).level;
    p.gold += paid;
    p.xp += xp;
    var after = levelOf(p).level;
    write();
    return { gold: paid, xp: xp, leveledTo: after > before ? after : null };
  }

  /* Convenience for the events in the ECONOMY table above. */
  function awardEvent(name) {
    var e = ECONOMY[name];
    if (!e) return { gold: 0, xp: 0, leveledTo: null };
    return award(e.gold, e.xp);
  }

  function recordAnswer(correct) {
    update(function (p) {
      if (correct) {
        p.stats.correct++;
        p.stats.streak++;
        if (p.stats.streak > p.stats.bestStreak) p.stats.bestStreak = p.stats.streak;
      } else {
        p.stats.wrong++;
        p.stats.streak = 0;
      }
    });
  }

  /* ---------- Cards ------------------------------------------------------- */

  /* Every card in the game, by id — foes across every world, plus the Story
     Quest characters. Built once; the games look monsters up by id. */
  var CARD_BY_ID = (function () {
    var m = {};
    WORLDS.forEach(function (w) {
      ['math', 'language'].forEach(function (game) {
        w.foes[game].forEach(function (f) {
          m[f.id] = { id: f.id, name: f.name, emoji: f.emoji, r: f.r || 1,
                      from: w.name, world: w.id, game: game };
        });
      });
    });
    STORY_CARDS.forEach(function (c) {
      m[c.id] = { id: c.id, name: c.name, emoji: c.emoji, r: c.r || 2,
                  from: 'Story Quest', world: null, game: 'story' };
    });
    return m;
  })();

  function card(id) { return CARD_BY_ID[id] || null; }

  function held(id, p) {
    p = p || me();
    return (p && p.cards[id]) || 0;
  }

  function foilsOf(id, p) {
    p = p || me();
    return (p && p.foils && p.foils[id]) || 0;
  }

  /* Roll for a monster's card after beating it.

     Returns null for no drop, or { id, how: 'new'|'dupe', foil, pity } so the
     caller can make a moment of it. `pity` marks a drop the counter forced,
     which is worth knowing when tuning.

     A trinket's `cardBonus` multiplies the odds; the pity counter is shared
     across all monsters, so a drought anywhere ends the same way.

     `guaranteed` skips the roll. Story Quest uses it: finishing a twelve-scene
     quest is a long commitment, and paying that with a dice roll that usually
     says no would be miserable. Rarity is for monsters you can re-fight in a
     minute. */
  function awardCard(cardId, guaranteed) {
    var p = me();
    if (!p || !cardId) return null;
    var c = card(cardId);
    var odds = ECONOMY.cardChance *
               (ECONOMY.cardRarityOdds[c ? c.r : 1] || 1) *
               (1 + loadout().cardBonus);

    var pity = (p.progress.koSinceCard || 0) + 1;
    var forced = guaranteed || pity >= ECONOMY.cardPity;
    if (!forced && Math.random() >= odds) {
      p.progress.koSinceCard = pity;
      write();
      return null;
    }

    p.progress.koSinceCard = 0;
    var had = p.cards[cardId] || 0;
    p.cards[cardId] = had + 1;

    var foil = Math.random() < ECONOMY.foilChance;
    if (foil) {
      if (!p.foils) p.foils = {};
      p.foils[cardId] = (p.foils[cardId] || 0) + 1;
    }
    write();
    return { id: cardId, how: had === 0 ? 'new' : 'dupe', foil: foil,
             pity: forced && !guaranteed };
  }

  /* ---------- The Card Trader ---------------------------------------------
     Spares are the point of a rare drop you already own. They sell for gold
     by rarity, and enough of them buy a card you're missing outright — so a
     collection can always be finished by playing, never only by luck. */

  /* How many copies of a card are spare (everything past the first). */
  function spares(id, p) {
    return Math.max(0, held(id, p) - 1);
  }

  /* Trade-in value of one spare, in gold. Foils are worth `foilWorth` times
     as much, and are spent last. */
  function spareValue(id, p) {
    var c = card(id);
    return ECONOMY.cardValue[c ? c.r : 1] || ECONOMY.cardValue[1];
  }

  /* Everything spare, as trader rows. */
  function spareList() {
    var p = me();
    if (!p) return [];
    return Object.keys(p.cards)
      .filter(function (id) { return spares(id, p) > 0 && card(id); })
      .map(function (id) {
        var n = spares(id, p);
        var f = Math.min(foilsOf(id, p), n);   // a foil is only spare if a copy is
        return {
          id: id, card: card(id), spare: n, foil: f,
          gold: (n - f) * spareValue(id) + f * spareValue(id) * ECONOMY.foilWorth
        };
      })
      .sort(function (a, b) { return b.gold - a.gold; });
  }

  /* Sell every spare copy of one card. Returns the gold paid. */
  function sellSpares(id) {
    var p = me();
    if (!p) return 0;
    var n = spares(id, p);
    if (!n) return 0;
    var f = Math.min(foilsOf(id, p), n);
    var paid = (n - f) * spareValue(id) + f * spareValue(id) * ECONOMY.foilWorth;
    p.cards[id] -= n;
    if (f && p.foils) p.foils[id] -= f;
    p.gold += paid;
    write();
    return paid;
  }

  function sellAllSpares() {
    var rows = spareList();
    var total = 0;
    rows.forEach(function (r) { total += sellSpares(r.id); });
    return total;
  }

  /* How many spare cards are held in total — the currency for a wild card.
     A foil counts as `foilWorth`. */
  function spareCount() {
    return spareList().reduce(function (n, r) {
      return n + (r.spare - r.foil) + r.foil * ECONOMY.foilWorth;
    }, 0);
  }

  /* Which cards are still missing, so the trader can offer them. */
  function missingCards() {
    var p = me();
    if (!p) return [];
    return Object.keys(CARD_BY_ID)
      .filter(function (id) { return !p.cards[id]; })
      .map(function (id) { return CARD_BY_ID[id]; });
  }

  /* Trade `wildCardCost` spares for one card you don't have. Returns
     'ok', 'short', 'have', or 'nosuch'. Cheapest spares go first, and foils
     are spent last — nobody wants their shiny eaten by a bulk trade. */
  function tradeForCard(wantId) {
    var p = me();
    if (!p || !card(wantId)) return 'nosuch';
    if (p.cards[wantId]) return 'have';
    if (spareCount() < ECONOMY.wildCardCost) return 'short';

    var need = ECONOMY.wildCardCost;
    var rows = spareList().sort(function (a, b) {
      return spareValue(a.id) - spareValue(b.id);
    });
    rows.forEach(function (r) {
      if (need <= 0) return;
      var plain = r.spare - r.foil;
      var takePlain = Math.min(plain, need);
      p.cards[r.id] -= takePlain;
      need -= takePlain;
      while (need > 0 && (p.foils && p.foils[r.id] > 0) && p.cards[r.id] > 1) {
        p.cards[r.id] -= 1;
        p.foils[r.id] -= 1;
        need -= ECONOMY.foilWorth;
      }
    });

    p.cards[wantId] = 1;
    write();
    return 'ok';
  }

  /* Every card in the game, flattened, with how many the active profile has.
     Drives the hub's collection grid. */
  function allCards() {
    var p = me();
    return Object.keys(CARD_BY_ID).map(function (id) {
      var c = CARD_BY_ID[id];
      return {
        id: c.id, name: c.name, emoji: c.emoji, r: c.r,
        from: c.from, game: c.game,
        count: (p && p.cards[id]) || 0,
        foil: (p && p.foils && p.foils[id]) || 0
      };
    });
  }

  /* ---------- Shop -------------------------------------------------------- */

  function item(id) {
    for (var i = 0; i < SHOP.length; i++) if (SHOP[i].id === id) return SHOP[i];
    return null;
  }

  function owns(id) {
    var p = me();
    return !!p && p.inventory.owned.indexOf(id) !== -1;
  }

  /* Buy an item. Returns 'ok', 'broke', 'owned', 'noset', or 'nosuch'.
     Tokens are consumable, so they can be bought over and over. */
  function buy(id) {
    var p = me();
    var it = item(id);
    if (!p || !it) return 'nosuch';
    if (it.kind !== 'token' && owns(id)) return 'owned';
    // the best of each slot is gated on a finished card set, not just gold
    if (it.set && !hasSet(it.set, p)) return 'noset';
    if (p.gold < it.cost) return 'broke';

    p.gold -= it.cost;
    if (it.kind === 'token') {
      p.inventory.tokens++;
    } else {
      p.inventory.owned.push(id);
      if (it.kind === 'world') {
        p.progress.unlockedWorlds.push(it.world);
      } else {
        p.inventory[it.kind] = id;      // equip weapons/armor/pets on purchase
      }
    }
    write();
    return 'ok';
  }

  var SLOTS = ['weapon', 'armor', 'pet', 'trinket'];

  function equip(id) {
    var it = item(id);
    if (!it || !owns(id)) return false;
    if (SLOTS.indexOf(it.kind) === -1) return false;
    update(function (p) { p.inventory[it.kind] = id; });
    return true;
  }

  function unequipPet() {
    update(function (p) { p.inventory.pet = null; });
  }

  function useToken() {
    var p = me();
    if (!p || p.inventory.tokens <= 0) return false;
    p.inventory.tokens--;
    write();
    return true;
  }

  /* ---------- Loadout ----------------------------------------------------
     What the games actually need to know at the start of a run: the numbers
     the equipped gear adds up to. */

  function loadout() {
    var p = me();
    var base = {
      maxHp: 5, bonusTime: 0, fastBonus: 0, crit: 0, superDamage: 2,
      slash: '💥', pet: null, shield: 0, goldBonus: 0, cardBonus: 0
    };
    if (!p) return base;
    var w = item(p.inventory.weapon);
    var a = item(p.inventory.armor);
    var pet = item(p.inventory.pet);
    var tr = item(p.inventory.trinket);
    if (w) {
      base.crit = w.crit || 0;
      base.superDamage = w.superDamage || 2;
      base.slash = w.slash || '💥';
    }
    if (a) base.maxHp = 5 + (a.bonusHp || 0);
    if (pet) {
      base.pet = pet.emoji;
      base.bonusTime = pet.bonusTime || 0;
      base.shield = pet.shield || 0;
    }
    if (tr) {
      base.goldBonus = tr.goldBonus || 0;
      base.cardBonus = tr.cardBonus || 0;
      base.fastBonus = tr.fastBonus || 0;
      base.bonusTime += tr.bonusTime || 0;
    }
    // completing a world's card set is permanent, and stacks
    setPerks(p, base);
    return base;
  }

  /* What finishing a world's card set is permanently worth. These stack, and
     they're the reason a collection feeds the character instead of just
     filling a grid. */
  var SET_PERKS = {
    meadow: { label: '+1 heart',            maxHp: 1 },
    cave:   { label: '+15% gold',           goldBonus: 0.15 },
    sky:    { label: 'wider DOUBLE window', fastBonus: 1000 },
    reef:   { label: '+1 heart, +15% gold', maxHp: 1, goldBonus: 0.15 },
    ember:  { label: '+2 hearts',           maxHp: 2 }
  };

  function setPerks(p, base) {
    WORLDS.forEach(function (w) {
      if (!hasSet(w.id, p)) return;
      var perk = SET_PERKS[w.id];
      if (!perk) return;
      base.maxHp += perk.maxHp || 0;
      base.goldBonus += perk.goldBonus || 0;
      base.fastBonus += perk.fastBonus || 0;
      base.cardBonus += perk.cardBonus || 0;
    });
  }

  /* Set progress for the hub: how many of each world's cards are held, what
     finishing it is worth, and whether it's done. */
  function setProgress() {
    var p = me();
    return WORLDS.map(function (w) {
      var all = w.foes.math.concat(w.foes.language);
      var got = all.filter(function (f) { return p && p.cards[f.id]; }).length;
      return {
        id: w.id, name: w.name, emoji: w.emoji,
        got: got, total: all.length, done: got === all.length,
        perk: (SET_PERKS[w.id] || {}).label || ''
      };
    });
  }

  /* Does this profile hold every card in a world? That's what gates the top
     tier of each gear slot, and what the Card Trader trades against. */
  function hasSet(worldId, p) {
    p = p || me();
    var w = world(worldId);
    if (!p || !w) return false;
    var all = w.foes.math.concat(w.foes.language);
    for (var i = 0; i < all.length; i++) {
      if (!p.cards[all[i].id]) return false;
    }
    return true;
  }

  /* Which sets are done — the hub shows these, and buy() checks them. */
  function setsHeld() {
    return WORLDS.filter(function (w) { return hasSet(w.id); })
                 .map(function (w) { return w.id; });
  }

  /* The foe lineup for a game, from the profile's currently selected world. */
  function foesFor(game) {
    var p = me();
    var id = (p && p.progress.world) || 'meadow';
    var w = world(id) || WORLDS[0];
    return w.foes[game] || WORLDS[0].foes[game];
  }

  function world(id) {
    for (var i = 0; i < WORLDS.length; i++) if (WORLDS[i].id === id) return WORLDS[i];
    return null;
  }

  function setWorld(id) {
    var p = me();
    if (!p || p.progress.unlockedWorlds.indexOf(id) === -1) return false;
    p.progress.world = id;
    write();
    return true;
  }

  /* ---------- Progress bookkeeping ---------------------------------------- */

  function recordRunWon(game) {
    update(function (p) {
      p.progress.runsWon[game] = (p.progress.runsWon[game] || 0) + 1;
    });
  }

  function recordQuestDone(questIdx) {
    update(function (p) {
      if (p.progress.questsDone.indexOf(questIdx) === -1) {
        p.progress.questsDone.push(questIdx);
      }
    });
  }

  function remember(game, track, mode) {
    update(function (p) {
      if (track) p.settings.lastTrack[game] = track;
      if (mode) p.settings.modeByGame[game] = mode;
    });
  }

  /* ---------- Export / import --------------------------------------------
     localStorage is one "clear browsing data" away from gone, so give the
     parent a file they can keep. */

  function exportFile() {
    load();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'learning-games-progress-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* Read a File (from an <input type="file">) and replace the whole save.
     Calls back with (ok, message). */
  function importFile(file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var d;
      try {
        d = JSON.parse(reader.result);
      } catch (e) {
        return done(false, "That file isn't a progress file.");
      }
      if (!d || !d.profiles || typeof d.profiles !== 'object') {
        return done(false, "That file doesn't have any heroes in it.");
      }
      data = d;
      if (!data.active || !data.profiles[data.active]) {
        data.active = Object.keys(data.profiles)[0] || null;
      }
      var n = Object.keys(data.profiles).length;
      done(write(), n + (n === 1 ? ' hero restored!' : ' heroes restored!'));
    };
    reader.onerror = function () { done(false, "Couldn't read that file."); };
    reader.readAsText(file);
  }

  /* Wipe everything. Only reachable from the hub, behind a confirm. */
  function reset() {
    data = blankSave();
    write();
  }

  return {
    ECONOMY: ECONOMY,
    WORLDS: WORLDS,
    STORY_CARDS: STORY_CARDS,
    SHOP: SHOP,
    AVATARS: AVATARS,

    load: load,
    me: me,
    update: update,

    profiles: profiles,
    createProfile: createProfile,
    setActive: setActive,
    deleteProfile: deleteProfile,
    renameProfile: renameProfile,

    levelOf: levelOf,
    xpForLevel: xpForLevel,
    award: award,
    awardEvent: awardEvent,
    recordAnswer: recordAnswer,

    awardCard: awardCard,
    allCards: allCards,
    card: card,
    held: held,
    foilsOf: foilsOf,
    setProgress: setProgress,
    SET_PERKS: SET_PERKS,

    spares: spares,
    spareList: spareList,
    spareCount: spareCount,
    spareValue: spareValue,
    sellSpares: sellSpares,
    sellAllSpares: sellAllSpares,
    missingCards: missingCards,
    tradeForCard: tradeForCard,

    item: item,
    owns: owns,
    buy: buy,
    hasSet: hasSet,
    setsHeld: setsHeld,
    setContext: setContext,
    goldRate: goldRate,
    equip: equip,
    unequipPet: unequipPet,
    useToken: useToken,
    loadout: loadout,

    world: world,
    setWorld: setWorld,
    foesFor: foesFor,

    recordRunWon: recordRunWon,
    recordQuestDone: recordQuestDone,
    remember: remember,

    exportFile: exportFile,
    importFile: importFile,
    reset: reset,

    /* Test seam: drop the in-memory copy so the next call re-reads (and
       re-migrates) from storage, the way a fresh page load would. */
    _reload: function () { data = null; load(); },
    _key: KEY,
    _version: VERSION,
    _goldScale: V2_GOLD_SCALE
  };
})();
