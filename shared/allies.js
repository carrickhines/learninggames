/* ==========================================================================
   Wild allies — monsters that join the fight

   A monster you beat sometimes decides it likes you and fights at your side
   for the rest of the run, standing behind the hero and swinging alongside
   your hits. It's likelier if you already hold its card, so the collection
   pays off in the moment as well as at the trader — collecting a monster is
   befriending it.

   They last the run and no longer. Nothing permanent means no power creep,
   and every run gets its own shape.

   The odds and the damage live in shared/save.js (`rollAlly`, `allyStrikes`)
   so both battle games are tuned from one place. This file is only the arena
   UI: the row of sprites, the pop when one joins, the flash when one lands a
   blow. Both games call the same four functions.
   ========================================================================== */

var Allies = (function () {
  'use strict';

  var list = [];
  var row = null;

  /* Start a run — allies last the run and no longer. */
  function reset() {
    list = [];
    row = document.getElementById('allies');
    render();
  }

  /* The row is shared with the shop pet, which sits in it as a permanent
     first member — so redraw by removing only the allies, never the row. */
  function render() {
    if (!row) return;
    Array.prototype.slice.call(row.querySelectorAll('.ally'))
      .forEach(function (el) { row.removeChild(el); });
    list.forEach(function (a) {
      var span = document.createElement('span');
      span.className = 'ally';
      span.textContent = a.emoji;
      span.title = a.name;
      row.appendChild(span);
    });
  }

  /* Take on an ally. Returns it, or null if there was none to take. */
  function add(ally) {
    if (!ally) return null;
    list.push(ally);
    render();
    return ally;
  }

  function all() { return list.slice(); }
  function count() { return list.length; }

  /* Roll each ally's swing alongside yours. Returns the extra damage, and
     flashes the ones that actually connected so the number is explained. */
  function strike() {
    if (!list.length) return 0;
    var extra = 0;
    var sprites = row ? row.querySelectorAll('.ally') : [];
    list.forEach(function (a, i) {
      if (!Save.allyStrikes([a])) return;
      extra++;
      var sprite = sprites[i];
      if (!sprite) return;
      sprite.classList.remove('strike');
      // reflow, or re-adding the class in the same frame won't replay it
      void sprite.offsetWidth;
      sprite.classList.add('strike');
      setTimeout(function () { sprite.classList.remove('strike'); }, 500);
    });
    return extra;
  }

  return { reset: reset, add: add, all: all, count: count, strike: strike };
})();
