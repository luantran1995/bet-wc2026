const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import services
const ExcelService = require('./src/services/ExcelService');
const AuthService = require('./src/services/AuthService');
const BetService = require('./src/services/BetService');
const MatchService = require('./src/services/MatchService');

/**
 * Main application class representing the WC2026 Betting Backend Server.
 */
class WcBetServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    // Resolve paths from environment variables to avoid hardcoding
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
    
    const accountsName = process.env.ACCOUNTS_FILE_NAME || 'accounts.xlsx';
    const betsName = process.env.BETS_FILE_NAME || 'bets.xlsx';
    const matchesName = process.env.MATCHES_FILE_NAME || 'matches.xlsx';

    this.accountsFile = path.join(this.dataDir, accountsName);
    this.betsFile = path.join(this.dataDir, betsName);
    this.matchesFile = path.join(this.dataDir, matchesName);

    // Instantiate Services
    this.excelService = new ExcelService(this.dataDir);
    this.authService = new AuthService(this.excelService, this.accountsFile);
    this.betService = new BetService(this.excelService, this.betsFile, this.matchesFile);
    this.matchService = new MatchService(this.excelService, this.matchesFile);

    // Observer Design Pattern: Settle bets automatically when a match is completed
    this.matchService.on('matchCompleted', (match) => {
      this.betService.autoSettleBetsForMatch(match);
    });
  }

  /**
   * Configures Express middlewares.
   */
  configureMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use('/api', (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });
  }

  /**
   * Registers application REST endpoints.
   */
  registerRoutes() {
    // ─── AUTHENTICATION ENDPOINTS ─────────────────────────────────────────────
    this.app.post('/api/auth/login', (req, res, next) => {
      try {
        const { username, password } = req.body;
        const result = this.authService.login(username, password);
        res.json(result);
      } catch (err) {
        if (err.message === 'MISSING_FIELDS') {
          return res.status(400).json({ error: 'Missing fields' });
        }
        if (err.message === 'AUTH_USER_NOT_FOUND' || err.message === 'AUTH_WRONG_PASSWORD') {
          return res.status(401).json({ error: err.message });
        }
        next(err);
      }
    });

    this.app.post('/api/auth/register', (req, res, next) => {
      try {
        const { username, password, fullName } = req.body;
        const result = this.authService.register(username, password, fullName);
        res.status(201).json(result);
      } catch (err) {
        if (err.message === 'MISSING_FIELDS') {
          return res.status(400).json({ error: 'Missing fields' });
        }
        if (err.message === 'AUTH_USERNAME_ALREADY_EXISTS') {
          return res.status(400).json({ error: err.message });
        }
        next(err);
      }
    });

    // ─── MATCHES ENDPOINTS ────────────────────────────────────────────────────
    this.app.get('/api/matches', (req, res, next) => {
      try {
        const matches = this.matchService.getMatches();
        res.json(matches);
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/sync-status', (req, res, next) => {
      try {
        res.json(this.matchService.lastSyncStatus || { success: true, timestamp: new Date().toISOString() });
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/matches/sync', async (req, res, next) => {
      try {
        console.log('🔄 Manual matches sync triggered via API endpoint...');
        await this.matchService.syncMatchesFromApi(true);
        const matches = this.matchService.getMatches();
        const status = this.matchService.lastSyncStatus || { success: true };
        res.json({ message: 'Sync complete', matches, syncStatus: status });
      } catch (err) {
        res.status(500).json({ error: 'Failed to sync matches from API: ' + err.message });
      }
    });

    this.app.get('/api/debug', (req, res) => {
      try {
        const fs = require('fs');
        const dataExists = fs.existsSync(this.matchesFile);
        const templateExists = fs.existsSync(path.join(__dirname, 'initial-data', 'matches.xlsx'));
        
        let fileMatches = [];
        if (dataExists) {
          fileMatches = this.excelService.readSheet(this.matchesFile, 'matches') || [];
        }
        
        res.json({
          env: {
            PORT: process.env.PORT,
            DATA_DIR: process.env.DATA_DIR,
            NODE_ENV: process.env.NODE_ENV,
          },
          paths: {
            __dirname,
            dataDir: this.dataDir,
            matchesFile: this.matchesFile,
            dataExists,
            templateExists,
          },
          syncStatus: this.matchService.lastSyncStatus,
          matchesCount: fileMatches.length,
          completedMatches: fileMatches
            .filter(m => m.status === 'completed' || (m.homeTeamGoals !== null && m.homeTeamGoals !== '' && m.homeTeamGoals !== '-') || (m.awayTeamGoals !== null && m.awayTeamGoals !== '' && m.awayTeamGoals !== '-'))
            .map(m => ({ id: m.id, home: m.homeTeamName, away: m.awayTeamName, score: `${m.homeTeamGoals}-${m.awayTeamGoals}`, status: m.status })),
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.put('/api/matches/:id/status', (req, res, next) => {
      try {
        const updatedMatch = this.matchService.updateMatchStatus(req.params.id, req.body);
        res.json(updatedMatch);
      } catch (err) {
        if (err.message === 'Match not found') {
          return res.status(404).json({ error: err.message });
        }
        next(err);
      }
    });

    // ─── BETS ENDPOINTS ───────────────────────────────────────────────────────
    this.app.get('/api/bets', (req, res, next) => {
      try {
        const bets = this.betService.getBets();
        res.json(bets);
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/bets/export', (req, res, next) => {
      if (!fs.existsSync(this.betsFile)) {
        return res.status(404).send('Bets file does not exist');
      }
      res.download(this.betsFile, 'bets.xlsx', (err) => {
        if (err) {
          console.error('[Export Error]', err);
          res.status(500).send('Error downloading file');
        }
      });
    });

    this.app.post('/api/bets', (req, res, next) => {
      try {
        const newBet = this.betService.placeBet(req.body);
        res.status(201).json(newBet);
      } catch (err) {
        if (err.message === 'ALREADY_BET') {
          return res.status(409).json({ error: 'Bạn đã đặt cược cho trận đấu này rồi! Mỗi người chơi chỉ được cược tối đa 1 lần cho mỗi trận.' });
        }
        next(err);
      }
    });

    this.app.put('/api/bets/:id/status', (req, res, next) => {
      try {
        const { status } = req.query;
        const updatedBet = this.betService.updateBetStatus(req.params.id, status);
        res.json(updatedBet);
      } catch (err) {
        if (err.message === 'Bet not found') {
          return res.status(404).json({ error: err.message });
        }
        next(err);
      }
    });

    this.app.delete('/api/bets/bulk', (req, res, next) => {
      try {
        this.betService.bulkDeleteBets(req.body);
        res.send('Bulk deleted');
      } catch (err) {
        if (err.message === 'ids must be array') {
          return res.status(400).send(err.message);
        }
        next(err);
      }
    });

    this.app.delete('/api/bets/:id', (req, res, next) => {
      try {
        this.betService.deleteBet(req.params.id);
        res.send('Deleted');
      } catch (err) {
        if (err.message === 'Not found') {
          return res.status(404).send('Not found');
        }
        if (err.message === 'CANNOT_DELETE_ACTIVE_OR_COMPLETED_MATCH_BET') {
          return res.status(403).send('Cannot delete bet for active/completed match');
        }
        next(err);
      }
    });

    // ─── HEALTH CHECK ENDPOINT ────────────────────────────────────────────────
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', time: new Date() });
    });
  }

  /**
   * Configures Frontend Static build serving and angular SPA fallbacks.
   */
  configureFrontendServing() {
    const frontendDistPath = path.join(__dirname, '../frontend/dist/frontend/browser');
    if (fs.existsSync(frontendDistPath)) {
      console.log(`📁 Serving frontend static files from: ${frontendDistPath}`);
      this.app.use('/bet-wc', express.static(frontendDistPath));
      
      // For Angular direct routing, serve index.html for all routes inside /bet-wc
      this.app.get('/bet-wc/*', (req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
      });

      // Redirect root / to /bet-wc/
      this.app.get('/', (req, res) => {
        res.redirect('/bet-wc/');
      });
    } else {
      console.warn(`⚠️ Frontend build directory not found at: ${frontendDistPath}. Run npm run build in frontend.`);
    }
  }

  /**
   * Registers global error handling middleware mapping custom app exceptions to HTTP codes.
   */
  configureErrorHandlers() {
    this.app.use((err, req, res, next) => {
      console.error('[Error Middleware]', err.message);
      if (err.message && err.message.startsWith('FILE_LOCKED:')) {
        const msg = err.message.replace('FILE_LOCKED: ', '');
        return res.status(409).json({ error: msg });
      }
      res.status(500).json({ error: err.message || 'Lỗi hệ thống' });
    });
  }

  /**
   * Configures scheduling routines for syncing WC matches.
   */
  setupSchedules() {
    // On startup: Always sync matches from Flashscore VN
    (async () => {
      try {
        console.log('🌐 Syncing WC 2026 matches from Flashscore VN on startup...');
        await this.matchService.syncMatchesFromApi(true);
      } catch (err) {
        console.warn('⚠️ Startup sync failed (using local cache if available):', err.message);
      }
    })();

    // Auto-sync matches from Flashscore VN every 2 minutes for real-time updates
    const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
    setInterval(async () => {
      try {
        console.log('🔄 Auto-syncing matches from Flashscore VN (real-time schedule)...');
        await this.matchService.syncMatchesFromApi(false);
      } catch (err) {
        console.error('❌ Auto-sync failed:', err.message);
      }
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Copies template Excel files to the active data directory if they do not exist.
   * This is crucial when running on Railway with a persistent volume mounted on the data directory,
   * which would otherwise hide the initial committed Excel files.
   */
  copyInitialDataIfMissing() {
    const initialDataDir = path.join(__dirname, 'initial-data');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      console.log(`📁 Creating data directory: ${this.dataDir}`);
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const accountsName = process.env.ACCOUNTS_FILE_NAME || 'accounts.xlsx';
    const betsName = process.env.BETS_FILE_NAME || 'bets.xlsx';
    const matchesName = process.env.MATCHES_FILE_NAME || 'matches.xlsx';

    const filesToCopy = [
      { name: accountsName, fallback: 'accounts.xlsx' },
      { name: betsName, fallback: 'bets.xlsx' },
      { name: matchesName, fallback: 'matches.xlsx' }
    ];
    
    filesToCopy.forEach(file => {
      const destPath = path.join(this.dataDir, file.name);
      const srcPath = path.join(initialDataDir, file.fallback);
      
      if (!fs.existsSync(destPath)) {
        if (fs.existsSync(srcPath)) {
          console.log(`📦 Copying initial database template: ${file.name} -> ${this.dataDir}`);
          try {
            fs.copyFileSync(srcPath, destPath);
          } catch (err) {
            console.error(`❌ Failed to copy initial ${file.name}:`, err.message);
          }
        } else {
          console.warn(`⚠️ Initial file template ${file.fallback} not found in: ${initialDataDir}`);
        }
      } else {
        console.log(`✅ Database file already exists: ${file.name}`);
      }
    });
  }

  /**
   * Starts the Web Server listening on the configured PORT.
   */
  start() {
    this.copyInitialDataIfMissing();
    this.configureMiddleware();
    this.registerRoutes();
    this.configureFrontendServing();
    this.configureErrorHandlers();
    this.setupSchedules();

    this.app.listen(this.port, () => {
      console.log(`✅ WC2026 Excel API running on http://localhost:${this.port}`);
      console.log(`📂 Data directory: ${this.dataDir}`);
    });
  }
}

// Instantiate and start the server
const server = new WcBetServer();
server.start();
