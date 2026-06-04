/**
 * init-data.js
 * Run once: node init-data.js
 * Creates data/accounts.xlsx, data/matches.xlsx, data/bets.xlsx
 * Loads match schedules from the FIFA API dynamically.
 */
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const https = require('https');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function convertKeysToUpper(obj) {
  const uppercased = {};
  for (const [key, val] of Object.entries(obj)) {
    uppercased[key.toUpperCase()] = val;
  }
  return uppercased;
}

function writeSheet(filePath, sheetName, data) {
  const wb = xlsx.utils.book_new();
  const uppercasedData = (data || []).map(item => convertKeysToUpper(item));
  const ws = xlsx.utils.json_to_sheet(uppercasedData);
  xlsx.utils.book_append_sheet(wb, ws, sheetName);
  xlsx.writeFile(wb, filePath);
  console.log(`✅ Created: ${filePath}`);
}

// ─── 1. ACCOUNTS ─────────────────────────────────────────────────────────────
const accounts = [
  {
    id: '1',
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    fullName: 'Administrator',
    role: 'admin',
  },
  {
    id: '2',
    username: 'lctran',
    password: bcrypt.hashSync('lctran123', 10),
    fullName: 'Lê Công Trân',
    role: 'admin',
  },
  {
    id: '3',
    username: 'cam',
    password: bcrypt.hashSync('cam123', 10),
    fullName: 'Nguyễn Thị Cam',
    role: 'user',
  },
];
writeSheet(path.join(DATA_DIR, 'accounts.xlsx'), 'accounts', accounts);

// ─── 2. MATCHES (Fetched dynamically from API) ──────────────────────────────
const MATCHES_URL = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matches.json';
const TEAMS_URL = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json';
const STADIUMS_URL = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.stadiums.json';

