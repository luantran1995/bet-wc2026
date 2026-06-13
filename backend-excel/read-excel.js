const ExcelService = require('./src/services/ExcelService');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const excelService = new ExcelService(dataDir);
const matchesFile = path.join(dataDir, 'matches.xlsx');

try {
  const matches = excelService.readSheet(matchesFile, 'matches') || [];
  console.log(`Loaded ${matches.length} matches from ${matchesFile}`);
  console.log('First 15 matches:');
  matches.slice(0, 15).forEach(m => {
    console.log(`ID: ${m.id} | ${m.homeTeamName} vs ${m.awayTeamName} | Status: ${m.status} | Goals: ${m.homeTeamGoals}-${m.awayTeamGoals} | elapsedMinutes: ${m.elapsedMinutes}`);
  });
} catch (err) {
  console.error('Failed to read matches:', err.message);
}
