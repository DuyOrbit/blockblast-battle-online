import { PieceShape } from '../shared/pieces.js';
import {
  ServerMessage,
  ClientMessage,
  BoardState,
  OpponentBoardState,
  PlayerInfo,
  SoloLeaderboardEntry
} from '../shared/types.js';
import { GameEngine } from '../server/gameEngine.js';
import { CanvasRenderer } from './renderer.js';
import { InputManager } from './input.js';
import { sound } from './sound.js';

type GameMode = 'SOLO' | 'PVP' | 'SPECTATOR';

class BlockBlastApp {
  private ws: WebSocket | null = null;
  private renderer: CanvasRenderer;
  private inputManager: InputManager;

  // App Mode State
  private currentMode: GameMode = 'SOLO';

  // Solo Mode State
  private soloBoard: BoardState | null = null;
  private soloSeed: number = Math.floor(Math.random() * 1000000);
  private soloHighScore: number = 0;
  private soloTotalLines: number = 0;
  private soloMaxCombo: number = 0;

  // PvP Local state
  private myPlayerId: string = '';
  private myName: string = 'CyberRunner';
  private myElo: number = 1000;

  private currentMatchId: string | null = null;
  private pvpLocalBoard: BoardState | null = null;
  private pvpOpponentBoard: OpponentBoardState | null = null;
  private opponentInfo: PlayerInfo | null = null;

  private inMatch: boolean = false;
  private inQueue: boolean = false;

  // Custom Room & Spectator State
  private currentRoomCode: string | null = null;
  private isHostOfRoom: boolean = false;
  private myRoleInRoom: 'PLAYER' | 'SPECTATOR' = 'PLAYER';
  private spectatorABoard: BoardState | null = null;
  private spectatorBBoard: BoardState | null = null;

  // DOM Elements - Canvases & Dock
  private mainCanvas = document.getElementById('mainBoardCanvas') as HTMLCanvasElement;
  private oppCanvas = document.getElementById('oppBoardCanvas') as HTMLCanvasElement;
  private pieceDock = document.getElementById('pieceDock')!;
  private dockSlots = Array.from(document.querySelectorAll('.dock-slot')) as HTMLElement[];

  // Mode Switcher Buttons
  private btnModeSolo = document.getElementById('btnModeSolo')!;
  private btnModePvP = document.getElementById('btnModePvP')!;
  private btnFindMatch = document.getElementById('btnFindMatch')!;
  private btnOpenRoomModal = document.getElementById('btnOpenRoomModal')!;

  // HUDs
  private pvpHud = document.getElementById('pvpHud')!;
  private soloHud = document.getElementById('soloHud')!;
  private pvpSidePanel = document.getElementById('pvpSidePanel')!;
  private soloSidePanel = document.getElementById('soloSidePanel')!;

  // Spectator Banner
  private spectatorBanner = document.getElementById('spectatorBanner')!;
  private spectatorCountBadge = document.getElementById('spectatorCountBadge')!;
  private btnLeaveSpectator = document.getElementById('btnLeaveSpectator')!;

  // Solo HUD Elements
  private soloScoreDisplay = document.getElementById('soloScoreDisplay')!;
  private soloHighScoreDisplay = document.getElementById('soloHighScoreDisplay')!;
  private soloLinesDisplay = document.getElementById('soloLinesDisplay')!;
  private soloComboBadge = document.getElementById('soloComboBadge')!;
  private soloSideMaxCombo = document.getElementById('soloSideMaxCombo')!;
  private soloSideLines = document.getElementById('soloSideLines')!;
  private soloTargetScore = document.getElementById('soloTargetScore')!;
  private btnRestartSolo = document.getElementById('btnRestartSolo')!;

  // PvP HUD Elements
  private headerPlayerName = document.getElementById('headerPlayerName')!;
  private headerPlayerElo = document.getElementById('headerPlayerElo')!;
  private localPlayerName = document.getElementById('localPlayerName')!;
  private localPlayerElo = document.getElementById('localPlayerElo')!;
  private localScore = document.getElementById('localScore')!;
  private localComboBadge = document.getElementById('localComboBadge')!;
  private oppPlayerName = document.getElementById('oppPlayerName')!;
  private oppPlayerElo = document.getElementById('oppPlayerElo')!;
  private oppScore = document.getElementById('oppScore')!;
  private oppComboBadge = document.getElementById('oppComboBadge')!;
  private matchTimer = document.getElementById('matchTimer')!;
  private attackBanner = document.getElementById('attackBanner')!;

  // Matchmaking & Result Modals
  private queueModal = document.getElementById('queueModal')!;
  private queueTimerText = document.getElementById('queueTimerText')!;
  private queueRadiusText = document.getElementById('queueRadiusText')!;

  private resultModal = document.getElementById('resultModal')!;
  private resultTitle = document.getElementById('resultTitle')!;
  private resultSubtitle = document.getElementById('resultSubtitle')!;
  private resultYourScore = document.getElementById('resultYourScore')!;
  private resultOppScore = document.getElementById('resultOppScore')!;
  private resultEloText = document.getElementById('resultEloText')!;

