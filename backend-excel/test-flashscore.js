const ExcelService = require('./src/services/ExcelService');
const path = require('path');

function checkSchedule() {
  const dataDir = path.join(__dirname, 'data');
  const excelService = new ExcelService(dataDir);
  const matches = excelService.readSheet(path.join(dataDir, 'matches.xlsx'), 'matches');

  const upcoming = matches.filter(m => m.time.startsWith('2026-06-12') || m.time.startsWith('2026-06-13'));
  console.log(`Matches on June 12 and 13:`);
  upcoming.forEach(m => {
    console.log(`ID: ${m.id} | Time: ${m.time} | Teams: ${m.homeTeamName} vs ${m.awayTeamName} | Status: ${m.status} | Goals: ${m.homeTeamGoals}-${m.awayTeamGoals}`);
  });
}

checkSchedule();
