// Monetization seam. Every ad interaction in the game goes through this
// adapter interface, so portal SDKs plug in without touching game code:
//
//   PokiAdapter        -> https://sdk.poki.com  (PokiSDK.rewardedBreak, commercialBreak, gameplayStart/Stop)
//   CrazyGamesAdapter  -> https://sdk.crazygames.com (SDK.ad.requestAd('rewarded'), gameplayStart/Stop)
//   AdMobAdapter       -> @capacitor-community/admob (RewardAd) for the Play Store build
//
// The StubAdapter ships in v1: it renders a fake ad overlay and always grants
// the reward, so all placements are testable before any SDK deal exists.

export class StubAdapter {
  constructor() {
    this.name = 'stub';
    this.fast = false; // test mode: skip the fake delay
  }

  async init() {}

  rewardedAvailable() {
    return true;
  }

  // Resolves true if the reward should be granted.
  async showRewarded() {
    const overlay = document.getElementById('adstub');
    const bar = document.getElementById('adstub-progress');
    if (!overlay || this.fast) return true;
    overlay.classList.remove('hidden');
    const duration = 1600;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        if (bar) bar.style.width = `${Math.round(p * 100)}%`;
        if (p >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    overlay.classList.add('hidden');
    if (bar) bar.style.width = '0%';
    return true;
  }

  // Interstitial slot (unused in v1 — retention first, per research).
  async commercialBreak() {
    return false;
  }

  gameplayStart() {}
  gameplayStop() {}
}

class AdsManager {
  constructor(adapter) {
    this.adapter = adapter;
    this.ready = false;
  }

  async init() {
    try {
      await this.adapter.init();
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  rewardedAvailable() {
    return this.ready && this.adapter.rewardedAvailable();
  }

  async showRewarded() {
    if (!this.rewardedAvailable()) return false;
    try {
      return await this.adapter.showRewarded();
    } catch {
      return false;
    }
  }

  gameplayStart() { try { this.adapter.gameplayStart(); } catch {} }
  gameplayStop() { try { this.adapter.gameplayStop(); } catch {} }
}

export const Ads = new AdsManager(new StubAdapter());
