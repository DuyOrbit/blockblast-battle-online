/**
 * Hệ thống Quốc tế hóa Đa Ngôn ngữ (i18n) cho BlockBlast Arena
 * Hỗ trợ Tiếng Việt (VI) và Tiếng Anh (EN)
 */

export type SupportedLang = 'vi' | 'en';

export const TRANSLATIONS = {
  vi: {
    // Header
    logoTitle: 'BLOCKBLAST',
    logoBadge: 'ARENA',
    logoSubtitle: 'ĐẤU TRƯỜNG KHỐI GẠCH 1V1',
    modeSolo: '🎮 CHƠI ĐƠN',
    modePvP: '⚔️ ĐẤU HẠNG PVP',
    btnLeaderboard: '🏆 BẢNG XẾP HẠNG',
    btnCustomRoom: '🏠 TẠO PHÒNG',
    btnShortcuts: '⌨️ PHÍM TẮT',
    langToggle: '🇬🇧 EN',

    // Solo HUD
    currentScore: 'ĐIỂM HIỆN TẠI',
    highScore: 'KỶ LỤC CỦA BẠN',
    linesCleared: 'SỐ DÒNG ĐÃ ĂN',

    // Stats Side Card
    matchStats: 'THỐNG KÊ LƯỢT CHƠI',
    maxCombo: 'Combo dài nhất:',
    linesDestroyed: 'Dòng phá hủy:',
    targetTop1: 'Mục tiêu top 1:',
    btnRestartSolo: '🔄 CHƠI LẠI TỪ ĐẦU (R)',
    tipTitle: '💡 Mẹo chơi:',
    tipContent: 'Ăn nhiều hàng cùng lúc hoặc ăn liên tục ở các lượt kế tiếp để kích hoạt Combo Nhân Điểm cực khủng!',

    // PvP HUD & Panel
    opponentBoard: 'BẢNG ĐỐI THỦ',
    liveStatus: '● TRỰC TIẾP',
    attackAlert: '⚠️ GẠCH TẤN CÔNG ĐANG ĐẾN!',
    emotesTitle: 'CẢM XÚC',
    vsBadge: 'VS',
    hpLabel: 'HP',

    // Countdown Overlay
    readyTitle: 'READY',
    readySubtitle: 'CHUẨN BỊ CHIẾN ĐẤU',
    goTitle: 'GO!',
    goSubtitle: 'TRẬN ĐẤU BẮT ĐẦU!',

    // Floating text in canvas
    singleClear: '+100',
    doubleClear: 'DOUBLE! +300',
    tripleClear: 'TRIPLE! +600',
    megaClear: 'MEGA CLEAR! +1000',
    allClear: 'ALL CLEAR! +3000',
    comboText: 'COMBO',

    // Matchmaking Queue Modal
    queueTitle: 'ĐANG TÌM ĐỐI THỦ...',
    queueDesc: 'Hệ thống đang ghép cặp người chơi cùng bậc Elo...',
    queueWaitTime: 'Thời gian chờ:',
    queueRadius: 'Phạm vi Elo:',
    btnCancelQueue: 'HỦY TÌM TRẬN',

    // Match Result Modal
    victoryTitle: 'CHIẾN THẮNG!',
    defeatTitle: 'THẤT BẠI!',
    drawTitle: 'HÒA!',
    btnPlayAgain: 'CHƠI TIẾP VÁN MỚI',

    // Custom Room Modal
    roomModalTitle: '🏠 PHÒNG TÙY CHỌN',
    tabCreateRoom: 'TẠO PHÒNG MỚI',
    tabJoinRoom: 'VÀO BẰNG MÃ',
    yourRoomCode: 'MÃ PHÒNG CỦA BẠN',
    btnCopyLink: '📋 SAO CHÉP LINK PHÒNG',
    copySuccess: 'Đã sao chép link phòng vào clipboard!',
    roomHost: 'Chủ phòng:',
    roomGuest: 'Khách đấu:',
    roomSpecs: 'Khán giả:',
    btnStartMatch: '⚔️ BẮT ĐẦU TRẬN ĐẤU',
    btnLeaveRoom: 'RỜI PHÒNG',
    inputRoomPlaceholder: 'Nhập mã phòng (5 ký tự)...',
    checkSpectatorLabel: 'Tham gia với tư cách Khán Giả',
    btnJoinRoom: 'VÀO PHÒNG',

    // Leaderboard Modal
    lbModalTitle: '🏆 BẢNG XẾP HẠNG ANH HÙNG',
    tabLeaderboardSolo: '🎮 CHƠI ĐƠN (ĐIỂM CAO)',
    tabLeaderboardPvP: '⚔️ ĐẤU HẠNG (ELO)',
    thRank: 'HẠNG',
    thPlayer: 'NGƯỜI CHƠI',
    thScore: 'ĐIỂM SỐ',
    thMaxCombo: 'MAX COMBO',
    thLines: 'SỐ DÒNG',
    thElo: 'ELO RATING',
    thWinRate: 'TỈ LỆ THẮNG',
    thMatches: 'TRẬN ĐẤU',

    // Solo Game Over Modal
    gameOverTitle: 'KẾT THÚC LƯỢT CHƠI',
    newRecordBadge: 'KỶ LỤC MỚI!',
    finalScoreLabel: 'ĐIỂM SỐ CỦA BẠN',
    saveScorePrompt: 'Lưu tên vào Bảng Xếp Hạng:',
    btnSaveScore: 'LƯU ĐIỂM',
    scoreSavedMsg: 'Đã lưu điểm số thành công!',

    // Keyboard Shortcuts Modal
    shortcutsModalTitle: '⌨️ HƯỚNG DẪN ĐIỀU KHIỂN BÀN PHÍM',
    shortcutsSubtitle: 'Thi đấu thể thao điện tử với tốc độ tối đa!',
    key123Label: 'Phím 1, 2, 3',
    key123Desc: 'Chọn khối tương ứng ở khay dock',
    keyMoveLabel: 'W A S D hoặc Mũi tên',
    keyMoveDesc: 'Di chuyển vị trí đặt gạch trên bàn cờ',
    keyPlaceLabel: 'Space hoặc Enter',
    keyPlaceDesc: 'Thả / Đặt khối gạch vào bàn cờ',
    keyTabLabel: 'Phím Tab',
    keyTabDesc: 'Luân chuyển nhanh sang khối kế tiếp',
    keyCancelLabel: 'Esc hoặc C',
    keyCancelDesc: 'Hủy chọn / Bỏ khối gạch xuống',
    keyRestartLabel: 'Phím R',
    keyRestartDesc: 'Chơi lại ván mới ngay lập tức',
    btnCloseShortcuts: 'ĐÃ HIỂU, VÀO CHIẾN!'
  },

  en: {
    // Header
    logoTitle: 'BLOCKBLAST',
    logoBadge: 'ARENA',
    logoSubtitle: '1V1 BLOCK BATTLE ARENA',
    modeSolo: '🎮 SOLO MODE',
    modePvP: '⚔️ RANKED PVP',
    btnLeaderboard: '🏆 LEADERBOARD',
    btnCustomRoom: '🏠 CUSTOM ROOM',
    btnShortcuts: '⌨️ SHORTCUTS',
    langToggle: '🇻🇳 VI',

    // Solo HUD
    currentScore: 'CURRENT SCORE',
    highScore: 'PERSONAL BEST',
    linesCleared: 'LINES CLEARED',

    // Stats Side Card
    matchStats: 'MATCH STATS',
    maxCombo: 'Max Combo:',
    linesDestroyed: 'Lines Cleared:',
    targetTop1: 'Target Top 1:',
    btnRestartSolo: '🔄 PLAY AGAIN (R)',
    tipTitle: '💡 Pro Tip:',
    tipContent: 'Clear multiple lines at once or maintain consecutive streaks to trigger massive Score Multipliers!',

    // PvP HUD & Panel
    opponentBoard: 'OPPONENT BOARD',
    liveStatus: '● LIVE',
    attackAlert: '⚠️ INCOMING ATTACK!',
    emotesTitle: 'EMOTES',
    vsBadge: 'VS',
    hpLabel: 'HP',

    // Countdown Overlay
    readyTitle: 'READY',
    readySubtitle: 'PREPARE FOR BATTLE',
    goTitle: 'GO!',
    goSubtitle: 'FIGHT!',

    // Floating text in canvas
    singleClear: '+100',
    doubleClear: 'DOUBLE! +300',
    tripleClear: 'TRIPLE! +600',
    megaClear: 'MEGA CLEAR! +1000',
    allClear: 'ALL CLEAR! +3000',
    comboText: 'COMBO',

    // Matchmaking Queue Modal
    queueTitle: 'FINDING OPPONENT...',
    queueDesc: 'Matching with an opponent of similar Elo rating...',
    queueWaitTime: 'Wait Time:',
    queueRadius: 'Elo Radius:',
    btnCancelQueue: 'CANCEL MATCHMAKING',

    // Match Result Modal
    victoryTitle: 'VICTORY!',
    defeatTitle: 'DEFEAT!',
    drawTitle: 'DRAW!',
    btnPlayAgain: 'PLAY NEXT MATCH',

    // Custom Room Modal
    roomModalTitle: '🏠 CUSTOM ROOM',
    tabCreateRoom: 'CREATE ROOM',
    tabJoinRoom: 'JOIN VIA CODE',
    yourRoomCode: 'YOUR ROOM CODE',
    btnCopyLink: '📋 COPY ROOM LINK',
    copySuccess: 'Room link copied to clipboard!',
    roomHost: 'Host:',
    roomGuest: 'Guest:',
    roomSpecs: 'Spectators:',
    btnStartMatch: '⚔️ START MATCH',
    btnLeaveRoom: 'LEAVE ROOM',
    inputRoomPlaceholder: 'Enter 5-character code...',
    checkSpectatorLabel: 'Join match as a Spectator',
    btnJoinRoom: 'JOIN ROOM',

    // Leaderboard Modal
    lbModalTitle: '🏆 HALL OF FAME',
    tabLeaderboardSolo: '🎮 SOLO (HIGH SCORE)',
    tabLeaderboardPvP: '⚔️ RANKED (ELO)',
    thRank: 'RANK',
    thPlayer: 'PLAYER',
    thScore: 'SCORE',
    thMaxCombo: 'MAX COMBO',
    thLines: 'LINES',
    thElo: 'ELO RATING',
    thWinRate: 'WIN RATE',
    thMatches: 'MATCHES',

    // Solo Game Over Modal
    gameOverTitle: 'GAME OVER',
    newRecordBadge: 'NEW RECORD!',
    finalScoreLabel: 'YOUR FINAL SCORE',
    saveScorePrompt: 'Save your name to the Leaderboard:',
    btnSaveScore: 'SAVE SCORE',
    scoreSavedMsg: 'Score saved successfully!',

    // Keyboard Shortcuts Modal
    shortcutsModalTitle: '⌨️ KEYBOARD CONTROLS GUIDE',
    shortcutsSubtitle: 'Play like an esports pro with maximum APM!',
    key123Label: 'Keys 1, 2, 3',
    key123Desc: 'Select corresponding dock piece',
    keyMoveLabel: 'W A S D or Arrows',
    keyMoveDesc: 'Move placement ghost on the 8x8 grid',
    keyPlaceLabel: 'Space or Enter',
    keyPlaceDesc: 'Place / Drop the selected piece',
    keyTabLabel: 'Tab Key',
    keyTabDesc: 'Cycle next available piece in dock',
    keyCancelLabel: 'Esc or C',
    keyCancelDesc: 'Deselect / Put piece back into dock',
    keyRestartLabel: 'R Key',
    keyRestartDesc: 'Restart game instantly',
    btnCloseShortcuts: 'GOT IT, LET\'S PLAY!'
  }
};

