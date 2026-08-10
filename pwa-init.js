(function () {
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

  var canUseServiceWorker = 'serviceWorker' in navigator;
  var secureHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!canUseServiceWorker || !secureHost) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (registration) {
      registration.update();
    }).catch(function (err) {
      console.warn('SEFS service worker registration skipped:', err);
    });
  });
})();
