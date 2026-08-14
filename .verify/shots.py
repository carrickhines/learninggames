#!/usr/bin/env python3
"""Headless screenshots of Math RPG's screens, driven through the real game.

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
PAGE = "file://" + os.path.join(ROOT, "index.html")

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


d.get(PAGE)
fit_viewport(W, H)


def shot(name):
    path = os.path.join(OUT, name + ".png")
    d.save_screenshot(path)
    print("wrote", os.path.relpath(path, ROOT))


def click(sel):
    d.find_element(By.CSS_SELECTOR, sel).click()


def load():
    d.get(PAGE)
    time.sleep(0.7)  # let the fadeIn settle


try:
    # 1. Menu
    load()
    shot("menu")

    # 2. Multiplication battle (no blocks)
    click('[data-track="mul"]')
    click('[data-mode="normal"]')
    click('#startBtn')
    time.sleep(1.0)  # battle fade + first problem
    shot("battle-mul")

    # the dragon is the largest foe — check the boss against the layout
    d.execute_script("""
        var s=document.getElementById('foeSprite');
        s.textContent='🐉'; s.style.setProperty('--foe-scale', 1.16);
        document.getElementById('foeName').textContent='🐉 Dragon';
        var p=document.getElementById('foeHp'); p.innerHTML='';
        for(var i=0;i<5;i++){var o=document.createElement('span');o.className='pip orb';p.appendChild(o);}
    """)
    time.sleep(0.3)
    shot("battle-dragon")

    # 3. Division battle (no blocks, same layout as multiplication)
    load()
    click('[data-track="div"]')
    click('[data-mode="normal"]')
    click('#startBtn')
    time.sleep(1.0)
    shot("battle-div")

    # 4. Addition battle (number blocks visible), then push the towers together
    load()
    click('[data-track="add"]')
    click('[data-mode="easy"]')
    click('#startBtn')
    time.sleep(1.0)
    shot("battle-add")
    click('#pushBtn')
    time.sleep(1.6)  # block count-up animation
    shot("battle-add-merged")

    # 5. Subtraction battle: one tower with the top blocks marked to remove,
    #    then take them away and count the remainder.
    load()
    click('[data-track="sub"]')
    click('[data-mode="easy"]')
    click('#startBtn')
    time.sleep(1.0)
    shot("battle-sub")
    click('#pushBtn')
    time.sleep(2.0)  # take-away + count-up animation
    shot("battle-sub-taken")

    # 6. Next Number battle (counting, no blocks): a number and "→ ?"
    load()
    click('[data-track="next"]')
    click('[data-mode="easy"]')
    click('#startBtn')
    time.sleep(1.0)
    shot("battle-next")

    # 7. Count On battle (add 1-3, push-together blocks like addition)
    load()
    click('[data-track="count"]')
    click('[data-mode="easy"]')
    click('#startBtn')
    time.sleep(1.0)
    shot("battle-count")

    # 8. Algebra battle (solve for x, no blocks). Capture a few problems so the
    #    suite shows one-step and two-step forms across runs.
    load()
    click('[data-track="alg"]')
    click('[data-mode="normal"]')
    click('#startBtn')
    time.sleep(1.0)
    shot("battle-alg")

    # 4. Victory / Game-over screens. These need many turns to reach naturally,
    #    so just reveal the static end screen to verify its layout.
    d.execute_script("""
        document.getElementById('battle').classList.add('hidden');
        document.getElementById('menu').classList.add('hidden');
        var e=document.getElementById('endScreen'); e.classList.remove('hidden');
        document.getElementById('endEmoji').textContent='🏆';
        document.getElementById('endTitle').textContent='Victory!';
        document.getElementById('endText').textContent="You defeated every monster. You're a math hero!";
        // reveal the win reward (earned iPad time + Start timer button)
        document.getElementById('reward').classList.remove('hidden');
        document.getElementById('rewardMins').textContent='8';
        document.getElementById('rewardMinsHint').textContent='8';
    """)
    time.sleep(1.2)  # let the end screen fade in fully
    shot("end-win")

    # the countdown, mid-run and at "time's up" (alarm state)
    d.execute_script("""
        document.getElementById('rewardStart').classList.add('hidden');
        var cb=document.getElementById('countdownBox'); cb.classList.remove('hidden');
        document.getElementById('countdown').textContent='7:42';
        document.getElementById('countdownLabel').textContent='iPad time left';
        document.getElementById('cancelTimerBtn').textContent='Cancel';
    """)
    time.sleep(0.4)
    shot("end-countdown")

    d.execute_script("""
        var cb=document.getElementById('countdownBox'); cb.classList.add('ringing');
        document.getElementById('countdown').textContent='0:00';
        document.getElementById('countdownLabel').textContent="⏰ TIME'S UP!";
        document.getElementById('cancelTimerBtn').textContent='🔕 Stop alarm';
    """)
    time.sleep(0.4)
    shot("end-ringing")
finally:
    d.quit()
