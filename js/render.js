/* ============================================
   DondeAI — Render Module
   All result rendering, Tier 1/2, photos, modals,
   canvas spots, share, toast, empty state.
   ============================================ */

import { getState, setState } from './state.js';
import {
  $dom, _escHtml, haptic, HAPTICS, pushTimer, clearAnimationTimers, getAnimationTimers,
  setPendingResultData, setPendingCuisine, setTier2Prepared, setTier2Animated,
  isTier2Prepared, isTier2Animated, getPendingResultData, getPendingCuisine,
  REDUCED_MOTION
} from './globals.js';
import {
  svgIcon, getCuisineFromResult, getScoreTier, getScoreThresholdColor,
  buildMapsUrl, relativeTime, matchCuisine, humanizeSnake
} from './utils.js';
import {
  renderScoreHero, renderRelevanceGate, resetBloomState
} from './animations.js';
import { setTheme, revertAutoTheme, setWashOrigin, getLabels } from './theme.js';
import {
  isBookmarked, loadBookmarks, loadVisits, loadFeedback, isVisited
} from './persistence.js';
import { fetchBlurb } from './api.js';
import { announce } from './accessibility.js';

/* ---- Module-local state ---- */
let _activePopout = null;
let _popoutTimer = null;
let _activeInfoStream = null;
let _blurbRevealAbort = null;
const BLURB_REVEAL_GATE_MS = 1200;
let _peekShown = false;
let toastTimer = null;

/* ---- Culture-Aware Toast Strings ---- */
export function toasts() {
  return getLabels(getState().theme.culture).toasts;
}

/* ---- Toast ---- */
export function showToast(message, isError = false, action = null) {
  if (!$dom.toast || !$dom.toastText) return;

  if (toastTimer) clearTimeout(toastTimer);

  $dom.toastText.textContent = message;
  $dom.toast.classList.toggle('toast--error', isError);
  $dom.toast.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  $dom.toast.setAttribute('role', isError ? 'alert' : 'status');

  const $dismiss = document.getElementById('toast-dismiss');
  if ($dismiss) {
    $dismiss.style.display = isError ? 'flex' : 'none';
  }

  const $action = document.getElementById('toast-action');
  if ($action) {
    if (action) {
      $action.textContent = action.label;
      $action.onclick = () => { dismissToast(); action.callback(); };
      $action.style.display = '';
    } else {
      $action.style.display = 'none';
      $action.onclick = null;
    }
  }

  const duration = action ? 10000 : isError ? 6000 : 3500;
  $dom.toast.style.setProperty('--toast-dur', `${duration}ms`);
  $dom.toast.classList.add('toast--visible');

  toastTimer = setTimeout(() => dismissToast(), duration);
}

export function dismissToast() {
  if (!$dom.toast) return;
  $dom.toast.classList.add('toast--exiting');
  setTimeout(() => {
    $dom.toast.classList.remove('toast--visible', 'toast--exiting');
  }, 250);
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

/* ---- Inline Empty State ---- */
export function showEmptyState(message) {
  const $el = document.getElementById('empty-state');
  const $text = document.getElementById('empty-state-text');
  if (!$el || !$text) return;
  $text.textContent = message;
  $el.style.display = '';
}

export function clearEmptyState() {
  const $el = document.getElementById('empty-state');
  if ($el) $el.style.display = 'none';
}

/* ---- Sentiment Computation Helper ---- */
export function computeSentiment(r) {
  let pos = null, neu = null, neg = null;
  if (r.sentiment_positive != null && r.sentiment_negative != null && r.sentiment_neutral != null) {
    pos = r.sentiment_positive; neu = r.sentiment_neutral; neg = r.sentiment_negative;
  } else if (r.sentiment_breakdown) {
    const parts = r.sentiment_breakdown.toLowerCase();
    const posMatch = parts.match(/(\d+)%?\s*positive/);
    const neuMatch = parts.match(/(\d+)%?\s*neutral/);
    const negMatch = parts.match(/(\d+)%?\s*negative/);
    if (posMatch || neuMatch || negMatch) {
      pos = parseInt(posMatch?.[1] || '33', 10);
      neu = parseInt(neuMatch?.[1] || '34', 10);
      neg = parseInt(negMatch?.[1] || '33', 10);
    }
  } else if (r.sentiment_score != null) {
    const score = parseFloat(r.sentiment_score);
    if (!isNaN(score)) {
      pos = Math.round((score / 10) * 100);
      neg = Math.round((1 - score / 10) * 30);
      neu = 100 - pos - neg;
    }
  }
  return pos != null ? { pos, neu, neg } : null;
}

/* ---- Badge Value Shortener ---- */
export function shortenBadgeValue(value) {
  if (!value) return '';
  return value.split(/[,/;]/).at(0).trim();
}

/* ---- Spice Level Label ---- */
export function formatSpiceLevel(raw) {
  if (!raw) return '';
  const map = {
    none: 'Not spicy', mild: 'Mild', low: 'Mild',
    medium: 'Medium', moderate: 'Medium',
    hot: 'Spicy', high: 'Spicy', very_hot: 'Very spicy', extra_hot: 'Very spicy',
  };
  return map[raw.toLowerCase()] || humanizeSnake(raw);
}

/* ---- Humanize Scores ---- */
export function humanizeVibe(val) {
  if (val >= 9) return 'Outstanding';
  if (val >= 7.5) return 'Strong';
  if (val >= 5.5) return 'Good';
  if (val >= 3.5) return 'Moderate';
  return 'Low';
}

export function humanizeV2(val) {
  if (val >= 90) return 'Perfect';
  if (val >= 75) return 'Strong';
  if (val >= 60) return 'Good';
  if (val >= 40) return 'Fair';
  return 'Low';
}

/* ---- Normalize tag text ---- */
function normalizeTagText(text) {
  if (!text) return text;
  const normalized = text.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const words = normalized.split(/\s+/);
  const capped = words.length <= 3 ? words.join(' ') : words.slice(0, 3).join(' ');
  return capped.charAt(0).toUpperCase() + capped.slice(1).toLowerCase();
}

/* ---- Badge Popout Manager ---- */
export function getActivePopout() { return _activePopout; }

export function openBadgePopout(badgeEl) {
  closeBadgePopout();
  const popout = badgeEl.querySelector('.badge-popout');
  if (!popout) return;
  badgeEl.setAttribute('aria-expanded', 'true');
  document.body.appendChild(popout);
  popout.classList.add('badge-popout--open');
  _activePopout = { badge: badgeEl, popout };
  const timeout = popout.classList.contains('badge-popout--known-for') ? 8000 : 5000;
  _popoutTimer = setTimeout(() => closeBadgePopout(), timeout);
  requestAnimationFrame(() => positionPopout(badgeEl, popout));
}

export function closeBadgePopout() {
  if (_popoutTimer) { clearTimeout(_popoutTimer); _popoutTimer = null; }
  if (!_activePopout) return;
  const { badge, popout } = _activePopout;
  badge.setAttribute('aria-expanded', 'false');
  popout.classList.remove('badge-popout--open');
  popout.style.top = '';
  popout.style.left = '';
  popout.style.transformOrigin = '';
  badge.appendChild(popout);
  _activePopout = null;
}

function positionPopout(badgeEl, popout) {
  const br = badgeEl.getBoundingClientRect();
  const pw = popout.offsetWidth;
  const ph = popout.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 6;

  const scrollContainer = document.querySelector('.step[data-step="1"]');
  const scrollOffset = scrollContainer?.scrollTop || 0;

  let left = br.left;
  if (left + pw > vw - 8) left = vw - 8 - pw;
  if (left < 8) left = 8;

  let top = br.bottom + gap;
  let origin = 'top left';
  if (top + ph > vh - 8) {
    top = br.top - gap - ph;
    origin = 'bottom left';
  }

  popout.style.top = `${Math.round(top)}px`;
  popout.style.left = `${Math.round(left)}px`;
  popout.style.transformOrigin = origin;
}

/* ---- Render Glance Context (Cuisine + Open/Closed) ---- */
function renderGlanceContext(data) {
  const $ctx = document.getElementById('glance-context');
  if (!$ctx) return;
  $ctx.innerHTML = '';

  const r = data.restaurant || {};

  // Reserve pill with dropdown — mini version of Reserve tab
  const rl = data.reservation_links;
  if (rl?.primary) {
    const pill = document.createElement('span');
    pill.className = 'glance-context__pill glance-context__pill--reserve type-data--sm';
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    pill.setAttribute('aria-expanded', 'false');
    pill.setAttribute('aria-haspopup', 'true');
    pill.setAttribute('data-action', 'toggle-badge-popout');
    const platformName = rl.primary.platform.charAt(0).toUpperCase() + rl.primary.platform.slice(1);
    pill.innerHTML = `${svgIcon('calendar', 11)} Reserve`;

    // Build popout
    const popout = document.createElement('div');
    popout.className = 'badge-popout badge-popout--reserve';
    popout.setAttribute('role', 'tooltip');

    // Primary booking link
    const link = document.createElement('a');
    link.className = 'reserve-popout__link';
    link.href = rl.primary.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = rl.primary.display_name;
    popout.appendChild(link);

    // Availability slots
    if (rl.availability?.length) {
      const avail = document.createElement('div');
      avail.className = 'reserve-popout__avail';
      avail.innerHTML = `<span class="reserve-popout__label">Tonight</span>` +
        rl.availability.map(s =>
          `<span class="reserve-popout__slot">${_escHtml(s.time)}</span>`
        ).join('');
      popout.appendChild(avail);
    }

    // Reservation difficulty
    const diffLabels = { 'walk-in': 'Walk-ins welcome', 'walk_in_friendly': 'Walk-ins welcome', 'walk-in friendly': 'Walk-ins welcome', 'recommended': 'Reservations recommended', 'required': 'Reservations required', 'hard': 'Hard to book', 'hard_to_get': 'Hard to book' };
    const diff = rl.reservation_difficulty;
    if (diff && diffLabels[diff]) {
      const meta = document.createElement('span');
      meta.className = 'reserve-popout__meta';
      meta.textContent = diffLabels[diff];
      popout.appendChild(meta);
    }

    // Booking tip
    if (rl.booking_tip) {
      const tip = document.createElement('span');
      tip.className = 'reserve-popout__tip';
      tip.textContent = rl.booking_tip;
      popout.appendChild(tip);
    }

    // Phone fallback
    if (rl.fallback?.type === 'phone' && rl.fallback.value) {
      const phone = document.createElement('a');
      phone.className = 'reserve-popout__phone';
      phone.href = `tel:${rl.fallback.value}`;
      phone.innerHTML = `${svgIcon('phone', 11)} ${_escHtml(rl.fallback.value)}`;
      popout.appendChild(phone);
    }

    pill.appendChild(popout);
    $ctx.appendChild(pill);
  }

  const oh = r.opening_hours;
  if (oh?.open_now != null) {
    const pill = document.createElement('span');
    pill.className = `glance-context__pill ${oh.open_now ? 'glance-context__pill--open' : 'glance-context__pill--closed'} type-data--sm`;

    let todayHours = '';
    const hasHours = oh.weekday_text?.length > 0;
    if (hasHours) {
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayLine = oh.weekday_text.find(l => l.toLowerCase().startsWith(todayName));
      if (todayLine) {
        const ci = todayLine.indexOf(':');
        if (ci >= 0) {
          todayHours = todayLine.slice(ci + 1).trim()
            .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
            .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
            .replace(/\s*[–—-]\s*/g, '–');
        }
      }
    }

    const statusText = oh.open_now ? 'Open' : 'Closed';
    // Avoid "Closed · Closed" — only show today's hours if they're actual times, not just "Closed"
    const isTodayClosed = /^closed$/i.test(todayHours.trim());
    const hoursInline = (todayHours && !isTodayClosed) ? ` · ${todayHours}` : '';
    pill.innerHTML = `${svgIcon('clock', 11)} ${statusText}${hoursInline}`;

    if (hasHours) {
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.setAttribute('aria-expanded', 'false');
      pill.setAttribute('aria-haspopup', 'true');
      pill.setAttribute('data-action', 'toggle-badge-popout');
    } else {
      pill.style.cursor = 'default';
    }

    if (hasHours) {
      const popout = document.createElement('div');
      popout.className = 'badge-popout badge-popout--hours';
      popout.setAttribute('role', 'tooltip');
      const title = document.createElement('span');
      title.className = 'badge-popout__title';
      title.textContent = 'Hours';
      popout.appendChild(title);
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const table = document.createElement('div');
      table.className = 'hours-table';
      oh.weekday_text.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) return;
        const dayPart = line.slice(0, colonIdx).trim();
        const timePart = line.slice(colonIdx + 1).trim();
        const isToday = dayPart.toLowerCase() === today;
        const row = document.createElement('div');
        row.className = `hours-table__row${isToday ? ' hours-table__row--today' : ''}`;
        const dayEl = document.createElement('span');
        dayEl.className = 'hours-table__day';
        dayEl.textContent = dayPart.slice(0, 3);
        const timeEl = document.createElement('span');
        timeEl.className = 'hours-table__time';
        timeEl.textContent = timePart
          .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
          .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
          .replace(/\s*[–—-]\s*/g, ' – ');
        row.appendChild(dayEl);
        row.appendChild(timeEl);
        table.appendChild(row);
      });
      popout.appendChild(table);
      pill.appendChild(popout);
    }

    $ctx.appendChild(pill);
  } else if (r.best_times?.length) {
    const pill = document.createElement('span');
    pill.className = 'glance-context__pill glance-context__pill--static type-data--sm';
    // Handle string ("lunch.dinner") or array (["lunch","dinner"])
    const raw = Array.isArray(r.best_times) ? r.best_times : String(r.best_times).split(/[.,;/]+/);
    const times = raw.slice(0, 2).map(t =>
      t.trim().charAt(0).toUpperCase() + t.trim().slice(1).toLowerCase()
    ).filter(Boolean).join(' · ');
    if (times) {
      pill.innerHTML = `${svgIcon('clock', 11)} ${times}`;
      $ctx.appendChild(pill);
    }
  }

  // Share pill — accented CTA
  const sharePill = document.createElement('button');
  sharePill.className = 'glance-context__pill glance-context__pill--share type-data--sm';
  sharePill.setAttribute('data-action', 'share');
  sharePill.setAttribute('aria-label', 'Share this find');
  sharePill.innerHTML = `${svgIcon('shareNetwork', 11)} Share`;
  $ctx.appendChild(sharePill);
}

