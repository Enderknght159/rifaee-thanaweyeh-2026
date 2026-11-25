/* ============================================================
   معاً نُكمل المسيرة — محرك العرض
   ============================================================ */
(() => {
  "use strict";

  const deck = document.getElementById("deck");
  const scenes = Array.from(deck.querySelectorAll(".scene"));
  const loader = document.getElementById("loader");
  const loadBar = document.getElementById("loadBar");
  const rail = document.getElementById("rail");
  const sceneNo = document.getElementById("sceneNo");
  const pausedBadge = document.getElementById("pausedBadge");
  const toggleBtn = document.getElementById("toggleBtn");
  const toggleIcon = document.getElementById("toggleIcon");
  const toggleText = document.getElementById("toggleText");
  const chapterLabel = document.getElementById("chapterLabel");

  const durations = scenes.map(s => Math.max(2500, parseInt(s.dataset.dur, 10) || 8000));
  const total = durations.reduce((a, b) => a + b, 0);
  const N = scenes.length;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* scene duration drives the slow, uninterrupted motion */
  scenes.forEach((s, k) => s.style.setProperty("--dur", durations[k] + "ms"));

  /* ---------- verse split ---------- */
  let wordIndex = 0;
  document.querySelectorAll("[data-split]").forEach(p => {
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
            const span = document.createElement("span");
            span.className = "vw";
            span.style.setProperty("--i", wordIndex++);
            span.textContent = part;
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(p);
  });

  /* ---------- rail ---------- */
  durations.forEach((d, k) => {
    const seg = document.createElement("span");
    seg.className = "seg";
    seg.style.flex = `${d} 1 0`;
    const fill = document.createElement("b");
    seg.appendChild(fill);
    rail.appendChild(seg);
  });
  const segs = Array.from(rail.children);

  /* ---------- state ---------- */
  let index = 0;
  let playing = false;
  let started = false;
  let clock = 0;          // accumulated play time, ms
  let sceneStart = 0;     // clock time when current scene began
  let lastFrame = 0;
  let autoPaused = false;

  const counters = scenes.map(s => Array.from(s.querySelectorAll("[data-count]")));
  const mediaSrc = scenes.map(s => {
    const img = s.querySelector(".media img");
    return img ? img.getAttribute("src") : null;
  });

  function setCounters(k) {
    counters[k].forEach(el => {
      el.textContent = "0";
    });
  }

  function paintSceneNo() {
    sceneNo.innerHTML = `${index + 1} <b>/</b> ${N}`;
  }

  function enter(n) {
    const next = ((n % N) + N) % N;
    const prevSceneIndex = index;
    const prev = scenes[index];
    if (next === index && started) {
      // restart current scene cleanly
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
        }, 1950);
      }
      index = next;
      const cur = scenes[index];
      clearTimeout(cur._leaveTimer);
      cur.classList.remove("is-leaving");
      cur.classList.toggle("is-same-media",
        started && next !== index && !!mediaSrc[index] && mediaSrc[index] === mediaSrc[prevSceneIndex]);
      cur.classList.add("is-active");
    }
    sceneStart = clock;
    setCounters(index);
    started = true;

    segs.forEach((s, k) => {
      s.classList.toggle("is-now", k === index);
      s.classList.toggle("is-done", k < index);
      s.firstElementChild.style.transform = "scaleX(0)";
    });
    paintSceneNo();
    if (chapterLabel) {
      const nextChapter = scenes[index].dataset.chapter || "";
      if (chapterLabel.textContent !== nextChapter) {
        chapterLabel.textContent = nextChapter;
        chapterLabel.classList.remove("is-swap");
        void chapterLabel.offsetWidth;
        chapterLabel.classList.add("is-swap");
      }
    }
    deck.dataset.scene = String(index + 1);
    scenes.forEach((s, k) => s.setAttribute("aria-hidden", k === index ? "false" : "true"));
  }

  function updateCounters(elapsed) {
    const list = counters[index];
    if (!list.length) return;
    const p = clamp((elapsed - 1900) / 1350, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    list.forEach(el => {
      const to = Number(el.dataset.count) || 0;
      el.textContent = String(Math.round(to * eased));
    });
  }

  function paintProgress(elapsed) {
    const seg = segs[index];
    const p = clamp(elapsed / durations[index], 0, 1);
    seg.firstElementChild.style.transform = `scaleX(${p})`;
  }

  function setPlaying(on) {
    playing = on;
    deck.classList.toggle("is-paused", !on);
    pausedBadge.setAttribute("aria-hidden", on ? "true" : "false");
    if (on) {
      toggleIcon.firstElementChild.setAttribute("href", "#i-pause");
      toggleText.textContent = "إيقاف مؤقت";
      toggleBtn.setAttribute("aria-label", "إيقاف مؤقت");
      lastFrame = performance.now();
    } else {
      toggleIcon.firstElementChild.setAttribute("href", "#i-play");
      toggleText.textContent = "متابعة";
      toggleBtn.setAttribute("aria-label", "متابعة العرض");
    }
  }

  function frame(now) {
    const dt = Math.min(now - lastFrame, 120);
    lastFrame = now;

    if (playing) {
      clock += dt;
      const elapsed = clock - sceneStart;
      updateCounters(elapsed);
      paintProgress(elapsed);
      if (elapsed >= durations[index]) {
        enter(index + 1);
      }
    }
    requestAnimationFrame(frame);
  }

  function next() { enter(index + 1); if (!playing) setPlaying(true); }
  function prev() { enter(index - 1); if (!playing) setPlaying(true); }

  /* ---------- controls ---------- */
  toggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    autoPaused = false;
    setPlaying(!playing);
  });
  document.getElementById("nextBtn").addEventListener("click", e => {
    e.stopPropagation(); autoPaused = false; next();
  });
  document.getElementById("prevBtn").addEventListener("click", e => {
    e.stopPropagation(); autoPaused = false; prev();
  });
  document.getElementById("fsBtn").addEventListener("click", e => {
    e.stopPropagation();
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  });

  deck.addEventListener("click", e => {
    if (e.target.closest(".bottombar__controls, .topbar, .bottombar")) return;
    if (window.getSelection && String(window.getSelection()).length) return;
    autoPaused = false;
    setPlaying(!playing);
  });

  document.addEventListener("keydown", e => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      autoPaused = false;
      setPlaying(!playing);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault(); autoPaused = false; next();
    } else if (e.key === "ArrowRight") {
      e.preventDefault(); autoPaused = false; prev();
    } else if (e.key === "Home") {
      e.preventDefault(); autoPaused = false; enter(0); setPlaying(true);
    } else if (e.key === "End") {
      e.preventDefault(); autoPaused = false; enter(N - 1); setPlaying(true);
    } else if (e.key.toLowerCase() === "f") {
      document.getElementById("fsBtn").click();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (playing) { autoPaused = true; setPlaying(false); }
    } else if (autoPaused) {
      autoPaused = false;
      setPlaying(true);
    }
  });

  /* ---------- preload ---------- */
  const sources = Array.from(new Set(
    Array.from(document.querySelectorAll("img"))
      .map(img => img.getAttribute("src"))
      .filter(Boolean)
  ));

  let loaded = 0;
  const bump = () => {
    loaded++;
    const pct = Math.round((loaded / Math.max(1, sources.length)) * 100);
    if (loadBar) loadBar.style.width = pct + "%";
  };

  function preload() {
    return Promise.all(sources.map(src => new Promise(resolve => {
      const im = new Image();
      im.onload = () => { bump(); resolve(); };
      im.onerror = () => { bump(); resolve(); };
      im.src = src;
    })));
  }

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    if (loadBar) loadBar.style.width = "100%";
    loader.classList.add("is-gone");
    enter(0);
    setPlaying(true);
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  Promise.all([
    preload(),
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  ]).then(() => {
    setTimeout(boot, 420);
  }).catch(boot);

  /* never hold the show behind a stalled image on a weak connection */
  setTimeout(boot, 18000);

  /* ---------- deep link + debug ---------- */
  const jump = new URLSearchParams(location.search).get("s");
  if (jump) {
    const j = parseInt(jump, 10);
    if (j >= 1 && j <= N) {
      // applied after loader finishes via a tiny poll
      const wait = setInterval(() => {
        if (started) { clearInterval(wait); enter(j - 1); }
      }, 120);
    }
  }

  /* ---------- embed mode (داخل عرض اجتماع أولياء الأمور) ---------- */
  const isEmbed = new URLSearchParams(location.search).get("embed") === "1";
  if (isEmbed) {
    document.documentElement.classList.add("is-embed");
    const back = document.createElement("button");
    back.type = "button";
    back.className = "embedBack";
    back.innerHTML = '<svg class="ico" viewBox="0 0 24 24"><use href="#i-prev"/></svg><span>العودة إلى الاجتماع</span>';
    back.addEventListener("click", () => {
      if (window.parent !== window) window.parent.postMessage({ type: "close-deck" }, "*");
    });
    deck.appendChild(back);
  }

  window.addEventListener("message", e => {
    const data = e.data || {};
    if (data.type === "deck-pause") { autoPaused = false; setPlaying(false); }
    else if (data.type === "deck-play") { autoPaused = false; setPlaying(true); }
    else if (data.type === "deck-go" && Number(data.n)) {
      enter(Number(data.n) - 1); setPlaying(true);
    }
  });

  window.__deck = {
    go(n) { enter(clamp(n, 1, N) - 1); setPlaying(true); return index + 1; },
    pause() { autoPaused = false; setPlaying(false); },
    play() { autoPaused = false; setPlaying(true); },
    next, prev,
    current: () => index + 1,
    total: N,
    duration: () => durations[index]
  };
})();
