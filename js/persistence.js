/* ============================================
   DondeAI — localStorage Persistence
   Keys: theme, sound, history, colorMode,
         bookmarks, userId, feedback
   ============================================ */

const KEYS = {
  theme: 'dondeai-theme',
  sound: 'dondeai-sound',
  history: 'dondeai-history',
  colorMode: 'dondeai-colormode',
  bookmarks: 'dondeai-bookmarks',
  userId: 'dondeai-user-id',
  feedback: 'dondeai-feedback',
};

function safeGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or private browsing — silent fail */
  }
}

export function loadTheme() {
  return safeGet(KEYS.theme) || { culture: 'neutral', mode: 'light' };
}

export function saveTheme(theme) {
  safeSet(KEYS.theme, theme);
}

export function loadSound() {
  const v = safeGet(KEYS.sound);
  return v === true;
}

export function saveSound(enabled) {
  safeSet(KEYS.sound, enabled);
}

export function loadColorMode() {
  return safeGet(KEYS.colorMode) || 'auto';
}

export function saveColorMode(mode) {
  safeSet(KEYS.colorMode, mode);
}

export function loadHistory() {
  return safeGet(KEYS.history) || [];
}

export function saveHistory(history) {
  safeSet(KEYS.history, history);
}

export function addToHistory(label, payload, cuisineIcon = 'plate') {
  const hist = loadHistory();
  const deduped = hist.filter(h => h.label !== label);
  deduped.unshift({ label, payload, cuisineIcon, timestamp: Date.now() });
  const trimmed = deduped.slice(0, 3);
  saveHistory(trimmed);
  return trimmed;
}

/* ---- F4: Bookmarks (Save/Favorite) ---- */
export function loadBookmarks() {
  return safeGet(KEYS.bookmarks) || [];
}

export function saveBookmarks(bookmarks) {
  safeSet(KEYS.bookmarks, bookmarks);
}

export function addBookmark(restaurant) {
  const bookmarks = loadBookmarks();
  if (bookmarks.some(b => b.id === restaurant.id)) return bookmarks;
  bookmarks.unshift({
    id: restaurant.id,
    name: restaurant.name,
    cuisine_type: restaurant.cuisine_type,
    neighborhood_name: restaurant.neighborhood_name,
    price_level: restaurant.price_level,
    google_place_id: restaurant.google_place_id,
    timestamp: Date.now(),
  });
  const trimmed = bookmarks.slice(0, 20);
  saveBookmarks(trimmed);
  return trimmed;
}

export function removeBookmark(id) {
  const bookmarks = loadBookmarks().filter(b => b.id !== id);
  saveBookmarks(bookmarks);
  return bookmarks;
}

export function isBookmarked(id) {
  return loadBookmarks().some(b => b.id === id);
}

/* ---- F9: Anonymous User ID ---- */
export function getOrCreateUserId() {
  let userId = safeGet(KEYS.userId);
  if (!userId) {
    userId = crypto.randomUUID ? crypto.randomUUID() : (
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      })
    );
    safeSet(KEYS.userId, userId);
  }
  return userId;
}

/* ---- F11: Feedback Persistence ---- */
export function saveFeedback(restaurantId, feedback) {
  const all = safeGet(KEYS.feedback) || {};
  all[restaurantId] = { feedback, timestamp: Date.now() };
  // Keep max 100 entries
  const entries = Object.entries(all);
  if (entries.length > 100) {
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const trimmed = Object.fromEntries(entries.slice(0, 100));
    safeSet(KEYS.feedback, trimmed);
  } else {
    safeSet(KEYS.feedback, all);
  }
}

export function loadFeedback(restaurantId) {
  const all = safeGet(KEYS.feedback) || {};
  return all[restaurantId]?.feedback || null;
}
