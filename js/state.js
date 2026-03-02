/* ============================================
   DondeAI v11 — Central State Store (Pub/Sub)
   Phase-based single surface architecture.
   ============================================ */

const listeners = new Set();

const state = {
  phase: 'idle',              // 'idle' | 'loading' | 'result' | 'error'
  craving: '',
  filters: {
    occasion: 'Any',
    neighborhood: 'Anywhere',
    priceLevel: 'Any',
    dietaryRestrictions: [],
    openNow: false,
  },
  result: null,
  error: null,
  excludeIds: [],
  rankedQueue: [],
  rankedQueueIndex: 0,
  theme: { culture: 'neutral', mode: 'light' },
  colorMode: 'auto',
  soundEnabled: false,
  history: [],
  pendingFeedback: null,
  user: null,
  isAuthenticated: false,
};

export function getState() {
  return state;
}

export function setState(patch) {
  const prev = { ...state, filters: { ...state.filters } };
  if (patch.filters) {
    Object.assign(state.filters, patch.filters);
    delete patch.filters;
  }
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
    phase: 'idle',
    craving: '',
    filters: {
      occasion: 'Any',
      neighborhood: 'Anywhere',
      priceLevel: 'Any',
      dietaryRestrictions: [],
      openNow: false,
    },
    result: null,
    error: null,
    excludeIds: [],
    rankedQueue: [],
    rankedQueueIndex: 0,
    pendingFeedback: null,
  });
}

export function resetFilters() {
  setState({
    filters: {
      occasion: 'Any',
      neighborhood: 'Anywhere',
      priceLevel: 'Any',
      dietaryRestrictions: [],
      openNow: false,
    },
  });
}
