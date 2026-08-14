#!/usr/bin/env python3
"""Check the authored content against the rules the CLAUDE.mds lay down.

Usage:
    .verify/venv/bin/python .verify/content.py

Every content list in these games carries authoring rules that, when broken,
produce a question with two right answers or none — and nothing at runtime
notices. This reads the real arrays out of the pages and checks them.

Exit code 0 only if every rule holds.
"""
import os, re, sys, time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

opts = Options()
opts.add_argument("--headless")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)

failures = []


def check(label, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + label + (("  -- " + detail) if detail and not ok else ""))
    if not ok:
        failures.append(label)


def js(expr):
    return d.execute_script("return " + expr)


try:
    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(0.5)
    d.execute_script("Save.reset(); Save.createProfile('ContentTester', '🧪');")

    # =================== Language RPG ===================
    print("\nLanguage RPG")
    d.get("file://" + os.path.join(ROOT, "language/index.html"))
    time.sleep(1.0)

    tracks = js("TEST.TRACKS")
    ids = [t["id"] for t in tracks]
    check("tracks: ids are unique", len(set(ids)) == len(ids))
    check("tracks: every track has a deck and a maker",
          all(js("!!TEST.track('%s').pool() && !!TEST.track('%s').make" % (i, i)) for i in ids))
    check("tracks: every deck has content",
          all(js("TEST.track('%s').pool().length" % i) > 0 for i in ids))
    check("tracks: every track has a card in the menu",
          all(len(d.find_elements("css selector", '[data-track="%s"]' % i)) == 1 for i in ids))
    check("tracks: the menu shows nothing that isn't a track",
          len(d.find_elements("css selector", "#menu .choice[data-track]")) == len(ids))

    # ---- Beginning Sounds ----
    sounds = js("TEST.SOUNDS")
    initials = [fam[0][0][0].lower() for fam in sounds]
    check("sounds: no two families share an initial sound",
          len(set(initials)) == len(initials),
          "repeated: %s" % [c for c in initials if initials.count(c) > 1])
    bad = [fam for fam in sounds if len(set(w[0][0].lower() for w in fam)) != 1]
    check("sounds: every word in a family starts with the family's sound",
          not bad, str(bad))
    check("sounds: every family has at least 2 words",
          all(len(fam) >= 2 for fam in sounds))
    emojis = [w[1] for fam in sounds for w in fam]
    check("sounds: no emoji repeats across families",
          len(set(emojis)) == len(emojis),
          "repeated: %s" % [e for e in emojis if emojis.count(e) > 1])
    check("sounds: enough families to fill the decoys", len(sounds) >= 3)

    # ---- Opposites ----
    oppos = js("TEST.OPPOS")
    check("opposites: every entry is a pair", all(len(p) == 2 for p in oppos))
    oemoji = [w[1] for p in oppos for w in p]
    check("opposites: no emoji repeats across pairs",
          len(set(oemoji)) == len(oemoji),
          "repeated: %s" % [e for e in oemoji if oemoji.count(e) > 1])
    owords = [w[0] for p in oppos for w in p]
    check("opposites: no word repeats across pairs",
          len(set(owords)) == len(owords))
    check("opposites: enough pairs to fill the decoys", len(oppos) >= 3)

    # ---- the older rules, still worth holding ----
    fixit = js("TEST.track('fixit').pool()")
    bad = [f for f in fixit
           if f["bad"].split().count(f["wrong"]) +
              f["bad"].split().count(f["wrong"] + ".") +
              f["bad"].split().count(f["wrong"] + ",") +
              f["bad"].split().count(f["wrong"] + "!") +
              f["bad"].split().count(f["wrong"] + "?") != 1]
    check("fixit: the wrong word appears exactly once", not bad,
          "%d sentences" % len(bad) + (": " + bad[0]["bad"] if bad else ""))
    bad = [f for f in fixit if f["fix"] in f["decoys"]]
    check("fixit: no decoy is the correct fix", not bad)

    # FORGE stores only the parts, not the finished word, so "the parts spell a
    # real word" can't be checked without a dictionary. What can be checked is
    # that each build is actually a build.
    forge = js("TEST.track('forge').pool()")
    bad = [f for f in forge if len(f["p"]) < 2 or any(not c.strip() for c in f["p"])]
    check("forge: every build has at least two non-empty chunks", not bad, str(bad[:1]))
    bad = [f for f in forge if not f["m"].strip()]
    check("forge: every build has a clue to build from", not bad)
    bad = [f for f in forge if set(f["p"]) & set(f["d"])]
    check("forge: no decoy chunk is also a real part", not bad, str(bad[:1]))

    syllb = js("TEST.track('syllable').pool()")
    bad = [w for w in syllb if set(w["p"]) & set(w["d"])]
    check("syllable: no decoy chunk is also a real part", not bad, str(bad[:1]))

    twins = js("TEST.track('twins').pool()")
    bad = [t for t in twins if t["a"] in t["d"]]
    check("twins: no decoy is the answer", not bad)

    grammar = js("TEST.track('grammar').pool()")
    bad = [g for g in grammar
           if [w.strip(".,!?") for w in g["s"].split()].count(g["a"]) != 1]
    check("grammar: the target word appears exactly once", not bad,
          "%d sentences" % len(bad))

    # ---- record.html must know about every clip the game can ask for ----
    rec = open(os.path.join(ROOT, "language/record.html"), encoding="utf-8").read()
    phrases = set(re.findall(r"Voice\.play\(\['(P_\w+)'",
                             open(os.path.join(ROOT, "language/index.html"), encoding="utf-8").read()))
    missing = [p for p in phrases if ("'%s'" % p) not in rec]
    check("record.html: every game phrase can be recorded", not missing, str(missing))

    # =================== Story Quest ===================
    print("\nStory Quest")
    d.get("file://" + os.path.join(ROOT, "story/index.html"))
    time.sleep(1.0)
    quests = js("TEST.QUESTS")

    bad = []
    for qi, q in enumerate(quests):
        for si, sc in enumerate(q["scenes"]):
            oks = [c for c in sc["choices"] if c.get("ok")]
            if len(oks) != 1:
                bad.append("%s scene %d has %d right answers" % (q["title"], si + 1, len(oks)))
    check("quests: every scene has exactly one right choice", not bad, str(bad[:3]))

    bad = []
    for q in quests:
        for si, sc in enumerate(q["scenes"]):
            for c in sc["choices"]:
                if not c.get("ok") and not c.get("oops"):
                    bad.append("%s scene %d: a wrong choice with no consequence" % (q["title"], si + 1))
    check("quests: every wrong choice explains itself", not bad, str(bad[:3]))

    bad = []
    for q in quests:
        for si, sc in enumerate(q["scenes"]):
            ch = sc.get("chest")
            if not ch:
                continue
            if len(ch["a"]) != 3:
                bad.append("%s scene %d: chest has %d answers" % (q["title"], si + 1, len(ch["a"])))
            if ch["right"] not in ch["a"]:
                bad.append("%s scene %d: chest answer isn't among its options" % (q["title"], si + 1))
            if len(set(ch["a"])) != len(ch["a"]):
                bad.append("%s scene %d: chest has a duplicate option" % (q["title"], si + 1))
    check("quests: every chest has 3 distinct options including the answer", not bad, str(bad[:3]))

    # ---- little hero games ----
    order = js("TEST.ORDER_SETS")
    check("order: every set has a title and at least 3 steps",
          all(s_["title"] and len(s_["steps"]) >= 3 for s_ in order))
    bad = [s_["title"] for s_ in order
           if len(set(st[0] for st in s_["steps"])) != len(s_["steps"])]
    check("order: no picture repeats inside a set", not bad,
          str(bad) + " (a repeat makes two steps indistinguishable)")
    bad = [s_["title"] for s_ in order if any(not st[1].strip() for st in s_["steps"])]
    check("order: every step has a label", not bad)
    check("order: enough sets to fill a game without repeating",
          len(order) > js("TEST.MINI_ROUNDS"),
          "%d sets for %d rounds" % (len(order), js("TEST.MINI_ROUNDS")))

    finish = js("TEST.FINISH_STORIES")
    bad = [f["text"][:40] for f in finish
           if len([c for c in f["choices"] if c.get("ok")]) != 1]
    check("finish: every story has exactly one right ending", not bad, str(bad))
    bad = [f["text"][:40] for f in finish
           if any(not c.get("ok") and not c.get("oops") for c in f["choices"])]
    check("finish: every wrong ending explains itself", not bad, str(bad))
    bad = [f["text"][:40] for f in finish if len(f["choices"]) != 3]
    check("finish: every story offers three endings", not bad, str(bad))
    bad = [f["text"][:40] for f in finish
           if len(set(c["t"] for c in f["choices"])) != 3]
    check("finish: no two endings read the same", not bad, str(bad))
    check("finish: enough stories to fill a game without repeating",
          len(finish) > js("TEST.MINI_ROUNDS"))

    check("quests: every quest has a collectible card",
          len(quests) <= len(js("Save.STORY_CARDS")),
          "%d quests, %d cards" % (len(quests), len(js("Save.STORY_CARDS"))))

    # =================== Save data ===================
    print("\nShared data")
    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(0.6)
    cards = js("Save.allCards()")
    ids = [c["id"] for c in cards]
    check("cards: every id is unique across the whole site",
          len(set(ids)) == len(ids),
          "repeated: %s" % [i for i in ids if ids.count(i) > 1])

    shop = js("Save.SHOP")
    sids = [i["id"] for i in shop]
    check("shop: every item id is unique", len(set(sids)) == len(sids))
    check("shop: every item has a name, a blurb and a price",
          all(i.get("name") and i.get("sub") and i.get("cost") is not None for i in shop))
    worlds = js("Save.WORLDS")
    unlockable = [i["world"] for i in shop if i["kind"] == "world"]
    check("shop: every world beyond the first can be bought",
          sorted(unlockable) == sorted(w["id"] for w in worlds[1:]),
          "%s vs %s" % (unlockable, [w["id"] for w in worlds[1:]]))
    check("worlds: each has a full lineup for both battle games",
          all(len(w["foes"]["math"]) == 4 and len(w["foes"]["language"]) == 5 for w in worlds))
finally:
    d.quit()

print("")
if failures:
    print("%d CONTENT CHECK(S) FAILED" % len(failures))
    sys.exit(1)
print("All content checks passed.")