/* ---- Quick Actions ---- */
function renderQuickActions(data) {
  const r = data.restaurant;
  const $actions = document.getElementById('quick-actions');
  if (!$actions) return;
  $actions.innerHTML = '';
  const items = [];

  // Reserve moved to glance context pill with dropdown — no longer in quick actions

  if (r.website) {
    let hostname = 'Website';
    try { hostname = new URL(r.website).hostname.replace('www.', ''); } catch { /* keep fallback */ }
    items.push({ icon: 'globe', label: hostname, href: r.website });
  }

  if (r.phone) {
    items.push({ icon: 'phone', label: 'Call', href: `tel:${r.phone}` });
  }

  const shortAddr = r.address?.split(',')[0] || '';
  const rawHood = r.neighborhood_name || '';
  const hood = /^chicago$/i.test(rawHood.trim()) ? '' : rawHood;
  const navLabel = hood ? `${hood} \u00b7 ${shortAddr}` : shortAddr;
  const navUrl = r.google_place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.google_place_id}`
    : r.address ? buildMapsUrl(r.address) : null;
  if (navUrl && navLabel) {
    items.unshift({ icon: 'pin', label: navLabel, href: navUrl });
  }

  items.forEach(item => {
    const pill = item.href ? document.createElement('a') : document.createElement('span');
    pill.className = 'utility-pill type-data--sm';
    if (item.href) {
      pill.href = item.href;
      pill.target = item.href.startsWith('tel:') ? '_self' : '_blank';
      pill.rel = 'noopener noreferrer';
    }
    if (item.action) {
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.setAttribute('data-action', item.action);
    }
    pill.innerHTML = `${svgIcon(item.icon, 11)} ${item.label}`;
    $actions.appendChild(pill);
  });
  $actions.style.display = items.length > 0 ? '' : 'none';
}

/* ---- Result Meta ---- */
export function renderResultMeta(data) {
  const $meta = document.getElementById('result-context');
  if (!$meta) return;
  $meta.innerHTML = '';

  const r = data.restaurant || {};
  const dp = data.deep_context || {};

  const rawHood = r.neighborhood_name || '';
  const neighborhood = /^chicago$/i.test(rawHood.trim()) ? '' : rawHood;
  if (neighborhood) {
    const hoodPill = document.createElement('span');
    hoodPill.className = 'result-meta__pill type-data--sm';
    hoodPill.innerHTML = `${svgIcon('pin', 11)} ${neighborhood}`;
    $meta.appendChild(hoodPill);
  }

  if (r.cuisine_type) {
    const pill = document.createElement('span');
    pill.className = 'result-meta__pill type-data--sm';
    pill.innerHTML = `${svgIcon('plate', 11)} ${r.cuisine_type}`;
    $meta.appendChild(pill);
  }

  const oh = r.opening_hours;
  if (oh?.open_now != null) {
    const pill = document.createElement('span');
    pill.className = `result-meta__pill result-meta__pill--interactive ${oh.open_now ? 'result-meta__pill--open' : 'result-meta__pill--closed'} type-data--sm`;
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    pill.setAttribute('aria-expanded', 'false');
    pill.setAttribute('aria-haspopup', 'true');
    pill.setAttribute('data-action', 'toggle-badge-popout');
    pill.textContent = oh.open_now ? 'Open Now' : 'Closed';

    if (oh.weekday_text?.length) {
      const popout = document.createElement('div');
      popout.className = 'badge-popout badge-popout--hours';
      popout.setAttribute('role', 'tooltip');
      const title = document.createElement('span');
      title.className = 'badge-popout__title';
      title.textContent = 'Hours';
      popout.appendChild(title);
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const table = document.createElement('div');
      table.className = 'hours-table';
      oh.weekday_text.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) return;
        const dayPart = line.slice(0, colonIdx).trim();
        const timePart = line.slice(colonIdx + 1).trim();
        const isToday = dayPart.toLowerCase() === today;
        const row = document.createElement('div');
        row.className = `hours-table__row${isToday ? ' hours-table__row--today' : ''}`;
        const dayEl = document.createElement('span');
        dayEl.className = 'hours-table__day';
        dayEl.textContent = dayPart.slice(0, 3);
        const timeEl = document.createElement('span');
        timeEl.className = 'hours-table__time';
        timeEl.textContent = timePart
          .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
          .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
          .replace(/\s*[–—-]\s*/g, ' – ');
        row.appendChild(dayEl);
        row.appendChild(timeEl);
        table.appendChild(row);
      });
      popout.appendChild(table);
      pill.appendChild(popout);
    }

    $meta.appendChild(pill);
  }

  $meta.style.display = $meta.children.length > 0 ? '' : 'none';
}

/* ---- F1: Render Photos ---- */
export function renderPhotos(data) {
  const $photos = document.getElementById('result-photos');
  if (!$photos) return;
  const photoUrls = data.restaurant?.photo_urls;
  if (!photoUrls || photoUrls.length === 0) {
    $photos.style.display = 'none';
    return;
  }
  $photos.style.display = '';
  $photos.innerHTML = '';
  document.getElementById('photo-dots')?.remove();
  const urls = photoUrls.slice(0, 5);

  $photos.classList.remove('result-photos--hero');

  urls.forEach((url, i) => {
    const img = document.createElement('img');
    img.className = 'result-photos__img';
    img.src = url;
    img.alt = `${data.restaurant.name} photo ${i + 1}`;
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(urls, i));
    $photos.appendChild(img);
  });

  if (urls.length > 1) {
    const $count = document.createElement('span');
    $count.className = 'result-photos__count';
    $count.textContent = `1 / ${urls.length}`;
    $photos.appendChild($count);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Array.from($photos.querySelectorAll('.result-photos__img')).indexOf(entry.target);
          if (idx >= 0) $count.textContent = `${idx + 1} / ${urls.length}`;
        }
      }
    }, { root: $photos, threshold: 0.6 });
    $photos.querySelectorAll('.result-photos__img').forEach(img => observer.observe(img));

    let _kenBurnsTimer = null;
    const activateKenBurns = () => {
      if (_kenBurnsTimer) clearTimeout(_kenBurnsTimer);
      $photos.querySelectorAll('.result-photos__img--active').forEach(el =>
        el.classList.remove('result-photos__img--active'));
      _kenBurnsTimer = setTimeout(() => {
        if (REDUCED_MOTION.matches) return;
        const imgs = $photos.querySelectorAll('.result-photos__img');
        const visible = Array.from(imgs).find(img => {
          const r = img.getBoundingClientRect();
          const pr = $photos.getBoundingClientRect();
          return r.left >= pr.left - 10 && r.right <= pr.right + 10;
        });
        if (visible) visible.classList.add('result-photos__img--active');
      }, 3000);
    };
    $photos.addEventListener('scroll', () => activateKenBurns(), { passive: true });
    activateKenBurns();
  }

  let _photoSwipeTriggered = false;
  $photos.addEventListener('scroll', () => {
    if (!_photoSwipeTriggered) {
      _photoSwipeTriggered = true;
      haptic(HAPTICS.photoSwipe);
      setTimeout(() => { _photoSwipeTriggered = false; }, 500);
    }
  }, { passive: true });

  $photos.style.display = '';
}

/* ---- Photo Lightbox ---- */
export function openLightbox(urls, startIndex) {
  const $lightbox = document.getElementById('lightbox');
  const $track = document.getElementById('lightbox-track');
  const $counter = document.getElementById('lightbox-counter');
  if (!$lightbox || !$track) return;

  const sourceImg = document.querySelectorAll('.result-photos__img')[startIndex];
  if (sourceImg) sourceImg.style.viewTransitionName = 'donde-photo';

  const doOpen = () => {
    $track.innerHTML = '';
    urls.forEach((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Photo ${i + 1} of ${urls.length}`;
      img.draggable = false;
      if (i === startIndex) img.style.viewTransitionName = 'donde-photo';
      $track.appendChild(img);
    });

    $lightbox.style.display = '';
    if ($counter) $counter.textContent = `${startIndex + 1} / ${urls.length}`;
  };

  if (document.startViewTransition && !REDUCED_MOTION.matches) {
    const transition = document.startViewTransition(doOpen);
    transition.finished.then(() => {
      if (sourceImg) sourceImg.style.viewTransitionName = '';
    });
    haptic(HAPTICS.photoSnap);
  } else {
    doOpen();
  }

  requestAnimationFrame(() => {
    const target = $track.children[startIndex];
    if (target) target.scrollIntoView({ behavior: 'instant', inline: 'center' });
  });

  const updateCounter = () => {
    const scrollLeft = $track.scrollLeft;
    const slideWidth = $track.offsetWidth;
    const idx = Math.round(scrollLeft / slideWidth);
    if ($counter) $counter.textContent = `${Math.min(idx + 1, urls.length)} / ${urls.length}`;
  };
  $track.addEventListener('scroll', updateCounter, { passive: true });
  $lightbox._cleanup = () => $track.removeEventListener('scroll', updateCounter);

  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
  };
  document.addEventListener('keydown', onKey);
  $lightbox._keyCleanup = () => document.removeEventListener('keydown', onKey);

  document.body.style.overflow = 'hidden';

  $lightbox._prevFocus = document.activeElement;
  $lightbox.classList.add('lightbox--open');
  const $closeBtn = $lightbox.querySelector('[data-action="close-lightbox"]');
  if ($closeBtn) $closeBtn.focus();

  const onTab = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = $lightbox.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onTab);
  $lightbox._tabCleanup = () => document.removeEventListener('keydown', onTab);
}

