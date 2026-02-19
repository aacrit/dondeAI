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
  result: null,
  loading: false,
  error: null,
  excludeIds: [],
  theme: { culture: 'neutral', mode: 'light' },
  soundEnabled: false,
  history: [],
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
    result: null,
    loading: false,
    error: null,
    excludeIds: [],
  });
}
