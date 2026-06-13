const ScraperStrategy = require('./ScraperStrategy');

/**
 * Flashscore VN Scraper implementation.
 * Implements the ScraperStrategy.
 */
class FlashscoreScraper extends ScraperStrategy {
  constructor() {
    super();
    // Configure paths/URLs using environment variables with defaults (No hardcoding)
    this.chromePath = this.findChromePath();
    this.resultsUrl = process.env.FLASHSCORE_RESULTS_URL || 'https://www.flashscore.vn/bong-da/world/world-cup/ket-qua/';
    this.fixturesUrl = process.env.FLASHSCORE_FIXTURES_URL || 'https://www.flashscore.vn/bong-da/world/world-cup/lich-thi-dau/';
  }

  /**
   * Probes dynamic Chrome installation paths depending on OS Platform
   */
  findChromePath() {
    const fs = require('fs');
    const path = require('path');

    if (process.env.CHROME_PATH) {
      return process.env.CHROME_PATH;
    }

    const platform = process.platform;
    if (platform === 'win32') {
      const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) return p;
      }
    } else if (platform === 'darwin') {
      const paths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) return p;
      }
    } else if (platform === 'linux') {
      const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) return p;
      }
    }
    
    // Fallback default
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }

  /**
   * Scrapes match data from Flashscore VN.
   * @param {Array} dbMatches - Baseline match entries from the database.
   * @param {Function} teamNameMatcher - Function callback to map/match team names.
   * @returns {Promise<Array>} List of updated matches.
   */
  async scrape(dbMatches = [], teamNameMatcher) {
    const puppeteer = require('puppeteer-core');
    console.log(`🌐 [Scraper] Launching headless Chrome for Flashscore sync (Path: ${this.chromePath})...`);
    
    const browser = await puppeteer.launch({
      executablePath: this.chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-crashpad'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Override User-Agent, Viewport and Webdriver properties to bypass Cloudflare bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });
      
      // Enable Request Interception to block third-party trackers, ads, images, fonts, and media
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const type = request.resourceType();
        const url = request.url();
        if (
          ['image', 'font', 'media'].includes(type) ||
          url.includes('google-analytics') ||
          url.includes('doubleclick') ||
          url.includes('googlesyndication') ||
          url.includes('facebook') ||
          url.includes('scorecardresearch') ||
          url.includes('adnxs') ||
          url.includes('adsystem') ||
          url.includes('adservice') ||
          url.includes('quantserve') ||
          url.includes('amazon-adsystem')
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      const scrapeUrl = async (url, sourcePage) => {
        console.log(`🌐 [Scraper] Navigating to ${url}...`);
        // Use 'domcontentloaded' to avoid getting stuck on trailing network calls and detachment errors
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for match selector to be present
        try {
          await page.waitForSelector('.event__match', { timeout: 20000 });
        } catch (e) {
          console.warn(`⚠️ [Scraper] Timeout waiting for .event__match on ${url}`);
        }
        await new Promise(r => setTimeout(r, 2000));
        
        let showMoreVisible = true;
        let clicks = 0;
        while (showMoreVisible && clicks < 10) {
          const showMoreButton = await page.$('.event__more');
          if (showMoreButton) {
            console.log('🌐 [Scraper] Clicking ".event__more" button to load more matches...');
            await showMoreButton.click();
            await new Promise(r => setTimeout(r, 3000));
            clicks++;
          } else {
            showMoreVisible = false;
          }
        }

        return await page.evaluate((sourcePage) => {
          const elements = document.querySelectorAll('.event__match');
          const results = [];
          elements.forEach(el => {
            const homeParticipant = el.querySelector('.event__homeParticipant');
            const homeName = homeParticipant ? (homeParticipant.querySelector('[class*="name"]') || homeParticipant.querySelector('span') || homeParticipant).innerText : '';
            const awayParticipant = el.querySelector('.event__awayParticipant');
            const awayName = awayParticipant ? (awayParticipant.querySelector('[class*="name"]') || awayParticipant.querySelector('span') || awayParticipant).innerText : '';
            const homeScoreText = el.querySelector('.event__score--home')?.innerText || '';
            const awayScoreText = el.querySelector('.event__score--away')?.innerText || '';
            const stage = el.querySelector('.event__stage--block')?.innerText || el.querySelector('.event__time')?.innerText || '';
            
            const linkEl = el.querySelector('.eventRowLink');
            const href = linkEl ? linkEl.href : '';
            
            const homeSup = el.querySelector('.event__score--home sup')?.innerText || '';
            const awaySup = el.querySelector('.event__score--away sup')?.innerText || '';
            
            results.push({
              homeName: homeName.trim(),
              awayName: awayName.trim(),
              homeScoreText: homeScoreText.trim(),
              awayScoreText: awayScoreText.trim(),
              homeSup: homeSup.trim(),
              awaySup: awaySup.trim(),
              stage: stage.trim(),
              href,
              sourcePage
            });
          });
          return results;
        }, sourcePage);
      };

      console.log('🌐 [Scraper] Scraping results...');
      const resultsMatches = await scrapeUrl(this.resultsUrl, 'results');
      console.log(`🌐 [Scraper] Found ${resultsMatches.length} matches in results.`);

      console.log('🌐 [Scraper] Scraping fixtures...');
      const fixturesMatches = await scrapeUrl(this.fixturesUrl, 'fixtures');
      console.log(`🌐 [Scraper] Found ${fixturesMatches.length} matches in fixtures.`);

      const matches = [...resultsMatches, ...fixturesMatches];
      
      const uniqueMatchesMap = new Map();
      for (const m of matches) {
        const key = `${m.homeName}-${m.awayName}`;
        uniqueMatchesMap.set(key, m);
      }
      const uniqueMatches = Array.from(uniqueMatchesMap.values());
      console.log(`🌐 [Scraper] Total unique matches after combining results and fixtures: ${uniqueMatches.length}`);

      const parsedMatches = [];
      for (const m of uniqueMatches) {
        let homeScore = m.homeScoreText;
        let awayScore = m.awayScoreText;
        if (m.homeSup) homeScore = homeScore.replace(m.homeSup, '').trim();
        if (m.awaySup) awayScore = awayScore.replace(m.awaySup, '').trim();
        
        let penHomeGoals = '';
        let penAwayGoals = '';
        if (m.homeSup) {
          penHomeGoals = m.homeSup.replace(/[()]/g, '');
        }
        if (m.awaySup) {
          penAwayGoals = m.awaySup.replace(/[()]/g, '');
        }

        const isLive = m.stage.includes('\'') || m.stage === 'HT' || m.stage === 'Hiệp phụ' || m.stage === 'Luân lưu' || m.stage.includes('Break') || m.stage.includes('ET');
        const isCompleted = !isLive && (m.stage === 'Kết thúc' || m.stage.includes('KT') || m.stage.includes('Pen') || m.stage.includes('HP') || m.sourcePage === 'results');
        
        let status = 'scheduled';
        if (isCompleted) status = 'completed';
        else if (isLive) status = 'live';

        let homeTeamGoals = homeScore !== '' && homeScore !== '-' ? parseInt(homeScore, 10) : '';
        let awayTeamGoals = awayScore !== '' && awayScore !== '-' ? parseInt(awayScore, 10) : '';

        let elapsedMinutes = '';
        if (isLive) {
          elapsedMinutes = m.stage;
        }

        let homeGoals90 = '';
        let awayGoals90 = '';
        let extraHomeGoals = '';
        let extraAwayGoals = '';

        if (status === 'completed' && homeTeamGoals !== '' && awayTeamGoals !== '') {
          homeGoals90 = homeTeamGoals;
          awayGoals90 = awayTeamGoals;
          
          const goesToET = m.stage.toUpperCase().includes('HP') || m.stage.toUpperCase().includes('PEN') || penHomeGoals !== '';
          if (goesToET) {
            extraHomeGoals = homeTeamGoals;
            extraAwayGoals = awayTeamGoals;
            
            if (penHomeGoals !== '' && penAwayGoals !== '') {
              const pHome = parseInt(penHomeGoals, 10);
              const pAway = parseInt(penAwayGoals, 10);
              if (pHome > pAway) {
                homeTeamGoals = homeTeamGoals + 1;
              } else {
                awayTeamGoals = awayTeamGoals + 1;
              }
            }

            const isRelevant = dbMatches.length === 0 || dbMatches.some(dbMatch => 
              teamNameMatcher(dbMatch.homeTeamName, m.homeName) && 
              teamNameMatcher(dbMatch.awayTeamName, m.awayName)
            );

            if (isRelevant && m.href) {
              try {
                console.log(`🌐 [Scraper] Fetching sub-scores for ET match: ${m.homeName} vs ${m.awayName}...`);
                const detailPage = await browser.newPage();
                
                // Override User-Agent, Viewport and Webdriver properties to bypass Cloudflare bot detection
                await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await detailPage.setViewport({ width: 1366, height: 768 });
                await detailPage.evaluateOnNewDocument(() => {
                  Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                  });
                });
                
                // Enable request interception for detail page too
                await detailPage.setRequestInterception(true);
                detailPage.on('request', (request) => {
                  const type = request.resourceType();
                  const url = request.url();
                  if (
                    ['image', 'font', 'media'].includes(type) ||
                    url.includes('google-analytics') ||
                    url.includes('doubleclick') ||
                    url.includes('googlesyndication') ||
                    url.includes('facebook') ||
                    url.includes('scorecardresearch') ||
                    url.includes('adnxs') ||
                    url.includes('adsystem') ||
                    url.includes('adservice') ||
                    url.includes('quantserve') ||
                    url.includes('amazon-adsystem')
                  ) {
                    request.abort();
                  } else {
                    request.continue();
                  }
                });

                await detailPage.goto(m.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
                try {
                  await detailPage.waitForSelector('[class*="period"]', { timeout: 15000 });
                } catch (e) {
                  console.warn(`⚠️ [Scraper] Timeout waiting for [class*="period"] on ${m.href}`);
                }
                await new Promise(r => setTimeout(r, 1000));
                
                const cells = await detailPage.evaluate(() => {
                  const elList = document.querySelectorAll('[class*="period"], [class*="cell"]');
                  return Array.from(elList).map(el => el.innerText.trim());
                });
                
                let h1Score = '';
                let h2Score = '';
                for (let i = 0; i < cells.length; i++) {
                  const txt = cells[i].toUpperCase();
                  if (txt === 'HIỆP 1' || txt === '1ST HALF') {
                    h1Score = cells[i+1] || '';
                  } else if (txt === 'HIỆP 2' || txt === '2ND HALF') {
                    h2Score = cells[i+1] || '';
                  }
                }
                
                if (h1Score && h2Score) {
                  const [h1Home, h1Away] = h1Score.split('-').map(Number);
                  const [h2Home, h2Away] = h2Score.split('-').map(Number);
                  if (!isNaN(h1Home) && !isNaN(h2Home)) {
                    homeGoals90 = h1Home + h2Home;
                    awayGoals90 = h1Away + h2Away;
                    console.log(`🌐 [Scraper] Parsed 90-min score for ${m.homeName}: ${homeGoals90}-${awayGoals90}`);
                  }
                }
                await detailPage.close();
              } catch (detailErr) {
                console.warn(`⚠️ [Scraper] Failed to fetch match details for ET: ${detailErr.message}`);
              }
            }
          }
        }

        parsedMatches.push({
          homeName: m.homeName,
          awayName: m.awayName,
          homeTeamGoals,
          awayTeamGoals,
          elapsedMinutes,
          status,
          homeGoals90,
          awayGoals90,
          extraHomeGoals,
          extraAwayGoals,
          penHomeGoals: penHomeGoals ? parseInt(penHomeGoals, 10) : '',
          penAwayGoals: penAwayGoals ? parseInt(penAwayGoals, 10) : ''
        });
      }

      await browser.close();
      return parsedMatches;
    } catch (err) {
      console.error('❌ [Scraper] Error scraping Flashscore:', err);
      try {
        await browser.close();
      } catch {}
      throw err; // throw back to caller so we can record error status
    }
  }
}

module.exports = FlashscoreScraper;
