/**
 * Game sound effects.
 *
 * Synthesised with the Web Audio API rather than shipped as audio files: six short cues
 * would otherwise add far more weight than the entire app shell, and they must work offline.
 * The AudioContext is created on first use, since browsers block it before a user gesture.
 */

import { getPreferences } from '@/state/preferences';

export type SoundCue = 'correct' | 'wrong' | 'levelUp' | 'achievement' | 'victory' | 'defeat';

interface Tone {
  /** Frequencies played in sequence, in hertz. */
  notes: number[];
  /** Seconds per note. */
  step: number;
  type: OscillatorType;
  gain: number;
}

const TONES: Record<SoundCue, Tone> = {
  correct: { notes: [660, 880], step: 0.08, type: 'sine', gain: 0.06 },
  wrong: { notes: [220, 165], step: 0.11, type: 'sine', gain: 0.05 },
  levelUp: { notes: [523, 659, 784, 1047], step: 0.09, type: 'triangle', gain: 0.06 },
  achievement: { notes: [784, 988, 1175], step: 0.09, type: 'triangle', gain: 0.055 },
  victory: { notes: [523, 784, 1047], step: 0.12, type: 'square', gain: 0.04 },
  defeat: { notes: [330, 262, 196], step: 0.13, type: 'sawtooth', gain: 0.035 },
};

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;

  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    return context;
  } catch (error) {
    // Audio is a nicety — never let it break gameplay.
    console.warn('[sound] audio unavailable', error);
    return null;
  }
}

/** Plays a cue, unless the student has muted sound. Never throws. */
export function playCue(cue: SoundCue): void {
  if (!getPreferences().soundEnabled) return;

  const ctx = audioContext();
  if (!ctx) return;

  try {
    // A context created before a gesture starts suspended; resuming is a no-op otherwise.
    if (ctx.state === 'suspended') void ctx.resume();

    const tone = TONES[cue];
    const start = ctx.currentTime;

    tone.notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const amplifier = ctx.createGain();

      oscillator.type = tone.type;
      oscillator.frequency.value = frequency;

      const noteStart = start + index * tone.step;
      const noteEnd = noteStart + tone.step;

      // Ramp down to silence so notes do not click.
      amplifier.gain.setValueAtTime(tone.gain, noteStart);
      amplifier.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(amplifier).connect(ctx.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
    });
  } catch (error) {
    console.warn('[sound] could not play cue', cue, error);
  }
}

/** Plays a short confirmation so the student can hear what they just switched on. */
export function previewSound(): void {
  playCue('correct');
}
