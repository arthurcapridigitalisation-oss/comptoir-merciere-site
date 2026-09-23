/*
 * Galerie "éventail" (fan carousel) — port en JavaScript pur du composant
 * React card-fan-carousel (GSAP). Amélioration progressive : sans JS, avec
 * prefers-reduced-motion ou sans GSAP, la grille classique .gallery-grid reste affichée.
 */
(function () {
  "use strict";

  var container = document.getElementById("galleryFan");
  if (!container || typeof window.gsap === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var gsap = window.gsap;
  var cards = Array.prototype.slice.call(container.querySelectorAll(".fan-card"));
  var totalCards = cards.length;
  if (!totalCards) return;

  var MAX_VISIBLE = 7;
  var HALF = 3;

  var FAN_POSITIONS = [
    { rot: -21, scale: 0.7756, x: -30, y: 7.3, zIndex: 1 },
    { rot: -14, scale: 0.8498, x: -22, y: 4.0, zIndex: 2 },
    { rot: -7,  scale: 0.9346, x: -11, y: 1.3, zIndex: 3 },
    { rot: 0,   scale: 1.0,    x: 0,   y: 0.0, zIndex: 10 },
    { rot: 7,   scale: 0.9346, x: 11,  y: 1.3, zIndex: 3 },
    { rot: 14,  scale: 0.8498, x: 22,  y: 4.0, zIndex: 2 },
    { rot: 21,  scale: 0.7756, x: 30,  y: 7.3, zIndex: 1 }
  ];

  function getResponsiveMultiplier(width) {
    if (width < 480) return 0.28;
    if (width < 640) return 0.38;
    if (width < 768) return 0.5;
    if (width < 1024) return 0.75;
    if (width < 1280) return 0.85;
    return 1.0;
  }

  // Réduit les décalages verticaux quand la fenêtre est trop basse pour la mise en page idéale
  function getHeightMultiplier(width) {
    var idealPx;
    if (width < 480) idealPx = 22 * 16;
    else if (width < 640) idealPx = 26 * 16;
    else if (width < 768) idealPx = 28 * 16;
    else if (width < 1024) idealPx = 34 * 16;
    else idealPx = 38 * 16;
    var available = window.innerHeight * 0.85;
    return available >= idealPx ? 1 : available / idealPx;
  }

  function getSlotConfig(count, slot) {
    if (count >= MAX_VISIBLE) return FAN_POSITIONS[slot];
    var center = count >> 1;
    var distance = count > 1 ? (slot - center) / center : 0;
    var abs = Math.abs(distance);
    return {
      rot: distance * 21,
      scale: 1.0 - 0.2244 * abs * abs,
      x: distance * 30,
      y: abs * abs * 7.3,
      zIndex: 10 - Math.abs(slot - center)
    };
  }

  var needsPagination = totalCards > MAX_VISIBLE;
  var centerIndex = needsPagination ? HALF : totalCards >> 1;
  var isAnimating = false;
  var hasEntered = false;
  var direction = null;
  var prevVisible = new Set();
  var cleanup = null;

  function getVisibleMap(center) {
    var map = new Map();
    if (!needsPagination) {
      cards.forEach(function (_, i) { map.set(i, i); });
      return map;
    }
    for (var slot = 0; slot < MAX_VISIBLE; slot++) {
      map.set((((center + slot - HALF) % totalCards) + totalCards) % totalCards, slot);
    }
    return map;
  }

  function render() {
    if (cleanup) cleanup();

    var visibleMap = getVisibleMap(centerIndex);
    var previouslyVisible = prevVisible;
    var isFirstMount = !hasEntered;
    var multiplier = getResponsiveMultiplier(window.innerWidth);
    var hMult = getHeightMultiplier(window.innerWidth);
    var slotCount = needsPagination ? MAX_VISIBLE : totalCards;
    var config = function (slot) { return getSlotConfig(slotCount, slot); };

    if (isFirstMount) isAnimating = true;

    var completed = 0;
    var visibleCount = visibleMap.size;
    var onCardDone = function () {
      if (++completed >= visibleCount) {
        isAnimating = false;
        if (isFirstMount) hasEntered = true;
      }
    };

    cards.forEach(function (card, cardIndex) {
      var slot = visibleMap.get(cardIndex);
      var wasVisible = previouslyVisible.has(cardIndex);

      if (slot !== undefined) {
        var c = config(slot);
        var target = {
          x: c.x * multiplier + "rem",
          y: c.y * hMult + "rem",
          rotation: c.rot,
          scale: c.scale,
          opacity: 1,
          zIndex: c.zIndex
        };
        if (isFirstMount) {
          gsap.set(card, { x: 0, y: 12 * hMult + "rem", rotation: 0, scale: 0.5, opacity: 0 });
          gsap.to(card, Object.assign({}, target, {
            duration: 1.2, ease: "elastic.out(1.05,.78)", delay: 0.2 + slot * 0.06, onComplete: onCardDone
          }));
        } else if (!wasVisible) {
          var enterX = direction === "right" ? 40 : -40;
          gsap.set(card, { x: enterX + "rem", y: c.y * hMult + "rem", rotation: direction === "right" ? 30 : -30, scale: 0.5, opacity: 0 });
          gsap.to(card, Object.assign({}, target, { duration: 0.6, ease: "power2.out", onComplete: onCardDone }));
        } else {
          gsap.to(card, Object.assign({}, target, { duration: 0.5, ease: "power2.out", onComplete: onCardDone }));
        }
      } else if (wasVisible) {
        var exitX = direction === "right" ? -40 : 40;
        gsap.to(card, { x: exitX + "rem", opacity: 0, scale: 0.5, rotation: direction === "right" ? -30 : 30, duration: 0.4, ease: "power2.in", zIndex: 0 });
      } else if (isFirstMount) {
        gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 });
      }
    });

    prevVisible = new Set(visibleMap.keys());

    // Interactions au survol
    var entries = [];
    cards.forEach(function (el, i) {
      var slot = visibleMap.get(i);
      if (slot !== undefined) entries.push({ el: el, slot: slot });
    });
    entries.sort(function (a, b) { return a.slot - b.slot; });

    var activeSlot = null;
    var leaveTimer = null;
    var centerSlot = entries.length >> 1;

    function updateHoverLayout(hoveredSlot) {
      var mult = getResponsiveMultiplier(window.innerWidth);
      var hM = getHeightMultiplier(window.innerWidth);

      entries.forEach(function (entry) {
        var el = entry.el, slot = entry.slot;
        var base = config(slot);
        var tx = base.x * mult, ty = base.y * hM, tr = base.rot, ts = base.scale, delay = 0;

        if (hoveredSlot !== null) {
          var distance = Math.abs(slot - hoveredSlot);
          delay = distance * 0.02;
          if (slot === hoveredSlot) {
            ty -= 2.5 * hM;
            ts *= 1.08;
          } else {
            var normalized = centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0;
            var push = 8 * (1 - Math.abs(normalized)) * (1 + 0.2 * Math.max(0, 3 - distance));
            if (slot < hoveredSlot) { tx -= push * mult; tr -= 3 / (distance + 1); }
            else { tx += push * mult; tr += 3 / (distance + 1); }
            if (slot === entries.length - 1 && hoveredSlot < centerSlot) ty -= 1 * hM;
            if (slot === 0 && hoveredSlot > centerSlot) ty -= 1 * hM;
          }
        } else {
          delay = Math.abs(slot - centerSlot) * 0.02;
        }

        gsap.to(el, {
          x: tx + "rem", y: ty + "rem", rotation: tr, scale: ts,
          duration: 0.5, delay: delay, ease: "elastic.out(1,.75)", overwrite: "auto"
        });
        gsap.set(el, { zIndex: base.zIndex });
      });
    }

    var handlers = entries.map(function (entry) {
      var handler = function () {
        if (isAnimating) return;
        if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
        if (activeSlot !== entry.slot) { activeSlot = entry.slot; updateHoverLayout(entry.slot); }
      };
      entry.el.addEventListener("mouseenter", handler);
      entry.el.addEventListener("focus", handler);
      return { el: entry.el, handler: handler };
    });

    var onLeave = function () {
      if (isAnimating) return;
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () { activeSlot = null; updateHoverLayout(null); }, 50);
    };
    container.addEventListener("mouseleave", onLeave);

    var onResize = function () { if (!isAnimating) updateHoverLayout(activeSlot); };
    window.addEventListener("resize", onResize);

    cleanup = function () {
      handlers.forEach(function (h) {
        h.el.removeEventListener("mouseenter", h.handler);
        h.el.removeEventListener("focus", h.handler);
      });
      container.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }

  // Pagination (flèches + points) si plus de 7 photos
  var dots = [];
  function updateDots() {
    dots.forEach(function (d, i) { d.classList.toggle("is-active", i === centerIndex); });
  }
  function cycle(dir) {
    if (isAnimating || !needsPagination) return;
    isAnimating = true;
    direction = dir;
    centerIndex = dir === "right" ? (centerIndex + 1) % totalCards : (centerIndex - 1 + totalCards) % totalCards;
    updateDots();
    render();
  }

  if (needsPagination) {
    var nav = document.createElement("div");
    nav.className = "fan-nav";
    var mk = function (dir, label, points) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fan-arrow";
      b.setAttribute("aria-label", label);
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="' + points + '"/></svg>';
      b.addEventListener("click", function () { cycle(dir); });
      return b;
    };
    var dotsWrap = document.createElement("div");
    dotsWrap.className = "fan-dots";
    cards.forEach(function () {
      var s = document.createElement("span");
      dotsWrap.appendChild(s);
      dots.push(s);
    });
    nav.appendChild(mk("left", "Photo précédente", "15 18 9 12 15 6"));
    nav.appendChild(dotsWrap);
    nav.appendChild(mk("right", "Photo suivante", "9 18 15 12 9 6"));
    container.parentNode.appendChild(nav);
    updateDots();
  }

  // Active le mode éventail et lance l'animation d'entrée quand la galerie devient visible
  container.classList.add("fan-layout");
  cards.forEach(function (card) { gsap.set(card, { opacity: 0 }); });

  var started = false;
  function start() {
    if (started) return;
    started = true;
    render();
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (items) {
      if (items.some(function (i) { return i.isIntersecting; })) { io.disconnect(); start(); }
    }, { threshold: 0.25 });
    io.observe(container);
  } else {
    start();
  }
})();
