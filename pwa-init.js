(function () {
  var SEFS_PWA_VERSION = '20260811f';

  function toast(text) {
    var el = document.getElementById('sefsPwaToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sefsPwaToast';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:max(18px,env(safe-area-inset-bottom))',
        'z-index:999999',
        'transform:translateX(-50%)',
        'background:#111',
        'color:#fff',
        'border:1px solid #22c55e',
        'border-radius:999px',
        'padding:10px 16px',
        'font:800 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'box-shadow:0 14px 32px rgba(0,0,0,.45)',
        'max-width:calc(100vw - 32px)',
        'text-align:center'
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = text;
    window.clearTimeout(el._sefsTimer);
    el._sefsTimer = window.setTimeout(function () {
      el.remove();
    }, 2200);
  }
  window.sefsToast = toast;

  function installPullToRefresh() {
    var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    var startY = 0;
    var pulling = false;
    var armed = false;
    var indicator = null;
    var threshold = 86;
    var maxPull = 132;

    function isEditable(target) {
      return target && target.closest && target.closest('input, textarea, select, button, dialog, [contenteditable="true"]');
    }

    function isCalendarSwipe(target) {
      return target && target.closest && target.closest('.calendar-swipe-surface, .portal-calendar-grid');
    }

    function atPageTop() {
      return window.scrollY <= 0 && document.documentElement.scrollTop <= 0 && document.body.scrollTop <= 0;
    }

    function canStart(event) {
      return event.touches.length === 1 && atPageTop() && !isEditable(event.target) && !isCalendarSwipe(event.target);
    }

    function ensureIndicator() {
      if (indicator) return indicator;
      indicator = document.createElement('div');
      indicator.id = 'pullRefreshIndicator';
      indicator.setAttribute('aria-live', 'polite');
      indicator.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:12px',
        'z-index:99999',
        'transform:translate(-50%,-90px)',
        'opacity:0',
        'transition:transform 140ms ease, opacity 140ms ease',
        'background:#111',
        'color:#fff',
        'border:1px solid #ff7a00',
        'border-radius:999px',
        'padding:10px 16px',
        'font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'box-shadow:0 12px 28px rgba(0,0,0,.35)',
        'pointer-events:none'
      ].join(';');
      indicator.textContent = 'Pull to refresh';
      document.body.appendChild(indicator);
      return indicator;
    }

    function setIndicator(text, distance) {
      var pull = Math.max(0, Math.min(maxPull, distance));
      var y = Math.round(pull - 80);
      var item = ensureIndicator();
      item.textContent = text;
      item.style.opacity = pull > 10 ? '1' : '0';
      item.style.transform = 'translate(-50%,' + y + 'px)';
    }

    function hideIndicator() {
      if (!indicator) return;
      indicator.style.opacity = '0';
      indicator.style.transform = 'translate(-50%,-90px)';
    }

    document.addEventListener('touchstart', function (event) {
      if (!canStart(event)) return;
      startY = event.touches[0].clientY;
      pulling = true;
      armed = false;
    }, { passive: true });

    document.addEventListener('touchmove', function (event) {
      if (!pulling) return;
      if (!atPageTop()) {
        pulling = false;
        armed = false;
        hideIndicator();
        return;
      }
      var dy = event.touches[0].clientY - startY;
      if (dy <= 0) {
        armed = false;
        hideIndicator();
        return;
      }
      var pull = dy * 0.55;
      armed = pull >= threshold;
      setIndicator(armed ? 'Release to refresh' : 'Pull to refresh', pull);
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!pulling) return;
      if (armed) {
        setIndicator('Refreshing...', threshold);
        window.setTimeout(function () {
          location.reload();
        }, 120);
      } else {
        hideIndicator();
      }
      pulling = false;
      armed = false;
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
      pulling = false;
      armed = false;
      hideIndicator();
    }, { passive: true });
  }

  installPullToRefresh();

  function installWorkflowPolish() {
    if (window.__SEFS_WORKFLOW_POLISH__) return;
    window.__SEFS_WORKFLOW_POLISH__ = true;

    var style = document.createElement('style');
    style.textContent = [
      '.sefs-file-summary{margin-top:7px;color:#bdbdbd;font-size:12px;line-height:1.35}',
      '.sefs-file-summary strong{color:#fff}',
      'button[disabled]{cursor:not-allowed;opacity:.58}'
    ].join('\n');
    document.head.appendChild(style);

    function formatBytes(bytes) {
      if (!bytes) return '0 KB';
      var units = ['B', 'KB', 'MB', 'GB'];
      var value = bytes;
      var unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return value.toFixed(unit > 1 ? 1 : 0) + ' ' + units[unit];
    }

    function summarizeFiles(input) {
      if (!input || input.type !== 'file') return;
      if (!input.hasAttribute('multiple') && input.dataset.sefsSingle !== 'true') {
        input.setAttribute('multiple', 'multiple');
      }
      var accept = (input.getAttribute('accept') || '').trim();
      if (!accept || accept === 'image/*') {
        input.setAttribute('accept', 'image/*,application/pdf,.pdf');
      }
      var note = input.parentElement && input.parentElement.querySelector('.sefs-file-summary');
      if (!note) {
        note = document.createElement('div');
        note.className = 'sefs-file-summary';
        input.insertAdjacentElement('afterend', note);
      }
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) {
        note.textContent = '';
        return;
      }
      var total = files.reduce(function(sum, file) { return sum + (file.size || 0); }, 0);
      var names = files.slice(0, 3).map(function(file) { return file.name; }).join(', ');
      var extra = files.length > 3 ? ' +' + (files.length - 3) + ' more' : '';
      note.innerHTML = '<strong>' + files.length + ' selected</strong> - ' + formatBytes(total) + '<br>' + names + extra;
    }

    function rememberButtonText(button) {
      if (!button || button.dataset.sefsOriginalText) return;
      button.dataset.sefsOriginalText = (button.textContent || '').trim();
      button.dataset.sefsClickedAt = String(Date.now());
    }

    function unlockStaleControls(force) {
      var now = Date.now();
      document.querySelectorAll('button:disabled').forEach(function(button) {
        var text = (button.textContent || '').toLowerCase();
        var clickedAt = Number(button.dataset.sefsClickedAt || 0);
        var looksTransient = /saving|uploading|loading|working|syncing|creating/.test(text);
        if (!looksTransient) return;
        if (!force && clickedAt && now - clickedAt < 20000) return;
        button.disabled = false;
        if (button.dataset.sefsOriginalText) {
          button.textContent = button.dataset.sefsOriginalText;
        } else if (/uploading/.test(text)) {
          button.textContent = 'Upload File';
        } else if (/creating/.test(text)) {
          button.textContent = 'Create';
        } else {
          button.textContent = 'Save';
        }
      });
    }

    document.addEventListener('change', function(event) {
      if (event.target && event.target.matches && event.target.matches('input[type="file"]')) {
        summarizeFiles(event.target);
      }
    }, true);

    document.addEventListener('click', function(event) {
      var button = event.target && event.target.closest && event.target.closest('button');
      if (!button) return;
      var text = (button.textContent || '').toLowerCase();
      if (/save|submit|upload|create|add|sync|approve|reject|delete/.test(text)) {
        rememberButtonText(button);
      }
    }, true);

    window.addEventListener('pageshow', function() { unlockStaleControls(true); });
    window.addEventListener('focus', function() { unlockStaleControls(true); });
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) unlockStaleControls(true);
    });
    window.setInterval(function() { unlockStaleControls(false); }, 15000);

    document.querySelectorAll('input[type="file"]').forEach(summarizeFiles);
    window.sefsUnlockStaleControls = function() { unlockStaleControls(true); };
  }

  installWorkflowPolish();

  var canUseServiceWorker = 'serviceWorker' in navigator;
  var secureHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!canUseServiceWorker || !secureHost) return;

  function askWorkerToActivate(worker) {
    if (!worker) return;
    worker.postMessage({ type: 'SEFS_SKIP_WAITING', version: SEFS_PWA_VERSION });
  }

  function watchRegistration(registration) {
    if (registration.waiting) askWorkerToActivate(registration.waiting);
    registration.addEventListener('updatefound', function () {
      var worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Updating SEFS...');
          askWorkerToActivate(worker);
        }
      });
    });
  }

  var reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    toast('SEFS updated. Reloading...');
    window.setTimeout(function () {
      location.reload();
    }, 350);
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (registration) {
      watchRegistration(registration);
      registration.update();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') registration.update();
      });
      window.addEventListener('pageshow', function () {
        registration.update();
      });
    }).catch(function (err) {
      console.warn('SEFS service worker registration skipped:', err);
    });
  });
})();
