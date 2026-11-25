/* ============================================================
   اجتماع أولياء الأمور — محرك العرض
   تنقّل يدوي + فهرس + نافذة العرض الحالي كملء للفراغ
   ============================================================ */
(() => {
  "use strict";

  const deck = document.getElementById("meeting");
  const scenes = Array.from(deck.querySelectorAll(".scene"));
  const N = scenes.length;
  const loader = document.getElementById("loader");
  const loadBar = document.getElementById("loadBar");
  const rail = document.getElementById("rail");
  const sceneNo = document.getElementById("sceneNo");
  const chapterLabel = document.getElementById("chapterLabel");
  const indexPanel = document.getElementById("indexPanel");
  const indexList = document.getElementById("indexList");
  const overlay = document.getElementById("deckOverlay");
  const overlayFrame = document.getElementById("deckFrame");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const LEAVE_MS = 1400;

  let index = 0;
  let started = false;

  scenes.forEach(s => s.style.setProperty("--dur", (parseInt(s.dataset.dur, 10) || 9000) + "ms"));

  /* ---------- rail ---------- */
  scenes.forEach(() => {
    const seg = document.createElement("span");
    seg.className = "seg";
    seg.appendChild(document.createElement("b"));
    rail.appendChild(seg);
  });
  const segs = Array.from(rail.children);
  segs.forEach((seg, k) => {
    seg.addEventListener("click", e => { e.stopPropagation(); go(k); });
  });

  /* ---------- index ---------- */
  const indexItems = scenes.map((s, k) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mindex__item";
    item.dataset.go = String(k);
    item.innerHTML =
      `<span class="mindex__n">${String(k + 1).padStart(2, "0")}</span>` +
      `<span class="mindex__t"><b>${s.dataset.title || ""}</b><span>${s.dataset.chapter || ""}</span></span>` +
      `<span class="mindex__go"><svg class="ico" viewBox="0 0 24 24"><use href="#i-next"/></svg></span>`;
    item.addEventListener("click", () => { closeIndex(); go(k); });
    indexList.appendChild(item);
    return item;
  });

  /* ---------- navigation ---------- */
  function go(n) {
    const next = ((n % N) + N) % N;
    const prev = scenes[index];
    if (next === index && started) {
      clearTimeout(prev._leaveTimer);
      prev.classList.remove("is-leaving");
      prev.classList.remove("is-active");
      void prev.offsetWidth;
      prev.classList.add("is-active");
    } else {
      prev.classList.remove("is-active");
      if (started) {
        prev.classList.add("is-leaving");
        clearTimeout(prev._leaveTimer);
        prev._leaveTimer = setTimeout(() => {
          if (!prev.classList.contains("is-active")) prev.classList.remove("is-leaving");
        }, LEAVE_MS);
      }
      index = next;
      const cur = scenes[index];
      clearTimeout(cur._leaveTimer);
      cur.classList.remove("is-leaving");
      cur.classList.add("is-active");
    }
    started = true;

    segs.forEach((s, k) => {
      s.classList.toggle("is-now", k === index);
      s.classList.toggle("is-done", k <= index);
    });
    indexItems.forEach((it, k) => {
      it.classList.toggle("is-current", k === index);
      it.setAttribute("aria-current", k === index ? "true" : "false");
    });

    sceneNo.innerHTML = `${index + 1} <b>/</b> ${N}`;

    const chapter = scenes[index].dataset.chapter || "";
    if (chapterLabel.textContent !== chapter) {
      chapterLabel.textContent = chapter;
      chapterLabel.classList.remove("is-swap");
      void chapterLabel.offsetWidth;
      chapterLabel.classList.add("is-swap");
    }
    deck.dataset.scene = String(index + 1);
    scenes.forEach((s, k) => s.setAttribute("aria-hidden", k === index ? "false" : "true"));
  }

  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  /* ---------- fullscreen ---------- */
  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  /* ---------- index panel ---------- */
  function openIndex() {
    closeOverlay();
    indexPanel.classList.add("is-open");
    indexPanel.setAttribute("aria-hidden", "false");
  }
  function closeIndex() {
    indexPanel.classList.remove("is-open");
    indexPanel.setAttribute("aria-hidden", "true");
  }
  const toggleIndex = () => (indexPanel.classList.contains("is-open") ? closeIndex() : openIndex());

  /* ---------- existing show overlay ---------- */
  let frameLoaded = false;
  function openOverlay() {
    closeIndex();
    if (!frameLoaded) {
      overlayFrame.src = "index.html?embed=1";
      frameLoaded = true;
    } else {
      overlayFrame.contentWindow.postMessage({ type: "deck-play" }, "*");
    }
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
  }
  function closeOverlay(pause = true) {
    if (!overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if (pause && frameLoaded && overlayFrame.contentWindow) {
      overlayFrame.contentWindow.postMessage({ type: "deck-pause" }, "*");
    }
  }

  window.addEventListener("message", e => {
    if (e.data && e.data.type === "close-deck") closeOverlay();
  });

  /* ---------- controls ---------- */
  document.getElementById("prevBtn").addEventListener("click", e => { e.stopPropagation(); prev(); });
  document.getElementById("nextBtn").addEventListener("click", e => { e.stopPropagation(); next(); });
  document.getElementById("fsBtn").addEventListener("click", e => { e.stopPropagation(); toggleFullscreen(); });
  document.getElementById("deckBtn").addEventListener("click", e => { e.stopPropagation(); openOverlay(); });
  document.getElementById("indexBtn").addEventListener("click", e => { e.stopPropagation(); toggleIndex(); });
  document.getElementById("indexClose").addEventListener("click", e => { e.stopPropagation(); closeIndex(); });
  document.querySelectorAll("[data-open-deck]").forEach(b =>
    b.addEventListener("click", e => { e.stopPropagation(); openOverlay(); })
  );

  indexPanel.addEventListener("click", e => {
    if (e.target === indexPanel) closeIndex();
  });
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeOverlay();
  });

  deck.addEventListener("click", e => {
    if (e.target.closest("button, a, .mindex, .moverlay, .topbar, .bottombar, .rail, [data-open-deck]")) return;
    if (window.getSelection && String(window.getSelection()).length) return;
    next();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (overlay.classList.contains("is-open")) closeOverlay();
      else closeIndex();
      return;
    }
    if (e.key === " " || e.code === "Space") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); next(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); prev(); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(N - 1); }
    else if (e.key.toLowerCase() === "f") toggleFullscreen();
    else if (e.key.toLowerCase() === "i") toggleIndex();
    else if (e.key.toLowerCase() === "d") openOverlay();
  });

  /* ---------- preload ---------- */
  const sources = Array.from(new Set(
    Array.from(document.querySelectorAll("img"))
      .map(img => img.getAttribute("src"))
      .filter(Boolean)
  ));
  let loaded = 0;
  function preload() {
    return Promise.all(sources.map(src => new Promise(resolve => {
      const im = new Image();
      im.onload = im.onerror = () => {
        loaded++;
        if (loadBar) loadBar.style.width = Math.round((loaded / Math.max(1, sources.length)) * 100) + "%";
        resolve();
      };
      im.src = src;
    })));
  }

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    if (loadBar) loadBar.style.width = "100%";
    loader.classList.add("is-gone");
    go(0);
  }

  Promise.all([preload(), document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()])
    .then(() => setTimeout(boot, 260))
    .catch(boot);
  setTimeout(boot, 8000);

  /* ---------- deep link ---------- */
  const jump = parseInt(new URLSearchParams(location.search).get("s"), 10);
  if (jump >= 1 && jump <= N) {
    const wait = setInterval(() => {
      if (started) { clearInterval(wait); go(jump - 1); }
    }, 120);
  }

  /* ---------- debug ---------- */
  window.__meeting = {
    go(n) { go(clamp(n, 1, N) - 1); return index + 1; },
    next, prev,
    current: () => index + 1,
    total: N,
    openDeck: openOverlay,
    closeDeck: closeOverlay
  };
})();
