/**
 * DondeAI Command Center — Score Validation Grading System
 * Two independent quality grades computed per test result:
 *   1. Score Fit Grade: Does the DondeScore accurately reflect restaurant-query fit?
 *   2. Blurb Quality Grade: Is the recommendation text high-quality and relevant?
 *
 * Grading scale: A+ (97-100), A (93-96), A- (90-92), B+ (87-89), B (83-86),
 *   B- (80-82), C+ (77-79), C (73-76), C- (70-72), D (60-69), F (<60)
 *
 * Pass requires ALL THREE: DM >= 70, Score Fit >= B- (80), Blurb Quality >= B- (80)
 */

// ═══════════════════════════════════════════════════════════════════
// Letter Grade Mapping
// ═══════════════════════════════════════════════════════════════════

function letterGrade(score) {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

function gradeColor(grade) {
  if (grade.startsWith('A')) return 'green';
  if (grade.startsWith('B')) return 'blue';
  if (grade.startsWith('C')) return 'amber';
  return 'red';
}

// ═══════════════════════════════════════════════════════════════════
// Query Intent Classification
// ═══════════════════════════════════════════════════════════════════

const CUISINE_MAP = {
  italian: ['italian', 'pasta', 'pizza', 'risotto'],
  japanese: ['japanese', 'sushi', 'ramen', 'izakaya', 'omakase', 'tempura', 'udon'],
  chinese: ['chinese', 'dim sum', 'dumpling', 'szechuan', 'sichuan', 'cantonese', 'wonton'],
  korean: ['korean', 'bibimbap', 'bulgogi', 'kimchi'],
  mexican: ['mexican', 'taco', 'burrito', 'enchilada', 'mole', 'tamale'],
  thai: ['thai', 'pad thai', 'curry', 'tom yum'],
  indian: ['indian', 'tikka', 'biryani', 'naan', 'samosa', 'vindaloo', 'masala'],
  french: ['french', 'bistro', 'brasserie', 'fondue', 'crêpe', 'croissant'],
  mediterranean: ['mediterranean', 'greek', 'hummus', 'falafel', 'shawarma'],
  american: ['american', 'burger', 'bbq', 'barbecue', 'steakhouse', 'wings'],
  seafood: ['seafood', 'lobster', 'crab', 'oyster', 'fish'],
  caribbean: ['caribbean', 'jamaican', 'cuban', 'jerk'],
  vietnamese: ['vietnamese', 'pho', 'banh mi'],
  ethiopian: ['ethiopian', 'injera'],
  peruvian: ['peruvian', 'ceviche'],
  taiwanese: ['taiwanese', 'boba'],
  southern: ['southern', 'soul food', 'fried chicken', 'hot chicken'],
};

const VIBE_KEYWORDS = [
  'rooftop', 'speakeasy', 'dive bar', 'jazz', 'tiki', 'karaoke', 'cozy',
  'romantic', 'date night', 'upscale', 'casual', 'trendy', 'chill',
  'lively', 'intimate', 'hidden', 'outdoor', 'patio', 'garden',
  'sports bar', 'lounge', 'cocktail', 'wine bar',
];

const SERVICE_KEYWORDS = [
  'brunch', 'happy hour', 'prix fixe', 'tasting menu', 'omakase',
  'byob', 'delivery', 'takeout', 'catering', 'private dining',
  'group', 'large party', 'family', 'kid friendly', 'dog friendly',
  'outdoor seating', 'valet', 'walk-in', 'reservation', 'late night',
  'bottomless', 'power lunch', 'business',
];

function classifyQueryIntent(query) {
  const q = query.toLowerCase();

  // Check for cuisine intent
  for (const [cuisine, keywords] of Object.entries(CUISINE_MAP)) {
    if (keywords.some(kw => q.includes(kw))) {
      return { type: 'cuisine', cuisine, keywords: keywords.filter(kw => q.includes(kw)) };
    }
  }

  // Check for dish intent (specific food items not tied to a cuisine)
  const dishPatterns = [
    'deep dish', 'thin crust', 'smash burger', 'grain bowl', 'acai',
    'charcuterie', 'fondue', 'hand roll', 'soup dumpling', 'truffle',
    'lobster bisque', 'fried chicken', 'hot chicken',
  ];
  const dishMatch = dishPatterns.find(d => q.includes(d));
  if (dishMatch) return { type: 'dish', dish: dishMatch, keywords: [dishMatch] };

  // Check for vibe intent
  const vibeMatch = VIBE_KEYWORDS.filter(v => q.includes(v));
  if (vibeMatch.length > 0) return { type: 'vibe', keywords: vibeMatch };

  // Check for service intent
  const serviceMatch = SERVICE_KEYWORDS.filter(s => q.includes(s));
  if (serviceMatch.length > 0) return { type: 'service', keywords: serviceMatch };

  // Generic / unclassifiable
  return { type: 'general', keywords: q.split(/\s+/).filter(w => w.length > 3) };
}

// ═══════════════════════════════════════════════════════════════════
// Score Fit Grade
// ═══════════════════════════════════════════════════════════════════

function computeScoreFitGrade(query, response) {
  const details = [];
  let total = 0;

  const scoring = response.scoring_v9 || response.scores || {};
  const dm = response.donde_match || 0;
  const narrative = response.match_narrative || {};
  const restaurant = response.restaurant || {};
  const intent = classifyQueryIntent(query);

  // --- Check 1: Relevance type alignment (30 pts) ---
  const relType = (scoring.relevance_type || '').toLowerCase();
  let relPoints = 0;

  if (intent.type === 'dish') {
    if (relType === 'dish' || relType === 'dish_match') relPoints = 30;
    else if (relType === 'cuisine' || relType === 'cuisine_match') relPoints = 15;
    else relPoints = 5;
  } else if (intent.type === 'cuisine') {
    if (relType === 'cuisine' || relType === 'cuisine_match') relPoints = 30;
    else if (relType === 'dish' || relType === 'dish_match') relPoints = 15;
    else relPoints = 5;
  } else if (intent.type === 'vibe') {
    if (relType === 'vibe' || relType.includes('vibe') || relType.includes('atmosphere')) relPoints = 30;
    else if (relType.includes('semantic') || relType.includes('concept')) relPoints = 20;
    else relPoints = 10;
  } else if (intent.type === 'service') {
    if (relType.includes('service') || relType.includes('feature') || relType.includes('semantic')) relPoints = 30;
    else relPoints = 15;
  } else {
    // General queries — any relevance type is fine
    relPoints = 20;
  }
  total += relPoints;
  details.push({ check: 'Relevance alignment', points: relPoints, max: 30, note: `intent=${intent.type}, relType=${relType}` });

  // --- Check 2: Cuisine match (25 pts) ---
  let cuisinePoints = 0;
  if (intent.type === 'cuisine' || intent.type === 'dish') {
    const restCuisine = (restaurant.cuisine_type || '').toLowerCase();
    if (intent.cuisine) {
      // Direct cuisine match
      if (restCuisine.includes(intent.cuisine) || intent.keywords.some(kw => restCuisine.includes(kw))) {
        cuisinePoints = 25;
      } else {
        // Check cuisine family (e.g., "Chinese" includes "Taiwanese")
        const families = { chinese: ['taiwanese', 'dim sum'], italian: ['pizza'], american: ['burger', 'bbq', 'southern'], caribbean: ['jamaican', 'cuban'] };
        const family = families[intent.cuisine] || [];
        if (family.some(f => restCuisine.includes(f))) cuisinePoints = 15;
        else cuisinePoints = 0;
      }
    } else if (intent.dish) {
      // Dish query — check if restaurant type makes sense
      const dishCuisineMap = {
        'deep dish': ['italian', 'pizza', 'american'],
        'soup dumpling': ['chinese', 'taiwanese', 'dim sum'],
        'hand roll': ['japanese', 'sushi'],
        'truffle': ['italian', 'french', 'american'],
        'lobster bisque': ['seafood', 'french', 'american'],
        'smash burger': ['american', 'burger'],
        'fondue': ['french', 'swiss'],
        'charcuterie': ['french', 'italian', 'wine'],
        'acai': ['brazilian', 'health', 'juice', 'cafe'],
        'grain bowl': ['health', 'cafe', 'american'],
        'fried chicken': ['american', 'southern', 'korean'],
        'hot chicken': ['american', 'southern'],
      };
      const expected = dishCuisineMap[intent.dish] || [];
      if (expected.length === 0 || expected.some(e => restCuisine.includes(e))) cuisinePoints = 25;
      else cuisinePoints = 5;
    }
  } else {
    // Non-food queries — cuisine match not applicable, award full points
    cuisinePoints = 25;
  }
  total += cuisinePoints;
  details.push({ check: 'Cuisine match', points: cuisinePoints, max: 25, note: `restaurant=${restaurant.cuisine_type || 'unknown'}` });

  // --- Check 3: Dominant factor alignment (25 pts) ---
  let factorPoints = 0;
  const food = Number(scoring.food) || 0;
  const vibe = Number(scoring.vibe) || 0;
  const service = Number(scoring.service) || 0;
  const factors = { food, vibe, service };
  const maxFactor = Math.max(food, vibe, service);

  if (intent.type === 'dish' || intent.type === 'cuisine') {
    if (food === maxFactor && food >= 6) factorPoints = 25;
    else if (food >= 6) factorPoints = 15;
    else if (food >= 4) factorPoints = 5;
  } else if (intent.type === 'vibe') {
    if (vibe === maxFactor && vibe >= 6) factorPoints = 25;
    else if (vibe >= 6) factorPoints = 15;
    else if (vibe >= 4) factorPoints = 5;
  } else if (intent.type === 'service') {
    if (service === maxFactor && service >= 6) factorPoints = 25;
    else if (service >= 6) factorPoints = 15;
    else if (service >= 4) factorPoints = 5;
  } else {
    // General — any dominant factor is fine
    factorPoints = maxFactor >= 6 ? 20 : 10;
  }
  total += factorPoints;
  details.push({ check: 'Factor alignment', points: factorPoints, max: 25, note: `food=${food}, vibe=${vibe}, service=${service}` });

  // --- Check 4: Score compression penalty (10 pts) ---
  let compressionPoints = 0;
  const relScore = Number(scoring.relevance_score) || 0;
  if (dm >= 70 && dm <= 85 && relScore < 0.6) {
    compressionPoints = 0; // Inflated score — low relevance but mid-high DM
  } else if (relScore >= 0.8) {
    compressionPoints = 10;
  } else {
    compressionPoints = Math.round((relScore - 0.5) * 33.3); // Linear 0.5→0, 0.8→10
    compressionPoints = Math.max(0, Math.min(10, compressionPoints));
  }
  total += compressionPoints;
  details.push({ check: 'Score compression', points: compressionPoints, max: 10, note: `dm=${dm}, relevance=${relScore.toFixed(2)}` });

  // --- Check 5: Weak spots coherence (10 pts) ---
  let weakPoints = 0;
  const weakSpots = narrative.weak_spots;
  const hasWeakSpots = weakSpots && (Array.isArray(weakSpots) ? weakSpots.length > 0 : !!weakSpots);

  if (!hasWeakSpots) {
    weakPoints = 10; // No weak spots = clean match
  } else if (hasWeakSpots && dm >= 80) {
    weakPoints = 5; // Suspicious: high score but weak spots reported
  } else {
    weakPoints = 10; // Appropriate: weak spots with moderate/low score
  }
  total += weakPoints;
  details.push({ check: 'Weak spots coherence', points: weakPoints, max: 10, note: hasWeakSpots ? 'weak spots present' : 'clean' });

  const grade = letterGrade(total);
  return { score: total, grade, details, intent };
}

// ═══════════════════════════════════════════════════════════════════
// Blurb Quality Grade
// ═══════════════════════════════════════════════════════════════════

function computeBlurbQualityGrade(query, response) {
  const details = [];
  let total = 0;

  const blurb = response.recommendation || '';
  const blurbLower = blurb.toLowerCase();
  const intent = classifyQueryIntent(query);
  const restaurant = response.restaurant || {};

  // --- Check 1: Slop-free (25 pts) ---
  const slopHits = (typeof BANNED_PATTERNS !== 'undefined' ? BANNED_PATTERNS : [])
    .filter(p => blurbLower.includes(p.toLowerCase()));
  let slopPoints;
  if (slopHits.length === 0) slopPoints = 25;
  else if (slopHits.length === 1) slopPoints = 15;
  else if (slopHits.length === 2) slopPoints = 5;
  else slopPoints = 0;
  total += slopPoints;
  details.push({ check: 'Slop-free', points: slopPoints, max: 25, note: slopHits.length > 0 ? `found: ${slopHits.slice(0, 3).join(', ')}` : 'clean' });

  // --- Check 2: Query relevance (25 pts) ---
  const queryWords = intent.keywords || query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const stopWords = [
    'best', 'good', 'great', 'nice', 'find', 'want', 'looking', 'near',
    'restaurant', 'food', 'place', 'chicago', 'partnership', 'close',
    'financial', 'area', 'spot', 'around', 'dinner', 'lunch', 'breakfast',
    'meal', 'dining', 'really', 'like', 'just', 'that', 'this', 'with',
    'from', 'have', 'very', 'some', 'what', 'where', 'here', 'there',
  ];
  let significantWords = queryWords.filter(w => !stopWords.includes(w));

  // Compound neighborhood detection — if query mentions a known neighborhood,
  // give relevance credit if blurb or restaurant matches that neighborhood
  const queryLower = query.toLowerCase();
  const restNeighborhood = (restaurant.neighborhood_name || '').toLowerCase();
  let neighborhoodRelevanceBonus = 0;
  const knownNeighborhoods = [
    'west loop', 'lincoln park', 'wicker park', 'logan square', 'river north',
    'old town', 'lakeview', 'pilsen', 'hyde park', 'bucktown', 'andersonville',
    'chinatown', 'bridgeport', 'ukrainian village', 'gold coast', 'south loop',
    'north center', 'ravenswood', 'rogers park', 'edgewater', 'uptown',
    'humboldt park', 'avondale', 'irving park', 'albany park',
  ];
  for (const hood of knownNeighborhoods) {
    if (queryLower.includes(hood)) {
      const hoodWords = hood.split(/\s+/);
      significantWords = significantWords.filter(w => !hoodWords.includes(w));
      if (blurbLower.includes(hood) || restNeighborhood.includes(hood) ||
          (restNeighborhood && blurbLower.includes(restNeighborhood))) {
        neighborhoodRelevanceBonus = 15;
      }
      break;
    }
  }

  let relevancePoints = 0;
  if (significantWords.length === 0 && neighborhoodRelevanceBonus > 0) {
    relevancePoints = 25; // Neighborhood-only query with matching neighborhood
  } else if (significantWords.length === 0) {
    relevancePoints = 15; // Generic query — hard to judge relevance
  } else {
    const matchCount = significantWords.filter(w => blurbLower.includes(w.toLowerCase())).length;
    const matchRatio = matchCount / significantWords.length;
    if (matchRatio >= 0.8) relevancePoints = 25;
    else if (matchRatio >= 0.5) relevancePoints = 15;
    else if (matchRatio >= 0.2) relevancePoints = 5;
    else relevancePoints = 0;
    relevancePoints = Math.min(25, relevancePoints + neighborhoodRelevanceBonus);
  }
  total += relevancePoints;
  details.push({ check: 'Query relevance', points: relevancePoints, max: 25, note: `${significantWords.length} key terms` });

  // --- Check 3: Restaurant specificity (20 pts) ---
  let specificityPoints = 0;
  const specificitySignals = [];

  // Check for specific dish names
  const restName = (restaurant.name || '').toLowerCase();
  if (restName && blurbLower.includes(restName.split(/\s+/)[0])) specificitySignals.push('name');

  // Check for numbers (prices, ratings, years)
  if (/\$\d+|\d{4}|rated \d|\d\.\d/.test(blurb)) specificitySignals.push('specifics');

  // Check for proper nouns (capitalized words not at sentence start)
  const properNouns = blurb.match(/(?<=[.!?]\s+|,\s+)\b[A-Z][a-z]+\b/g) || [];
  if (properNouns.length > 0) specificitySignals.push('proper_nouns');

  // Check for descriptive adjectives (not generic)
  const specificAdj = ['charred', 'crispy', 'smoky', 'tangy', 'spicy', 'creamy', 'buttery', 'flaky', 'tender', 'rich', 'bright', 'bold'];
  if (specificAdj.some(adj => blurbLower.includes(adj))) specificitySignals.push('descriptive');

  // Check for neighborhood/location mentions
  const neighborhoods = ['west loop', 'lincoln park', 'wicker park', 'logan square', 'river north', 'old town', 'lakeview', 'pilsen', 'hyde park', 'bucktown', 'andersonville', 'chinatown', 'bridgeport', 'ukrainian village'];
  if (neighborhoods.some(n => blurbLower.includes(n))) specificitySignals.push('neighborhood');

  if (specificitySignals.length >= 3) specificityPoints = 20;
  else if (specificitySignals.length === 2) specificityPoints = 15;
  else if (specificitySignals.length === 1) specificityPoints = 10;
  else specificityPoints = 5;
  total += specificityPoints;
  details.push({ check: 'Specificity', points: specificityPoints, max: 20, note: specificitySignals.join(', ') || 'generic' });

  // --- Check 4: Voice compliance — "we"/"our" (15 pts) ---
  const hasVoice = /\bwe\b|\bour\b/i.test(blurb);
  const voicePoints = hasVoice ? 15 : 0;
  total += voicePoints;
  details.push({ check: 'Voice (we/our)', points: voicePoints, max: 15, note: hasVoice ? 'compliant' : 'missing' });

  // --- Check 5: Word count (15 pts) ---
  const wordCount = blurb.split(/\s+/).filter(w => w.length > 0).length;
  let wordPoints;
  if (wordCount >= 100 && wordCount <= 120) wordPoints = 15;
  else if (wordCount >= 80 && wordCount <= 130) wordPoints = 10;
  else if (wordCount >= 60 && wordCount <= 150) wordPoints = 5;
  else wordPoints = 0;
  total += wordPoints;
  details.push({ check: 'Word count', points: wordPoints, max: 15, note: `${wordCount} words` });

  const grade = letterGrade(total);
  return { score: total, grade, details, slopHits, wordCount, hasVoice };
}

// ═══════════════════════════════════════════════════════════════════
// Composite Pass Check
// ═══════════════════════════════════════════════════════════════════

function gradePass(dm, scoreFitScore, blurbQualityScore) {
  return dm >= 70 && scoreFitScore >= 80 && blurbQualityScore >= 80;
}

// ═══════════════════════════════════════════════════════════════════
// Grade Summary for Run Aggregation
// ═══════════════════════════════════════════════════════════════════

function computeGradeDistribution(results) {
  const dist = { 'A+': 0, 'A': 0, 'A-': 0, 'B+': 0, 'B': 0, 'B-': 0, 'C+': 0, 'C': 0, 'C-': 0, 'D': 0, 'F': 0 };
  for (const r of results) {
    const fg = letterGrade(r.scoreFitScore || 0);
    dist[fg] = (dist[fg] || 0) + 1;
  }
  return dist;
}
