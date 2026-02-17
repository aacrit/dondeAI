/* ============================================
   DondeAI — Offline Detection
   Shows/hides banner, blocks submit when offline.
   ============================================ */

let $banner = null;

export function initOffline() {
  $banner = document.querySelector('.offline-banner');

  window.addEventListener('online', () => updateBanner(true));
  window.addEventListener('offline', () => updateBanner(false));

  updateBanner(navigator.onLine);
}

function updateBanner(isOnline) {
  if (!$banner) return;
  $banner.classList.toggle('offline-banner--visible', !isOnline);
}

export function isOnline() {
  return navigator.onLine;
}
