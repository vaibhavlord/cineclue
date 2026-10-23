/**
 * Web Audio procedural sound synthesis engine + SpeechSynthesis for CineClue.
 * Zero external audio file dependencies, instant, crisp cinematic sound design.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Click-clack mechanical film projector roll / shutter sound
 */
export function playProjectorClick() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.04);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

/**
 * Clue revealed whoosh / cinematic chime
 */
export function playClueRevealSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(330, now);
  osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15);

  osc2.frequency.setValueAtTime(440, now);
  osc2.frequency.exponentialRampToValueAtTime(880, now + 0.15);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.25);
  osc2.stop(now + 0.25);
}

/**
 * Correct guess fanfare
 */
export function playCorrectGuessFanfare() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    const start = now + idx * 0.08;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.45);
  });
}

/**
 * Incorrect guess strike sound (subtle film spool drag / low buzz)
 */
export function playWrongGuessSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(70, now + 0.2);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}

/**
 * Dramatic losing music / defeat fanfare when player fails after all 5 clues
 * Plays a descending minor/chromatic cinematic cadence ("wah-wah-wah-waaaah")
 */
export function playLosingMusic() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const sequence = [
    { freq: 392.0, start: 0.0, duration: 0.22 },   // G4
    { freq: 369.99, start: 0.24, duration: 0.22 }, // F#4
    { freq: 349.23, start: 0.48, duration: 0.22 }, // F4
    { freq: 311.13, start: 0.72, duration: 0.75, slideTo: 261.63 }, // Eb4 -> C4 slow downward bend
  ];

  sequence.forEach((note) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    const noteStart = now + note.start;
    const noteEnd = noteStart + note.duration;

    osc1.frequency.setValueAtTime(note.freq, noteStart);
    osc2.frequency.setValueAtTime(note.freq * 0.5, noteStart); // sub-octave warmth

    if (note.slideTo) {
      osc1.frequency.exponentialRampToValueAtTime(note.slideTo, noteEnd);
      osc2.frequency.exponentialRampToValueAtTime(note.slideTo * 0.5, noteEnd);
    }

    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.linearRampToValueAtTime(0.22, noteStart + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(noteStart);
    osc2.start(noteStart);
    osc1.stop(noteEnd + 0.05);
    osc2.stop(noteEnd + 0.05);
  });
}

/**
 * Speaks an iconic movie quote using the Web Speech Synthesis API
 */
export function speakMovieQuote(quote: string, onEnd?: () => void) {
  if (!soundEnabled) {
    if (onEnd) onEnd();
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  // Play film reel click first
  playProjectorClick();

  const utterance = new SpeechSynthesisUtterance(quote);
  utterance.rate = 0.92; // Slightly measured, dramatic cinema pacing
  utterance.pitch = 0.95; // Slightly deeper, warm cinematic tone

  // Attempt to select an English voice
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Alex')));
  if (enVoice) {
    utterance.voice = enVoice;
  }

  utterance.onend = () => {
    if (onEnd) onEnd();
  };
  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