export class I18nManager {
  private currentLang: SupportedLang;
  private listeners: Array<(lang: SupportedLang) => void> = [];

  constructor() {
    // 1. Check saved language from localStorage
    const saved = localStorage.getItem('blockblast_lang') as SupportedLang | null;
    if (saved === 'vi' || saved === 'en') {
      this.currentLang = saved;
    } else {
      // 2. Auto-detect browser language
      const browserLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
      this.currentLang = browserLang.startsWith('vi') ? 'vi' : 'en';
    }
  }

  public get lang(): SupportedLang {
    return this.currentLang;
  }

  public setLanguage(lang: SupportedLang) {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    localStorage.setItem('blockblast_lang', lang);
    this.notify();
  }

  public toggleLanguage(): SupportedLang {
    const nextLang: SupportedLang = this.currentLang === 'vi' ? 'en' : 'vi';
    this.setLanguage(nextLang);
    return nextLang;
  }

  public t(key: keyof typeof TRANSLATIONS['vi']): string {
    const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];
    return (dict as any)[key] ?? (TRANSLATIONS['en'] as any)[key] ?? String(key);
  }

  public onLanguageChange(callback: (lang: SupportedLang) => void) {
    this.listeners.push(callback);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentLang);
    }
  }
}

export const i18n = new I18nManager();
