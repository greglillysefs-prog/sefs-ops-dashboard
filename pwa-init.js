(function () {
  var canUseServiceWorker = 'serviceWorker' in navigator;
  var secureHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!canUseServiceWorker || !secureHost) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('SEFS service worker registration skipped:', err);
    });
  });
})();
