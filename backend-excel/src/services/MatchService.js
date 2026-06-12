const fs = require('fs');
const path = require('path');


const EventEmitter = require('events');

/**
 * Service to manage match schedules, API synchronization and status updates.
 * Implements Observer Design Pattern (extends EventEmitter).
 */
class MatchService extends EventEmitter {
  /**
   * @param {ExcelService} excelService - The Excel service instance.
   * @param {string} matchesFile - Path to the matches Excel file.
   */
  constructor(excelService, matchesFile) {
    super();
    this.excelService = excelService;
    this.matchesFile = matchesFile;
    this.lastSyncStatus = { success: true, timestamp: new Date().toISOString() };
  }




  /**
   * Retrieves matches and parses their scores / progress integers properly.
   * @returns {Array<Object>} List of matches.
   */
  getMatches() {
    const matches = this.excelService.readSheet(this.matchesFile, 'matches');
    matches.forEach(m => {
      m.homeTeamGoals  = m.homeTeamGoals  !== '' ? Number(m.homeTeamGoals)  : null;
      m.awayTeamGoals  = m.awayTeamGoals  !== '' ? Number(m.awayTeamGoals)  : null;
      if (m.elapsedMinutes !== undefined && m.elapsedMinutes !== '') {
        const num = Number(m.elapsedMinutes);
        m.elapsedMinutes = isNaN(num) ? m.elapsedMinutes : num;
      } else {
        m.elapsedMinutes = null;
      }
      m.homeGoals90 = (m.homeGoals90 !== undefined && m.homeGoals90 !== '') ? Number(m.homeGoals90) : null;
      m.awayGoals90 = (m.awayGoals90 !== undefined && m.awayGoals90 !== '') ? Number(m.awayGoals90) : null;
      m.extraHomeGoals = (m.extraHomeGoals !== undefined && m.extraHomeGoals !== '') ? Number(m.extraHomeGoals) : null;
      m.extraAwayGoals = (m.extraAwayGoals !== undefined && m.extraAwayGoals !== '') ? Number(m.extraAwayGoals) : null;
      m.penHomeGoals = (m.penHomeGoals !== undefined && m.penHomeGoals !== '') ? Number(m.penHomeGoals) : null;
      m.penAwayGoals = (m.penAwayGoals !== undefined && m.penAwayGoals !== '') ? Number(m.penAwayGoals) : null;
    });
    return matches;
  }

  /**
   * Manually updates status/score details for a match (typically Admin actions).
   */
  updateMatchStatus(id, updateData) {
    const matches = this.excelService.readSheet(this.matchesFile, 'matches');
    const idx = matches.findIndex(m => m.id?.toString() === id.toString());
    if (idx === -1) {
      throw new Error('Match not found');
    }
    
    const oldMatch = { ...matches[idx] };
    Object.assign(matches[idx], updateData);
    
    // Auto settle bets if status was transitioned to completed (Observer Pattern)
    if (matches[idx].status === 'completed' && oldMatch.status !== 'completed') {
      console.log(`🏆 Match ${id} manually completed: ${matches[idx].homeTeamName} ${matches[idx].homeTeamGoals}-${matches[idx].awayTeamGoals} ${matches[idx].awayTeamName}`);
      this.emit('matchCompleted', matches[idx]);
    }

    this.excelService.writeSheet(this.matchesFile, 'matches', matches);
    return matches[idx];
  }

