/* HUBS site behaviour. Vanilla, no dependencies.
   Content for the exchange and the scale explorer arrives as JSON payloads
   rendered by Eleventy, so editing them means editing YAML, never this file. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function payload(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  /* ---- Title card -------------------------------------------------- */
  (function () {
    var card = document.getElementById("card");
    if (!card) return;

    var skip = document.getElementById("skip");
    var dismissed = false;
    var autoTimer = null;

    Array.prototype.forEach.call(card.querySelectorAll(".card__phrase span"),
      function (w, i) { w.style.animationDelay = (110 + i * 105) + "ms"; });

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(autoTimer);
      try { sessionStorage.setItem("hubs-card-seen", "1"); } catch (e) { /* private mode */ }
      document.documentElement.classList.add("curtain-out");
      setTimeout(function () {
        document.documentElement.classList.remove("curtain", "curtain-out");
      }, 950);
    }

    if (document.documentElement.classList.contains("curtain")) {
      autoTimer = setTimeout(dismiss, 3000);
      if (skip) skip.addEventListener("click", dismiss);
      card.addEventListener("click", dismiss);
      // Any key, scroll or touch releases it — never trap the visitor.
      window.addEventListener("keydown", dismiss, { once: true });
      window.addEventListener("wheel", dismiss, { once: true, passive: true });
      window.addEventListener("touchstart", dismiss, { once: true, passive: true });
    }
  })();

  /* ---- Replay the title card from the wordmark ---------------------
     The card is suppressed after the first view so ordinary navigation
     isn't interrupted. Clicking the HUBS wordmark clears that, so there
     is always a deliberate way back to the front door.                  */
  (function () {
    var mark = document.querySelector("[data-replay-intro]");
    if (!mark) return;
    mark.addEventListener("click", function () {
      try { sessionStorage.removeItem("hubs-card-seen"); } catch (e) { /* private mode */ }
    });
  })();

  /* ---- Navigation -------------------------------------------------- */
  (function () {
    var toggle = document.querySelector(".navToggle");
    var nav = document.getElementById("nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.dataset.open = String(open);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false); toggle.focus();
      }
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 900) setOpen(false); });
  })();

  /* ---- Theme ------------------------------------------------------- */
  (function () {
    var btn = document.getElementById("themeBtn");
    if (!btn) return;

    var stored = null;
    try { stored = localStorage.getItem("hubs-theme"); } catch (e) { /* private mode */ }
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }

    function isLight() {
      var explicit = document.documentElement.getAttribute("data-theme");
      return explicit ? explicit === "light"
                      : window.matchMedia("(prefers-color-scheme: light)").matches;
    }

    // The button names the theme you would switch TO.
    btn.textContent = isLight() ? "Dark" : "Light";

    btn.addEventListener("click", function () {
      var next = isLight() ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      btn.textContent = next === "light" ? "Dark" : "Light";
      try { localStorage.setItem("hubs-theme", next); } catch (e) { /* ignore */ }
    });
  })();

  /* ---- Scroll to top ----------------------------------------------- */
  (function () {
    var toTop = document.querySelector(".toTop");
    if (!toTop) return;

    var ticking = false;
    function update() { toTop.dataset.visible = String(window.scrollY > 500); ticking = false; }

    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });

    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
    update();
  })();

  /* ---- The exchange (Fig. 1) --------------------------------------- */
  (function () {
    var data = payload("exchange-data");
    var rowsEl = document.getElementById("rows");
    if (!data || !rowsEl) return;

    var STEPS  = data.steps || [];
    var FIELDS = data.fields || [];

    var COL  = { human: 1, ai: 3, bldg: 5 };
    var NAME = { human: "Human", ai: "AI", bldg: "Building" };

    var axisMid = rowsEl.querySelector(".axisMid");
    var readout = document.getElementById("readout");
    var dotsEl  = document.getElementById("dots");
    var nextBtn = document.getElementById("next");
    var prevBtn = document.getElementById("prev");

    var branch = null, cursor = 0, timer = null;

    // What the visitor is currently looking at, so render() can tell a row that
    // is arriving for the first time from one that is already on screen.
    var shownCount = 0, shownBranch = null;

    function active() {
      return STEPS.filter(function (s) { return !s.branch || s.branch === branch; });
    }

    function choiceIndex(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].kind === "choice") return i;
      }
      return -1;
    }

    function buildRow(s) {
      var row = document.createElement("div");
      row.className = "row";
      row.setAttribute("data-kind", s.kind);

      if (s.kind === "choice") {
        row.classList.add("choice");
        var box = document.createElement("div");
        box.className = "choice__in";

        var q = document.createElement("p");
        q.className = "choice__q";
        q.textContent = s.prompt || "Your reply";

        var opts = document.createElement("div");
        opts.className = "choice__opts";

        (s.options || []).forEach(function (o) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "opt";
          // textContent for the label keeps YAML content out of the HTML parser.
          b.appendChild(document.createTextNode(o.label));
          var note = document.createElement("b");
          note.textContent = o.note || "";
          b.appendChild(note);
          b.addEventListener("click", function () {
            branch = o.go;
            // The choice stays on screen after the exchange has run, so the
            // visitor can come back and pick the other reply. Rewind to the
            // choice rather than trusting where the cursor happens to be —
            // left at the end of the old branch, the new one would be drawn
            // in a single frame instead of playing out.
            var at = choiceIndex(active());
            cursor = at > -1 ? at + 1 : cursor + 1;   // consume the choice row
            render();
            // Pick the rhythm back up rather than dumping the reply instantly:
            // a beat, then the remaining steps play at reading pace as before.
            if (reduced) { advance(false); return; }
            schedule(750);
          });
          opts.appendChild(b);
        });

        box.appendChild(q); box.appendChild(opts); row.appendChild(box);
        return row;
      }

      row.setAttribute("data-from", s.from);

      var who = s.kind === "act"   ? "Physical action"
              : s.kind === "tele"  ? "Telemetry"
              : s.kind === "think" ? "AI reasoning"
              : NAME[s.from];

      var bubble = document.createElement("div");
      bubble.className = "bubble";

      var whoEl = document.createElement("span");
      whoEl.className = "who";
      whoEl.textContent = who;
      bubble.appendChild(whoEl);
      bubble.appendChild(document.createTextNode(s.text));

      if (s.tag) {
        var pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = s.tag;
        bubble.appendChild(pill);
      }

      if (s.kind === "act") { row.appendChild(bubble); return row; }

      row.appendChild(bubble);

      if (s.to) {
        // Gap 1 sits between human and AI, gap 2 between AI and building.
        var gap = Math.min(COL[s.from], COL[s.to]) === 1 ? 1 : 2;
        var arrow = document.createElement("div");
        arrow.className = "arrow";
        arrow.setAttribute("data-gap", String(gap));
        arrow.textContent = COL[s.to] > COL[s.from] ? "→" : "←";
        row.appendChild(arrow);
      }
      return row;
    }

    var valEls = {};
    FIELDS.forEach(function (f) {
      var ro = document.createElement("div");
      ro.className = "ro";

      var k = document.createElement("span");
      k.className = "ro__k";
      k.textContent = f.label;

      var v = document.createElement("span");
      v.className = "ro__v";
      var num = document.createElement("b");
      num.style.fontWeight = "400";
      v.appendChild(num);
      if (f.unit) {
        var u = document.createElement("u");
        u.textContent = " " + f.unit;
        v.appendChild(u);
      }

      ro.appendChild(k); ro.appendChild(v);
      readout.appendChild(ro);
      valEls[f.key] = num;
    });

    // Recompute from the start each time so Back and re-branching stay honest.
    function paintState(list, n) {
      var st = {};
      FIELDS.forEach(function (f) { st[f.key] = f.init; });
      for (var i = 0; i < n; i++) {
        if (list[i].state) {
          Object.keys(list[i].state).forEach(function (k) { st[k] = list[i].state[k]; });
        }
      }
      Object.keys(valEls).forEach(function (k) {
        var el = valEls[k];
        if (el.textContent !== st[k]) {
          el.textContent = st[k];
          var p = el.parentNode;
          p.classList.add("flash");
          setTimeout(function () { p.classList.remove("flash"); }, 700);
        }
      });
    }

    function render() {
      var list = active();

      /* Every row is rebuilt from scratch, which would restart the entrance
         animation on the whole transcript each step. Rows the visitor has
         already watched arrive are marked settled so only genuinely new ones
         animate. Switching branch keeps the shared prologue settled too — the
         steps up to and including the choice are the same either way. */
      var settled = Math.min(shownCount, cursor);
      if (branch !== shownBranch) settled = Math.min(settled, choiceIndex(list) + 1);

      rowsEl.textContent = "";
      if (axisMid) rowsEl.appendChild(axisMid);   // the centre axis is not a step
      list.slice(0, cursor).forEach(function (s, i) {
        var row = buildRow(s);
        if (i < settled) row.classList.add("row--settled");
        rowsEl.appendChild(row);
      });
      shownCount = cursor;
      shownBranch = branch;

      dotsEl.textContent = "";
      list.forEach(function (_, i) {
        var d = document.createElement("span");
        d.className = "dot";
        d.setAttribute("data-on", String(i < cursor));
        dotsEl.appendChild(d);
      });

      paintState(list, cursor);

      var atChoice = cursor > 0 && list[cursor - 1] && list[cursor - 1].kind === "choice";
      var atStart = cursor === 0;
      prevBtn.disabled = atStart;
      nextBtn.disabled = atChoice;
      nextBtn.textContent = atStart ? "▶  Run the exchange"
                          : cursor >= list.length ? "↻  Replay" : "Next";
      // Only loud before the first press; after that it is just another control.
      nextBtn.dataset.primary = String(atStart);
    }

    function stop() { if (timer) { clearTimeout(timer); timer = null; } }

    /* ---- Never grow while nobody is watching --------------------------
       Each arriving row is 70–200px tall on a phone and pushes the whole
       page below it down — the scale explorer drifts over 1,100px during a
       single run. Chrome and Firefox absorb that with scroll anchoring; iOS
       Safari has none, so the page crawls under the reader's thumb. The
       auto-play therefore holds whenever the figure is off screen and picks
       up where it left off on the way back. Manual Next and Back are never
       blocked — those are deliberate, and the visitor is looking at it. */
    var stage = rowsEl.closest(".stageWrap") || rowsEl;

    function onScreen() {
      var r = stage.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
    }

    // Visibility is tested when the step falls due, not when it is booked, so
    // someone who scrolls away mid-beat is caught too. Off screen it simply
    // looks again shortly — waiting on a scroll event would mean trusting the
    // event to arrive, and a rect read every 800ms costs nothing.
    function schedule(ms) {
      stop();
      timer = setTimeout(function () {
        timer = null;
        if (!onScreen()) { schedule(800); return; }
        advance(true);
      }, ms);
    }

    function advance(auto) {
      var list = active();
      if (cursor >= list.length) {
        if (auto) { stop(); return; }
        cursor = 0; branch = null; render(); return;
      }
      cursor++;
      render();

      var shown = list[cursor - 1];
      if (auto && shown.kind !== "choice" && cursor < list.length) {
        schedule(Math.min(4200, 1000 + (shown.text || "").length * 20));
      } else {
        stop();
      }
    }

    nextBtn.addEventListener("click", function () {
      var starting = cursor === 0;
      stop();
      advance(starting && !reduced);
    });

    prevBtn.addEventListener("click", function () {
      stop();
      if (cursor > 0) cursor--;
      var choiceAt = choiceIndex(active());
      if (branch && choiceAt > -1 && cursor <= choiceAt) branch = null;
      render();
    });

    render();
  })();

  /* ---- Floor plan ⇄ zone cards -------------------------------------
     Highlighting runs both ways: point at a room in the plan and its card
     lights up, point at a card and the room does.                        */
  (function () {
    var rooms = [].slice.call(document.querySelectorAll(".plan__room[data-zone]"));
    var cards = [].slice.call(document.querySelectorAll(".zoneCard[data-zone]"));
    if (!rooms.length || !cards.length) return;

    function setActive(zone) {
      rooms.concat(cards).forEach(function (el) {
        el.classList.toggle("is-on", !!zone && el.dataset.zone === zone);
      });
    }

    rooms.concat(cards).forEach(function (el) {
      var zone = el.dataset.zone;
      el.addEventListener("mouseenter", function () { setActive(zone); });
      el.addEventListener("focus", function () { setActive(zone); });
      el.addEventListener("mouseleave", function () { setActive(null); });
      el.addEventListener("blur", function () { setActive(null); });
    });

    // On a touch screen there is no hover, so tapping a room scrolls to its card.
    rooms.forEach(function (room) {
      room.addEventListener("click", function () {
        var card = document.querySelector('.zoneCard[data-zone="' + room.dataset.zone + '"]');
        if (!card) return;
        setActive(room.dataset.zone);
        if (window.innerWidth <= 900) {
          card.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        }
      });
      room.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); room.click(); }
      });
    });
  })();

  /* ---- Scale visualisation -----------------------------------------
     One particle field that reorganises across the five scales: the same
     matter seen at body, room, building, feeder and city resolution.
     Colour migrates amber → violet as the human recedes and the building
     comes to dominate.                                                   */
  var scaleViz = (function () {
    var canvas = document.getElementById("scaleCanvas");
    if (!canvas || !canvas.getContext) return { go: function () {} };

    var ctx = canvas.getContext("2d");
    var N = 170;
    var DUR = 850;

    // Deterministic noise, so the composition is designed rather than random.
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    var rnd = mulberry32(20260803);
    var noise = [];
    for (var i = 0; i < N * 4; i++) noise.push(rnd());
    var nz = function (i, k) { return noise[(i * 4 + k) % noise.length]; };

    function css(name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }
    function toRGB(c) {
      if (c.charAt(0) === "#") {
        var h = c.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      var m = c.match(/(\d+(\.\d+)?)/g);
      return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
    }
    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    function rgba(c, a) {
      return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";
    }

    var HUMAN, AI, BLDG, LINE;
    function readTheme() {
      HUMAN = toRGB(css("--human", "#e8a04c"));
      AI    = toRGB(css("--ai", "#3ecfd4"));
      BLDG  = toRGB(css("--bldg", "#ab8df0"));
      LINE  = toRGB(css("--hairline", "#38342e"));
    }
    readTheme();

    /* ---- Layouts. Each returns {x, y, r} in normalised [0,1]. -------- */
    function gauss(i, k) {
      // Box–Muller from the deterministic noise table.
      var u = Math.max(1e-6, nz(i, k)), v = nz(i, k + 1);
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Grid-scale buildings — deliberately mismatched footprints and heights.
    // Shared by the particle layout and the structure drawing so they agree.
    var GROUND = 0.88;
    var GRID_B = [
      { x: 0.06, w: 0.15, h: 0.24, pv: false },
      { x: 0.245, w: 0.10, h: 0.42, pv: true  },
      { x: 0.375, w: 0.19, h: 0.28, pv: false },
      { x: 0.60,  w: 0.11, h: 0.50, pv: false },
      { x: 0.745, w: 0.20, h: 0.20, pv: true  }
    ];

    var LAYOUTS = [
      // 0 · Body — a thermal field around one person
      function (i) {
        var a = nz(i, 0) * Math.PI * 2;
        var d = Math.abs(gauss(i, 1)) * 0.16;
        return { x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d * 1.15,
                 r: 1.5 + 3.2 * Math.max(0, 1 - d / 0.2) };
      },
      // 1 · Room — seven occupants on a floor
      function (i) {
        var g = i % 7, per = 0.115;
        return { x: 0.17 + g * per + gauss(i, 0) * 0.018,
                 y: 0.63 + gauss(i, 2) * 0.05,
                 r: 1.4 + nz(i, 3) * 1.6 };
      },
      // 2 · Building — five stacked floors
      function (i) {
        var f = i % 5;
        return { x: 0.34 + nz(i, 0) * 0.32,
                 y: 0.24 + f * 0.13 + gauss(i, 1) * 0.012,
                 r: 1.3 + nz(i, 2) * 1.5 };
      },
      // 3 · Grid — buildings of different shapes on a distribution network
      function (i) {
        var b = GRID_B[i % GRID_B.length];
        return { x: b.x + 0.012 + nz(i, 0) * (b.w - 0.024),
                 y: GROUND - 0.015 - nz(i, 1) * (b.h - 0.03),
                 r: 1.1 + nz(i, 2) * 1.3 };
      },
      // 4 · City — a plan-view field of blocks
      function (i) {
        var col = i % 9, row = Math.floor(i / 9) % 8;
        return { x: 0.08 + col * 0.105 + gauss(i, 0) * 0.014,
                 y: 0.12 + row * 0.1 + gauss(i, 1) * 0.014,
                 r: 1.0 + nz(i, 2) * 1.1 };
      }
    ];

    /* ---- Colour ------------------------------------------------------
       A three-stop ramp: human amber → AI cyan → building violet. Every
       stop is vivid, so the middle of the range never goes muddy.

       TINT is where a scale sits on that ramp. SPREAD is how far apart the
       individuals within it are pushed — it opens up at ROOM scale, because
       that is the first moment there is more than one person in the frame
       and no two of them want the same thing.                            */
    var TINT   = [0.05, 0.30, 0.55, 0.76, 0.86];
    var SPREAD = [0.08, 0.42, 0.32, 0.30, 0.36];

    // A minority of particles stay at the human end of the ramp at every scale
    // above the body. Zooming out does not remove the people — it only makes
    // them smaller and harder to pick out, which is the point.
    var HUMAN_SHARE = [0, 0, 0.10, 0.15, 0.22];

    // Which group a particle belongs to at each scale — occupants in a room,
    // floors in a building, buildings on a feeder, blocks in a city.
    var GROUP = [
      function () { return 0; },
      function (i) { return i % 7; },
      function (i) { return i % 5; },
      function (i) { return i % GRID_B.length; },
      function (i) { return (i % 9) * 8 + (Math.floor(i / 9) % 8); }
    ];

    function tintFor(k, i) {
      // The households still in there, whatever the zoom level.
      if (nz(i * 13 + 5, 2) < HUMAN_SHARE[k]) {
        return 0.02 + nz(i * 7 + 1, 3) * 0.16;
      }
      var g = GROUP[k](i);
      var individual = nz(g * 31 + 7, 0);       // stable per group, not per frame
      var t = TINT[k] + (individual - 0.5) * SPREAD[k];
      return t < 0 ? 0 : (t > 1 ? 1 : t);
    }

    function ramp(t) {
      return t < 0.5 ? mix(HUMAN, AI, t * 2) : mix(AI, BLDG, (t - 0.5) * 2);
    }

    /* ---- Structure drawn under the particles ------------------------ */
    function structure(k, alpha, w, h, S) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rgba(LINE, 1);
      ctx.lineWidth = 1;
      var X = function (v) { return v * w; }, Y = function (v) { return v * h; };

      if (k === 0) {
        ctx.strokeStyle = rgba(AI, 0.35);
        [0.17, 0.26].forEach(function (rr) {
          ctx.beginPath();
          ctx.arc(X(0.5), Y(0.5), rr * Math.min(w, h), 0, Math.PI * 2);
          ctx.stroke();
        });
      } else if (k === 1) {
        ctx.strokeStyle = rgba(BLDG, 0.5);
        ctx.strokeRect(X(0.1), Y(0.2), X(0.8), Y(0.55));
      } else if (k === 2) {
        ctx.strokeStyle = rgba(BLDG, 0.5);
        ctx.strokeRect(X(0.3), Y(0.16), X(0.4), Y(0.68));
        ctx.strokeStyle = rgba(BLDG, 0.28);
        for (var f = 1; f < 5; f++) {
          ctx.beginPath();
          ctx.moveTo(X(0.3), Y(0.16 + f * 0.136)); ctx.lineTo(X(0.7), Y(0.16 + f * 0.136));
          ctx.stroke();
        }
      } else if (k === 3) {
        // Ground
        ctx.strokeStyle = rgba(LINE, 1);
        ctx.beginPath();
        ctx.moveTo(X(0.02), Y(GROUND)); ctx.lineTo(X(0.98), Y(GROUND));
        ctx.stroke();

        // Buildings — varied footprints, some with rooftop PV
        ctx.strokeStyle = rgba(BLDG, 0.5);
        GRID_B.forEach(function (b) {
          ctx.strokeRect(X(b.x), Y(GROUND - b.h), X(b.w), Y(b.h));
          if (b.pv) {
            ctx.save();
            ctx.strokeStyle = rgba(AI, 0.55);
            ctx.beginPath();
            ctx.moveTo(X(b.x + 0.012), Y(GROUND - b.h - 0.035));
            ctx.lineTo(X(b.x + b.w - 0.012), Y(GROUND - b.h - 0.065));
            ctx.stroke();
            ctx.restore();
          }
        });

        // Distribution feeder — a line across the top with poles, not a hub
        var fy = 0.13;
        ctx.strokeStyle = rgba(AI, 0.45);
        ctx.beginPath();
        ctx.moveTo(X(0.02), Y(fy)); ctx.lineTo(X(0.98), Y(fy));
        ctx.stroke();
        [0.16, 0.47, 0.82].forEach(function (px) {
          ctx.beginPath();
          ctx.moveTo(X(px), Y(fy - 0.035)); ctx.lineTo(X(px), Y(fy + 0.035));
          ctx.stroke();
        });

        // Service drops. Building index 3 has none — it is fed by its neighbour.
        ctx.strokeStyle = rgba(AI, 0.3);
        GRID_B.forEach(function (b, bi) {
          if (bi === 3) return;
          var cx = b.x + b.w / 2;
          ctx.beginPath();
          ctx.moveTo(X(cx), Y(fy));
          ctx.lineTo(X(cx), Y(GROUND - b.h));
          ctx.stroke();
        });

        // Peer exchange between two buildings — the grid is not only radial
        ctx.save();
        ctx.setLineDash([4 * S, 4 * S]);
        ctx.strokeStyle = rgba(HUMAN, 0.5);
        var a2 = GRID_B[2], a3 = GRID_B[3];
        ctx.beginPath();
        ctx.moveTo(X(a2.x + a2.w), Y(GROUND - a2.h + 0.05));
        ctx.lineTo(X(a3.x), Y(GROUND - a3.h + 0.12));
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = rgba(BLDG, 0.22);
        for (var gx = 1; gx < 9; gx++) {
          ctx.beginPath();
          ctx.moveTo(X(0.02 + gx * 0.107), Y(0.06)); ctx.lineTo(X(0.02 + gx * 0.107), Y(0.94));
          ctx.stroke();
        }
        for (var gy = 1; gy < 8; gy++) {
          ctx.beginPath();
          ctx.moveTo(X(0.04), Y(0.06 + gy * 0.11)); ctx.lineTo(X(0.96), Y(0.06 + gy * 0.11));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* ---- State ------------------------------------------------------ */
    var cur = LAYOUTS[0].bind(null);
    var from = [], to = [], t = 1, current = 0, previous = 0, startTime = 0, raf = null;

    function snapshot(fn) {
      var out = [];
      for (var i = 0; i < N; i++) out.push(fn(i));
      return out;
    }
    from = snapshot(LAYOUTS[0]);
    to = from;

    var W = 0, H = 0, S = 1;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height; S = dpr;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

    function draw(now) {
      if (!W) resize();
      ctx.clearRect(0, 0, W, H);

      var k = t >= 1 ? 1 : ease(t);
      // Structure cross-fades; particles interpolate position and size.
      structure(previous, 1 - k, W, H, 1);
      structure(current, k, W, H, 1);

      for (var i = 0; i < N; i++) {
        var a = from[i], b = to[i];
        var wobble = reduced ? 0 : Math.sin((now || 0) / 2600 + i) * 0.0016;
        var x = (a.x + (b.x - a.x) * k + wobble) * W;
        var y = (a.y + (b.y - a.y) * k) * H;
        var r = (a.r + (b.r - a.r) * k) * Math.min(1.4, W / 380);

        // Colour is per particle, not per scale, so individuals stay distinct.
        var tp = tintFor(previous, i), tc = tintFor(current, i);
        var c = ramp(tp + (tc - tp) * k);
        ctx.fillStyle = rgba(c, 0.42 + nz(i, 1) * 0.45);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop(now) {
      if (t < 1) {
        t = Math.min(1, (now - startTime) / DUR);
        draw(now);
        raf = requestAnimationFrame(loop);
      } else if (!reduced) {
        draw(now);
        raf = requestAnimationFrame(loop);
      } else {
        draw(now);
        raf = null;
      }
    }

    function go(i) {
      if (i === current && t >= 1) return;
      previous = current;
      current = i;
      from = snapshot(function (n) {
        var a = from[n], b = to[n], k = t >= 1 ? 1 : ease(t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, r: a.r + (b.r - a.r) * k };
      });
      to = snapshot(LAYOUTS[i]);
      t = reduced ? 1 : 0;
      startTime = performance.now();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", function () { resize(); draw(performance.now()); }, { passive: true });

    // Repaint in the new palette when the viewer flips the theme.
    new MutationObserver(function () {
      readTheme();
      draw(performance.now());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    resize();
    to = snapshot(LAYOUTS[0]);
    from = to;
    t = 1;
    raf = requestAnimationFrame(loop);

    return { go: go };
  })();

  /* ---- Scale explorer ---------------------------------------------- */
  (function () {
    var data = payload("scales-data");
    var panel = document.getElementById("panel");
    if (!data || !panel) return;

    /* Scoped to this explorer's own tablist. A bare ".seg" also matches
       any other segmented control on the page, and the two strips then
       wire each other's buttons. */
    var segs = [].slice.call(
      document.querySelectorAll('[aria-label="Research scale"] .seg'));

    function fill(el, d) {
      el.textContent = "";

      var meta = document.createElement("p");
      meta.className = "scaleMeta";
      meta.textContent = d.metric;

      var h = document.createElement("h3");
      h.textContent = d.title;

      var p = document.createElement("p");
      p.textContent = d.text;

      var ul = document.createElement("ul");
      (d.points || []).forEach(function (x) {
        var li = document.createElement("li");
        li.textContent = x;
        ul.appendChild(li);
      });

      var tri = document.createElement("span");
      tri.className = "triangleNote";
      tri.textContent = d.triangle;

      el.appendChild(meta); el.appendChild(h); el.appendChild(p);
      el.appendChild(ul); el.appendChild(tri);
    }

    function show(i) {
      segs.forEach(function (s, k) { s.setAttribute("aria-selected", String(k === i)); });
      scaleViz.go(i);
      fill(panel, data[i]);
    }

    /* ---- Hold the panel at the height of its tallest scale ------------
       Below 880px the panel is the only thing under the canvas, so a scale
       with fewer bullets used to shorten the whole document — the page moved
       under the visitor mid-tap, and near the bottom the browser clamped the
       scroll position and it read as a jump. Measuring beats hard-coding a
       height: the reserve follows the YAML, so editing a scale cannot make it
       wrong. An off-screen copy does the measuring so the real panel never
       flickers through four other scales to get there. */
    var ghost = document.createElement("div");
    ghost.className = "panel";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
    document.body.appendChild(ghost);

    function reserve() {
      panel.style.minHeight = "";
      ghost.style.width = panel.getBoundingClientRect().width + "px";
      var tallest = 0;
      data.forEach(function (d) {
        fill(ghost, d);
        tallest = Math.max(tallest, ghost.getBoundingClientRect().height);
      });
      panel.style.minHeight = Math.ceil(tallest) + "px";
    }

    segs.forEach(function (s) {
      s.addEventListener("click", function () { show(parseInt(s.dataset.i, 10)); });
    });
    show(0);
    reserve();

    // Web fonts land after first paint and change the wrap points, so measure
    // again once they have. Not fatal if unsupported — the first pass stands.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);

    var reserveTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(reserveTimer);
      reserveTimer = setTimeout(reserve, 150);
    }, { passive: true });
  })();
})();