  // Custom Room Modal
  private roomModal = document.getElementById('roomModal')!;
  private tabCreateRoom = document.getElementById('tabCreateRoom')!;
  private tabJoinRoom = document.getElementById('tabJoinRoom')!;
  private createRoomPanel = document.getElementById('createRoomPanel')!;
  private joinRoomPanel = document.getElementById('joinRoomPanel')!;
  private displayRoomCode = document.getElementById('displayRoomCode')!;
  private btnCopyRoomLink = document.getElementById('btnCopyRoomLink')!;
  private copySuccessMsg = document.getElementById('copySuccessMsg')!;
  private roomHostName = document.getElementById('roomHostName')!;
  private roomGuestName = document.getElementById('roomGuestName')!;
  private roomSpectatorListText = document.getElementById('roomSpectatorListText')!;
  private btnStartCustomMatch = document.getElementById('btnStartCustomMatch') as HTMLButtonElement;
  private btnLeaveCustomRoom = document.getElementById('btnLeaveCustomRoom')!;
  private inputRoomCode = document.getElementById('inputRoomCode') as HTMLInputElement;
  private checkSpectator = document.getElementById('checkSpectator') as HTMLInputElement;
  private btnSubmitJoinRoom = document.getElementById('btnSubmitJoinRoom')!;
  private btnCloseRoomModal = document.getElementById('btnCloseRoomModal')!;
  private joinRoomError = document.getElementById('joinRoomError')!;

  // Leaderboard Modal
  private leaderboardModal = document.getElementById('leaderboardModal')!;
  private tabLeaderboardSolo = document.getElementById('tabLeaderboardSolo')!;
  private tabLeaderboardPvP = document.getElementById('tabLeaderboardPvP')!;
  private leaderboardThead = document.getElementById('leaderboardThead')!;
  private leaderboardTbody = document.getElementById('leaderboardTbody')!;
  private currentLeaderboardTab: 'SOLO' | 'PVP' = 'SOLO';

  // Solo Game Over Modal
  private soloGameOverModal = document.getElementById('soloGameOverModal')!;
  private soloFinalScore = document.getElementById('soloFinalScore')!;
  private soloRecordBadge = document.getElementById('soloRecordBadge')!;
  private soloPlayerNameInput = document.getElementById('soloPlayerNameInput') as HTMLInputElement;
  private btnSubmitSoloScore = document.getElementById('btnSubmitSoloScore')!;
  private soloSubmitMsg = document.getElementById('soloSubmitMsg')!;

  private helpModal = document.getElementById('helpModal')!;

  constructor() {
    this.renderer = new CanvasRenderer(this.mainCanvas, this.oppCanvas);

    this.inputManager = new InputManager(
      this.mainCanvas,
      document.getElementById('pieceDock')!,
      this.renderer,
      {
        onPlacePiece: (pieceIndex, x, y) => this.handlePlacePiece(pieceIndex, x, y),
        onPieceSelect: () => sound.playPickup()
      }
    );

    this.loadSoloStats();
    this.setupUIHandlers();
    this.connectWebSocket();
    this.startSoloGame();
    this.startRenderLoop();
    this.checkUrlRoomCode();
  }

