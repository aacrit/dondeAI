/* ============================================
   DondeAI — Web Speech Recognition
   Voice input for craving, auto-advance.
   ============================================ */

import { setState } from './state.js';

let recognition = null;
let isListening = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function initVoice() {
  if (!SpeechRecognition) return;

  // Show voice button
  const btn = document.querySelector('.craving-voice-btn');
  if (btn) btn.hidden = false;
}

export function startVoice() {
  if (!SpeechRecognition || isListening) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const btn = document.querySelector('.craving-voice-btn');
  const input = document.getElementById('craving-input');

  recognition.onstart = () => {
    isListening = true;
    if (btn) btn.classList.add('craving-voice-btn--recording');
    if (input) {
      input.dataset.prevPlaceholder = input.placeholder;
      input.placeholder = 'Listening...';
    }
  };

  recognition.onresult = (event) => {
    const result = event.results[0][0];
    const text = result.transcript;

    if (input) input.value = text;
    setState({ craving: text });

    // Update CTA state (no auto-submit — let user decide)
    const ctaBtn = document.querySelector('[data-action="submit"]');
    if (ctaBtn) ctaBtn.disabled = !text.trim();
  };

  const restorePlaceholder = () => {
    if (input && input.dataset.prevPlaceholder) {
      input.placeholder = input.dataset.prevPlaceholder;
      delete input.dataset.prevPlaceholder;
    }
  };

  recognition.onerror = () => {
    isListening = false;
    if (btn) btn.classList.remove('craving-voice-btn--recording');
    restorePlaceholder();
    // Notify app of voice error for user feedback
    document.dispatchEvent(new CustomEvent('voice-error'));
  };

  recognition.onend = () => {
    isListening = false;
    if (btn) btn.classList.remove('craving-voice-btn--recording');
    restorePlaceholder();
  };

  recognition.start();
}

export function stopVoice() {
  if (recognition && isListening) {
    recognition.stop();
    isListening = false;
  }
}
