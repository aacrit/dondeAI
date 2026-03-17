/* ============================================
   DondeAI — Theme Engine
   Culture + Light/Dark, instant swap, labels.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { saveTheme } from './persistence.js';
import { REDUCED_MOTION } from './globals.js';

export const CULTURES = ['neutral', 'indian', 'middleeastern', 'japanese', 'southamerican'];

export const CULTURE_DISPLAY_NAMES = {
  neutral: 'Studio',
  indian: 'Desi',
  middleeastern: 'Bazaar',
  japanese: 'Zen',
  southamerican: 'Sabor',
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
    goingHere: "I'm Going Here!",
    goingDone: "You're Going!",
    feedbackTitle: 'Share Your Thoughts',
    feedbackSubtitle: 'Help us make Donde better for everyone.',
    loadingPhrases: ['Sizzling', 'Crafting', 'Plating', 'Pouring', 'Tasting', 'Savoring', 'Searing', 'Mixing'],
    placeholders: [
      'cozy Italian in Lincoln Park for a date...',
      'best tacos near Wrigley Field',
      'quiet spot for a business lunch, West Loop',
      'late night ramen, not too expensive',
      'romantic dinner with great cocktails',
      'family brunch with outdoor seating',
      'BYOB sushi in Logan Square',
      'where should I take my parents?',
    ],
    toasts: {
      feedbackLike: 'Noted \u2014 glad you like it!',
      feedbackDislike: "Got it \u2014 we'll adjust.",
      feedbackCleared: 'Feedback cleared.',
      bookmarkAdd: 'Saved!',
      bookmarkAddAuth: 'Saved to your account',
      bookmarkRemove: 'Removed from saved',
      signedOut: 'Signed out',
      filtersCleared: 'Filters cleared',
      filtersRandom: 'Filters randomized!',
      offline: "You're offline \u2014 can't reach the engine.",
      genericError: 'Something went wrong.',
      noResults: "We couldn't find a match. Try different keywords or adjust your filters.",
      matchExplainer: 'Donde Match\u2122 shows how likely you are to love this spot \u2014 based on cuisine quality, vibe fit, and hundreds of local reviews.',
      vibeExplainer: 'Donde Vibe\u2122 maps how this spot scores across date nights, groups, family, business, solo dining, and hidden gem factor.',
      goingHere: 'Have a great time!',
      feedbackSent: 'Thanks for sharing!',
      welcomeUser: (name) => `Welcome, ${name || 'friend'}!`,
    },
    whyPrefix: 'Why this spot \u2014 ',
    coachMarks: {
      theme: 'Tap to switch cultural themes \u2014 each changes the entire look and vibe.',
      input: "Tell us what you're craving \u2014 be as specific or vague as you like.",
    },
    smartChips: ['deep dish pizza', 'speakeasy', 'romantic dinner', 'smash burger', 'cozy restaurant'],
    suggestions: [
      'deep dish pizza', 'speakeasy', 'romantic dinner', 'smash burger', 'cozy restaurant',
      'soup dumplings', 'rooftop brunch', 'best tacos', 'korean fried chicken', 'jazz bar',
      'omakase', 'cheap eats', 'bottomless brunch', 'dive bar', 'tiki bar',
    ],
    chipPool: {
      // All entries are cached in DondeCache for instant response
      cuisine: ['deep dish pizza', 'smash burger', 'korean fried chicken', 'soup dumplings', 'birria tacos', 'ramen', 'fried chicken', 'dim sum', 'pho', 'street tacos', 'Korean BBQ', 'pad thai', 'lobster bisque', 'hot chicken', 'pierogi', 'gyro', 'ceviche', 'wagyu beef', 'steak tartare', 'wood-fired pizza', 'French bistro', 'banh mi', 'shawarma', 'mole negro', 'butter chicken', 'truffle pasta', 'charcuterie board', 'hand rolls'],
      vibe: ['speakeasy', 'jazz bar', 'dive bar', 'sports bar', 'tiki bar', 'karaoke bar', 'cozy restaurant', 'romantic restaurant', 'rooftop brunch', 'garden restaurant', 'trendy restaurant', 'cozy date night restaurant', 'nostalgic retro diner', 'quiet enough for conversation', 'chef counter experience', 'family friendly restaurant', 'upscale fancy dinner'],
      style: ['happy hour', 'omakase', 'best tasting menu', 'byob restaurant', 'prix fixe dinner', 'outdoor seating', 'private dining room', 'walk in friendly restaurant', 'valet parking', 'craft cocktails', 'charcuterie board', 'family style dinner'],
      time: {
        morning: ['bottomless brunch', 'rooftop brunch', 'kid friendly brunch', 'avocado toast', 'acai bowl', 'grain bowl', 'brunch spot'],
        lunch: ['quick lunch near the loop', 'power lunch', 'cheap eats', 'smash burger', 'street tacos', 'fast casual dining'],
        afternoon: ['happy hour', 'best craft cocktail bar', 'outdoor seating', 'tiki bar', 'speakeasy', 'dog friendly patio'],
        dinner: ['romantic dinner', 'best tasting menu in chicago', 'anniversary dinner', 'omakase', 'upscale fancy dinner', 'family style dinner'],
        latenight: ['late night food', 'dive bar', 'sports bar', 'karaoke bar', 'late night vibes'],
      },
    },
    suggestionCorpus: {
      // All entries matched to DondeCache for instant response
      cuisines: [
        { text: 'deep dish pizza', icon: 'pasta', category: 'Cuisine' },
        { text: 'smash burger', icon: 'burger', category: 'Cuisine' },
        { text: 'korean fried chicken', icon: 'plate', category: 'Cuisine' },
        { text: 'soup dumplings', icon: 'dumpling', category: 'Cuisine' },
        { text: 'Korean BBQ', icon: 'meat', category: 'Cuisine' },
        { text: 'birria tacos', icon: 'taco', category: 'Cuisine' },
        { text: 'ramen', icon: 'noodles', category: 'Cuisine' },
        { text: 'dim sum', icon: 'dumpling', category: 'Cuisine' },
        { text: 'pho', icon: 'noodles', category: 'Cuisine' },
        { text: 'street tacos', icon: 'taco', category: 'Cuisine' },
        { text: 'fried chicken', icon: 'plate', category: 'Cuisine' },
        { text: 'hot chicken', icon: 'plate', category: 'Cuisine' },
        { text: 'lobster bisque', icon: 'seafood', category: 'Cuisine' },
        { text: 'wagyu beef', icon: 'meat', category: 'Cuisine' },
        { text: 'truffle pasta', icon: 'pasta', category: 'Cuisine' },
        { text: 'wood-fired pizza', icon: 'pasta', category: 'Cuisine' },
        { text: 'hand rolls', icon: 'sushi', category: 'Cuisine' },
        { text: 'shawarma', icon: 'plate', category: 'Cuisine' },
        { text: 'pierogi', icon: 'dumpling', category: 'Cuisine' },
        { text: 'ceviche', icon: 'seafood', category: 'Cuisine' },
        { text: 'steak tartare', icon: 'meat', category: 'Cuisine' },
        { text: 'banh mi', icon: 'plate', category: 'Cuisine' },
        { text: 'gyro', icon: 'plate', category: 'Cuisine' },
        { text: 'charcuterie board', icon: 'plate', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'romantic dinner', icon: 'heart', category: 'Vibe' },
        { text: 'rooftop brunch', icon: 'starFull', category: 'Vibe' },
        { text: 'speakeasy', icon: 'cocktail', category: 'Vibe' },
        { text: 'jazz bar', icon: 'music', category: 'Vibe' },
        { text: 'outdoor seating', icon: 'patio', category: 'Vibe' },
        { text: 'cozy restaurant', icon: 'moon', category: 'Vibe' },
        { text: 'dive bar', icon: 'cocktail', category: 'Vibe' },
        { text: 'tiki bar', icon: 'cocktail', category: 'Vibe' },
        { text: 'cozy date night restaurant', icon: 'heart', category: 'Vibe' },
        { text: 'sports bar', icon: 'starFull', category: 'Vibe' },
        { text: 'karaoke bar', icon: 'music', category: 'Vibe' },
        { text: 'garden restaurant', icon: 'patio', category: 'Vibe' },
        { text: 'trendy restaurant', icon: 'diamond', category: 'Vibe' },
        { text: 'quiet enough for conversation', icon: 'user', category: 'Vibe' },
        { text: 'upscale fancy dinner', icon: 'starFull', category: 'Vibe' },
        { text: 'family friendly restaurant', icon: 'usersThree', category: 'Vibe' },
        { text: 'nostalgic retro diner', icon: 'home', category: 'Vibe' },
        { text: 'chef counter experience', icon: 'plate', category: 'Vibe' },
        { text: 'late night food', icon: 'moon', category: 'Vibe' },
        { text: 'bottomless brunch', icon: 'brunch', category: 'Vibe' },
      ],
      combos: [
        { text: 'casual Mexican with outdoor seating BYOB', icon: 'taco', category: 'Combo' },
        { text: 'romantic Italian near river north with cocktails', icon: 'pasta', category: 'Combo' },
        { text: 'upscale Japanese for business dinner', icon: 'sushi', category: 'Combo' },
        { text: 'pasta and red wine cozy', icon: 'pasta', category: 'Combo' },
        { text: 'outdoor brunch with mimosas', icon: 'brunch', category: 'Combo' },
        { text: 'date night thai with ambiance', icon: 'noodles', category: 'Combo' },
        { text: 'family friendly Indian with vegetarian options', icon: 'plate', category: 'Combo' },
        { text: 'cozy pub with craft beer and good food', icon: 'plate', category: 'Combo' },
        { text: 'birthday dinner Italian 8 people', icon: 'pasta', category: 'Combo' },
        { text: 'romantic sushi quiet intimate', icon: 'sushi', category: 'Combo' },
        { text: 'business lunch steakhouse private room', icon: 'meat', category: 'Combo' },
        { text: 'sunday family brunch kids friendly', icon: 'brunch', category: 'Combo' },
        { text: 'pre-theater quick elegant dinner', icon: 'plate', category: 'Combo' },
        { text: 'group celebration cocktails small plates', icon: 'cocktail', category: 'Combo' },
        { text: 'lively group dinner Mediterranean', icon: 'plate', category: 'Combo' },
      ],
    },
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
    goingHere: "I'm Going!",
    goingDone: "You're Going!",
    feedbackTitle: 'Share Your Heart',
    feedbackSubtitle: 'Help us serve you better.',
    loadingPhrases: ['Tempering', 'Simmering', 'Grinding', 'Roasting', 'Infusing', 'Tadka', 'Marinating', 'Blooming'],
    placeholders: [
      'rich butter chicken with warm naan...',
      'fragrant biryani for a special night...',
      'street-style chaat and lassi...',
      'a thali that tells a story...',
    ],
    toasts: {
      feedbackLike: 'Love it \u2014 noted with warmth!',
      feedbackDislike: "Understood \u2014 we'll find something better.",
      feedbackCleared: 'Feedback cleared.',
      bookmarkAdd: 'Saved to your favorites!',
      bookmarkAddAuth: 'Saved to your account',
      bookmarkRemove: 'Removed from favorites',
      signedOut: 'See you soon!',
      filtersCleared: 'Filters cleared',
      filtersRandom: 'Surprise filters set!',
      offline: "You're offline \u2014 reconnect to discover more.",
      genericError: 'Something went wrong. Please try again.',
      noResults: "No perfect match found. Try different cravings or loosen your filters.",
      matchExplainer: 'Donde Match\u2122 shows how perfectly this spot matches your heart \u2014 cuisine, vibe, and real reviews.',
      vibeExplainer: 'Donde Vibe\u2122 reveals how this spot feels across date nights, family feasts, groups, and solo dining.',
      goingHere: 'Enjoy the feast!',
      feedbackSent: 'Thank you for sharing!',
      welcomeUser: (name) => `Welcome, ${name || 'friend'}!`,
    },
    whyPrefix: 'Why we chose this \u2014 ',
    coachMarks: {
      theme: 'Tap to switch themes \u2014 each brings a unique cultural warmth.',
      input: 'Tell us what your heart wants \u2014 we\'ll find the perfect spot.',
    },
    smartChips: ['butter chicken spot', 'street food vibes', 'biryani feast', 'chai and conversation', 'thali for two', 'momo spot'],
    suggestions: [
      'butter chicken spot', 'street food vibes', 'biryani feast', 'chai and conversation', 'thali for two',
      'rich naan and curry', 'fragrant biryani', 'chaat and lassi', 'tandoori night', 'masala dosa',
      'paneer tikka', 'samosa cravings', 'mango lassi', 'kebab platter', 'dal makhani',
    ],
    chipPool: {
      cuisine: ['butter chicken fix', 'biryani feast', 'dosa morning', 'chaat crawl', 'tandoori night', 'thali spread', 'paneer perfection', 'kebab platter', 'dal makhani', 'pani puri stop', 'momo house', 'thukpa warming', 'dal bhat done right'],
      vibe: ['spice market energy', 'chai and conversation', 'family-style sharing', 'warm and fragrant', 'bustling and vibrant', 'homestyle cooking', 'weekend feast', 'street food adventure', 'cozy and aromatic', 'celebratory spread'],
      style: ['modern Indian fusion', 'traditional thali', 'south Indian breakfast', 'Indo-Chinese', 'royal Mughlai', 'regional specialties', 'vegetarian paradise', 'fresh naan counter', 'mithai and sweets', 'mango lassi vibes', 'Himalayan kitchen', 'Newari feast'],
      time: {
        morning: ['dosa and sambar', 'masala chai', 'poha breakfast', 'idli morning', 'paratha plate'],
        lunch: ['quick thali', 'rice and curry', 'business biryani', 'street food lunch', 'light dal'],
        afternoon: ['chai break', 'samosa snack', 'kulfi treat', 'bhel puri', 'masala lemonade'],
        dinner: ['butter chicken night', 'biryani celebration', 'tandoori feast', 'paneer dinner', 'royal spread'],
        latenight: ['late night kebabs', 'midnight biryani', 'chai and snacks', 'after-hours tikka', 'naan run'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'butter chicken', icon: 'curry', category: 'Cuisine' },
        { text: 'biryani feast', icon: 'curry', category: 'Cuisine' },
        { text: 'masala dosa', icon: 'plate', category: 'Cuisine' },
        { text: 'tandoori chicken', icon: 'meat', category: 'Cuisine' },
        { text: 'paneer tikka', icon: 'curry', category: 'Cuisine' },
        { text: 'dal makhani', icon: 'curry', category: 'Cuisine' },
        { text: 'chaat and samosa', icon: 'plate', category: 'Cuisine' },
        { text: 'kebab platter', icon: 'meat', category: 'Cuisine' },
        { text: 'naan and curry', icon: 'curry', category: 'Cuisine' },
        { text: 'thali spread', icon: 'plate', category: 'Cuisine' },
        { text: 'vindaloo', icon: 'curry', category: 'Cuisine' },
        { text: 'mango lassi spot', icon: 'coffee', category: 'Cuisine' },
        { text: 'chole bhature', icon: 'plate', category: 'Cuisine' },
        { text: 'idli sambar', icon: 'plate', category: 'Cuisine' },
        { text: 'pani puri', icon: 'plate', category: 'Cuisine' },
        { text: 'momo steamed or fried', icon: 'dumpling', category: 'Cuisine' },
        { text: 'thukpa noodle soup', icon: 'noodles', category: 'Cuisine' },
        { text: 'dal bhat set', icon: 'plate', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'warm and fragrant evening', icon: 'moon', category: 'Vibe' },
        { text: 'family feast spread', icon: 'home', category: 'Vibe' },
        { text: 'street food crawl', icon: 'diamond', category: 'Vibe' },
        { text: 'chai and conversation', icon: 'coffee', category: 'Vibe' },
        { text: 'celebratory dinner', icon: 'starFull', category: 'Vibe' },
        { text: 'spice market energy', icon: 'diamond', category: 'Vibe' },
        { text: 'cozy and aromatic spot', icon: 'moon', category: 'Vibe' },
        { text: 'vegetarian paradise', icon: 'salad', category: 'Vibe' },
        { text: 'modern Indian fusion', icon: 'plate', category: 'Vibe' },
        { text: 'royal Mughlai feast', icon: 'starFull', category: 'Vibe' },
      ],
      combos: [
        { text: 'biryani and raita celebration', icon: 'curry', category: 'Combo' },
        { text: 'naan and butter chicken cozy night', icon: 'curry', category: 'Combo' },
        { text: 'chai and samosa afternoon', icon: 'coffee', category: 'Combo' },
        { text: 'tandoori and mango lassi', icon: 'meat', category: 'Combo' },
        { text: 'thali spread family style', icon: 'plate', category: 'Combo' },
        { text: 'kebabs and naan late night', icon: 'meat', category: 'Combo' },
        { text: 'dosa and filter coffee morning', icon: 'plate', category: 'Combo' },
        { text: 'chaat and lassi street food', icon: 'plate', category: 'Combo' },
        { text: 'paneer tikka and cocktails', icon: 'curry', category: 'Combo' },
        { text: 'dal and rice comfort dinner', icon: 'curry', category: 'Combo' },
      ],
    },
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
    goingHere: 'Going.',
    goingDone: 'Confirmed.',
    feedbackTitle: 'Your Thoughts',
    feedbackSubtitle: 'Help us improve.',
    loadingPhrases: ['Omakase', 'Steeping', 'Slicing', 'Folding', 'Plating', 'Pouring', 'Umami', 'Whisking'],
    placeholders: [
      'perfect omakase with sake pairing...',
      'handmade soba in a quiet room...',
      'izakaya vibes with cold beer...',
      'fresh sashimi at the counter...',
    ],
    toasts: {
      feedbackLike: 'Noted.',
      feedbackDislike: "Understood \u2014 adjusting.",
      feedbackCleared: 'Cleared.',
      bookmarkAdd: 'Saved.',
      bookmarkAddAuth: 'Saved to account.',
      bookmarkRemove: 'Removed.',
      signedOut: 'Signed out.',
      filtersCleared: 'Filters reset.',
      filtersRandom: 'Random filters set.',
      offline: "Offline \u2014 reconnect to search.",
      genericError: 'An error occurred.',
      noResults: "No match found. Try adjusting your search.",
      matchExplainer: 'Donde Match\u2122 \u2014 cuisine quality, vibe harmony, and local reviews combined into one score.',
      vibeExplainer: 'Donde Vibe\u2122 \u2014 how this spot fits across dining occasions.',
      goingHere: 'Enjoy.',
      feedbackSent: 'Received.',
      welcomeUser: (name) => `Welcome${name ? ', ' + name : ''}.`,
    },
    whyPrefix: 'Why \u2014 ',
    coachMarks: {
      theme: 'Tap to switch themes. Each offers a different aesthetic.',
      input: 'What sounds good? Be as precise as you like.',
    },
    smartChips: ['late night ramen', 'omakase experience', 'izakaya vibes', 'handmade soba', 'sake pairing', 'dim sum brunch', 'late night pho', 'Korean BBQ'],
    suggestions: [
      'late night ramen', 'omakase experience', 'izakaya vibes', 'handmade soba', 'sake pairing',
      'fresh sashimi', 'tonkotsu broth', 'matcha dessert', 'udon spot', 'tempura bar',
      'gyoza and beer', 'sushi counter', 'wagyu treat', 'yakitori alley', 'quiet tea room',
    ],
    chipPool: {
      cuisine: ['omakase counter', 'late night ramen', 'handmade soba', 'izakaya night', 'sushi bar', 'tonkotsu broth', 'gyoza and beer', 'udon shop', 'tempura bar', 'wagyu experience', 'dim sum spread', 'pho bowl', 'pad thai', 'Korean BBQ', 'banh mi spot', 'hot pot night'],
      vibe: ['quiet contemplation', 'counter seating', 'minimalist beauty', 'seasonal menu', 'sake pairing', 'wabi-sabi charm', 'precision and craft', 'zen atmosphere', 'tucked-away spot', 'tea ceremony calm', 'bustling Chinatown', 'night market energy', 'communal hot pot'],
      style: ['kaiseki tasting', 'robata grill', 'donburi bowl', 'matcha everything', 'tsukemen dip', 'yakitori alley', 'shochu selection', 'bento artistry', 'Japanese curry', 'mochi dessert', 'Cantonese classics', 'Sichuan heat', 'Thai street food', 'Vietnamese pho house', 'Korean BBQ grill'],
      time: {
        morning: ['Japanese breakfast', 'matcha latte', 'onigiri stop', 'tamagoyaki set', 'morning miso'],
        lunch: ['bento box', 'ramen bowl', 'quick udon', 'sushi lunch set', 'donburi break'],
        afternoon: ['matcha moment', 'mochi treat', 'Japanese cafe', 'wagashi sweets', 'sencha stop'],
        dinner: ['omakase evening', 'izakaya crawl', 'sushi omakase', 'kaiseki dinner', 'sake flight'],
        latenight: ['midnight ramen', 'late izakaya', 'yakitori run', 'after-hours soba', 'gyoza and highball'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'ramen tonkotsu', icon: 'noodles', category: 'Cuisine' },
        { text: 'sushi omakase', icon: 'sushi', category: 'Cuisine' },
        { text: 'handmade soba', icon: 'noodles', category: 'Cuisine' },
        { text: 'izakaya small plates', icon: 'sushi', category: 'Cuisine' },
        { text: 'tempura bar', icon: 'sushi', category: 'Cuisine' },
        { text: 'gyoza and beer', icon: 'dumpling', category: 'Cuisine' },
        { text: 'udon noodles', icon: 'noodles', category: 'Cuisine' },
        { text: 'wagyu steak', icon: 'meat', category: 'Cuisine' },
        { text: 'yakitori skewers', icon: 'meat', category: 'Cuisine' },
        { text: 'fresh sashimi', icon: 'sushi', category: 'Cuisine' },
        { text: 'Japanese curry', icon: 'curry', category: 'Cuisine' },
        { text: 'donburi rice bowl', icon: 'plate', category: 'Cuisine' },
        { text: 'matcha dessert', icon: 'coffee', category: 'Cuisine' },
        { text: 'tsukemen dipping noodles', icon: 'noodles', category: 'Cuisine' },
        { text: 'karaage fried chicken', icon: 'plate', category: 'Cuisine' },
        { text: 'xiao long bao', icon: 'dumpling', category: 'Cuisine' },
        { text: 'pho bo', icon: 'noodles', category: 'Cuisine' },
        { text: 'pad thai', icon: 'noodles', category: 'Cuisine' },
        { text: 'dim sum spread', icon: 'dumpling', category: 'Cuisine' },
        { text: 'Korean BBQ', icon: 'meat', category: 'Cuisine' },
        { text: 'banh mi', icon: 'plate', category: 'Cuisine' },
        { text: 'hot pot', icon: 'plate', category: 'Cuisine' },
        { text: 'Peking duck', icon: 'meat', category: 'Cuisine' },
        { text: 'mapo tofu', icon: 'curry', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'quiet counter seating', icon: 'user', category: 'Vibe' },
        { text: 'minimalist zen dining', icon: 'moon', category: 'Vibe' },
        { text: 'seasonal omakase experience', icon: 'starFull', category: 'Vibe' },
        { text: 'wabi-sabi atmosphere', icon: 'diamond', category: 'Vibe' },
        { text: 'precision and craft', icon: 'starFull', category: 'Vibe' },
        { text: 'tucked-away izakaya', icon: 'diamond', category: 'Vibe' },
        { text: 'tea ceremony calm', icon: 'coffee', category: 'Vibe' },
        { text: 'lively yakitori alley', icon: 'usersThree', category: 'Vibe' },
        { text: 'sake pairing dinner', icon: 'cocktail', category: 'Vibe' },
        { text: 'late night noodle shop', icon: 'moon', category: 'Vibe' },
      ],
      combos: [
        { text: 'ramen and sake late night', icon: 'noodles', category: 'Combo' },
        { text: 'sushi and natural wine', icon: 'sushi', category: 'Combo' },
        { text: 'yakitori and highball evening', icon: 'meat', category: 'Combo' },
        { text: 'matcha and wagashi afternoon', icon: 'coffee', category: 'Combo' },
        { text: 'izakaya crawl with friends', icon: 'sushi', category: 'Combo' },
        { text: 'gyoza and cold beer', icon: 'dumpling', category: 'Combo' },
        { text: 'kaiseki tasting experience', icon: 'sushi', category: 'Combo' },
        { text: 'udon and tempura lunch', icon: 'noodles', category: 'Combo' },
        { text: 'onigiri and miso morning', icon: 'plate', category: 'Combo' },
        { text: 'omakase and sake pairing', icon: 'sushi', category: 'Combo' },
      ],
    },
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
    goingHere: 'Vamos!',
    goingDone: 'Dale!',
    feedbackTitle: 'Share the Vibe',
    feedbackSubtitle: 'Help us keep Donde fresh.',
    loadingPhrases: ['Sazón', 'Asando', 'Mezclando', 'Sofrito', 'Picando', 'Saboreando', 'Fuego', 'Brindis'],
    placeholders: [
      'ceviche fresco con un pisco sour...',
      'empanadas y mate en buena compania...',
      'tacos al pastor con salsa verde...',
      'un asado legendario para compartir...',
    ],
    toasts: {
      feedbackLike: 'Dale \u2014 que bueno!',
      feedbackDislike: "Entendido \u2014 we'll find something better.",
      feedbackCleared: 'Feedback cleared.',
      bookmarkAdd: 'Guardado!',
      bookmarkAddAuth: 'Saved to your account!',
      bookmarkRemove: 'Removed from saved',
      signedOut: 'Hasta luego!',
      filtersCleared: 'Filters cleared!',
      filtersRandom: 'Random filters \u2014 dale!',
      offline: "Sin conexi\u00f3n \u2014 reconnect to keep searching.",
      genericError: 'Algo sali\u00f3 mal. Try again!',
      noResults: "No encontramos nada. Try different cravings or loosen the filters!",
      matchExplainer: 'Donde Match\u2122 shows how much you\'ll love this spot \u2014 flavor, vibe, and real local reviews.',
      vibeExplainer: 'Donde Vibe\u2122 maps the energy \u2014 date nights, crew hangouts, familia, solo, and hidden gem vibes.',
      goingHere: 'Que lo disfrutes!',
      feedbackSent: 'Gracias!',
      welcomeUser: (name) => `Bienvenido, ${name || 'amigo'}!`,
    },
    whyPrefix: 'Por qu\u00e9 \u2014 ',
    coachMarks: {
      theme: 'Toca para cambiar temas \u2014 each one brings a different energy!',
      input: 'Dinos que quieres \u2014 we\'ll find the perfect spot!',
    },
    smartChips: ['ceviche spot', 'asado for the crew', 'empanadas y mate', 'taco al pastor', 'pisco sour night', 'jollof that hits', 'soul food spot'],
    suggestions: [
      'ceviche spot', 'asado for the crew', 'empanadas y mate', 'taco al pastor', 'pisco sour night',
      'ceviche fresco', 'arepas con queso', 'mole that slaps', 'churros y chocolate', 'tamales caseros',
      'pupusas spot', 'elote and esquites', 'birria tacos', 'horchata spot', 'guacamole fresco',
    ],
    chipPool: {
      cuisine: ['ceviche spot', 'taco al pastor', 'empanadas y mate', 'asado for the crew', 'birria tacos', 'arepas con queso', 'mole that slaps', 'tamales caseros', 'pupusas spot', 'elote and esquites', 'jollof rice', 'suya and drinks', 'plantain everything', 'jerk chicken', 'soul food spot'],
      vibe: ['pisco sour night', 'fiesta energy', 'familia gathering', 'salsa and flavors', 'vibrant patio', 'warm hospitality', 'street food crawl', 'mercado vibes', 'weekend asado', 'barrio favorite', 'cookout vibes', 'afrobeats and food'],
      style: ['Peruvian Nikkei', 'Mexican cantina', 'Argentine parrilla', 'Colombian homestyle', 'Brazilian churrasco', 'Cuban sandwich spot', 'Oaxacan mole house', 'cevicheria fresh', 'churros y chocolate', 'horchata y tacos', 'West African kitchen', 'Caribbean twist', 'soul food classic', 'diaspora kitchen'],
      time: {
        morning: ['huevos rancheros', 'chilaquiles', 'cafe de olla', 'pan dulce', 'arepa breakfast'],
        lunch: ['taco lunch run', 'quick empanada', 'burrito bowl', 'ceviche fresco', 'torta time'],
        afternoon: ['horchata break', 'churro stop', 'elote snack', 'mango con chile', 'cafe cortado'],
        dinner: ['asado night', 'taco feast', 'ceviche dinner', 'mole experience', 'pisco sour evening'],
        latenight: ['late night tacos', 'birria midnight', 'late empanadas', 'after-hours elote', 'street corn run'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'ceviche fresco', icon: 'seafood', category: 'Cuisine' },
        { text: 'tacos al pastor', icon: 'taco', category: 'Cuisine' },
        { text: 'empanadas', icon: 'plate', category: 'Cuisine' },
        { text: 'birria tacos', icon: 'taco', category: 'Cuisine' },
        { text: 'mole oaxaqueno', icon: 'plate', category: 'Cuisine' },
        { text: 'arepas con queso', icon: 'plate', category: 'Cuisine' },
        { text: 'asado parrilla', icon: 'meat', category: 'Cuisine' },
        { text: 'tamales caseros', icon: 'plate', category: 'Cuisine' },
        { text: 'pupusas', icon: 'plate', category: 'Cuisine' },
        { text: 'churros y chocolate', icon: 'croissant', category: 'Cuisine' },
        { text: 'elote and esquites', icon: 'plate', category: 'Cuisine' },
        { text: 'Brazilian churrasco', icon: 'meat', category: 'Cuisine' },
        { text: 'Cuban sandwich', icon: 'plate', category: 'Cuisine' },
        { text: 'huevos rancheros', icon: 'brunch', category: 'Cuisine' },
        { text: 'chilaquiles', icon: 'plate', category: 'Cuisine' },
        { text: 'jollof rice', icon: 'plate', category: 'Cuisine' },
        { text: 'suya skewers', icon: 'meat', category: 'Cuisine' },
        { text: 'jerk chicken', icon: 'meat', category: 'Cuisine' },
        { text: 'oxtail stew', icon: 'meat', category: 'Cuisine' },
        { text: 'fried plantain', icon: 'plate', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'fiesta energy night', icon: 'music', category: 'Vibe' },
        { text: 'familia gathering', icon: 'home', category: 'Vibe' },
        { text: 'vibrant patio dining', icon: 'patio', category: 'Vibe' },
        { text: 'street food mercado crawl', icon: 'diamond', category: 'Vibe' },
        { text: 'weekend asado party', icon: 'usersThree', category: 'Vibe' },
        { text: 'romantic cantina evening', icon: 'heart', category: 'Vibe' },
        { text: 'barrio hidden favorite', icon: 'diamond', category: 'Vibe' },
        { text: 'warm hospitality', icon: 'home', category: 'Vibe' },
        { text: 'late night taco run', icon: 'moon', category: 'Vibe' },
        { text: 'salsa music and flavor', icon: 'music', category: 'Vibe' },
      ],
      combos: [
        { text: 'tacos and margaritas on a patio', icon: 'taco', category: 'Combo' },
        { text: 'ceviche and pisco sour', icon: 'seafood', category: 'Combo' },
        { text: 'asado and malbec weekend', icon: 'meat', category: 'Combo' },
        { text: 'empanadas y mate afternoon', icon: 'plate', category: 'Combo' },
        { text: 'birria and consomme late night', icon: 'taco', category: 'Combo' },
        { text: 'mole and mezcal evening', icon: 'plate', category: 'Combo' },
        { text: 'churros and chocolate morning', icon: 'croissant', category: 'Combo' },
        { text: 'elote and michelada', icon: 'plate', category: 'Combo' },
        { text: 'arepas and cafe cortado', icon: 'plate', category: 'Combo' },
        { text: 'huevos rancheros brunch', icon: 'brunch', category: 'Combo' },
      ],
    },
  },
  middleeastern: {
    vibe: "What's the occasion?",
    hood: 'Which neighborhood?',
    blurb: 'The Story',
    prompt: 'What are you craving?',
    placeholder: 'smoky shawarma with garlic sauce...',
    cta: 'Discover',
    again: 'Another',
    share: 'Share',
    profile: 'The Details',
    insiderTip: "Local's Secret",
    goingHere: "I'm Going!",
    goingDone: "You're Going!",
    feedbackTitle: 'Share Your Thoughts',
    feedbackSubtitle: 'Help us find you better spots.',
    loadingPhrases: ['Grilling', 'Steeping', 'Spicing', 'Roasting', 'Mezze', 'Brewing', 'Charring', 'Drizzling'],
    placeholders: [
      'smoky shawarma with garlic sauce...',
      'fresh hummus and warm pita...',
      'a full mezze spread for the table...',
      'kebab platter with saffron rice...',
    ],
    toasts: {
      feedbackLike: 'Wonderful \u2014 glad you enjoyed!',
      feedbackDislike: "Noted \u2014 we'll find a better fit.",
      feedbackCleared: 'Feedback cleared.',
      bookmarkAdd: 'Saved to your collection!',
      bookmarkAddAuth: 'Saved to your account',
      bookmarkRemove: 'Removed from saved',
      signedOut: 'Until next time!',
      filtersCleared: 'Filters cleared',
      filtersRandom: 'Surprise filters chosen!',
      offline: "You're offline \u2014 reconnect to discover more.",
      genericError: 'Something went wrong. Please try again.',
      noResults: "No perfect match this time. Try different cravings or adjust your filters.",
      matchExplainer: 'Donde Match\u2122 reflects how well this spot suits your taste \u2014 cuisine quality, atmosphere, and trusted reviews.',
      vibeExplainer: 'Donde Vibe\u2122 shows how this spot fits for gatherings, family feasts, dates, solo visits, and more.',
      goingHere: 'Enjoy the meal!',
      feedbackSent: 'Thank you!',
      welcomeUser: (name) => `Welcome, ${name || 'friend'}!`,
    },
    whyPrefix: 'Why this spot \u2014 ',
    coachMarks: {
      theme: 'Tap to switch themes \u2014 each brings a unique warmth and hospitality.',
      input: 'Tell us what you\'re craving \u2014 we\'ll find the perfect gathering spot.',
    },
    smartChips: ['shawarma spot', 'mezze spread', 'fresh falafel', 'kebab platter', 'baklava and tea', 'injera and wot'],
    suggestions: [
      'shawarma spot', 'mezze spread', 'fresh falafel', 'kebab platter', 'baklava and tea',
      'hummus and pita', 'lamb kofta', 'Persian rice', 'Turkish breakfast', 'manakeesh',
      'fattoush salad', 'kibbeh', 'shakshuka', 'labneh dip', 'kunafa dessert',
    ],
    chipPool: {
      cuisine: ['shawarma spot', 'mezze spread', 'falafel wrap', 'kebab platter', 'hummus and pita', 'lamb kofta', 'Persian rice', 'manakeesh', 'kibbeh plate', 'fattoush bowl', 'injera spread', 'tagine night', 'couscous bowl'],
      vibe: ['communal table', 'tea and conversation', 'spice market warmth', 'family gathering', 'rooftop hookah', 'bustling bazaar', 'warm hospitality', 'cozy lantern-lit', 'celebration feast', 'leisurely dinner'],
      style: ['Lebanese kitchen', 'Turkish grill', 'Persian feast', 'Israeli street food', 'Moroccan tagine', 'Egyptian koshari', 'Syrian specialties', 'Greek taverna', 'Afghan kabob', 'Mediterranean fresh', 'Ethiopian spread', 'North African spices'],
      time: {
        morning: ['Turkish breakfast', 'shakshuka morning', 'labneh and bread', 'foul medames', 'manakeesh fresh'],
        lunch: ['quick shawarma', 'falafel wrap', 'hummus plate', 'fattoush lunch', 'kebab roll'],
        afternoon: ['mint tea break', 'baklava stop', 'Turkish coffee', 'kunafa treat', 'date and nut snack'],
        dinner: ['full mezze spread', 'kebab feast', 'Persian stew', 'lamb shoulder', 'tagine night'],
        latenight: ['late shawarma run', 'midnight kebab', 'after-hours falafel', 'tea and sweets', 'late mezze'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'shawarma', icon: 'meat', category: 'Cuisine' },
        { text: 'falafel and hummus', icon: 'plate', category: 'Cuisine' },
        { text: 'kebab platter', icon: 'meat', category: 'Cuisine' },
        { text: 'mezze spread', icon: 'plate', category: 'Cuisine' },
        { text: 'Persian saffron rice', icon: 'plate', category: 'Cuisine' },
        { text: 'lamb kofta', icon: 'meat', category: 'Cuisine' },
        { text: 'Turkish pide', icon: 'plate', category: 'Cuisine' },
        { text: 'shakshuka', icon: 'brunch', category: 'Cuisine' },
        { text: 'manakeesh', icon: 'plate', category: 'Cuisine' },
        { text: 'baklava and kunafa', icon: 'croissant', category: 'Cuisine' },
        { text: 'kibbeh', icon: 'plate', category: 'Cuisine' },
        { text: 'Moroccan tagine', icon: 'curry', category: 'Cuisine' },
        { text: 'fattoush salad', icon: 'salad', category: 'Cuisine' },
        { text: 'labneh and pita', icon: 'plate', category: 'Cuisine' },
        { text: 'koshari bowl', icon: 'plate', category: 'Cuisine' },
        { text: 'injera and wot', icon: 'plate', category: 'Cuisine' },
        { text: 'Ethiopian berbere stew', icon: 'curry', category: 'Cuisine' },
        { text: 'Moroccan tagine', icon: 'curry', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'communal feast spread', icon: 'usersThree', category: 'Vibe' },
        { text: 'tea and conversation', icon: 'coffee', category: 'Vibe' },
        { text: 'warm lantern-lit dinner', icon: 'moon', category: 'Vibe' },
        { text: 'spice market energy', icon: 'diamond', category: 'Vibe' },
        { text: 'family gathering feast', icon: 'home', category: 'Vibe' },
        { text: 'rooftop evening', icon: 'patio', category: 'Vibe' },
        { text: 'bustling bazaar crawl', icon: 'diamond', category: 'Vibe' },
        { text: 'quiet hookah lounge', icon: 'moon', category: 'Vibe' },
        { text: 'celebration spread', icon: 'starFull', category: 'Vibe' },
        { text: 'modern Mediterranean', icon: 'plate', category: 'Vibe' },
      ],
      combos: [
        { text: 'shawarma and garlic sauce feast', icon: 'meat', category: 'Combo' },
        { text: 'mezze and arak evening', icon: 'plate', category: 'Combo' },
        { text: 'kebab and saffron rice', icon: 'meat', category: 'Combo' },
        { text: 'falafel and fresh juice', icon: 'plate', category: 'Combo' },
        { text: 'hummus and warm pita', icon: 'plate', category: 'Combo' },
        { text: 'baklava and Turkish coffee', icon: 'croissant', category: 'Combo' },
        { text: 'tagine and couscous', icon: 'curry', category: 'Combo' },
        { text: 'shakshuka and bread brunch', icon: 'brunch', category: 'Combo' },
        { text: 'lamb and mint tea evening', icon: 'meat', category: 'Combo' },
        { text: 'fattoush and grilled halloumi', icon: 'salad', category: 'Combo' },
      ],
    },
  },
};

/* ---- Easter Egg 2: "Secret Menu" loading phrases ---- */
const SECRET_MENU_PHRASES = ['Whispering', 'Decoding', 'Unlocking', 'Conspiring', 'Smuggling'];