  private checkUrlRoomCode() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setTimeout(() => {
        this.openRoomModal('JOIN');
        this.inputRoomCode.value = roomParam.trim().toUpperCase();
      }, 500);
    }
  }

  private loadSoloStats() {
    const savedHighScore = localStorage.getItem('blockblast_solo_highscore');
    if (savedHighScore) {
      this.soloHighScore = parseInt(savedHighScore, 10) || 0;
    }
    this.soloHighScoreDisplay.textContent = this.soloHighScore.toLocaleString();

    const savedName = localStorage.getItem('blockblast_player_name');
    if (savedName) {
      this.myName = savedName;
      this.soloPlayerNameInput.value = savedName;
    }
  }

  private setupUIHandlers() {
    // Mode Switcher
    this.btnModeSolo.addEventListener('click', () => this.switchMode('SOLO'));
    this.btnModePvP.addEventListener('click', () => this.switchMode('PVP'));

    // Custom Room Modal Open Button
    this.btnOpenRoomModal.addEventListener('click', () => {
      this.openRoomModal('CREATE');
    });

    // Custom Room Tabs
    this.tabCreateRoom.addEventListener('click', () => {
      this.tabCreateRoom.classList.add('active');
      this.tabJoinRoom.classList.remove('active');
      this.createRoomPanel.style.display = 'block';
      this.joinRoomPanel.style.display = 'none';

      // Request server to create room if none exists yet
      if (!this.currentRoomCode) {
        this.sendPacket({ type: 'CREATE_ROOM', playerName: this.myName });
      }
    });

    this.tabJoinRoom.addEventListener('click', () => {
      this.tabJoinRoom.classList.add('active');
      this.tabCreateRoom.classList.remove('active');
      this.createRoomPanel.style.display = 'none';
      this.joinRoomPanel.style.display = 'flex';
      this.inputRoomCode.focus();
    });

    // Copy Room Link Button
    this.btnCopyRoomLink.addEventListener('click', () => {
      if (!this.currentRoomCode) return;
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.currentRoomCode}`;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.copySuccessMsg.style.display = 'block';
        setTimeout(() => {
          this.copySuccessMsg.style.display = 'none';
        }, 3000);
      });
    });

    // Start Custom Match Button (Host only)
    this.btnStartCustomMatch.addEventListener('click', () => {
      if (!this.isHostOfRoom) return;
      this.sendPacket({ type: 'START_ROOM_MATCH' });
    });

    // Leave Custom Room
    this.btnLeaveCustomRoom.addEventListener('click', () => {
      this.sendPacket({ type: 'LEAVE_ROOM' });
      this.currentRoomCode = null;
      this.roomModal.classList.add('hidden');
    });

    this.btnCloseRoomModal.addEventListener('click', () => {
      this.roomModal.classList.add('hidden');
    });

    // Submit Join Room Button
    this.btnSubmitJoinRoom.addEventListener('click', () => {
      const code = this.inputRoomCode.value.trim().toUpperCase();
      if (!code) {
        this.joinRoomError.textContent = 'Vui lòng nhập mã phòng!';
        this.joinRoomError.style.display = 'block';
        return;
      }
      this.joinRoomError.style.display = 'none';
      const asSpectator = this.checkSpectator.checked;
      this.sendPacket({
        type: 'JOIN_ROOM',
        roomCode: code,
        playerName: this.myName,
        asSpectator
      });
    });

    // Leave Spectator Mode
    this.btnLeaveSpectator.addEventListener('click', () => {
      this.sendPacket({ type: 'LEAVE_ROOM' });
      this.currentRoomCode = null;
      this.switchMode('SOLO');
    });

    // Solo Restart Button
    this.btnRestartSolo.addEventListener('click', () => {
      this.startSoloGame();
      sound.playPickup();
    });

    // Leaderboard Modal Open/Close
    document.getElementById('btnOpenLeaderboard')!.addEventListener('click', () => {
      this.openLeaderboard();
    });
    document.getElementById('btnCloseLeaderboard')!.addEventListener('click', () => {
      this.leaderboardModal.classList.add('hidden');
    });

    this.tabLeaderboardSolo.addEventListener('click', () => {
      this.currentLeaderboardTab = 'SOLO';
      this.tabLeaderboardSolo.classList.add('active');
      this.tabLeaderboardPvP.classList.remove('active');
      this.fetchAndRenderLeaderboard();
    });

    this.tabLeaderboardPvP.addEventListener('click', () => {
      this.currentLeaderboardTab = 'PVP';
      this.tabLeaderboardPvP.classList.add('active');
      this.tabLeaderboardSolo.classList.remove('active');
      this.fetchAndRenderLeaderboard();
    });

    // Solo Game Over Modal Handlers
    this.btnSubmitSoloScore.addEventListener('click', () => {
      this.submitSoloScore();
    });
    document.getElementById('btnSoloPlayAgain')!.addEventListener('click', () => {
      this.soloGameOverModal.classList.add('hidden');
      this.startSoloGame();
    });
    document.getElementById('btnSoloViewLeaderboard')!.addEventListener('click', () => {
      this.soloGameOverModal.classList.add('hidden');
      this.openLeaderboard();
    });

    // PvP Find Match Button
    this.btnFindMatch.addEventListener('click', () => {
      this.joinQueue();
    });

    // Cancel Queue Button
    document.getElementById('btnCancelQueue')!.addEventListener('click', () => {
      this.leaveQueue();
    });

    // Sound toggle
    const btnSound = document.getElementById('btnToggleSound')!;
    btnSound.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      btnSound.textContent = isMuted ? '🔇' : '🔊';
    });

    // Help Modal
    const btnHelp = document.getElementById('btnHowToPlay')!;
    btnHelp.addEventListener('click', () => {
      this.helpModal.classList.remove('hidden');
    });
    document.getElementById('btnCloseHelp')!.addEventListener('click', () => {
      this.helpModal.classList.add('hidden');
    });

    // Result Modal Buttons
    document.getElementById('btnPlayAgain')!.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      if (this.currentRoomCode && this.isHostOfRoom) {
        this.sendPacket({ type: 'START_ROOM_MATCH' });
      } else {
        this.joinQueue();
      }
    });
    document.getElementById('btnCloseResult')!.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
    });

    // Emotes
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emote = (btn as HTMLElement).dataset.emote;
        if (emote && (this.inMatch || this.currentMode === 'SPECTATOR')) {
          this.sendPacket({ type: 'EMOTE', emoji: emote });
          this.renderer.addFloatingText(emote, this.renderer.mainGridOffset.x + 200, this.renderer.mainGridOffset.y + 100, '#ffffff', 32);
        }
      });
    });
  }

  private openRoomModal(initialTab: 'CREATE' | 'JOIN' = 'CREATE') {
    this.roomModal.classList.remove('hidden');
    this.joinRoomError.style.display = 'none';

    if (initialTab === 'CREATE') {
      this.tabCreateRoom.click();
    } else {
      this.tabJoinRoom.click();
    }
  }

  // Switch between Solo, PvP, and Spectator modes
  private switchMode(mode: GameMode) {
    this.currentMode = mode;

    if (mode === 'SOLO') {
      this.btnModeSolo.classList.add('active');
      this.btnModePvP.classList.remove('active');
      this.btnFindMatch.style.display = 'none';
      this.spectatorBanner.style.display = 'none';
      this.pieceDock.style.display = 'flex';

      this.soloHud.style.display = 'grid';
      this.pvpHud.style.display = 'none';
      this.soloSidePanel.style.display = 'flex';
      this.pvpSidePanel.style.display = 'none';

      if (!this.soloBoard) {
        this.startSoloGame();
      } else {
        this.inputManager.setGrid(this.soloBoard.grid);
        this.renderDockPieces(this.soloBoard.activePieces);
      }
    } else if (mode === 'PVP') {
      this.btnModeSolo.classList.remove('active');
      this.btnModePvP.classList.add('active');
      this.btnFindMatch.style.display = 'inline-block';
      this.spectatorBanner.style.display = 'none';
      this.pieceDock.style.display = 'flex';

      this.soloHud.style.display = 'none';
      this.pvpHud.style.display = 'grid';
      this.soloSidePanel.style.display = 'none';
      this.pvpSidePanel.style.display = 'flex';

      if (this.pvpLocalBoard) {
        this.inputManager.setGrid(this.pvpLocalBoard.grid);
        this.renderDockPieces(this.pvpLocalBoard.activePieces);
      } else {
        this.dockSlots.forEach(s => {
          s.innerHTML = '';
          s.classList.add('empty');
        });
      }
    } else if (mode === 'SPECTATOR') {
      this.btnModeSolo.classList.remove('active');
      this.btnModePvP.classList.remove('active');
      this.btnFindMatch.style.display = 'none';
      this.spectatorBanner.style.display = 'flex';
      this.pieceDock.style.display = 'none'; // Spectators don't have piece dock

      this.soloHud.style.display = 'none';
      this.pvpHud.style.display = 'grid';
      this.soloSidePanel.style.display = 'none';
      this.pvpSidePanel.style.display = 'flex';
      this.inputManager.setGrid(null);
    }
  }

  // --- Solo Mode Implementation ---
  private startSoloGame() {
    this.soloSeed = Math.floor(Math.random() * 1000000);
    this.soloBoard = GameEngine.initPlayerBoard('solo_player', this.soloSeed);
    this.soloTotalLines = 0;
    this.soloMaxCombo = 0;

    this.inputManager.setGrid(this.soloBoard.grid);
    this.renderDockPieces(this.soloBoard.activePieces);

    this.soloScoreDisplay.textContent = '0';
    this.soloLinesDisplay.textContent = '0';
    this.soloComboBadge.style.display = 'none';
    this.soloSideLines.textContent = '0';
    this.soloSideMaxCombo.textContent = 'x0';

    this.renderer.addFloatingText('BẮT ĐẦU CHƠI!', 220, 200, '#06b6d4', 28);
  }

  private handleSoloPlacePiece(pieceIndex: number, x: number, y: number) {
    if (!this.soloBoard || this.soloBoard.isKnockedOut) return;

    const result = GameEngine.applyMove(this.soloBoard, pieceIndex, x, y, this.soloSeed);
    if (!result.success) return;

    sound.playPlace();

    if (result.clearResult && result.clearResult.totalLines > 0) {
      const cr = result.clearResult;
      this.soloTotalLines += cr.totalLines;

      if (cr.comboStreak > this.soloMaxCombo) {
        this.soloMaxCombo = cr.comboStreak;
      }

      sound.playLineClear(cr.comboStreak);
      if (cr.totalLines >= 2) {
        sound.playMultiClear(cr.totalLines);
        this.renderer.triggerScreenShake(cr.totalLines * 4);
      }

      this.renderer.spawnLineClearParticles(cr.rows, cr.cols);

      const title = cr.totalLines === 1 ? '+100' : cr.totalLines === 2 ? 'DOUBLE! +300' : cr.totalLines === 3 ? 'TRIPLE! +600' : 'MEGA CLEAR! +1000';
      this.renderer.addFloatingText(title, 220, 180, '#38bdf8', 24);

      if (cr.comboStreak >= 2) {
        this.renderer.addFloatingText(`COMBO x${cr.comboStreak}!`, 220, 220, '#f59e0b', 26);
      }
    }

    this.soloScoreDisplay.textContent = this.soloBoard.score.toLocaleString();
    this.soloLinesDisplay.textContent = this.soloTotalLines.toLocaleString();
    this.soloSideLines.textContent = this.soloTotalLines.toString();
    this.soloSideMaxCombo.textContent = `x${this.soloMaxCombo}`;

    if (this.soloBoard.comboStreak > 1) {
      this.soloComboBadge.style.display = 'inline-block';
      this.soloComboBadge.textContent = `COMBO x${this.soloBoard.comboStreak}`;
    } else {
      this.soloComboBadge.style.display = 'none';
    }

    if (this.soloBoard.score > this.soloHighScore) {
      this.soloHighScore = this.soloBoard.score;
      this.soloHighScoreDisplay.textContent = this.soloHighScore.toLocaleString();
      localStorage.setItem('blockblast_solo_highscore', this.soloHighScore.toString());
    }

    this.renderDockPieces(this.soloBoard.activePieces);

    if (this.soloBoard.isKnockedOut) {
      sound.playDefeat();
      this.handleSoloGameOver();
    }
  }

  private handleSoloGameOver() {
    if (!this.soloBoard) return;
    const isNewRecord = this.soloBoard.score >= this.soloHighScore && this.soloBoard.score > 0;

    this.soloFinalScore.textContent = this.soloBoard.score.toLocaleString();
    this.soloRecordBadge.style.display = isNewRecord ? 'inline-block' : 'none';
    this.soloSubmitMsg.style.display = 'none';
    this.btnSubmitSoloScore.removeAttribute('disabled');
    this.btnSubmitSoloScore.textContent = 'LƯU ĐIỂM';

    this.soloGameOverModal.classList.remove('hidden');
  }

  private async submitSoloScore() {
    if (!this.soloBoard) return;
    const name = this.soloPlayerNameInput.value.trim() || this.myName || 'Anonymous Runner';
    this.myName = name;
    localStorage.setItem('blockblast_player_name', name);
    this.headerPlayerName.textContent = name;
    this.localPlayerName.textContent = name;

    this.btnSubmitSoloScore.setAttribute('disabled', 'true');
    this.btnSubmitSoloScore.textContent = 'Đang lưu...';

    try {
      const res = await fetch('/api/leaderboard/solo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          score: this.soloBoard.score,
          maxCombo: this.soloMaxCombo,
          linesCleared: this.soloTotalLines
        })
      });

      if (res.ok) {
        this.soloSubmitMsg.style.display = 'block';
        this.btnSubmitSoloScore.textContent = 'ĐÃ LƯU';
      }
    } catch (err) {
      console.error('Failed to submit solo score:', err);
      this.btnSubmitSoloScore.textContent = 'LỖI KẾT NỐI';
    }
  }

  // --- Leaderboard Modal & API ---
  private async openLeaderboard() {
    this.leaderboardModal.classList.remove('hidden');
    await this.fetchAndRenderLeaderboard();
  }

  private async fetchAndRenderLeaderboard() {
    this.leaderboardTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Đang tải dữ liệu...</td></tr>`;

    try {
      if (this.currentLeaderboardTab === 'SOLO') {
        this.leaderboardThead.innerHTML = `
          <th style="width: 50px;">HẠNG</th>
          <th>NGƯỜI CHƠI</th>
          <th>ĐIỂM SỐ</th>
          <th>MAX COMBO</th>
          <th>SỐ DÒNG</th>
        `;

        const res = await fetch('/api/leaderboard/solo');
        const data: SoloLeaderboardEntry[] = await res.json();

        if (data && data.length > 0) {
          this.soloTargetScore.textContent = data[0].score.toLocaleString();

          this.leaderboardTbody.innerHTML = data.map((entry, idx) => {
            const rank = idx + 1;
            const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
            return `
              <tr>
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td style="font-weight: 700; color: #f8fafc;">${this.escapeHtml(entry.name)}</td>
                <td class="font-cyber" style="color: #38bdf8; font-weight: 800;">${entry.score.toLocaleString()}</td>
                <td class="font-cyber" style="color: #f59e0b;">x${entry.maxCombo}</td>
                <td class="font-cyber" style="color: #10b981;">${entry.linesCleared}</td>
              </tr>
            `;
          }).join('');
        } else {
          this.leaderboardTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Chưa có dữ liệu xếp hạng</td></tr>`;
        }
      } else {
        this.leaderboardThead.innerHTML = `
          <th style="width: 50px;">HẠNG</th>
          <th>TUYỂN THỦ</th>
          <th>RATING ELO</th>
          <th>TRẬN THẮNG</th>
          <th>TỔNG TRẬN</th>
        `;

        const res = await fetch('/api/leaderboard/pvp');
        const data: any[] = await res.json();

        if (data && data.length > 0) {
          this.leaderboardTbody.innerHTML = data.map((entry, idx) => {
            const rank = idx + 1;
            const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
            return `
              <tr>
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td style="font-weight: 700; color: #f8fafc;">${this.escapeHtml(entry.name)}</td>
                <td class="font-cyber" style="color: #fbbf24; font-weight: 800;">${entry.elo} ELO</td>
                <td class="font-cyber" style="color: #10b981;">${entry.wins}</td>
                <td class="font-cyber" style="color: #94a3b8;">${entry.matchesPlayed}</td>
              </tr>
            `;
          }).join('');
        } else {
          this.leaderboardTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Chưa có dữ liệu đấu trường</td></tr>`;
        }
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      this.leaderboardTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #f43f5e; padding: 20px;">Không thể tải bảng xếp hạng lúc này.</td></tr>`;
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // --- WebSocket Connection & Handlers ---
  private connectWebSocket() {
    const isDev = window.location.port === '3000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = isDev ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected to BlockBlast Arena server');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.handleServerMessage(message);
      } catch (err) {
        console.error('Error parsing server message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WebSocket] Connection closed. Reconnecting in 2s...');
      setTimeout(() => this.connectWebSocket(), 2000);
    };

    this.ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
    };
  }

  private sendPacket(packet: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'WELCOME':
        this.myPlayerId = msg.playerId;
        if (!localStorage.getItem('blockblast_player_name')) {
          this.myName = msg.defaultName;
          this.soloPlayerNameInput.value = msg.defaultName;
        }
        this.myElo = msg.elo;
        this.updatePlayerHUD();
        break;

      case 'QUEUE_STATUS':
        this.inQueue = msg.inQueue;
        if (msg.inQueue) {
          this.queueModal.classList.remove('hidden');
          const mins = Math.floor(msg.queueTimeSeconds / 60).toString().padStart(2, '0');
          const secs = (msg.queueTimeSeconds % 60).toString().padStart(2, '0');
          this.queueTimerText.textContent = `${mins}:${secs}`;
          this.queueRadiusText.textContent = `±${msg.searchRadius}`;
        } else {
          this.queueModal.classList.add('hidden');
        }
        break;

      // Custom Room Messages
      case 'ROOM_CREATED':
        this.currentRoomCode = msg.roomCode;
        this.displayRoomCode.textContent = msg.roomCode;
        this.roomModal.classList.remove('hidden');
        break;

      case 'ROOM_UPDATE':
        this.currentRoomCode = msg.roomCode;
        this.displayRoomCode.textContent = msg.roomCode;
        this.isHostOfRoom = msg.isHost;
        this.myRoleInRoom = msg.myRole;

        this.roomHostName.textContent = msg.host.name + (msg.isHost ? ' (Bạn)' : '');
        this.roomGuestName.textContent = msg.guest
          ? msg.guest.name + (!msg.isHost && msg.myRole === 'PLAYER' ? ' (Bạn)' : '')
          : 'Đang chờ bạn bè...';

        this.roomSpectatorListText.textContent = `${msg.spectators.length} người`;

        // Update Start button state for Host
        if (msg.isHost) {
          this.btnStartCustomMatch.style.display = 'block';
          if (msg.guest) {
            this.btnStartCustomMatch.removeAttribute('disabled');
            this.btnStartCustomMatch.style.opacity = '1.0';
          } else {
            this.btnStartCustomMatch.setAttribute('disabled', 'true');
            this.btnStartCustomMatch.style.opacity = '0.5';
          }
        } else {
          this.btnStartCustomMatch.style.display = 'none';
        }

        if (msg.status === 'PLAYING') {
          this.roomModal.classList.add('hidden');
          if (msg.myRole === 'SPECTATOR') {
            this.switchMode('SPECTATOR');
            this.spectatorCountBadge.textContent = `${msg.spectators.length} khán giả`;
          }
        } else if (msg.status === 'LOBBY' && this.currentMode === 'SPECTATOR') {
          this.roomModal.classList.remove('hidden');
        }
        break;

      case 'SPECTATOR_STATE_UPDATE':
        this.spectatorABoard = msg.playerABoard;
        this.spectatorBBoard = msg.playerBBoard;
        this.spectatorCountBadge.textContent = `${msg.spectatorCount} khán giả`;

        // Update Spectator HUD
        this.localPlayerName.textContent = msg.playerAInfo.name;
        this.localPlayerElo.textContent = `${msg.playerAInfo.elo} ELO`;
        this.localScore.textContent = msg.playerABoard.score.toLocaleString();

        this.oppPlayerName.textContent = msg.playerBInfo.name;
        this.oppPlayerElo.textContent = `${msg.playerBInfo.elo} ELO`;
        this.oppScore.textContent = msg.playerBBoard.score.toLocaleString();

        if (msg.playerABoard.comboStreak > 1) {
          this.localComboBadge.style.display = 'inline-block';
          this.localComboBadge.textContent = `COMBO x${msg.playerABoard.comboStreak}`;
        } else {
          this.localComboBadge.style.display = 'none';
        }

        if (msg.playerBBoard.comboStreak > 1) {
          this.oppComboBadge.style.display = 'inline-block';
          this.oppComboBadge.textContent = `COMBO x${msg.playerBBoard.comboStreak}`;
        } else {
          this.oppComboBadge.style.display = 'none';
        }

        this.updateTimerDisplay(msg.timeRemaining);
        break;

      case 'MATCH_START':
        this.inMatch = true;
        this.inQueue = false;
        this.queueModal.classList.add('hidden');
        this.resultModal.classList.add('hidden');
        this.roomModal.classList.add('hidden');
        this.currentMatchId = msg.matchId;
        this.opponentInfo = msg.opponent;

        this.switchMode('PVP');

        this.oppPlayerName.textContent = msg.opponent.name;
        this.oppPlayerElo.textContent = `${msg.opponent.elo} ELO`;
        this.oppScore.textContent = '0';
        this.localScore.textContent = '0';

        this.updateTimerDisplay(msg.timeRemaining);
        this.renderer.addFloatingText('TRẬN ĐẤU BẮT ĐẦU!', 220, 200, '#10b981', 30);
        sound.playPickup();
        break;

      case 'STATE_UPDATE':
        if (this.currentMode !== 'PVP') return;
        this.pvpLocalBoard = msg.localBoard;
        this.pvpOpponentBoard = msg.opponentBoard;
        this.inputManager.setGrid(msg.localBoard.grid);

        this.localScore.textContent = msg.localBoard.score.toLocaleString();
        this.oppScore.textContent = msg.opponentBoard.score.toLocaleString();

        if (msg.localBoard.comboStreak > 1) {
          this.localComboBadge.style.display = 'inline-block';
          this.localComboBadge.textContent = `COMBO x${msg.localBoard.comboStreak}`;
        } else {
          this.localComboBadge.style.display = 'none';
        }

        if (msg.opponentBoard.comboStreak > 1) {
          this.oppComboBadge.style.display = 'inline-block';
          this.oppComboBadge.textContent = `COMBO x${msg.opponentBoard.comboStreak}`;
        } else {
          this.oppComboBadge.style.display = 'none';
        }

        this.updateTimerDisplay(msg.timeRemaining);
        this.renderDockPieces(msg.localBoard.activePieces);
        break;

      case 'LINE_CLEARED':
        if (this.currentMode === 'SPECTATOR') {
          sound.playLineClear(msg.comboStreak);
          if (msg.count >= 2) {
            sound.playMultiClear(msg.count);
            this.renderer.triggerScreenShake(msg.count * 3);
          }
          this.renderer.spawnLineClearParticles(msg.rows, msg.cols);
          this.renderer.addFloatingText(msg.count >= 2 ? `DOUBLE! +${msg.pointsEarned}` : `+${msg.pointsEarned}`, 220, 180, '#38bdf8', 22);
        } else if (this.currentMode === 'PVP' && msg.playerId === this.myPlayerId) {
          sound.playLineClear(msg.comboStreak);
          if (msg.count >= 2) {
            sound.playMultiClear(msg.count);
            this.renderer.triggerScreenShake(msg.count * 4);
          }
          this.renderer.spawnLineClearParticles(msg.rows, msg.cols);

          const clearTitle = msg.count === 1 ? '+100' : msg.count === 2 ? 'DOUBLE! +300' : msg.count === 3 ? 'TRIPLE! +600' : 'MEGA CLEAR! +1000';
          this.renderer.addFloatingText(clearTitle, 220, 180, '#38bdf8', 24);

          if (msg.comboStreak >= 2) {
            this.renderer.addFloatingText(`COMBO x${msg.comboStreak}!`, 220, 220, '#f59e0b', 26);
          }
        }
        break;

      case 'ATTACK_EVENT':
        if (this.currentMode === 'SPECTATOR') {
          sound.playAttackAlert();
          this.showAttackBanner(`⚔️ PHẢN ĐÒN: ${msg.count} GẠCH ĐÁ!`);
        } else if (this.currentMode === 'PVP') {
          if (msg.toPlayerId === this.myPlayerId) {
            sound.playAttackAlert();
            this.renderer.triggerScreenShake(7);
            this.showAttackBanner(`⚠️ ĐỐI THỦ BẮN SANG ${msg.count} GẠCH ĐÁ!`);
            this.renderer.addFloatingText(`BỊ TẤN CÔNG! +${msg.count} GẠCH`, 220, 160, '#f43f5e', 24);
          } else {
            this.showAttackBanner(`⚔️ BẮN THÀNH CÔNG ${msg.count} GẠCH ĐÁ SANG ĐỐI THỦ!`);
            this.renderer.addFloatingText(`PHẢN ĐÒN! x${msg.count}`, 220, 160, '#10b981', 24);
          }
        }
        break;

      case 'EMOTE_EVENT':
        this.renderer.addFloatingText(
          msg.emoji,
          this.oppCanvas.offsetLeft + 100,
          this.oppCanvas.offsetTop + 40,
          '#ffffff',
          36
        );
        break;

      case 'MATCH_END':
        this.inMatch = false;

        if (this.currentMode === 'SPECTATOR') {
          sound.playVictory();
          this.resultTitle.textContent = 'TRẬN ĐẤU KẾT THÚC';
          this.resultTitle.style.color = '#fbbf24';
          this.resultSubtitle.textContent = `Lý do: ${msg.reason === 'KO' ? 'Knockout' : 'Hết giờ (3:00)'}`;
          this.resultYourScore.textContent = msg.yourScore.toLocaleString();
          this.resultOppScore.textContent = msg.opponentScore.toLocaleString();
          this.resultEloText.textContent = 'Trận đấu giao hữu bạn bè';
          this.resultEloText.style.color = '#38bdf8';
          this.resultModal.classList.remove('hidden');
          break;
        }

        const won = msg.winnerId === this.myPlayerId;

        if (won) {
          sound.playVictory();
          this.resultTitle.textContent = 'CHIẾN THẮNG';
          this.resultTitle.style.color = '#10b981';
          this.resultTitle.style.textShadow = '0 0 20px rgba(16, 185, 129, 0.8)';
        } else if (msg.winnerId === null) {
          this.resultTitle.textContent = 'TRẬN ĐẤU HÒA';
          this.resultTitle.style.color = '#f59e0b';
        } else {
          sound.playDefeat();
          this.resultTitle.textContent = 'THẤT BẠI';
          this.resultTitle.style.color = '#f43f5e';
          this.resultTitle.style.textShadow = '0 0 20px rgba(244, 63, 94, 0.8)';
        }

        const reasonMap = {
          KO: 'Knockout - Đối thủ không còn ô trống để đặt gạch',
          TIMEOUT: 'Hết giờ thi đấu (3:00) - Phân định bằng tổng điểm',
          SURRENDER: 'Đối thủ đã mất kết nối hoặc rời trận'
        };
        this.resultSubtitle.textContent = reasonMap[msg.reason] || 'Trận đấu kết thúc';

        this.resultYourScore.textContent = msg.yourScore.toLocaleString();
        this.resultOppScore.textContent = msg.opponentScore.toLocaleString();

        if (this.currentRoomCode) {
          this.resultEloText.textContent = 'Trận đấu phòng riêng (Không tính Elo)';
          this.resultEloText.style.color = '#c084fc';
        } else {
          const sign = msg.eloDelta >= 0 ? '+' : '';
          this.resultEloText.textContent = `${msg.oldElo} ➔ ${msg.newElo} (${sign}${msg.eloDelta} ELO)`;
          this.resultEloText.style.color = msg.eloDelta >= 0 ? '#10b981' : '#f43f5e';
          this.myElo = msg.newElo;
          this.updatePlayerHUD();
        }

        this.resultModal.classList.remove('hidden');
        break;

      case 'ERROR':
        if (!this.roomModal.classList.contains('hidden')) {
          this.joinRoomError.textContent = msg.message;
          this.joinRoomError.style.display = 'block';
        }
        console.warn('Server error:', msg.message);
        break;
    }
  }

  private joinQueue() {
    this.sendPacket({ type: 'JOIN_QUEUE', playerName: this.myName });
  }

  private leaveQueue() {
    this.sendPacket({ type: 'LEAVE_QUEUE' });
  }

  private handlePlacePiece(pieceIndex: number, x: number, y: number) {
    if (this.currentMode === 'SOLO') {
      this.handleSoloPlacePiece(pieceIndex, x, y);
    } else if (this.currentMode === 'PVP') {
      sound.playPlace();
      this.sendPacket({
        type: 'PLACE_PIECE',
        pieceIndex,
        x,
        y
      });
    }
  }

  private renderDockPieces(activePieces: (any | null)[]) {
    for (let i = 0; i < 3; i++) {
      const slot = this.dockSlots[i];
      const ap = activePieces[i];

      slot.innerHTML = '';
      if (!ap || ap.placed) {
        slot.classList.add('empty');
      } else {
        slot.classList.remove('empty');
        const piece: PieceShape = ap.piece;

        const gridEl = document.createElement('div');
        gridEl.style.display = 'grid';
        gridEl.style.gridTemplateColumns = `repeat(${piece.width}, 22px)`;
        gridEl.style.gridTemplateRows = `repeat(${piece.height}, 22px)`;
        gridEl.style.gap = '2.5px';

        for (let r = 0; r < piece.height; r++) {
          for (let c = 0; c < piece.width; c++) {
            const cell = document.createElement('div');
            if (piece.matrix[r][c] === 1) {
              cell.style.backgroundColor = piece.color;
              cell.style.boxShadow = `0 0 6px ${piece.color}`;
              cell.style.borderRadius = '4px';
            } else {
              cell.style.backgroundColor = 'transparent';
            }
            gridEl.appendChild(cell);
          }
        }

        slot.appendChild(gridEl);
        this.inputManager.bindDockPiece(slot, piece, i);
      }
    }
  }

  private updatePlayerHUD() {
    this.headerPlayerName.textContent = this.myName;
    this.headerPlayerElo.textContent = `${this.myElo} ELO`;
    this.localPlayerName.textContent = this.myName;
    this.localPlayerElo.textContent = `${this.myElo} ELO`;
  }

  private updateTimerDisplay(remainingSecs: number) {
    const mins = Math.floor(remainingSecs / 60).toString().padStart(2, '0');
    const secs = (remainingSecs % 60).toString().padStart(2, '0');
    this.matchTimer.textContent = `${mins}:${secs}`;

    if (remainingSecs <= 30) {
      this.matchTimer.classList.add('urgent');
    } else {
      this.matchTimer.classList.remove('urgent');
    }
  }

  private showAttackBanner(text: string) {
    this.attackBanner.textContent = text;
    this.attackBanner.style.display = 'block';
    setTimeout(() => {
      this.attackBanner.style.display = 'none';
    }, 2800);
  }

  private startRenderLoop() {
    const loop = () => {
      if (this.currentMode === 'SPECTATOR') {
        // Render Player A on main board, Player B on opponent spectator board
        this.renderer.render(
          this.spectatorABoard,
          this.spectatorBBoard ? {
            playerId: 'playerB',
            name: this.oppPlayerName.textContent || 'Guest',
            elo: 1000,
            grid: this.spectatorBBoard.grid,
            score: this.spectatorBBoard.score,
            comboStreak: this.spectatorBBoard.comboStreak,
            isKnockedOut: this.spectatorBBoard.isKnockedOut,
            activePiecesCount: this.spectatorBBoard.activePieces.filter(p => p !== null && !p.placed).length
          } : null,
          null
        );
      } else {
        const activeBoard = this.currentMode === 'SOLO' ? this.soloBoard : this.pvpLocalBoard;
        const activeOppBoard = this.currentMode === 'SOLO' ? null : this.pvpOpponentBoard;

        this.renderer.render(
          activeBoard,
          activeOppBoard,
          this.inputManager.currentGhost
        );
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new BlockBlastApp();
});
