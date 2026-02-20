/* ============================================
   DondeAI — Theme Engine
   Culture + Light/Dark, instant swap, labels.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { saveTheme } from './persistence.js';

export const CULTURES = ['neutral', 'indian', 'middleeastern', 'nepalese', 'japanese', 'eastasian', 'african', 'southamerican'];

export const CULTURE_DISPLAY_NAMES = {
  neutral: 'Studio',
  indian: 'Desi',
  middleeastern: 'Bazaar',
  nepalese: 'Himalayan',
  japanese: 'Zen',
  eastasian: 'Silk',
  african: 'Kente',
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
    chipPool: {
      cuisine: ['ramen spot', 'taco run', 'sushi counter', 'pasta night', 'burger joint', 'pho for days', 'dim sum', 'pizza slice', 'mediterranean bowl', 'korean bbq'],
      vibe: ['cozy date spot', 'hidden gem', 'rooftop views', 'live music', 'outdoor patio', 'moody speakeasy', 'chill vibes', 'lively crowd', 'intimate dinner', 'neighborhood gem'],
      style: ['craft cocktails', 'natural wine bar', 'farm to table', 'omakase counter', 'prix fixe tasting', 'byob spot', 'tasting menu', 'comfort food', 'street food style', 'chef-driven'],
      time: {
        morning: ['brunch spot', 'great coffee', 'fresh pastries', 'avocado toast', 'breakfast tacos'],
        lunch: ['quick bite', 'power lunch', 'healthy bowl', 'soup and sandwich', 'working lunch'],
        afternoon: ['happy hour', 'afternoon tea', 'cafe vibes', 'light snack', 'espresso stop'],
        dinner: ['date night', 'tasting menu', 'celebration dinner', 'group dinner', 'chef\'s table'],
        latenight: ['late night bites', 'after-hours eats', 'midnight snack', 'late night ramen', '2am tacos'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'ramen', icon: 'noodles', category: 'Cuisine' },
        { text: 'sushi omakase', icon: 'sushi', category: 'Cuisine' },
        { text: 'tacos al pastor', icon: 'taco', category: 'Cuisine' },
        { text: 'wood-fired pizza', icon: 'pasta', category: 'Cuisine' },
        { text: 'handmade pasta', icon: 'pasta', category: 'Cuisine' },
        { text: 'korean bbq', icon: 'meat', category: 'Cuisine' },
        { text: 'dim sum brunch', icon: 'dumpling', category: 'Cuisine' },
        { text: 'pho and banh mi', icon: 'noodles', category: 'Cuisine' },
        { text: 'butter chicken', icon: 'curry', category: 'Cuisine' },
        { text: 'fresh seafood', icon: 'seafood', category: 'Cuisine' },
        { text: 'smash burgers', icon: 'burger', category: 'Cuisine' },
        { text: 'mediterranean bowl', icon: 'salad', category: 'Cuisine' },
        { text: 'ethiopian injera', icon: 'plate', category: 'Cuisine' },
        { text: 'peruvian ceviche', icon: 'seafood', category: 'Cuisine' },
        { text: 'french bistro', icon: 'croissant', category: 'Cuisine' },
        { text: 'fried chicken', icon: 'plate', category: 'Cuisine' },
        { text: 'deep dish pizza', icon: 'pasta', category: 'Cuisine' },
        { text: 'thai curry', icon: 'curry', category: 'Cuisine' },
        { text: 'lobster roll', icon: 'seafood', category: 'Cuisine' },
        { text: 'gyoza and beer', icon: 'dumpling', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'romantic date night', icon: 'heart', category: 'Vibe' },
        { text: 'cozy rainy day spot', icon: 'moon', category: 'Vibe' },
        { text: 'lively group dinner', icon: 'usersThree', category: 'Vibe' },
        { text: 'quiet solo dining', icon: 'user', category: 'Vibe' },
        { text: 'outdoor patio vibes', icon: 'patio', category: 'Vibe' },
        { text: 'hidden gem off the beaten path', icon: 'diamond', category: 'Vibe' },
        { text: 'upscale special occasion', icon: 'starFull', category: 'Vibe' },
        { text: 'casual neighborhood spot', icon: 'home', category: 'Vibe' },
        { text: 'live music and dinner', icon: 'music', category: 'Vibe' },
        { text: 'pet-friendly patio', icon: 'pet', category: 'Vibe' },
        { text: 'late night after-hours', icon: 'moon', category: 'Vibe' },
        { text: 'business lunch meeting', icon: 'briefcase', category: 'Vibe' },
        { text: 'celebration dinner', icon: 'starFull', category: 'Vibe' },
        { text: 'chill hangout with friends', icon: 'usersThree', category: 'Vibe' },
        { text: 'moody speakeasy cocktails', icon: 'cocktail', category: 'Vibe' },
      ],
      combos: [
        { text: 'tacos and margaritas on a patio', icon: 'taco', category: 'Combo' },
        { text: 'ramen and sake late night', icon: 'noodles', category: 'Combo' },
        { text: 'sushi and natural wine', icon: 'sushi', category: 'Combo' },
        { text: 'steak and whiskey date night', icon: 'meat', category: 'Combo' },
        { text: 'pizza and craft beer casual', icon: 'pasta', category: 'Combo' },
        { text: 'brunch with bottomless mimosas', icon: 'brunch', category: 'Combo' },
        { text: 'oysters and champagne', icon: 'seafood', category: 'Combo' },
        { text: 'pasta and red wine cozy', icon: 'pasta', category: 'Combo' },
        { text: 'dim sum and tea weekend', icon: 'dumpling', category: 'Combo' },
        { text: 'coffee and pastry morning', icon: 'coffee', category: 'Combo' },
        { text: 'curry and naan family style', icon: 'curry', category: 'Combo' },
        { text: 'burger and milkshake classic', icon: 'burger', category: 'Combo' },
        { text: 'bbq and cold beer outdoor', icon: 'meat', category: 'Combo' },
        { text: 'noodles and dumplings comfort', icon: 'noodles', category: 'Combo' },
        { text: 'ceviche and pisco sour', icon: 'seafood', category: 'Combo' },
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
    chipPool: {
      cuisine: ['butter chicken fix', 'biryani feast', 'dosa morning', 'chaat crawl', 'tandoori night', 'thali spread', 'paneer perfection', 'kebab platter', 'dal makhani', 'pani puri stop'],
      vibe: ['spice market energy', 'chai and conversation', 'family-style sharing', 'warm and fragrant', 'bustling and vibrant', 'homestyle cooking', 'weekend feast', 'street food adventure', 'cozy and aromatic', 'celebratory spread'],
      style: ['modern Indian fusion', 'traditional thali', 'south Indian breakfast', 'Indo-Chinese', 'royal Mughlai', 'regional specialties', 'vegetarian paradise', 'fresh naan counter', 'mithai and sweets', 'mango lassi vibes'],
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
    chipPool: {
      cuisine: ['momo house', 'dal bhat done right', 'thukpa warming', 'choila platter', 'sel roti', 'Newari feast', 'yak butter tea', 'gundruk soup', 'Sherpa stew', 'chow mein spot'],
      vibe: ['mountain comfort', 'quiet tea spot', 'hearty and warming', 'simple and honest', 'trekker fuel', 'peaceful dining', 'community kitchen', 'highland flavors', 'cozy retreat', 'shared table'],
      style: ['Newari specialties', 'Tibetan kitchen', 'Himalayan fusion', 'street momo stand', 'traditional feast', 'teahouse vibes', 'seasonal mountain food', 'fermented flavors', 'hand-pulled noodles', 'butter tea ritual'],
      time: {
        morning: ['morning tea', 'tibetan bread', 'sel roti breakfast', 'chiya and biscuit', 'simple dal bhat'],
        lunch: ['momo lunch', 'dal bhat power', 'thukpa bowl', 'set lunch', 'noodle soup'],
        afternoon: ['chai break', 'momo snack', 'tea and samosa', 'afternoon rest', 'milk tea'],
        dinner: ['Newari feast night', 'momo dinner', 'dal bhat evening', 'hearty stew', 'choila spread'],
        latenight: ['late momo run', 'warm thukpa', 'midnight noodles', 'tea and comfort', 'night dal bhat'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'momo steamed or fried', icon: 'dumpling', category: 'Cuisine' },
        { text: 'dal bhat set', icon: 'plate', category: 'Cuisine' },
        { text: 'thukpa noodle soup', icon: 'noodles', category: 'Cuisine' },
        { text: 'choila spiced meat', icon: 'meat', category: 'Cuisine' },
        { text: 'sel roti sweet bread', icon: 'croissant', category: 'Cuisine' },
        { text: 'Newari feast', icon: 'plate', category: 'Cuisine' },
        { text: 'gundruk soup', icon: 'plate', category: 'Cuisine' },
        { text: 'Sherpa stew', icon: 'plate', category: 'Cuisine' },
        { text: 'chow mein', icon: 'noodles', category: 'Cuisine' },
        { text: 'yak butter tea', icon: 'coffee', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'mountain comfort food', icon: 'home', category: 'Vibe' },
        { text: 'quiet tea spot', icon: 'coffee', category: 'Vibe' },
        { text: 'hearty and warming', icon: 'moon', category: 'Vibe' },
        { text: 'peaceful highland dining', icon: 'diamond', category: 'Vibe' },
        { text: 'trekker fuel stop', icon: 'plate', category: 'Vibe' },
        { text: 'community kitchen', icon: 'usersThree', category: 'Vibe' },
        { text: 'cozy teahouse retreat', icon: 'moon', category: 'Vibe' },
        { text: 'simple honest food', icon: 'home', category: 'Vibe' },
      ],
      combos: [
        { text: 'momos and butter tea afternoon', icon: 'dumpling', category: 'Combo' },
        { text: 'dal bhat and achar', icon: 'plate', category: 'Combo' },
        { text: 'thukpa and momos warming', icon: 'noodles', category: 'Combo' },
        { text: 'choila and sel roti feast', icon: 'meat', category: 'Combo' },
        { text: 'chiya and biscuit morning', icon: 'coffee', category: 'Combo' },
        { text: 'Newari feast with the crew', icon: 'plate', category: 'Combo' },
        { text: 'noodle soup and dumplings', icon: 'noodles', category: 'Combo' },
        { text: 'mountain stew and bread', icon: 'plate', category: 'Combo' },
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
    chipPool: {
      cuisine: ['omakase counter', 'late night ramen', 'handmade soba', 'izakaya night', 'sushi bar', 'tonkotsu broth', 'gyoza and beer', 'udon shop', 'tempura bar', 'wagyu experience'],
      vibe: ['quiet contemplation', 'counter seating', 'minimalist beauty', 'seasonal menu', 'sake pairing', 'wabi-sabi charm', 'precision and craft', 'zen atmosphere', 'tucked-away spot', 'tea ceremony calm'],
      style: ['kaiseki tasting', 'robata grill', 'donburi bowl', 'matcha everything', 'tsukemen dip', 'yakitori alley', 'shochu selection', 'bento artistry', 'Japanese curry', 'mochi dessert'],
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
    chipPool: {
      cuisine: ['jollof that hits', 'suya and drinks', 'oxtail stew', 'injera spread', 'pepper soup', 'fufu and egusi', 'plantain everything', 'jerk chicken', 'waakye plate', 'pounded yam'],
      vibe: ['live music and plates', 'soul food energy', 'community table', 'afrobeats and food', 'comfort that slaps', 'vibrant and loud', 'family gathering', 'celebration energy', 'cookout vibes', 'good music good food'],
      style: ['modern African fusion', 'West African kitchen', 'soul food classic', 'Caribbean twist', 'Ethiopian spread', 'Nigerian homestyle', 'Senegalese flavors', 'Ghanaian street food', 'Southern comfort', 'diaspora kitchen'],
      time: {
        morning: ['ackee and saltfish', 'plantain breakfast', 'beignets and coffee', 'grits and greens', 'morning porridge'],
        lunch: ['jollof rice plate', 'quick suya wrap', 'lunch combo', 'rice and stew', 'afro-fusion bowl'],
        afternoon: ['chin chin snack', 'meat pie stop', 'puff puff break', 'ginger drink', 'palm wine chill'],
        dinner: ['suya night out', 'full spread', 'oxtail dinner', 'pepper soup evening', 'asun and vibes'],
        latenight: ['late night jollof', 'after-party eats', 'midnight suya', 'comfort food run', 'late plantain fix'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'jollof rice', icon: 'plate', category: 'Cuisine' },
        { text: 'suya skewers', icon: 'meat', category: 'Cuisine' },
        { text: 'oxtail stew', icon: 'meat', category: 'Cuisine' },
        { text: 'fufu and egusi', icon: 'plate', category: 'Cuisine' },
        { text: 'pepper soup', icon: 'plate', category: 'Cuisine' },
        { text: 'fried plantain', icon: 'plate', category: 'Cuisine' },
        { text: 'jerk chicken', icon: 'meat', category: 'Cuisine' },
        { text: 'injera and wot', icon: 'plate', category: 'Cuisine' },
        { text: 'pounded yam', icon: 'plate', category: 'Cuisine' },
        { text: 'fried chicken', icon: 'plate', category: 'Cuisine' },
        { text: 'waakye plate', icon: 'plate', category: 'Cuisine' },
        { text: 'asun peppered goat', icon: 'meat', category: 'Cuisine' },
        { text: 'egusi soup', icon: 'plate', category: 'Cuisine' },
        { text: 'grits and greens', icon: 'plate', category: 'Cuisine' },
        { text: 'beignets', icon: 'croissant', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'soul food comfort', icon: 'home', category: 'Vibe' },
        { text: 'live music and plates', icon: 'music', category: 'Vibe' },
        { text: 'community table gathering', icon: 'usersThree', category: 'Vibe' },
        { text: 'afrobeats and dinner', icon: 'music', category: 'Vibe' },
        { text: 'vibrant celebration energy', icon: 'starFull', category: 'Vibe' },
        { text: 'cookout vibes outdoor', icon: 'patio', category: 'Vibe' },
        { text: 'comfort that hits different', icon: 'heart', category: 'Vibe' },
        { text: 'modern African fusion', icon: 'diamond', category: 'Vibe' },
        { text: 'diaspora kitchen hidden gem', icon: 'diamond', category: 'Vibe' },
        { text: 'late night soul food', icon: 'moon', category: 'Vibe' },
      ],
      combos: [
        { text: 'jollof and plantain feast', icon: 'plate', category: 'Combo' },
        { text: 'suya and drinks night out', icon: 'meat', category: 'Combo' },
        { text: 'oxtail and rice and peas', icon: 'meat', category: 'Combo' },
        { text: 'fufu and egusi with the crew', icon: 'plate', category: 'Combo' },
        { text: 'pepper soup and pounded yam', icon: 'plate', category: 'Combo' },
        { text: 'fried chicken and greens', icon: 'plate', category: 'Combo' },
        { text: 'injera spread family style', icon: 'plate', category: 'Combo' },
        { text: 'afrobeats and good plates', icon: 'music', category: 'Combo' },
        { text: 'plantain breakfast and coffee', icon: 'plate', category: 'Combo' },
        { text: 'meat pie and ginger drink', icon: 'meat', category: 'Combo' },
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
    chipPool: {
      cuisine: ['ceviche spot', 'taco al pastor', 'empanadas y mate', 'asado for the crew', 'birria tacos', 'arepas con queso', 'mole that slaps', 'tamales caseros', 'pupusas spot', 'elote and esquites'],
      vibe: ['pisco sour night', 'fiesta energy', 'familia gathering', 'salsa and flavors', 'vibrant patio', 'warm hospitality', 'street food crawl', 'mercado vibes', 'weekend asado', 'barrio favorite'],
      style: ['Peruvian Nikkei', 'Mexican cantina', 'Argentine parrilla', 'Colombian homestyle', 'Brazilian churrasco', 'Cuban sandwich spot', 'Oaxacan mole house', 'cevicheria fresh', 'churros y chocolate', 'horchata y tacos'],
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
    loadingPhrases: ['Searching', 'Discovering', 'Seeking', 'Exploring'],
    placeholders: [
      'smoky shawarma with garlic sauce...',
      'fresh hummus and warm pita...',
      'a full mezze spread for the table...',
      'kebab platter with saffron rice...',
    ],
    smartChips: ['shawarma spot', 'mezze spread', 'fresh falafel', 'kebab platter', 'baklava and tea'],
    suggestions: [
      'shawarma spot', 'mezze spread', 'fresh falafel', 'kebab platter', 'baklava and tea',
      'hummus and pita', 'lamb kofta', 'Persian rice', 'Turkish breakfast', 'manakeesh',
      'fattoush salad', 'kibbeh', 'shakshuka', 'labneh dip', 'kunafa dessert',
    ],
    chipPool: {
      cuisine: ['shawarma spot', 'mezze spread', 'falafel wrap', 'kebab platter', 'hummus and pita', 'lamb kofta', 'Persian rice', 'manakeesh', 'kibbeh plate', 'fattoush bowl'],
      vibe: ['communal table', 'tea and conversation', 'spice market warmth', 'family gathering', 'rooftop hookah', 'bustling bazaar', 'warm hospitality', 'cozy lantern-lit', 'celebration feast', 'leisurely dinner'],
      style: ['Lebanese kitchen', 'Turkish grill', 'Persian feast', 'Israeli street food', 'Moroccan tagine', 'Egyptian koshari', 'Syrian specialties', 'Greek taverna', 'Afghan kabob', 'Mediterranean fresh'],
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
  eastasian: {
    vibe: "What's the mood?",
    hood: 'Where to?',
    blurb: 'The Story',
    prompt: 'What sounds good?',
    placeholder: 'xiao long bao and jasmine tea...',
    cta: 'Find It',
    again: 'Try Again',
    share: 'Share',
    profile: 'About This Spot',
    insiderTip: 'Hidden Gem',
    loadingPhrases: ['Searching', 'Exploring', 'Discovering', 'Finding'],
    placeholders: [
      'xiao long bao and jasmine tea...',
      'crispy Peking duck for the table...',
      'a bowl of pho that heals the soul...',
      'pad thai from the best wok in town...',
    ],
    smartChips: ['dim sum brunch', 'late night pho', 'Sichuan heat', 'wok-fried noodles', 'boba and bites'],
    suggestions: [
      'dim sum brunch', 'late night pho', 'Sichuan heat', 'wok-fried noodles', 'boba and bites',
      'xiao long bao', 'Peking duck', 'pad thai', 'banh mi spot', 'Korean BBQ',
      'hot pot night', 'spring rolls', 'congee morning', 'laksa bowl', 'mango sticky rice',
    ],
    chipPool: {
      cuisine: ['dim sum spread', 'pho bowl', 'pad thai', 'xiao long bao', 'Peking duck', 'Korean BBQ', 'banh mi spot', 'wonton noodles', 'Sichuan mapo tofu', 'spring rolls'],
      vibe: ['family-style sharing', 'bustling Chinatown', 'quiet noodle shop', 'night market energy', 'tea ceremony calm', 'wok fire and smoke', 'communal hot pot', 'street food crawl', 'elegant banquet', 'cozy dumpling house'],
      style: ['Cantonese classics', 'Sichuan heat', 'Thai street food', 'Vietnamese pho house', 'Korean BBQ grill', 'Filipino homestyle', 'Chinese-American fusion', 'hand-pulled noodles', 'dim sum cart', 'hot pot feast'],
      time: {
        morning: ['congee and youtiao', 'dim sum brunch', 'banh mi breakfast', 'boba and pastry', 'rice porridge'],
        lunch: ['quick pho', 'noodle soup', 'banh mi lunch', 'rice plate combo', 'dumpling set'],
        afternoon: ['boba tea stop', 'mango sticky rice', 'egg tart treat', 'milk tea break', 'spring roll snack'],
        dinner: ['hot pot night', 'Peking duck feast', 'Korean BBQ', 'pad thai dinner', 'banquet spread'],
        latenight: ['late night pho', 'midnight dumplings', 'after-hours noodles', 'wonton soup', 'late congee'],
      },
    },
    suggestionCorpus: {
      cuisines: [
        { text: 'xiao long bao', icon: 'dumpling', category: 'Cuisine' },
        { text: 'Peking duck', icon: 'meat', category: 'Cuisine' },
        { text: 'pho bo', icon: 'noodles', category: 'Cuisine' },
        { text: 'pad thai', icon: 'noodles', category: 'Cuisine' },
        { text: 'dim sum spread', icon: 'dumpling', category: 'Cuisine' },
        { text: 'Korean BBQ', icon: 'meat', category: 'Cuisine' },
        { text: 'mapo tofu', icon: 'curry', category: 'Cuisine' },
        { text: 'banh mi', icon: 'plate', category: 'Cuisine' },
        { text: 'wonton noodles', icon: 'noodles', category: 'Cuisine' },
        { text: 'hot pot', icon: 'plate', category: 'Cuisine' },
        { text: 'spring rolls', icon: 'plate', category: 'Cuisine' },
        { text: 'laksa', icon: 'noodles', category: 'Cuisine' },
        { text: 'congee', icon: 'plate', category: 'Cuisine' },
        { text: 'char siu pork', icon: 'meat', category: 'Cuisine' },
        { text: 'mango sticky rice', icon: 'plate', category: 'Cuisine' },
      ],
      vibes: [
        { text: 'family-style banquet', icon: 'usersThree', category: 'Vibe' },
        { text: 'bustling Chinatown spot', icon: 'diamond', category: 'Vibe' },
        { text: 'quiet noodle shop', icon: 'user', category: 'Vibe' },
        { text: 'night market energy', icon: 'moon', category: 'Vibe' },
        { text: 'communal hot pot', icon: 'usersThree', category: 'Vibe' },
        { text: 'wok fire and smoke', icon: 'meat', category: 'Vibe' },
        { text: 'tea garden calm', icon: 'coffee', category: 'Vibe' },
        { text: 'street food adventure', icon: 'diamond', category: 'Vibe' },
        { text: 'elegant dim sum brunch', icon: 'starFull', category: 'Vibe' },
        { text: 'late night noodle run', icon: 'moon', category: 'Vibe' },
      ],
      combos: [
        { text: 'dim sum and jasmine tea', icon: 'dumpling', category: 'Combo' },
        { text: 'pho and spring rolls', icon: 'noodles', category: 'Combo' },
        { text: 'Peking duck and pancakes', icon: 'meat', category: 'Combo' },
        { text: 'pad thai and Thai iced tea', icon: 'noodles', category: 'Combo' },
        { text: 'Korean BBQ and soju', icon: 'meat', category: 'Combo' },
        { text: 'hot pot feast with friends', icon: 'plate', category: 'Combo' },
        { text: 'banh mi and Vietnamese coffee', icon: 'plate', category: 'Combo' },
        { text: 'dumplings and cold beer', icon: 'dumpling', category: 'Combo' },
        { text: 'congee and youtiao morning', icon: 'plate', category: 'Combo' },
        { text: 'boba and egg tarts', icon: 'coffee', category: 'Combo' },
      ],
    },
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

/** Instant theme swap — no wash overlay. Used during compass drag/browse. */
let skipWash = false;
export function setThemeInstant(culture, mode) {
  skipWash = true;
  setState({ theme: { culture, mode } });
  skipWash = false;
}

let isFirstApply = true;

function applyTheme(culture, mode) {
  const root = document.documentElement;
  const wash = document.getElementById('theme-wash');

  // Subtle crossfade wash transition (skip on first load, skip during compass browse)
  if (!isFirstApply && !skipWash && wash && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Apply new theme to wash div first, then crossfade
    wash.setAttribute('data-theme', culture);
    wash.setAttribute('data-mode', mode);
    wash.classList.add('theme-wash--active');

    // After crossfade completes, apply to root and hide wash
    setTimeout(() => {
      root.setAttribute('data-theme', culture);
      root.setAttribute('data-mode', mode);
      wash.classList.remove('theme-wash--active');
    }, 160);
  } else {
    root.setAttribute('data-theme', culture);
    root.setAttribute('data-mode', mode);
  }

  isFirstApply = false;

  // Update labels
  const labels = getLabels(culture);
  applyLabels(labels);

  // Update compass node active state
  document.querySelectorAll('.culture-compass__node').forEach(node => {
    const isActive = node.dataset.theme === culture;
    node.setAttribute('aria-checked', String(isActive));
    node.classList.toggle('culture-compass__node--active', isActive);
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
