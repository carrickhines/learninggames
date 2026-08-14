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


def load(relpath):
    d.get("file://" + os.path.join(ROOT, relpath))
    fit_viewport(W, H)
    time.sleep(0.7)  # let the fadeIn settle


def battle(relpath, track, mode, name, settle=1.0):
    load(relpath)
    click('[data-track="%s"]' % track)
    click('[data-mode="%s"]' % mode)
    click("#startBtn")
    time.sleep(settle)
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

    # ---------- Math RPG ----------
    load("math/index.html")
    shot("math-menu")

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

    battle("math/index.html", "div", "normal", "math-battle-div")
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

    # end screens
    d.execute_script("""
        document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('show');});
        document.getElementById('endScreen').classList.add('show');
        document.getElementById('endEmoji').textContent='🏆';
        document.getElementById('endTitle').textContent='Victory!';
        document.getElementById('endText').textContent="You defeated every monster. You're a math hero!";
    """)
    time.sleep(1.2)
    reward_states("math-win")

    # ---------- Language RPG ----------
    load("language/index.html")
    shot("lang-menu")
    battle("language/index.html", "letters", "easy", "lang-battle-letters")
    battle("language/index.html", "builder", "easy", "lang-battle-builder")
    battle("language/index.html", "fixit", "normal", "lang-battle-fixit")
    battle("language/index.html", "forge", "normal", "lang-battle-forge")
    battle("language/index.html", "rhyme", "easy", "lang-battle-rhyme")
    d.execute_script("""
        document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('show');});
        document.getElementById('win').classList.add('show');
    """)
    time.sleep(1.0)
    reward_states("lang-win")

    # ---------- Story Quest ----------
    load("story/index.html")
    shot("story-menu")
    d.find_elements(By.CSS_SELECTOR, "#questRow .choice")[0].click()
    click("#startBtn")
    time.sleep(1.0)
    shot("story-scene")
    d.execute_script("""
        document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('show');});
        document.getElementById('win').classList.add('show');
        document.getElementById('winText').textContent='You finished The Troll Bridge with 5 of 6 gems!';
    """)
    time.sleep(1.0)
    reward_states("story-win")
finally:
    d.quit()
