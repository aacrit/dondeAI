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
  authDismissed: 'dondeai-auth-dismissed',
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

/* ---- SSO: Guest Dismiss (auto-prompt suppression) ---- */
export function hasGuestDismissed() {
  return safeGet(KEYS.authDismissed) === true;
}

export function setGuestDismissed() {
  safeSet(KEYS.authDismissed, true);
}

/* ---- SSO: Server Sync Functions ---- */
/* These functions sync localStorage data to/from Supabase for authenticated users.
   Existing localStorage functions remain unchanged — these are additive. */

export async function syncBookmarksToServer(supabase, userId, bookmarks) {
  if (!supabase || !userId) return;
  const rows = bookmarks.map(b => ({
    user_id: userId,
    restaurant_id: b.id,
    restaurant_name: b.name,
    cuisine_type: b.cuisine_type || null,
    neighborhood_name: b.neighborhood_name || null,
    price_level: b.price_level || null,
    google_place_id: b.google_place_id || null,
  }));
  const { error } = await supabase
    .from('user_favorites')
    .upsert(rows, { onConflict: 'user_id,restaurant_id' });
  if (error) console.error('[persistence] Failed to sync bookmarks:', error);
}

export async function syncHistoryToServer(supabase, userId, history) {
  if (!supabase || !userId) return;
  const rows = history.map(h => ({
    user_id: userId,
    craving: h.payload?.special_request || h.label || '',
    occasion: h.payload?.occasion || null,
    neighborhood: h.payload?.neighborhood || null,
    price_level: h.payload?.price_level || null,
    restaurant_name: h.label || null,
  }));
  const { error } = await supabase
    .from('user_searches')
    .insert(rows);
  if (error) console.error('[persistence] Failed to sync history:', error);
}

export async function loadBookmarksFromServer(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_favorites')
    .select('restaurant_id, restaurant_name, cuisine_type, neighborhood_name, price_level, google_place_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[persistence] Failed to load server bookmarks:', error);
    return [];
  }
  // Map to localStorage bookmark format
  return (data || []).map(row => ({
    id: row.restaurant_id,
    name: row.restaurant_name,
    cuisine_type: row.cuisine_type,
    neighborhood_name: row.neighborhood_name,
    price_level: row.price_level,
    google_place_id: row.google_place_id,
    timestamp: new Date(row.created_at).getTime(),
  }));
}

export async function loadHistoryFromServer(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_searches')
    .select('craving, occasion, neighborhood, price_level, restaurant_name, cuisine_type, donde_match, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[persistence] Failed to load server history:', error);
    return [];
  }
  // Map to localStorage history format (used by taste memory rendering)
  return (data || []).map(row => ({
    label: row.craving || row.restaurant_name || '',
    payload: {
      special_request: row.craving || '',
      occasion: row.occasion || 'Any',
      neighborhood: row.neighborhood || 'Anywhere',
      price_level: row.price_level || 'Any',
    },
    cuisineIcon: 'plate',
    timestamp: new Date(row.created_at).getTime(),
  }));
}
