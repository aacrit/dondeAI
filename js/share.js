/* ============================================
   DondeAI — Share Sheet Logic
   Native share + fallback bottom sheet.
   ============================================ */

import { getState } from './state.js';
import { buildShareText } from './utils.js';

let $sheet = null;

export function initShare() {
  $sheet = document.getElementById('share-sheet');
}

export async function shareResult() {
  const { result } = getState();
  if (!result) return;

  const text = buildShareText(result);
  const title = `${result.restaurant?.name} — DondeAI Pick`;

  // Try native share first
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch {
      // User cancelled or unsupported — fall through to sheet
    }
  }

  // Open fallback sheet
  openShareSheet();
}

export function openShareSheet() {
  if ($sheet) {
    $sheet.classList.add('share-sheet--open');
    // Focus first button
    const first = $sheet.querySelector('.share-btn');
    if (first) first.focus();
  }
}

export function closeShareSheet() {
  if ($sheet) {
    $sheet.classList.remove('share-sheet--open');
  }
}

export function handleShareChannel(channel) {
  const { result } = getState();
  if (!result) return;

  const text = buildShareText(result);
  const encoded = encodeURIComponent(text);
  const name = result.restaurant?.name || 'Restaurant';

  switch (channel) {
    case 'clipboard':
      navigator.clipboard?.writeText(text).then(() => {
        showToast('Copied to clipboard!');
      }).catch(() => {
        showToast('Could not copy — try long-press.');
      });
      break;
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
      break;
    case 'sms':
      window.open(`sms:?body=${encoded}`, '_blank');
      break;
    case 'x':
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`${name} — check this spot! via @DondeAI`)}`, '_blank');
      break;
    case 'email':
      window.open(`mailto:?subject=${encodeURIComponent(`${name} — DondeAI Pick`)}&body=${encoded}`, '_blank');
      break;
    case 'telegram':
      window.open(`https://t.me/share/url?url=&text=${encoded}`, '_blank');
      break;
    case 'facebook':
      window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, '_blank');
      break;
    case 'imessage':
      window.open(`sms:?body=${encoded}`, '_blank');
      break;
  }

  closeShareSheet();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.add('toast--visible');
  setTimeout(() => toast.classList.remove('toast--visible'), 2500);
}
