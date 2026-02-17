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
    // Render share canvas preview
    if (typeof window.renderShareCanvas === 'function') {
      window.renderShareCanvas('post');
    }
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
      copyShareImage().catch(() => {
        // Fallback to text copy
        navigator.clipboard?.writeText(text).then(() => {
          showToast('Copied to clipboard!');
        }).catch(() => {
          showToast('Could not copy — try long-press.');
        });
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

async function copyShareImage() {
  const canvas = document.getElementById('share-canvas');
  if (!canvas || !canvas.width) throw new Error('No canvas');

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
  });

  if (navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showToast('Image copied to clipboard!');
  } else {
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dondeai-share.png';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Image downloaded!');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.add('toast--visible');
  setTimeout(() => toast.classList.remove('toast--visible'), 2500);
}
