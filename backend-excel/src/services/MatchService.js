const https = require('https');
const fs = require('fs');

/**
 * Service to manage match schedules, API synchronization and status updates.
 */
class MatchService {
  /**
   * @param {ExcelService} excelService - The Excel service instance.
   * @param {string} matchesFile - Path to the matches Excel file.
   * @param {BetService} [betService] - The Bet service instance to auto-settle bets.
   */
  constructor(excelService, matchesFile, betService = null) {
    this.excelService = excelService;
    this.matchesFile = matchesFile;
    this.betService = betService;
    
    // FIFA API endpoint URLs (Github Fallbacks)
    this.matchesUrl = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matches.json';
    this.teamsUrl = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json';
    this.stadiumsUrl = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.stadiums.json';

    // Sportmonks configuration
    this.sportmonksConfig = {
      enabled: process.env.USE_SPORTMONKS !== 'false',
      token: process.env.SPORTMONKS_TOKEN || 'YiP9bZ1dY3Y7XI6YG25DgQ573I8HxWxSXqE2yrg4jv2Xd0Tp8yF5SiTWv8OE',
      leagueId: parseInt(process.env.SPORTMONKS_LEAGUE_ID || '796', 10)
    };

    // Mapping city offsets for WC 2026 Host Cities
    this.cityOffsets = {
      'Mexico City': -6, 'Guadalajara': -6, 'Monterrey': -6, 'Toronto': -4,
      'Boston': -4, 'Houston': -5, 'Kansas City': -5, 'Miami': -4,
      'New York': -4, 'New Jersey': -4, 'Philadelphia': -4, 'San Francisco': -7,
      'Seattle': -7, 'Vancouver': -7, 'Atlanta': -4, 'Dallas': -5, 'Los Angeles': -7
    };

    // Mapping for UK nations special flag emojis
    this.specialFlags = {
      'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      'WAL': '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
    };
  }

  /**
   * Set BetService dependency after instantiation (resolves circular references).
   * @param {BetService} betService 
   */
  setBetService(betService) {
    this.betService = betService;
  }

