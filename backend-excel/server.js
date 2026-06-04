const express = require('express');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── File paths ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.xlsx');
const BETS_FILE     = path.join(DATA_DIR, 'bets.xlsx');
const MATCHES_FILE  = path.join(DATA_DIR, 'matches.xlsx');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── FIFA API Integration ──────────────────────────────────────────────────
const https = require('https');

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

function autoSettleBetsForMatch(match) {
  const bets = readSheet(BETS_FILE, 'bets');
  const homeGoals = parseInt(match.homeTeamGoals, 10);
  const awayGoals = parseInt(match.awayTeamGoals, 10);
  
  if (isNaN(homeGoals) || isNaN(awayGoals)) return;
  
  let outcome = 'draw';
  if (homeGoals > awayGoals) outcome = 'homeWin';
  else if (awayGoals > homeGoals) outcome = 'awayWin';
  
  // Guard: if it's a knockout match, it cannot end in a draw. 
  // If the score is a draw, wait for manual settlement or shootout update.
  if ((match.groupKey === 'knockout' || match.groupKey === 'final') && outcome === 'draw') {
    console.warn(`⚠️ Match ${match.id} (${match.homeTeamName} vs ${match.awayTeamName}) is a knockout draw. Skipping auto-settlement.`);
    return;
  }
  
  let updated = false;
  bets.forEach(bet => {
    if (bet.matchId?.toString() === match.id.toString() && bet.status === 'pending') {
      let isWon = false;
      const betTypeLower = (bet.betType || '').toLowerCase();
      if (outcome === 'homeWin' && bet.betType === match.homeTeamName) isWon = true;
      else if (outcome === 'awayWin' && bet.betType === match.awayTeamName) isWon = true;
      else if (outcome === 'draw' && (betTypeLower === 'hòa' || betTypeLower === 'draw')) isWon = true;
      else if (bet.betType === outcome) isWon = true; // Legacy compatibility

      bet.status = isWon ? 'won' : 'lost';
      bet.payout = bet.status === 'won' ? 0 : -Number(bet.stake || 10000);
      updated = true;
      console.log(`💰 Automatically settled bet ${bet.id} for ${bet.name} as [${bet.status}]`);
    }
  });
  
  if (updated) {
    writeSheet(BETS_FILE, 'bets', bets);
  }
}

