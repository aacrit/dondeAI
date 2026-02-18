/* ============================================
   DondeAI — Web Audio Chime Synthesis
   Culture-specific chimes, opt-in, persisted.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { saveSound } from './persistence.js';

let audioCtx = null;

const CHIME_PROFILES = {
  neutral:      { freq: [523, 659, 784], wave: 'sine', decay: 0.4 },
  indian:       { freq: [440, 554, 659], wave: 'triangle', decay: 0.5 },
  nepalese:     { freq: [392, 494, 587], wave: 'sine', decay: 0.6 },
  japanese:     { freq: [523, 784, 1047], wave: 'sine', decay: 0.3 },
  african:      { freq: [349, 440, 523], wave: 'square', decay: 0.35 },
  southamerican:{ freq: [392, 523, 659], wave: 'triangle', decay: 0.45 },
};

function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function playChime() {
  const { soundEnabled, theme } = getState();
  if (!soundEnabled) return;

  const ctx = getCtx();
  if (!ctx) return;

  const profile = CHIME_PROFILES[theme.culture] || CHIME_PROFILES.neutral;
  const now = ctx.currentTime;

  profile.freq.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = profile.wave;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.15, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + profile.decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + profile.decay + 0.1);
  });

  // Pulse ambient blobs in sync with chime
  pulseBlobs();
}

function pulseBlobs() {
  const blobs = document.querySelectorAll('.ambient__blob');
  if (!blobs.length) return;
  blobs.forEach((blob, i) => {
    blob.style.transition = 'transform 600ms cubic-bezier(0.2, 1, 0.4, 1)';
    blob.style.transform = 'scale(1.12)';
    setTimeout(() => {
      blob.style.transform = '';
    }, 600 + i * 100);
  });
}

export function initAudio() {
  subscribe((state, prev) => {
    if (state.soundEnabled !== prev.soundEnabled) {
      saveSound(state.soundEnabled);
      updateSoundIcon(state.soundEnabled);
      if (state.soundEnabled) {
        // Resume audio context on user gesture
        const ctx = getCtx();
        if (ctx?.state === 'suspended') ctx.resume();
        playChime();
      }
    }
  });

  updateSoundIcon(getState().soundEnabled);
}

export function toggleSound() {
  setState({ soundEnabled: !getState().soundEnabled });
}

function updateSoundIcon(enabled) {
  const wave = document.querySelector('.sound-wave');
  if (wave) {
    wave.style.opacity = enabled ? '1' : '0.3';
  }
}
