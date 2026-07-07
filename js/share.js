// Spoiler-free share text (the Wordle trick): result + tease, never the seed's
// content. navigator.share on mobile, clipboard fallback on desktop.

import { TIERS } from './config.js';
import { t } from './i18n.js';

export function buildShareText(dayNumber, score, bestTier, streak) {
  const tier = TIERS[Math.max(0, Math.min(bestTier, TIERS.length - 1))];
  const tierName = t('tier_names')[bestTier] || t('tier_names')[0];
  const url = shareUrl();
  return t('share_text', dayNumber, score, tier.emoji, tierName, bestTier, streak, url);
}

export function shareUrl() {
  return location.origin + location.pathname;
}

// Returns 'shared' | 'copied' | 'failed'. Exposed on window for E2E tests.
export async function share(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'shared'; // user closed the sheet
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // Legacy fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