export function closeLightbox() {
  const $lightbox = document.getElementById('lightbox');
  if (!$lightbox) return;

  const doClose = () => {
    $lightbox.style.display = 'none';
    $lightbox.classList.remove('lightbox--open');
    if ($lightbox._cleanup) $lightbox._cleanup();
    if ($lightbox._keyCleanup) $lightbox._keyCleanup();
    if ($lightbox._tabCleanup) $lightbox._tabCleanup();
    document.body.style.overflow = '';
    $lightbox.querySelectorAll('[style*="view-transition-name"]').forEach(el => {
      el.style.viewTransitionName = '';
    });
    if ($lightbox._prevFocus) {
      $lightbox._prevFocus.focus();
      $lightbox._prevFocus = null;
    }
  };

  if (document.startViewTransition && !REDUCED_MOTION.matches) {
    document.startViewTransition(doClose);
  } else {
    doClose();
  }
}

/* ---- Tile Expand Modal ---- */
export function openTileExpand(tileEl) {
  const $modal = document.getElementById('tile-expand');
  const $content = document.getElementById('tile-expand-content');
  if (!$modal || !$content) return;

  $content.innerHTML = '';
  const state = getState();
  const data = state.result;
  if (!data) return;

  if (tileEl.id === 'score-tile-donde') {
    const tier = getScoreTier(data.donde_match);
    const pct = Math.round(parseFloat(data.donde_match) || 80);
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (pct / 100) * circumference;
    const strokeColor = 'var(--ac)';
    $content.innerHTML = `
      <div class="score-tile__brand" aria-label="Donde Match">
        <svg class="score-tile__logo-mark" viewBox="0 0 32 44" width="20" height="28" aria-hidden="true">
          <path d="M10.5 1C10.5 1 10 8.5 12.5 11.5Q14 13 14.5 13.5"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M21.5 1C21.5 1 22 8.5 19.5 11.5Q18 13 17.5 13.5"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M16 13.5C22 11 29 14 28 21C27 27 19 29 16 31L16 34"
                fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
          <circle cx="16" cy="40" r="2.8" fill="var(--ac)"/>
        </svg>
        <span class="score-tile__wordmark" style="font-size: var(--text-sm);">
          <span class="score-tile__wordmark-d">D</span><span
            class="score-tile__wordmark-ond">ond</span><span
            class="score-tile__wordmark-e">e</span>
        </span>
        <span class="score-tile__score-label type-data--sm">Match<sup>\u2122</sup></span>
      </div>
      <div class="score-ring-wrap">
        <svg class="score-ring" viewBox="0 0 100 100">
          <circle class="score-ring__bg" cx="50" cy="50" r="45"></circle>
          <circle class="score-ring__fill" cx="50" cy="50" r="45"
            style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"></circle>
        </svg>
        <div class="score-ring__number">
          <span class="type-data--lg" style="font-size: var(--text-xl);">${pct}%</span>
        </div>
      </div>
      <span class="score-verdict type-structural--bold ${tier.cssClass}" style="font-size: var(--text-lg);">${tier.verdict}</span>`;
  } else if (tileEl.id === 'score-tile-radar') {
    const scores = data.scores || {};
    const dims = [
      { key: 'date_friendly_score',  label: 'Date',     icon: 'heart' },
      { key: 'group_friendly_score', label: 'Group',    icon: 'usersThree' },
      { key: 'family_friendly_score',label: 'Family',   icon: 'home' },
      { key: 'business_lunch_score', label: 'Business', icon: 'briefcase' },
      { key: 'solo_dining_score',    label: 'Solo',     icon: 'user' },
      { key: 'hole_in_wall_factor',  label: 'Gem',      icon: 'diamond' },
    ];
    const available = dims.filter(d => {
      const v = scores[d.key];
      return v != null && v !== '' && !isNaN(parseFloat(v));
    });
    const dimListHtml = available.map(d => {
      const val = Math.min(parseFloat(scores[d.key]) || 0, 10);
      const pct = (val / 10) * 100;
      return `
        <div class="tile-expand__dim">
          <span class="tile-expand__dim-icon">${svgIcon(d.icon, 16)}</span>
          <span class="tile-expand__dim-label type-data--sm">${d.label}</span>
          <div class="tile-expand__dim-bar">
            <div class="tile-expand__dim-fill" style="width: ${pct}%"></div>
          </div>
          <span class="tile-expand__dim-value type-data--sm">${humanizeVibe(val)}</span>
        </div>`;
    }).join('');

    $content.innerHTML = `
      <div class="score-tile__brand" aria-label="Donde Vibe" style="justify-content: center;">
        <svg class="score-tile__logo-mark" viewBox="0 0 32 44" width="20" height="28" aria-hidden="true">
          <path d="M10.5 1C10.5 1 10 8.5 12.5 11.5Q14 13 14.5 13.5"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M21.5 1C21.5 1 22 8.5 19.5 11.5Q18 13 17.5 13.5"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M16 13.5C22 11 29 14 28 21C27 27 19 29 16 31L16 34"
                fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
          <circle cx="16" cy="40" r="2.8" fill="var(--ac)"/>
        </svg>
        <span class="score-tile__wordmark" style="font-size: var(--text-sm);">
          <span class="score-tile__wordmark-d">D</span><span
            class="score-tile__wordmark-ond">ond</span><span
            class="score-tile__wordmark-e">e</span>
        </span>
        <span class="score-tile__score-label type-data--sm">Vibe<sup>\u2122</sup></span>
      </div>
      <div class="tile-expand__dims">${dimListHtml}</div>`;
  }

  $modal.classList.add('tile-expand--open');
  $modal.querySelector('.tile-expand__close')?.focus();
  announce(tileEl.id === 'score-tile-radar' ? 'Donde Vibe expanded' : 'Match details expanded');
}

export function closeTileExpand() {
  const $modal = document.getElementById('tile-expand');
  if ($modal) {
    $modal.classList.remove('tile-expand--open');
    document.querySelector('.score-tile--expandable')?.focus();
  }
}

/* ---- Dish Match Chip ---- */
export function renderDishMatchChip(data) {
  document.getElementById('dish-match-chip')?.remove();

  const sv9 = data.scoring_v9;

  if (sv9?.relevance_type === 'dish' && sv9.relevance_score >= 0.7) {
    const request = data.user_request || data.special_request || '';
    const chipText = request.length > 2 ? `Serves ${request}` : 'Dish Match';

    const chip = document.createElement('span');
    chip.id = 'dish-match-chip';
    chip.className = 'dish-match-chip type-data--sm';
    chip.textContent = chipText;
    chip.setAttribute('aria-label', `This restaurant matches your request: ${chipText}`);

    const $blurb = document.getElementById('donde-blurb');
    if ($blurb) $blurb.insertAdjacentElement('afterend', chip);
    return;
  }

  const menuSignal = sv9?.factor_details?.food?.review_quality?.signal ||
                     sv9?.factor_details?.food?.menu?.signal ||
                     data.scoring?.factor_details?.food?.menu?.signal;
  if (!menuSignal || menuSignal === 'No dish match' || menuSignal === 'No menu data' || menuSignal === 'No tag match') return;
  if (!menuSignal.includes('match') && !menuSignal.includes('Match')) return;

  const request = data.user_request || data.special_request || '';
  const chipText = request.length > 2 ? `Serves ${request}` : menuSignal;

  const chip = document.createElement('span');
  chip.id = 'dish-match-chip';
  chip.className = 'dish-match-chip type-data--sm';
  chip.textContent = chipText;
  chip.setAttribute('aria-label', `This restaurant matches your request: ${chipText}`);

  const $blurb = document.getElementById('donde-blurb');
  if ($blurb) $blurb.insertAdjacentElement('afterend', chip);
}

/* ---- Intent Boost Badge ---- */
export function renderIntentBoostBadge(data) {
  document.getElementById('intent-boost-badge')?.remove();

  const boost = data.intent_boost;
  if (!boost?.active) return;

  const $glanceHero = document.querySelector('.glance-hero');
  if (!$glanceHero) return;

  const badge = document.createElement('div');
  badge.id = 'intent-boost-badge';
  badge.className = 'boost-badge boost-badge--visible';
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  badge.setAttribute('aria-expanded', 'false');
  badge.setAttribute('aria-haspopup', 'true');

  const reason = boost.reason || 'Intent matched';
  badge.innerHTML = `
    <span class="boost-badge__icon">${svgIcon('bolt', 14)}</span>
    <span class="boost-badge__text type-data--sm">Boosted: ${reason}</span>
    <div class="boost-badge__popout" role="tooltip">
      <span class="badge-popout__title">Intent Boost</span>
      <div class="badge-popout__body">
        <div>Base score: <strong>${boost.base_score ?? data.donde_match}</strong></div>
        ${boost.boost_points != null ? `<div>Boost: <strong>+${boost.boost_points}</strong> pts</div>` : ''}
        <div class="boost-badge__reason">${reason}</div>
      </div>
    </div>`;

  $glanceHero.insertAdjacentElement('afterend', badge);

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    const popout = badge.querySelector('.badge-popout');
    const isOpen = badge.getAttribute('aria-expanded') === 'true';
    badge.setAttribute('aria-expanded', String(!isOpen));
    if (popout) popout.classList.toggle('badge-popout--open', !isOpen);
  });
}

