#!/usr/bin/env python3
"""Headless screenshots of every screen in the site, driven through the real UI.

Usage:
    .verify/venv/bin/python .verify/shots.py [width height]

Reuses the system Firefox via the bundled geckodriver. Writes PNGs to
.verify/shots/. Each screen is captured after its entry animation settles so
nothing is caught mid-fade.
"""
import os, sys, time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "shots")

W = int(sys.argv[1]) if len(sys.argv) > 1 else 960
H = int(sys.argv[2]) if len(sys.argv) > 2 else 820

os.makedirs(OUT, exist_ok=True)

opts = Options()
opts.add_argument("--headless")
opts.add_argument(f"--width={W}")
opts.add_argument(f"--height={H}")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)


def fit_viewport(w, h):
    """set_window_size sets the OUTER size; iterate until the INNER viewport
    matches, accounting for whatever chrome the headless window carries."""
    d.set_window_size(w, h)
    for _ in range(5):
        sz = d.get_window_size()
        iw, ih = d.execute_script("return [window.innerWidth, window.innerHeight]")
        if abs(iw - w) <= 1 and abs(ih - h) <= 1:
            break
        d.set_window_size(sz["width"] + (w - iw), sz["height"] + (h - ih))


def shot(name):
    path = os.path.join(OUT, name + ".png")
    d.save_screenshot(path)
    print("wrote", os.path.relpath(path, ROOT))


def click(sel):
    d.find_element(By.CSS_SELECTOR, sel).click()


NO_ANIM = """
var s = document.createElement('style');
s.textContent = '*,*::before,*::after{animation:none !important;transition:none !important}';
document.head.appendChild(s);
"""


def load(relpath):
    d.get("file://" + os.path.join(ROOT, relpath))
    fit_viewport(W, H)
    # Capture every screen in its settled state. Headless Firefox also stops
    # advancing the animation clock after a window resize, which would
    # otherwise freeze fade-ins and pop-ins at their first frame.
    d.execute_script(NO_ANIM)
    time.sleep(0.4)


def battle(relpath, track, mode, name, settle=1.0):
    load(relpath)
    click('[data-track="%s"]' % track)
    click('[data-mode="%s"]' % mode)
    click("#startBtn")
    time.sleep(settle)
    d.execute_script(NO_ANIM)
    shot(name)


def reward_states(prefix):
    """The shared reward panel in each of its three states."""
    d.execute_script("Reward.offer(8);")
    time.sleep(0.3)
    shot(prefix + "-reward")
    d.execute_script("document.querySelector('.r-start').click();")
    time.sleep(0.4)
    shot(prefix + "-countdown")
    d.execute_script("""
        document.getElementById('countdownBox').classList.add('ringing');
        document.querySelector('.countdown').textContent = '0:00';
        document.querySelector('.countdown-label').textContent = "\\u23f0 TIME'S UP!";
        document.querySelector('.r-cancel').textContent = '\\ud83d\\udd15 Stop alarm';
    """)
    time.sleep(0.3)
    shot(prefix + "-ringing")


