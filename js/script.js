(function () {
  "use strict";

  // Année dynamique du footer
  document.querySelectorAll("#year").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Hauteur réelle du header, utilisée pour l'offset du sommaire sticky de la carte
  var header = document.querySelector(".site-header");
  function updateHeaderHeight() {
    if (!header) return;
    document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }
  updateHeaderHeight();
  window.addEventListener("resize", updateHeaderHeight);

  // Menu mobile
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("navMenu");
  var scrim = document.getElementById("navScrim");

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("is-open");
    scrim.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }

  function openMenu() {
    menu.classList.add("is-open");
    scrim.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var isOpen = menu.classList.contains("is-open");
      isOpen ? closeMenu() : openMenu();
    });
    scrim.addEventListener("click", closeMenu);
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  // Carte Google Maps chargée uniquement sur consentement explicite (RGPD)
  var loadMapBtn = document.getElementById("loadMapBtn");
  var mapFrame = document.getElementById("mapFrame");
  var mapConsent = document.getElementById("mapConsent");

  if (loadMapBtn && mapFrame) {
    loadMapBtn.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.google.com/maps?q=49+Rue+Merci%C3%A8re,+69002+Lyon&output=embed";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.title = "Localisation du Comptoir Mercière, 49 Rue Mercière, Lyon";
      iframe.setAttribute("allowfullscreen", "");
      mapConsent.remove();
      mapFrame.appendChild(iframe);
    });
  }

  // Hero vidéo drone piloté par le scroll (repli statique par défaut, voir CSS)
  (function initDroneHero() {
    var section = document.getElementById("accueil");
    var video = document.getElementById("droneVideo");
    var content = document.getElementById("droneContent");
    var hint = document.getElementById("droneHint");
    if (!section || !video || !section.classList.contains("drone-hero")) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    var slowData = !!(conn && (conn.saveData || /^(slow-2g|2g|3g)$/.test(conn.effectiveType || "")));

    // En mode réduit / données économisées : on garde le repli statique (poster + contenu visible).
    if (reduceMotion || slowData) return;

    // Injecte les sources vidéo seulement maintenant, pour ne rien télécharger dans les cas ci-dessus.
    var srcMobile = document.createElement("source");
    srcMobile.src = video.dataset.srcMobile;
    srcMobile.type = "video/mp4";
    srcMobile.media = "(max-width: 768px)";
    var srcDesktop = document.createElement("source");
    srcDesktop.src = video.dataset.src;
    srcDesktop.type = "video/mp4";
    video.appendChild(srcMobile);
    video.appendChild(srcDesktop);
    video.preload = "auto";
    video.load();

    section.classList.add("drone-hero--scrub");

    // Header masqué pendant l'animation drone, il réapparaît avec le contenu du hero
    var siteHeader = document.querySelector(".site-header");
    var headerHidden = true;
    document.documentElement.classList.add("drone-mode");
    if (siteHeader) siteHeader.classList.add("is-hidden");

    var SMOOTHING = 0.12;
    var duration = 0, target = 0, current = 0, raf = 0;
    var REVEAL_START = 0.7, REVEAL_END = 0.95;

    function onMeta() {
      duration = video.duration || 0;
      video.play().then(function () { video.pause(); }).catch(function () {});
    }
    video.addEventListener("loadedmetadata", onMeta);
    if (video.readyState >= 1) onMeta();

    function computeTarget() {
      var rect = section.getBoundingClientRect();
      var total = section.offsetHeight - window.innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    }
    window.addEventListener("scroll", computeTarget, { passive: true });
    window.addEventListener("resize", computeTarget);
    computeTarget();

    function tick() {
      current += (target - current) * SMOOTHING;
      if (duration && Math.abs(video.currentTime - current * duration) > 0.001) {
        video.currentTime = current * duration;
      }
      var t = Math.min(1, Math.max(0, (current - REVEAL_START) / (REVEAL_END - REVEAL_START)));
      if (content) {
        content.style.opacity = String(t);
        content.style.transform = "translateY(" + (1 - t) * 24 + "px)";
        content.style.pointerEvents = t > 0.9 ? "auto" : "none";
      }
      if (hint) hint.style.opacity = String(Math.max(0, 1 - current * 6));
      var shouldHide = current < REVEAL_START;
      if (siteHeader && shouldHide !== headerHidden) {
        headerHidden = shouldHide;
        siteHeader.classList.toggle("is-hidden", shouldHide);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  })();

  // Bandeau d'information cookies (pas de tracking, information simple)
  var banner = document.getElementById("cookieBanner");
  var cookieOk = document.getElementById("cookieOk");
  var STORAGE_KEY = "cm_cookie_notice_seen";

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* noop */ }
  }

  if (banner) {
    if (!safeStorageGet(STORAGE_KEY)) {
      window.setTimeout(function () { banner.classList.add("is-visible"); }, 600);
    }
    if (cookieOk) {
      cookieOk.addEventListener("click", function () {
        banner.classList.remove("is-visible");
        safeStorageSet(STORAGE_KEY, "1");
      });
    }
  }
})();