// Sportmonks configuration
const SPORTMONKS_CONFIG = {
  enabled: process.env.USE_SPORTMONKS !== 'false', // Default to true if not explicitly disabled
  token: process.env.SPORTMONKS_TOKEN || 'YiP9bZ1dY3Y7XI6YG25DgQ573I8HxWxSXqE2yrg4jv2Xd0Tp8yF5SiTWv8OE',
  leagueId: parseInt(process.env.SPORTMONKS_LEAGUE_ID || '796', 10) // Default 796 (World Cup)
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function fetchJsonWithHeader(url, headers = {}) {
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

async function fetchAllSportmonksFixtures(leagueId, token) {
  let fixtures = [];
  let url = `https://api.sportmonks.com/v3/football/fixtures?filters=fixtureLeagues:${leagueId}&include=participants.country;scores;state;stage;group;round;venue`;
  
  while (url) {
    const response = await fetchJsonWithHeader(url, { 'Authorization': token });
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

const cityOffsets = {
  'Mexico City': -6,
  'Guadalajara': -6,
  'Monterrey': -6,
  'Toronto': -4,
  'Boston': -4,
  'Houston': -5,
  'Kansas City': -5,
  'Miami': -4,
  'New York': -4,
  'New Jersey': -4,
  'Philadelphia': -4,
  'San Francisco': -7,
  'Seattle': -7,
  'Vancouver': -7,
  'Atlanta': -4,
  'Dallas': -5,
  'Los Angeles': -7
};

function getOffsetForCity(city) {
  for (const [key, offset] of Object.entries(cityOffsets)) {
    if (city.includes(key)) {
      return offset;
    }
  }
  return null;
}

const specialFlags = {
  'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'WAL': '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
};

function getFlagEmoji(team) {
  if (specialFlags[team.iso2]) return specialFlags[team.iso2];
  if (team.iso2 && team.iso2.length === 2) {
    const codePoints = team.iso2
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
  return '🏳️';
}

function normalizeTeamName(name) {
  if (name === 'United States') return 'USA';
  if (name === 'Czech Republic') return 'Czechia';
  if (name === 'Bosnia and Herzegovina') return 'Bosnia-Herzegovina';
  if (name === 'Turkey') return 'Türkiye';
  if (name === 'Democratic Republic of the Congo') return 'DR Congo';
  return name;
}

function convertToVietnamTime(localDateStr, city) {
  const offset = getOffsetForCity(city);
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

function convertUtcToVnTime(utcDateStr) {
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

function getMatchStatus(stateShortName) {
  const short = (stateShortName || '').toUpperCase();
  if (['NS', 'TBD', 'POSTP', 'CANCL', 'SUSP'].includes(short)) return 'scheduled';
  if (['FT', 'AET', 'FT_PEN', 'AWARDED'].includes(short)) return 'completed';
  return 'live';
}

function getVietnameseRound(stageName, roundName, groupName) {
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

function mapSportmonksFixtureToMatch(f) {
  const homePart = f.participants.find(p => p.meta && p.meta.location === 'home');
  const awayPart = f.participants.find(p => p.meta && p.meta.location === 'away');

  const homeTeamName = homePart ? normalizeTeamName(homePart.name) : 'TBD';
  const homeTeamFlag = (homePart && homePart.country) ? getFlagEmoji(homePart.country) : '🏳️';
  
  const awayTeamName = awayPart ? normalizeTeamName(awayPart.name) : 'TBD';
  const awayTeamFlag = (awayPart && awayPart.country) ? getFlagEmoji(awayPart.country) : '🏳️';

  const groupName = f.group ? f.group.name : null;
  const stageName = f.stage ? f.stage.name : null;
  const roundName = f.round ? f.round.name : null;
  
  const round = getVietnameseRound(stageName, roundName, groupName);

  let groupKey = 'knockout';
  if (groupName) {
    const letter = groupName.replace(/group/i, '').trim().toUpperCase();
    groupKey = `Group${letter}`;
  } else if (stageName && stageName.toLowerCase().includes('final') && !stageName.toLowerCase().includes('semi') && !stageName.toLowerCase().includes('quarter')) {
    groupKey = 'final';
  }

  const time = convertUtcToVnTime(f.starting_at);
  const status = getMatchStatus(f.state ? f.state.short_name : 'NS');

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

async function loadMatches() {
  let processedMatches = [];
  let success = false;

  if (SPORTMONKS_CONFIG.enabled && SPORTMONKS_CONFIG.token) {
    try {
      console.log(`🌐 Fetching official World Cup data from Sportmonks API (League ID: ${SPORTMONKS_CONFIG.leagueId})...`);
      const fixtures = await fetchAllSportmonksFixtures(SPORTMONKS_CONFIG.leagueId, SPORTMONKS_CONFIG.token);
      processedMatches = fixtures.map(f => mapSportmonksFixtureToMatch(f));
      success = true;
      console.log(`⚽ Successfully retrieved ${processedMatches.length} matches from Sportmonks API.`);
    } catch (err) {
      console.warn(`⚠️ Sportmonks API sync failed: ${err.message}. Falling back to GitHub FIFA data source...`);
    }
  }

  if (!success) {
    console.log('🌐 Fetching official 2026 World Cup data from FIFA API (GitHub raw fallback)...');
    const [rawMatches, rawTeams, rawStadiums] = await Promise.all([
      fetchJson(MATCHES_URL),
      fetchJson(TEAMS_URL),
      fetchJson(STADIUMS_URL)
    ]);

    const teamMap = {};
    rawTeams.forEach(t => teamMap[t.id] = t);

    const stadiumMap = {};
    rawStadiums.forEach(s => stadiumMap[s.id] = s);

    processedMatches = rawMatches.map(m => {
      const isGroup = m.type === 'group';
      let groupKey = isGroup ? `Group${m.group.toUpperCase()}` : 'knockout';
      
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

      const homeTeamName = homeTeam ? normalizeTeamName(homeTeam.name_en) : 'TBD';
      const homeTeamFlag = homeTeam ? getFlagEmoji(homeTeam) : '🏳️';
      
      const awayTeamName = awayTeam ? normalizeTeamName(awayTeam.name_en) : 'TBD';
      const awayTeamFlag = awayTeam ? getFlagEmoji(awayTeam) : '🏳️';

      const stadium = stadiumMap[m.stadium_id];
      const city = stadium ? stadium.city_en : 'Unknown';
      const time = convertToVietnamTime(m.local_date, city);

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

  // Sort matches by time, then by ID
  processedMatches.sort((a, b) => {
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    return a.id - b.id;
  });

  writeSheet(path.join(DATA_DIR, 'matches.xlsx'), 'matches', processedMatches);
  console.log(`⚽ Successfully seeded ${processedMatches.length} matches to matches.xlsx.`);
}

async function run() {
  await loadMatches();
  
  // ─── 3. BETS (empty initially) ───────────────────────────────────────────────
  writeSheet(path.join(DATA_DIR, 'bets.xlsx'), 'bets', []);

  console.log('\n🎉 Data initialized successfully!');
}

run();
