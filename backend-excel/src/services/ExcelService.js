const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Service to manage Excel Database file operations (reading/writing sheets).
 */
class ExcelService {
  /**
   * @param {string} dataDir - Path to the directory where Excel databases are stored.
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.ensureDataDirectoryExists();

    // Map of known database headers to their camelCase equivalents for JavaScript usage
    this.originalKeys = [
      'id', 'date', 'name', 'username', 'password', 'fullName', 'role',
      'matchId', 'matchName', 'betType', 'stake', 'status', 'payout',
      'groupKey', 'round', 'time', 'homeTeamName', 'homeTeamFlag',
      'awayTeamName', 'awayTeamFlag', 'homeTeamGoals', 'awayTeamGoals',
      'elapsedMinutes', 'stadium'
    ];
  }

  /**
   * Ensures the data directory exists.
   */
  ensureDataDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Normalizes spreadsheet keys (which are in UPPERCASE) to camelCase.
   * @param {Object} obj - The raw sheet row object.
   * @returns {Object} Normalized object.
   */
  normalizeKeysToCamel(obj) {
    const normalized = {};
    for (const [key, val] of Object.entries(obj)) {
      const matchedKey = this.originalKeys.find(k => k.toUpperCase() === key.toUpperCase());
      if (matchedKey) {
        normalized[matchedKey] = val;
      } else {
        normalized[key] = val;
      }
    }
    return normalized;
  }

  /**
   * Converts JavaScript object keys back to UPPERCASE for sheet writing.
   * @param {Object} obj - The JS object.
   * @returns {Object} Upper-cased object.
   */
  convertKeysToUpper(obj) {
    const uppercased = {};
    for (const [key, val] of Object.entries(obj)) {
      uppercased[key.toUpperCase()] = val;
    }
    return uppercased;
  }

  /**
   * Reads a sheet from a given Excel file and parses it as JSON with camelCase keys.
   * @param {string} filePath - Absolute path to the Excel file.
   * @param {string} sheetName - Name of the worksheet.
   * @returns {Array<Object>} List of records.
   */
  readSheet(filePath, sheetName) {
    try {
      if (!fs.existsSync(filePath)) return [];
      const wb = xlsx.readFile(filePath);
      const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
      if (!ws) return [];
      const rawRows = xlsx.utils.sheet_to_json(ws, { defval: '' });
      return rawRows.map(row => this.normalizeKeysToCamel(row));
    } catch (e) {
      console.warn(`[Excel] Could not read ${filePath}:`, e.message);
      return [];
    }
  }

  /**
   * Writes data to an Excel sheet. Handles file locks gracefully.
   * @param {string} filePath - Absolute path to the Excel file.
   * @param {string} sheetName - Name of the worksheet.
   * @param {Array<Object>} data - Array of objects to write.
   */
  writeSheet(filePath, sheetName, data) {
    let wb;
    try {
      wb = xlsx.readFile(filePath);
    } catch {
      wb = xlsx.utils.book_new();
    }
    
    const uppercasedData = (data || []).map(item => this.convertKeysToUpper(item));
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
}

module.exports = ExcelService;
