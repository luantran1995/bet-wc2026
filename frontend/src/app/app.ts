import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
// Force reload comment
import { FormsModule } from '@angular/forms';
import { BetService, Match, Bet } from './services/bet.service';
import { TranslationService } from './services/translation.service';

interface Toast {
  id: number;
  msg: string;
  type: string;
  show: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private betService = inject(BetService);
  public tService = inject(TranslationService);
  private cdr = inject(ChangeDetectorRef);

  // Signal properties for modern Angular detection
  title = signal('World Cup 2026 betting');

  // State properties
  matches: Match[] = [];
  bets: Bet[] = [];
  
  activeSection: string = 'matches-section';
  matchFilter: string = 'all';
  searchQuery: string = '';
  statusFilter: string = 'all';

  // Pagination state for matches
  currentPage: number = 1;
  pageSize: number = 6;

  // Pagination state for bets
  betsCurrentPage: number = 1;
  betsPageSize: number = 4;

  // Dropdown list search properties
  selectedGroupFilter: string = '';
  selectedMatchFilter: string = '';

  // Auth state properties
  currentUser: any = null;
  showAuthModal: boolean = false;
  authForm = {
    username: '',
    password: '',
    fullName: '',
    isRegister: false
  };

  // Selection state
  selectedBetIds: { [id: string]: boolean } = {};
  selectAllChecked: boolean = false;

  // Betting slip modal state
  showBetModal: boolean = false;
  selectedMatch: Match | null = null;
  betForm = {
    name: '',
    stake: 10000,
    selection: 'homeWin',
    matchId: ''
  };

  // Toast notifications state
  toasts: Toast[] = [];
  private toastCounter = 0;

  private pollInterval: any;

  // Background rotation state
  backgrounds: string[] = [
    'statue_of_liberty.png',
    'stadium_bg.png',
    'trophy_bg.png'
  ];
  currentBgIndex = 0;
  private bgInterval: any;