try:
    # ---------- Hub ----------
    # Seed a hero with some progress so the cards, bars, and prices all have
    # something to show.
    load("index.html")
    d.execute_script("""
        Save.reset();
        Save.createProfile('Rex', '🦖');
        Save.award(280, 170);
        Save.awardCard('m-slime'); Save.awardCard('m-bat'); Save.awardCard('l-imp');
        Save.awardCard('s-troll');
        location.reload();
    """)
    time.sleep(1.0)
    shot("hub-home")

    d.execute_script("document.getElementById('heroCard').click();")
    time.sleep(0.6)
    shot("hub-who")

    d.execute_script("document.getElementById('newHeroBtn').click();")
    time.sleep(0.6)
    shot("hub-new-hero")

    load("index.html")
    d.execute_script("document.getElementById('settingsBtn').click();")
    time.sleep(0.6)
    shot("hub-settings")

    # the progress report, with a plausible week of play behind it
    load("index.html")
    d.execute_script("""
        Log.clear();
        var DAY = 86400000, now = Date.now();
        var sets = [
          ['math','mul',  0.62, 14], ['math','add',  0.95, 20],
          ['math','rule', 0.71, 10], ['language','fixit', 0.80, 15],
          ['language','sounds', 0.90, 12], ['story','quest 1', 0.88, 9]
        ];
        var qs = {
          mul: ['7 x 8','6 x 7','12 x 4','9 x 6','8 x 8'],
          add: ['3 + 4','5 + 6','2 + 9','7 + 8','4 + 4'],
          rule: ['2, 4, 8, 16, ?','20, 17, 14, ?','3, 6, 9, ?'],
          fixit: ['The hole class went.','She dont know.','Two mouses ran.'],
          sounds: ['starts like star','starts like moon','starts like frog'],
          'quest 1': ['A note is nailed to the castle door.','The troll grins at you.']
        };
        var wrongs = { mul:['54','48','36'], add:['8','12'], rule:['24','11'],
                       fixit:['went','dont'], sounds:['duck','ring'],
                       'quest 1':['Pack your shiniest coins'] };
        sets.forEach(function (row, i) {
          var game = row[0], track = row[1], acc = row[2], n = row[3];
          Log.startSession({ game: game, track: track, mode: 'normal' });
          for (var k = 0; k < n; k++) {
            var ok = Math.random() < acc;
            var pool = qs[track], bad = wrongs[track];
            Log.answer({ q: pool[k % pool.length],
                         given: ok ? 'right' : bad[k % bad.length],
                         ok: ok, ms: 2000 + Math.random() * 6000 });
          }
          Log.endSession({ won: true, gold: 40 + i * 7 });
        });
        // spread the sessions across the past week
        var store = JSON.parse(localStorage.getItem(Log._key));
        var id = Save.load().active;
        store[id].sessions.forEach(function (s, i) {
          s.t = now - (6 - i) * DAY + i * 3600000;
          s.e = s.t + (8 + i) * 60000;
        });
        localStorage.setItem(Log._key, JSON.stringify(store));
        Log._reload();
        document.getElementById('settingsBtn').click();
        document.getElementById('parentBtn').click();
    """)
    time.sleep(0.8)
    d.execute_script(NO_ANIM)
    shot("hub-parent")
    d.execute_script("document.getElementById('missReport').scrollIntoView({block:'center'});")
    time.sleep(0.3)
    shot("hub-parent-missed")

    # the map, a few stops in
    load("index.html")
    d.execute_script("""
        Save.update(function (p) {
            p.progress.map = { little: 4, big: 3 };
            p.progress.mapPicks = { little: { 2: 1 }, big: { 2: 0 } };
        });
        document.getElementById('mapBtn').click();
    """)
    time.sleep(1.2)
    d.execute_script(NO_ANIM)
    shot("hub-map")
    # further along, at a boss and into the next region
    d.execute_script("""
        Save.update(function (p) { p.progress.map.little = 5; });
        openMap(null);
        document.getElementById('mapScroll').scrollTop = 380;
    """)
    time.sleep(0.6)
    shot("hub-map-boss")
    d.execute_script("document.querySelector('[data-trail=\"big\"]').click();")
    time.sleep(0.6)
    shot("hub-map-big")
    # the chest
    d.execute_script("""
        showChest({ boss: true, gold: 250,
                    card: { id: 'm-dragon', how: 'new', foil: true }, token: false });
    """)
    time.sleep(0.5)
    shot("hub-map-chest")

    # a game playing a map stop, and a boss stop
    load("index.html")
    d.execute_script("Save.update(function (p) { p.progress.map.little = 1; });"
                     "Save.startNode('little', 1);")
    load("story/index.html")
    time.sleep(1.0)
    d.execute_script(NO_ANIM)
    shot("story-map-stop")

    load("index.html")
    d.execute_script("Save.update(function (p) { p.progress.map.little = 5; });"
                     "Save.startNode('little', 5);")
    load("math/index.html")
    time.sleep(1.2)
    d.execute_script(NO_ANIM)
    shot("math-boss")
    load("index.html")
    d.execute_script("Save.clearNode();")

    # the collection, part-caught
    load("index.html")
    d.execute_script("""
        ['m-slime','m-bat','m-dragon','l-imp','l-ghost','l-rex','s-troll','s-ghost','m-crab']
            .forEach(function (id) { Save.awardCard(id, true); });
        Save.update(function (p) {
            p.cards['m-slime'] = 4; p.cards['l-imp'] = 2; p.foils['m-dragon'] = 1;
        });
        document.getElementById('cardsBtn').click();
    """)
    time.sleep(0.6)
    shot("hub-cards")

    d.execute_script("document.getElementById('traderBtn').click();")
    time.sleep(0.6)
    shot("hub-trader")

    # the card-drop moment, plain and shiny
    load("math/index.html")
    d.execute_script("Hud.cardDrop({id:'m-dragon', how:'new', foil:false});")
    time.sleep(0.5)
    shot("math-card-drop")
    load("math/index.html")
    d.execute_script("Hud.cardDrop({id:'l-titan', how:'new', foil:true});")
    time.sleep(0.5)
    shot("math-card-drop-foil")

    # redeeming an iPad Time Token, in each of its three states
    load("index.html")
    d.execute_script("Save.award(200,0); Save.buy('ipad'); renderHome();")
    time.sleep(0.3)
    d.execute_script("document.getElementById('redeemBtn').click();")
    time.sleep(0.5)
    reward_states("hub-token")

    # the shop, mid-progression: some gear owned and worn, some out of reach
    load("index.html")
    d.execute_script("""
        Save.award(6000, 0);
        Save.buy('sword'); Save.buy('vest'); Save.buy('chick');
        Save.buy('coin'); Save.buy('ipad'); Save.buy('world-cave');
        document.getElementById('shopBtn').click();
    """)
    time.sleep(0.6)
    shot("hub-shop")

    # ---------- Math RPG ----------
    load("math/index.html")
    shot("math-menu")

    # the crowded topbar: a long name, a big purse, ten hearts
    load("index.html")
    d.execute_script("""
        Save.createProfile('Alexander', '\ud83e\udd96');
        Save.award(99999, 0);
        var w = Save.world('sky');
        w.foes.math.concat(w.foes.language).forEach(function (f) {
            Save.update(function (p) { p.cards[f.id] = 1; });
        });
        Save.buy('aegis');
    """)
    battle("math/index.html", "mul", "normal", "math-topbar-crowded")
    load("index.html")
    d.execute_script("Save.setActive(Save.profiles().filter("
                     "function (p) { return p.name === 'Rex'; })[0].id);")

    battle("math/index.html", "mul", "normal", "math-battle-mul")

    # the dragon is the largest foe — check the boss against the layout
    d.execute_script("""
        var s=document.getElementById('foeSprite');
        s.textContent='🐉'; s.style.setProperty('--foe-scale', 1.16);
        document.getElementById('foeName').textContent='🐉 Dragon';
        var p=document.getElementById('foeHp'); p.innerHTML='';
        for(var i=0;i<5;i++){var o=document.createElement('span');o.className='pip orb';p.appendChild(o);}
    """)
    time.sleep(0.3)
    shot("math-battle-dragon")

    # a reward waiting to be opened: the chip shows a badge, the question is clear
    d.execute_script("Hud.queue({kind:'level', level:4}); Hud.queue({kind:'card', drop:{id:'m-bat', how:'new', foil:false}});")
    time.sleep(0.3)
    d.execute_script(NO_ANIM)
    shot("math-reward-waiting")
    d.execute_script("Hud.flush();")
    time.sleep(0.4)
    shot("math-reward-opened")

    # earning: the gold float off the chip, and the level-up banner
    d.execute_script("Hud.gained(4);")
    time.sleep(0.35)
    shot("math-battle-earning")
    d.execute_script("Hud.levelUp(5);")
    time.sleep(0.5)
    shot("math-battle-levelup")

    battle("math/index.html", "div", "normal", "math-battle-div")
    battle("math/index.html", "skip", "easy", "math-battle-skip")
    battle("math/index.html", "oneless", "easy", "math-battle-oneless")
    battle("math/index.html", "pattern", "easy", "math-battle-pattern")
    battle("math/index.html", "sort", "easy", "math-battle-sort")

    # Rule Hunter at the top rung, where it stops asking for the next number
    # and starts asking for the rule
    battle("math/index.html", "rule", "normal", "math-battle-rule")
    d.execute_script("""
        Save.update(function (p) { p.progress.seqTier = 5; });
        for (var i = 0; i < 12; i++) { TEST.newProblem();
            if (TEST.state.choices) break; }
    """)
    time.sleep(0.4)
    d.execute_script(NO_ANIM)
    shot("math-battle-rule-tier5")
    battle("math/index.html", "next", "easy", "math-battle-next")
    battle("math/index.html", "alg", "normal", "math-battle-alg")
    battle("math/index.html", "count", "easy", "math-battle-count")

    # addition: number blocks, then pushed together and counted
    battle("math/index.html", "add", "easy", "math-battle-add")
    click("#pushBtn")
    time.sleep(1.6)
    shot("math-battle-add-merged")

    # subtraction: blocks marked to remove, then taken away
    battle("math/index.html", "sub", "easy", "math-battle-sub")
    click("#pushBtn")
    time.sleep(2.0)
    shot("math-battle-sub-taken")

    # end screen: what the run paid
    d.execute_script("""
        document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('show');});
        document.getElementById('endScreen').classList.add('show');
        document.getElementById('endEmoji').textContent='🏆';
        document.getElementById('endTitle').textContent='Victory!';
        document.getElementById('endText').textContent="You defeated every monster. You're a math hero!";
        TEST.state.goldAtStart = Save.me().gold - 68;
        TEST.showEarnings();
    """)
    time.sleep(0.6)
    shot("math-win")

    # ---------- Language RPG ----------
    load("language/index.html")
    shot("lang-menu")
    battle("language/index.html", "letters", "easy", "lang-battle-letters")
    battle("language/index.html", "builder", "easy", "lang-battle-builder")
    battle("language/index.html", "fixit", "normal", "lang-battle-fixit")
    battle("language/index.html", "forge", "normal", "lang-battle-forge")
    battle("language/index.html", "rhyme", "easy", "lang-battle-rhyme")
    battle("language/index.html", "sounds", "easy", "lang-battle-sounds")
    battle("language/index.html", "opposites", "easy", "lang-battle-opposites")
    d.execute_script("""
        document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('show');});
        document.getElementById('win').classList.add('show');
        TEST.state.goldAtStart = Save.me().gold - 74;
        TEST.showEarnings();
    """)
    time.sleep(0.6)
    shot("lang-win")

    # ---------- Story Quest ----------
    load("story/index.html")
    shot("story-menu")
    # the two little-hero games
    d.execute_script("document.querySelector('[data-mini=\"order\"]').click();")
    time.sleep(0.8)
    d.execute_script(NO_ANIM)
    shot("story-order")
    d.execute_script("""
        var steps = TEST.state.item.steps, cards = document.querySelectorAll('.order-card');
        for (var k = 0; k < cards.length; k++)
            if (cards[k].querySelector('.pic').textContent === steps[0][0]) { cards[k].click(); break; }
    """)
    time.sleep(0.4)
    shot("story-order-placed")

    load("story/index.html")
    d.execute_script("document.querySelector('[data-mini=\"finish\"]').click();")
    time.sleep(0.8)
    d.execute_script(NO_ANIM)
    shot("story-finish")

    load("story/index.html")
    d.find_elements(By.CSS_SELECTOR, "#questRow .choice")[0].click()
    click("#startBtn")
    time.sleep(1.0)
    shot("story-scene")
    d.execute_script("""
        document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('show');});
        document.getElementById('win').classList.add('show');
        document.getElementById('winText').textContent='You finished The Troll Bridge with 5 of 6 gems!';
        TEST.state.goldAtStart = Save.me().gold - 52;
        TEST.showEarnings();
    """)
    time.sleep(0.6)
    shot("story-win")
finally:
    d.quit()
