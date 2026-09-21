/* ==========================================================================
   draw.js — the pictures the test needs and the site has never drawn.

   Geometry, measurement and data are a third of MAP's maths and none of it
   exists anywhere else here: no shapes, no bar graphs, no number lines, no
   area grids, no rulers. Everything is inline SVG with no dependencies, sized
   in a viewBox so it scales to whatever the iPad gives it.

   One rule throughout: a figure must be readable in one glance at arm's
   length on a tablet. Thick strokes, large labels, high contrast, and no
   colour that carries meaning on its own -- a child who cannot tell the blue
   bar from the grey one must still be able to read the chart from its labels.
   ========================================================================== */

var Draw = (function () {
  'use strict';

  var INK = '#16202e';
  var LINE = '#8794aa';
  var FILL = '#bcd3f2';
  var FILL2 = '#f3c98b';
  var PAPER = '#ffffff';

  function svg(w, h, body, cls) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
           '" class="' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  }

  function txt(x, y, s, size, anchor, weight) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 16) +
           '" text-anchor="' + (anchor || 'middle') +
           '" font-family="Trebuchet MS, Segoe UI, system-ui, sans-serif"' +
           (weight ? ' font-weight="' + weight + '"' : '') +
           ' fill="' + INK + '">' + s + '</text>';
  }

  /* ---------- 2D shapes ---------------------------------------------------
     Every shape is drawn into a box of the given size so they can sit side by
     side as answer options and be compared fairly. `rot` turns the shape,
     which is the whole point of the "is this still a triangle?" items -- a
     child who only ever sees a triangle point-up has learned the picture and
     not the shape. */

  var POLY = {
    triangle: [[50, 8], [94, 88], [6, 88]],
    square: [[12, 12], [88, 12], [88, 88], [12, 88]],
    rectangle: [[6, 26], [94, 26], [94, 74], [6, 74]],
    rhombus: [[50, 6], [92, 50], [50, 94], [8, 50]],
    trapezoid: [[26, 18], [74, 18], [94, 82], [6, 82]],
    pentagon: [[50, 6], [95, 39], [78, 92], [22, 92], [5, 39]],
    hexagon: [[28, 10], [72, 10], [95, 50], [72, 90], [28, 90], [5, 50]],
    octagon: [[32, 6], [68, 6], [94, 32], [94, 68], [68, 94], [32, 94], [6, 68], [6, 32]],
    rightTriangle: [[10, 90], [10, 12], [90, 90]]
  };

  var SIDES = {
    circle: 0, oval: 0, triangle: 3, rightTriangle: 3, square: 4, rectangle: 4,
    rhombus: 4, trapezoid: 4, pentagon: 5, hexagon: 6, octagon: 8
  };

  var SHAPE_NAME = {
    circle: 'circle', oval: 'oval', triangle: 'triangle', rightTriangle: 'triangle',
    square: 'square', rectangle: 'rectangle', rhombus: 'rhombus',
    trapezoid: 'trapezoid', pentagon: 'pentagon', hexagon: 'hexagon',
    octagon: 'octagon'
  };

  function shape(kind, opts) {
    opts = opts || {};
    var size = opts.size || 100;
    var fill = opts.fill || FILL;
    var rot = opts.rot || 0;
    var body;
    if (kind === 'circle') {
      body = '<circle cx="50" cy="50" r="44" fill="' + fill + '" stroke="' + INK + '" stroke-width="3"/>';
    } else if (kind === 'oval') {
      body = '<ellipse cx="50" cy="50" rx="46" ry="30" fill="' + fill + '" stroke="' + INK + '" stroke-width="3"/>';
    } else {
      var pts = POLY[kind] || POLY.square;
      body = '<polygon points="' + pts.map(function (p) { return p.join(','); }).join(' ') +
             '" fill="' + fill + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
    }
    if (rot) body = '<g transform="rotate(' + rot + ' 50 50)">' + body + '</g>';
    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
           '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  }

  function sidesOf(kind) { return SIDES[kind]; }
  function nameOf(kind) { return SHAPE_NAME[kind]; }

  /* ---------- Position words ----------
     above / below / beside / between, drawn rather than described, because
     the word is exactly what is being tested. */
  function position(where) {
    var box = '<rect x="38" y="48" width="44" height="34" rx="4" fill="' + FILL2 +
              '" stroke="' + INK + '" stroke-width="3"/>';
    var ball = function (x, y) {
      return '<circle cx="' + x + '" cy="' + y + '" r="12" fill="' + FILL +
             '" stroke="' + INK + '" stroke-width="3"/>';
    };
    var b = { above: ball(60, 22), below: ball(60, 104), beside: ball(104, 65),
              inside: ball(60, 65), under: ball(60, 104) }[where] || ball(60, 22);
    return svg(130, 125, box + b);
  }

  /* ---------- Counters ----------
     Objects to be counted. Rows of at most 5 so a child can subitise, which
     is how the real test lays them out too. */
  function counters(n, emoji, perRow) {
    perRow = perRow || 5;
    var rows = [], i;
    for (i = 0; i < n; i++) {
      if (i % perRow === 0) rows.push([]);
      rows[rows.length - 1].push(emoji);
    }
    return '<div class="counters" style="flex-direction:column;align-items:center">' +
      rows.map(function (r) {
        return '<div class="grp">' + r.join('') + '</div>';
      }).join('') + '</div>';
  }

  /* Two labelled groups side by side, for more/fewer. */
  function groups(a, b, ea, eb, la, lb) {
    var one = function (n, e, l) {
      return '<div style="text-align:center"><div class="counters" style="max-width:190px">' +
             new Array(n + 1).join(e) + '</div>' +
             '<div class="small soft" style="margin-top:6px">' + l + '</div></div>';
    };
    return '<div style="display:flex;gap:28px;justify-content:center;align-items:flex-start">' +
           one(a, ea, la) + one(b, eb, lb) + '</div>';
  }

  /* ---------- Ten frame ----------
     The standard early-maths tool: two rows of five. Make-10 is unreadable
     without it and obvious with it. */
  function tenFrame(filled) {
    var cells = '', i, x, y;
    for (i = 0; i < 10; i++) {
      x = 6 + (i % 5) * 38;
      y = 6 + Math.floor(i / 5) * 38;
      cells += '<rect x="' + x + '" y="' + y + '" width="36" height="36" fill="' + PAPER +
               '" stroke="' + INK + '" stroke-width="2"/>';
      if (i < filled) {
        cells += '<circle cx="' + (x + 18) + '" cy="' + (y + 18) + '" r="12" fill="' + FILL + '"/>';
      }
    }
    return svg(202, 88, cells);
  }

  /* ---------- Bars of length ----------
     Longer / shorter / order by length. Drawn as real bars rather than emoji
     because two emoji at different font sizes are not a fair comparison --
     the child would be judging the picture, not the length. */
  function lengths(list, opts) {
    opts = opts || {};
    var w = 320, rowH = 34, pad = 8;
    var max = Math.max.apply(null, list.map(function (o) { return o.len; }));
    var body = '', y = pad;
    list.forEach(function (o) {
      var len = Math.round((o.len / max) * (w - 70));
      body += '<rect x="46" y="' + y + '" width="' + len + '" height="22" rx="4" fill="' +
              (o.fill || FILL) + '" stroke="' + INK + '" stroke-width="2"/>';
      body += txt(38, y + 18, o.label, 17, 'end', 'bold');
      y += rowH;
    });
    return svg(w, y + pad, body);
  }

  /* Vertical version, for taller/shorter. */
  function heights(list) {
    var h = 170, colW = 74, pad = 10;
    var max = Math.max.apply(null, list.map(function (o) { return o.len; }));
    var body = '', x = pad;
    list.forEach(function (o) {
      var ht = Math.round((o.len / max) * (h - 40));
      body += '<rect x="' + (x + 12) + '" y="' + (h - 24 - ht) + '" width="' + (colW - 24) +
              '" height="' + ht + '" rx="4" fill="' + (o.fill || FILL) +
              '" stroke="' + INK + '" stroke-width="2"/>';
      body += txt(x + colW / 2, h - 6, o.label, 16, 'middle', 'bold');
      x += colW;
    });
    body += '<line x1="4" y1="' + (h - 24) + '" x2="' + (x) + '" y2="' + (h - 24) +
            '" stroke="' + INK + '" stroke-width="2"/>';
    return svg(x + pad, h, body);
  }

  /* ---------- Bar graph ----------
     `step` is the scale of the axis. A scaled graph -- each mark worth 2 or 5
     -- is a third-grade skill in its own right, and a child who reads the bar
     rather than the axis gets it wrong, which is the point of the item. */
  function barGraph(data, opts) {
    opts = opts || {};
    var step = opts.step || 1;
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }));
    var top = Math.ceil(max / step) * step + (max % step === 0 ? step : 0);
    var h = 262, gw = 60, left = 50, base = h - 48;
    var body = '', i, y, x;
    for (i = 0; i <= top; i += step) {
      y = base - (i / top) * (base - 18);
      body += '<line x1="' + left + '" y1="' + y + '" x2="' + (left + data.length * gw + 8) +
              '" y2="' + y + '" stroke="#dbe2ec" stroke-width="1"/>';
      body += txt(left - 8, y + 6, String(i), 16, 'end');
    }
    data.forEach(function (d, k) {
      x = left + 10 + k * gw;
      var bh = (d.v / top) * (base - 18);
      body += '<rect x="' + x + '" y="' + (base - bh) + '" width="' + (gw - 20) + '" height="' + bh +
              '" fill="' + (d.fill || FILL) + '" stroke="' + INK + '" stroke-width="2"/>';
      body += txt(x + (gw - 20) / 2, base + 21, d.label, 17);
    });
    body += '<line x1="' + left + '" y1="' + base + '" x2="' + (left + data.length * gw + 8) +
            '" y2="' + base + '" stroke="' + INK + '" stroke-width="2.5"/>';
    body += '<line x1="' + left + '" y1="18" x2="' + left + '" y2="' + base +
            '" stroke="' + INK + '" stroke-width="2.5"/>';
    if (opts.title) body = txt((left + data.length * gw) / 2 + 20, 15, opts.title, 17, 'middle', 'bold') + body;
    return svg(left + data.length * gw + 20, h, body);
  }

  /* ---------- Pictograph ----------
     `each` is what one symbol is worth. Half symbols are deliberately not
     drawn: a half-emoji is unreadable, so the data is always whole multiples. */
  function pictograph(data, emoji, each) {
    var rows = data.map(function (d) {
      var n = Math.round(d.v / each);
      return '<div style="display:flex;align-items:center;gap:10px;margin:6px 0">' +
             '<div style="width:86px;text-align:right;font-size:15px">' + d.label + '</div>' +
             '<div style="font-size:26px;letter-spacing:3px">' + new Array(n + 1).join(emoji) + '</div>' +
             '</div>';
    }).join('');
    return '<div style="display:inline-block;text-align:left">' + rows +
           '<div class="small soft" style="margin-top:10px">Key: ' + emoji +
           ' = ' + each + '</div></div>';
  }

  /* ---------- Line plot ----------
     Xs over a number line, with halves and quarters -- the shape third grade
     actually meets, measuring things to the nearest quarter inch. */
  function linePlot(marks, from, to, stepLabel) {
    var w = 440, base = 130, left = 42;
    var span = to - from;
    var tick = (w - left * 2) / span;
    var body = '', v, x, i, n;
    body += '<line x1="' + left + '" y1="' + base + '" x2="' + (w - left + 10) + '" y2="' + base +
            '" stroke="' + INK + '" stroke-width="2.5"/>';
    for (v = 0; v <= span; v += 0.25) {
      x = left + v * tick;
      var major = Math.abs(v - Math.round(v)) < 0.001;
      body += '<line x1="' + x + '" y1="' + base + '" x2="' + x + '" y2="' + (base + (major ? 9 : 5)) +
              '" stroke="' + INK + '" stroke-width="2"/>';
      if (major) body += txt(x, base + 28, stepLabel ? stepLabel(from + v) : String(from + v), 17);
    }
    marks.forEach(function (m) {
      x = left + (m.v - from) * tick;
      for (i = 0, n = m.n; i < n; i++) {
        body += txt(x, base - 9 - i * 17, '&#215;', 21, 'middle', 'bold');
      }
    });
    return svg(w, base + 34, body);
  }

  /* ---------- Number line ----------
     Used both for whole numbers and for fractions, where the mark sits
     between the labelled ends and the child names it. */
  function numberLine(from, to, divisions, markAt, opts) {
    opts = opts || {};
    var w = 430, y = 52, left = 34, right = w - 34;
    var span = right - left;
    var body = '<line x1="' + left + '" y1="' + y + '" x2="' + right + '" y2="' + y +
               '" stroke="' + INK + '" stroke-width="2.5"/>';
    var i, x;
    for (i = 0; i <= divisions; i++) {
      x = left + (i / divisions) * span;
      body += '<line x1="' + x + '" y1="' + (y - 8) + '" x2="' + x + '" y2="' + (y + 8) +
              '" stroke="' + INK + '" stroke-width="2"/>';
    }
    body += txt(left, y + 30, opts.fromLabel != null ? opts.fromLabel : String(from), 19);
    body += txt(right, y + 30, opts.toLabel != null ? opts.toLabel : String(to), 19);
    if (markAt != null) {
      x = left + (markAt / divisions) * span;
      body += '<polygon points="' + x + ',' + (y - 4) + ' ' + (x - 9) + ',' + (y - 22) + ' ' +
              (x + 9) + ',' + (y - 22) + '" fill="#1d63c4"/>';
      if (opts.mark) body += txt(x, y - 27, opts.mark, 16, 'middle', 'bold');
    }
    return svg(w, y + 38, body);
  }

  /* ---------- Fraction bar / partitioned shape ----------
     `parts` equal pieces, `shaded` of them filled. Also draws unequal parts
     on purpose (`uneven`), because "which one shows fourths?" needs a wrong
     answer that is cut into four *unequal* pieces. */
  function fracBar(parts, shaded, opts) {
    opts = opts || {};
    var w = opts.w || 260, h = opts.h || 54;
    var body = '', i, x = 0, cw;
    var widths = [];
    if (opts.uneven) {
      var total = 0, r = [];
      for (i = 0; i < parts; i++) { r.push(0.6 + (i % 3) * 0.45); total += r[i]; }
      for (i = 0; i < parts; i++) widths.push((r[i] / total) * w);
    } else {
      for (i = 0; i < parts; i++) widths.push(w / parts);
    }
    for (i = 0; i < parts; i++) {
      cw = widths[i];
      body += '<rect x="' + x + '" y="0" width="' + cw + '" height="' + h + '" fill="' +
              (i < shaded ? FILL : PAPER) + '" stroke="' + INK + '" stroke-width="2.5"/>';
      x += cw;
    }
    return svg(w + 4, h + 4, '<g transform="translate(2,2)">' + body + '</g>');
  }

  /* A circle cut into equal wedges, for the same question in another costume. */
  function fracPie(parts, shaded) {
    var r = 44, cx = 50, cy = 50, body = '', i;
    for (i = 0; i < parts; i++) {
      var a0 = (i / parts) * Math.PI * 2 - Math.PI / 2;
      var a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      body += '<path d="M' + cx + ',' + cy + ' L' + x0 + ',' + y0 + ' A' + r + ',' + r +
              ' 0 ' + large + ' 1 ' + x1 + ',' + y1 + ' Z" fill="' +
              (i < shaded ? FILL : PAPER) + '" stroke="' + INK + '" stroke-width="2.5"/>';
    }
    if (parts === 1) {
      body = '<circle cx="50" cy="50" r="44" fill="' + (shaded ? FILL : PAPER) +
             '" stroke="' + INK + '" stroke-width="2.5"/>';
    }
    return svg(104, 104, body);
  }

  /* ---------- Area grid ----------
     Unit squares to be counted, and rectilinear L-shapes for the harder item.
     `cells` is a list of [col,row] that are part of the figure. */
  function areaGrid(cols, rows, cells, opts) {
    opts = opts || {};
    var u = opts.unit || 34, body = '', c, r, on;
    var inFig = {};
    if (cells) cells.forEach(function (p) { inFig[p[0] + ',' + p[1]] = 1; });
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        on = cells ? inFig[c + ',' + r] : 1;
        if (!on && cells) continue;
        body += '<rect x="' + (c * u) + '" y="' + (r * u) + '" width="' + u + '" height="' + u +
                '" fill="' + FILL + '" stroke="' + INK + '" stroke-width="2"/>';
      }
    }
    return svg(cols * u + 4, rows * u + 4, '<g transform="translate(2,2)">' + body + '</g>');
  }

  /* A plain rectangle with its two side lengths written on it -- perimeter
     and area-by-multiplying, where there is nothing to count. */
  function labelledRect(w, h, unit) {
    var sc = Math.min(26, 190 / Math.max(w, h));
    var pw = Math.max(70, w * sc), ph = Math.max(46, h * sc);
    var body = '<rect x="30" y="18" width="' + pw + '" height="' + ph + '" fill="' + FILL +
               '" stroke="' + INK + '" stroke-width="3"/>';
    body += txt(30 + pw / 2, 12, w + ' ' + unit, 16, 'middle', 'bold');
    body += txt(24, 18 + ph / 2 + 5, h + ' ' + unit, 16, 'end', 'bold');
    return svg(pw + 44, ph + 30, body);
  }

  /* ---------- Clock ----------
     The hour hand moves with the minutes, because a clock whose hour hand
     sits exactly on the 3 at 3:45 teaches a lie the child has to unlearn. */
  function clock(h24, min) {
    var cx = 78, cy = 78, r = 68, body = '', i, a, x1, y1, x2, y2;
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + PAPER +
            '" stroke="' + INK + '" stroke-width="3"/>';
    for (i = 0; i < 60; i++) {
      a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      var inner = i % 5 === 0 ? r - 8 : r - 4;
      x1 = cx + inner * Math.cos(a); y1 = cy + inner * Math.sin(a);
      x2 = cx + (r - 1) * Math.cos(a); y2 = cy + (r - 1) * Math.sin(a);
      body += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
              '" stroke="' + INK + '" stroke-width="' + (i % 5 === 0 ? 2.5 : 1) + '"/>';
    }
    for (i = 1; i <= 12; i++) {
      a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      body += txt(cx + (r - 26) * Math.cos(a), cy + (r - 26) * Math.sin(a) + 6, String(i), 16, 'middle', 'bold');
    }
    var hr = (h24 % 12) + min / 60;
    var ha = (hr / 12) * Math.PI * 2 - Math.PI / 2;
    var ma = (min / 60) * Math.PI * 2 - Math.PI / 2;
    body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 36 * Math.cos(ha)) +
            '" y2="' + (cy + 36 * Math.sin(ha)) + '" stroke="' + INK +
            '" stroke-width="6.5" stroke-linecap="round"/>';
    body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 54 * Math.cos(ma)) +
            '" y2="' + (cy + 54 * Math.sin(ma)) + '" stroke="#1d63c4' +
            '" stroke-width="4" stroke-linecap="round"/>';
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + INK + '"/>';
    return svg(156, 156, body);
  }

  /* ---------- Ruler ----------
     An object laid against an inch ruler with quarter-inch ticks. The object
     always starts at 0, because "it does not start at zero" is a different
     and much later skill. */
  function ruler(lengthQuarters, opts) {
    opts = opts || {};
    var inches = opts.inches || 6;
    var u = 62, left = 24, top = 38, h = 50;
    var w = left * 2 + inches * u;
    var body = '<rect x="' + left + '" y="' + top + '" width="' + (inches * u) + '" height="' + h +
               '" fill="#fdf6e3" stroke="' + INK + '" stroke-width="2"/>';
    var i, x;
    for (i = 0; i <= inches * 4; i++) {
      x = left + (i / 4) * u;
      var big = i % 4 === 0, half = i % 2 === 0;
      body += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' +
              (top + (big ? 20 : half ? 14 : 9)) + '" stroke="' + INK + '" stroke-width="' +
              (big ? 2 : 1.4) + '"/>';
      if (big) body += txt(x, top + 42, String(i / 4), 16);
    }
    var len = (lengthQuarters / 4) * u;
    body += '<rect x="' + left + '" y="8" width="' + len + '" height="22" rx="4" fill="' + FILL2 +
            '" stroke="' + INK + '" stroke-width="2"/>';
    return svg(w, top + h + 14, body);
  }

  /* ---------- Angles ----------
     The vertex sits well inside the box rather than in its corner. The first
     version put it at the left edge with a 92-long arm, so an obtuse angle's
     second ray ran clean off the canvas and was drawn as a clipped stub --
     which made "obtuse" the one option a child could not actually see. */
  function angle(deg) {
    var cx = 96, cy = 132, len = 104;
    var a = -deg * Math.PI / 180;
    var ray = function (x, y) {
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y +
             '" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
    };
    var body = ray(cx + len, cy);
    body += ray(cx + len * Math.cos(a), cy + len * Math.sin(a));
    body += '<path d="M' + (cx + 34) + ',' + cy + ' A34,34 0 0 0 ' +
            (cx + 34 * Math.cos(a)).toFixed(1) + ',' + (cy + 34 * Math.sin(a)).toFixed(1) +
            '" fill="none" stroke="#1d63c4" stroke-width="3"/>';
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + INK + '"/>';
    return svg(250, 160, body);
  }

  /* A shape with one dashed line drawn on it -- a fold line that either is or
     is not a line of symmetry. */
  function symmetry(kind, ok) {
    var s = shape(kind, { size: 110 });
    var line = ok
      ? '<line x1="55" y1="2" x2="55" y2="108" stroke="#1d63c4" stroke-width="3" stroke-dasharray="7 5"/>'
      /* Deliberately nowhere near a diagonal: the rhombus and the square both
         DO have diagonal lines of symmetry, so a dashed line drawn corner to
         corner would make a distractor quietly correct. This one misses the
         centre entirely. */
      : '<line x1="26" y1="2" x2="76" y2="108" stroke="#1d63c4" stroke-width="3" stroke-dasharray="7 5"/>';
    return '<span style="position:relative;display:inline-block">' + s +
           '<svg viewBox="0 0 110 110" width="110" height="110" style="position:absolute;left:0;top:0"' +
           ' xmlns="http://www.w3.org/2000/svg">' + line + '</svg></span>';
  }

  /* ---------- Arrays ----------
     Rows and columns of dots: the picture that turns repeated addition into
     multiplication. */
  function array(cols, rows) {
    var u = 32, body = '', c, r;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        body += '<circle cx="' + (c * u + 16) + '" cy="' + (r * u + 16) + '" r="11" fill="' + FILL +
                '" stroke="' + INK + '" stroke-width="2"/>';
      }
    }
    return svg(cols * u + 2, rows * u + 2, body);
  }

  /* Equal groups drawn as rings of objects -- the step before an array. */
  function equalGroups(n, per, emoji) {
    var one = '<span style="display:inline-block;border:2px dashed #8794aa;border-radius:40px;' +
              'padding:8px 12px;margin:5px;font-size:26px;letter-spacing:2px">' +
              new Array(per + 1).join(emoji) + '</span>';
    return '<div>' + new Array(n + 1).join(one) + '</div>';
  }

  return {
    shape: shape, sidesOf: sidesOf, nameOf: nameOf, SHAPES: SIDES,
    position: position, counters: counters, groups: groups, tenFrame: tenFrame,
    lengths: lengths, heights: heights, barGraph: barGraph, pictograph: pictograph,
    linePlot: linePlot, numberLine: numberLine, fracBar: fracBar, fracPie: fracPie,
    areaGrid: areaGrid, labelledRect: labelledRect, clock: clock, ruler: ruler,
    angle: angle, symmetry: symmetry, array: array, equalGroups: equalGroups
  };
})();