export function getLabels(culture) {
  const labels = THEME_LABELS[culture] || THEME_LABELS.neutral;
  // Easter Egg 2: If the current craving contains "secret menu", swap loading phrases
  const craving = getState().craving || '';
  if (/secret\s+menu/i.test(craving)) {
    return { ...labels, loadingPhrases: SECRET_MENU_PHRASES };
  }
  return labels;
}

// Migrate users who had a removed theme persisted
const THEME_MIGRATION = { nepalese: 'indian', eastasian: 'japanese', african: 'neutral' };

export function initTheme() {
  const { theme } = getState();
  let culture = theme.culture;
  let mode = theme.mode;

  // Migrate removed themes to closest match
  if (THEME_MIGRATION[culture]) {
    culture = THEME_MIGRATION[culture];
    setState({ theme: { culture, mode } });
  }

  // Default to dark mode — override only if user has explicitly toggled
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  if (!localStorage.getItem('dondeai-theme')) {
    mode = 'dark';
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

/* ---- Color Mode: always auto (no manual override) ---- */
export function getColorMode() {
  return 'auto';
}

export function setTheme(culture, mode) {
  setState({ theme: { culture, mode } });
}

/** Instant theme swap — no wash overlay. Used during manual culture selection. */
let skipWash = false;
export function setThemeInstant(culture, mode) {
  skipWash = true;
  setState({ theme: { culture, mode } });
  skipWash = false;
}

/* ---- Auto-Theme (visual-only, no labels, no persist) ---- */
let autoThemeCulture = null;
let _whisperTimer = null;

/** Visual-only theme swap with 300ms crossfade.
 *  Used during typing to preview cultural themes. Shows culture whisper label. */
export function setThemeVisualOnly(culture) {
  if (culture === autoThemeCulture) return;
  const prevCulture = autoThemeCulture;
  autoThemeCulture = culture;
  const root = document.documentElement;
  // Enable crossfade transition
  root.classList.add('theme-crossfading');
  root.setAttribute('data-theme', culture);
  setTimeout(() => root.classList.remove('theme-crossfading'), 350);
  // Show culture whisper if culture actually changed
  if (prevCulture !== culture) {
    showCultureWhisper(culture);
  }
}

/** Revert auto-theme back to the user's persisted theme. */
export function revertAutoTheme() {
  if (!autoThemeCulture) return;
  autoThemeCulture = null;
  const { theme } = getState();
  const root = document.documentElement;
  root.classList.add('theme-crossfading');
  root.setAttribute('data-theme', theme.culture);
  setTimeout(() => root.classList.remove('theme-crossfading'), 350);
}

/** Show a brief culture name label near the input (200ms in, 1.2s hold, 300ms out). */
function showCultureWhisper(culture) {
  const $whisper = document.getElementById('culture-whisper');
  if (!$whisper) return;
  clearTimeout(_whisperTimer);
  const name = CULTURE_DISPLAY_NAMES[culture] || culture;
  $whisper.textContent = name;
  $whisper.classList.remove('culture-whisper--visible', 'culture-whisper--fading');
  void $whisper.offsetWidth; // force reflow
  $whisper.classList.add('culture-whisper--visible');
  _whisperTimer = setTimeout(() => {
    $whisper.classList.add('culture-whisper--fading');
    setTimeout(() => {
      $whisper.classList.remove('culture-whisper--visible', 'culture-whisper--fading');
    }, 300);
  }, 1400);
}

export function isAutoThemeActive() {
  return autoThemeCulture !== null;
}

export function getAutoThemeCulture() {
  return autoThemeCulture;
}

let isFirstApply = true;
let _washOrigin = null; // { x, y } for radial clip-path wash origin

/** Set the origin point for the next theme wash animation.
 *  Call before setTheme() — consumed once by applyTheme(). */
export function setWashOrigin(x, y) {
  _washOrigin = { x, y };
}

function applyTheme(culture, mode) {
  const root = document.documentElement;
  const wash = document.getElementById('theme-wash');

  // Consume wash origin (one-shot)
  const origin = _washOrigin;
  _washOrigin = null;

  // Radial clip-path wash transition (skip on first load, skip during instant swaps)
  if (!isFirstApply && !skipWash && wash && !REDUCED_MOTION.matches) {
    // Apply new theme to wash div first
    wash.setAttribute('data-theme', culture);
    wash.setAttribute('data-mode', mode);

    // Set wash origin coordinates (default to center if no origin provided)
    const ox = origin ? origin.x : window.innerWidth / 2;
    const oy = origin ? origin.y : window.innerHeight / 2;
    wash.style.setProperty('--wash-x', `${ox}px`);
    wash.style.setProperty('--wash-y', `${oy}px`);

    wash.classList.add('theme-wash--active');

    // After wash transition completes, apply to root and reset
    setTimeout(() => {
      root.setAttribute('data-theme', culture);
      root.setAttribute('data-mode', mode);
      wash.classList.remove('theme-wash--active');
    }, 450);
  } else {
    root.setAttribute('data-theme', culture);
    root.setAttribute('data-mode', mode);
  }

  isFirstApply = false;

  // Update labels
  const labels = getLabels(culture);
  applyLabels(labels);

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
