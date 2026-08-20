/* ==========================================================================
   The hero, drawn.

   Everywhere else in this site the hero is a name and a number. Here they are
   a figure you can look at, wearing the things you actually bought — helm,
   weapon, armour, boots, and the pet trotting alongside.

   Emoji are the art, as everywhere else, so this is a paper doll: a base
   figure with smaller pieces positioned on top of it. That keeps it working
   from file://, needs no asset pipeline, and means new gear draws itself the
   moment it exists.

   Hero.draw(el, opts) fills `el`. Hero.face(el, dir) turns them around.
   ========================================================================== */
var Hero = (function () {
  'use strict';

  var styled = false;

  function css() {
    if (styled) return;
    styled = true;
    var s = document.createElement('style');
    s.textContent = [
      /* Everything is anchored to the FLOOR, not to the top of the box, and
         every piece deliberately overlaps the body. The first version hung
         each piece off its own edge and the result read as five emoji
         standing near each other rather than one character wearing things. */
      '.hero-fig{position:relative;width:86px;height:98px;',
      '  display:block;pointer-events:none;user-select:none}',
      '.hero-fig>span{position:absolute;left:50%;line-height:1;',
      '  filter:drop-shadow(0 3px 4px rgba(0,0,0,.6))}',
      '.hero-fig .h-body{bottom:8px;transform:translateX(-50%);font-size:48px;z-index:2}',
      /* on the chest, over the body */
      '.hero-fig .h-armor{bottom:20px;transform:translateX(-50%);font-size:23px;',
      '  opacity:.95;z-index:3}',
      /* on the head: overlaps the top of the body rather than floating above */
      '.hero-fig .h-helm{bottom:42px;transform:translateX(-52%);font-size:24px;z-index:4}',
      /* held out to the side, at hand height */
      '.hero-fig .h-weapon{left:auto;right:0;bottom:18px;font-size:27px;z-index:4;',
      '  transform:rotate(-24deg);transform-origin:50% 80%}',
      '.hero-fig .h-boots{bottom:0;transform:translateX(-50%);font-size:20px;z-index:3}',
      /* trotting alongside, on the same floor line */
      '.hero-fig .h-pet{left:0;bottom:2px;transform:translateX(-10%);font-size:22px;z-index:1}',
      /* facing left mirrors the whole figure, so the weapon swaps hands */
      '.hero-fig.left{transform:scaleX(-1)}',
      /* a gentle idle bob, off for anyone who asked for less motion */
      '@keyframes heroBob{0%,100%{translate:0 0}50%{translate:0 -3px}}',
      '.hero-fig .h-body,.hero-fig .h-armor,.hero-fig .h-helm,.hero-fig .h-weapon',
      '  {animation:heroBob 2.4s ease-in-out infinite}',
      '@media (prefers-reduced-motion:reduce){.hero-fig *{animation:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* What the hero is wearing right now, as emoji. Reads the loadout the games
     already use, so anything that changes gear changes the picture. */
  function kit() {
    var me = (typeof Save !== 'undefined' && Save.me()) || null;
    var out = { body: '🧍', helm: '', weapon: '', armor: '', boots: '', pet: '' };
    if (!me) return out;
    out.body = me.avatar || '🧍';

    var l = Save.loadout();
    var inv = me.inventory || {};
    var w = Save.item(inv.weapon);
    var a = Save.item(inv.armor);
    var h = Save.item(inv.helm);
    var b = Save.item(inv.boots);

    /* The item, not the slash it makes. They are the same for most weapons,
       but the Wooden Stick's slash is 💥 — an explosion floating in your hand
       rather than the stick you are actually holding. */
    if (w) out.weapon = w.emoji || l.slash || '';
    // the starter kit is deliberately invisible: a cloth tunic is not a look
    if (a && a.bonusHp) out.armor = a.emoji || '';
    if (h && (h.fastBonus || h.bonusHp)) out.helm = h.emoji || '';
    if (b && (b.bonusTime || b.goldBonus)) out.boots = b.emoji || '';
    if (l.pet) out.pet = l.pet;
    return out;
  }

  function draw(el, opts) {
    if (!el) return null;
    css();
    opts = opts || {};
    var k = opts.kit || kit();
    el.className = 'hero-fig' + (opts.className ? ' ' + opts.className : '');
    var parts = '';
    if (k.pet && opts.pet !== false) parts += '<span class="h-pet">' + k.pet + '</span>';
    if (k.armor) parts += '<span class="h-armor">' + k.armor + '</span>';
    parts += '<span class="h-body">' + k.body + '</span>';
    if (k.boots) parts += '<span class="h-boots">' + k.boots + '</span>';
    if (k.helm) parts += '<span class="h-helm">' + k.helm + '</span>';
    if (k.weapon) parts += '<span class="h-weapon">' + k.weapon + '</span>';
    el.innerHTML = parts;
    if (opts.scale) el.style.zoom = opts.scale;
    return el;
  }

  function face(el, dir) {
    if (!el) return;
    if (dir === 'left') el.classList.add('left');
    if (dir === 'right') el.classList.remove('left');
  }

  return { draw: draw, face: face, kit: kit };
})();
