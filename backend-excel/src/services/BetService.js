const { v4: uuidv4 } = require('uuid');

/**
 * Service to manage placing, deleting, updating and settling bets.
 */
class BetService {
  /**
   * @param {ExcelService} excelService - The Excel service instance.
   * @param {string} betsFile - Path to the bets Excel file.
   * @param {string} matchesFile - Path to the matches Excel file.
   */
  constructor(excelService, betsFile, matchesFile) {
    this.excelService = excelService;
    this.betsFile = betsFile;
    this.matchesFile = matchesFile;
  }

  /**
   * Retrieves all bets from the database.
   * @returns {Array<Object>} List of bets.
   */
  getBets() {
    const bets = this.excelService.readSheet(this.betsFile, 'bets');
    bets.forEach(b => {
      b.stake = Number(b.stake) || 0;
    });
    return bets;
  }

  /**
   * Places a new bet on a match. Validates that user hasn't already bet on this match.
   * @param {Object} body - Bet placement details (matchId, username, name, betType, stake).
   * @returns {Object} Newly placed bet.
   */
  placeBet(body) {
    const bets = this.excelService.readSheet(this.betsFile, 'bets');
    const matchIdStr = body.matchId?.toString();
    const username = body.username || '';
    const fullName = body.name || '';

    // Check if this user has already placed a bet on this match
    const existingBet = bets.find(b => 
      b.matchId?.toString() === matchIdStr && 
      ((username && b.username === username) || (fullName && b.name === fullName))
    );

    if (existingBet) {
      throw new Error('ALREADY_BET');
    }

    const matches = this.excelService.readSheet(this.matchesFile, 'matches');
    const match = matches.find(m => m.id?.toString() === matchIdStr);
    
    let resolvedBetType = body.betType || 'homeWin';
    if (match) {
      if (body.betType === 'homeWin') {
        resolvedBetType = match.homeTeamName;
      } else if (body.betType === 'awayWin') {
        resolvedBetType = match.awayTeamName;
      } else if (body.betType === 'draw') {
        resolvedBetType = 'Draw';
      }
    } else {
      if (body.betType === 'draw') {
        resolvedBetType = 'Draw';
      }
    }

    const newBet = {
      id:        uuidv4(),
      date:      new Date().toISOString(),
      name:      fullName,
      username:  username,
      matchId:   body.matchId   || '',
      matchName: body.matchName || '',
      betType:   resolvedBetType,
      stake:     Number(body.stake) || 10000,
      status:    'pending',
      payout:    0,
    };

    bets.push(newBet);
    this.excelService.writeSheet(this.betsFile, 'bets', bets);
    return newBet;
  }

  /**
   * Manually updates a bet's status.
   * @param {string} id - The bet ID.
   * @param {string} status - New status ('won' or 'lost').
   * @returns {Object} Updated bet.
   */
  updateBetStatus(id, status) {
    const bets = this.excelService.readSheet(this.betsFile, 'bets');
    const idx = bets.findIndex(b => b.id === id);
    if (idx === -1) {
      throw new Error('Bet not found');
    }
    bets[idx].status = status;
    bets[idx].payout = status === 'won' ? 0 : -Number(bets[idx].stake || 10000);
    this.excelService.writeSheet(this.betsFile, 'bets', bets);
    return bets[idx];
  }

  /**
   * Deletes multiple bets in bulk, ensuring matches aren't live/completed.
   * @param {Array<string>} ids - List of bet IDs.
   */
  bulkDeleteBets(ids) {
    if (!Array.isArray(ids)) {
      throw new Error('ids must be array');
    }
    let bets = this.excelService.readSheet(this.betsFile, 'bets');
    const matches = this.excelService.readSheet(this.matchesFile, 'matches');
    
    bets = bets.filter(b => {
      if (!ids.includes(b.id)) return true; // keep if not in delete list
      const match = matches.find(m => m.id?.toString() === b.matchId?.toString());
      if (match && (match.status === 'live' || match.status === 'completed')) return true; // keep locked bets
      return false; // remove
    });
    
    this.excelService.writeSheet(this.betsFile, 'bets', bets);
  }

  /**
   * Deletes a single bet, verifying that match is not active/completed.
   * @param {string} id - The bet ID.
   */
  deleteBet(id) {
    let bets = this.excelService.readSheet(this.betsFile, 'bets');
    const bet = bets.find(b => b.id === id);
    if (!bet) {
      throw new Error('Not found');
    }
    const matches = this.excelService.readSheet(this.matchesFile, 'matches');
    const match = matches.find(m => m.id?.toString() === bet.matchId?.toString());
    if (match && (match.status === 'live' || match.status === 'completed')) {
      throw new Error('CANNOT_DELETE_ACTIVE_OR_COMPLETED_MATCH_BET');
    }
    bets = bets.filter(b => b.id !== id);
    this.excelService.writeSheet(this.betsFile, 'bets', bets);
  }

  /**
   * Automatically settles pending bets based on a completed match's final scores.
   * @param {Object} match - The completed match details.
   */
  autoSettleBetsForMatch(match) {
    const bets = this.excelService.readSheet(this.betsFile, 'bets');
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
      this.excelService.writeSheet(this.betsFile, 'bets', bets);
    }
  }
}

module.exports = BetService;
