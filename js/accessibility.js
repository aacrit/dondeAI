/* ============================================
   DondeAI — Accessibility Module
   Focus management, announcements, keyboard nav.
   ============================================ */

export function initAccessibility() {
  // Keyboard navigation for chip groups
  document.addEventListener('keydown', handleKeyboard);
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
  if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === '/') {
      e.preventDefault();
      const $input = document.getElementById('craving-input');
      if ($input) $input.focus();
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      const compassBtn = document.querySelector('[data-action="cycle-theme"]');
      if (compassBtn) { compassBtn.click(); return; }
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
  if (e.key === 'Escape') {
    const tileExpand = document.getElementById('tile-expand');
    if (tileExpand?.classList.contains('tile-expand--open')) {
      tileExpand.classList.remove('tile-expand--open');
      document.querySelector('.score-tile--expandable')?.focus();
      return;
    }

    const compass = document.getElementById('culture-compass');
    if (compass?.classList.contains('culture-compass--open')) {
      compass.classList.remove('culture-compass--open');
      document.querySelector('[data-action="cycle-theme"]')?.focus();
      return;
    }

    const shareSheet = document.getElementById('share-sheet');
    if (shareSheet?.classList.contains('share-sheet--open')) {
      shareSheet.classList.remove('share-sheet--open');
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
