/* WeGoFit landing: all interactivity, no framework.
   When the store listings go live, paste their URLs below. Every
   "Download the App" / "Start Free Trial" button then sends phones straight
   to their own store, and the "Coming Soon" badges become real links. */
(function () {
  var STORES = {
    ios: null, // e.g. 'https://apps.apple.com/app/idXXXXXXXXX'
    android: null, // e.g. 'https://play.google.com/store/apps/details?id=app.wegofit'
  };

  var d = document;
  var live = Boolean(STORES.ios || STORES.android);

  function platform() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && 'ontouchend' in d)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return null;
  }

  // Store badges: "Coming Soon" until a URL exists.
  d.querySelectorAll('[data-store]').forEach(function (el) {
    var url = STORES[el.getAttribute('data-store')];
    if (!url) return;
    var a = d.createElement('a');
    a.href = url;
    a.className = el.getAttribute('data-live-class') || el.className;
    a.setAttribute('aria-label', el.getAttribute('data-live-label') || '');
    a.setAttribute('data-cta', 'store-' + el.getAttribute('data-store'));
    a.innerHTML = el.innerHTML;
    var top = a.querySelector('[data-store-top]');
    if (top) top.textContent = el.getAttribute('data-top') || '';
    el.replaceWith(a);
  });
  d.querySelectorAll('[data-prelaunch]').forEach(function (el) {
    el.hidden = live;
  });
  d.querySelectorAll('[data-postlaunch]').forEach(function (el) {
    el.hidden = !live;
  });

  // One click handler for app CTAs, modals and their close buttons.
  d.addEventListener('click', function (e) {
    var t = e.target;
    var app = t.closest && t.closest('[data-app]');
    if (app) {
      var url = STORES[platform()];
      if (url) {
        e.preventDefault();
        location.href = url;
        return;
      }
    }
    var open = t.closest && t.closest('[data-modal]');
    if (open) {
      var dlg = d.getElementById('modal-' + open.getAttribute('data-modal'));
      if (dlg && dlg.showModal) dlg.showModal();
      return;
    }
    var close = t.closest && t.closest('[data-close]');
    if (close) close.closest('dialog').close();
  });
  d.querySelectorAll('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });
  });

  // Light / dark: follows the device until the visitor picks one.
  var rootEl = d.documentElement;
  function applyTheme(t) {
    rootEl.setAttribute('data-theme', t);
    d.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute('content', t === 'light' ? '#faf7f2' : '#14110e');
    });
  }
  d.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = rootEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('wgf-theme', next);
      } catch (e) {}
      applyTheme(next);
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var follow = function () {
      var saved = null;
      try {
        saved = localStorage.getItem('wgf-theme');
      } catch (e) {}
      if (saved !== 'light' && saved !== 'dark') applyTheme(mq.matches ? 'light' : 'dark');
    };
    if (mq.addEventListener) mq.addEventListener('change', follow);
  }

  // Header: solid once scrolled; mobile menu.
  var header = d.querySelector('[data-header]');
  var btn = d.querySelector('[data-menu-btn]');
  function setOpen(open) {
    if (!header || !btn) return;
    header.setAttribute('data-open', open ? 'true' : 'false');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    d.body.style.overflow = open ? 'hidden' : '';
    d.querySelectorAll('#mobile-nav a').forEach(function (a) {
      a.tabIndex = open ? 0 : -1;
    });
  }
  if (btn) {
    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    d.querySelectorAll('#mobile-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        setOpen(false);
      });
    });
    setOpen(false);
  }
  function onScroll() {
    if (header) header.setAttribute('data-solid', window.scrollY > 24 ? 'true' : 'false');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!('IntersectionObserver' in window)) return;

  // Mobile sticky CTA: shows once the hero buttons scroll away, steps aside
  // wherever the page already offers the download.
  var sticky = d.querySelector('[data-sticky]');
  var hero = d.getElementById('hero-cta');
  if (sticky && hero) {
    var heroGone = false;
    var seen = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === hero) heroGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        else if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      });
      var show = heroGone && seen.size === 0;
      sticky.setAttribute('data-show', show ? 'true' : 'false');
      sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
    io.observe(hero);
    ['download', 'final-cta', 'site-footer'].forEach(function (id) {
      var el = d.getElementById(id);
      if (el) io.observe(el);
    });
  }

  // One entrance: fade and rise as blocks come into view.
  if (d.documentElement.classList.contains('motion')) {
    var rv = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            rv.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    d.querySelectorAll('[data-in]').forEach(function (el) {
      rv.observe(el);
    });
  }
})();
