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

    // A monster's card always drops the first time you beat it; after that it
    // drops this often, and duplicates stack.
    dupCardChance: 0.5,

    baseXpToLevel: 100,   // XP for level 1 -> 2
    xpStepPerLevel: 50    // each level costs this much more than the last
  };

  /* ---------- Worlds and their monsters ----------------------------------
     A world is a foe lineup plus a look. Math RPG fights four monsters per
     run and Language RPG five, so each world lists both. Every foe `id` is
     also its collectible card id, so it must stay unique across the site. */

  var WORLDS = [
    {
      id: 'meadow', name: 'Sunny Meadow', emoji: '🌳', cost: 0,
      sub: 'Where every hero starts',
      foes: {
        math: [
          { id: 'm-slime',  name: 'Slime',   emoji: '🟢', hp: 3, scale: 0.80 },
          { id: 'm-bat',    name: 'Bat',     emoji: '🦇', hp: 4, scale: 1.05 },
          { id: 'm-ghost',  name: 'Ghost',   emoji: '👻', hp: 4, scale: 0.92 },
          { id: 'm-dragon', name: 'Dragon',  emoji: '🐉', hp: 5, scale: 1.16 }
        ],
        language: [
          { id: 'l-slime',  name: 'Slow Slime',     emoji: '🐌', hp: 3, scale: 0.90 },
          { id: 'l-imp',    name: 'Pixel Imp',      emoji: '👾', hp: 3, scale: 0.95 },
          { id: 'l-ghost',  name: 'Giggly Ghost',   emoji: '👻', hp: 4, scale: 0.95 },
          { id: 'l-rex',    name: 'Chompy Rex',     emoji: '🦖', hp: 5, scale: 1.05 },
          { id: 'l-dragon', name: 'The Big Dragon', emoji: '🐉', hp: 6, scale: 1.16 }
        ]
      }
    },
    {
      id: 'cave', name: 'Crystal Cave', emoji: '💎', cost: 150,
      sub: 'Darker, and the monsters are tougher',
      foes: {
        math: [
          { id: 'm-crab',   name: 'Rock Crab',    emoji: '🦀', hp: 4, scale: 0.95 },
          { id: 'm-spider', name: 'Cave Spider',  emoji: '🕷️', hp: 4, scale: 0.90 },
          { id: 'm-golem',  name: 'Gem Golem',    emoji: '🗿', hp: 5, scale: 1.05 },
          { id: 'm-kraken', name: 'Deep Kraken',  emoji: '🦑', hp: 6, scale: 1.10 }
        ],
        language: [
          { id: 'l-bug',    name: 'Grumble Bug',  emoji: '🐛', hp: 4, scale: 0.90 },
          { id: 'l-bat',    name: 'Echo Bat',     emoji: '🦇', hp: 4, scale: 1.00 },
          { id: 'l-troll',  name: 'Mumble Troll', emoji: '🧌', hp: 5, scale: 1.05 },
          { id: 'l-squid',  name: 'Inky Squid',   emoji: '🦑', hp: 5, scale: 1.05 },
          { id: 'l-wyrm',   name: 'Cave Wyrm',    emoji: '🐉', hp: 7, scale: 1.16 }
        ]
      }
    },
    {
      id: 'sky', name: 'Sky Castle', emoji: '🏰', cost: 400,
      sub: 'The toughest monsters of all',
      foes: {
        math: [
          { id: 'm-cloud',  name: 'Storm Cloud',  emoji: '🌩️', hp: 5, scale: 0.95 },
          { id: 'm-bird',   name: 'Sky Screecher',emoji: '🦅', hp: 5, scale: 1.00 },
          { id: 'm-robot',  name: 'Clockwork',    emoji: '🤖', hp: 6, scale: 1.00 },
          { id: 'm-star',   name: 'Star Tyrant',  emoji: '🌟', hp: 7, scale: 1.10 }
        ],
        language: [
          { id: 'l-owl',    name: 'Riddle Owl',   emoji: '🦉', hp: 5, scale: 0.95 },
          { id: 'l-genie',  name: 'Word Genie',   emoji: '🧞', hp: 5, scale: 1.05 },
          { id: 'l-knight', name: 'Iron Knight',  emoji: '🛡️', hp: 6, scale: 0.95 },
          { id: 'l-phoenix',name: 'Phoenix',      emoji: '🔥', hp: 6, scale: 1.05 },
          { id: 'l-titan',  name: 'Sky Titan',    emoji: '👹', hp: 8, scale: 1.16 }
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
     Buffs are deliberately mild. The point is owning something that grows,
     not making the math easy. */

  var SHOP = [
    // Weapons — a chance at extra damage, and they change the slash effect.
    { id: 'stick', kind: 'weapon', name: 'Wooden Stick', emoji: '🪵', cost: 0,
      sub: 'Your trusty starter', slash: '💥' },
    { id: 'sword', kind: 'weapon', name: 'Sharp Sword', emoji: '⚔️', cost: 60,
      sub: 'Sometimes hits extra hard', slash: '⚔️', crit: 0.15 },
    { id: 'axe', kind: 'weapon', name: 'Battle Axe', emoji: '🪓', cost: 140,
      sub: 'Extra hits more often', slash: '🪓', crit: 0.25 },
    { id: 'flame', kind: 'weapon', name: 'Flame Blade', emoji: '🔥', cost: 300,
      sub: 'DOUBLE hits do 3 damage', slash: '🔥', crit: 0.25, superDamage: 3 },

    // Armor — more hearts.
    { id: 'tunic', kind: 'armor', name: 'Cloth Tunic', emoji: '👕', cost: 0,
      sub: '5 hearts', bonusHp: 0 },
    { id: 'vest', kind: 'armor', name: 'Leather Vest', emoji: '🦺', cost: 80,
      sub: '6 hearts', bonusHp: 1 },
    { id: 'plate', kind: 'armor', name: 'Shiny Plate', emoji: '🛡️', cost: 250,
      sub: '7 hearts', bonusHp: 2 },

    // Pets — a companion in the arena with one small passive.
    { id: 'chick', kind: 'pet', name: 'Cheep', emoji: '🐣', cost: 70,
      sub: '+2 seconds to think', bonusTime: 2000 },
    { id: 'cat', kind: 'pet', name: 'Whiskers', emoji: '🐱', cost: 160,
      sub: '+3 seconds to think', bonusTime: 3000 },
    { id: 'drake', kind: 'pet', name: 'Ember', emoji: '🐲', cost: 320,
      sub: 'Blocks one hit each run', shield: 1 },

    // Worlds — new monsters to fight and new cards to collect.
    { id: 'world-cave', kind: 'world', world: 'cave', name: 'Crystal Cave',
      emoji: '💎', cost: 150, sub: 'Four new monsters' },
    { id: 'world-sky', kind: 'world', world: 'sky', name: 'Sky Castle',
      emoji: '🏰', cost: 400, sub: 'The toughest monsters' },

    // The old automatic win reward, now something you choose to spend on.
    { id: 'ipad', kind: 'token', name: 'iPad Time Token', emoji: '🎟️', cost: 150,
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
        tokens: 0
      },
      cards: {},                     // card id -> times caught
      progress: {
        world: 'meadow',
        unlockedWorlds: ['meadow'],
        runsWon: {},                 // game id -> wins
        questsDone: [],              // Story Quest quest indexes
        seqTier: 1,                  // Rule Hunter rung (math), 1-5
        seqCorrect: 0,               // correct answers on the current rung
        skipMastered: false          // unlocks skip-counting by 2s and 3s
      },
      settings: { modeByGame: {}, lastTrack: {} },
      stats: { correct: 0, wrong: 0, streak: 0, bestStreak: 0 }
    };
  }

  function blankSave() {
    return { v: 1, active: null, profiles: {} };
  }

  var data = null;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blankSave();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object' || !d.profiles) return blankSave();
      return d;
    } catch (e) {
      return blankSave();          // corrupt or unreadable: start clean
    }
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
    if (!data) data = read();
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

  function award(gold, xp) {
    var p = me();
    if (!p) return { gold: 0, xp: 0, leveledTo: null };
    var before = levelOf(p).level;
    p.gold += gold;
    p.xp += xp;
    var after = levelOf(p).level;
    write();
    return { gold: gold, xp: xp, leveledTo: after > before ? after : null };
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

  /* Award a monster's card. Always drops the first time; after that it drops
     `dupCardChance` of the time and stacks. Returns 'new', 'dupe', or null. */
  function awardCard(cardId) {
    var p = me();
    if (!p || !cardId) return null;
    var had = p.cards[cardId] || 0;
    if (had === 0) {
      p.cards[cardId] = 1;
      write();
      return 'new';
    }
    if (Math.random() < ECONOMY.dupCardChance) {
      p.cards[cardId] = had + 1;
      write();
      return 'dupe';
    }
    return null;
  }

  /* Every card in the game, flattened, with how many the active profile has.
     Drives the hub's collection grid. */
  function allCards() {
    var p = me();
    var out = [];
    WORLDS.forEach(function (w) {
      ['math', 'language'].forEach(function (game) {
        w.foes[game].forEach(function (f) {
          out.push({
            id: f.id, name: f.name, emoji: f.emoji,
            from: w.name, game: game,
            count: (p && p.cards[f.id]) || 0
          });
        });
      });
    });
    STORY_CARDS.forEach(function (c) {
      out.push({
        id: c.id, name: c.name, emoji: c.emoji,
        from: 'Story Quest', game: 'story',
        count: (p && p.cards[c.id]) || 0
      });
    });
    return out;
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

  /* Buy an item. Returns 'ok', 'broke', 'owned', or 'nosuch'. Tokens are
     consumable, so they can be bought over and over. */
  function buy(id) {
    var p = me();
    var it = item(id);
    if (!p || !it) return 'nosuch';
    if (it.kind !== 'token' && owns(id)) return 'owned';
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

  function equip(id) {
    var it = item(id);
    if (!it || !owns(id)) return false;
    if (it.kind !== 'weapon' && it.kind !== 'armor' && it.kind !== 'pet') return false;
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
    var base = { maxHp: 5, bonusTime: 0, crit: 0, superDamage: 2, slash: '💥', pet: null, shield: 0 };
    if (!p) return base;
    var w = item(p.inventory.weapon);
    var a = item(p.inventory.armor);
    var pet = item(p.inventory.pet);
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
    return base;
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

    item: item,
    owns: owns,
    buy: buy,
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

    _key: KEY
  };
})();
