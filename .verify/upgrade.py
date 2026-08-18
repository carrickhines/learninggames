"""Does an existing save survive the next deploy?

The kids' progress lives in localStorage on their iPads and nowhere else.
Pushing to main replaces the code underneath it, and there is no server copy to
restore from — so before a deploy, this plays on the **currently deployed**
build, takes the save it actually wrote, and opens the **new** build on top of
it. Nothing may be lost, and a stop left half-played must resume into the same
game it would have before.

`save-test.html` checks hand-written fixtures of every schema version. This
checks the real thing, written by the real old code, which is what the iPads
are holding. Run both.

    .verify/venv/bin/python .verify/upgrade.py            # vs origin/main
    .verify/venv/bin/python .verify/upgrade.py <commit>   # vs anything else

See AGENTS.md for the rules this exists to enforce.
"""
import json
import os
import shutil
import subprocess
import sys
import time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

HERE = os.path.dirname(os.path.abspath(__file__))
NEW = os.path.dirname(HERE)
WORKTREE = os.path.join(HERE, ".deployed")

failures = []


def check(label, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + label +
          (("  -- " + detail) if detail and not ok else ""))
    if not ok:
        failures.append(label)


def git(*args):
    return subprocess.run(["git", "-C", NEW] + list(args),
                          capture_output=True, text=True)


