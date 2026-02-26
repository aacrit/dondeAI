/* ============================================
   DondeAI — Central State Store (Pub/Sub)
   Single source of truth for all app state.
   ============================================ */

const listeners = new Set();

const state = {
  step: 0,
  craving: '',
  occasion: 'Any',
  neighborhood: 'Anywhere',
  priceLevel: 'Any',
  dietaryRestrictions: [], // F5: multi-select dietary filter
  openNow: false, // V5: Open Now filter toggle
  result: null,
  loading: false,
  error: null,
  excludeIds: [],
  theme: { culture: 'neutral', mode: 'light' },
  colorMode: 'auto', // 'auto' = auto-theme active, 'off' = Studio locked
  soundEnabled: false,
  history: [],
  pendingFeedback: null, // F11: feedback to send with next request
  user: null,            // SSO: { id, email, name, avatar_url } or null
  isAuthenticated: false, // SSO: true when signed in
};

export function getState() {
  return state;
}

export function setState(patch) {
  const prev = { ...state };
  Object.assign(state, patch);
  for (const fn of listeners) {
    try {
      fn(state, prev);
    } catch (e) {
      console.error('[state] subscriber error:', e);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState() {
  setState({
    step: 0,
    craving: '',
    occasion: 'Any',
    neighborhood: 'Anywhere',
    priceLevel: 'Any',
    dietaryRestrictions: [],
    openNow: false,
    result: null,
    loading: false,
    error: null,
    excludeIds: [],
    pendingFeedback: null,
  });
}