  ngOnInit() {
    // Reset to defaults on initialization to load all matches
    this.matchFilter = 'all';
    this.activeSection = 'matches-section';

    // Restore user session from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedUser = localStorage.getItem('wc_bet_user');
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch (e) {
          console.error('Failed to parse saved user:', e);
        }
      }
    }

    this.loadMatches();
    this.loadBets();

    // Poll for real-time matches and bets from FIFA API / Simulation every 5 seconds
    this.pollInterval = setInterval(() => {
      this.loadMatchesSilent();
      this.loadBetsSilent();
    }, 5000);

    // Background rotation timer (cycles every 8 seconds)
    this.bgInterval = setInterval(() => {
      this.currentBgIndex = (this.currentBgIndex + 1) % this.backgrounds.length;
      this.cdr.detectChanges();
    }, 8000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.bgInterval) {
      clearInterval(this.bgInterval);
    }
  }

  // API loading functions
  loadMatches() {
    console.log('[App] Fetching matches from:', this.betService.getMatches);
    this.betService.getMatches().subscribe({
      next: (data) => {
        console.log('[App] Matches fetched successfully. Count:', data ? data.length : 0);
        console.log('[App] Matches:', data);
        this.matches = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[App] Lỗi khi tải danh sách trận đấu:', err);
        this.showToast('Lỗi: Không thể tải danh sách trận đấu!', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  isSyncing: boolean = false;

  syncMatches() {
    this.isSyncing = true;
    this.cdr.detectChanges();
    this.betService.syncMatches().subscribe({
      next: (res: any) => {
        this.isSyncing = false;
        this.matches = res.matches || [];
        this.showToast('Đồng bộ tỉ số thời gian thực từ FIFA API thành công!', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSyncing = false;
        const errMsg = err.error?.error || err.message || 'Lỗi không xác định';
        this.showToast('Lỗi khi đồng bộ tỉ số: ' + errMsg, 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  loadMatchesSilent() {
    this.betService.getMatches().subscribe({
      next: (data) => {
        this.matches = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('[App] Lỗi khi tải ngầm danh sách trận đấu:', err);
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.betsCurrentPage = 1;
    this.cdr.detectChanges();
  }

  // Pagination helpers
  get pagedMatches(): Match[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredMatches.slice(startIndex, startIndex + this.pageSize);
  }

  get totalMatchPages(): number {
    return Math.ceil(this.filteredMatches.length / this.pageSize) || 1;
  }

  nextMatchPage() {
    if (this.currentPage < this.totalMatchPages) {
      this.currentPage++;
      this.cdr.detectChanges();
    }
  }

  prevMatchPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.detectChanges();
    }
  }

  // Pagination helpers for Bets
  get pagedBets(): Bet[] {
    const startIndex = (this.betsCurrentPage - 1) * this.betsPageSize;
    return this.filteredBets.slice(startIndex, startIndex + this.betsPageSize);
  }

  get totalBetPages(): number {
    return Math.ceil(this.filteredBets.length / this.betsPageSize) || 1;
  }

  nextBetsPage() {
    if (this.betsCurrentPage < this.totalBetPages) {
      this.betsCurrentPage++;
      this.cdr.detectChanges();
    }
  }

  prevBetsPage() {
    if (this.betsCurrentPage > 1) {
      this.betsCurrentPage--;
      this.cdr.detectChanges();
    }
  }

  loadBets() {
    this.betService.getBets().subscribe({
      next: (data) => {
        this.bets = data;
        // Clean checkbox state
        this.selectedBetIds = {};
        this.selectAllChecked = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi khi tải danh sách đơn cược:', err);
        this.showToast('Lỗi: Không thể tải danh sách đơn cược!', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  loadBetsSilent() {
    this.betService.getBets().subscribe({
      next: (data) => {
        // Only update bets if checkbox editing isn't in progress to avoid UI jumps
        if (!this.hasSelectedBets && !this.searchQuery.trim()) {
          this.bets = data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.warn('Lỗi khi tải ngầm danh sách đơn cược:', err);
      }
    });
  }

  // Navigation handlers
  setSection(sectionId: string) {
    this.activeSection = sectionId;
  }

  // Filters
  setMatchFilter(tab: string) {
    this.matchFilter = tab;
    this.currentPage = 1;
  }

  get filteredMatches(): Match[] {
    const matchesList = this.matches;
    const res = matchesList.filter((m: Match) => {
      // 1. Filter by tab
      if (this.matchFilter !== 'all') {
        const gKey = (m.groupKey || '').toLowerCase();
        if (this.matchFilter === 'A_D') {
          if (!['groupa', 'groupb', 'groupc', 'groupd'].includes(gKey)) return false;
        } else if (this.matchFilter === 'E_H') {
          if (!['groupe', 'groupf', 'groupg', 'grouph'].includes(gKey)) return false;
        } else if (this.matchFilter === 'I_L') {
          if (!['groupi', 'groupj', 'groupk', 'groupl'].includes(gKey)) return false;
        } else if (this.matchFilter === 'knockout') {
          if (gKey !== 'knockout' && gKey !== 'final') return false;
        } else if (gKey !== this.matchFilter.toLowerCase()) {
          return false;
        }
      }

      // 2. Filter by Group Dropdown
      if (this.selectedGroupFilter) {
        if (m.groupKey !== this.selectedGroupFilter) {
          return false;
        }
      }

      // 3. Filter by Match Dropdown
      if (this.selectedMatchFilter) {
        if (m.id.toString() !== this.selectedMatchFilter) {
          return false;
        }
      }

      return true;
    });

    console.log('[App] filteredMatches. matchFilter:', this.matchFilter, 'groupFilter:', this.selectedGroupFilter, 'matchFilterSelect:', this.selectedMatchFilter, 'Filtered count:', res.length);
    return res;
  }

  get availableGroups(): string[] {
    const groups = new Set<string>();
    this.matches.forEach(m => {
      if (m.groupKey) {
        groups.add(m.groupKey);
      }
    });
    return Array.from(groups).sort();
  }

  get availableMatches(): Match[] {
    return [...this.matches]
      .filter(m => {
        const home = (m.homeTeamName || '').trim().toUpperCase();
        const away = (m.awayTeamName || '').trim().toUpperCase();
        return home !== 'TBD' && away !== 'TBD' && home !== '' && away !== '';
      })
      .sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
  }

  getGroupDisplayName(groupKey: string): string {
    if (!groupKey) return '';
    const key = groupKey.toLowerCase();
    if (key.startsWith('group')) {
      const letter = key.replace('group', '').toUpperCase();
      return this.tService.currentLang() === 'vi' ? `Bảng ${letter}` : `Group ${letter}`;
    }
    if (key === 'knockout') {
      return this.tService.currentLang() === 'vi' ? 'Vòng Loại Trực Tiếp (Knockout)' : 'Knockout Stage';
    }
    if (key === 'final') {
      return this.tService.currentLang() === 'vi' ? 'Chung Kết' : 'Final';
    }
    return groupKey;
  }

  clearAllFilters() {
    this.selectedGroupFilter = '';
    this.selectedMatchFilter = '';
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  get isAnyFilterActive(): boolean {
    return this.selectedGroupFilter !== '' || 
           this.selectedMatchFilter !== '';
  }

  get filteredBets(): Bet[] {
    return this.bets.filter(bet => {
      const matchStatus = this.statusFilter === 'all' || bet.status === this.statusFilter;
      const matchSearch = (bet.name || '').toLowerCase().includes(this.searchQuery.trim().toLowerCase());
      return matchStatus && matchSearch;
    });
  }

  // Stats
  get pendingCount(): number {
    return this.bets.filter(b => b.status === 'pending').length;
  }

  get winRate(): string {
    const settled = this.bets.filter(b => b.status !== 'pending');
    if (settled.length === 0) return '0.00%';
    const wonCount = this.bets.filter(b => b.status === 'won').length;
    return ((wonCount / settled.length) * 100).toFixed(2) + '%';
  }

  // Dashboard Stats & Calculations
  get myBets(): Bet[] {
    if (!this.currentUser) return [];
    return this.bets.filter(b => b.username === this.currentUser.username || b.name === this.currentUser.fullName);
  }

  get myTotalBets(): number {
    return this.myBets.length;
  }

  get myWonBets(): number {
    return this.myBets.filter(b => b.status === 'won').length;
  }

  get myLostBets(): number {
    return this.myBets.filter(b => b.status === 'lost').length;
  }

  get myWinRate(): string {
    const settled = this.myBets.filter(b => b.status !== 'pending');
    if (settled.length === 0) return '0.00%';
    return ((this.myWonBets / settled.length) * 100).toFixed(2) + '%';
  }

  get myTotalStake(): number {
    return this.myBets.reduce((acc, b) => acc + Number(b.stake || 0), 0);
  }

  get myProfitLoss(): number {
    return this.myBets.reduce((acc, b) => {
      if (b.status === 'lost') return acc - Number(b.stake || 10000);
      return acc;
    }, 0);
  }

  get leaderboard() {
    const userMap: Record<string, { name: string; username: string; total: number; won: number; lost: number; profit: number }> = {};

    this.bets.forEach(b => {
      const username = b.username || b.name;
      if (!userMap[username]) {
        userMap[username] = {
          name: b.name,
          username: username,
          total: 0,
          won: 0,
          lost: 0,
          profit: 0
        };
      }
      const entry = userMap[username];
      entry.total++;
      if (b.status === 'won') {
        entry.won++;
      } else if (b.status === 'lost') {
        entry.lost++;
        entry.profit -= Number(b.stake || 10000);
      }
    });

    return Object.values(userMap)
      .map(entry => {
        const settled = entry.won + entry.lost;
        const rate = settled > 0 ? ((entry.won / settled) * 100).toFixed(2) + '%' : '0.00%';
        return {
          name: entry.name,
          username: entry.username,
          totalBets: entry.total,
          wonBets: entry.won,
          lostBets: entry.lost,
          winRate: rate,
          profitLoss: entry.profit
        };
      })
      .sort((a, b) => b.profitLoss - a.profitLoss || b.wonBets - a.wonBets);
  }


  getFlagUrl(emoji: string): string {
    if (!emoji) return 'https://flagcdn.com/un.svg';

    // Special cases for UK nations
    if (emoji.includes('🏴󠁧󠁢󠁥󠁮󠁧󠁿')) return 'https://flagcdn.com/gb-eng.svg';
    if (emoji.includes('🏴󠁧󠁢󠁳󠁣󠁴󠁿')) return 'https://flagcdn.com/gb-sct.svg';
    if (emoji.includes('🏴󠁧󠁢󠁷󠁬󠁳󠁿')) return 'https://flagcdn.com/gb-wls.svg';

    try {
      const codePoints = Array.from(emoji).map(char => char.codePointAt(0));
      const countryCode = codePoints
        .map(code => {
          if (code && code >= 0x1F1E6 && code <= 0x1F1FF) {
            return String.fromCharCode(code - 0x1F1E6 + 65);
          }
          return '';
        })
        .join('')
        .toLowerCase();

      if (countryCode && countryCode.length === 2) {
        return `https://flagcdn.com/${countryCode}.svg`;
      }
    } catch (e) {
      console.error('Error parsing flag emoji:', e);
    }

    return 'https://flagcdn.com/un.svg';
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  exportBetsToExcel() {
    window.location.href = this.betService.getExportUrl();
  }

  getBetDisplaySelection(bet: Bet): string {
    if (!bet.betType) return '';
    const match = this.matches.find(m => m.id?.toString() === bet.matchId?.toString());
    const betTypeLower = bet.betType.toLowerCase();
    
    // Legacy support
    if (bet.betType === 'homeWin') {
      return match ? this.tService.translateText(match.homeTeamName) : this.tService.t('selection.home');
    }
    if (bet.betType === 'awayWin') {
      return match ? this.tService.translateText(match.awayTeamName) : this.tService.t('selection.away');
    }
    if (betTypeLower === 'draw' || betTypeLower === 'hòa') {
      return this.tService.t('selection.draw');
    }
    
    // Direct team name support
    return this.tService.translateText(bet.betType);
  }

  getBetPayout(bet: Bet): number {
    return bet.status === 'lost' ? -Number(bet.stake || 10000) : 0;
  }

  getBetStatusText(status?: string): string {
    if (status === 'won') return this.tService.t('status.tag.won');
    if (status === 'lost') return this.tService.t('status.tag.lost');
    return this.tService.t('status.tag.pending');
  }

  // Betting slip modal functions
  openBettingModal(matchId: string) {
    if (!this.currentUser) {
      this.showToast(this.tService.currentLang() === 'vi' ? 'Vui lòng đăng nhập để đặt cược!' : 'Please login to place bets!', 'warning');
      this.openAuthModal();
      return;
    }

    const match = this.matches.find(m => m.id?.toString() === matchId?.toString());
    if (!match) return;

    if (match.status === 'live' || match.status === 'completed') {
      this.showToast(this.tService.t('matches.btn.locked'), 'danger');
      return;
    }

    this.selectedMatch = match;
    this.betForm.matchId = matchId;
    this.betForm.name = this.currentUser.fullName;
    this.betForm.selection = 'homeWin';
    this.showBetModal = true;
  }

  onSelectionChange() {
    // odds removed
  }

  closeModal() {
    this.showBetModal = false;
    this.selectedMatch = null;
  }

  handleBetSubmit() {
    if (!this.selectedMatch) return;
    if (!this.currentUser) {
      this.showToast('Vui lòng đăng nhập!', 'danger');
      return;
    }

    const name = this.currentUser.fullName;
    const payload: Bet = {
      name: name,
      username: this.currentUser.username,
      stake: this.betForm.stake,
      matchId: this.selectedMatch.id.toString(),
      matchName: `${this.selectedMatch.homeTeamName} vs ${this.selectedMatch.awayTeamName}`,
      betType: this.betForm.selection
    };

    this.betService.placeBet(payload).subscribe({
      next: (newBet) => {
        this.closeModal();
        this.showToast(this.tService.t('modal.toast.success', { name: name }), 'success');
        this.loadBets();
        // Redirect to matches list
        this.setSection('matches-section');
      },
      error: (err) => {
        console.error('Lỗi khi gửi đơn cược:', err);
        const errMsg = err.error?.error || err.error || 'Lỗi đặt cược!';
        this.showToast(errMsg, 'danger');
      }
    });
  }

  // Authentication functions
  openAuthModal() {
    this.authForm.username = '';
    this.authForm.password = '';
    this.authForm.fullName = '';
    this.authForm.isRegister = false;
    this.showAuthModal = true;
    this.cdr.detectChanges();
  }

  closeAuthModal() {
    this.showAuthModal = false;
    this.cdr.detectChanges();
  }

  toggleAuthMode() {
    this.authForm.isRegister = !this.authForm.isRegister;
    this.cdr.detectChanges();
  }

  handleAuthSubmit() {
    const username = this.authForm.username.trim().toLowerCase();
    const password = this.authForm.password;
    const fullName = this.authForm.fullName.trim();

    if (!username || !password) {
      this.showToast(this.tService.currentLang() === 'vi' ? 'Vui lòng điền đủ thông tin đăng nhập!' : 'Please enter login credentials!', 'danger');
      return;
    }

    if (this.authForm.isRegister) {
      if (!fullName) {
        this.showToast(this.tService.currentLang() === 'vi' ? 'Vui lòng điền họ và tên!' : 'Please enter your full name!', 'danger');
        return;
      }

      this.betService.register({ username, password, fullName }).subscribe({
        next: (user) => {
          this.showToast(this.tService.currentLang() === 'vi' ? 'Đăng ký tài khoản thành công! Hãy đăng nhập.' : 'Registration successful! Please login.', 'success');
          this.authForm.isRegister = false;
          this.authForm.password = '';
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Registration failed:', err);
          const rawErr = err.error?.error || err.error;
          let errMsg = '';
          if (rawErr === 'AUTH_USERNAME_ALREADY_EXISTS') {
            errMsg = this.tService.t('auth.error.username_exists');
          } else {
            errMsg = rawErr || (this.tService.currentLang() === 'vi' ? 'Đăng ký không thành công!' : 'Registration failed!');
          }
          this.showToast(errMsg, 'danger');
        }
      });
    } else {
      this.betService.login({ username, password }).subscribe({
        next: (user) => {
          this.currentUser = user;
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('wc_bet_user', JSON.stringify(user));
          }
          this.showToast(this.tService.currentLang() === 'vi' ? `Chào mừng ${user.fullName} đã đăng nhập!` : `Welcome back ${user.fullName}!`, 'success');
          this.closeAuthModal();
        },
        error: (err) => {
          console.error('Login failed:', err);
          const rawErr = err.error?.error || err.error;
          let errMsg = '';
          if (rawErr === 'AUTH_USER_NOT_FOUND') {
            errMsg = this.tService.t('auth.error.user_not_found');
          } else if (rawErr === 'AUTH_WRONG_PASSWORD') {
            errMsg = this.tService.t('auth.error.wrong_password');
          } else {
            errMsg = rawErr || (this.tService.currentLang() === 'vi' ? 'Đăng nhập không thành công!' : 'Login failed!');
          }
          this.showToast(errMsg, 'danger');
        }
      });
    }
  }

  handleLogout() {
    this.currentUser = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('wc_bet_user');
    }
    this.showToast(this.tService.currentLang() === 'vi' ? 'Đã đăng xuất tài khoản!' : 'Logged out successfully!', 'info');
    this.cdr.detectChanges();
  }

  closeAllModals() {
    this.closeModal();
    this.closeAuthModal();
  }

  // Admin record actions
  settleBet(id?: string, status?: string) {
    if (!id || !status) return;

    this.betService.updateBetStatus(id, status).subscribe({
      next: (updatedBet) => {
        const statText = status === 'won' ? this.tService.t('status.tag.won') : this.tService.t('status.tag.lost');
        this.showToast(this.tService.t('admin.toast.settle.success', { name: updatedBet.name, status: statText }), 'success');
        this.loadBets();
      },
      error: (err) => {
        console.error('Lỗi khi kết toán:', err);
        this.showToast('Lỗi: Không thể kết toán đơn cược!', 'danger');
      }
    });
  }

  isBetDeletable(bet: Bet): boolean {
    if (!bet) return false;
    if (this.currentUser && this.currentUser.username === 'admin') return true;
    
    // Check if user owns the bet
    if (!this.currentUser || bet.username !== this.currentUser.username) return false;
    
    // Find the match to check if it started (live or completed)
    const match = this.matches.find(m => m.id?.toString() === bet.matchId?.toString());
    if (match) {
      if (match.status === 'live' || match.status === 'completed') {
        return false;
      }
    }
    return true;
  }

  hasUserBetOnMatch(matchId: string): boolean {
    if (!this.currentUser) return false;
    return this.bets.some(b => b.matchId?.toString() === matchId.toString() && (b.username === this.currentUser.username || b.name === this.currentUser.fullName));
  }

  getMatchForBet(bet: Bet): Match | null {
    if (!bet || !bet.matchId) return null;
    const matchIdStr = bet.matchId.toString();
    return this.matches.find(m => m.id?.toString() === matchIdStr) || null;
  }

  getMatchStatusLabel(bet: Bet): string {
    const match = this.getMatchForBet(bet);
    if (!match) return '';
    if (match.status === 'live') {
      return ` (LIVE: ${match.homeTeamGoals} - ${match.awayTeamGoals})`;
    }
    if (match.status === 'completed') {
      return ` (FT: ${match.homeTeamGoals} - ${match.awayTeamGoals})`;
    }
    return '';
  }

  deleteBet(id?: string) {
    if (!id) return;
    if (!confirm(this.tService.t('admin.confirm.delete'))) return;

    const username = this.currentUser ? this.currentUser.username : '';
    this.betService.deleteBet(id, username).subscribe({
      next: () => {
        this.showToast(this.tService.t('admin.toast.delete.success'), 'success');
        this.loadBets();
      },
      error: (err) => {
        console.error('Lỗi khi xóa đơn cược:', err);
        const errMsg = err.error || 'Lỗi: Không thể xóa đơn cược!';
        this.showToast(errMsg, 'danger');
      }
    });
  }

  // Bulk actions
  toggleSelectAll() {
    this.filteredBets.forEach(bet => {
      if (bet.id && this.isBetDeletable(bet)) {
        this.selectedBetIds[bet.id] = this.selectAllChecked;
      }
    });
  }

  onRowCheckboxChange() {
    const deletableIds = this.filteredBets
      .filter(b => b.id && this.isBetDeletable(b))
      .map(b => b.id);
    const checkedCount = deletableIds.filter(id => this.selectedBetIds[id!]).length;
    this.selectAllChecked = deletableIds.length > 0 && checkedCount === deletableIds.length;
  }

  get hasSelectedBets(): boolean {
    return Object.values(this.selectedBetIds).some(Boolean);
  }

  get selectedCount(): number {
    return Object.values(this.selectedBetIds).filter(Boolean).length;
  }

  bulkDelete() {
    const idsToDelete = Object.keys(this.selectedBetIds).filter(id => this.selectedBetIds[id]);
    if (idsToDelete.length === 0) return;

    if (!confirm(this.tService.t('admin.confirm.bulk', { count: idsToDelete.length }))) return;

    const username = this.currentUser ? this.currentUser.username : '';
    this.betService.bulkDeleteBets(idsToDelete, username).subscribe({
      next: () => {
        this.showToast(this.tService.t('admin.toast.delete.success'), 'success');
        this.loadBets();
      },
      error: (err) => {
        console.error('Lỗi khi xóa nhiều đơn cược:', err);
        const errMsg = err.error || 'Lỗi: Không thể xóa các đơn cược đã chọn!';
        this.showToast(errMsg, 'danger');
      }
    });
  }

  // Toast utility
  showToast(msg: string, type: string = 'info') {
    const id = this.toastCounter++;
    const toast: Toast = { id, msg, type, show: false };
    this.toasts.push(toast);

    setTimeout(() => {
      const idx = this.toasts.findIndex(t => t.id === id);
      if (idx !== -1) this.toasts[idx].show = true;
    }, 10);

    setTimeout(() => {
      const idx = this.toasts.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.toasts[idx].show = false;
        setTimeout(() => {
          this.toasts = this.toasts.filter(t => t.id !== id);
        }, 400);
      }
    }, 4000);
  }
}
