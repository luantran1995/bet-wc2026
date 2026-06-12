const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const ExcelService = require('./src/services/ExcelService');
const MatchService = require('./src/services/MatchService');

/**
 * Class responsible for seeding the initial Excel databases (Accounts, Matches, and Bets).
 */
class DataInitializer {
  constructor() {
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
    this.excelService = new ExcelService(this.dataDir);
    
    const matchesName = process.env.MATCHES_FILE_NAME || 'matches.xlsx';
    this.matchService = new MatchService(this.excelService, path.join(this.dataDir, matchesName));
  }

  /**
   * Run the seeding process.
   */
  async run() {
    console.log('🚀 Initializing WC 2026 Database...');

    // ─── 1. SEED ACCOUNTS ───────────────────────────────────────────────────
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
        fullName: 'Tran Chanh Luan',
        role: 'admin',
      },
      {
        id: '3',
        username: 'cam',
        password: bcrypt.hashSync('cam123', 10),
        fullName: 'Nguyễn Thị Cam',
        role: 'user',
      },
      {
        id: '4',
        username: 'test',
        password: bcrypt.hashSync('cam123', 10),
        fullName: 'test',
        role: 'user',
      }
    ];

    const accountsName = process.env.ACCOUNTS_FILE_NAME || 'accounts.xlsx';
    const betsName = process.env.BETS_FILE_NAME || 'bets.xlsx';

    this.excelService.writeSheet(path.join(this.dataDir, accountsName), 'accounts', accounts);
    console.log('✅ Accounts spreadsheet initialized.');

    // ─── 2. SEED MATCHES (Fetched dynamically from API via MatchService) ────
    await this.matchService.syncMatchesFromApi();

    // ─── 3. SEED BETS (Empty initially) ─────────────────────────────────────
    this.excelService.writeSheet(path.join(this.dataDir, betsName), 'bets', []);

    // ─── 4. COPY TO INITIAL-DATA FOR GIT / RAILWAY VOLUMES ───────────────────
    const initialDataDir = path.join(__dirname, 'initial-data');
    if (!fs.existsSync(initialDataDir)) {
      fs.mkdirSync(initialDataDir, { recursive: true });
    }

    const matchesName = process.env.MATCHES_FILE_NAME || 'matches.xlsx';

    const filesToCopy = [
      { name: accountsName, fallback: 'accounts.xlsx' },
      { name: betsName, fallback: 'bets.xlsx' },
      { name: matchesName, fallback: 'matches.xlsx' }
    ];
    
    filesToCopy.forEach(file => {
      const srcPath = path.join(this.dataDir, file.name);
      const destPath = path.join(initialDataDir, file.fallback);
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
          console.log(`📦 Synced seed database to template: ${file.name}`);
        } catch (err) {
          console.error(`❌ Failed to sync seed template ${file.name}:`, err.message);
        }
      }
    });

    console.log('\n🎉 Data initialized successfully!');
  }
}

const initializer = new DataInitializer();
initializer.run().catch(err => {
  console.error('❌ Data initialization failed:', err);
  process.exit(1);
});
