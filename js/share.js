// Spoiler-free share text (the Wordle trick): result + tease, never the seed's
// content. navigator.share on mobile, clipboard fallback on desktop.

import { TIERS } from './config.js';
import { t } from './i18n.js';

export function buildShareText(dayNumber, score, bestTier, streak) {
  const clamped = Math.max(0, Math.min(bestTier, TIERS.length - 1));
  const tier = TIERS[clamped];
  const tierName = t('tier_names')[clamped] || t('tier_names')[0];
  const url = shareUrl();
  // The Wordle trick: a glanceable emoji progress row that reads in a feed
  // before a single word — reached tiers filled, the rest dark.
  const grid = TIERS.slice(0, clamped + 1).map((x) => x.emoji).join('')
    + '⬛'.repeat(TIERS.length - 1 - clamped);
  return t('share_text', dayNumber, score, tier.emoji, tierName, clamped, streak, url, grid);
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