async function syncMatchesFromApi() {
  let processedMatches = [];
  let success = false;

  if (SPORTMONKS_CONFIG.enabled && SPORTMONKS_CONFIG.token) {
    try {
      console.log(`🔄 Syncing World Cup matches from Sportmonks API (League ID: ${SPORTMONKS_CONFIG.leagueId})...`);
      const fixtures = await fetchAllSportmonksFixtures(SPORTMONKS_CONFIG.leagueId, SPORTMONKS_CONFIG.token);
      processedMatches = fixtures.map(f => mapSportmonksFixtureToMatch(f));
      success = true;
      console.log(`✅ Successfully synced matches from Sportmonks API.`);
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

  const existingMatches = fs.existsSync(MATCHES_FILE) ? readSheet(MATCHES_FILE, 'matches') : [];

  processedMatches.sort((a, b) => {
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    return a.id - b.id;
  });

  processedMatches.forEach(newMatch => {
    const oldMatch = existingMatches.find(o => parseInt(o.id, 10) === newMatch.id);
    const oldStatus = oldMatch ? oldMatch.status : 'scheduled';
    if (newMatch.status === 'completed' && oldStatus !== 'completed') {
      console.log(`🏆 Match ${newMatch.id} completed: ${newMatch.homeTeamName} ${newMatch.homeTeamGoals}-${newMatch.awayTeamGoals} ${newMatch.awayTeamName}`);
      autoSettleBetsForMatch(newMatch);
    }
  });

  writeSheet(MATCHES_FILE, 'matches', processedMatches);
  console.log(`✅ Synced matches database: ${processedMatches.length} matches written to matches.xlsx.`);
}

// On startup: Sync matches from FIFA API if not updated in the last 24 hours
(async () => {
  try {
    let shouldSync = true;
    if (fs.existsSync(MATCHES_FILE)) {
      const stats = fs.statSync(MATCHES_FILE);
      const now = new Date();
      const diffMs = now.getTime() - stats.mtime.getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (diffMs < twentyFourHoursMs) {
        shouldSync = false;
        const lastUpdatedHours = (diffMs / (60 * 60 * 1000)).toFixed(1);
        console.log(`🌐 Matches database was updated ${lastUpdatedHours} hours ago (less than 24h). Skipping startup sync.`);
      }
    }
    
    if (shouldSync) {
      console.log('🌐 Syncing WC 2026 matches from FIFA API on startup...');
      await syncMatchesFromApi();
    }
  } catch (err) {
    console.warn('⚠️ Startup sync failed (using local cache if available):', err.message);
  }
})();

// Auto-sync matches from FIFA API every 24 hours (86,400,000 ms)
setInterval(async () => {
  try {
    console.log('🔄 Auto-syncing matches from FIFA API (daily schedule)...');
    await syncMatchesFromApi();
  } catch (err) {
    console.error('❌ Auto-sync failed:', err.message);
  }
}, 24 * 60 * 60 * 1000);



// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Excel helpers ───────────────────────────────────────────────────────────
const ORIGINAL_KEYS = [
  'id', 'date', 'name', 'username', 'password', 'fullName', 'role',
  'matchId', 'matchName', 'betType', 'stake', 'status', 'payout',
  'groupKey', 'round', 'time', 'homeTeamName', 'homeTeamFlag',
  'awayTeamName', 'awayTeamFlag', 'homeTeamGoals', 'awayTeamGoals',
  'elapsedMinutes', 'stadium'
];

function normalizeKeysToCamel(obj) {
  const normalized = {};
  for (const [key, val] of Object.entries(obj)) {
    const matchedKey = ORIGINAL_KEYS.find(k => k.toUpperCase() === key.toUpperCase());
    if (matchedKey) {
      normalized[matchedKey] = val;
    } else {
      normalized[key] = val;
    }
  }
  return normalized;
}

function convertKeysToUpper(obj) {
  const uppercased = {};
  for (const [key, val] of Object.entries(obj)) {
    uppercased[key.toUpperCase()] = val;
  }
  return uppercased;
}

function readSheet(filePath, sheetName) {
  try {
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
    if (!ws) return [];
    const rawRows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    return rawRows.map(row => normalizeKeysToCamel(row));
  } catch (e) {
    console.warn(`[Excel] Could not read ${filePath}:`, e.message);
    return [];
  }
}

function writeSheet(filePath, sheetName, data) {
  let wb;
  try {
    wb = xlsx.readFile(filePath);
  } catch {
    wb = xlsx.utils.book_new();
  }
  
  const uppercasedData = (data || []).map(item => convertKeysToUpper(item));
  const ws = xlsx.utils.json_to_sheet(uppercasedData);
  
  if (wb.SheetNames.includes(sheetName)) {
    wb.Sheets[sheetName] = ws;
  } else {
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
  }
  try {
    xlsx.writeFile(wb, filePath);
  } catch (err) {
    if (err.code === 'EBUSY') {
      const fileName = path.basename(filePath);
      throw new Error(`FILE_LOCKED: Tệp Excel '${fileName}' đang bị mở bằng ứng dụng khác (ví dụ: Microsoft Excel). Vui lòng đóng tệp Excel này lại và thử lại!`);
    }
    throw err;
  }
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────
app.get('/api/matches', (req, res) => {
  const matches = readSheet(MATCHES_FILE, 'matches');
  matches.forEach(m => {
    m.homeTeamGoals  = m.homeTeamGoals  !== '' ? Number(m.homeTeamGoals)  : null;
    m.awayTeamGoals  = m.awayTeamGoals  !== '' ? Number(m.awayTeamGoals)  : null;
    m.elapsedMinutes = m.elapsedMinutes !== '' ? Number(m.elapsedMinutes) : null;
  });
  res.json(matches);
});

app.post('/api/matches/sync', async (req, res) => {
  try {
    console.log('🔄 Manual matches sync triggered via API endpoint...');
    await syncMatchesFromApi();
    const matches = readSheet(MATCHES_FILE, 'matches');
    matches.forEach(m => {
      m.homeTeamGoals  = m.homeTeamGoals  !== '' ? Number(m.homeTeamGoals)  : null;
      m.awayTeamGoals  = m.awayTeamGoals  !== '' ? Number(m.awayTeamGoals)  : null;
      m.elapsedMinutes = m.elapsedMinutes !== '' ? Number(m.elapsedMinutes) : null;
    });
    res.json({ message: 'Sync complete', matches });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync matches from API: ' + err.message });
  }
});

app.put('/api/matches/:id/status', (req, res) => {
  const matches = readSheet(MATCHES_FILE, 'matches');
  const idx = matches.findIndex(m => m.id?.toString() === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Match not found' });
  Object.assign(matches[idx], req.body);
  writeSheet(MATCHES_FILE, 'matches', matches);
  res.json(matches[idx]);
});

// ─── BETS ────────────────────────────────────────────────────────────────────
app.get('/api/bets', (req, res) => {
  const bets = readSheet(BETS_FILE, 'bets');
  bets.forEach(b => { b.stake = Number(b.stake) || 0; });
  res.json(bets);
});

app.get('/api/bets/export', (req, res) => {
  if (!fs.existsSync(BETS_FILE)) {
    return res.status(404).send('Bets file does not exist');
  }
  res.download(BETS_FILE, 'bets.xlsx', (err) => {
    if (err) {
      console.error('[Export Error]', err);
      res.status(500).send('Error downloading file');
    }
  });
});

app.post('/api/bets', (req, res) => {
  const bets = readSheet(BETS_FILE, 'bets');
  const matchIdStr = req.body.matchId?.toString();
  const username = req.body.username || '';
  const fullName = req.body.name || '';

  // Check if this user has already placed a bet on this match
  const existingBet = bets.find(b => 
    b.matchId?.toString() === matchIdStr && 
    ((username && b.username === username) || (fullName && b.name === fullName))
  );

  if (existingBet) {
    return res.status(409).json({ error: 'Bạn đã đặt cược cho trận đấu này rồi! Mỗi người chơi chỉ được cược tối đa 1 lần cho mỗi trận.' });
  }

  const matches = readSheet(MATCHES_FILE, 'matches');
  const match = matches.find(m => m.id?.toString() === matchIdStr);
  
  let resolvedBetType = req.body.betType || 'homeWin';
  if (match) {
    if (req.body.betType === 'homeWin') {
      resolvedBetType = match.homeTeamName;
    } else if (req.body.betType === 'awayWin') {
      resolvedBetType = match.awayTeamName;
    } else if (req.body.betType === 'draw') {
      resolvedBetType = 'Draw';
    }
  } else {
    if (req.body.betType === 'draw') {
      resolvedBetType = 'Draw';
    }
  }

  const newBet = {
    id:        uuidv4(),
    date:      new Date().toISOString(),
    name:      fullName,
    username:  username,
    matchId:   req.body.matchId   || '',
    matchName: req.body.matchName || '',
    betType:   resolvedBetType,
    stake:     Number(req.body.stake) || 10000,
    status:    'pending',
    payout:    0,
  };
  bets.push(newBet);
  writeSheet(BETS_FILE, 'bets', bets);
  res.status(201).json(newBet);
});

app.put('/api/bets/:id/status', (req, res) => {
  const bets = readSheet(BETS_FILE, 'bets');
  const { status } = req.query;
  const idx = bets.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bet not found' });
  bets[idx].status = status;
  bets[idx].payout = status === 'won' ? 0 : -Number(bets[idx].stake || 10000);
  writeSheet(BETS_FILE, 'bets', bets);
  res.json(bets[idx]);
});

app.delete('/api/bets/bulk', (req, res) => {
  const ids = req.body;
  if (!Array.isArray(ids)) return res.status(400).send('ids must be array');
  let bets = readSheet(BETS_FILE, 'bets');
  const matches = readSheet(MATCHES_FILE, 'matches');
  bets = bets.filter(b => {
    if (!ids.includes(b.id)) return true; // keep if not in delete list
    const match = matches.find(m => m.id?.toString() === b.matchId?.toString());
    if (match && (match.status === 'live' || match.status === 'completed')) return true; // keep locked bets
    return false; // remove
  });
  writeSheet(BETS_FILE, 'bets', bets);
  res.send('Bulk deleted');
});

app.delete('/api/bets/:id', (req, res) => {
  let bets = readSheet(BETS_FILE, 'bets');
  const bet = bets.find(b => b.id === req.params.id);
  if (!bet) return res.status(404).send('Not found');
  const matches = readSheet(MATCHES_FILE, 'matches');
  const match = matches.find(m => m.id?.toString() === bet.matchId?.toString());
  if (match && (match.status === 'live' || match.status === 'completed')) {
    return res.status(403).send('Cannot delete bet for active/completed match');
  }
  bets = bets.filter(b => b.id !== req.params.id);
  writeSheet(BETS_FILE, 'bets', bets);
  res.send('Deleted');
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const accounts = readSheet(ACCOUNTS_FILE, 'accounts');
  const user = accounts.find(a => a.username === username);
  if (!user) return res.status(401).json({ error: 'AUTH_USER_NOT_FOUND' });
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'AUTH_WRONG_PASSWORD' });
  res.json({ username: user.username, fullName: user.fullName, role: user.role || 'user' });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, fullName } = req.body;
  if (!username || !password || !fullName) return res.status(400).json({ error: 'Missing fields' });
  const accounts = readSheet(ACCOUNTS_FILE, 'accounts');
  if (accounts.find(a => a.username === username)) {
    return res.status(400).json({ error: 'AUTH_USERNAME_ALREADY_EXISTS' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const newUser = { id: uuidv4(), username, password: hashed, fullName, role: 'user' };
  accounts.push(newUser);
  writeSheet(ACCOUNTS_FILE, 'accounts', accounts);
  res.status(201).json({ username: newUser.username, fullName: newUser.fullName, role: newUser.role });
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── Error handling middleware ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error Middleware]', err.message);
  if (err.message && err.message.startsWith('FILE_LOCKED:')) {
    const msg = err.message.replace('FILE_LOCKED: ', '');
    return res.status(409).json({ error: msg });
  }
  res.status(500).json({ error: err.message || 'Lỗi hệ thống' });
});

// ─── Frontend Static File Serving ──────────────────────────────────────────────
const frontendDistPath = path.join(__dirname, '../frontend/dist/frontend/browser');
if (fs.existsSync(frontendDistPath)) {
  console.log(`📁 Serving frontend static files from: ${frontendDistPath}`);
  app.use('/bet-wc', express.static(frontendDistPath));
  
  // For Angular direct routing, serve index.html for all routes inside /bet-wc
  app.get('/bet-wc/*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });

  // Redirect root / to /bet-wc/
  app.get('/', (req, res) => {
    res.redirect('/bet-wc/');
  });
} else {
  console.warn(`⚠️ Frontend build directory not found at: ${frontendDistPath}. Run npm run build in frontend.`);
}

app.listen(PORT, () => {
  console.log(`✅ WC2026 Excel API running on http://localhost:${PORT}`);
  console.log(`📂 Data directory: ${DATA_DIR}`);
});
