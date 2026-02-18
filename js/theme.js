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
    profile: 'About This Spot',
    insiderTip: 'Insider Tip',
    loadingPhrases: ['Searching', 'Thinking', 'Exploring', 'Hunting'],
    placeholders: [
      'cozy ramen with killer sake...',
      'somewhere with a great patio...',
      'best tacos in the city...',
      'a hidden gem worth the trip...',
    ],
    smartChips: ['outdoor seating', 'live music', 'great cocktails', 'hidden gem', 'cozy date spot'],
    suggestions: [
      'outdoor seating', 'live music', 'great cocktails', 'hidden gem', 'cozy date spot',
      'pet friendly', 'best tacos', 'killer sake', 'great patio', 'brunch spot',
      'late night bites', 'craft beer', 'vegan options', 'romantic dinner', 'cheap eats',
    ],
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
    profile: 'Know Your Spot',
    insiderTip: "Chef's Secret",
    loadingPhrases: ['Searching', 'Discovering', 'Seeking flavors', 'Finding your spot'],
    placeholders: [
      'rich butter chicken with warm naan...',
      'fragrant biryani for a special night...',
      'street-style chaat and lassi...',
      'a thali that tells a story...',
    ],
    smartChips: ['butter chicken spot', 'street food vibes', 'biryani feast', 'chai and conversation', 'thali for two'],
    suggestions: [
      'butter chicken spot', 'street food vibes', 'biryani feast', 'chai and conversation', 'thali for two',
      'rich naan and curry', 'fragrant biryani', 'chaat and lassi', 'tandoori night', 'masala dosa',
      'paneer tikka', 'samosa cravings', 'mango lassi', 'kebab platter', 'dal makhani',
    ],
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
    profile: 'The Details',
    insiderTip: 'Local Wisdom',
    loadingPhrases: ['Searching', 'Seeking', 'Climbing', 'Journeying'],
    placeholders: [
      'warming momos and thukpa...',
      'dal bhat with mountain views...',
      'a quiet spot for yak tea...',
      'hearty Newari feast...',
    ],
    smartChips: ['momo house', 'mountain comfort food', 'quiet tea spot', 'dal bhat done right', 'hearty Newari meal'],
    suggestions: [
      'momo house', 'mountain comfort food', 'quiet tea spot', 'dal bhat done right', 'hearty Newari meal',
      'warming thukpa', 'yak butter tea', 'Sherpa stew', 'sel roti', 'Newari feast',
      'chow mein spot', 'achar and momos', 'choila platter', 'gundruk soup', 'simple dal bhat',
    ],
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
    profile: 'Details',
    insiderTip: 'Omakase Note',
    loadingPhrases: ['Searching', 'Considering', 'Finding harmony', 'Seeking'],
    placeholders: [
      'perfect omakase with sake pairing...',
      'handmade soba in a quiet room...',
      'izakaya vibes with cold beer...',
      'fresh sashimi at the counter...',
    ],
    smartChips: ['late night ramen', 'omakase experience', 'izakaya vibes', 'handmade soba', 'sake pairing'],
    suggestions: [
      'late night ramen', 'omakase experience', 'izakaya vibes', 'handmade soba', 'sake pairing',
      'fresh sashimi', 'tonkotsu broth', 'matcha dessert', 'udon spot', 'tempura bar',
      'gyoza and beer', 'sushi counter', 'wagyu treat', 'yakitori alley', 'quiet tea room',
    ],
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
    profile: 'The Rundown',
    insiderTip: 'The Real Tea',
    loadingPhrases: ['Searching', 'Vibing', 'Manifesting', 'On the hunt'],
    placeholders: [
      'soulful jollof and grilled suya...',
      'fufu and egusi with the crew...',
      'a spot with live music and plates...',
      'comfort food that hits different...',
    ],
    smartChips: ['jollof that hits', 'suya and drinks', 'soul food spot', 'live music and plates', 'comfort that slaps'],
    suggestions: [
      'jollof that hits', 'suya and drinks', 'soul food spot', 'live music and plates', 'comfort that slaps',
      'fufu and egusi', 'plantain everything', 'oxtail stew', 'pepper soup', 'pounded yam',
      'fried chicken spot', 'waakye plate', 'injera spread', 'afrobeats and food', 'late night bites',
    ],
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
    profile: 'Los Detalles',
    insiderTip: 'Entre Nos',
    loadingPhrases: ['Buscando', 'Descubriendo', 'Explorando', 'Dale dale'],
    placeholders: [
      'ceviche fresco con un pisco sour...',
      'empanadas y mate en buena compania...',
      'tacos al pastor con salsa verde...',
      'un asado legendario para compartir...',
    ],
    smartChips: ['ceviche spot', 'asado for the crew', 'empanadas y mate', 'taco al pastor', 'pisco sour night'],
    suggestions: [
      'ceviche spot', 'asado for the crew', 'empanadas y mate', 'taco al pastor', 'pisco sour night',
      'ceviche fresco', 'arepas con queso', 'mole that slaps', 'churros y chocolate', 'tamales caseros',
      'pupusas spot', 'elote and esquites', 'birria tacos', 'horchata spot', 'guacamole fresco',
    ],
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

  // CTA buttons (target .cta-btn__text child if present to preserve icons)
  document.querySelectorAll('[data-label="cta"]').forEach(el => {
    const t = el.querySelector('.cta-btn__text');
    if (t) t.textContent = labels.cta; else el.textContent = labels.cta;
  });

  // Again button
  document.querySelectorAll('[data-label="again"]').forEach(el => {
    const t = el.querySelector('.cta-btn__text');
    if (t) t.textContent = labels.again; else el.textContent = labels.again;
  });

  // Profile heading
  document.querySelectorAll('[data-label="profile"]').forEach(el => {
    if (labels.profile) el.textContent = labels.profile;
  });

  // Insider tip label
  document.querySelectorAll('[data-label="insiderTip"]').forEach(el => {
    if (labels.insiderTip) el.textContent = labels.insiderTip;
  });
}