/* ---- Relaxation Notice ---- */
export function renderRelaxationNotice(data) {
  document.getElementById('relaxation-notice')?.remove();

  const relaxation = data.relaxation_applied;
  if (!relaxation) return;

  if (!$dom.resultCard) return;

  const notice = document.createElement('div');
  notice.id = 'relaxation-notice';
  notice.className = 'relaxation-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const filterText = typeof relaxation === 'string' ? relaxation
    : Array.isArray(relaxation) ? relaxation.join(', ')
    : 'some filters';

  notice.innerHTML = `
    <span class="relaxation-notice__text type-structural">We expanded beyond ${filterText} to find your best match</span>
    <button class="relaxation-notice__dismiss" aria-label="Dismiss notice">&times;</button>`;

  const $showMore = $dom.resultCard.querySelector('.tell-more-btn');
  if ($showMore) {
    $showMore.parentNode.insertBefore(notice, $showMore);
  } else {
    $dom.resultCard.appendChild(notice);
  }

  notice.querySelector('.relaxation-notice__dismiss')?.addEventListener('click', () => {
    notice.classList.add('relaxation-notice--dismissing');
    notice.addEventListener('animationend', () => notice.remove(), { once: true });
  });

  pushTimer(setTimeout(() => {
    if (notice.parentNode) {
      notice.classList.add('relaxation-notice--dismissing');
      notice.addEventListener('animationend', () => notice.remove(), { once: true });
    }
  }, 5000));
}

/* ---- Map Preview ---- */
export function renderMapPreview(data) {
  const $glanceNav = document.getElementById('glance-nav');
  if ($glanceNav) $glanceNav.style.display = 'none';
}

/* ---- Bookmark Button State ---- */
export function updateBookmarkBtn(restaurantId) {
  const $btn = document.getElementById('bookmark-btn');
  if (!$btn) return;
  const saved = isBookmarked(restaurantId);
  $btn.querySelector('.bookmark-icon--outline').style.display = saved ? 'none' : '';
  $btn.querySelector('.bookmark-icon--filled').style.display = saved ? '' : 'none';
  $btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save this spot');
  $btn.classList.toggle('feedback-btn--active', saved);
}

/* ---- Feedback Button State ---- */
export function renderFeedbackState(restaurantId) {
  const existing = loadFeedback(restaurantId);
  document.querySelectorAll('.feedback-btn--like, .feedback-btn--dislike').forEach(btn => {
    btn.classList.toggle('feedback-btn--active', btn.dataset.feedback === existing);
  });
}

/* ---- Going Button State ---- */
export function updateGoingBtn(restaurantId) {
  const $btn = document.getElementById('going-btn');
  if (!$btn) return;
  const visited = isVisited(restaurantId);
  const labels = getLabels(getState().theme.culture);
  const $text = $btn.querySelector('.going-btn__text');
  if (visited) {
    $btn.classList.add('going-btn--done');
    if ($text) $text.textContent = labels.goingDone || "You're Going!";
    $btn.setAttribute('aria-label', labels.goingDone || "You're Going!");
  } else {
    $btn.classList.remove('going-btn--done');
    if ($text) $text.textContent = labels.goingHere || "I'm Going Here!";
    $btn.setAttribute('aria-label', labels.goingHere || "I'm Going Here!");
  }
}

/* ---- Saved Spots ---- */
export function renderSavedSpots() {
  const $container = document.getElementById('saved-spots');
  const $list = document.getElementById('saved-spots-list');
  if (!$container || !$list) return;
  const bookmarks = loadBookmarks();
  if (bookmarks.length === 0) {
    $container.style.display = 'none';
    return;
  }
  $list.innerHTML = '';
  bookmarks.slice(0, 5).forEach(b => {
    const item = document.createElement('button');
    item.className = 'saved-spot type-structural';
    item.innerHTML = `
      <span class="saved-spot__name">${b.name}</span>
      ${b.cuisine_type ? `<span class="saved-spot__meta type-data--sm">${b.cuisine_type}</span>` : ''}
    `;
    item.addEventListener('click', () => {
      if ($dom.cravingInput) {
        $dom.cravingInput.value = b.name;
        setState({ craving: b.name });
      }
    });
    $list.appendChild(item);
  });
  $container.style.display = '';
}

/* ---- Visited Spots ---- */
export function renderVisitedSpots() {
  const $container = document.getElementById('visited-spots');
  const $list = document.getElementById('visited-spots-list');
  if (!$container || !$list) return;
  const visits = loadVisits();
  if (visits.length === 0) {
    $container.style.display = 'none';
    return;
  }
  $list.innerHTML = '';
  visits.slice(0, 5).forEach(v => {
    const item = document.createElement('button');
    item.className = 'visited-spot type-structural';
    item.innerHTML = `
      <span class="visited-spot__pin type-data--sm">
        <svg viewBox="0 0 256 256" width="10" height="10"><path fill="currentColor" d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/></svg>
        Been
      </span>
      <span class="visited-spot__name">${v.name}</span>
      <span class="visited-spot__meta type-data--sm">${v.cuisine_type || v.neighborhood_name || ''}</span>
    `;
    $list.appendChild(item);
  });
  $container.style.display = '';
}

/* ---- Taste Memory ---- */
export function renderTasteMemory() {
  const $container = document.getElementById('taste-memory');
  const $list = document.getElementById('taste-memory-list');
  if (!$container || !$list) return;

  const { history } = getState();
  if (!history || history.length === 0) {
    $container.classList.remove('taste-memory--visible');
    return;
  }

  $list.innerHTML = '';
  history.slice(0, 3).forEach(entry => {
    const btn = document.createElement('button');
    btn.className = 'taste-memory__chip';
    btn.setAttribute('data-action', 'taste-memory');
    btn.setAttribute('data-payload', JSON.stringify(entry.payload));

    const iconHtml = entry.cuisineIcon
      ? `<span class="taste-memory__icon">${svgIcon(entry.cuisineIcon, 14)}</span>`
      : '';

    const label = entry.label.length > 22 ? entry.label.slice(0, 20) + '\u2026' : entry.label;
    const time = entry.timestamp ? relativeTime(entry.timestamp) : '';

    btn.innerHTML = `${iconHtml}<span>${label}</span>${time ? `<span class="taste-memory__time">${time}</span>` : ''}`;
    $list.appendChild(btn);
  });

  $container.classList.remove('taste-memory--visible');
  void $container.offsetWidth;
  $container.classList.add('taste-memory--visible');
}

/* ---- Your Spots (combined recent + saved + visited) ---- */
export function renderYourSpots() {
  const $container = document.getElementById('your-spots');
  const $list = document.getElementById('your-spots-list');
  if (!$container || !$list) return;

  $list.innerHTML = '';
  const items = [];

  const { history } = getState();
  if (history?.length > 0) {
    history.slice(0, 3).forEach(entry => {
      const label = entry.label.length > 20 ? entry.label.slice(0, 18) + '\u2026' : entry.label;
      const time = entry.timestamp ? relativeTime(entry.timestamp) : '';
      items.push({
        type: 'recent',
        icon: `<svg viewBox="0 0 256 256" width="12" height="12"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>`,
        label,
        meta: time,
        action: () => {
          if ($dom.cravingInput) {
            $dom.cravingInput.value = entry.payload?.special_request || entry.label;
            setState({ craving: $dom.cravingInput.value });
          }
        }
      });
    });
  }

  const bookmarks = loadBookmarks();
  bookmarks.slice(0, 3).forEach(b => {
    items.push({
      type: 'saved',
      icon: `<svg viewBox="0 0 256 256" width="12" height="12"><path fill="currentColor" d="M178,44c-21.44,0-39.92,10.19-50,27.07C117.92,54.19,99.44,44,78,44a58.07,58.07,0,0,0-58,58c0,28.59,18,58.47,53.4,88.79a333.81,333.81,0,0,0,52.7,36.73,4,4,0,0,0,3.8,0,333.81,333.81,0,0,0,52.7-36.73C218,160.47,236,130.59,236,102A58.07,58.07,0,0,0,178,44Z"/></svg>`,
      label: b.name.length > 18 ? b.name.slice(0, 16) + '\u2026' : b.name,
      meta: b.cuisine_type || '',
      action: () => {
        if ($dom.cravingInput) {
          $dom.cravingInput.value = b.name;
          setState({ craving: b.name });
        }
      }
    });
  });

  const visits = loadVisits();
  visits.slice(0, 3).forEach(v => {
    items.push({
      type: 'visited',
      icon: `<svg viewBox="0 0 256 256" width="12" height="12"><path fill="currentColor" d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`,
      label: v.name.length > 18 ? v.name.slice(0, 16) + '\u2026' : v.name,
      meta: v.cuisine_type || v.neighborhood_name || '',
      action: () => {
        if ($dom.cravingInput) {
          $dom.cravingInput.value = v.name;
          setState({ craving: v.name });
        }
      }
    });
  });

  if (items.length === 0) {
    $container.style.display = 'none';
    return;
  }

  items.slice(0, 6).forEach(item => {
    const btn = document.createElement('button');
    btn.className = `your-spots__chip your-spots__chip--${item.type}`;
    btn.innerHTML = `<span class="your-spots__icon">${item.icon}</span><span>${item.label}</span>${item.meta ? `<span class="your-spots__meta type-data--sm">${item.meta}</span>` : ''}`;
    btn.addEventListener('click', item.action);
    $list.appendChild(btn);
  });

  $container.style.display = '';
}

/* ---- InfoStream Class ---- */
class InfoStream {
  constructor($container, primaryItems, secondaryItems) {
    this.$container = $container;
    this.primaryItems = primaryItems;
    this.secondaryItems = secondaryItems;
    this.$secondary = null;
    this.visibleMeta = [];
    this.metaQueue = [];
    this.rotateIdx = 0;
    this.timer = null;
    this.paused = false;
    this._onPointerEnter = () => this.pause();
    this._onPointerLeave = () => this.resume();
  }

  start() {
    this.$container.innerHTML = '';

    if (this.secondaryItems.length > 0) {
      this.$secondary = document.createElement('div');
      this.$secondary.className = 'info-stream__secondary info-stream__secondary--capped';

      if (REDUCED_MOTION.matches) {
        this._renderSecondaryItems(this.secondaryItems);
      } else {
        const maxVisible = Math.min(6, this.secondaryItems.length);

        this.visibleMeta = this.secondaryItems.slice(0, maxVisible);
        this.metaQueue = this.secondaryItems.slice(maxVisible);
        this._renderSecondaryItems(this.visibleMeta);

        if (this.metaQueue.length > 0) {
          this.$secondary.addEventListener('pointerenter', this._onPointerEnter);
          this.$secondary.addEventListener('pointerleave', this._onPointerLeave);
          this.timer = setInterval(() => {
            if (!this.paused) this._rotateOneMeta();
          }, 4000);
        }
      }

      this.$container.appendChild(this.$secondary);
    }

    this.$container.style.display = this.secondaryItems.length > 0 ? '' : 'none';
  }

