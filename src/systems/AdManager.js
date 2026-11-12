import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

class AdManager {
  constructor() {
    this.isInitialized = false;
    this.levelCount = 0;
    this.bannerId = 'ca-app-pub-4689051548603672/4057260421';
    this.interstitialId = 'ca-app-pub-4689051548603672/3714158845';
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
    // Har 2 level jeetne par ek Interstitial ad dikhayein
    if (this.levelCount % 2 === 0 && this.isInitialized) {
      try {
        await AdMob.showInterstitial();
        await this.prepareInterstitial();
      } catch (e) {
        await this.prepareInterstitial();
      }
    }
  }
}

export const adManager = new AdManager();
export default adManager;
