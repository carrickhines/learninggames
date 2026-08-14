/* ==========================================================================
   Hud — the little "who's playing / how rich am I" chip that every game wears,
   plus the 🏠 link back to the hub.

   Games call Hud.mount() once at load. If nobody has picked a hero yet, it
   sends the player to the hub instead — the games need an active profile to
   have anywhere to put the gold.

   Usage:
     Hud.mount({ home: '../index.html' });
     Hud.render();                        // after gold or XP changes
     Hud.gained(6);                       // float "+6" off the chip
   ========================================================================== */

var Hud = (function () {
  'use strict';

  var el = null;
  var opts = { home: '../index.html' };

  function css() {
    if (document.getElementById('hud-style')) return;
    var s = document.createElement('style');
    s.id = 'hud-style';
    s.textContent = [
      '.hud{position:absolute;top:12px;left:12px;z-index:20;display:flex;align-items:center;',
      'gap:8px;padding:6px 12px 6px 8px;border-radius:24px;background:var(--panel);',
      'border:1px solid rgba(255,255,255,.14);box-shadow:0 4px 0 rgba(0,0,0,.35),0 6px 14px rgba(0,0,0,.3);',
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:var(--display);',
      'font-size:15px;color:#fff;line-height:1;text-decoration:none;cursor:pointer;',
      'transition:transform .08s,filter .15s}',
      '.hud:hover{filter:brightness(1.12)}',
      '.hud:active{transform:translateY(2px)}',
      '.hud .face{font-size:22px}',
      '.hud .nm{max-width:9ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.hud .coins{color:var(--gold);text-shadow:0 2px 3px rgba(0,0,0,.5)}',
      '.hud .home{opacity:.6;font-size:15px}',
      /* a run's earnings float up off the chip */
      '.hud-float{position:absolute;top:44px;left:20px;z-index:21;font-family:var(--display);',
      'font-size:20px;font-weight:bold;color:var(--gold);pointer-events:none;',
      'text-shadow:0 2px 5px rgba(0,0,0,.7);animation:hudFloat 1.1s ease forwards}',
      '@keyframes hudFloat{0%{opacity:0;transform:translateY(0) scale(.7)}',
      '20%{opacity:1;transform:translateY(-4px) scale(1.15)}',
      '100%{opacity:0;transform:translateY(-40px) scale(1)}}',
      /* the level-up banner */
      '.levelup{position:absolute;inset:0;z-index:30;display:flex;align-items:center;',
      'justify-content:center;pointer-events:none;background:rgba(10,5,20,.45)}',
      '.levelup .card{font-family:var(--display);text-align:center;padding:24px 40px;',
      'border-radius:24px;background:linear-gradient(180deg,#ffe27a,var(--accent));color:var(--ink);',
      'box-shadow:0 10px 0 var(--accent-2),0 20px 40px rgba(0,0,0,.5);animation:luPop .5s ease}',
      '.levelup .big{font-size:52px;line-height:1}',
      '.levelup .small{font-size:19px;margin-top:4px}',
      '.levelup .cardget{padding:18px 34px}',
      '.levelup .cardget .mon{font-size:70px;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}',
      '.levelup .cardget .small{font-size:16px;letter-spacing:2px;text-transform:uppercase;opacity:.85}',
      '.levelup .cardget .big2{font-size:28px;line-height:1.1}',
      '@keyframes luPop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Build the chip. Returns false (and redirects) if no hero is active. */
  function mount(o) {
    if (o && o.home) opts.home = o.home;
    if (!Save.me()) { location.replace(opts.home); return false; }
    css();
    el = document.createElement('a');
    el.className = 'hud';
    el.href = opts.home;
    el.title = 'Back to the hub';
    document.getElementById('app').appendChild(el);
    render();
    return true;
  }

  function render() {
    if (!el) return;
    var me = Save.me();
    if (!me) return;
    el.innerHTML =
      '<span class="face">' + me.avatar + '</span>' +
      '<span class="nm"></span>' +
      '<span class="coins">🪙 ' + me.gold + '</span>' +
      '<span class="home">🏠</span>';
    el.querySelector('.nm').textContent = me.name;   // never trust a typed name in HTML
  }

  /* Float "+N 🪙" off the chip and refresh it. */
  function gained(gold) {
    render();
    if (!gold || !el) return;
    var f = document.createElement('div');
    f.className = 'hud-float';
    f.textContent = '+' + gold + ' 🪙';
    document.getElementById('app').appendChild(f);
    setTimeout(function () { f.remove(); }, 1100);
  }

  /* "You caught a card!" — the drop moment. `how` is 'new' or 'dupe'. */
  function cardDrop(card, how) {
    if (!card || !how) return;
    Sound.cardGet();
    var box = document.createElement('div');
    box.className = 'levelup';
    box.innerHTML = '<div class="card cardget">' +
      '<div class="mon">' + card.emoji + '</div>' +
      '<div class="small">' + (how === 'new' ? 'NEW CARD!' : 'Another one!') + '</div>' +
      '<div class="big2"></div></div>';
    box.querySelector('.big2').textContent = card.name;
    document.getElementById('app').appendChild(box);
    setTimeout(function () { box.remove(); }, 1800);
  }

  /* A full-screen "LEVEL 4!" moment. Brief, and it blocks nothing. */
  function levelUp(level) {
    render();
    Sound.levelUp();
    var box = document.createElement('div');
    box.className = 'levelup';
    box.innerHTML = '<div class="card"><div class="big">⭐ LEVEL ' + level + '!</div>' +
                    '<div class="small">You are getting stronger!</div></div>';
    document.getElementById('app').appendChild(box);
    setTimeout(function () { box.remove(); }, 1800);
  }

  /* The one call a game makes after any scoring event: hand it whatever
     Save.award()/awardEvent() returned and the HUD does the rest. */
  function applied(result) {
    if (!result) return;
    if (result.gold) gained(result.gold);
    else render();
    if (result.leveledTo) levelUp(result.leveledTo);
  }

  return {
    mount: mount,
    render: render,
    gained: gained,
    levelUp: levelUp,
    cardDrop: cardDrop,
    applied: applied
  };
})();
