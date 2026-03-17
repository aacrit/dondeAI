/* ============================================
   DondeAI — Accessibility Module
   Focus management, announcements, keyboard nav,
   focus traps for modal dialogs, swipe-equivalent
   keyboard shortcuts.
   ============================================ */

/* ---- Focus Trap (QW-1 / A11Y-1) ---- */

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');

// Map of modal ID -> { previouslyFocused, keydownHandler }
const _activeTraps = new Map();

/**
 * Activate a focus trap on a modal element.
 * Saves the previously focused element, focuses the first focusable child,
 * and traps Tab / Shift+Tab within the modal boundary.
 *
 * @param {string|HTMLElement} modal - Modal element or its ID
 */
export function trapFocus(modal) {
  const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
  if (!el) return;

  // Don't double-trap
  if (_activeTraps.has(el.id)) return;

  const previouslyFocused = document.activeElement;

  const getFocusable = () => {
    const all = el.querySelectorAll(FOCUSABLE_SELECTOR);
    // Filter out elements that are not visible
    return Array.from(all).filter(
      (node) => node.offsetParent !== null || node.offsetWidth > 0 || node.offsetHeight > 0
    );
  };

  // Focus first focusable element inside the modal
  requestAnimationFrame(() => {
    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // If no focusable children, focus the modal itself
      el.setAttribute('tabindex', '-1');
      el.focus();
    }
  });

  const keydownHandler = (e) => {
    if (e.key !== 'Tab') return;

    const focusable = getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', keydownHandler);

  _activeTraps.set(el.id, {
    previouslyFocused,
    keydownHandler,
  });
}

/**
 * Release a focus trap and restore focus to the previously focused element.
 *
 * @param {string|HTMLElement} modal - Modal element or its ID
 */
export function releaseFocus(modal) {
  const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
  if (!el) return;

  const trap = _activeTraps.get(el.id);
  if (!trap) return;

  document.removeEventListener('keydown', trap.keydownHandler);

  // Restore focus to the element that was focused before the modal opened
  if (trap.previouslyFocused && typeof trap.previouslyFocused.focus === 'function') {
    trap.previouslyFocused.focus();
  }

  _activeTraps.delete(el.id);
}

/* ---- Modal open/close observation ---- */

// All modals with aria-modal="true" and their open-class conventions
const MODAL_CONFIG = [
  { id: 'share-sheet',       openClass: 'share-sheet--open' },
  { id: 'feedback-sheet',    openClass: 'feedback-sheet--open' },
  { id: 'auth-sheet',        openClass: 'auth-sheet--open' },
  { id: 'taste-dna-modal',   openClass: 'taste-dna-modal--open' },
  { id: 'taste-blend-modal', openClass: 'taste-blend-modal--open' },
  { id: 'tile-expand',       openClass: 'tile-expand--open' },
  { id: 'lightbox',          openClass: 'lightbox--open' },
  { id: 'user-menu',         openClass: 'user-menu--open' },
];

function observeModals() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
      const target = mutation.target;
      const config = MODAL_CONFIG.find((c) => c.id === target.id);
      if (!config) continue;

      const isOpen = target.classList.contains(config.openClass);
      if (isOpen && !_activeTraps.has(config.id)) {
        trapFocus(target);
      } else if (!isOpen && _activeTraps.has(config.id)) {
        releaseFocus(target);
      }
    }
  });

  for (const config of MODAL_CONFIG) {
    const el = document.getElementById(config.id);
    if (el) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // Lightbox uses display style in addition to class, so also observe style
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    observer.observe(lightbox, { attributes: true, attributeFilter: ['class', 'style'] });
  }
}

/* ---- Init ---- */

export function initAccessibility() {
  // Keyboard navigation for chip groups + swipe-equivalent shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Observe modals for automatic focus trapping
  observeModals();
}

