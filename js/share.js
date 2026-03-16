/* ============================================
   DondeAI — Share Sheet Logic
   Native share + Donde Card + fallback bottom sheet.
   ============================================ */

import { getState } from './state.js';
import { buildShareText } from './utils.js';
import { generateDondeCard, downloadDondeCard, shareDondeCard } from './donde-card.js';

let $sheet = null;
let _cardBlob = null;
let _cardResultId = null;

export function initShare() {
  $sheet = document.getElementById('share-sheet');
}

export async function shareResult() {
  const { result } = getState();
  if (!result) return;

  const blob = await _getOrGenerateCard(result);

  if (blob) {
    const shared = await shareDondeCard(blob, result.restaurant?.name);
    if (shared) return;
  }

  openShareSheet();
}

export function openShareSheet() {
  if ($sheet) {
    $sheet.classList.add('share-sheet--open');
    _renderCardPreview();
    const first = $sheet.querySelector('.share-btn, .share-card-btn');
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
    case 'save-card':
      _saveCard();
      return;
    case 'share-card':
      _shareCard();
      return;
    case 'clipboard':
      _copyCardOrText(text);
      break;
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
      break;
    case 'sms':
      window.open(`sms:?body=${encoded}`, '_blank');
      break;
    case 'x':
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`${name} \u2014 check this spot! via @DondeAI`)}`, '_blank');
      break;
    case 'email':
      window.open(`mailto:?subject=${encodeURIComponent(`${name} \u2014 Donde Pick`)}&body=${encoded}`, '_blank');
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

async function _getOrGenerateCard(result) {
  const resultId = result?.restaurant?.id;
  if (_cardBlob && _cardResultId === resultId) return _cardBlob;

  try {
    _cardBlob = await generateDondeCard(result);
    _cardResultId = resultId;
    return _cardBlob;
  } catch (err) {
    console.warn('[DondeCard] Generation failed:', err);
    _cardBlob = null;
    _cardResultId = null;
    return null;
  }
}

async function _renderCardPreview() {
  const { result } = getState();
  if (!result) return;

  const $preview = document.getElementById('share-preview');
  const $canvas = document.getElementById('share-canvas');
  if (!$preview) return;

  $preview.classList.add('share-preview--loading');

  try {
    const blob = await _getOrGenerateCard(result);
    if (!blob) {
      if ($canvas) $canvas.style.display = '';
      if (typeof window.renderShareCanvas === 'function') {
        window.renderShareCanvas('story');
      }
      $preview.classList.remove('share-preview--loading');
      return;
    }

    let $img = $preview.querySelector('.donde-card-preview');
    if (!$img) {
      $img = document.createElement('img');
      $img.className = 'donde-card-preview';
      $img.alt = `Donde Card for ${result.restaurant?.name || 'restaurant'}`;
      if ($canvas) $canvas.style.display = 'none';
      $preview.appendChild($img);
    }

    const url = URL.createObjectURL(blob);
    $img.onload = () => URL.revokeObjectURL(url);
    $img.src = url;
  } catch (err) {
    console.warn('[DondeCard] Preview failed:', err);
    if ($canvas) $canvas.style.display = '';
    if (typeof window.renderShareCanvas === 'function') {
      window.renderShareCanvas('story');
    }
  }

  $preview.classList.remove('share-preview--loading');
}

async function _saveCard() {
  const { result } = getState();
  if (!result) return;

  try {
    const blob = await _getOrGenerateCard(result);
    if (blob) {
      downloadDondeCard(blob, result.restaurant?.name);
      _showToast('Card saved!');
    } else {
      _showToast('Could not generate card.');
    }
  } catch {
    _showToast('Could not save card.');
  }
  closeShareSheet();
}

async function _shareCard() {
  const { result } = getState();
  if (!result) return;

  try {
    const blob = await _getOrGenerateCard(result);
    if (blob) {
      const shared = await shareDondeCard(blob, result.restaurant?.name);
      if (!shared) {
        downloadDondeCard(blob, result.restaurant?.name);
        _showToast('Card downloaded!');
      }
    } else {
      _showToast('Could not generate card.');
    }
  } catch {
    _showToast('Could not share card.');
  }
  closeShareSheet();
}

async function _copyCardOrText(text) {
  try {
    const { result } = getState();
    const blob = await _getOrGenerateCard(result);

    if (blob && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      _showToast('Card copied to clipboard!');
      return;
    }
  } catch {
    // fall through to text
  }

  try {
    await navigator.clipboard?.writeText(text);
    _showToast('Copied to clipboard!');
  } catch {
    _showToast('Could not copy \u2014 try long-press.');
  }
}

function _showToast(message) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.add('toast--visible');
  setTimeout(() => toast.classList.remove('toast--visible'), 2500);
}
