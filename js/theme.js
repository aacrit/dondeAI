/* ============================================
   DondeAI — Theme Engine
   Culture + Light/Dark, instant swap, labels.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { saveTheme } from './persistence.js';

export const CULTURES = ['neutral', 'indian', 'nepalese', 'japanese', 'african', 'southamerican'];

export const CULTURE_DISPLAY_NAMES = {
  neutral: 'Studio',
  indian: 'Saffron',
  nepalese: 'Summit',
  japanese: 'Inkwell',
  african: 'Kente',
  southamerican: 'Fiesta',
};

const THEME_LABELS = {
  neutral: {
    vibe: "What's the vibe?",
    hood: 'Where are you headed?',
    blurb: 'The Liner Notes',
    prompt: 'What are you craving?',
    placeholder: 'cozy ramen with killer sake...',
    cta: 'Find My Spot',
    again: 'Try Another',
    share: 'Share',
  },
  indian: {
    vibe: 'What mood are you in?',
    hood: 'Which neighborhood calls?',
    blurb: 'The Story',
    prompt: 'What does your heart want?',
    placeholder: 'rich butter chicken with warm naan...',
    cta: 'Discover',
    again: 'One More',
    share: 'Share',
  },
  nepalese: {
    vibe: 'What feeling today?',
    hood: 'Which area?',
    blurb: 'The Journey',
    prompt: 'What are you seeking?',
    placeholder: 'warming momos and thukpa...',
    cta: 'Seek',
    again: 'Seek Again',
    share: 'Share',
  },
  japanese: {
    vibe: 'What type?',
    hood: 'Where?',
    blurb: 'Notes',
    prompt: 'What sounds good?',
    placeholder: 'perfect omakase with sake pairing...',
    cta: 'Search',
    again: 'Again',
    share: 'Share',
  },
  african: {
    vibe: "What's the energy?",
    hood: 'Where we headed?',
    blurb: 'The Vibe Check',
    prompt: "What's calling you?",
    placeholder: 'soulful jollof and grilled suya...',
    cta: 'Manifest',
    again: 'Run It Back',
    share: 'Share',
  },
  southamerican: {
    vibe: 'Que onda?',
    hood: 'Que barrio?',
    blurb: 'El Cuento',
    prompt: 'Que quieres?',
    placeholder: 'ceviche fresco con un pisco sour...',
    cta: 'Dale',
    again: 'Otra Vez',
    share: 'Comparte',
  },
};

export function getLabels(culture) {
  return THEME_LABELS[culture] || THEME_LABELS.neutral;
}

export function initTheme() {
  const { theme } = getState();
  let culture = theme.culture;
  let mode = theme.mode;

  // If no persisted theme, respect system dark mode preference
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  if (!localStorage.getItem('dondeai-theme')) {
    mode = darkQuery.matches ? 'dark' : 'light';
    setState({ theme: { culture, mode } });
  }

  // Single apply on init
  applyTheme(culture, mode);

  // Listen for system theme changes (when no user preference saved)
  darkQuery.addEventListener('change', (e) => {
    if (!localStorage.getItem('dondeai-theme')) {
      const newMode = e.matches ? 'dark' : 'light';
      setTheme(getState().theme.culture, newMode);
    }
  });

  subscribe((state, prev) => {
    if (state.theme.culture !== prev.theme.culture || state.theme.mode !== prev.theme.mode) {
      applyTheme(state.theme.culture, state.theme.mode);
      saveTheme(state.theme);
    }
  });
}

export function setTheme(culture, mode) {
  setState({ theme: { culture, mode } });
}

let isFirstApply = true;

function applyTheme(culture, mode) {
  const root = document.documentElement;
  const wash = document.getElementById('theme-wash');

  // Radial clip-path wash transition (skip on first load)
  if (!isFirstApply && wash && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Get the cycle-theme button position for wash origin
    const btn = document.querySelector('[data-action="cycle-theme"]');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = ((rect.left + rect.width / 2) / window.innerWidth * 100).toFixed(1);
      const y = ((rect.top + rect.height / 2) / window.innerHeight * 100).toFixed(1);
      wash.style.setProperty('--wash-x', `${x}%`);
      wash.style.setProperty('--wash-y', `${y}%`);
    }

    // Apply new theme to wash div first
    wash.setAttribute('data-theme', culture);
    wash.setAttribute('data-mode', mode);
    wash.style.background = '';  // will pick up from new theme
    wash.classList.add('theme-wash--active');

    // After transition, apply to root and hide wash
    setTimeout(() => {
      root.setAttribute('data-theme', culture);
      root.setAttribute('data-mode', mode);
      wash.classList.remove('theme-wash--active');
    }, 420);
  } else {
    root.setAttribute('data-theme', culture);
    root.setAttribute('data-mode', mode);
  }

  isFirstApply = false;

  // Update labels
  const labels = getLabels(culture);
  applyLabels(labels);

  // Update theme picker active state
  document.querySelectorAll('.theme-card').forEach(card => {
    const isActive = card.dataset.theme === culture;
    card.setAttribute('aria-checked', String(isActive));
    card.classList.toggle('theme-card--active', isActive);
  });

  // Update mode toggle in theme picker
  document.querySelectorAll('.mode-toggle__btn').forEach(btn => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle('mode-toggle__btn--active', isActive);
  });

  // Update meta theme-color for mobile browser chrome
  requestAnimationFrame(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const bgColor = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bgColor) metaTheme.setAttribute('content', bgColor);
    }
  });
}

function applyLabels(labels) {
  // Craving input placeholder
  const input = document.getElementById('craving-input');
  if (input) input.placeholder = labels.placeholder;

  // Filter section headings (vibe, hood) in the filter drawer
  document.querySelectorAll('.filter-section__title[data-label]').forEach(el => {
    const key = el.dataset.label;
    if (key && labels[key]) el.textContent = labels[key];
  });

  // CTA buttons
  document.querySelectorAll('[data-label="cta"]').forEach(el => {
    el.textContent = labels.cta;
  });

  // Again button
  document.querySelectorAll('[data-label="again"]').forEach(el => {
    el.textContent = labels.again;
  });
}
