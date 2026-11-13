import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents } from '@capacitor-community/admob';

class AdManager {
  constructor() {
    this.isInitialized = false;
    this.levelCount = 0;
    this.bannerId = 'ca-app-pub-4689051548603672/4057260421';
    this.interstitialId = 'ca-app-pub-4689051548603672/3714158845';
    this.rewardedId = 'ca-app-pub-4689051548603672/5425328787';
  }

  async init() {
    if (this.isInitialized) return;
    try {
      await AdMob.initialize({
        initializeForTesting: false,
      });
      this.isInitialized = true;
      await this.showBanner();
      await this.prepareInterstitial();
      await this.prepareRewarded();
    } catch (e) {
      // Web browser par chalta hai toh silently ignore karein
    }
  }

  async showBanner() {
    if (!this.isInitialized) return;
    try {
      await AdMob.showBanner({
        adId: this.bannerId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
      });
    } catch (e) {}
  }

  async prepareInterstitial() {
    if (!this.isInitialized) return;
    try {
      await AdMob.prepareInterstitial({
        adId: this.interstitialId,
        isTesting: false,
      });
    } catch (e) {}
  }

  async onLevelComplete() {
    this.levelCount++;
    if (this.levelCount % 2 === 0 && this.isInitialized) {
      try {
        await AdMob.showInterstitial();
        await this.prepareInterstitial();
      } catch (e) {
        await this.prepareInterstitial();
      }
    }
  }

  async prepareRewarded() {
    if (!this.isInitialized) return;
    try {
      await AdMob.prepareRewardVideoAd({
        adId: this.rewardedId,
        isTesting: false,
      });
    } catch (e) {}
  }

  async showRewarded(onRewardEarned) {
    if (!this.isInitialized) {
      // Web browser par test karte waqt seedha reward de dein
      if (typeof onRewardEarned === 'function') onRewardEarned();
      return true;
    }

    return new Promise(async (resolve) => {
      let rewarded = false;
      const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
        if (typeof onRewardEarned === 'function') onRewardEarned();
      });

      const dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, async () => {
        rewardListener.remove();
        dismissListener.remove();
        await this.prepareRewarded();
        resolve(rewarded);
      });

      try {
        await AdMob.showRewardVideoAd();
      } catch (e) {
        rewardListener.remove();
        dismissListener.remove();
        await this.prepareRewarded();
        resolve(false);
      }
    });
  }
}

export const adManager = new AdManager();
export default adManager;
