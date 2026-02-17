/* ============================================
   DondeAI — Theme Engine
   Culture + Light/Dark, instant swap, labels.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { saveTheme } from './persistence.js';

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
  applyTheme(theme.culture, theme.mode);

  // Auto-detect system dark mode
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  if (!localStorage.getItem('dondeai-theme')) {
    const mode = darkQuery.matches ? 'dark' : 'light';
    setState({ theme: { ...getState().theme, mode } });
    applyTheme(getState().theme.culture, mode);
  }

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

function applyTheme(culture, mode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', culture);
  root.setAttribute('data-mode', mode);

  // Update labels
  const labels = getLabels(culture);
  applyLabels(labels);

  // Update theme picker active state
  document.querySelectorAll('.theme-card').forEach(card => {
    const isActive = card.dataset.theme === culture;
    card.setAttribute('aria-checked', String(isActive));
    card.classList.toggle('theme-card--active', isActive);
  });

  // Update mode toggle
  document.querySelectorAll('.mode-toggle__btn').forEach(btn => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle('mode-toggle__btn--active', isActive);
  });
}

function applyLabels(labels) {
  // Greeting/prompt on step 0
  const greeting = document.querySelector('[data-step="0"] .step__title');
  if (greeting) greeting.textContent = labels.prompt;

  // Craving input placeholder
  const input = document.getElementById('craving-input');
  if (input) input.placeholder = labels.placeholder;

  // Step 1 heading (vibe)
  const vibeTitle = document.querySelector('[data-step="1"] .step__title');
  if (vibeTitle) vibeTitle.textContent = labels.vibe;

  // Step 2 heading (hood)
  const hoodTitle = document.querySelector('[data-step="2"] .step__title');
  if (hoodTitle) hoodTitle.textContent = labels.hood;

  // CTA buttons
  document.querySelectorAll('[data-label="cta"]').forEach(el => {
    el.textContent = labels.cta;
  });

  // Again button
  document.querySelectorAll('[data-label="again"]').forEach(el => {
    el.textContent = labels.again;
  });
}
