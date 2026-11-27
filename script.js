// Sereno Dental: interactions and animations
(function () {
  "use strict";
  const CLINIC_EMAIL = "hello@serenodental.example";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  /* ---------- Split headings into words  ---------- */
  const splitWords = (el, render) => {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    let i = 0;
    const out = [];
    [...el.childNodes].forEach((node) => {
      const cls = node.nodeType === 1 ? node.className : "";
      node.textContent.split(/\s+/).filter(Boolean).forEach((w) => out.push(render(w, i++, cls)));
    });
    el.innerHTML = out.join(" ");
  };
  $$('[data-split="words"]').forEach((el) =>
    splitWords(el, (w, i, cls) => `<span class="w-mask ${cls}" aria-hidden="true"><span class="w-in" style="--i:${i}">${w}</span></span>`)
  );

  /* ---------- Footer big word: one span per letter ---------- */
  $$("[data-bigword]").forEach((el) => {
    el.innerHTML = [...el.textContent.trim()].map((c, i) => `<span class="bw" style="--i:${i}">${c === " " ? "&nbsp;" : c}</span>`).join("");
  });

  /* ---------- About paragraph: words light up as you scroll ---------- */
  const litEl = $("[data-lit]");
  let litWords = [];
  if (litEl) {
    const wrap = (text, extra) => text.split(/(\s+)/).map((t) => (t.trim() ? `<span class="lw${extra}">${t}</span>` : t)).join("");
    litEl.innerHTML = [...litEl.childNodes]
      .map((n) => (n.nodeType === 3 ? wrap(n.textContent, "") : n.outerHTML))
      .join("");
    litWords = $$(".lw", litEl);
  }

  /* ---------- Hero name: sized to fill the panel ---------- */
  const word = $("[data-fit]");
  if (word) {
    const measure = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
    const fit = () => {
      const cs = getComputedStyle(word);
      const room = word.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const size = parseFloat(cs.fontSize);
      const widths = $$("b", word).map(measure);
      const stacked = cs.flexDirection === "column";
      const need = stacked ? Math.max(...widths) * 1.03 : widths.reduce((a, b) => a + b, 0) + size * 0.2;
      if (!need) return;
      const next = Math.min((size * room) / need, window.innerHeight * (stacked ? 0.18 : 0.34));
      word.style.fontSize = next.toFixed(1) + "px";
    };
    fit();
    // split each line into letters so they can rise one after another
    if (!reduceMotion) {
      let c = 0;
      $$("b", word).forEach((b) => { b.innerHTML = [...b.textContent].map((ch) => `<i class="ch" style="--c:${c++}">${ch}</i>`).join(""); });
      word.classList.add("split");
    }
    // the light follows the cursor and the name drifts slightly the other way
    const hero = word.closest(".hero"), glow = $(".hp-glow");
    if (hero && glow && finePointer && !reduceMotion) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        glow.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
        glow.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
        word.style.setProperty("--mx", (x - 0.5).toFixed(3));
        word.style.setProperty("--my", (y - 0.5).toFixed(3));
      });
      hero.addEventListener("pointerleave", () => { glow.style.removeProperty("--gx"); glow.style.removeProperty("--gy"); word.style.setProperty("--mx", 0); word.style.setProperty("--my", 0); });
    }
    window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = $$('[data-reveal], [data-clip], [data-split="words"], [data-bigword]');
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Scroll-driven effects ---------- */
  const header = $(".header");
  const heroSec = $(".hero");
  const wa = $(".wa");
  const parallax = $$("[data-parallax]");
  const ctaSec = $(".cta");
  let lastY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight - vh;
    if (header) {
      header.classList.toggle("scrolled", y > 40);
      header.classList.toggle("on-hero", !!heroSec && y < heroSec.offsetHeight - 90);
      if (!document.body.classList.contains("menu-open")) {
        if (y > lastY + 6 && y > 500) header.classList.add("hide");
        else if (y < lastY - 6 || y < 200) header.classList.remove("hide");
      }
    }
    lastY = y;
    if (wa) {
      // The floating WhatsApp button steps aside where the booking section already has one
      const c = ctaSec && ctaSec.getBoundingClientRect();
      wa.classList.toggle("show", y > 600 && y < docH - 150 && !(c && c.top < vh * 0.85 && c.bottom > vh * 0.35));
    }

    if (!reduceMotion) {
      parallax.forEach((img) => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const offset = (r.top + r.height / 2 - vh / 2) * parseFloat(img.dataset.parallax);
        img.style.transform = `translate3d(0, ${offset - r.height * 0.08}px, 0)`;
      });
    }

    if (litEl && litWords.length) {
      const r = litEl.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const n = Math.round(p * litWords.length);
      litWords.forEach((w, i) => w.classList.toggle("lit", i < n));
    }

    ticking = false;
  };
  window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------- Opening hours: live open / closed status ---------- */
  // EDIT YOUR HOURS: [opening, closing] in 24-hour time (9.5 = 9:30). null = closed.
  const HOURS = { 0: null, 1: [9, 20.5], 2: [9, 20.5], 3: [9, 20.5], 4: [9, 20.5], 5: [9, 20.5], 6: [9, 20.5] };
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const clock = (h) => {
    const hr = Math.floor(h), min = Math.round((h - hr) * 60);
    const h12 = ((hr + 11) % 12) + 1;
    return `${h12}${min ? ":" + String(min).padStart(2, "0") : ""} ${hr < 12 ? "am" : "pm"}`;
  };
  const nowInClinic = () => {
    // Clinic time (India), whatever time zone the visitor is in
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const get = (type) => (parts.find((p) => p.type === type) || {}).value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, h: parseInt(get("hour"), 10) + parseInt(get("minute"), 10) / 60 };
  };
  const openStatus = () => {
    const { day, h } = nowInClinic();
    const today = HOURS[day];
    if (today && h >= today[0] && h < today[1]) return { open: true, label: "Open now", detail: `until ${clock(today[1])}` };
    if (today && h < today[0]) return { open: false, label: "Closed now", detail: `opens ${clock(today[0])} today` };
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d]) return { open: false, label: "Closed now", detail: `opens ${clock(HOURS[d][0])} ${i === 1 ? "tomorrow" : DAY_NAMES[d]}` };
    }
    return { open: false, label: "Closed now", detail: "" };
  };
  const status = openStatus();
  $$("[data-open-label]").forEach((el) => (el.textContent = status.label));
  $$("[data-open-hours]").forEach((el) => (el.textContent = status.detail));
  $$("[data-open-dot]").forEach((el) => el.classList.toggle("off", !status.open));

  /* ---------- Navbar links: wrap each word so it can roll on hover ---------- */
  $$(".nav a, .menu nav a").forEach((a) => {
    const t = a.textContent.trim();
    a.innerHTML = `<span class="roll" data-t="${t}"><span>${t}</span></span>`;
  });

  /* ---------- Header: pill slides to the section you're reading ---------- */
  const spyLinks = $$("[data-spy]");
  const navInd = $(".nav-ind");
  const spySections = spyLinks.map((a) => $(a.getAttribute("href")));
  const spy = () => {
    if (!spyLinks.length) return;
    let current = null;
    spySections.forEach((sec, i) => {
      if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.4) current = spyLinks[i];
    });
    spyLinks.forEach((a) => a.classList.toggle("active", a === current));
    if (!navInd) return;
    if (current) {
      navInd.style.width = current.offsetWidth + "px";
      navInd.style.transform = `translateX(${current.offsetLeft}px)`;
      navInd.style.opacity = "1";
    } else {
      navInd.style.opacity = "0";
    }
  };
  window.addEventListener("scroll", () => requestAnimationFrame(spy), { passive: true });
  window.addEventListener("resize", spy);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(spy);
  spy();

  /* ---------- Preloader: a line fills, then the curtain opens (once per session) ---------- */
  if (root.classList.contains("is-loading")) {
    const line = $(".pl-line");
    const t0 = performance.now();
    const MIN = 1500;
    let loaded = document.readyState === "complete";
    window.addEventListener("load", () => (loaded = true));
    const tick = (now) => {
      const elapsed = now - t0;
      const p = Math.min(loaded ? 100 : 90, Math.round((elapsed / MIN) * 100));
      if (line) line.style.setProperty("--p", p + "%");
      if (p >= 100 || elapsed > 4500) {
        root.classList.add("pl-done");
        try { sessionStorage.setItem("sereno-loaded", "1"); } catch (e) {}
        setTimeout(() => root.classList.remove("is-loading", "pl-done"), 1200);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Treatments: the row scrolls on by itself, endlessly; hover to pause, drag or swipe to look around ---------- */
  $$("[data-tc]").forEach((el) => {
    const track = $(".tc-track", el);
    const cards = $$(".tc", track);
    if (!reduceMotion) {
      // a second copy of the cards follows the first, so the row never runs out
      cards.forEach((c) => { const k = c.cloneNode(true); k.removeAttribute("data-reveal"); k.classList.remove("in"); k.setAttribute("aria-hidden", "true"); track.appendChild(k); });
      track.classList.add("auto");
    }
    const loop = () => (cards.length ? track.children[cards.length].offsetLeft - cards[0].offsetLeft : 0);
    let held = false, onScreen = false, touchTimer = 0, pos = 0, last = 0, synced = false;
    const SPEED = 38; // pixels per second
    const tick = (t) => {
      requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (reduceMotion || held || !onScreen || drag) { synced = false; return; }
      if (!synced || Math.abs(track.scrollLeft - pos) > 3) { pos = track.scrollLeft; synced = true; } // carry on from wherever the visitor left it
      const w = loop();
      pos += SPEED * dt;
      if (w && pos >= w) pos -= w;
      track.scrollLeft = pos;
    };
    requestAnimationFrame(tick);
    track.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") held = true; });
    track.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") held = false; });
    track.addEventListener("focusin", () => { held = true; });
    track.addEventListener("focusout", () => { held = false; });
    track.addEventListener("touchstart", () => { clearTimeout(touchTimer); held = true; }, { passive: true });
    track.addEventListener("touchend", () => { clearTimeout(touchTimer); touchTimer = setTimeout(() => { held = false; }, 2500); }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver((en) => { onScreen = en[en.length - 1].isIntersecting; }, { threshold: 0.1 }).observe(track);
    else onScreen = true;
    // drag with a mouse (touch screens already swipe)
    let drag = null, moved = false;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft };
      moved = false;
      track.setPointerCapture(e.pointerId);
      track.classList.add("dragging");
    });
    track.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) > 4) moved = true;
      track.scrollLeft = drag.left - (e.clientX - drag.x);
    });
    const drop = () => {
      if (!drag) return;
      drag = null;
      track.classList.remove("dragging");
    };
    track.addEventListener("pointerup", drop);
    track.addEventListener("pointercancel", drop);
    track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
  });

  /* ---------- First visit: one step open at a time, moves on by itself ---------- */
  $$("[data-vsteps]").forEach((row) => {
    const panels = $$(".vs", row);
    const open = (n) => {
      const idx = (n + panels.length) % panels.length;
      panels.forEach((p, i) => {
        p.classList.toggle("active", i === idx);
        $(".vs-btn", p).setAttribute("aria-expanded", String(i === idx));
      });
    };
    panels.forEach((p, i) => {
      p.addEventListener("click", () => open(i));
      if (finePointer) p.addEventListener("pointerenter", () => open(i));
    });
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    // The bar under the open step is the timer: when it fills, the next step opens
    row.classList.add("auto", "offscreen");
    row.addEventListener("animationend", (e) => {
      if (e.animationName === "vsTimer") open(panels.findIndex((p) => p.classList.contains("active")) + 1);
    });
    if (finePointer) {
      row.addEventListener("pointerenter", () => row.classList.add("paused"));
      row.addEventListener("pointerleave", () => row.classList.remove("paused"));
    } else {
      row.addEventListener("click", () => row.classList.remove("auto")); // stop once someone taps a step
    }
    row.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) row.classList.remove("auto"); });
    new IntersectionObserver((entries) => entries.forEach((e) => row.classList.toggle("offscreen", !e.isIntersecting)), { threshold: 0.3 }).observe(row);
  });

  /* ---------- Reviews: tap a face and it swaps into the middle ---------- */
  $$("[data-ro]").forEach((ro) => {
    const faces = $$(".ro-face", ro);
    const items = $$(".ro-item", ro);
    let cur = Math.max(0, faces.findIndex((f) => f.dataset.slot === "0")), timer = 0, held = false, onScreen = false;
    // split each review into words so they can rise in one after another
    items.forEach((it) => {
      let k = 0;
      $$("blockquote b, blockquote span", it).forEach((el) => {
        el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w" style="--w:${k++}">${w}</span>`).join(" ");
      });
    });
    // speech bubbles: one face at a time says its line
    const narrow = window.matchMedia("(max-width: 640px)");
    let sayTimer = 0, lastSay = null;
    const say = () => {
      clearTimeout(sayTimer);
      const prev = lastSay;
      if (prev) prev.classList.remove("say");
      lastSay = null;
      if (reduceMotion || !onScreen) return;
      // on phones only the faces on the left, so bubbles stay on screen
      const pool = faces.filter((f) => f.dataset.slot !== "0" && (!narrow.matches || ["1", "2", "5"].includes(f.dataset.slot)) && f !== prev);
      const f = pool[Math.floor(Math.random() * pool.length)];
      if (f) { f.classList.add("say"); lastSay = f; }
      sayTimer = setTimeout(() => { if (lastSay) lastSay.classList.remove("say"); sayTimer = setTimeout(say, 700); }, 2600);
    };
    const show = (n) => {
      if (n === cur) return;
      const a = faces[cur], b = faces[n], slot = b.dataset.slot;
      b.dataset.slot = "0";
      a.dataset.slot = slot;
      a.removeAttribute("aria-current");
      b.setAttribute("aria-current", "true");
      items.forEach((it, i) => it.classList.toggle("active", i === n));
      cur = n;
    };
    const plan = () => {
      clearTimeout(timer);
      const run = !reduceMotion && !held && onScreen;
      // restart the ring around the middle face so it fills in step with the timer
      ro.classList.remove("ticking");
      if (run) { void ro.offsetWidth; ro.classList.add("ticking"); timer = setTimeout(() => { show((cur + 1) % faces.length); plan(); }, 6000); }
    };
    faces[cur].setAttribute("aria-current", "true");
    faces.forEach((f, i) => f.addEventListener("click", () => { show(i); plan(); }));
    if (finePointer) {
      ro.addEventListener("pointerenter", () => { held = true; plan(); });
      ro.addEventListener("pointerleave", () => { held = false; plan(); });
    }
    ro.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) { held = true; plan(); } });
    ro.addEventListener("focusout", () => { held = false; plan(); });
    if ("IntersectionObserver" in window) new IntersectionObserver((en) => {
      const was = onScreen;
      onScreen = en[en.length - 1].isIntersecting;
      plan();
      if (onScreen && !was) sayTimer = setTimeout(say, 1600); else if (!onScreen) say();
    }, { threshold: 0.3 }).observe(ro);
  });

  /* ---------- Magnetic button ---------- */
  if (finePointer && !reduceMotion) {
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.3}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- Mobile menu ---------- */
  const burgers = $$(".burger");
  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open && header) header.classList.remove("hide");
    burgers.forEach((b) => {
      b.setAttribute("aria-expanded", String(open));
      b.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  };
  burgers.forEach((b) => b.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open"))));
  $$(".menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  /* ---------- FAQ: one answer open at a time ---------- */
  const setFa = (fa, open) => {
    const a = $(".fa-a", fa);
    fa.classList.toggle("open", open);
    $(".fa-q", fa).setAttribute("aria-expanded", String(open));
    a.style.height = open ? a.scrollHeight + "px" : "0px";
  };
  $$(".fa").forEach((fa) => {
    if (fa.classList.contains("open")) setFa(fa, true);
    $(".fa-q", fa).addEventListener("click", () => {
      const willOpen = !fa.classList.contains("open");
      $$(".fa.open").forEach((o) => o !== fa && setFa(o, false)); // only one answer open at a time
      setFa(fa, willOpen);
    });
  });
  window.addEventListener("resize", () => $$(".fa.open").forEach((fa) => setFa(fa, true)));

  /* ---------- Privacy page: highlight current section ---------- */
  const tocLinks = $$(".legal-toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const tio = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
      }),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    $$(".legal-body section").forEach((s) => tio.observe(s));
  }

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
