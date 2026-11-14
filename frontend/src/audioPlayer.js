/**
 * Audio feedback and Browser Speech Synthesis utility.
 * Supports:
 *   - Pre-generated Telugu demo audio fallback (/audio/telugu/<verdict>.wav)
 *   - Web Speech Synthesis API for multilingual readouts
 */

let currentAudio = null;

export function speakVerdict({ verdict, text, lang = 'en', onStart, onEnd }) {
  // Stop any currently playing audio or speech
  stopAudio();

  const cleanLang = (lang || 'en').toLowerCase();
  const verdictKey = (verdict || 'unverified').toLowerCase();

  // If Telugu and pre-generated audio is available, prefer or pair with Telugu audio
  if (cleanLang === 'te') {
    const audioPath = `/audio/telugu/${verdictKey}.wav`;
    currentAudio = new Audio(audioPath);
    if (onStart) onStart();

    currentAudio.onended = () => {
      currentAudio = null;
      // After tone, speak the explanation text if SpeechSynthesis is supported
      if ('speechSynthesis' in window && text) {
        synthesizeSpeech(text, 'te-IN', onStart, onEnd);
      } else if (onEnd) {
        onEnd();
      }
    };

    currentAudio.onerror = () => {
      // Fallback directly to speech synthesis if audio file fails
      currentAudio = null;
      if ('speechSynthesis' in window && text) {
        synthesizeSpeech(text, 'te-IN', onStart, onEnd);
      } else if (onEnd) {
        onEnd();
      }
    };

    currentAudio.play().catch(() => {
      if ('speechSynthesis' in window && text) {
        synthesizeSpeech(text, 'te-IN', onStart, onEnd);
      } else if (onEnd) {
        onEnd();
      }
    });
    return;
  }

  // English or Hindi via Browser SpeechSynthesis API
  const voiceLang = cleanLang === 'hi' ? 'hi-IN' : 'en-IN';
  if ('speechSynthesis' in window && text) {
    synthesizeSpeech(text, voiceLang, onStart, onEnd);
  } else if (onEnd) {
    onEnd();
  }
}

function synthesizeSpeech(text, langCode, onStart, onEnd) {
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95; // Slightly slower, clear cadence for accessibility

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(langCode.slice(0, 2)));
    if (match) utterance.voice = match;

    utterance.onstart = () => {
      if (onStart) onStart();
    };
    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech synthesis error:', e);
    if (onEnd) onEnd();
  }
}

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