  /**
   * Synchronizes match data from Sportmonks API (default) or FIFA GitHub fallbacks.
   * Automatically schedules bet auto-settlement for newly completed matches.
   */
  async syncMatchesFromApi() {
    console.log('🔄 Syncing match data exclusively from Flashscore VN...');
    let processedMatches = [];
    
    // Load existing matches from local matches.xlsx
    if (fs.existsSync(this.matchesFile)) {
      try {
        processedMatches = this.excelService.readSheet(this.matchesFile, 'matches') || [];
      } catch (err) {
        console.warn(`⚠️ Failed to read ${this.matchesFile}: ${err.message}`);
      }
    }

    // Fallback to seeding template if local matches file is missing or empty
    if (processedMatches.length === 0) {
      const templatePath = path.join(__dirname, '..', '..', 'initial-data', 'matches.xlsx');
      if (fs.existsSync(templatePath)) {
        try {
          processedMatches = this.excelService.readSheet(templatePath, 'matches') || [];
          console.log(`📦 Loaded ${processedMatches.length} baseline matches from template.`);
        } catch (err) {
          console.error(`❌ Failed to read seed template matches file: ${err.message}`);
        }
      }
    }

    if (processedMatches.length === 0) {
      console.error('❌ No baseline matches could be loaded. Sync aborted.');
      return [];
    }

    const existingMatches = JSON.parse(JSON.stringify(processedMatches));
    const now = new Date();

    // 1. Scrape real-time results from Flashscore.vn
    // 1. Scrape real-time results from Flashscore.vn using Scraper Factory & Strategy Pattern
    let scrapedMatches = [];
    try {
      const ScraperFactory = require('./scrapers/ScraperFactory');
      const scraper = ScraperFactory.createScraper('flashscore');
      scrapedMatches = await scraper.scrape(processedMatches, this.matchTeamName.bind(this));
      console.log(`✅ Scraped ${scrapedMatches.length} matches from Flashscore VN.`);
      this.lastSyncStatus = { success: true, timestamp: new Date().toISOString() };
    } catch (scrapeErr) {
      console.warn(`⚠️ Flashscore scraper failed: ${scrapeErr.message}. Falling back to simulation...`);
      this.lastSyncStatus = {
        success: false,
        error: scrapeErr.message,
        timestamp: new Date().toISOString()
      };
    }

    // 2. Known/Correct results to override or correct API lag (as secondary fallback)
    const knownScores = {};
    if (process.env.KNOWN_SCORES) {
      try {
        const parsedKnown = JSON.parse(process.env.KNOWN_SCORES);
        parsedKnown.forEach(ks => {
          const matchTime = this.parseVnTimeToDate(ks.time);
          if (matchTime) {
            const progress = this.getMatchProgress(matchTime, now, ks.homeGoals, ks.awayGoals, ks.isKnockout || false);
            if (progress.status !== 'scheduled') {
              knownScores[ks.id] = progress;
            }
          }
        });
      } catch (err) {
        console.warn('⚠️ Failed to parse KNOWN_SCORES env var:', err.message);
      }
    } else {
      const defaultKnown = [
        { id: 1, time: '2026-06-12 02:00', homeGoals: 2, awayGoals: 0 },
        { id: 2, time: '2026-06-12 09:00', homeGoals: 2, awayGoals: 1 }
      ];
      defaultKnown.forEach(ks => {
        const matchTime = this.parseVnTimeToDate(ks.time);
        if (matchTime) {
          const progress = this.getMatchProgress(matchTime, now, ks.homeGoals, ks.awayGoals, false);
          if (progress.status !== 'scheduled') {
            knownScores[ks.id] = progress;
          }
        }
      });
    }

    processedMatches.forEach(match => {
      // Find if this match is available in the scraped Flashscore list
      const scraped = scrapedMatches.find(s => 
        this.matchTeamName(match.homeTeamName, s.homeName) && 
        this.matchTeamName(match.awayTeamName, s.awayName)
      );

      if (scraped) {
        console.log(`⚡ Syncing Match ${match.id} (${match.homeTeamName} vs ${match.awayTeamName}) with real-time Flashscore data: ${scraped.homeTeamGoals}-${scraped.awayTeamGoals} (${scraped.status})`);
        match.status = scraped.status;
        match.homeTeamGoals = scraped.homeTeamGoals;
        match.awayTeamGoals = scraped.awayTeamGoals;
        match.elapsedMinutes = scraped.elapsedMinutes;
        match.homeGoals90 = scraped.homeGoals90;
        match.awayGoals90 = scraped.awayGoals90;
        match.extraHomeGoals = scraped.extraHomeGoals;
        match.extraAwayGoals = scraped.extraAwayGoals;
        match.penHomeGoals = scraped.penHomeGoals;
        match.penAwayGoals = scraped.penAwayGoals;
      } else {
        const matchId = parseInt(match.id, 10);
        if (knownScores[matchId]) {
          const ks = knownScores[matchId];
          match.status = ks.status;
          match.homeTeamGoals = ks.homeTeamGoals;
          match.awayTeamGoals = ks.awayTeamGoals;
          match.elapsedMinutes = ks.elapsedMinutes;
          match.homeGoals90 = ks.homeGoals90;
          match.awayGoals90 = ks.awayGoals90;
          match.extraHomeGoals = ks.extraHomeGoals;
          match.extraAwayGoals = ks.extraAwayGoals;
          match.penHomeGoals = ks.penHomeGoals;
          match.penAwayGoals = ks.penAwayGoals;
        } else if (match.status === 'scheduled') {
          const sim = this.calculateSimulatedMatchState(match, now);
          if (sim.status !== 'scheduled') {
            match.status = sim.status;
            match.homeTeamGoals = sim.homeTeamGoals;
            match.awayTeamGoals = sim.awayTeamGoals;
            match.elapsedMinutes = sim.elapsedMinutes;
            match.homeGoals90 = sim.homeGoals90;
            match.awayGoals90 = sim.awayGoals90;
            match.extraHomeGoals = sim.extraHomeGoals;
            match.extraAwayGoals = sim.extraAwayGoals;
            match.penHomeGoals = sim.penHomeGoals;
            match.penAwayGoals = sim.penAwayGoals;
          }
        }
      }
    });

    processedMatches.sort((a, b) => {
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      return a.id - b.id;
    });

    // Merge logic: preserve manual overrides or settle bets on completion transitions
    processedMatches.forEach(newMatch => {
      const oldMatch = existingMatches.find(o => parseInt(o.id, 10) === newMatch.id);
      
      if (oldMatch) {
        const hasLocalData = oldMatch.status !== 'scheduled' || 
                             (oldMatch.homeTeamGoals !== null && oldMatch.homeTeamGoals !== '') ||
                             (oldMatch.awayTeamGoals !== null && oldMatch.awayTeamGoals !== '');

        if (hasLocalData) {
          const sim = this.calculateSimulatedMatchState(newMatch, now);
          const isManualOverride = oldMatch.status !== sim.status ||
                                   (oldMatch.homeTeamGoals !== null && oldMatch.homeTeamGoals !== '' && Number(oldMatch.homeTeamGoals) !== sim.homeTeamGoals) ||
                                   (oldMatch.awayTeamGoals !== null && oldMatch.awayTeamGoals !== '' && Number(oldMatch.awayTeamGoals) !== sim.awayTeamGoals);

          if (isManualOverride) {
            newMatch.status = oldMatch.status;
            newMatch.homeTeamGoals = oldMatch.homeTeamGoals;
            newMatch.awayTeamGoals = oldMatch.awayTeamGoals;
            newMatch.elapsedMinutes = oldMatch.elapsedMinutes;
            
            const isCompleted = oldMatch.status === 'completed';
            newMatch.homeGoals90 = (oldMatch.homeGoals90 !== undefined && oldMatch.homeGoals90 !== '') 
              ? oldMatch.homeGoals90 
              : (isCompleted ? oldMatch.homeTeamGoals : '');
            newMatch.awayGoals90 = (oldMatch.awayGoals90 !== undefined && oldMatch.awayGoals90 !== '') 
              ? oldMatch.awayGoals90 
              : (isCompleted ? oldMatch.awayTeamGoals : '');
              
            newMatch.extraHomeGoals = (oldMatch.extraHomeGoals !== undefined && oldMatch.extraHomeGoals !== '') ? oldMatch.extraHomeGoals : '';
            newMatch.extraAwayGoals = (oldMatch.extraAwayGoals !== undefined && oldMatch.extraAwayGoals !== '') ? oldMatch.extraAwayGoals : '';
            newMatch.penHomeGoals = (oldMatch.penHomeGoals !== undefined && oldMatch.penHomeGoals !== '') ? oldMatch.penHomeGoals : '';
            newMatch.penAwayGoals = (oldMatch.penAwayGoals !== undefined && oldMatch.penAwayGoals !== '') ? oldMatch.penAwayGoals : '';
          }
        }
      }

      // Auto settle bets if status was transitioned to completed (Observer Pattern)
      const oldStatus = oldMatch ? oldMatch.status : 'scheduled';
      if (newMatch.status === 'completed' && oldStatus !== 'completed') {
        console.log(`🏆 Match ${newMatch.id} completed: ${newMatch.homeTeamName} ${newMatch.homeTeamGoals}-${newMatch.awayTeamGoals} ${newMatch.awayTeamName}`);
        this.emit('matchCompleted', newMatch);
      }
    });

    this.excelService.writeSheet(this.matchesFile, 'matches', processedMatches);
    console.log(`✅ Synced matches database: ${processedMatches.length} matches written to matches.xlsx.`);
    return processedMatches;
  }