  _renderSecondaryItems(items) {
    this.$secondary.innerHTML = '';
    items.forEach((item, i) => {
      if (i > 0) {
        const dot = document.createElement('span');
        dot.className = 'info-stream__dot';
        dot.textContent = '\u00B7';
        this.$secondary.appendChild(dot);
      }
      const span = document.createElement('span');
      span.className = 'info-stream__meta';
      span.dataset.metaId = item.id;
      span.textContent = item.text;
      this.$secondary.appendChild(span);
    });
  }

  _rotateOneMeta() {
    if (this.metaQueue.length === 0) {
      const visIds = new Set(this.visibleMeta.map(it => it.id));
      this.metaQueue = this.secondaryItems.filter(it => !visIds.has(it.id));
      if (this.metaQueue.length === 0) return;
    }

    const slotIdx = this.rotateIdx % this.visibleMeta.length;
    this.rotateIdx++;

    const nextItem = this.metaQueue.shift();
    const oldItem = this.visibleMeta[slotIdx];

    const $metaSpans = this.$secondary.querySelectorAll('.info-stream__meta');
    const $el = $metaSpans[slotIdx];
    if (!$el) return;

    $el.classList.add('info-stream__meta--exiting');

    setTimeout(() => {
      this.metaQueue.push(oldItem);
      this.visibleMeta[slotIdx] = nextItem;
      $el.textContent = nextItem.text;
      $el.dataset.metaId = nextItem.id;
      $el.classList.remove('info-stream__meta--exiting');
    }, 300);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  destroy() {
    this.stop();
    if (this.$secondary) {
      this.$secondary.removeEventListener('pointerenter', this._onPointerEnter);
      this.$secondary.removeEventListener('pointerleave', this._onPointerLeave);
    }
    this.$container.innerHTML = '';
  }
}

/* ---- Collect Info Stream Items ---- */
function collectInfoStreamItems(data) {
  const items = [];
  const r = data.restaurant || {};
  const dc = data.deep_context || {};
  const dw = data.scoring?.weights_used || data.scoring_v9?.weights_used ||
    { food: 0.25, vibe: 0.20, service: 0.15, reputation: 0.20, convenience: 0.20 };

  const pw = dw.practical ?? dw.convenience ?? 0.20;
  const ow = dw.occasion ?? dw.service ?? 0.15;
  const cw = dw.craving ?? dw.food ?? 0.25;

  if (dc.review_value_score != null && dc.review_value_score >= 7) {
    items.push({ id: 'value', icon: 'heart', text: 'Great value', priority: dw.food * 0.5, category: 'practical' });
  }

  if (dc.check_average_per_person) {
    const notable = dc.check_average_per_person >= 60 ? 1.2 : 1.0;
    items.push({ id: 'price', icon: 'tag', text: `~$${dc.check_average_per_person}/pp`, priority: pw * 0.90 * notable, category: 'practical' });
  }

  if (dc.reservation_difficulty && dc.reservation_difficulty !== 'none') {
    const resMap = { easy: 'Walk-ins OK', moderate: 'Reserve ahead', hard: 'Hard to book' };
    const notable = dc.reservation_difficulty === 'hard' ? 1.5 : 1.0;
    items.push({ id: 'reserv', icon: 'calendar', text: resMap[dc.reservation_difficulty] || humanizeSnake(dc.reservation_difficulty), priority: pw * 0.85 * notable, category: 'practical' });
  }

  if (dc.typical_wait_minutes) {
    const notable = dc.typical_wait_minutes >= 20 ? 1.3 : 1.0;
    items.push({ id: 'wait', icon: 'clock', text: `~${dc.typical_wait_minutes} min wait`, priority: pw * 0.70 * notable, category: 'practical' });
  }

  if (dc.group_size_sweet_spot) {
    const range = dc.group_size_sweet_spot.replace(/[\[\]()]/g, '').replace(',', '-');
    items.push({ id: 'group', icon: 'usersThree', text: `Best for ${range}`, priority: pw * 0.50, category: 'practical' });
  }

  if (dc.transit_accessibility) {
    items.push({ id: 'transit', icon: 'train', text: dc.transit_accessibility, priority: pw * 0.35, category: 'practical' });
  }

  if (dc.energy_level != null) {
    const e = dc.energy_level;
    const notable = (e >= 8 || e <= 2) ? 1.3 : 1.0;
    items.push({ id: 'energy', icon: 'bolt', text: e >= 8 ? 'High energy' : e >= 5 ? 'Moderate' : 'Chill', priority: dw.vibe * 0.65 * notable, category: 'vibe' });
  }

  if (dc.cultural_authenticity != null) {
    const a = dc.cultural_authenticity;
    const notable = a >= 8 ? 1.2 : 1.0;
    items.push({ id: 'auth', icon: 'globe', text: a >= 8 ? 'Very Authentic' : a >= 5 ? 'Authentic' : 'Fusion', priority: dw.vibe * 0.55 * notable, category: 'vibe' });
  }

  if (dc.conversation_friendliness != null) {
    const c = dc.conversation_friendliness;
    const notable = c <= 3 ? 1.4 : 1.0;
    items.push({ id: 'noise', icon: 'chat', text: c >= 7 ? 'Great for convo' : c >= 4 ? 'Moderate' : 'Loud', priority: ow * 0.70 * notable, category: 'vibe' });
  }

  if (dc.spice_level && dc.spice_level !== 'none') {
    items.push({ id: 'spice', icon: 'fire', text: formatSpiceLevel(dc.spice_level), priority: cw * 0.55, category: 'vibe' });
  }

  const WOW_LABELS = {
    open_kitchen: 'Open kitchen', rooftop_skyline_view: 'Rooftop views',
    tableside_preparation: 'Tableside prep', secret_entrance: 'Secret entrance',
    live_cooking_show: 'Live cooking', river_view: 'River view',
    lake_view: 'Lake view', historic_building: 'Historic building',
    celebrity_chef: 'Celebrity chef', speakeasy_vibe: 'Speakeasy',
    garden_dining: 'Garden dining', fireplace: 'Fireplace',
    chef_interaction: 'Chef interaction',
  };
  const WOW_ICONS = {
    open_kitchen: 'forkKnife', rooftop_skyline_view: 'sun',
    tableside_preparation: 'plate', secret_entrance: 'diamond',
    live_cooking_show: 'fire', river_view: 'globe',
    lake_view: 'globe', historic_building: 'home',
    celebrity_chef: 'starFull', speakeasy_vibe: 'cocktail',
    garden_dining: 'patio', fireplace: 'fire',
    chef_interaction: 'user',
  };

  const wows = (dc.wow_factors || []).filter(w => w !== 'unique_decor').slice(0, 3);
  wows.forEach((w, i) => {
    const label = WOW_LABELS[w] || humanizeSnake(w);
    const icon = WOW_ICONS[w] || 'diamond';
    items.push({ id: `wow-${i}`, icon, text: label, priority: 0.3, category: 'discovery' });
  });

  const awards = data._awardBadges || [];
  awards.forEach((a, i) => {
    items.push({ id: `award-${i}`, icon: 'starFull', text: a, priority: 0.5, category: 'discovery' });
  });

  const scenarios = dc.best_for_scenarios || [];
  scenarios.slice(0, 3).forEach((s, i) => {
    items.push({ id: `scenario-${i}`, icon: 'heart', text: s, priority: 0.4, category: 'discovery' });
  });

  items.forEach(item => { item.text = normalizeTagText(item.text); });
  items.sort((a, b) => b.priority - a.priority);

  return items;
}

/* ---- Render Info Stream ---- */
function renderInfoStream(data) {
  const $container = document.getElementById('info-stream');
  if (!$container) return;

  if (_activeInfoStream) { _activeInfoStream.destroy(); _activeInfoStream = null; }

  const items = collectInfoStreamItems(data);

  if (items.length === 0) {
    $container.style.display = 'none';
    return;
  }

  const stream = new InfoStream($container, [], items);
  stream.start();
  _activeInfoStream = stream;
}

/* ---- Deep Context Extras ---- */
function renderDeepContextExtras(data) {
  const dc = data.deep_context;
  if (!dc) return;

  renderInfoStream(data);
  renderCuisineDetails(data);

  const $origin = document.getElementById('origin-story');
  const $originText = document.getElementById('origin-story-text');
  if ($origin && $originText && dc.origin_story) {
    $originText.textContent = dc.origin_story;
    $origin.style.display = '';
  } else if ($origin) {
    $origin.style.display = 'none';
  }
}

/* ---- Cuisine Chips (compact icon chips) ---- */
function _toTitleCase(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function _toSentenceCase(s) {
  if (!s) return '';
  const clean = s.replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function renderCuisineDetails(data) {
  const dp = data.deep_context || {};
  const $container = document.getElementById('cuisine-pills');
  if (!$container) return;

  const chipDefs = [];
  const r = data.restaurant || {};

  // --- Must Try: blend signature dishes (with why) + popular items ---
  const sigDishes = dp.signature_dishes?.slice(0, 3) || [];
  const highlights = (dp.menu_highlights || []).filter(h =>
    !sigDishes.some(d => d.dish.toLowerCase() === h.toLowerCase())
  ).slice(0, 4);
  if (sigDishes.length || highlights.length) {
    let idx = 0;
    const dishHTML = sigDishes.map(d =>
      `<div class="cuisine-chips__dish" style="animation-delay:${(idx++) * 40}ms">
        <span class="cuisine-chips__dish-name">${_escHtml(_toTitleCase(d.dish))}</span>
        ${d.why ? `<span class="cuisine-chips__dish-why">${_escHtml(_toSentenceCase(d.why))}</span>` : ''}
      </div>`
    ).join('');
    const pillHTML = highlights.length ? `<div class="cuisine-chips__items">${
      highlights.map(h =>
        `<span class="cuisine-chips__item" style="animation-delay:${(idx++) * 30}ms">${_escHtml(_toTitleCase(h))}</span>`
      ).join('')
    }</div>` : '';
    chipDefs.push({ label: 'Must Try', icon: 'forkKnife', body: dishHTML + pillHTML });
  }

  // --- Standout: wow factors ---
  if (dp.wow_factors?.length) {
    const bodyHTML = `<div class="cuisine-chips__items">${
      dp.wow_factors.slice(0, 5).map((w, i) =>
        `<span class="cuisine-chips__item" style="animation-delay:${i * 30}ms">${_escHtml(_toSentenceCase(w))}</span>`
      ).join('')
    }</div>`;
    chipDefs.push({ label: 'Standout', icon: 'bolt', body: bodyHTML });
  }

  // --- Best For: scenarios ---
  if (dp.best_for_scenarios?.length) {
    const bodyHTML = `<div class="cuisine-chips__items">${
      dp.best_for_scenarios.slice(0, 5).map((s, i) =>
        `<span class="cuisine-chips__item" style="animation-delay:${i * 30}ms">${_escHtml(_toTitleCase(s))}</span>`
      ).join('')
    }</div>`;
    chipDefs.push({ label: 'Best For', icon: 'calendar', body: bodyHTML });
  }

  // --- Reserve: booking links + difficulty + tip ---
  const rl = data.reservation_links;
  if (rl && (rl.primary || rl.fallback)) {
    let idx = 0;
    let bodyHTML = '';

    // Primary booking link
    if (rl.primary) {
      bodyHTML += `<a class="cuisine-chips__reserve-link" href="${_escHtml(rl.primary.url)}" target="_blank" rel="noopener noreferrer" style="animation-delay:${(idx++) * 40}ms">
        <span class="cuisine-chips__reserve-platform">${_escHtml(rl.primary.display_name)}</span>
      </a>`;
    }

    // Alternative platforms (compact)
    if (rl.alternatives?.length) {
      bodyHTML += `<div class="cuisine-chips__items" style="margin-top:4px">`;
      rl.alternatives.forEach(alt => {
        bodyHTML += `<a class="cuisine-chips__item cuisine-chips__reserve-alt" href="${_escHtml(alt.url)}" target="_blank" rel="noopener noreferrer" style="animation-delay:${(idx++) * 30}ms">${_escHtml(alt.display_name.replace('Reserve on ', ''))}</a>`;
      });
      bodyHTML += `</div>`;
    }

    // Reservation difficulty + booking tip
    const diffLabel = { 'walk-in': 'Walk-ins welcome', 'walk_in_friendly': 'Walk-ins welcome', 'walk-in friendly': 'Walk-ins welcome', 'recommended': 'Reservations recommended', 'required': 'Reservations required', 'hard': 'Hard to book', 'hard_to_get': 'Hard to book' };
    const diff = rl.reservation_difficulty;
    if (diff && diffLabel[diff]) {
      bodyHTML += `<div class="cuisine-chips__reserve-meta" style="animation-delay:${(idx++) * 30}ms">${_escHtml(diffLabel[diff])}</div>`;
    }
    if (rl.booking_tip) {
      bodyHTML += `<div class="cuisine-chips__reserve-tip" style="animation-delay:${(idx++) * 30}ms">${_escHtml(rl.booking_tip)}</div>`;
    }

    // Real-time availability slots (from Resy)
    if (rl.availability?.length) {
      const slotChips = rl.availability.map((s, si) =>
        `<span class="cuisine-chips__item cuisine-chips__reserve-slot" style="animation-delay:${(idx + si) * 30}ms">${_escHtml(s.time)}${s.type ? ` \u00b7 ${_escHtml(s.type)}` : ''}</span>`
      ).join('');
      idx += rl.availability.length;
      bodyHTML += `<div class="cuisine-chips__reserve-meta" style="animation-delay:${(idx++) * 30}ms">Available tonight</div>`;
      bodyHTML += `<div class="cuisine-chips__items" style="margin-top:2px">${slotChips}</div>`;
    }

    // Phone/walk-in fallback
    if (rl.fallback && rl.fallback.type === 'phone' && rl.fallback.value) {
      bodyHTML += `<a class="cuisine-chips__reserve-phone" href="tel:${_escHtml(rl.fallback.value)}" style="animation-delay:${(idx++) * 30}ms">${svgIcon('phone', 12)} ${_escHtml(rl.fallback.value)}</a>`;
    }

    chipDefs.push({ label: 'Reserve', icon: 'calendar', body: bodyHTML });
  }

  // --- Flavors ---
  if (dp.flavor_profiles?.length) {
    const bodyHTML = `<div class="cuisine-chips__items">${
      dp.flavor_profiles.slice(0, 5).map((f, i) =>
        `<span class="cuisine-chips__item" style="animation-delay:${i * 30}ms">${_escHtml(_toTitleCase(f))}</span>`
      ).join('')
    }</div>`;
    chipDefs.push({ label: 'Flavors', icon: 'wine', body: bodyHTML });
  }

  // --- Crowd ---
  if (dp.crowd_profile?.length) {
    const bodyHTML = `<div class="cuisine-chips__items">${
      dp.crowd_profile.slice(0, 4).map((c, i) =>
        `<span class="cuisine-chips__item" style="animation-delay:${i * 30}ms">${_escHtml(_toTitleCase(c))}</span>`
      ).join('')
    }</div>`;
    chipDefs.push({ label: 'Crowd', icon: 'usersThree', body: bodyHTML });
  }

  // --- Hours: weekly schedule ---
  const oh = r.opening_hours;
  if (oh?.weekday_text?.length) {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const rows = oh.weekday_text.map((line, i) => {
      const ci = line.indexOf(':');
      if (ci < 0) return '';
      const day = line.slice(0, ci).trim();
      const time = line.slice(ci + 1).trim()
        .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
        .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
        .replace(/\s*[–—-]\s*/g, ' – ');
      const isToday = day.toLowerCase() === todayName;
      return `<div class="cuisine-chips__hours-row${isToday ? ' cuisine-chips__hours-row--today' : ''}" style="animation-delay:${i * 30}ms">
        <span class="cuisine-chips__hours-day">${_escHtml(day.slice(0, 3))}</span>
        <span class="cuisine-chips__hours-time">${_escHtml(time)}</span>
      </div>`;
    }).join('');
    chipDefs.push({ label: 'Hours', icon: 'clock', body: `<div class="cuisine-chips__hours">${rows}</div>` });
  }

  // --- Awards ---
  if (dp.awards_recognition?.length) {
    const bodyHTML = `<div class="cuisine-chips__items">${
      dp.awards_recognition.slice(0, 4).map((a, i) =>
        `<span class="cuisine-chips__item" style="animation-delay:${i * 30}ms">${_escHtml(a)}</span>`
      ).join('')
    }</div>`;
    chipDefs.push({ label: 'Awards', icon: 'starFull', body: bodyHTML });
  }

  // --- Similar ---
  if (dp.comparable_restaurants?.length) {
    const bodyHTML = `<div class="cuisine-chips__items">${
      dp.comparable_restaurants.slice(0, 4).map((c, i) =>
        `<span class="cuisine-chips__item" style="animation-delay:${i * 30}ms">${_escHtml(c)}</span>`
      ).join('')
    }</div>`;
    chipDefs.push({ label: 'Similar', icon: 'heart', body: bodyHTML });
  }

  if (chipDefs.length === 0) {
    $container.style.display = 'none';
    return;
  }

  const chipsRow = chipDefs.map((c, i) =>
    `<button class="cuisine-chips__chip" role="tab" aria-selected="false"
            aria-controls="cuisine-panel-${i}" data-action="toggle-cuisine-chip" data-index="${i}">
      ${svgIcon(c.icon, 14)}
      <span class="cuisine-chips__label">${c.label}</span>
    </button>`
  ).join('');

  const panels = chipDefs.map((c, i) =>
    `<div class="cuisine-chips__panel" id="cuisine-panel-${i}" role="tabpanel" aria-hidden="true">${c.body}</div>`
  ).join('');

  $container.innerHTML =
    `<div class="cuisine-chips__row" role="tablist" aria-label="Menu details">${chipsRow}</div>${panels}`;
  $container.style.display = '';
}

/* ---- Score-First Blurb ---- */
function _writeBlurbText($rec, text) {
  let recText = text.replace(/\u2014/g, ', ').replace(/ , /g, ', ').replace(/,\s*,/g, ',');
  const fse = recText.search(/[.!?]\s/);
  if (fse > 10 && fse < recText.length - 5) {
    $rec.innerHTML = `<strong>${_escHtml(recText.slice(0, fse + 1))}</strong>${_escHtml(recText.slice(fse + 1))}`;
  } else {
    $rec.textContent = recText;
  }
}

function _animateBlurbIn($blurb, $rec) {
  if (!$blurb || !$blurb.classList.contains('donde-blurb--pending')) return;

  const $tier2 = document.getElementById('tier-leanin');
  const $tellMore = document.getElementById('tell-more-btn');

  if (REDUCED_MOTION.matches) {
    if ($tier2) { $tier2.classList.remove('tier--expanded'); $tier2.setAttribute('aria-hidden', 'true'); $tier2.style.maxHeight = ''; }
    $blurb.classList.remove('donde-blurb--pending');
    if ($tellMore) { $tellMore.style.display = ''; $tellMore.setAttribute('aria-expanded', 'false'); }
    return;
  }

  const collapseDuration = 450;
  if ($tier2 && $tier2.classList.contains('tier--expanded')) {
    $tier2.style.willChange = 'max-height, opacity';
    $tier2.style.maxHeight = $tier2.scrollHeight + 'px';
    void $tier2.offsetHeight;
    requestAnimationFrame(() => {
      $tier2.style.maxHeight = '0';
    });
    setTimeout(() => {
      $tier2.classList.remove('tier--expanded');
      $tier2.setAttribute('aria-hidden', 'true');
      $tier2.style.willChange = '';
    }, collapseDuration);
  }

  const blurbDelay = ($tier2 && $tier2.classList.contains('tier--expanded')) ? 200 : 0;
  setTimeout(() => {
    $blurb.classList.add('donde-blurb--measuring');
    const targetHeight = $blurb.scrollHeight;
    $blurb.classList.remove('donde-blurb--measuring');

    $blurb.style.height = '0px';
    $blurb.classList.remove('donde-blurb--pending');
    $blurb.classList.add('donde-blurb--arriving');

    requestAnimationFrame(() => {
      $blurb.style.height = targetHeight + 'px';

      $blurb.addEventListener('transitionend', function onExpand(e) {
        if (e.propertyName !== 'height') return;
        $blurb.removeEventListener('transitionend', onExpand);
        $blurb.style.height = '';
        $blurb.classList.remove('donde-blurb--arriving');

        $rec.classList.add('donde-blurb__text--revealing');
        $rec.addEventListener('animationend', () => {
          $rec.classList.remove('donde-blurb__text--revealing');
        }, { once: true });

        if ($tellMore) {
          $tellMore.style.display = '';
          $tellMore.style.opacity = '0';
          $tellMore.setAttribute('aria-expanded', 'false');
          requestAnimationFrame(() => {
            $tellMore.style.transition = 'opacity 300ms var(--ease-out)';
            $tellMore.style.opacity = '1';
            setTimeout(() => {
              $tellMore.style.transition = '';
              $tellMore.style.opacity = '';
            }, 350);
          });
        }
      }, { once: false });
    });
  }, blurbDelay);
}

export function _revealBlurb(data) {
  if (_blurbRevealAbort) _blurbRevealAbort.abort();
  _blurbRevealAbort = new AbortController();

  const restaurant = data.restaurant || {};
  const $rec = document.getElementById('result-recommendation');
  const $blurb = document.getElementById('donde-blurb');
  if (!$rec || !$blurb) return;

  const blurbPayload = {
    restaurant_data: {
      name: restaurant.name,
      cuisine_type: restaurant.cuisine_type,
      price_level: restaurant.price_level,
      neighborhood_name: restaurant.neighborhood_name,
      noise_level: restaurant.noise_level,
      lighting_ambiance: restaurant.lighting_ambiance,
      outdoor_seating: restaurant.outdoor_seating,
      tags: data.tags || [],
      deep_context: data.deep_context || {},
    },
    context: {
      special_request: getState().craving,
      occasion: getState().occasion,
      neighborhood: getState().neighborhood,
      score_tier: (() => {
        const s = data.donde_match || 0;
        if (s >= 90) return 'exceptional';
        if (s >= 80) return 'great';
        if (s >= 65) return 'good';
        if (s >= 50) return 'decent';
        return 'weak';
      })(),
      match_narrative: data.match_narrative || null,
    },
  };

  const fetchStart = performance.now();

  fetchBlurb(blurbPayload).then((blurbData) => {
    if (getState().result?.restaurant?.id !== restaurant.id) return;

    if (blurbData.recommendation) {
      _writeBlurbText($rec, blurbData.recommendation);
    }
    const $tip = document.getElementById('story-tip-text');
    if ($tip && blurbData.insider_tip) {
      $tip.textContent = blurbData.insider_tip.replace(/\u2014/g, ', ').replace(/ , /g, ', ');
    }
    if (blurbData.intent_boost?.active) {
      $blurb.classList.add('donde-blurb--boosted');
    }

    const elapsed = performance.now() - fetchStart;
    const delay = Math.max(0, BLURB_REVEAL_GATE_MS - elapsed);
    setTimeout(() => _animateBlurbIn($blurb, $rec), delay);

  }).catch((err) => {
    if (err.name === 'AbortError') return;
    console.warn('[Blurb Reveal] Claude fetch failed, revealing fallback:', err.message);
    const elapsed = performance.now() - fetchStart;
    const delay = Math.max(0, BLURB_REVEAL_GATE_MS - elapsed);
    setTimeout(() => _animateBlurbIn($blurb, $rec), delay);
  });
}

/* ---- Prepare Tier 2 DOM content ---- */
export function prepareTier2(data, cuisine) {
  const r = data.restaurant;

  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring || data.scoring_v9 || null,
    null,
    [],
    data.match_narrative || null
  );

  try {
    const $formulaContainer = document.getElementById('score-hero-formula');
    if ($formulaContainer && data.scoring_v9) {
      renderRelevanceGate(data.scoring_v9, $formulaContainer, [], data.intent_boost || null);
    }
  } catch (e) { console.warn('V9 formula row render failed:', e); }

  const $story = document.getElementById('restaurant-story');
  const $storyOrigin = document.getElementById('story-origin-text');
  const $storyTip = document.getElementById('story-tip-text');
  const $storyLabel = document.getElementById('story-label');
  const $tipWrap = document.getElementById('story-tip-wrap');
  if ($story) {
    const dc = data.deep_context || {};
    let tipContent = data.insider_tip || '';
    tipContent = tipContent.replace(/\u2014/g, ', ').replace(/ , /g, ', ');

    let originContent = dc.origin_story || '';

    const hasOrigin = !!originContent;
    const hasTip = !!tipContent;
    const hasContent = hasOrigin || hasTip;
    $story.style.display = hasContent ? '' : 'none';

    if ($storyLabel) {
      $storyLabel.textContent = hasOrigin ? 'The Story' : 'Insider Tip';
    }

    if ($storyOrigin) {
      $storyOrigin.textContent = originContent;
      $storyOrigin.style.display = hasOrigin ? '' : 'none';
    }

    if ($tipWrap) {
      $tipWrap.style.display = hasTip ? '' : 'none';
      const $tipLabel = $tipWrap.querySelector('.restaurant-story__tip-label');
      if ($tipLabel) $tipLabel.style.display = hasOrigin ? '' : 'none';
    }

    if ($storyTip && hasTip) {
      if (!$storyTip._hasRevealed) {
        $storyTip._hasRevealed = true;
        $storyTip.textContent = tipContent;
        if (!REDUCED_MOTION.matches) {
          $storyTip.classList.add('story-tip--revealing');
          pushTimer(setTimeout(() => {
            requestAnimationFrame(() => {
              $storyTip.classList.remove('story-tip--revealing');
            });
          }, 300));
        }
      } else {
        $storyTip.textContent = tipContent;
      }
    } else if ($storyTip) {
      $storyTip.textContent = '';
    }
  }

  data._awardBadges = [];
  const dc2 = data.deep_context;
  if (dc2?.awards_recognition?.length > 0) {
    data._awardBadges = dc2.awards_recognition.slice(0, 3);
  }

  renderDeepContextExtras(data);
}

/* ---- Tier 2 Animations ---- */
export function renderTier2Animations() {
  if (isTier2Animated()) return;
  setTier2Animated(true);
  haptic(HAPTICS.scoreReveal);

  const data = getPendingResultData();
  if (!data) return;

  resetBloomState();

  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring || data.scoring_v9 || null,
    null,
    getAnimationTimers(),
    data.match_narrative || null
  );
}

/* ══════════════════════════════════════════════════
   renderResult — Main Tier 1 orchestrator
   ══════════════════════════════════════════════════ */
export function renderResult(data) {
  if (!data?.restaurant) return;
  const r = data.restaurant;

  clearAnimationTimers();

  if (_activeInfoStream) { _activeInfoStream.destroy(); _activeInfoStream = null; }

  setTier2Animated(false);
  const $storyTipEl = document.getElementById('story-tip-text');
  if ($storyTipEl) $storyTipEl._hasRevealed = false;

  resetBloomState();

  const $tier2 = document.getElementById('tier-leanin');
  const $tellMore = document.getElementById('tell-more-btn');
  if ($tier2) { $tier2.classList.remove('tier--expanded'); $tier2.setAttribute('aria-hidden', 'true'); $tier2.style.maxHeight = ''; $tier2._transitioning = false; }
  if ($tellMore) { $tellMore.setAttribute('aria-expanded', 'false'); $tellMore.style.display = 'none'; const t = $tellMore.querySelector('.tell-more-btn__text'); if (t) t.textContent = 'See Match Details'; }

  const cuisine = getCuisineFromResult(data);

  if (cuisine.culture) {
    const $scoreRing = document.getElementById('score-hero-ring-fill') || document.getElementById('match-pill');
    if ($scoreRing) {
      const ringRect = $scoreRing.getBoundingClientRect();
      setWashOrigin(ringRect.left + ringRect.width / 2, ringRect.top + ringRect.height / 2);
    }
    setTheme(cuisine.culture, getState().theme.mode);
  } else {
    revertAutoTheme();
  }

  renderPhotos(data);

  if ($dom.resultCard && cuisine.hue !== null) {
    $dom.resultCard.classList.add('result-card--cuisine-accent');
    $dom.resultCard.style.setProperty('--cuisine-hue', cuisine.hue);
  } else if ($dom.resultCard) {
    $dom.resultCard.classList.remove('result-card--cuisine-accent');
  }

  // TIER 1: GLANCE
  const dondeScore = Math.round(parseFloat(data.donde_match) || 80);
  const $matchScore = document.getElementById('match-pill-score');
  const $matchVerdict = document.getElementById('match-pill-verdict');
  if ($matchScore) $matchScore.textContent = '0';
  const tier = getScoreTier(dondeScore);
  const $matchPill = document.getElementById('match-pill');
  if ($matchPill) $matchPill.setAttribute('data-tier', tier.tier);
  if ($matchVerdict) {
    $matchVerdict.textContent = tier.verdict;
    $matchVerdict.setAttribute('data-tier', tier.tier);
  }

  const $arcFill = document.getElementById('match-pill-arc-fill');
  const arcLength = Math.PI * 20;
  if ($arcFill) {
    $arcFill.style.transition = 'none';
    $arcFill.style.strokeDasharray = String(arcLength);
    $arcFill.style.strokeDashoffset = String(arcLength);
    $arcFill.style.stroke = getScoreThresholdColor(0);
  }

  const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
  if ($matchScore && !REDUCED_MQ.matches) {
    pushTimer(setTimeout(() => {
      const duration = 1200;
      const start = performance.now();
      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * dondeScore);
        $matchScore.textContent = current;
        const thresholdColor = getScoreThresholdColor(current);
        $matchScore.style.color = thresholdColor;
        if ($arcFill) {
          $arcFill.style.strokeDashoffset = String(arcLength - (current / 100) * arcLength);
          $arcFill.style.stroke = thresholdColor;
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          if ($arcFill) {
            $arcFill.style.animation = 'arcSettle 400ms var(--spring)';
          }
          const $pill = document.getElementById('match-pill');
          if ($pill) {
            $pill.style.transition = 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            $pill.style.transform = 'scale(1.03)';
            setTimeout(() => {
              $pill.style.transform = 'scale(1)';
            }, 120);
          }
        }
      };
      requestAnimationFrame(animate);
    }, 200));
  } else if ($matchScore) {
    $matchScore.textContent = dondeScore;
    const finalColor = getScoreThresholdColor(dondeScore);
    $matchScore.style.color = finalColor;
    if ($arcFill) {
      $arcFill.style.strokeDashoffset = String(arcLength - (dondeScore / 100) * arcLength);
      $arcFill.style.stroke = finalColor;
    }
  }

  const $name = document.getElementById('result-name');
  if ($name) $name.textContent = r.name || '';

  renderGlanceContext(data);
  renderQuickActions(data);

  if (r.id) updateBookmarkBtn(r.id);
  if (r.id) renderFeedbackState(r.id);
  if (r.id) updateGoingBtn(r.id);

  const $mismatch = document.getElementById('cuisine-mismatch-notice');
  if ($mismatch) {
    if (data.cuisine_mismatch?.requested) {
      const mismatchText = $mismatch.querySelector('.cuisine-mismatch-notice__text');
      if (mismatchText) {
        mismatchText.textContent = `We don\u2019t have ${data.cuisine_mismatch.requested} spots in our collection yet. Here\u2019s our best pick instead.`;
      }
      $mismatch.style.display = '';
    } else {
      $mismatch.style.display = 'none';
    }
  }

  renderRelaxationNotice(data);

  const $matchSignal = document.getElementById('match-signal');
  if ($matchSignal) $matchSignal.style.display = 'none';

  const $cravingEcho = document.getElementById('craving-echo');
  if ($cravingEcho) {
    const craving = getState().craving;
    $cravingEcho.textContent = craving ? `You asked for "${craving}"` : '';
  }

  const $rec = document.getElementById('result-recommendation');
  const $blurb = document.getElementById('donde-blurb');
  if ($rec) {
    let recText = (data.recommendation || '').replace(/\u2014/g, ', ').replace(/ , /g, ', ').replace(/,\s*,/g, ',');
    if (recText.length < 40 && data.match_narrative?.summary) {
      recText = data.match_narrative.summary;
      if (data.match_narrative.key_signals?.length > 0) {
        recText += ' ' + data.match_narrative.key_signals.join('. ') + '.';
      }
    }
    const firstSentenceEnd = recText.search(/[.!?]\s/);
    if (firstSentenceEnd > 10 && firstSentenceEnd < recText.length - 5) {
      const first = recText.slice(0, firstSentenceEnd + 1);
      const rest = recText.slice(firstSentenceEnd + 1);
      $rec.innerHTML = `<strong>${_escHtml(first)}</strong>${_escHtml(rest)}`;
    } else {
      $rec.textContent = recText;
    }
    if ($blurb) {
      $blurb.classList.add('donde-blurb--pending');
      $blurb.style.display = recText ? '' : 'none';
      $blurb.classList.toggle('donde-blurb--boosted', !!data.intent_boost?.active);
    }
  }

  renderMapPreview(data);

  const $tryAgainIcon = document.getElementById('try-again-icon');
  if ($tryAgainIcon) $tryAgainIcon.innerHTML = svgIcon('refresh', 16);
  const $glanceStartOverIcon = document.getElementById('glance-start-over-icon');
  if ($glanceStartOverIcon) $glanceStartOverIcon.innerHTML = svgIcon('home', 16);
  const $startOverIcon = document.getElementById('start-over-icon');
  if ($startOverIcon) $startOverIcon.innerHTML = svgIcon('home', 14);

  updateTryAgainState();

  // TIER 2: Store data for lazy rendering
  setPendingResultData(data);
  setPendingCuisine(cuisine);
  setTier2Prepared(false);

  // V9: Photo parallax depth effect
  setupPhotoParallax();
}

