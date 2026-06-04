const path = require('path');
const bcrypt = require('bcryptjs');
const ExcelService = require('./src/services/ExcelService');
const MatchService = require('./src/services/MatchService');

/**
 * Class responsible for seeding the initial Excel databases (Accounts, Matches, and Bets).
 */
class DataInitializer {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.excelService = new ExcelService(this.dataDir);
    this.matchService = new MatchService(this.excelService, path.join(this.dataDir, 'matches.xlsx'));
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

    this.excelService.writeSheet(path.join(this.dataDir, 'accounts.xlsx'), 'accounts', accounts);
    console.log('✅ Accounts spreadsheet initialized.');

    // ─── 2. SEED MATCHES (Fetched dynamically from API via MatchService) ────
    await this.matchService.syncMatchesFromApi();

    // ─── 3. SEED BETS (Empty initially) ─────────────────────────────────────
    this.excelService.writeSheet(path.join(this.dataDir, 'bets.xlsx'), 'bets', []);

    console.log('\n🎉 Data initialized successfully!');
  }
}

const initializer = new DataInitializer();
initializer.run().catch(err => {
  console.error('❌ Data initialization failed:', err);
  process.exit(1);
});