  /**
   * Helper to perform HTTP GET requests returning JSON.
   */
  fetchJson(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Helper to perform HTTP GET requests with custom headers returning JSON.
   */
  fetchJsonWithHeader(url, headers = {}) {
    return new Promise((resolve, reject) => {
      https.get(url, { headers }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 400 || (json && json.message && json.message.includes('subscription'))) {
              reject(new Error(json.message || `HTTP ${res.statusCode}`));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Recursive method to fetch all fixtures from Sportmonks pagination.
   */
  async fetchAllSportmonksFixtures(leagueId, token) {
    let fixtures = [];
    let url = `https://api.sportmonks.com/v3/football/fixtures?filters=fixtureLeagues:${leagueId}&include=participants.country;scores;state;stage;group;round;venue`;
    
    while (url) {
      const response = await this.fetchJsonWithHeader(url, { 'Authorization': token });
      if (response && response.data) {
        fixtures = fixtures.concat(response.data);
      }
      if (response && response.pagination && response.pagination.has_more && response.pagination.next_page) {
        url = response.pagination.next_page;
      } else {
        url = null;
      }
    }
    return fixtures;
  }

  /**
   * Normalizes UTC Date Strings to Vietnam Time Format (YYYY-MM-DD HH:mm).
   */
  convertUtcToVnTime(utcDateStr) {
    const d = new Date(utcDateStr + ' UTC');
    if (isNaN(d.getTime())) return utcDateStr;
    
    const vnDate = new Date(d.getTime() + (7 * 60 * 60 * 1000));
    const y = vnDate.getUTCFullYear();
    const m = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vnDate.getUTCDate()).padStart(2, '0');
    const h = String(vnDate.getUTCHours()).padStart(2, '0');
    const min = String(vnDate.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  /**
   * Converts local timezone based local_date to VN time using city offset.
   */
  convertToVietnamTime(localDateStr, city) {
    const offset = this.getOffsetForCity(city);
    if (offset === null) return localDateStr;
    
    const parts = localDateStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
    if (!parts) return localDateStr;
    
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);
    const hour = parseInt(parts[4], 10);
    const minute = parseInt(parts[5], 10);
    
    const utcDate = new Date(Date.UTC(year, month, day, hour - offset, minute));
    const vnDate = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
    
    const vnYear = vnDate.getUTCFullYear();
    const vnMonth = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const vnDay = String(vnDate.getUTCDate()).padStart(2, '0');
    const vnHour = String(vnDate.getUTCHours()).padStart(2, '0');
    const vnMin = String(vnDate.getUTCMinutes()).padStart(2, '0');
    
    return `${vnYear}-${vnMonth}-${vnDay} ${vnHour}:${vnMin}`;
  }

  /**
   * Normalizes match state to 'scheduled', 'live', or 'completed'.
   */
  getMatchStatus(stateShortName) {
    const short = (stateShortName || '').toUpperCase();
    if (['NS', 'TBD', 'POSTP', 'CANCL', 'SUSP'].includes(short)) return 'scheduled';
    if (['FT', 'AET', 'FT_PEN', 'AWARDED'].includes(short)) return 'completed';
    return 'live';
  }

  /**
   * Converts group name/stage name to user-friendly Vietnamese terminology.
   */
  getVietnameseRound(stageName, roundName, groupName) {
    if (groupName) {
      const letter = groupName.replace(/group/i, '').trim();
      return `Bảng ${letter.toUpperCase()}`;
    }
    const name = (stageName || roundName || '').toLowerCase();
    if (name.includes('32')) return 'Vòng 1/32';
    if (name.includes('16')) return 'Vòng 1/16';
    if (name.includes('quarter') || name.includes('qf')) return 'Tứ Kết';
    if (name.includes('semi') || name.includes('sf')) return 'Bán Kết';
    if (name.includes('third') || name.includes('3rd') || name.includes('place')) return 'Tranh Hạng Ba';
    if (name.includes('final')) return 'Chung Kết';
    return stageName || roundName || '';
  }

  getOffsetForCity(city) {
    for (const [key, offset] of Object.entries(this.cityOffsets)) {
      if (city.includes(key)) {
        return offset;
      }
    }
    return null;
  }

  getFlagEmoji(team) {
    if (this.specialFlags[team.iso2]) return this.specialFlags[team.iso2];
    if (team.iso2 && team.iso2.length === 2) {
      const codePoints = team.iso2
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    }
    return '🏳️';
  }

  normalizeTeamName(name) {
    if (name === 'United States') return 'USA';
    if (name === 'Czech Republic') return 'Czechia';
    if (name === 'Bosnia and Herzegovina') return 'Bosnia-Herzegovina';
    if (name === 'Turkey') return 'Türkiye';
    if (name === 'Democratic Republic of the Congo') return 'DR Congo';
    return name;
  }

  mapSportmonksFixtureToMatch(f) {
    const homePart = f.participants.find(p => p.meta && p.meta.location === 'home');
    const awayPart = f.participants.find(p => p.meta && p.meta.location === 'away');

    const homeTeamName = homePart ? this.normalizeTeamName(homePart.name) : 'TBD';
    const homeTeamFlag = (homePart && homePart.country) ? this.getFlagEmoji(homePart.country) : '🏳️';
    
    const awayTeamName = awayPart ? this.normalizeTeamName(awayPart.name) : 'TBD';
    const awayTeamFlag = (awayPart && awayPart.country) ? this.getFlagEmoji(awayPart.country) : '🏳️';

    const groupName = f.group ? f.group.name : null;
    const stageName = f.stage ? f.stage.name : null;
    const roundName = f.round ? f.round.name : null;
    
    const round = this.getVietnameseRound(stageName, roundName, groupName);

    let groupKey = 'knockout';
    if (groupName) {
      const letter = groupName.replace(/group/i, '').trim().toUpperCase();
      groupKey = `Group${letter}`;
    } else if (stageName && stageName.toLowerCase().includes('final') && !stageName.toLowerCase().includes('semi') && !stageName.toLowerCase().includes('quarter')) {
      groupKey = 'final';
    }

    const time = this.convertUtcToVnTime(f.starting_at);
    const status = this.getMatchStatus(f.state ? f.state.short_name : 'NS');

    const homeScoreObj = f.scores.find(s => s.type_id === 1525 && s.score && s.score.participant === 'home');
    const awayScoreObj = f.scores.find(s => s.type_id === 1525 && s.score && s.score.participant === 'away');
    
    const homeTeamGoals = (status === 'scheduled') ? '' : (homeScoreObj ? parseInt(homeScoreObj.score.goals, 10) : 0);
    const awayTeamGoals = (status === 'scheduled') ? '' : (awayScoreObj ? parseInt(awayScoreObj.score.goals, 10) : 0);

    let elapsedMinutes = '';
    if (status === 'live') {
      const matchMin = f.state && f.state.name ? f.state.name.match(/\d+/) : null;
      elapsedMinutes = matchMin ? parseInt(matchMin[0], 10) : 45;
    }

    const stadium = f.venue ? f.venue.name : 'Unknown Stadium';

    return {
      id: parseInt(f.id, 10),
      groupKey,
      round,
      time,
      homeTeamName,
      homeTeamFlag,
      awayTeamName,
      awayTeamFlag,
      status,
      homeTeamGoals,
      awayTeamGoals,
      elapsedMinutes,
      stadium
    };
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
      m.elapsedMinutes = m.elapsedMinutes !== '' ? Number(m.elapsedMinutes) : null;
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
    
    // Auto settle bets if status was transitioned to completed
    if (matches[idx].status === 'completed' && oldMatch.status !== 'completed') {
      console.log(`🏆 Match ${id} manually completed: ${matches[idx].homeTeamName} ${matches[idx].homeTeamGoals}-${matches[idx].awayTeamGoals} ${matches[idx].awayTeamName}`);
      if (this.betService) {
        this.betService.autoSettleBetsForMatch(matches[idx]);
      }
    }

    this.excelService.writeSheet(this.matchesFile, 'matches', matches);
    return matches[idx];
  }

  /**
   * Synchronizes match data from Sportmonks API (default) or FIFA GitHub fallbacks.
   * Automatically schedules bet auto-settlement for newly completed matches.
   */
  async syncMatchesFromApi() {
    let processedMatches = [];
    let success = false;

    if (this.sportmonksConfig.enabled && this.sportmonksConfig.token) {
      try {
        console.log(`🔄 Syncing World Cup matches from Sportmonks API (League ID: ${this.sportmonksConfig.leagueId})...`);
        const fixtures = await this.fetchAllSportmonksFixtures(this.sportmonksConfig.leagueId, this.sportmonksConfig.token);
        processedMatches = fixtures.map(f => this.mapSportmonksFixtureToMatch(f));
        success = true;
        console.log(`✅ Successfully synced matches from Sportmonks API.`);
      } catch (err) {
        console.warn(`⚠️ Sportmonks API sync failed: ${err.message}. Falling back to GitHub FIFA data source...`);
      }
    }

    if (!success) {
      console.log('🌐 Fetching official 2026 World Cup data from FIFA API (GitHub raw fallback)...');
      const [rawMatches, rawTeams, rawStadiums] = await Promise.all([
        this.fetchJson(this.matchesUrl),
        this.fetchJson(this.teamsUrl),
        this.fetchJson(this.stadiumsUrl)
      ]);

      const teamMap = {};
      rawTeams.forEach(t => teamMap[t.id] = t);

      const stadiumMap = {};
      rawStadiums.forEach(s => stadiumMap[s.id] = s);

      processedMatches = rawMatches.map(m => {
        const isGroup = m.type === 'group';
        let groupKey = 'knockout';
        if (isGroup) {
          groupKey = `Group${m.group.toUpperCase()}`;
        } else if (m.type.toLowerCase() === 'final') {
          groupKey = 'final';
        }
        
        let round = '';
        if (isGroup) {
          round = `Bảng ${m.group.toUpperCase()}`;
        } else {
          const type = m.type.toLowerCase();
          if (type === 'r32') round = 'Vòng 1/32';
          else if (type === 'r16') round = 'Vòng 1/16';
          else if (type === 'qf') round = 'Tứ Kết';
          else if (type === 'sf') round = 'Bán Kết';
          else if (type === 'third') round = 'Tranh Hạng Ba';
          else if (type === 'final') round = 'Chung Kết';
          else round = m.type;
        }

        const homeTeam = teamMap[m.home_team_id];
        const awayTeam = teamMap[m.away_team_id];

        const homeTeamName = homeTeam ? this.normalizeTeamName(homeTeam.name_en) : 'TBD';
        const homeTeamFlag = homeTeam ? this.getFlagEmoji(homeTeam) : '🏳️';
        
        const awayTeamName = awayTeam ? this.normalizeTeamName(awayTeam.name_en) : 'TBD';
        const awayTeamFlag = awayTeam ? this.getFlagEmoji(awayTeam) : '🏳️';

        const stadium = stadiumMap[m.stadium_id];
        const city = stadium ? stadium.city_en : 'Unknown';
        const time = this.convertToVietnamTime(m.local_date, city);

        let status = 'scheduled';
        if (m.finished === 'TRUE') {
          status = 'completed';
        } else if (m.time_elapsed && m.time_elapsed !== 'notstarted') {
          status = 'live';
        }

        const homeTeamGoals = (status === 'scheduled') ? '' : parseInt(m.home_score, 10);
        const awayTeamGoals = (status === 'scheduled') ? '' : parseInt(m.away_score, 10);
        const elapsedMinutes = (status === 'live') ? (parseInt(m.time_elapsed, 10) || 0) : '';

        return {
          id: parseInt(m.id, 10),
          groupKey,
          round,
          time,
          homeTeamName,
          homeTeamFlag,
          awayTeamName,
          awayTeamFlag,
          status,
          homeTeamGoals,
          awayTeamGoals,
          elapsedMinutes,
          stadium: stadium ? stadium.name_en : 'Unknown Stadium'
        };
      });
    }

    const existingMatches = fs.existsSync(this.matchesFile) ? this.excelService.readSheet(this.matchesFile, 'matches') : [];

    processedMatches.sort((a, b) => {
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      return a.id - b.id;
    });

    processedMatches.forEach(newMatch => {
      const oldMatch = existingMatches.find(o => parseInt(o.id, 10) === newMatch.id);
      const oldStatus = oldMatch ? oldMatch.status : 'scheduled';
      if (newMatch.status === 'completed' && oldStatus !== 'completed') {
        console.log(`🏆 Match ${newMatch.id} completed: ${newMatch.homeTeamName} ${newMatch.homeTeamGoals}-${newMatch.awayTeamGoals} ${newMatch.awayTeamName}`);
        if (this.betService) {
          this.betService.autoSettleBetsForMatch(newMatch);
        }
      }
    });

    this.excelService.writeSheet(this.matchesFile, 'matches', processedMatches);
    console.log(`✅ Synced matches database: ${processedMatches.length} matches written to matches.xlsx.`);
    return processedMatches;
  }
}

module.exports = MatchService;