  /**
   * Helper to determine match status and score based on the current system time.
   */
  calculateSimulatedMatchState(match, now) {
    const matchDate = this.parseVnTimeToDate(match.time);
    if (!matchDate) {
      return {
        status: 'scheduled',
        homeTeamGoals: '',
        awayTeamGoals: '',
        elapsedMinutes: ''
      };
    }

    const seed = parseInt(match.id, 10);
    const baseHome = (seed * 17 + 5) % 4; // 0 to 3
    const baseAway = (seed * 11 + 3) % 3; // 0 to 2
    const isKnockout = match.groupKey === 'knockout' || match.groupKey === 'final';

    return this.getMatchProgress(matchDate, now, baseHome, baseAway, isKnockout);
  }

  /**
   * Helper to parse YYYY-MM-DD HH:mm Vietnam time string into Date object.
   */
  parseVnTimeToDate(vnTimeStr) {
    if (!vnTimeStr) return null;
    const parts = vnTimeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!parts) return null;
    const [_, y, m, d, h, min] = parts.map(Number);
    const utcDate = new Date(Date.UTC(y, m - 1, d, h - 7, min));
    return utcDate;
  }

  /**
   * Helper to determine full match progress (including injury time and extra time).
   */
  getMatchProgress(matchTime, now, finalHomeGoals, finalAwayGoals, isKnockout = false) {
    const diffMs = now.getTime() - matchTime.getTime();
    if (diffMs < 0) {
      return {
        status: 'scheduled',
        homeTeamGoals: '',
        awayTeamGoals: '',
        elapsedMinutes: '',
        homeGoals90: '',
        awayGoals90: '',
        extraHomeGoals: '',
        extraAwayGoals: '',
        penHomeGoals: '',
        penAwayGoals: ''
      };
    }

    const diffMin = Math.floor(diffMs / (60 * 1000));
    const isDrawAt90 = finalHomeGoals === finalAwayGoals;
    const hasExtraTime = isKnockout && isDrawAt90;

    // 1. First Half (0 - 45 mins)
    if (diffMin < 45) {
      const progress = diffMin / 90;
      const homeTeamGoals = Math.min(finalHomeGoals, Math.floor(finalHomeGoals * progress));
      const awayTeamGoals = Math.min(finalAwayGoals, Math.floor(finalAwayGoals * progress));
      return {
        status: 'live',
        homeTeamGoals,
        awayTeamGoals,
        elapsedMinutes: diffMin + 1,
        homeGoals90: '',
        awayGoals90: '',
        extraHomeGoals: '',
        extraAwayGoals: '',
        penHomeGoals: '',
        penAwayGoals: ''
      };
    }

    // 2. First Half Injury Time (45 - 48 mins)
    if (diffMin < 48) {
      const progress = 45 / 90;
      const homeTeamGoals = Math.min(finalHomeGoals, Math.floor(finalHomeGoals * progress));
      const awayTeamGoals = Math.min(finalAwayGoals, Math.floor(finalAwayGoals * progress));
      return {
        status: 'live',
        homeTeamGoals,
        awayTeamGoals,
        elapsedMinutes: `45+${diffMin - 45 + 1}`,
        homeGoals90: '',
        awayGoals90: '',
        extraHomeGoals: '',
        extraAwayGoals: '',
        penHomeGoals: '',
        penAwayGoals: ''
      };
    }

    // 3. Halftime Break (48 - 63 mins)
    if (diffMin < 63) {
      const progress = 45 / 90;
      const homeTeamGoals = Math.min(finalHomeGoals, Math.floor(finalHomeGoals * progress));
      const awayTeamGoals = Math.min(finalAwayGoals, Math.floor(finalAwayGoals * progress));
      return {
        status: 'live',
        homeTeamGoals,
        awayTeamGoals,
        elapsedMinutes: 'HT',
        homeGoals90: '',
        awayGoals90: '',
        extraHomeGoals: '',
        extraAwayGoals: '',
        penHomeGoals: '',
        penAwayGoals: ''
      };
    }

    // 4. Second Half (63 - 108 mins)
    if (diffMin < 108) {
      const progress = (45 + (diffMin - 63)) / 90;
      const homeTeamGoals = Math.min(finalHomeGoals, Math.floor(finalHomeGoals * progress));
      const awayTeamGoals = Math.min(finalAwayGoals, Math.floor(finalAwayGoals * progress));
      return {
        status: 'live',
        homeTeamGoals,
        awayTeamGoals,
        elapsedMinutes: 46 + (diffMin - 63),
        homeGoals90: '',
        awayGoals90: '',
        extraHomeGoals: '',
        extraAwayGoals: '',
        penHomeGoals: '',
        penAwayGoals: ''
      };
    }

    // 5. Second Half Injury Time (108 - 113 mins)
    if (diffMin < 113) {
      return {
        status: 'live',
        homeTeamGoals: finalHomeGoals,
        awayTeamGoals: finalAwayGoals,
        elapsedMinutes: `90+${diffMin - 108 + 1}`,
        homeGoals90: '',
        awayGoals90: '',
        extraHomeGoals: '',
        extraAwayGoals: '',
        penHomeGoals: '',
        penAwayGoals: ''
      };
    }

    // 6. Extra Time / Penalties (Knockout Draw)
    if (hasExtraTime) {
      const seed = 7;
      const etHomeExtra = (seed * 5) % 2;
      const etAwayExtra = (seed * 3) % 2;
      const etHomeTotal = finalHomeGoals + etHomeExtra;
      const etAwayTotal = finalAwayGoals + etAwayExtra;

      if (diffMin < 118) {
        return {
          status: 'live',
          homeTeamGoals: finalHomeGoals,
          awayTeamGoals: finalAwayGoals,
          elapsedMinutes: 'ET Break',
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: '',
          extraAwayGoals: '',
          penHomeGoals: '',
          penAwayGoals: ''
        };
      }
      if (diffMin < 133) {
        const progress = (diffMin - 118) / 30;
        const homeGoalsCurrent = finalHomeGoals + Math.min(etHomeExtra, Math.floor(etHomeExtra * progress));
        const awayGoalsCurrent = finalAwayGoals + Math.min(etAwayExtra, Math.floor(etAwayExtra * progress));
        return {
          status: 'live',
          homeTeamGoals: homeGoalsCurrent,
          awayTeamGoals: awayGoalsCurrent,
          elapsedMinutes: 91 + (diffMin - 118),
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: homeGoalsCurrent,
          extraAwayGoals: awayGoalsCurrent,
          penHomeGoals: '',
          penAwayGoals: ''
        };
      }
      if (diffMin < 135) {
        const progress = 15 / 30;
        const homeGoalsCurrent = finalHomeGoals + Math.min(etHomeExtra, Math.floor(etHomeExtra * progress));
        const awayGoalsCurrent = finalAwayGoals + Math.min(etAwayExtra, Math.floor(etAwayExtra * progress));
        return {
          status: 'live',
          homeTeamGoals: homeGoalsCurrent,
          awayTeamGoals: awayGoalsCurrent,
          elapsedMinutes: `105+${diffMin - 133 + 1}`,
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: homeGoalsCurrent,
          extraAwayGoals: awayGoalsCurrent,
          penHomeGoals: '',
          penAwayGoals: ''
        };
      }
      if (diffMin < 137) {
        const progress = 15 / 30;
        const homeGoalsCurrent = finalHomeGoals + Math.min(etHomeExtra, Math.floor(etHomeExtra * progress));
        const awayGoalsCurrent = finalAwayGoals + Math.min(etAwayExtra, Math.floor(etAwayExtra * progress));
        return {
          status: 'live',
          homeTeamGoals: homeGoalsCurrent,
          awayTeamGoals: awayGoalsCurrent,
          elapsedMinutes: 'ET HT',
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: homeGoalsCurrent,
          extraAwayGoals: awayGoalsCurrent,
          penHomeGoals: '',
          penAwayGoals: ''
        };
      }
      if (diffMin < 152) {
        const progress = (15 + (diffMin - 137)) / 30;
        const homeGoalsCurrent = finalHomeGoals + Math.min(etHomeExtra, Math.floor(etHomeExtra * progress));
        const awayGoalsCurrent = finalAwayGoals + Math.min(etAwayExtra, Math.floor(etAwayExtra * progress));
        return {
          status: 'live',
          homeTeamGoals: homeGoalsCurrent,
          awayTeamGoals: awayGoalsCurrent,
          elapsedMinutes: 106 + (diffMin - 137),
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: homeGoalsCurrent,
          extraAwayGoals: awayGoalsCurrent,
          penHomeGoals: '',
          penAwayGoals: ''
        };
      }
      if (diffMin < 154) {
        return {
          status: 'live',
          homeTeamGoals: etHomeTotal,
          awayTeamGoals: etAwayTotal,
          elapsedMinutes: `120+${diffMin - 152 + 1}`,
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: etHomeTotal,
          extraAwayGoals: etAwayTotal,
          penHomeGoals: '',
          penAwayGoals: ''
        };
      }
      if (diffMin < 170) {
        const progress = (diffMin - 154) / 16;
        const penHomeGoals = Math.min(5, Math.floor(5 * progress));
        const penAwayGoals = Math.min(4, Math.floor(4 * progress));
        return {
          status: 'live',
          homeTeamGoals: etHomeTotal,
          awayTeamGoals: etAwayTotal,
          elapsedMinutes: 'PEN',
          homeGoals90: finalHomeGoals,
          awayGoals90: finalAwayGoals,
          extraHomeGoals: etHomeTotal,
          extraAwayGoals: etAwayTotal,
          penHomeGoals: penHomeGoals,
          penAwayGoals: penAwayGoals
        };
      }
      const penHomeWinner = (seed * 7) % 2 === 0;
      const finalETHome = etHomeTotal + (penHomeWinner ? 1 : 0);
      const finalETAway = etAwayTotal + (penHomeWinner ? 0 : 1);
      return {
        status: 'completed',
        homeTeamGoals: finalETHome,
        awayTeamGoals: finalETAway,
        elapsedMinutes: '',
        homeGoals90: finalHomeGoals,
        awayGoals90: finalAwayGoals,
        extraHomeGoals: etHomeTotal,
        extraAwayGoals: etAwayTotal,
        penHomeGoals: penHomeWinner ? 5 : 4,
        penAwayGoals: penHomeWinner ? 4 : 5
      };
    }

    // 7. Completed Normal Match
    return {
      status: 'completed',
      homeTeamGoals: finalHomeGoals,
      awayTeamGoals: finalAwayGoals,
      elapsedMinutes: '',
      homeGoals90: finalHomeGoals,
      awayGoals90: finalAwayGoals,
      extraHomeGoals: '',
      extraAwayGoals: '',
      penHomeGoals: '',
      penAwayGoals: ''
    };
  }

  removeVietnameseAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd')
              .replace(/Đ/g, 'D')
              .toLowerCase();
  }

  matchTeamName(dbName, flashName) {
    const normDb = this.removeVietnameseAccents(dbName).trim();
    const normFlash = this.removeVietnameseAccents(flashName).trim();
    
    if (normDb === normFlash) return true;
    if (normDb.includes(normFlash) || normFlash.includes(normDb)) return true;
    
    // Check translation map (loaded dynamically from config to avoid hardcoding)
    let teamTranslations = {};
    try {
      teamTranslations = require('../config/team-translations.json');
    } catch (err) {
      console.warn('⚠️ Failed to load team translations config:', err.message);
    }

    if (teamTranslations[dbName]) {
      return teamTranslations[dbName].some(val => normFlash.includes(val) || val.includes(normFlash));
    }
    return false;
  }
}

module.exports = MatchService;
