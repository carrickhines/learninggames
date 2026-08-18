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

    /* ---- Map chests ----
       Every map stop pays a chest when the hero arrives back. It's the reason
       to walk the map rather than replay from a menu, and a boss chest is the
       most reliable way to finish a card set. */
    chestGold: 60,
    bossGold: 250,
    chestCardChance: 0.35,    // an ordinary chest; a boss chest always holds one

    /* ---- Wild allies ----
       A beaten monster sometimes decides it likes you and fights at your side
       for the rest of the run. It's more likely if you already hold its card —
       collecting a monster is befriending it, which quietly makes the
       collection worth something in the moment as well as in the shop.

       Allies last the run and no longer. Nothing permanent means no power
       creep, and every run gets its own shape. */
    /* Monsters a pet must see fall before it grows into its next form, and
       what that form adds. Not gold — a pet is raised, not bought twice, and
       it's the one reward in the game that comes only from turning up. At the
       pace the kids play this is a few days to the second form and a couple of
       weeks to the last. */
    /* The daily challenge pays double, and is the only reason to come back
       today rather than tomorrow. The streak is a flame and a number, nothing
       more: it grants nothing, so a missed day can take nothing away. */
    dailyGold: 2,
    /* How far past their furthest stop today's challenge may be drawn from.
       Early on this keeps it gentle; it widens as they get further. */
    dailyReach: 3,

    petGrowth: [0, 60, 200],
    /* Growth scales the pet you have rather than adding a flat bonus, so
       raising a 200-gold chick can't quietly out-perform an 8,000-gold
       griffin — the shop's ladder still decides which pet is better, and
       growth decides how much of it you've earned. For the same reason a pet
       with no shield never grows one; the last form only deepens a shield the
       pet already had. */
    petStageTimeScale: 0.25,  // each form adds 25% of the pet's own thinking time
    petStageShield: [0, 0, 1],// the last form blocks one more hit — if it blocked any

    /* A boss fork's weak road lands this much extra damage a hit. Enough to
       be worth taking, not enough to make the other road unplayable. */
    weaknessDamage: 1,

    allyJoinChance: 0.18,
    allyKnownBonus: 0.22,     // added when its card is already in the book
    allyStrikeChance: 0.25,   // each ally, on each of your hits
    maxAllies: 3,

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

    /* ---- Pets: a companion in the arena, plus one small passive ----
       A pet is the one thing you own that isn't finished when you buy it: it
       grows. `stages` are [emoji, name] from the newly-bought form onwards,
       so stage 0 must match `emoji`. Growth is the same for every pet
       (PET_GROWTH), so the shop's ladder still decides which is better —
       raising a chick can't overtake a phoenix. */
    { id: 'chick', kind: 'pet', name: 'Cheep', emoji: '🐣', cost: 200,
      sub: '+2 seconds to think', bonusTime: 2000,
      stages: [['🐣', 'Cheep'], ['🐤', 'Fluff'], ['🐓', 'Big Red']] },
    { id: 'cat', kind: 'pet', name: 'Whiskers', emoji: '🐱', cost: 950,
      sub: '+3 seconds to think', bonusTime: 3000,
      stages: [['🐱', 'Whiskers'], ['🐈', 'Prowl'], ['🐅', 'Fang']] },
    { id: 'drake', kind: 'pet', name: 'Ember', emoji: '🐲', cost: 3000,
      sub: 'Blocks one hit each run', shield: 1, bonusTime: 1000,
      stages: [['🐲', 'Ember'], ['🐉', 'Emberwing'], ['🦖', 'Emberlord']] },
    { id: 'griffin', kind: 'pet', name: 'Skyclaw', emoji: '🦅', cost: 8000,
      sub: 'Blocks a hit, +3 seconds', shield: 1, bonusTime: 3000,
      stages: [['🦅', 'Skyclaw'], ['🦉', 'Stormclaw'], ['🦚', 'Skylord']] },
    { id: 'phoenix', kind: 'pet', name: 'Blaze', emoji: '🔥', cost: 22000,
      set: 'reef', sub: 'Blocks two hits, +4 seconds', shield: 2, bonusTime: 4000,
      stages: [['🔥', 'Blaze'], ['☄️', 'Solar'], ['🌟', 'Everflame']] },

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

  /* ---------- The map -----------------------------------------------------
     A journey across a landscape, not a menu. The hero walks a path that
     climbs through five regions; each stop is a real challenge, and beating
     one moves the hero on to the next.

     Two trails, not one. The five-year-old and the eight-year-old play
     genuinely different content, so a single path would strand the younger
     one at the first Algebra stop. Each has its own progress per profile.

     A step is either one stop or a CHOICE of two. A choice always rejoins
     afterwards, so no route is a dead end and nothing is missable — the
     branch is there to make the journey yours, not to punish a wrong turn.
     Beating either option advances the step.

         ●───●───┬─●─┬───●───◆        ◆ boss
                 └─●─┘

     `boss` fights one named tougher monster instead of the usual lineup and
     always drops loot. `needs` requires a world to have been bought, which is
     how the map and the shop pull on each other. `loot` sets the size of the
     chest the stop pays.

     Every boss is a fork, and one road is marked `weak`: the track the boss
     can't stand. Take it and your hits land extra damage; take the other and
     the fight is honest but longer. Both roads beat the same boss for the same
     chest, so the choice is "fight it on its terms or on mine", never a wrong
     turn — and the weak road is usually the harder subject, which is the
     point. Bosses are announced, not hidden: a secret weakness a child can't
     deduce is just a dice roll.

     Positions are computed by the hub, not stored — the path winds itself, so
     inserting a stop is a one-line change here with nothing to re-place. */

  var MAP = {
    little: [
      { g: 'math',     t: 'next',      m: 'easy',   label: 'Count to 30' },
      { g: 'story',    mini: 'order',               label: 'Put it in order' },
      [ { g: 'math',     t: 'oneless', m: 'easy',   label: 'One more, one less',
          route: 'The meadow path' },
        { g: 'language', t: 'letters', m: 'easy',   label: 'Find the letter',
          route: 'The forest path' } ],
      { g: 'math',     t: 'count',     m: 'easy',   label: 'Count on' },
      { g: 'language', t: 'sounds',    m: 'easy',   label: 'Beginning sounds' },
      [ { g: 'math', t: 'add', m: 'easy', label: 'Adding blocks', route: 'The bramble gate', weak: true,
          boss: true,
          foe: { id: 'b-meadow', name: 'Bramble King', emoji: '🌳', hp: 8, scale: 1.2 },
          loot: 'boss' },
        { g: 'language', t: 'sight', m: 'easy', label: 'Sight words', route: 'The mossy gate',
          boss: true,
          foe: { id: 'b-meadow', name: 'Bramble King', emoji: '🌳', hp: 8, scale: 1.2 },
          loot: 'boss' } ],

      { g: 'language', t: 'sight',     m: 'easy',   label: 'Sight words' },
      [ { g: 'math',     t: 'pattern', m: 'easy',   label: 'Patterns',
          route: 'The painted caves' },
        { g: 'language', t: 'builder', m: 'easy',   label: 'Build a word',
          route: 'The whispering caves' } ],
      { g: 'math',     t: 'sub',       m: 'easy',   label: 'Taking away' },
      { g: 'language', t: 'rhyme',     m: 'easy',   label: 'Rhyme time' },
      [ { g: 'math', t: 'skip', m: 'easy', label: 'Skip counting', route: 'The crystal stair', weak: true,
          boss: true,
          foe: { id: 'b-cave', name: 'Crystal Ogre', emoji: '💠', hp: 9, scale: 1.2 },
          loot: 'boss' },
        { g: 'language', t: 'rhyme', m: 'easy', label: 'Rhyme time', route: 'The echo stair',
          boss: true,
          foe: { id: 'b-cave', name: 'Crystal Ogre', emoji: '💠', hp: 9, scale: 1.2 },
          loot: 'boss' } ],

      { g: 'language', t: 'opposites', m: 'easy',   label: 'Opposites' },
      [ { g: 'math',     t: 'sort',    m: 'easy',   label: "What doesn't belong",
          route: 'The cloud stair' },
        { g: 'story',    mini: 'finish',            label: 'What happens next?',
          route: 'The storybook stair' } ],
      { g: 'language', t: 'read',      m: 'easy',   label: 'Read it yourself' },
      [ { g: 'math', t: 'add', m: 'normal', label: 'Adding, faster', route: 'The updraft', weak: true,
          boss: true,
          foe: { id: 'b-sky', name: 'Thunder Roc', emoji: '🦅', hp: 10, scale: 1.2 },
          loot: 'boss' },
        { g: 'language', t: 'builder', m: 'normal', label: 'Build a word, faster', route: 'The long glide',
          boss: true,
          foe: { id: 'b-sky', name: 'Thunder Roc', emoji: '🦅', hp: 10, scale: 1.2 },
          loot: 'boss' } ],

      { g: 'language', t: 'past',      m: 'easy',   label: 'Time machine' },
      [ { g: 'math',     t: 'count',   m: 'normal', label: 'Counting on, faster',
          route: 'The shallow reef' },
        { g: 'story',    mini: 'order',             label: 'Order it again',
          route: 'The deep reef' } ],
      { g: 'math',     t: 'sub',       m: 'normal', label: 'Taking away, faster' },
      [ { g: 'math', t: 'skip', m: 'normal', label: 'Skip counting, faster', route: 'The tide pool', weak: true,
          boss: true,
          foe: { id: 'b-reef', name: 'Old Barnacle', emoji: '🐚', hp: 11, scale: 1.2 },
          loot: 'boss' },
        { g: 'language', t: 'sounds', m: 'normal', label: 'Sounds, faster', route: 'The kelp maze',
          boss: true,
          foe: { id: 'b-reef', name: 'Old Barnacle', emoji: '🐚', hp: 11, scale: 1.2 },
          loot: 'boss' } ],

      { g: 'language', t: 'sounds',    m: 'normal', label: 'Sounds, faster' },
      [ { g: 'math',     t: 'next',    m: 'normal', label: 'Counting, faster',
          route: 'The ash road' },
        { g: 'language', t: 'sight',   m: 'normal', label: 'Sight words, faster',
          route: 'The lava road' } ],
      [ { g: 'math', t: 'add', m: 'normal', label: 'The last climb', route: 'The ember stair', weak: true,
          boss: true,
          needs: 'cave',
          foe: { id: 'b-ember', name: 'Emberling', emoji: '🔥', hp: 12, scale: 1.25 },
          loot: 'boss' },
        { g: 'language', t: 'read', m: 'normal', label: 'Read it yourself, faster', route: 'The smoke stair',
          boss: true,
          needs: 'cave',
          foe: { id: 'b-ember', name: 'Emberling', emoji: '🔥', hp: 12, scale: 1.25 },
          loot: 'boss' } ],

      /* ---- Market Town ---- */
      { g: 'math',     t: 'bonds',     m: 'easy',   label: 'Make 10' },
      { g: 'language', t: 'blend',     m: 'easy',   label: 'Sound it out' },
      [ { g: 'math',     t: 'coins',   m: 'easy',   label: 'Counting coins',
          route: 'The market lane' },
        { g: 'language', t: 'sight',   m: 'normal', label: 'Sight words, faster',
          route: 'The signpost lane' } ],
      { g: 'math',     t: 'clock',     m: 'easy',   label: 'What time is it?' },
      [ { g: 'math', t: 'bonds', m: 'normal', label: 'Make 10, faster', route: 'The counting stall', weak: true,
          boss: true,
          foe: { id: 'b-market', name: 'The Coin Golem', emoji: '🪙', hp: 12, scale: 1.25 },
          loot: 'boss' },
        { g: 'language', t: 'blend', m: 'normal', label: 'Blending, faster', route: 'The reading stall',
          boss: true,
          foe: { id: 'b-market', name: 'The Coin Golem', emoji: '🪙', hp: 12, scale: 1.25 },
          loot: 'boss' } ],

      { g: 'math',     t: 'coins',     m: 'normal', label: 'Coins, faster' },
      [ { g: 'math',     t: 'clock',   m: 'normal', label: 'Clock, faster',
          route: 'The clock tower' },
        { g: 'language', t: 'opposites', m: 'normal', label: 'Opposites, faster',
          route: 'The mirror hall' } ],
      { g: 'story',    mini: 'finish',              label: 'What happens next?' },
      { g: 'language', t: 'past',      m: 'normal', label: 'Time machine, faster' },
      [ { g: 'math', t: 'clock', m: 'normal', label: 'Telling the time', route: 'The star dial', weak: true,
          boss: true,
          needs: 'sky',
          foe: { id: 'b-observatory', name: 'The Hourglass Owl', emoji: '🦉', hp: 13, scale: 1.3 },
          loot: 'boss' },
        { g: 'language', t: 'read', m: 'normal', label: 'Read it yourself, faster', route: 'The long balcony',
          boss: true,
          needs: 'sky',
          foe: { id: 'b-observatory', name: 'The Hourglass Owl', emoji: '🦉', hp: 13, scale: 1.3 },
          loot: 'boss' } ]
    ],

    big: [
      { g: 'math',     t: 'mul',       m: 'normal', label: 'Times tables' },
      { g: 'story',    quest: 0,                    label: 'The Troll Bridge' },
      [ { g: 'math',     t: 'div',     m: 'normal', label: 'Division',
          route: 'The number road' },
        { g: 'language', t: 'fixit',   m: 'normal', label: 'Fix the mistake',
          route: 'The word road' } ],
      { g: 'math',     t: 'rule',      m: 'normal', label: 'Find the rule' },
      { g: 'language', t: 'forge',     m: 'normal', label: 'Word forge' },
      [ { g: 'math', t: 'mul', m: 'expert', label: 'Times tables, fast', route: 'The thorn gate', weak: true,
          boss: true,
          foe: { id: 'b-meadow2', name: 'Thorn Warden', emoji: '🌿', hp: 9, scale: 1.2 },
          loot: 'boss' },
        { g: 'language', t: 'fixit', m: 'normal', label: 'Fix the mistake', route: 'The briar gate',
          boss: true,
          foe: { id: 'b-meadow2', name: 'Thorn Warden', emoji: '🌿', hp: 9, scale: 1.2 },
          loot: 'boss' } ],

      { g: 'story',    quest: 1,                    label: "The Dragon's Library" },
      [ { g: 'language', t: 'grammar', m: 'normal', label: 'Grammar hunt',
          route: 'The tunnel of names' },
        { g: 'math',     t: 'alg',     m: 'normal', label: 'Solve for x',
          route: 'The tunnel of x' } ],
      { g: 'language', t: 'syllable',  m: 'normal', label: 'Syllable smith' },
      { g: 'story',    quest: 2,                    label: 'The Ghost Ship' },
      [ { g: 'math', t: 'div', m: 'expert', label: 'Division, fast', route: 'The geode vault', weak: true,
          boss: true,
          needs: 'cave',
          foe: { id: 'b-cave2', name: 'Geode Colossus', emoji: '🗿', hp: 10, scale: 1.25 },
          loot: 'boss' },
        { g: 'language', t: 'grammar', m: 'normal', label: 'Grammar hunt', route: 'The fossil vault',
          boss: true,
          needs: 'cave',
          foe: { id: 'b-cave2', name: 'Geode Colossus', emoji: '🗿', hp: 10, scale: 1.25 },
          loot: 'boss' } ],

      { g: 'language', t: 'twins',     m: 'normal', label: 'Word twins' },
      [ { g: 'story',    quest: 3,                  label: "The Wizard's Maze",
          route: 'The maze route' },
        { g: 'language', t: 'marks',   m: 'normal', label: 'Mark it',
          route: 'The scholar route' } ],
      { g: 'math',     t: 'rule',      m: 'normal', label: 'Rules, harder' },
      [ { g: 'math', t: 'alg', m: 'expert', label: 'Algebra, fast', route: 'The eye of the storm', weak: true,
          boss: true,
          needs: 'sky',
          foe: { id: 'b-sky2', name: 'Storm Sovereign', emoji: '⚡', hp: 11, scale: 1.25 },
          loot: 'boss' },
        { g: 'language', t: 'twins', m: 'normal', label: 'Word twins', route: 'The long updraft',
          boss: true,
          needs: 'sky',
          foe: { id: 'b-sky2', name: 'Storm Sovereign', emoji: '⚡', hp: 11, scale: 1.25 },
          loot: 'boss' } ],

      { g: 'story',    quest: 4,                    label: 'The Robot Bakery' },
      [ { g: 'language', t: 'fixit',   m: 'expert', label: 'Proofread, fast',
          route: 'The current' },
        { g: 'story',    quest: 5,                  label: "The Yeti's Birthday",
          route: 'The trench' } ],
      { g: 'language', t: 'forge',     m: 'expert', label: 'Forge, fast' },
      [ { g: 'math', t: 'rule', m: 'expert', label: 'Rules, fast', route: 'The trench mouth', weak: true,
          boss: true,
          needs: 'reef',
          foe: { id: 'b-reef2', name: 'Abyss Warden', emoji: '🦑', hp: 12, scale: 1.25 },
          loot: 'boss' },
        { g: 'language', t: 'syllable', m: 'normal', label: 'Syllable smith', route: 'The slow drift',
          boss: true,
          needs: 'reef',
          foe: { id: 'b-reef2', name: 'Abyss Warden', emoji: '🦑', hp: 12, scale: 1.25 },
          loot: 'boss' } ],

      { g: 'story',    quest: 6,                    label: 'The Moon Rescue' },
      [ { g: 'language', t: 'syllable', m: 'expert', label: 'Syllables, fast',
          route: 'The obsidian way' },
        { g: 'language', t: 'twins',   m: 'expert', label: 'Twins, fast',
          route: 'The cinder way' } ],
      [ { g: 'math', t: 'alg', m: 'expert', label: 'The summit', route: 'The summit path', weak: true,
          boss: true,
          needs: 'ember',
          foe: { id: 'b-ember2', name: 'The Ember King', emoji: '👑', hp: 14, scale: 1.3 },
          loot: 'boss' },
        { g: 'language', t: 'forge', m: 'expert', label: 'Forge, fast', route: 'The long ridge',
          boss: true,
          needs: 'ember',
          foe: { id: 'b-ember2', name: 'The Ember King', emoji: '👑', hp: 14, scale: 1.3 },
          loot: 'boss' } ],

      /* ---- Market Town ---- */
      { g: 'math',     t: 'fract',     m: 'normal', label: 'Halves and quarters' },
      { g: 'story',    quest: 7,                    label: 'The Grumbly Volcano' },
      [ { g: 'math',     t: 'wordprob', m: 'normal', label: 'Word problems',
          route: 'The story road' },
        { g: 'math',     t: 'place',   m: 'normal', label: 'Carrying and borrowing',
          route: 'The counting house' } ],
      { g: 'math',     t: 'applied',   m: 'normal', label: 'Making change' },
      [ { g: 'math', t: 'applied', m: 'normal', label: 'Money and measuring', route: 'The weighbridge', weak: true,
          boss: true,
          foe: { id: 'b-market2', name: 'The Ledger Wraith', emoji: '📜', hp: 13, scale: 1.25 },
          loot: 'boss' },
        { g: 'language', t: 'forge', m: 'normal', label: 'Word forge', route: 'The sign shop',
          boss: true,
          foe: { id: 'b-market2', name: 'The Ledger Wraith', emoji: '📜', hp: 13, scale: 1.25 },
          loot: 'boss' } ],

      { g: 'math',     t: 'fract',     m: 'expert', label: 'Fractions, fast' },
      [ { g: 'math',     t: 'place',   m: 'expert', label: 'Big numbers, fast',
          route: 'The high shelf' },
        { g: 'language', t: 'grammar', m: 'expert', label: 'Grammar, fast',
          route: 'The long sentence' } ],
      { g: 'math',     t: 'wordprob',  m: 'expert', label: 'Word problems, fast' },
      { g: 'math',     t: 'applied',   m: 'expert', label: 'Everyday maths, fast' },
      [ { g: 'math', t: 'fract', m: 'expert', label: 'The last fraction', route: 'The great lens', weak: true,
          boss: true,
          needs: 'ember',
          foe: { id: 'b-observatory2', name: 'The Astral Reckoner', emoji: '🔭', hp: 15, scale: 1.35 },
          loot: 'boss' },
        { g: 'math', t: 'place', m: 'expert', label: 'The last carry', route: 'The star ledger',
          boss: true,
          needs: 'ember',
          foe: { id: 'b-observatory2', name: 'The Astral Reckoner', emoji: '🔭', hp: 15, scale: 1.35 },
          loot: 'boss' } ]
    ]
  };

  /* The landscape the trail climbs through. Each region covers a run of steps
     and gives the hub its colours and scenery. */
  var REGIONS = [
    { id: 'meadow', name: 'Sunny Meadow', emoji: '🌳', steps: 6,
      sky: ['#7b4a86', '#c98a6a'], hills: ['#2f7a4d', '#256b41', '#1c5735'],
      props: ['🌳', '🌲', '🌼', '🪨', '🦋', '🐝'] },
    { id: 'cave',   name: 'Crystal Cave', emoji: '💎', steps: 5,
      sky: ['#241a4d', '#3c2a72'], hills: ['#4a3a80', '#3b2e68', '#2c2350'],
      props: ['💎', '🪨', '🕸️', '🦇', '💠', '🔮'] },
    { id: 'sky',    name: 'Sky Castle',   emoji: '🏰', steps: 4,
      sky: ['#3a63b8', '#8fc4f0'], hills: ['#cfe4ff', '#b3d3f7', '#94bdec'],
      props: ['☁️', '🕊️', '⭐', '🏰', '🌙', '🎈'] },
    { id: 'reef',   name: 'Sunken Reef',  emoji: '🌊', steps: 4,
      sky: ['#0b3a5e', '#1b8fae'], hills: ['#1f8f9c', '#17727f', '#115a66'],
      props: ['🐠', '🪸', '🐚', '🫧', '🦀', '🐟'] },
    { id: 'ember',  name: 'Ember Peak',   emoji: '🌋', steps: 4,
      sky: ['#4a1020', '#c04a1c'], hills: ['#7a2a18', '#5f2013', '#45170e'],
      props: ['🌋', '🔥', '🪨', '💀', '🗻', '🌑'] },

    /* Beyond the peak: the ground the everyday maths and the newer reading
       tracks live on. `cards` points a region at the world its chests draw
       from — these two have their own look but no monsters of their own, so
       without it a boss chest would promise a card and hand over nothing.
       (New worlds to go with them are the obvious next thing; the tracks
       needed a home on the map first.) */
    { id: 'market', name: 'Market Town',  emoji: '🏪', steps: 5, cards: 'reef',
      sky: ['#2a2350', '#e0a24a'], hills: ['#8a5a3c', '#6f472f', '#553626'],
      props: ['🏪', '🪙', '⚖️', '🧺', '🕰️', '🪧'] },
    { id: 'observatory', name: 'The Observatory', emoji: '🔭', steps: 5, cards: 'ember',
      sky: ['#08122e', '#2b3f7a'], hills: ['#1b2a54', '#152244', '#101a33'],
      props: ['🔭', '⭐', '🪐', '🌠', '🌙', '☄️'] }
  ];

  /* Which region a step belongs to. */
  function regionOf(stepIndex) {
    var n = 0;
    for (var i = 0; i < REGIONS.length; i++) {
      n += REGIONS[i].steps;
      if (stepIndex < n) return REGIONS[i];
    }
    return REGIONS[REGIONS.length - 1];
  }

  var MAP_EMOJI = { math: '🔢', language: '🔤', story: '📖' };

  /* The trail, normalized: every step becomes { i, options: [...] }, so a
     plain stop and a choice are handled the same way everywhere. */
  function mapTrail(trail) {
    return (MAP[trail] || []).map(function (step, i) {
      var region = regionOf(i);
      var opts = (step instanceof Array ? step : [step]).map(function (n, o) {
        var out = {};
        for (var k in n) out[k] = n[k];
        out.i = i;
        out.o = o;
        out.trail = trail;
        // every option carries its region: the chest's card pool is drawn
        // from it, and completeNode() looks options up directly
        out.region = region;
        out.last = i === (MAP[trail] || []).length - 1;
        out.emoji = n.boss ? (n.foe && n.foe.emoji) || '⚔️' : (MAP_EMOJI[n.g] || '⭐');
        return out;
      });
      return { i: i, options: opts, choice: opts.length > 1,
               boss: !!opts[0].boss, region: region };
    });
  }

  function mapLength(trail) { return (MAP[trail] || []).length; }

  /* How far along a trail this hero is: the index of the next step to play. */
  function mapAt(trail) {
    var p = me();
    var at = p && p.progress.map && p.progress.map[trail];
    // coerce: a corrupted save shouldn't be able to crash the whole map
    at = Math.floor(Number(at));
    if (!isFinite(at) || at < 0) at = 0;
    return Math.min(at, mapLength(trail));
  }

  /* Which option was taken at a step already beaten, for drawing the route. */
  function mapPick(trail, i) {
    var p = me();
    var picks = p && p.progress.mapPicks && p.progress.mapPicks[trail];
    return (picks && picks[i] != null) ? picks[i] : null;
  }

  /* Where the hero was last drawn, so the map can walk them to where they are
     now. Returns the step index, and clears itself once used. */
  function mapWalkFrom(trail) {
    var p = me();
    var w = p && p.progress.mapWalk;
    if (!w || w.trail !== trail) return null;
    p.progress.mapWalk = null;
    write();
    return w.from;
  }

  function nodeState(trail, i, o) {
    var at = mapAt(trail);
    if (i < at) {
      // a beaten step: the route taken reads as done, the one not taken faded
      var pick = mapPick(trail, i);
      return (pick == null || pick === (o || 0)) ? 'done' : 'untaken';
    }
    if (i > at) return 'locked';
    var opts = mapTrail(trail)[i].options;
    var node = opts[o || 0];
    if (node && node.needs) {
      var p = me();
      if (!p || p.progress.unlockedWorlds.indexOf(node.needs) === -1) return 'needs';
    }
    return 'next';
  }

  /* Begin a stop: the game reads this on load and locks itself to it. */
  function startNode(trail, i, o) {
    var p = me();
    o = o || 0;
    if (!p || nodeState(trail, i, o) !== 'next') return false;
    p.progress.activeNode = { trail: trail, i: i, o: o };
    write();
    return true;
  }

  /* The stop being played, with its spec — or null for free play. */
  function activeNode() {
    var p = me();
    var a = p && p.progress.activeNode;
    if (!a || !MAP[a.trail] || !MAP[a.trail][a.i]) return null;
    var step = mapTrail(a.trail)[a.i];
    return step.options[a.o || 0] || null;
  }

  function clearNode() {
    var p = me();
    if (!p || !p.progress.activeNode) return;
    p.progress.activeNode = null;
    write();
  }

  /* Won the stop that was being played. Advances the trail once — replaying a
     beaten stop is fine, it just doesn't move you twice — records which route
     was taken, remembers where to walk the hero from, and rolls the loot. */
  function completeNode() {
    var p = me();
    var a = p && p.progress.activeNode;
    if (!a) return null;
    if (!p.progress.map) p.progress.map = { little: 0, big: 0 };
    if (!p.progress.mapPicks) p.progress.mapPicks = { little: {}, big: {} };

    var node = mapTrail(a.trail)[a.i].options[a.o || 0];
    var advanced = false;
    if (a.i === (p.progress.map[a.trail] || 0)) {
      p.progress.mapPicks[a.trail][a.i] = a.o || 0;
      p.progress.map[a.trail] = a.i + 1;
      p.progress.mapWalk = { trail: a.trail, from: a.i };
      advanced = true;
    }
    p.progress.activeNode = null;
    write();

    var loot = advanced ? rollLoot(node) : null;
    return { trail: a.trail, i: a.i, advanced: advanced, loot: loot,
             done: (p.progress.map[a.trail] >= MAP[a.trail].length) };
  }

  /* ---------- Loot ---------------------------------------------------------
     Every stop pays a chest, revealed on the map when the hero arrives — the
     reason to walk back and look. A boss chest is bigger and always holds a
     card, which is also the most reliable way to finish a set. */

  function rollLoot(node) {
    var boss = !!(node && node.boss);
    var chest = { boss: boss, gold: 0, card: null, token: false };

    chest.gold = boss ? ECONOMY.bossGold : ECONOMY.chestGold;
    chest.gold = Math.round(chest.gold * goldRate());

    var p = me();
    if (p) { p.gold += chest.gold; write(); }

    // a boss always leaves a card; an ordinary chest sometimes does
    // a region can draw its chests from another world's monsters (see REGIONS)
    var pool = node && node.region
      ? cardsOfWorld(node.region.cards || node.region.id) : [];
    if (pool.length && (boss || Math.random() < ECONOMY.chestCardChance)) {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      var got = awardCard(pick.id, true);
      if (got) chest.card = { id: pick.id, how: got.how, foil: got.foil };
    }

    // the very last stop of a trail hands over an iPad token
    if (node && node.last) {
      if (p) { p.inventory.tokens++; write(); }
      chest.token = true;
    }
    return chest;
  }

  /* Every card that can drop in a world, for the chests. */
  function cardsOfWorld(worldId) {
    var w = world(worldId);
    if (!w) return [];
    return w.foes.math.concat(w.foes.language);
  }

  var AVATARS = ['🦸', '🦹', '🧙', '🧝', '🦊', '🐯', '🐸', '🦖', '🐙', '🦄', '🐧', '🤖'];

  /* ---------- Storage ---------------------------------------------------- */

  /* Which of the two kids a hero belongs to. This is the one thing the site
     cannot work out for itself: the two boys play genuinely different content,
     and guessing from how far along each trail they happen to be gets a brand
     new hero wrong every time — both trails sit at 0, so the guess says
     "little", and the nine-year-old is handed counting to 30 as his challenge
     of the day. So a hero says which they are, and everything that has to pick
     for them reads it. */
  var ROWS = [
    { id: 'little', label: 'Little hero', emoji: '🐣',
      sub: 'Counting, adding, letters and sounds' },
    { id: 'big', label: 'Big hero', emoji: '🦸',
      sub: 'Times tables, fractions, spelling and grammar' }
  ];

  function blankProfile(name, avatar, row) {
    return {
      name: name || 'Hero',
      avatar: avatar || '🦸',
      row: row === 'big' ? 'big' : 'little',
      created: Date.now(),
      xp: 0,
      gold: 0,
      inventory: {
        owned: ['stick', 'tunic'],
        weapon: 'stick',
        armor: 'tunic',
        pet: null,
        // monsters each pet has seen fall, keyed by pet id: a pet you put
        // away keeps what it grew, so swapping isn't punished
        petXp: {},
        trinket: null,
        tokens: 0
      },
      cards: {},                     // card id -> copies held (foils included)
      foils: {},                     // card id -> how many of those are shiny
      progress: {
        map: { little: 0, big: 0 },      // how far along each map trail
        mapPicks: { little: {}, big: {} },// which route was taken at each fork
        mapWalk: null,                   // where to walk the hero from, once
        activeNode: null,                // the map stop being played, if any
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

  var VERSION = 4;
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
        if (!p.progress.map) p.progress.map = { little: 0, big: 0 };
        if (!p.progress.mapPicks) p.progress.mapPicks = { little: {}, big: {} };
        if (p.progress.mapWalk === undefined) p.progress.mapWalk = null;
        if (p.progress.activeNode === undefined) p.progress.activeNode = null;
      });
    }

    if (v < 3) {
      // v3 added pet growth. An existing pet starts from scratch rather than
      // being credited for monsters it fought before it could grow — there's
      // no record of those, and starting a pet at zero is the honest reading.
      Object.keys(d.profiles).forEach(function (id) {
        var p = d.profiles[id];
        if (!p.inventory) p.inventory = {};
        if (!p.inventory.petXp) p.inventory.petXp = {};
        if (!p.progress) p.progress = {};
        if (p.progress.dailyDone === undefined) p.progress.dailyDone = null;
        if (!p.progress.streak) p.progress.streak = { days: 0, last: null };
      });
    }

    if (v < 4) {
      // v4 gave a hero a row of their own. Existing heroes are read off the
      // road behind them rather than being asked, so nobody is stopped on the
      // way to a game — and Settings shows it, so a wrong guess is one tap to
      // fix rather than a mystery.
      Object.keys(d.profiles).forEach(function (id) {
        var p = d.profiles[id];
        if (p.row !== 'little' && p.row !== 'big') p.row = guessRow(p);
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

  /* The active hero's id. Profiles are keyed by it rather than carrying it, so
     anything needing a per-hero seed has to ask for it. */
  function activeId() {
    load();
    return data.active || null;
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
      return { id: id, name: p.name, avatar: p.avatar, row: rowOf(p),
               level: levelOf(p).level, gold: p.gold };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function createProfile(name, avatar, row) {
    load();
    var id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    data.profiles[id] = blankProfile(name, avatar, row);
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

  function renameProfile(id, name, avatar, row) {
    load();
    var p = data.profiles[id];
    if (!p) return false;
    if (name) p.name = name;
    if (avatar) p.avatar = avatar;
    if (row === 'little' || row === 'big') p.row = row;
    write();
    return true;
  }

  /* Change which kid the active hero is. Nothing they own or have walked is
     touched — the two trails have always had separate progress, so switching
     back and forth costs nothing. */
  function setRow(row) {
    if (row !== 'little' && row !== 'big') return false;
    update(function (p) { p.row = row; });
    return true;
  }

  function rowOf(p) {
    p = p || me();
    return (p && (p.row === 'big' ? 'big' : p.row === 'little' ? 'little' : null));
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

  /* Set while a run is playing today's challenge: everything it pays doubles. */
  var dailyRun = false;
  function setDailyRun(on) { dailyRun = !!on; }

  function goldRate() {
    var p = me();
    if (!p) return 1;
    var mult = 1;
    if (context === 'math' || context === 'language') {
      var w = world(p.progress.world);
      if (w) mult = w.gold || 1;
    }
    if (dailyRun) mult *= ECONOMY.dailyGold;
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

  /* Does the monster you just beat join you? Returns the ally or null.
     Knowing it — holding its card — makes it likelier. */
  function rollAlly(foe, current) {
    if (!foe || (current || 0) >= ECONOMY.maxAllies) return null;
    var chance = ECONOMY.allyJoinChance +
                 (held(foe.id) ? ECONOMY.allyKnownBonus : 0);
    if (Math.random() >= chance) return null;
    return { id: foe.id, name: foe.name, emoji: foe.emoji, known: held(foe.id) > 0 };
  }

  /* Does an ally land a blow alongside yours? */
  function allyStrikes(allies) {
    var n = 0;
    (allies || []).forEach(function () {
      if (Math.random() < ECONOMY.allyStrikeChance) n++;
    });
    return n;
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

  /* ---------- The daily challenge, and a streak that can't hurt ------------

     One challenge a day, the same one all day, worth double gold. It's drawn
     from the hero's own trail so it can only ever be work they've met — no
     new registry of tracks to keep in step with the games.

     The streak is deliberately toothless: it grants nothing, so it can take
     nothing away. A missed day steps it back by one rather than to zero. The
     point is a reason to come back, not a debt — a child who was ill for a
     week should not be shown the number they lost. */

  /* Which trail this hero is actually walking. The hub used to work this out
     for itself; the daily challenge needs the same answer, so it lives here. */
  function heroTrail() {
    // what the hero says they are, and only then a guess from the road walked
    return rowOf() || guessRow(me());
  }

  /* For saves written before a hero could say which kid they were: read it off
     the road behind them. Whichever trail they are further along is the one
     they have been playing; failing that, the last track they chose tells us,
     because the two menus share no track ids. */
  function guessRow(p) {
    if (!p) return 'little';
    var mp = (p.progress && p.progress.map) || {};
    if ((mp.big || 0) !== (mp.little || 0)) {
      return (mp.big || 0) > (mp.little || 0) ? 'big' : 'little';
    }
    var last = (p.settings && p.settings.lastTrack) || {};
    var seen = { little: 0, big: 0 };
    ['little', 'big'].forEach(function (tr) {
      (MAP[tr] || []).forEach(function (step) {
        (step instanceof Array ? step : [step]).forEach(function (n) {
          if (n.t && last[n.g] === n.t) seen[tr]++;
        });
      });
    });
    if (seen.big !== seen.little) return seen.big > seen.little ? 'big' : 'little';
    // Nothing to go on. "little" is the safer wrong answer: easy work handed
    // to a big kid is a shrug, hard work handed to a five-year-old is a wall.
    return 'little';
  }

  /* Local calendar day, not UTC: "today" has to mean the day they're in. */
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getDate()).slice(-2);
  }

  /* A small deterministic hash, so today's challenge is the same all day and
     different tomorrow — and different for each hero on the same day. */
  function daySeed(key, salt) {
    var h = 2166136261;
    var str = key + '|' + (salt || '');
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    // Consecutive days differ only in their last character, and the pick is a
    // modulo — so without a final avalanche the low bits barely move and the
    // "daily" challenge repeats itself for days at a time.
    h = (h + (h << 3)) >>> 0;
    h ^= h >>> 11;
    h = (h + (h << 15)) >>> 0;
    return h >>> 0;
  }

  /* Today's challenge for the active hero, or null if there's no hero.
     { key, trail, i, o, node, done }

     `forDay` overrides the date. Nothing in the game passes it — it exists so
     the tests can walk a year of days and prove the challenge actually varies,
     which is otherwise unprovable without waiting a year. */
  function daily(forDay) {
    var p = me();
    if (!p) return null;
    var trail = heroTrail();
    var steps = mapTrail(trail);
    if (!steps.length) return null;
    // Draw from what they've reached, plus a little ahead of it — and only
    // from the battle games. A Story Quest stop has no track or difficulty to
    // name, and double gold on a fixed-payout quest means little.
    var reach = Math.min(steps.length - 1, mapAt(trail) + ECONOMY.dailyReach);
    var pool = [];
    for (var i = 0; i <= reach; i++) {
      steps[i].options.forEach(function (n) {
        if (n.g === 'math' || n.g === 'language') pool.push(n);
      });
    }
    if (!pool.length) return null;
    var key = forDay || dayKey();
    var seed = daySeed(key, activeId() || p.name || '');
    var node = pool[seed % pool.length];
    return { key: key, trail: trail, i: node.i, o: node.o, node: node,
             done: p.progress.dailyDone === key };
  }

  /* Mark today's challenge as claimed. Returns true if this was the claim. */
  function claimDaily() {
    var d = daily();
    if (!d || d.done) return false;
    update(function (p) { p.progress.dailyDone = d.key; });
    return true;
  }

  /* Called when a run starts. Returns the streak after today is counted. */
  function touchDay() {
    var p = me();
    if (!p) return 0;
    if (!p.progress.streak) p.progress.streak = { days: 0, last: null };
    var st = p.progress.streak;
    var today = dayKey();
    if (st.last === today) return st.days;

    var yesterday = dayKey(new Date(Date.now() - 86400000));
    if (st.last === yesterday) st.days = (st.days || 0) + 1;
    else if (!st.last) st.days = 1;
    // A gap steps back by one and no further, and today still counts — so
    // coming back after a fortnight away is worth more than staying away.
    else st.days = Math.max(1, (st.days || 0) - 1);

    st.last = today;
    write();
    return st.days;
  }

  function streak() {
    var p = me();
    var st = p && p.progress.streak;
    if (!st || !st.last) return 0;
    // a streak shown after a gap is still the stored number: nothing is taken
    // away until they next play, and then only by one
    return st.days || 0;
  }

  /* ---------- Pets grow up -------------------------------------------------
     The one thing you own that isn't finished when you bought it. A pet counts
     the monsters it has seen fall and grows into a stronger form twice. The
     count is per pet id, so putting one away and bringing it back later keeps
     what it earned. */

  /* The equipped pet's current form, or null if there's no pet.
     { id, idx, emoji, name, xp, need, next } — `next` is null at full grown. */
  function petStage(petId) {
    var p = me();
    if (!p) return null;
    var id = petId || p.inventory.pet;
    var it = item(id);
    if (!it || it.kind !== 'pet') return null;
    var xp = (p.inventory.petXp && p.inventory.petXp[id]) || 0;
    var steps = ECONOMY.petGrowth;
    var idx = 0;
    for (var i = 0; i < steps.length; i++) if (xp >= steps[i]) idx = i;
    var stage = (it.stages && it.stages[idx]) || [it.emoji, it.name];
    return {
      id: id, idx: idx, emoji: stage[0], name: stage[1],
      xp: xp, need: steps[idx], next: idx + 1 < steps.length ? steps[idx + 1] : null
    };
  }

  /* One more monster down. Returns the new stage if the pet just grew into
     it, otherwise null — so a caller can celebrate without asking twice. */
  function growPet() {
    var p = me();
    if (!p || !p.inventory.pet) return null;
    var before = petStage();
    if (!before) return null;
    update(function (pr) {
      if (!pr.inventory.petXp) pr.inventory.petXp = {};
      pr.inventory.petXp[pr.inventory.pet] = (pr.inventory.petXp[pr.inventory.pet] || 0) + 1;
    });
    var after = petStage();
    return (after && after.idx > before.idx) ? after : null;
  }

  function loadout() {
    var p = me();
    var base = {
      maxHp: 5, bonusTime: 0, fastBonus: 0, crit: 0, superDamage: 2,
      slash: '💥', pet: null, petName: '', petStage: 0,
      shield: 0, goldBonus: 0, cardBonus: 0
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
      // a grown pet wears its later form and carries the growth bonus
      var stage = petStage();
      base.pet = (stage && stage.emoji) || pet.emoji;
      base.petName = (stage && stage.name) || pet.name;
      base.petStage = stage ? stage.idx : 0;
      base.bonusTime = Math.round((pet.bonusTime || 0) *
                                  (1 + base.petStage * ECONOMY.petStageTimeScale));
      base.shield = (pet.shield || 0) +
                    (pet.shield ? (ECONOMY.petStageShield[base.petStage] || 0) : 0);
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
    /* Extra damage a hit does on this stop — a boss's weak road, or nothing. */
    activeId: activeId,
    ROWS: ROWS,
    rowOf: rowOf,
    setRow: setRow,
    heroTrail: heroTrail,
    daily: daily,
    claimDaily: claimDaily,
    setDailyRun: setDailyRun,
    touchDay: touchDay,
    streak: streak,
    dayKey: dayKey,
    petStage: petStage,
    growPet: growPet,
    weaknessBonus: function (node) {
      return (node && node.boss && node.weak) ? ECONOMY.weaknessDamage : 0;
    },
    rollAlly: rollAlly,
    allyStrikes: allyStrikes,
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

    MAP: MAP,
    REGIONS: REGIONS,
    cardsOfWorld: cardsOfWorld,
    mapTrail: mapTrail,
    mapLength: mapLength,
    mapAt: mapAt,
    mapPick: mapPick,
    mapWalkFrom: mapWalkFrom,
    regionOf: regionOf,
    nodeState: nodeState,
    startNode: startNode,
    activeNode: activeNode,
    clearNode: clearNode,
    completeNode: completeNode,

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
    _guessRow: guessRow,   // exposed for the migration tests
    _version: VERSION,
    _goldScale: V2_GOLD_SCALE
  };
})();
