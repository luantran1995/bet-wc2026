const MatchService = require('./src/services/MatchService');
const ExcelService = require('./src/services/ExcelService');
const path = require('path');

async function testKnownScoresLive() {
  const dataDir = path.join(__dirname, 'data');
  const excelService = new ExcelService(dataDir);
  const matchService = new MatchService(excelService, path.join(dataDir, 'matches.xlsx'));

  console.log('Running syncMatchesFromApi with dynamic knownScores...');
  await matchService.syncMatchesFromApi();

  const matches = matchService.getMatches();
  console.log(`Total matches in DB after sync: ${matches.length}`);
  
  const played = matches.slice(0, 3);
  played.forEach(m => {
    console.log(`ID: ${m.id} | Time: ${m.time} | Teams: ${m.homeTeamName} vs ${m.awayTeamName} | Status: ${m.status} | Goals: ${m.homeTeamGoals}-${m.awayTeamGoals} | Elapsed: ${m.elapsedMinutes}`);
  });
}

testKnownScoresLive().catch(console.error);
