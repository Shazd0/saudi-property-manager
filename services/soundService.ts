/**
 * Sound Effects Service — Web Audio API
 * Generates all sounds programmatically (no audio files needed).
 * Call SoundService.play('click') etc. from anywhere.
 */

type SoundName =
  | 'click'
  | 'nav'
  | 'tab'
  | 'submit'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'delete'
  | 'toggle'
  | 'open'
  | 'close'
  | 'notification'
  | 'hover'
  | 'typing'
  | 'swoosh';

let _ctx: AudioContext | null = null;
let _enabled = true;
let _volume = 0.35; // 0 – 1

function ctx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/* ────── tiny synth helpers ────── */

function bleep(freq: number, dur: number, type: OscillatorType = 'sine', vol = _volume) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

function noise(dur: number, vol = _volume * 0.3) {
  const c = ctx();
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(gain).connect(c.destination);
  src.start();
}

function chord(freqs: number[], dur: number, type: OscillatorType = 'sine', vol = _volume * 0.25) {
  freqs.forEach((f, i) => {
    setTimeout(() => bleep(f, dur, type, vol), i * 60);
  });
}

/* ────── sound definitions ────── */

const SOUNDS: Record<SoundName, () => void> = {
  /* tiny pop for generic button clicks */
  click() {
    bleep(800, 0.08, 'sine', _volume * 0.3);
  },

  /* nav link / page change — quick ascending pair */
  nav() {
    bleep(600, 0.06, 'sine', _volume * 0.3);
    setTimeout(() => bleep(900, 0.08, 'sine', _volume * 0.3), 50);
  },

  /* tab switch — soft click */
  tab() {
    bleep(700, 0.05, 'triangle', _volume * 0.35);
    setTimeout(() => bleep(1000, 0.05, 'triangle', _volume * 0.2), 40);
  },

  /* form submit — satisfying whoosh */
  submit() {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.15);
    gain.gain.setValueAtTime(_volume * 0.3, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.2);
  },

  /* success — pleasant ascending chord */
  success() {
    chord([523, 659, 784], 0.2, 'sine', _volume * 0.25);
  },

  /* error — dissonant descending buzz */
  error() {
    bleep(400, 0.12, 'sawtooth', _volume * 0.2);
    setTimeout(() => bleep(300, 0.15, 'sawtooth', _volume * 0.15), 80);
  },

  /* warning — two-tone alert */
  warning() {
    bleep(600, 0.1, 'triangle', _volume * 0.3);
    setTimeout(() => bleep(450, 0.12, 'triangle', _volume * 0.25), 100);
  },

  /* info — gentle ping */
  info() {
    bleep(880, 0.12, 'sine', _volume * 0.2);
  },

  /* delete / destructive — low rumble */
  delete() {
    bleep(200, 0.15, 'sawtooth', _volume * 0.2);
    noise(0.1, _volume * 0.15);
  },

  /* toggle on/off — short tick */
  toggle() {
    bleep(1200, 0.04, 'square', _volume * 0.15);
  },

  /* dialog open — soft whoosh up */
  open() {
    bleep(500, 0.08, 'sine', _volume * 0.25);
    setTimeout(() => bleep(750, 0.1, 'sine', _volume * 0.2), 60);
  },

  /* dialog close — soft whoosh down */
  close() {
    bleep(700, 0.08, 'sine', _volume * 0.2);
    setTimeout(() => bleep(450, 0.1, 'sine', _volume * 0.15), 50);
  },

  /* notification — bell-like ding */
  notification() {
    bleep(1047, 0.15, 'sine', _volume * 0.3);
    setTimeout(() => bleep(1319, 0.2, 'sine', _volume * 0.2), 100);
  },

  /* hover — very subtle */
  hover() {
    bleep(1100, 0.03, 'sine', _volume * 0.08);
  },

  /* typing — faint key press */
  typing() {
    bleep(1400 + Math.random() * 200, 0.025, 'square', _volume * 0.05);
  },

  /* swoosh — for transitions */
  swoosh() {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.2);
    gain.gain.setValueAtTime(_volume * 0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.25);
    noise(0.08, _volume * 0.08);
  },
};

/* ────── public API ────── */

const SoundService = {
  play(name: SoundName) {
    if (!_enabled) return;
    try {
      SOUNDS[name]?.();
    } catch {
      /* swallow – browsers may block audio before interaction */
    }
  },

  /** Enable / disable all sounds */
  setEnabled(on: boolean) {
    _enabled = on;
    try { localStorage.setItem('amlak_sound_enabled', on ? '1' : '0'); } catch { /* */ }
  },

  isEnabled() {
    return _enabled;
  },

  /** Volume 0-1 */
  setVolume(v: number) {
    _volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('amlak_sound_volume', String(_volume)); } catch { /* */ }
  },

  getVolume() {
    return _volume;
  },

  /** Call once at app boot to restore persisted prefs */
  init() {
    try {
      const stored = localStorage.getItem('amlak_sound_enabled');
      if (stored !== null) _enabled = stored === '1';
      const vol = localStorage.getItem('amlak_sound_volume');
      if (vol !== null) _volume = parseFloat(vol) || 0.35;
    } catch { /* */ }
  },
};

export default SoundService;
export type { SoundName };
