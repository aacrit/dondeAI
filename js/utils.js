/* ============================================
   DondeAI — Utilities
   Cuisine emoji mapping, time-of-day, helpers
   ============================================ */

const CUISINE_MAP = [
  { keywords: ['sushi', 'japanese', 'ramen', 'izakaya', 'udon', 'soba'], hue: 210, emoji: '🍣' },
  { keywords: ['mexican', 'taco', 'burrito', 'enchilada', 'quesadilla'], hue: 28, emoji: '🌮' },
  { keywords: ['italian', 'pasta', 'pizza', 'risotto', 'trattoria'], hue: 97, emoji: '🍝' },
  { keywords: ['indian', 'curry', 'tandoori', 'biryani', 'masala', 'naan'], hue: 37, emoji: '🍛' },
  { keywords: ['thai', 'vietnamese', 'pho', 'pad thai', 'banh mi'], hue: 145, emoji: '🍜' },
  { keywords: ['chinese', 'dim sum', 'dumpling', 'wok', 'szechuan', 'cantonese'], hue: 5, emoji: '🥟' },
  { keywords: ['korean', 'bbq', 'bibimbap', 'kimchi', 'bulgogi'], hue: 350, emoji: '🥩' },
  { keywords: ['french', 'bistro', 'brasserie', 'croissant', 'patisserie'], hue: 45, emoji: '🥐' },
  { keywords: ['seafood', 'fish', 'lobster', 'crab', 'oyster', 'shrimp'], hue: 195, emoji: '🦞' },
  { keywords: ['steak', 'steakhouse', 'ribeye', 'filet'], hue: 10, emoji: '🥩' },
  { keywords: ['burger', 'american', 'diner', 'wings', 'bbq'], hue: 35, emoji: '🍔' },
  { keywords: ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino'], hue: 30, emoji: '☕' },
  { keywords: ['cocktail', 'bar', 'speakeasy', 'lounge', 'mixology'], hue: 280, emoji: '🍸' },
  { keywords: ['vegan', 'vegetarian', 'plant-based', 'plant based'], hue: 130, emoji: '🥗' },
  { keywords: ['brunch', 'breakfast', 'pancake', 'waffle', 'eggs'], hue: 40, emoji: '🥞' },
  { keywords: ['mediterranean', 'greek', 'falafel', 'hummus', 'shawarma'], hue: 50, emoji: '🧆' },
  { keywords: ['ethiopian', 'african', 'jollof', 'injera'], hue: 25, emoji: '🍲' },
  { keywords: ['peruvian', 'ceviche', 'empanada'], hue: 15, emoji: '🐟' },
];

export function matchCuisine(text) {
  if (!text) return { emoji: '🍽️', hue: null, label: '' };
  const lower = text.toLowerCase();
  for (const entry of CUISINE_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return { emoji: entry.emoji, hue: entry.hue, label: kw };
      }
    }
  }
  return { emoji: '🍽️', hue: null, label: '' };
}

export function getCuisineFromResult(result) {
  if (!result?.restaurant) return matchCuisine('');
  const searchText = [
    result.restaurant.name,
    result.restaurant.best_for_oneliner,
    result.restaurant.cuisine_type,
    result.recommendation,
    ...(result.tags || []),
  ].filter(Boolean).join(' ');
  return matchCuisine(searchText);
}

export function getTimePeriod() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'dinner';
  return 'latenight';
}

export function getGreeting() {
  const period = getTimePeriod();
  const greetings = {
    morning: 'Good morning, what sounds good?',
    lunch: 'Lunchtime — what are you craving?',
    afternoon: 'Afternoon pick-me-up?',
    dinner: 'Good evening, what sounds good?',
    latenight: 'Late night cravings? We got you.',
  };
  return greetings[period];
}

const QUICK_PICKS = {
  morning:   [
    { emoji: '🥞', label: 'Brunch', value: 'Brunch spot' },
    { emoji: '☕', label: 'Coffee', value: 'Great coffee shop' },
    { emoji: '🥐', label: 'Bakery', value: 'Fresh bakery' },
    { emoji: '🥗', label: 'Healthy', value: 'Healthy breakfast' },
  ],
  lunch: [
    { emoji: '🌮', label: 'Quick Bite', value: 'Quick lunch' },
    { emoji: '🥗', label: 'Healthy', value: 'Healthy lunch' },
    { emoji: '🍜', label: 'Noodles', value: 'Noodle soup' },
    { emoji: '🌮', label: 'Tacos', value: 'Great tacos' },
  ],
  afternoon: [
    { emoji: '☕', label: 'Coffee', value: 'Best coffee' },
    { emoji: '🍰', label: 'Snacks', value: 'Good snacks and pastries' },
    { emoji: '🍸', label: 'Happy Hour', value: 'Happy hour drinks' },
    { emoji: '🍵', label: 'Tea', value: 'Tea house' },
  ],
  dinner: [
    { emoji: '🕯️', label: 'Date Night', value: 'Romantic date night' },
    { emoji: '🍸', label: 'Drinks', value: 'Great cocktails and drinks' },
    { emoji: '🔥', label: 'Trendy', value: 'Trendy new restaurant' },
    { emoji: '👨‍👩‍👧‍👦', label: 'Family', value: 'Family friendly dinner' },
  ],
  latenight: [
    { emoji: '🌙', label: 'Late Night', value: 'Late night food' },
    { emoji: '🍸', label: 'Cocktails', value: 'Late night cocktail bar' },
    { emoji: '🍕', label: 'Comfort', value: 'Comfort food late night' },
    { emoji: '🍕', label: 'Pizza', value: 'Late night pizza' },
  ],
};

export function getQuickPicks(history) {
  const period = getTimePeriod();
  const picks = [...QUICK_PICKS[period]];
  if (history && history.length > 0) {
    const recent = history[0];
    picks[picks.length - 1] = {
      emoji: '🔄',
      label: recent.label || 'Last Search',
      value: recent.payload?.special_request || recent.label,
    };
  }
  return picks;
}

export function getScoreTier(score) {
  const n = parseFloat(score);
  if (n >= 9)  return { tier: 'high', verdict: 'Outstanding', cssClass: 'score-verdict--high' };
  if (n >= 8)  return { tier: 'high', verdict: 'Excellent', cssClass: 'score-verdict--high' };
  if (n >= 6)  return { tier: 'mid',  verdict: 'Solid Pick', cssClass: 'score-verdict--mid' };
  if (n >= 4)  return { tier: 'mid',  verdict: 'Worth a Try', cssClass: 'score-verdict--mid' };
  return { tier: 'low', verdict: 'Adventurous', cssClass: 'score-verdict--low' };
}

export function getScoreColor(score) {
  const n = parseFloat(score);
  if (n >= 8)  return 'var(--green)';
  if (n >= 4)  return 'var(--ac)';
  return 'var(--rose)';
}

export function buildGoogleStars(rating) {
  const n = parseFloat(rating) || 0;
  const full = Math.floor(n);
  const half = n - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export function buildMapsUrl(address) {
  if (!address) return '#';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function relativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function buildShareText(result) {
  if (!result?.restaurant) return '';
  const r = result.restaurant;
  const parts = [
    `🍽️ ${r.name}`,
    r.best_for_oneliner ? `"${r.best_for_oneliner}"` : '',
    result.recommendation ? `\n${result.recommendation}` : '',
    result.insider_tip ? `\n💡 ${result.insider_tip}` : '',
    r.address ? `\n📍 ${r.address}` : '',
    r.website ? `🌐 ${r.website}` : '',
    '\n— via DondeAI',
  ];
  return parts.filter(Boolean).join('\n');
}
