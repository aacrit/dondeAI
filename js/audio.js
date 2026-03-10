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
  middleeastern:{ freq: [370, 466, 554], wave: 'triangle', decay: 0.55 },
  japanese:     { freq: [523, 784, 1047], wave: 'sine', decay: 0.3 },
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

/** Celebration chime — ascending 5-note arpeggio for 90%+ matches */
export function playCelebrationChime() {
  const { soundEnabled, theme } = getState();
  if (!soundEnabled) return;

  const ctx = getCtx();
  if (!ctx) return;

  const profile = CHIME_PROFILES[theme.culture] || CHIME_PROFILES.neutral;
  const now = ctx.currentTime;

  // Build a 5-note ascending arpeggio from the culture's base frequencies + two higher harmonics
  const celebFreqs = [
    ...profile.freq,
    profile.freq[2] * 1.26,  // major third above top note
    profile.freq[2] * 1.5,   // perfect fifth above top note
  ];

  celebFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = profile.wave;
    osc.frequency.value = freq;

    const start = now + i * 0.1;
    const vol = 0.12 - i * 0.01; // gentle decrescendo across notes
    gain.gain.setValueAtTime(Math.max(vol, 0.06), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.9);

    // Echo pass — quieter repeat at +0.1s delay for reverb-like depth
    if (i < 3) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = profile.wave;
      osc2.frequency.value = freq;
      gain2.gain.setValueAtTime(vol * 0.3, start + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(start + 0.1);
      osc2.stop(start + 1.0);
    }
  });

  pulseBlobs();
}

/** Tier 1 settle chime — single warm note for 70-79 scores */
export function playSettleChime() {
  const { soundEnabled, theme } = getState();
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const profile = CHIME_PROFILES[theme.culture] || CHIME_PROFILES.neutral;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = profile.wave;
  osc.frequency.value = profile.freq[0];
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + profile.decay + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + profile.decay + 0.3);
}

/** Tier 2 glow chime — 2-note for 80-87 scores */
export function playGlowChime() {
  const { soundEnabled, theme } = getState();
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const profile = CHIME_PROFILES[theme.culture] || CHIME_PROFILES.neutral;
  const now = ctx.currentTime;
  profile.freq.slice(0, 2).forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = profile.wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + profile.decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + profile.decay + 0.1);
  });
  pulseBlobs();
}

/** Tier 4 spectacle chime — full arpeggio + bass hit for 95-100 scores */
export function playSpectacleChime() {
  const { soundEnabled, theme } = getState();
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const profile = CHIME_PROFILES[theme.culture] || CHIME_PROFILES.neutral;
  const now = ctx.currentTime;

  // Deep bass hit first
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.value = profile.freq[0] / 2; // octave below
  bassGain.gain.setValueAtTime(0.18, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  bassOsc.connect(bassGain);
  bassGain.connect(ctx.destination);
  bassOsc.start(now);
  bassOsc.stop(now + 0.9);

  // Then the full celebration arpeggio (delayed slightly)
  const celebFreqs = [
    ...profile.freq,
    profile.freq[2] * 1.26,
    profile.freq[2] * 1.5,
    profile.freq[2] * 2, // extra octave for spectacle
  ];
  celebFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = profile.wave;
    osc.frequency.value = freq;
    const start = now + 0.15 + i * 0.09;
    const vol = 0.14 - i * 0.01;
    gain.gain.setValueAtTime(Math.max(vol, 0.06), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.1);
  });

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
      blob.style.transition = '';
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
  document.documentElement.setAttribute('data-sound', enabled ? 'on' : 'off');
  const btn = document.querySelector('[data-action="toggle-sound"]');
  if (btn) btn.setAttribute('aria-label', enabled ? 'Mute sound' : 'Unmute sound');
}