/* ---- Photo Parallax on Scroll ---- */
let _parallaxRaf = null;
function setupPhotoParallax() {
  if (_parallaxRaf) cancelAnimationFrame(_parallaxRaf);
  const $photos = document.getElementById('result-photos');
  if (!$photos) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $photos.classList.add('result-photos--parallax');
  const handler = () => {
    _parallaxRaf = requestAnimationFrame(() => {
      const rect = $photos.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const shift = Math.round(rect.top * -0.15);
      $photos.style.setProperty('--parallax-y', `${shift}px`);
    });
  };
  window.addEventListener('scroll', handler, { passive: true });
  $photos._parallaxCleanup = () => {
    window.removeEventListener('scroll', handler);
    if (_parallaxRaf) cancelAnimationFrame(_parallaxRaf);
  };
}

/* ---- Try Another Countdown ---- */
export function updateTryAgainState() {
  const $btn = document.querySelector('[data-action="try-again"]');
  if (!$btn) return;
  const TOTAL_PICKS = 5;
  const triesUsed = getState().excludeIds.length;
  const triesLeft = Math.max(0, TOTAL_PICKS - 1 - triesUsed);
  const $text = $btn.querySelector('.try-again-btn__text');
  if (!$text) return;
  const labels = getLabels(getState().theme.culture);

  if (triesLeft <= 0) {
    $btn.classList.add('try-again-btn--exhausted');
    $btn.setAttribute('aria-disabled', 'true');
    $text.textContent = labels.again;
    setTimeout(() => {
      $btn.style.transition = 'opacity 400ms var(--ease-out), transform 400ms var(--ease-out)';
      $btn.style.opacity = '0';
      $btn.style.transform = 'translateY(8px) scale(0.95)';
      setTimeout(() => {
        $btn.style.display = 'none';
        const $startOver = document.getElementById('start-over-btn');
        if ($startOver) {
          $startOver.classList.add('start-over-link--prominent');
          $startOver.style.transition = 'none';
          $startOver.style.opacity = '0';
          $startOver.style.transform = 'translateY(-8px)';
          requestAnimationFrame(() => {
            $startOver.style.transition = 'opacity 400ms var(--ease-out), transform 400ms var(--ease-out)';
            $startOver.style.opacity = '1';
            $startOver.style.transform = 'translateY(0)';
          });
        }
      }, 400);
    }, 100);
  } else {
    if (triesUsed > 0) {
      $text.textContent = `${labels.again} (${triesLeft})`;
    } else {
      $text.textContent = labels.again;
    }
    $btn.classList.remove('try-again-btn--exhausted');
    $btn.removeAttribute('aria-disabled');
    $btn.style.display = '';
    $btn.style.opacity = '';
    $btn.style.transform = '';
    $btn.style.transition = '';
    const $startOver = document.getElementById('start-over-btn');
    if ($startOver) {
      $startOver.classList.remove('start-over-link--prominent');
      $startOver.style.opacity = '';
      $startOver.style.transform = '';
      $startOver.style.transition = '';
    }
  }
}

