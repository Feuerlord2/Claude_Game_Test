// Vibration API wrapper — silently no-ops where unsupported (iOS Safari).

export const Haptics = {
  enabled: true,

  vibrate(pattern) {
    if (!this.enabled) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch { /* ignore */ }
  },

  drop() { this.vibrate(8); },
  merge(tier) { this.vibrate(Math.min(40, 10 + tier * 3)); },
  bigMerge() { this.vibrate([20, 30, 40]); },
  gameover() { this.vibrate([60, 40, 100]); },
  danger() { this.vibrate(15); },
};
