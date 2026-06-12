const FlashscoreScraper = require('./FlashscoreScraper');

/**
 * Factory class to instantiate data scraper strategies.
 * Part of Factory Design Pattern.
 */
class ScraperFactory {
  /**
   * Instantiates a scraper based on a provider type string.
   * @param {string} provider - Provider name.
   * @returns {ScraperStrategy} The scraper instance.
   */
  static createScraper(provider = 'flashscore') {
    switch (provider.toLowerCase()) {
      case 'flashscore':
      case 'flashscore_vn':
        return new FlashscoreScraper();
      default:
        throw new Error(`Unsupported scraper provider: ${provider}`);
    }
  }
}

module.exports = ScraperFactory;
