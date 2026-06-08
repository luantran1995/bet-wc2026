import { Injectable, signal } from '@angular/core';

export type Language = 'en' | 'vi';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  currentLang = signal<Language>('vi');

  private translations: Record<Language, Record<string, string>> = {
    vi: {
      'app.title': 'World Cup 2026',
      'app.subtitle': 'X-CUP',
      'nav.matches': 'Trận Đấu',
      'nav.bets': 'Danh Sách Đơn Cược',
      'nav.dashboard': 'Bảng Điều Khiển',
      'matches.title': 'Chọn Trận Đấu & Kèo Cược',
      'matches.tab.all': 'Tất Cả',
      'matches.tab.a_d': 'Bảng A - D',
      'matches.tab.e_h': 'Bảng E - H',
      'matches.tab.i_l': 'Bảng I - L',
      'matches.tab.knockout': 'Vòng Loại Trực Tiếp',
      'matches.empty': 'Không có trận đấu nào!',
      'matches.live': 'TRỰC TIẾP',
      'matches.ft': 'Hết giờ',
      'matches.btn.bet': 'ĐẶT CƯỢC',
      'matches.btn.locked': 'ĐÃ KHÓA KÈO',
      'matches.btn.finished': 'KẾT THÚC',
      'matches.search.placeholder': 'Tìm kiếm trận đấu...',
      'matches.search.criteria.all': 'Tất cả tiêu chí',
      'matches.search.criteria.team': 'Tên đội bóng',
      'matches.search.criteria.group': 'Bảng đấu',
      'matches.search.criteria.date': 'Ngày đấu',
      'matches.search.criteria.round': 'Vòng đấu / Trận đấu',
      'matches.filter.all': 'Tất cả',
      'matches.filter.clear': 'Xóa bộ lọc',
      'admin.title': 'Quản Lý Đơn Đặt Cược',
      'admin.pending': 'Chờ kết toán:',
      'admin.winrate': 'Hiệu suất thắng:',
      'admin.search': 'Tìm tên người đặt cược...',
      'admin.filter.status.all': 'Tất cả trạng thái',
      'admin.filter.status.pending': 'Chờ kết quả',
      'admin.filter.status.won': 'Thắng cược',
      'admin.filter.status.lost': 'Thua cược',
      'admin.bulk.delete': 'Xóa Các Đơn Đã Chọn ({count})',
      'admin.table.date': 'Thời gian',
      'admin.table.bettor': 'Người Đặt Cược',
      'admin.table.match': 'Trận Đấu',
      'admin.table.selection': 'Cửa Chọn',
      'admin.table.stake': 'Tiền Cược',
      'admin.table.payout': 'Tiền Nhận',
      'admin.table.status': 'Trạng Thái',
      'admin.table.actions': 'Thao Tác',
      'admin.table.empty': 'Chưa có đơn đặt cược nào được ghi nhận.',
      'admin.toast.settle.success': 'Đã kết toán cửa cược của {name} thành [{status}]!',
      'admin.toast.delete.success': 'Đã xóa đơn cược khỏi hệ thống.',
      'admin.confirm.delete': 'Bạn có chắc chắn muốn xóa đơn đặt cược này khỏi danh sách?',
      'admin.confirm.bulk': 'Bạn có chắc chắn muốn xóa {count} đơn đặt cược đã chọn khỏi hệ thống?',
      'modal.title': 'Phiếu Đặt Cược',
      'modal.match': 'Trận đấu đăng ký:',
      'modal.select': 'Chọn Đội Đặt Cược:',
      'modal.home_win': 'Chủ nhà [{team}] Thắng - Kèo {odds}',
      'modal.away_win': 'Khách [{team}] Thắng - Kèo {odds}',
      'modal.bettor_name': 'Họ và Tên người cược:',
      'modal.bettor_name.placeholder': 'Nhập tên người chơi (Ví dụ: Nguyễn Văn A)',
      'modal.stake': 'Số Tiền Đặt Cược (Cố định):',
      'modal.confirm': 'XÁC NHẬN ĐẶT CƯỢC',
      'modal.toast.success': 'Đặt cược thành công 10.000đ cho khách hàng {name}!',
      'modal.toast.err.name': 'Vui lòng nhập tên người đặt cược!',
      'status.tag.pending': 'Đang chờ',
      'status.tag.won': 'Thắng cược',
      'status.tag.lost': 'Thua cược',
      'selection.home': 'Chủ nhà',
      'selection.away': 'Khách',
      'selection.draw': 'Hòa',
      'auth.error.user_not_found': 'Chưa có tài khoản, hãy đăng ký!',
      'auth.error.wrong_password': 'Vui lòng xem lại thông tin đăng nhập!',
      'auth.error.username_exists': 'Tên đăng nhập đã tồn tại!',
      'dashboard.title': 'BẢNG ĐIỀU KHIỂN & PHÂN TÍCH',
      'dashboard.total_bets': 'Tổng Lượt Dự Đoán',
      'dashboard.win_rate': 'Tỉ Lệ Chính Xác',
      'dashboard.total_stake': 'Tổng Điểm Đã Cược',
      'dashboard.total_profit': 'Điểm Lợi Nhuận',
      'dashboard.my_bets': 'LỊCH SỬ KÈO CƯỢC CỦA TÔI',
      'dashboard.leaderboard': 'BẢNG XẾP HẠNG CAO THỦ',
      'dashboard.player': 'Người Chơi',
      'dashboard.predictions': 'Lượt Đoán',
      'dashboard.accuracy': 'Chính Xác',
      'dashboard.score': 'Điểm Số',
      'dashboard.empty_bets': 'Bạn chưa đặt cược trận nào. Hãy chọn một trận đấu ở mục Trận Đấu và tham gia dự đoán!'
    },
    en: {
      'app.title': 'World Cup 2026',
      'app.subtitle': 'X-CUP',
      'nav.matches': 'Matches',
      'nav.bets': 'Bet Registry',
      'nav.dashboard': 'Dashboard',
      'matches.title': 'Choose Match & Place Bet',
      'matches.tab.all': 'All',
      'matches.tab.a_d': 'Groups A - D',
      'matches.tab.e_h': 'Groups E - H',
      'matches.tab.i_l': 'Groups I - L',
      'matches.tab.knockout': 'Knockout Stage',
      'matches.empty': 'No matches scheduled!',
      'matches.live': 'LIVE',
      'matches.ft': 'FT',
      'matches.btn.bet': 'PLACE BET',
      'matches.btn.locked': 'BET LOCKED',
      'matches.btn.finished': 'FINISHED',
      'matches.search.placeholder': 'Search matches...',
      'matches.search.criteria.all': 'All criteria',
      'matches.search.criteria.team': 'Team Name',
      'matches.search.criteria.group': 'Group',
      'matches.search.criteria.date': 'Date',
      'matches.search.criteria.round': 'Round / Stage',
      'matches.filter.all': 'All',
      'matches.filter.clear': 'Clear Filters',
      'admin.title': 'Manage Bets Registry',
      'admin.pending': 'Awaiting settlement:',
      'admin.winrate': 'Win rate:',
      'admin.search': 'Search bettor name...',
      'admin.filter.status.all': 'All statuses',
      'admin.filter.status.pending': 'Awaiting results',
      'admin.filter.status.won': 'Won',
      'admin.filter.status.lost': 'Lost',
      'admin.bulk.delete': 'Delete Selected ({count})',
      'admin.table.date': 'Date',
      'admin.table.bettor': 'Bettor Name',
      'admin.table.match': 'Match',
      'admin.table.selection': 'Selection',
      'admin.table.stake': 'Stake',
      'admin.table.payout': 'Payout',
      'admin.table.status': 'Status',
      'admin.table.actions': 'Actions',
      'admin.table.empty': 'No bets recorded yet.',
      'admin.toast.settle.success': 'Successfully settled bet for {name} to [{status}]!',
      'admin.toast.delete.success': 'Bet has been deleted from the registry.',
      'admin.confirm.delete': 'Are you sure you want to delete this bet from the registry?',
      'admin.confirm.bulk': 'Are you sure you want to delete {count} selected bets from the registry?',
      'modal.title': 'Betting Slip',
      'modal.match': 'Selected match:',
      'modal.select': 'Select Bet Team:',
      'modal.home_win': 'Home [{team}] Win - Odds {odds}',
      'modal.away_win': 'Away [{team}] Win - Odds {odds}',
      'modal.bettor_name': 'Bettor Full Name:',
      'modal.bettor_name.placeholder': 'Enter player name (e.g. John Doe)',
      'modal.stake': 'Bet Stake (Fixed):',
      'modal.confirm': 'CONFIRM BET',
      'modal.toast.success': 'Successfully placed 10,000 VND bet for player {name}!',
      'modal.toast.err.name': 'Please enter the bettor name!',
      'status.tag.pending': 'Awaiting',
      'status.tag.won': 'Won',
      'status.tag.lost': 'Lost',
      'selection.home': 'Home team',
      'selection.away': 'Away team',
      'selection.draw': 'Draw',
      'auth.error.user_not_found': 'Account does not exist, please register!',
      'auth.error.wrong_password': 'Please check your login credentials again!',
      'auth.error.username_exists': 'Username already exists!',
      'dashboard.title': 'BETTING ANALYTICS & DASHBOARD',
      'dashboard.total_bets': 'Total Predictions',
      'dashboard.win_rate': 'Accuracy Rate',
      'dashboard.total_stake': 'Total Points Bet',
      'dashboard.total_profit': 'Net Points Profit',
      'dashboard.my_bets': 'MY BETTING HISTORY',
      'dashboard.leaderboard': 'BETTORS LEADERBOARD',
      'dashboard.player': 'Bettor',
      'dashboard.predictions': 'Bets',
      'dashboard.accuracy': 'Accuracy',
      'dashboard.score': 'Score',
      'dashboard.empty_bets': 'You have not placed any bets yet. Select a match to start predicting!'
    }
  };

  private teamTranslationsEnToVi: Record<string, string> = {
    'Mexico': 'Mexico',
    'Poland': 'Ba Lan',
    'Saudi Arabia': 'Ả Rập Xê Út',
    'Argentina': 'Argentina',
    'USA': 'Mỹ',
    'Wales': 'Wales',
    'England': 'Anh',
    'Iran': 'Iran',
    'Brazil': 'Brazil',
    'Serbia': 'Serbia',
    'Cameroon': 'Cameroon',
    'Switzerland': 'Thụy Sĩ',
    'France': 'Pháp',
    'Australia': 'Úc',
    'Denmark': 'Đan Mạch',
    'Tunisia': 'Tunisia',
    'Germany': 'Đức',
    'Japan': 'Nhật Bản',
    'Costa Rica': 'Costa Rica',
    'Spain': 'Tây Ban Nha',
    'Morocco': 'Ma-rốc',
    'Croatia': 'Croatia',
    'Belgium': 'Bỉ',
    'Canada': 'Canada',
    'Portugal': 'Bồ Đào Nha',
    'Ghana': 'Ghana',
    'South Korea': 'Hàn Quốc',
    'Uruguay': 'Uruguay',
    'Netherlands': 'Hà Lan',
    'Senegal': 'Senegal',
    'Ecuador': 'Ecuador',
    'Qatar': 'Qatar',
    'South Africa': 'Nam Phi',
    'Czechia': 'Cộng hòa Séc',
    'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
    'Haiti': 'Haiti',
    'Scotland': 'Scotland',
    'Paraguay': 'Paraguay',
    'Türkiye': 'Thổ Nhĩ Kỳ',
    'Ivory Coast': 'Bờ Biển Ngà',
    'Curaçao': 'Curaçao',
    'Sweden': 'Thụy Điển',
    'Egypt': 'Ai Cập',
    'New Zealand': 'New Zealand',
    'Cape Verde': 'Cape Verde',
    'Norway': 'Na Uy',
    'Iraq': 'Iraq',
    'Austria': 'Áo',
    'Algeria': 'Algeria',
    'Jordan': 'Jordan',
    'Colombia': 'Colombia',
    'Uzbekistan': 'Uzbekistan',
    'DR Congo': 'Cộng hòa Dân chủ Congo',
    'Panama': 'Panama'
  };

  private roundTranslationsViToEn: Record<string, string> = {
    'Bảng A': 'Group A',
    'Bảng B': 'Group B',
    'Bảng C': 'Group C',
    'Bảng D': 'Group D',
    'Bảng E': 'Group E',
    'Bảng F': 'Group F',
    'Bảng G': 'Group G',
    'Bảng H': 'Group H',
    'Bảng I': 'Group I',
    'Bảng J': 'Group J',
    'Bảng K': 'Group K',
    'Bảng L': 'Group L',
    'Vòng Loại Trực Tiếp': 'Knockout Stage',
    'Trận Đấu': 'Matches',
    'Kèo Cược': 'Bets',
    'Chờ kết quả': 'Awaiting results',
    'Thắng cược': 'Won',
    'Thua cược': 'Lost'
  };

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedLang = localStorage.getItem('wc_bet_lang') as Language;
      if (savedLang === 'en' || savedLang === 'vi') {
        this.currentLang.set(savedLang);
      }
    }
  }

  setLanguage(lang: Language) {
    this.currentLang.set(lang);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('wc_bet_lang', lang);
    }
  }

  toggleLanguage() {
    const nextLang: Language = this.currentLang() === 'vi' ? 'en' : 'vi';
    this.setLanguage(nextLang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.currentLang();
    let text = this.translations[lang]?.[key] || key;
    if (params) {
      Object.keys(params).forEach(pKey => {
        text = text.replace(`{${pKey}}`, String(params[pKey]));
      });
    }
    return text;
  }

  /**
   * Translates dynamic database strings (like team names, rounds, times) based on local dictionary.
   */
  translateText(text: string): string {
    if (!text) return '';
    let translated = text;

    if (this.currentLang() === 'vi') {
      // Translate English team names to Vietnamese
      Object.keys(this.teamTranslationsEnToVi).forEach(engKey => {
        const viVal = this.teamTranslationsEnToVi[engKey];
        translated = translated.replace(new RegExp('\\b' + engKey + '\\b', 'g'), viVal);
      });
    } else {
      // Translate Vietnamese rounds/labels to English
      Object.keys(this.roundTranslationsViToEn).forEach(viKey => {
        const engVal = this.roundTranslationsViToEn[viKey];
        translated = translated.replace(new RegExp(viKey, 'g'), engVal);
      });
    }
    return translated;
  }
}