def deployed_worktree(ref):
    """A checkout of what's live, to write a save with."""
    if os.path.exists(WORKTREE):
        git("worktree", "remove", "--force", WORKTREE)
        shutil.rmtree(WORKTREE, ignore_errors=True)
    r = git("worktree", "add", "--detach", "-f", WORKTREE, ref)
    if r.returncode:
        sys.exit("could not check out %s:\n%s" % (ref, r.stderr))
    return WORKTREE


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    old = deployed_worktree(ref)
    head = git("rev-parse", "--short", ref).stdout.strip()
    print("deployed: %s (%s)\nnew:      working tree\n" % (ref, head))

    opts = Options()
    opts.add_argument("-headless")
    d = webdriver.Firefox(service=Service(os.path.join(HERE, "geckodriver")),
                          options=opts)
    try:
        # ---------- 1. become a kid who has been playing for months ----------
        d.get("file://" + os.path.join(old, "index.html"))
        time.sleep(0.9)
        print("deployed schema version: %s" % d.execute_script("return Save._version;"))
        d.execute_script("""
            Save.reset();
            Save.createProfile('Real Kid', '🦖');
            Save.award(60000, 2400);
            Save.buy('world-cave'); Save.buy('world-sky');
            Save.buy('sword'); Save.buy('tunic'); Save.buy('chick'); Save.buy('coin');
            Save.buy('ipad'); Save.buy('ipad');
            Save.recordRunWon('math'); Save.recordRunWon('language');
            Save.recordQuestDone(0); Save.recordQuestDone(1);
            Save.remember('math', 'mul', 'expert');
            Save.setWorld('cave');
            for (var i = 0; i < 40; i++) Save.awardCard('m-slime', true);
            Save.awardCard('m-bat', true);
            Save.awardCard('l-imp', true);
            Save.recordAnswer(true); Save.recordAnswer(false); Save.recordAnswer(true);
        """)
        # walk a few stops, then stop on the next one — a boss, because a boss
        # is the step whose shape has changed the most since it shipped
        boss_at = d.execute_script("""
            var out = null;
            Save.mapTrail('big').forEach(function (s) {
                if (out === null && s.boss) out = s.i;
            });
            return out;
        """)
        for i in range(boss_at):
            d.execute_script("var i = arguments[0];"
                             "Save.startNode('big', i, 0); Save.completeNode();", i)
        d.execute_script("Save.startNode('big', arguments[0], 0);", boss_at)

        # what the deployed build says that armed stop is. The new build has to
        # agree, or a kid mid-battle lands in a different game after the deploy.
        old_node = d.execute_script(
            "var n = Save.activeNode();"
            "return n && { g: n.g, t: n.t, m: n.m, label: n.label };")
        blob = d.execute_script("return localStorage.getItem(Save._key);")
        was = json.loads(blob)
        kid = was["profiles"][was["active"]]
        print("saved: %d gold, %d XP, %d card kinds, stopped at big-trail step %d\n"
              % (kid["gold"], kid["xp"], len(kid["cards"]), boss_at))

        # ---------- 2. deploy happens: same save, new code ----------
        d.get("file://" + os.path.join(NEW, "index.html"))
        time.sleep(0.5)
        d.execute_script("localStorage.setItem(Save._key, arguments[0]);", blob)
        d.get("file://" + os.path.join(NEW, "index.html"))
        time.sleep(1.0)

        errs = d.execute_script("return window.__errors || [];")
        check("the new build loads the old save without erroring", not errs, str(errs))

        now = d.execute_script("return Save.me();")
        check("the hero is still there", bool(now) and now["name"] == kid["name"])
        check("the gold is untouched", now["gold"] == kid["gold"],
              "%s vs %s" % (now["gold"], kid["gold"]))
        check("the XP is untouched", now["xp"] == kid["xp"])
        check("the level is unchanged",
              d.execute_script("return Save.levelOf(Save.me()).level;") ==
              d.execute_script("return Save.levelOf(arguments[0]).level;", kid))
        for slot in ("weapon", "armor", "pet", "trinket"):
            check("the %s is still equipped" % slot,
                  now["inventory"][slot] == kid["inventory"][slot],
                  "%s vs %s" % (now["inventory"][slot], kid["inventory"][slot]))
        check("everything bought is still owned",
              sorted(now["inventory"]["owned"]) == sorted(kid["inventory"]["owned"]),
              str(sorted(now["inventory"]["owned"])))
        check("the iPad tokens survived",
              now["inventory"]["tokens"] == kid["inventory"]["tokens"])
        check("every card survived, counts and all",
              now["cards"] == kid["cards"], json.dumps(now["cards"]))
        check("the foils survived", now.get("foils") == kid.get("foils"))
        check("the unlocked worlds survived",
              now["progress"]["unlockedWorlds"] == kid["progress"]["unlockedWorlds"])
        check("the world they were fighting in survived",
              now["progress"]["world"] == kid["progress"]["world"])
        check("the map position is exactly where they left it",
              now["progress"]["map"] == kid["progress"]["map"],
              "%s vs %s" % (now["progress"]["map"], kid["progress"]["map"]))
        check("the roads already taken are still remembered",
              now["progress"]["mapPicks"] == kid["progress"]["mapPicks"])
        check("the quests done survived",
              now["progress"]["questsDone"] == kid["progress"]["questsDone"])
        check("the lifetime stats survived", now["stats"] == kid["stats"])
        check("the pity counter survived",
              now["progress"]["koSinceCard"] == kid["progress"]["koSinceCard"])
        check("the remembered track and mode survived",
              now["settings"] == kid["settings"])

        live = d.execute_script("return Save.activeNode();")
        check("the stop they were halfway through still resumes", live is not None)
        if live and old_node:
            check("...into the very same game, track and difficulty as before",
                  (live["g"], live["t"], live["m"]) ==
                  (old_node["g"], old_node["t"], old_node["m"]),
                  "was %s/%s/%s, now %s/%s/%s" %
                  (old_node["g"], old_node["t"], old_node["m"],
                   live["g"], live["t"], live["m"]))

        check("the save is stamped with the new schema",
              d.execute_script("return JSON.parse(localStorage.getItem(Save._key)).v;")
              == d.execute_script("return Save._version;"))
        # v4 gave heroes a row. This save was written before that existed, so
        # it has to come out with one read off the road behind them — and the
        # challenge of the day has to follow it.
        row = d.execute_script("return Save.rowOf();")
        walked = kid["progress"]["map"]
        check("the hero comes out knowing which kid they are",
              row in ("little", "big"), str(row))
        check("...and it matches the trail they had been walking",
              row == ("big" if walked["big"] > walked["little"] else "little"),
              "%s with map %s" % (row, walked))
        check("the challenge of the day is set on their own trail",
              d.execute_script(
                  "var x = Save.daily();"
                  "return Save.mapTrail(Save.heroTrail()).some(function (st) {"
                  "  return st.options.some(function (o) {"
                  "    return o.g === x.node.g && o.t === x.node.t && o.m === x.node.m;"
                  "  });"
                  "});"))

        check("anything new is present and empty rather than broken",
              d.execute_script("return Save.petStage() !== null"
                               " && Save.streak() === 0"
                               " && Save.daily() !== null;"))
        stamped = d.execute_script("return localStorage.getItem(Save._key);")
        d.get("file://" + os.path.join(NEW, "index.html"))
        time.sleep(0.8)
        check("loading it a second time changes nothing more",
              d.execute_script("return localStorage.getItem(Save._key);") == stamped)
    finally:
        d.quit()
        git("worktree", "remove", "--force", WORKTREE)
        shutil.rmtree(WORKTREE, ignore_errors=True)

    print("")
    if failures:
        print("%d UPGRADE CHECK(S) FAILED — do not deploy" % len(failures))
        sys.exit(1)
    print("An existing save survives this deploy intact.")


main()
