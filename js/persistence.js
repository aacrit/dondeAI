/* ============================================
   DondeAI — localStorage Persistence
   3 keys: theme, sound, history
   ============================================ */

const KEYS = {
  theme: 'dondeai-theme',
  sound: 'dondeai-sound',
  history: 'dondeai-history',
  colorMode: 'dondeai-colormode',
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
