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

function writeSheet(filePath, sheetName, data) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data);
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

async function loadMatches() {
  try {
    console.log('🌐 Fetching official 2026 World Cup data from FIFA API...');
    const [rawMatches, rawTeams, rawStadiums] = await Promise.all([
      fetchJson(MATCHES_URL),
      fetchJson(TEAMS_URL),
      fetchJson(STADIUMS_URL)
    ]);

    const teamMap = {};
    rawTeams.forEach(t => teamMap[t.id] = t);

    const stadiumMap = {};
    rawStadiums.forEach(s => stadiumMap[s.id] = s);

    const processedMatches = rawMatches.map(m => {
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

    // Sort matches by time, then by ID
    processedMatches.sort((a, b) => {
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      return a.id - b.id;
    });

    writeSheet(path.join(DATA_DIR, 'matches.xlsx'), 'matches', processedMatches);
    console.log(`⚽ Successfully seeded ${processedMatches.length} matches from FIFA API.`);
  } catch (err) {
    console.error('❌ Failed to seed matches from API:', err.message);
    process.exit(1);
  }
}

async function run() {
  await loadMatches();
  
  // ─── 3. BETS (empty initially) ───────────────────────────────────────────────
  writeSheet(path.join(DATA_DIR, 'bets.xlsx'), 'bets', []);

  console.log('\n🎉 Data initialized successfully!');
}

run();
