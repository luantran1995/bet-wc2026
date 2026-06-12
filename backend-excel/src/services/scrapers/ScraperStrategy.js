/**
 * Base Strategy Class for Match Data Scrapers.
 * Part of the Strategy Design Pattern.
 */
class ScraperStrategy {
  /**
   * Scrapes match data from a specific provider.
   * @param {Array} dbMatches - List of baseline matches from the database.
   * @param {Function} teamNameMatcher - Callback function to compare team names.
   * @returns {Promise<Array>} List of parsed matches.
   */
  async scrape(dbMatches, teamNameMatcher) {
    throw new Error('scrape() method must be implemented');
  }
}

module.exports = ScraperStrategy;