/* ---- Share Canvas Rendering ---- */
export function renderShareCanvas(format = 'post') {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return;

  const { result } = getState();
  if (!result?.restaurant) return;

  const isStory = format === 'story';
  const w = isStory ? 540 : 600;
  const h = isStory ? 960 : 600;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--bg').trim() || '#fafafa';
  const fg = styles.getPropertyValue('--fg').trim() || '#1a1a1a';
  const ac = styles.getPropertyValue('--ac').trim() || '#6c5ce7';
  const fg2 = styles.getPropertyValue('--fg2').trim() || '#666';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = ac;
  ctx.fillRect(0, 0, w, 6);

  const gradient = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.6);
  gradient.addColorStop(0, ac + '12');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const r = result.restaurant;
  const score = Math.round(parseFloat(result.donde_match) || 80);
  const pad = 40;
  let y = isStory ? 120 : 80;

  ctx.fillStyle = fg;
  ctx.font = `700 ${isStory ? 36 : 32}px "Playfair Display", serif`;
  ctx.textAlign = 'left';

  const nameWords = (r.name || 'Restaurant').split(' ');
  let nameLine = '';
  for (const word of nameWords) {
    const test = nameLine ? `${nameLine} ${word}` : word;
    if (ctx.measureText(test).width > w - pad * 2) {
      ctx.fillText(nameLine, pad, y);
      y += isStory ? 44 : 40;
      nameLine = word;
    } else {
      nameLine = test;
    }
  }
  ctx.fillText(nameLine, pad, y);
  y += isStory ? 32 : 28;

  ctx.fillStyle = ac;
  ctx.fillRect(pad, y, 40, 2);
  y += 12;

  if (r.best_for_oneliner) {
    ctx.font = `italic 400 ${isStory ? 18 : 16}px "Playfair Display", serif`;
    ctx.fillStyle = fg2;
    y += 12;
    ctx.fillText(r.best_for_oneliner.slice(0, 60), pad, y);
    y += 28;
  }

  y += 20;
  const scoreX = pad + 36;
  const scoreY = y + 20;
  ctx.beginPath();
  ctx.arc(scoreX, scoreY, 32, 0, Math.PI * 2);
  ctx.fillStyle = ac;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = fg;
  ctx.font = `700 22px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(score + '%', scoreX, scoreY + 10);

  ctx.textAlign = 'left';
  ctx.font = `600 14px "Inter", sans-serif`;
  ctx.fillStyle = fg2;
  ctx.fillText('Donde Match', scoreX + 44, scoreY + 4);

  y += 80;

  ctx.fillStyle = fg2;
  ctx.font = `italic 500 14px "Playfair Display", serif`;
  ctx.textAlign = 'right';
  ctx.fillText('via Donde', w - pad, h - pad);
}

// Expose for share module (backward compat)
window.renderShareCanvas = renderShareCanvas;

/* ---- "Why This Spot" Explainer ---- */
const VIBE_LABELS = {
  date_friendly_score: 'date-friendliness',
  group_friendly_score: 'group-friendliness',
  family_friendly_score: 'family-friendliness',
  business_lunch_score: 'business vibes',
  solo_dining_score: 'solo dining',
  hole_in_wall_factor: 'hidden-gem factor',
};

export function buildWhyExplainer(data, craving) {
  if (!data || !craving?.trim()) return '';

  const labels = getLabels(getState().theme.culture);
  const prefix = labels.whyPrefix || 'Why this spot \u2014 ';

  let bestKey = '';
  let bestVal = 0;
  for (const [key, label] of Object.entries(VIBE_LABELS)) {
    const val = parseFloat(data.scores?.[key] ?? data.deep_context?.[key] ?? data[key] ?? 0);
    if (val > bestVal) {
      bestVal = val;
      bestKey = key;
    }
  }

  const score = Math.round(parseFloat(data.donde_match) || 0);
  const vibeLabel = VIBE_LABELS[bestKey] || '';

  if (!vibeLabel || bestVal < 5) return '';

  const cravingShort = craving.trim().split(' ').slice(0, 5).join(' ');
  return `${prefix}matched for "${cravingShort}" with top-tier ${vibeLabel} (${bestVal.toFixed(1)}/10) at ${score}% confidence.`;
}

/* ---- App Feedback Sheet ---- */
export function openFeedbackSheet() {
  const $sheet = document.getElementById('feedback-sheet');
  if (!$sheet) return;
  const labels = getLabels(getState().theme.culture);
  const $title = document.getElementById('feedback-sheet-title');
  const $subtitle = document.getElementById('feedback-sheet-subtitle');
  if ($title) $title.textContent = labels.feedbackTitle || 'Share Your Thoughts';
  if ($subtitle) $subtitle.textContent = labels.feedbackSubtitle || 'Help us make Donde better for everyone.';
  document.querySelectorAll('.feedback-cat-pill').forEach(b => b.setAttribute('aria-checked', 'false'));
  const $text = document.getElementById('feedback-text');
  if ($text) $text.value = '';
  const $count = document.getElementById('feedback-char-count');
  if ($count) $count.textContent = '0 / 500';
  const $submit = document.getElementById('feedback-submit');
  if ($submit) $submit.disabled = true;
  if ($text && !$text._wired) {
    $text._wired = true;
    $text.addEventListener('input', () => {
      const len = $text.value.length;
      if ($count) $count.textContent = `${len} / 500`;
      updateFeedbackSubmitState();
    });
  }
  $sheet.classList.add('feedback-sheet--open');
}

export function closeFeedbackSheet() {
  const $sheet = document.getElementById('feedback-sheet');
  if ($sheet) $sheet.classList.remove('feedback-sheet--open');
}

export function updateFeedbackSubmitState() {
  const hasCat = !!document.querySelector('.feedback-cat-pill[aria-checked="true"]');
  const hasText = (document.getElementById('feedback-text')?.value?.trim().length || 0) > 0;
  const $submit = document.getElementById('feedback-submit');
  if ($submit) $submit.disabled = !(hasCat && hasText);
}

/* ---- Offline Banner Text Sync ---- */
export function syncOfflineBannerText() {
  const $banner = document.getElementById('offline-banner');
  if ($banner) $banner.textContent = toasts().offline;
}
