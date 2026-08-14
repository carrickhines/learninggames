#!/usr/bin/env python3
"""Close-up inspection shots: topbar (mute vs HP) and foe sizes."""
import os, time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "shots")
PAGE = "file://" + os.path.join(ROOT, "index.html")
os.makedirs(OUT, exist_ok=True)

opts = Options()
opts.add_argument("--headless")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)

def fit_viewport(w, h):
    d.set_window_size(w, h)
    for _ in range(5):
        sz = d.get_window_size()
        iw, ih = d.execute_script("return [window.innerWidth, window.innerHeight]")
        if abs(iw - w) <= 1 and abs(ih - h) <= 1:
            break
        d.set_window_size(sz["width"] + (w - iw), sz["height"] + (h - ih))


d.get(PAGE)
fit_viewport(960, 820)
print("viewport:", d.execute_script("return [window.innerWidth, window.innerHeight]"))


def el(sel):
    return d.find_element(By.CSS_SELECTOR, sel)


def shot_el(sel, name):
    el(sel).screenshot(os.path.join(OUT, name + ".png"))
    print("wrote", name)


try:
    # battle (multiplication)
    el('[data-track="mul"]').click()
    el('[data-mode="normal"]').click()
    el('#startBtn').click()
    time.sleep(1.0)

    # close-up of the whole top bar incl. both HP rows
    shot_el('#battle .topbar', 'zoom-topbar')

    # measured geometry: do the foe HP pips collide with the mute button?
    rects = d.execute_script("""
      const r = e => { const b=e.getBoundingClientRect(); return {l:b.left,r:b.right,t:b.top,b:b.bottom,w:b.width,h:b.height}; };
      return {
        mute: r(document.getElementById('muteBtn')),
        foeName: r(document.querySelector('.fighter-info.foe .name')),
        foePips: r(document.getElementById('foeHp')),
        playerPips: r(document.getElementById('playerHp')),
      };
    """)
    for k, v in rects.items():
        print(f"{k:11s} left={v['l']:.0f} right={v['r']:.0f} top={v['t']:.0f} w={v['w']:.0f}")
    mute, fn, fp = rects['mute'], rects['foeName'], rects['foePips']
    print("foeName overlaps mute:", fn['r'] > mute['l'] and fn['t'] < mute['b'])
    print("foePips overlaps mute:", fp['r'] > mute['l'] and fp['t'] < mute['b'])

    # foe size comparison: render every foe emoji at the sprite size, side by side
    d.execute_script("""
      const foes = [['🟢',0.80],['🦇',1.05],['👻',0.92],['🐉',1.16]];
      const a = document.getElementById('arena');
      a.innerHTML = foes.map(([e,s]) =>
        `<div class="sprite foe" style="animation:none;transform:none;font-size:calc(150px * ${s})">${e}</div>`).join('');
      a.style.justifyContent='space-around';
    """)
    time.sleep(0.3)
    shot_el('#arena', 'zoom-foes')

    # measured visual height of each foe glyph (tight bbox via range rects differ;
    # use offsetHeight of a span sized to content)
    sizes = d.execute_script("""
      const foes = ['🟢','🦇','👻','🐉'];
      return foes.map(e => {
        const s=document.createElement('span');
        s.style.cssText='font-size:120px;position:absolute;visibility:hidden;line-height:1';
        s.textContent=e; document.body.appendChild(s);
        const b=s.getBoundingClientRect(); s.remove();
        return {emoji:e, w:Math.round(b.width), h:Math.round(b.height)};
      });
    """)
    print("foe glyph boxes @120px:", sizes)
finally:
    d.quit()
