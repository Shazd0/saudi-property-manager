/**
 * HapticService – thin wrapper around the Vibration API.
 * Falls back silently on non-supporting browsers/desktops.
 *
 * Pattern lengths are in milliseconds: [vibrate, pause, vibrate, ...]
 */

const PATTERNS = {
  /** Single short tap – for nav items, checkbox toggles */
  light: [10],
  /** Medium tap – for button presses, card selects */
  medium: [20],
  /** Stronger bump – for confirming actions */
  heavy: [40],
  /** Success double-tap */
  success: [10, 60, 20],
  /** Error triple-tap */
  error: [50, 30, 50, 30, 50],
  /** Warning – single medium-long */
  warning: [30],
  /** Notification – double tap */
  notification: [15, 80, 30],
  /** Selection change */
  selection: [8],
  /** Delete / destructive */
  destructive: [60, 40, 80],
};

type HapticPattern = keyof typeof PATTERNS;

const isSupported = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const vibrate = (pattern: number | number[]): void => {
  if (!isSupported()) return;
  try { navigator.vibrate(pattern); } catch { /* silently ignore */ }
};

const HapticService = {
  /** Fire a named haptic pattern */
  trigger(pattern: HapticPattern = 'medium'): void {
    vibrate(PATTERNS[pattern]);
  },
  /** Light tap – nav, selections */
  light(): void { vibrate(PATTERNS.light); },
  /** Button press */
  medium(): void { vibrate(PATTERNS.medium); },
  /** Heavy press / confirm */
  heavy(): void { vibrate(PATTERNS.heavy); },
  /** Success feedback */
  success(): void { vibrate(PATTERNS.success); },
  /** Error feedback */
  error(): void { vibrate(PATTERNS.error); },
  /** Warning feedback */
  warning(): void { vibrate(PATTERNS.warning); },
  /** Selection / toggle */
  selection(): void { vibrate(PATTERNS.selection); },
  /** Destructive / delete action */
  destructive(): void { vibrate(PATTERNS.destructive); },
  /** Check if device supports haptics */
  isSupported,
};

export default HapticService;
