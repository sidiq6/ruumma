/* =========================================================
   RUUMAA — SCRIPT.JS
   Vanilla JavaScript, tanpa library tambahan.
   ========================================================= */

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const reduceMotion = () => motionPreference.matches;

  function onMotionChange(callback) {
    if (motionPreference.addEventListener) {
      motionPreference.addEventListener("change", callback);
    } else {
      motionPreference.addListener(callback);
    }
  }

  function focusSafely(element) {
    if (!element || !element.isConnected) return;
    element.focus({ preventScroll: true });
  }

  /* =======================================================
     01. TAHUN OTOMATIS
     ======================================================= */

  const year = $("#current-year");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  /* =======================================================
     02. LOADER PEMBUKA
     Hanya menunggu gambar penting, maksimal 2 detik.
     Tidak mengunci scroll atau menunggu foto galeri.
     ======================================================= */

  function setupLoader() {
    const loader = $("#preloader");
    const hero = $("#hero-image");

    if (!loader) return;

    // Hindari kilatan loader jika hero sudah siap.
    if (reduceMotion() || !hero || hero.complete) {
      loader.hidden = true;
      return;
    }

    const animations = [];
    const cleanups = [];

    let finished = false;
    let closing = false;
    let safetyTimer;
    let fadeTimer;

    function stopAnimations() {
      animations.forEach((animation) => animation.cancel());
      animations.length = 0;
    }

    function finish() {
      if (finished) return;

      finished = true;
      loader.hidden = true;

      window.clearTimeout(safetyTimer);
      window.clearTimeout(fadeTimer);

      stopAnimations();
      cleanups.forEach((cleanup) => cleanup());
    }

    function closeLoader() {
      if (finished || closing) return;

      closing = true;

      if (reduceMotion() || typeof loader.animate !== "function") {
        finish();
        return;
      }

      const fade = loader.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        {
          duration: 180,
          easing: "ease-out",
          fill: "forwards"
        }
      );

      animations.push(fade);

      fade.finished.then(finish).catch(finish);

      // Tetap tutup jika event animasi tidak selesai.
      fadeTimer = window.setTimeout(finish, 220);
    }

    function waitForImage(image) {
      return new Promise((resolve) => {
        if (!image || image.complete) {
          resolve();
          return;
        }

        const done = () => {
          image.removeEventListener("load", done);
          image.removeEventListener("error", done);
          resolve();
        };

        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });

        cleanups.push(done);
      });
    }

    loader.hidden = false;

    // Pengaman dipasang sebelum animasi dimulai.
    safetyTimer = window.setTimeout(finish, 2000);

    try {
      if (typeof loader.animate === "function") {
        const steam = $(".preloader__steam", loader);
        const accent = $(".preloader__accent", loader);

        if (steam) {
          animations.push(
            steam.animate(
              [
                { transform: "translateY(3px)", opacity: 0.35 },
                { transform: "translateY(-3px)", opacity: 1 },
                { transform: "translateY(-7px)", opacity: 0.35 }
              ],
              {
                duration: 1100,
                iterations: Infinity,
                easing: "ease-in-out"
              }
            )
          );
        }

        if (accent) {
          animations.push(
            accent.animate(
              [
                { transform: "scaleX(0.55)", opacity: 0.6 },
                { transform: "scaleX(1)", opacity: 1 },
                { transform: "scaleX(0.55)", opacity: 0.6 }
              ],
              {
                duration: 1000,
                iterations: Infinity,
                easing: "ease-in-out"
              }
            )
          );
        }
      }

      Promise.all([
        waitForImage(hero),
        waitForImage($(".preloader__logo", loader))
      ]).then(closeLoader);
    } catch (error) {
      finish();
    }

    onMotionChange(() => {
      if (reduceMotion()) finish();
    });

    window.addEventListener("pagehide", finish, { once: true });
  }

  setupLoader();

  /* =======================================================
     03. HEADER SAAT SCROLL
     requestAnimationFrame membatasi pekerjaan per frame.
     ======================================================= */

  const header = $("#site-header");

  if (header) {
    let framePending = false;

    function updateHeader() {
      header.classList.toggle("is-scrolled", window.scrollY > 16);
      framePending = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (framePending) return;

        framePending = true;
        window.requestAnimationFrame(updateHeader);
      },
      { passive: true }
    );

    updateHeader();
  }

  /* =======================================================
     04. SCROLL LOCK
     Posisi halaman disimpan agar tidak melompat saat ditutup.
     ======================================================= */

  const scrollOwners = new Set();
  let scrollSnapshot = null;

  const lockedProperties = [
    "position",
    "top",
    "left",
    "width",
    "padding-right"
  ];

  function lockScroll(owner) {
    if (scrollOwners.has(owner)) return;

    scrollOwners.add(owner);

    if (scrollOwners.size > 1) return;

    const body = document.body;
    const root = document.documentElement;

    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - root.clientWidth
    );

    scrollSnapshot = {
      x: window.scrollX,
      y: window.scrollY,
      styles: lockedProperties.map((property) => ({
        property,
        value: body.style.getPropertyValue(property),
        priority: body.style.getPropertyPriority(property)
      }))
    };

    const paddingRight = parseFloat(
      window.getComputedStyle(body).paddingRight
    ) || 0;

    root.classList.add("is-scroll-locked");
    body.classList.add("is-scroll-locked");

    body.style.position = "fixed";
    body.style.top = `-${scrollSnapshot.y}px`;
    body.style.left = `-${scrollSnapshot.x}px`;
    body.style.width = "100%";
    body.style.paddingRight = `${paddingRight + scrollbarWidth}px`;
  }

  function unlockScroll(owner) {
    if (!scrollOwners.delete(owner)) return;
    if (scrollOwners.size > 0 || !scrollSnapshot) return;

    const body = document.body;
    const root = document.documentElement;
    const snapshot = scrollSnapshot;

    scrollSnapshot = null;

    snapshot.styles.forEach(({ property, value, priority }) => {
      if (value) {
        body.style.setProperty(property, value, priority);
      } else {
        body.style.removeProperty(property);
      }
    });

    root.classList.remove("is-scroll-locked");
    body.classList.remove("is-scroll-locked");

    // Pemulihan posisi harus instan, bukan smooth scroll.
    const oldBehavior = root.style.getPropertyValue("scroll-behavior");
    const oldPriority = root.style.getPropertyPriority("scroll-behavior");

    root.style.setProperty("scroll-behavior", "auto", "important");
    window.scrollTo(snapshot.x, snapshot.y);

    if (oldBehavior) {
      root.style.setProperty(
        "scroll-behavior",
        oldBehavior,
        oldPriority
      );
    } else {
      root.style.removeProperty("scroll-behavior");
    }
  }

  /* =======================================================
     05. PENGELOLA DIALOG
     Dialog native + Escape + focus trap + pengembalian fokus.
     ======================================================= */

  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  function visibleFocusableElements(dialog) {
    return $$(focusableSelector, dialog).filter((element) => {
      return (
        !element.closest("[hidden], [inert]") &&
        element.getClientRects().length > 0 &&
        window.getComputedStyle(element).visibility !== "hidden"
      );
    });
  }

  function createDialogController(dialog, { onClose } = {}) {
    if (!dialog || typeof dialog.showModal !== "function") {
      return null;
    }

    let opener = null;
    let active = false;

    function finishClose() {
      // Abaikan event penutupan lama jika dialog sudah dibuka kembali.
      if (!active || dialog.open) return;

      active = false;
      unlockScroll(dialog);

      const returnTarget = opener;
      opener = null;

      focusSafely(returnTarget);

      if (onClose) onClose();
    }

    function close() {
      if (dialog.open) dialog.close();
      finishClose();
    }

    function open(trigger) {
      if (dialog.open) return true;

      opener = trigger || document.activeElement;

      try {
        dialog.showModal();
      } catch (error) {
        opener = null;
        return false;
      }

      active = true;
      lockScroll(dialog);

      const first = $("[autofocus]", dialog) ||
        visibleFocusableElements(dialog)[0];

      focusSafely(first);

      return true;
    }

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });

    dialog.addEventListener("close", finishClose);

    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;

      const elements = visibleFocusableElements(dialog);
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (!first) {
        event.preventDefault();
        return;
      }

      const current = document.activeElement;

      if (event.shiftKey && (current === first || !elements.includes(current))) {
        event.preventDefault();
        focusSafely(last);
      } else if (
        !event.shiftKey &&
        (current === last || !elements.includes(current))
      ) {
        event.preventDefault();
        focusSafely(first);
      }
    });

    return { open, close };
  }

  /* =======================================================
     06. NAVIGASI HAMBURGER
     Navigasi dasar baru disembunyikan setelah panel siap.
     ======================================================= */

  function setupNavigation() {
    const toggle = $("#menu-toggle");
    const panel = $("#navigation-panel");
    const closeButton = $("#menu-close");
    const basicNavigation = $("#basic-navigation");

    if (!toggle || !panel || !closeButton || !basicNavigation) return;

    let pendingTarget = null;

    const controller = createDialogController(panel, {
      onClose() {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Buka navigasi");

        const target = pendingTarget;
        pendingTarget = null;

        if (!target) return;

        // Tunggu posisi scroll dipulihkan sebelum pindah bagian.
        window.requestAnimationFrame(() => {
          try {
            window.history.pushState(null, "", `#${target.id}`);
          } catch (error) {
            // Beberapa preview file lokal membatasi History API.
            window.location.hash = target.id;
          }

          target.scrollIntoView({
            behavior: reduceMotion() ? "auto" : "smooth",
            block: "start"
          });
        });
      }
    });

    // Jika dialog tidak didukung, navigasi biasa tetap tampil.
    if (!controller) return;

    toggle.addEventListener("click", () => {
      if (panel.open) {
        controller.close();
        return;
      }

      if (controller.open(toggle)) {
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Tutup navigasi");
      }
    });

    closeButton.addEventListener("click", controller.close);

    $$('.panel-navigation a[href^="#"]', panel).forEach((link) => {
      link.addEventListener("click", (event) => {
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) return;

        const id = link.getAttribute("href").slice(1);
        const target = document.getElementById(id);

        if (!target) return;

        event.preventDefault();
        pendingTarget = target;
        controller.close();
      });
    });

    toggle.hidden = false;
    basicNavigation.hidden = true;
  }

  setupNavigation();

  /* =======================================================
     07. LIGHTBOX GALERI
     Foto dimuat ketika dipilih, bukan semuanya sekaligus.
     Request lama diabaikan ketika pengguna cepat berpindah.
     ======================================================= */

  function setupLightbox() {
    const links = $$("[data-lightbox]");
    const dialog = $("#lightbox");
    const image = $("#lightbox-image");
    const imageWrap = $("#lightbox-image-wrap");
    const caption = $("#lightbox-caption");
    const counter = $("#lightbox-counter");
    const status = $("#lightbox-status");
    const original = $("#lightbox-original");
    const closeButton = $("#lightbox-close");
    const previousButton = $("#lightbox-prev");
    const nextButton = $("#lightbox-next");

    if (
      !links.length ||
      !dialog ||
      !image ||
      !imageWrap ||
      !caption ||
      !counter ||
      !status ||
      !original ||
      !closeButton ||
      !previousButton ||
      !nextButton
    ) return;

    const photos = links.map((link) => {
      const thumbnail = $("img", link);

      return {
        src: link.href,
        alt: link.dataset.alt || thumbnail?.alt || "Foto ruumaa",
        caption: link.dataset.caption || thumbnail?.alt || "Suasana ruumaa"
      };
    });

    let currentIndex = 0;
    let requestNumber = 0;
    let pendingImage = null;
    let loadingTimer = null;

    function cancelPendingImage() {
      requestNumber += 1;
      window.clearTimeout(loadingTimer);

      if (pendingImage) {
        pendingImage.onload = null;
        pendingImage.onerror = null;
        pendingImage = null;
      }
    }

    const controller = createDialogController(dialog, {
      onClose() {
        cancelPendingImage();

        image.hidden = true;
        image.removeAttribute("src");
        image.alt = "";

        imageWrap.setAttribute("aria-busy", "false");
        status.textContent = "";
      }
    });

    if (!controller) return;

    original.target = "_blank";
    original.rel = "noopener noreferrer";
    original.setAttribute(
      "aria-label",
      "Buka berkas foto asli di tab baru"
    );

    function showPhoto(index) {
      cancelPendingImage();

      currentIndex = (index + photos.length) % photos.length;

      const photo = photos[currentIndex];
      const thisRequest = requestNumber;

      image.hidden = true;
      image.removeAttribute("src");

      caption.textContent = photo.caption;
      counter.textContent = `${currentIndex + 1} / ${photos.length}`;
      counter.setAttribute(
        "aria-label",
        `Foto ${currentIndex + 1} dari ${photos.length}`
      );

      original.href = photo.src;
      original.hidden = false;

      previousButton.disabled = photos.length < 2;
      nextButton.disabled = photos.length < 2;

      status.textContent = "Memuat foto…";
      imageWrap.setAttribute("aria-busy", "true");

      const candidate = new Image();
      pendingImage = candidate;

      let settled = false;

      function complete(success) {
        if (settled) return;
        settled = true;

        window.clearTimeout(loadingTimer);
        candidate.onload = null;
        candidate.onerror = null;

        if (pendingImage === candidate) {
          pendingImage = null;
        }

        if (thisRequest !== requestNumber || !dialog.open) return;

        imageWrap.setAttribute("aria-busy", "false");

        if (!success || !candidate.naturalWidth) {
          image.hidden = true;
          status.textContent =
            "Foto belum bisa ditampilkan. Coba foto lain atau buka berkas foto asli.";
          return;
        }

        // Dimensi diperbarui sesuai gambar yang benar-benar dimuat.
        image.width = candidate.naturalWidth;
        image.height = candidate.naturalHeight;
        image.alt = photo.alt;
        image.src = photo.src;
        image.hidden = false;

        status.textContent = "";
      }

      candidate.onload = () => complete(true);
      candidate.onerror = () => complete(false);

      // Jangan biarkan pesan loading bertahan tanpa batas.
      loadingTimer = window.setTimeout(() => complete(false), 15000);

      candidate.src = photo.src;

      // Gambar dari cache bisa langsung tersedia.
      if (candidate.complete) {
        complete(candidate.naturalWidth > 0);
      }
    }

    links.forEach((link, index) => {
      link.addEventListener("click", (event) => {
        // Ctrl/Cmd+klik tetap memakai perilaku tautan biasa.
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) return;

        // Jika modal gagal dibuka, tautan gambar tetap bekerja.
        if (!controller.open(link)) return;

        event.preventDefault();
        showPhoto(index);
      });
    });

    closeButton.addEventListener("click", controller.close);

    previousButton.addEventListener("click", () => {
      showPhoto(currentIndex - 1);
    });

    nextButton.addEventListener("click", () => {
      showPhoto(currentIndex + 1);
    });

    dialog.addEventListener("keydown", (event) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPhoto(currentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showPhoto(currentIndex + 1);
      }
    });
  }

  setupLightbox();

  /* =======================================================
     08. REVEAL SAAT SCROLL
     Elemen tetap terlihat tanpa JS atau tanpa observer.
     ======================================================= */

  function setupReveal() {
    const elements = $$("[data-reveal]");

    if (
      !elements.length ||
      reduceMotion() ||
      !("IntersectionObserver" in window)
    ) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -24px 0px"
      }
    );

    function revealAll() {
      observer.disconnect();

      elements.forEach((element) => {
        element.classList.remove("reveal-ready");
        element.classList.add("is-visible");
      });
    }

    try {
      elements.forEach((element) => {
        const bounds = element.getBoundingClientRect();

        // Konten yang sudah berada di layar tidak dibuat hilang dulu.
        if (bounds.top < window.innerHeight && bounds.bottom > 0) {
          element.classList.add("is-visible");
          return;
        }

        observer.observe(element);
        element.classList.add("reveal-ready");
      });
    } catch (error) {
      revealAll();
    }

    // Fokus keyboard tidak boleh masuk ke elemen yang masih transparan.
    document.addEventListener("focusin", (event) => {
      const element = event.target.closest?.("[data-reveal]");

      if (!element) return;

      element.classList.add("is-visible");
      observer.unobserve(element);
    });

    onMotionChange(() => {
      if (reduceMotion()) revealAll();
    });
  }

  setupReveal();
})();