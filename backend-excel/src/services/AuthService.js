const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Service to manage authentication and user accounts.
 */
class AuthService {
  /**
   * @param {ExcelService} excelService - The Excel service instance.
   * @param {string} accountsFile - Path to the accounts Excel file.
   */
  constructor(excelService, accountsFile) {
    this.excelService = excelService;
    this.accountsFile = accountsFile;
  }

  /**
   * Log in a user by verifying username and password.
   * @param {string} username 
   * @param {string} password 
   * @returns {Object} User details (username, fullName, role).
   */
  login(username, password) {
    if (!username || !password) {
      throw new Error('MISSING_FIELDS');
    }
    const accounts = this.excelService.readSheet(this.accountsFile, 'accounts');
    const user = accounts.find(a => a.username === username);
    if (!user) {
      throw new Error('AUTH_USER_NOT_FOUND');
    }
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      throw new Error('AUTH_WRONG_PASSWORD');
    }
    return {
      username: user.username,
      fullName: user.fullName,
      role: user.role || 'user'
    };
  }

  /**
   * Register a new user account.
   * @param {string} username 
   * @param {string} password 
   * @param {string} fullName 
   * @returns {Object} Newly created user details.
   */
  register(username, password, fullName) {
    if (!username || !password || !fullName) {
      throw new Error('MISSING_FIELDS');
    }
    const accounts = this.excelService.readSheet(this.accountsFile, 'accounts');
    if (accounts.find(a => a.username === username)) {
      throw new Error('AUTH_USERNAME_ALREADY_EXISTS');
    }
    const hashed = bcrypt.hashSync(password, 10);
    const newUser = {
      id: uuidv4(),
      username,
      password: hashed,
      fullName,
      role: 'user'
    };
    accounts.push(newUser);
    this.excelService.writeSheet(this.accountsFile, 'accounts', accounts);
    return {
      username: newUser.username,
      fullName: newUser.fullName,
      role: newUser.role
    };
  }
}

module.exports = AuthService;