function handleKeyboard(e) {
  const target = e.target;

  // Arrow key navigation within radiogroups
  if (target.role === 'radio' && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const next = target.nextElementSibling;
    if (next && next.role === 'radio') {
      next.focus();
    } else {
      // Wrap to first
      const group = target.closest('[role="radiogroup"]');
      if (group) {
        const first = group.querySelector('[role="radio"]');
        if (first) first.focus();
      }
    }
  }

  if (target.role === 'radio' && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
    e.preventDefault();
    const prev = target.previousElementSibling;
    if (prev && prev.role === 'radio') {
      prev.focus();
    } else {
      // Wrap to last
      const group = target.closest('[role="radiogroup"]');
      if (group) {
        const radios = group.querySelectorAll('[role="radio"]');
        if (radios.length) radios[radios.length - 1].focus();
      }
    }
  }

  // Enter/Space on radio selects it
  if (target.role === 'radio' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    target.click();
  }

  // Global keyboard shortcuts (only when no text input is focused)
  const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

  // A11Y-6: Swipe-equivalent keyboard shortcuts (arrow keys on result view)
  // Left arrow = left-swipe = Try Another
  // Right arrow = right-swipe = Back to search
  // Only active on step 1 (result view) when no modal is open
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !isTyping) {
    const anyModalOpen = MODAL_CONFIG.some((c) => {
      const el = document.getElementById(c.id);
      return el && el.classList.contains(c.openClass);
    });

    if (!anyModalOpen) {
      const step1 = document.querySelector('.step[data-step="1"]:not([aria-hidden="true"])');
      if (step1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const $tryAnother = document.querySelector('[data-action="try-again"]');
          if ($tryAnother && !$tryAnother.disabled) {
            $tryAnother.click();
            announce('Loading another recommendation');
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const $back = document.querySelector('[data-action="back"]');
          if ($back) {
            $back.click();
            announce('Returned to search');
          }
          return;
        }
      }
    }
  }

  if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === '/') {
      e.preventDefault();
      const $input = document.getElementById('craving-input');
      if ($input) $input.focus();
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      const modeBtn = document.querySelector('[data-action="toggle-mode"]');
      if (modeBtn) { modeBtn.click(); return; }
    }
    if (e.key === 'f' || e.key === 'F') {
      const step = document.querySelector('.step[data-step="0"]:not([aria-hidden="true"])');
      if (step) {
        const filterBtn = document.querySelector('[data-action="toggle-filters"]');
        if (filterBtn) { filterBtn.click(); return; }
      }
    }
    if (e.key === 'r' || e.key === 'R') {
      const step1 = document.querySelector('.step[data-step="1"]:not([aria-hidden="true"])');
      if (step1) {
        const tryAgain = document.querySelector('[data-action="try-again"]');
        if (tryAgain) { tryAgain.click(); return; }
      }
    }
  }

  // Escape closes modals (check innermost first)
  // Focus restoration is handled automatically by the MutationObserver
  // when the open class is removed.
  if (e.key === 'Escape') {
    const tileExpand = document.getElementById('tile-expand');
    if (tileExpand?.classList.contains('tile-expand--open')) {
      tileExpand.classList.remove('tile-expand--open');
      document.querySelector('.score-tile--expandable')?.focus();
      return;
    }

    const colorPopover = document.getElementById('color-popover');
    if (colorPopover?.classList.contains('color-popover--open')) {
      colorPopover.classList.remove('color-popover--open');
      document.querySelector('[data-action="toggle-mode"]')?.focus();
      return;
    }

    const shareSheet = document.getElementById('share-sheet');
    if (shareSheet?.classList.contains('share-sheet--open')) {
      shareSheet.classList.remove('share-sheet--open');
      return;
    }


    // Lightbox
    const lightbox = document.getElementById('lightbox');
    if (lightbox?.classList.contains('lightbox--open')) {
      document.querySelector('[data-action="close-lightbox"]')?.click();
      return;
    }

    // Filter drawer
    const filterDrawer = document.getElementById('filter-drawer');
    if (filterDrawer?.classList.contains('filter-drawer--open')) {
      document.querySelector('[data-action="toggle-filters"]')?.click();
      return;
    }

    // Badge popout
    const popout = document.querySelector('.badge-popout--open');
    if (popout) {
      popout.classList.remove('badge-popout--open');
      return;
    }
  }
}

export function announce(message) {
  const el = document.getElementById('step-announce');
  if (el) {
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
  }
}
