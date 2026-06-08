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

    // Resolve paths
    this.dataDir = path.join(__dirname, 'data');
    this.accountsFile = path.join(this.dataDir, 'accounts.xlsx');
    this.betsFile = path.join(this.dataDir, 'bets.xlsx');
    this.matchesFile = path.join(this.dataDir, 'matches.xlsx');

    // Instantiate Services
    this.excelService = new ExcelService(this.dataDir);
    this.authService = new AuthService(this.excelService, this.accountsFile);
    this.betService = new BetService(this.excelService, this.betsFile, this.matchesFile);
    this.matchService = new MatchService(this.excelService, this.matchesFile, this.betService);

    // Resolve circular dependency reference
    this.betService.matchService = this.matchService;
    this.matchService.betService = this.betService;
  }

  /**
   * Configures Express middlewares.
   */
  configureMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
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

    this.app.post('/api/matches/sync', async (req, res, next) => {
      try {
        console.log('🔄 Manual matches sync triggered via API endpoint...');
        await this.matchService.syncMatchesFromApi();
        const matches = this.matchService.getMatches();
        res.json({ message: 'Sync complete', matches });
      } catch (err) {
        res.status(500).json({ error: 'Failed to sync matches from API: ' + err.message });
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
    // On startup: Sync matches from FIFA API if not updated in the last 24 hours
    (async () => {
      try {
        let shouldSync = true;
        if (fs.existsSync(this.matchesFile)) {
          const stats = fs.statSync(this.matchesFile);
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
          await this.matchService.syncMatchesFromApi();
        }
      } catch (err) {
        console.warn('⚠️ Startup sync failed (using local cache if available):', err.message);
      }
    })();

    // Auto-sync matches from FIFA API every 24 hours
    setInterval(async () => {
      try {
        console.log('🔄 Auto-syncing matches from FIFA API (daily schedule)...');
        await this.matchService.syncMatchesFromApi();
      } catch (err) {
        console.error('❌ Auto-sync failed:', err.message);
      }
    }, 24 * 60 * 60 * 1000);
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

    const filesToCopy = ['accounts.xlsx', 'bets.xlsx', 'matches.xlsx'];
    
    filesToCopy.forEach(fileName => {
      const destPath = path.join(this.dataDir, fileName);
      const srcPath = path.join(initialDataDir, fileName);
      
      if (!fs.existsSync(destPath)) {
        if (fs.existsSync(srcPath)) {
          console.log(`📦 Copying initial database template: ${fileName} -> ${this.dataDir}`);
          try {
            fs.copyFileSync(srcPath, destPath);
          } catch (err) {
            console.error(`❌ Failed to copy initial ${fileName}:`, err.message);
          }
        } else {
          console.warn(`⚠️ Initial file ${fileName} not found in template directory: ${initialDataDir}`);
        }
      } else {
        console.log(`✅ Database file already exists: ${fileName}`);
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
