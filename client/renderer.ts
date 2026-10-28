import {
  BOARD_SIZE,
  BoardGrid,
  BoardState,
  OpponentBoardState,
  GridCell
} from '../shared/types.js';
import { PieceShape } from '../shared/pieces.js';

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  glowColor: string;
  fontSize: number;
  opacity: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export class CanvasRenderer {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private oppCanvas: HTMLCanvasElement;
  private oppCtx: CanvasRenderingContext2D;

  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private shakeIntensity: number = 0;
  private lastTime: number = performance.now();

  // Grid sizing cache
  public mainCellSize: number = 52;
  public mainGridOffset: { x: number; y: number } = { x: 0, y: 0 };
  public oppCellSize: number = 22;

  constructor(mainCanvas: HTMLCanvasElement, oppCanvas: HTMLCanvasElement) {
    this.mainCanvas = mainCanvas;
    this.mainCtx = mainCanvas.getContext('2d')!;
    this.oppCanvas = oppCanvas;
    this.oppCtx = oppCanvas.getContext('2d')!;

    this.resizeCanvases();
    window.addEventListener('resize', () => this.resizeCanvases());
  }

  public resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;

    // Resize Main Canvas
    const mainRect = this.mainCanvas.getBoundingClientRect();
    const mainWidth = mainRect.width || 440;
    const mainHeight = mainRect.height || 440;

    this.mainCanvas.width = mainWidth * dpr;
    this.mainCanvas.height = mainHeight * dpr;
    this.mainCtx.resetTransform();
    this.mainCtx.scale(dpr, dpr);

    const padding = 16;
    const available = Math.min(mainWidth, mainHeight) - padding * 2;
    this.mainCellSize = Math.floor(available / BOARD_SIZE);
    this.mainGridOffset = {
      x: Math.floor((mainWidth - this.mainCellSize * BOARD_SIZE) / 2),
      y: Math.floor((mainHeight - this.mainCellSize * BOARD_SIZE) / 2)
    };

    // Resize Opponent Canvas
    const oppRect = this.oppCanvas.getBoundingClientRect();
    const oppWidth = oppRect.width || 180;
    const oppHeight = oppRect.height || 180;

    this.oppCanvas.width = oppWidth * dpr;
    this.oppCanvas.height = oppHeight * dpr;
    this.oppCtx.resetTransform();
    this.oppCtx.scale(dpr, dpr);

    const oppPadding = 8;
    const oppAvailable = Math.min(oppWidth, oppHeight) - oppPadding * 2;
    this.oppCellSize = Math.floor(oppAvailable / BOARD_SIZE);
  }

  public triggerScreenShake(intensity = 8) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 22);
  }

  public addFloatingText(text: string, x: number, y: number, color = '#38bdf8', fontSize = 22) {
    this.floatingTexts.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      color,
      glowColor: color,
      fontSize,
      opacity: 1.0,
      life: 0,
      maxLife: 60, // frames
      vy: -1.6
    });
  }

  public spawnLineClearParticles(rows: number[], cols: number[]) {
    const cs = this.mainCellSize;
    const ox = this.mainGridOffset.x;
    const oy = this.mainGridOffset.y;

    // Rows
    for (const r of rows) {
      const y = oy + r * cs + cs / 2;
      for (let i = 0; i < 28; i++) {
        const x = ox + Math.random() * (cs * BOARD_SIZE);
        this.createSparkParticle(x, y, ['#06b6d4', '#38bdf8', '#e0f2fe', '#a855f7']);
      }
    }

    // Cols
    for (const c of cols) {
      const x = ox + c * cs + cs / 2;
      for (let i = 0; i < 28; i++) {
        const y = oy + Math.random() * (cs * BOARD_SIZE);
        this.createSparkParticle(x, y, ['#f59e0b', '#fbbf24', '#fef08a', '#10b981']);
      }
    }
  }

  private createSparkParticle(x: number, y: number, colorPalette: string[]) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4.5 + 1.5;
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      color,
      size: Math.random() * 3.5 + 1.5,
      life: 0,
      maxLife: Math.floor(Math.random() * 25) + 35,
      alpha: 1.0
    });
  }

  public render(
    localBoard: BoardState | null,
    opponentBoard: OpponentBoardState | null,
    ghostPiece: { piece: PieceShape; targetX: number; targetY: number; isValid: boolean } | null
  ) {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // 1. Render Main Board
    this.renderMain(localBoard, ghostPiece);

    // 2. Render Opponent Mini-Board
    this.renderOpponent(opponentBoard);

    // 3. Update FX
    this.updateFX();
  }

  private renderMain(
    board: BoardState | null,
    ghost: { piece: PieceShape; targetX: number; targetY: number; isValid: boolean } | null
  ) {
    const ctx = this.mainCtx;
    const width = this.mainCanvas.width / (window.devicePixelRatio || 1);
    const height = this.mainCanvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Screen Shake Offset
    if (this.shakeIntensity > 0.05) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(sx, sy);
      this.shakeIntensity *= 0.9;
    } else {
      this.shakeIntensity = 0;
    }

    const ox = this.mainGridOffset.x;
    const oy = this.mainGridOffset.y;
    const cs = this.mainCellSize;
    const boardPx = cs * BOARD_SIZE;

    // Outer glow container
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    this.roundRect(ctx, ox - 6, oy - 6, boardPx + 12, boardPx + 12, 12);
    ctx.fill();
    ctx.stroke();

    // Subtle cyber grid backdrop
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;

        ctx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#131c31';
        this.roundRect(ctx, x + 2, y + 2, cs - 4, cs - 4, 6);
        ctx.fill();

        // Subtle inner grid border
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Render Placed Blocks
    if (board && board.grid) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = board.grid[r][c];
          if (cell) {
            const x = ox + c * cs;
            const y = oy + r * cs;
            this.drawBlock(ctx, x, y, cs, cell);
          }
        }
      }
    }

    // Render Ghost Piece Preview
    if (ghost && ghost.piece) {
      this.drawGhostPreview(ctx, ghost, ox, oy, cs);
    }

    // Render Particles
    this.renderParticles(ctx);

    // Render Floating Text
    this.renderFloatingText(ctx);

    ctx.restore();
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, cell: GridCell) {
    const pad = 3;
    const bx = x + pad;
    const by = y + pad;
    const bs = size - pad * 2;
    const radius = 6;

    ctx.save();

    if (cell.isGarbage) {
      // Stone garbage block styling
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, bx, by, bs, bs, radius);
      ctx.fill();
      ctx.stroke();

      // Stone hatch texture lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 4, by + bs - 4);
      ctx.lineTo(bx + bs - 4, by + 4);
      ctx.moveTo(bx + 8, by + bs - 4);
      ctx.lineTo(bx + bs - 4, by + 8);
      ctx.stroke();

      // Countdown turns badge
      if (typeof cell.turnsRemaining === 'number' && cell.turnsRemaining > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = `bold ${Math.floor(size * 0.38)}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(`${cell.turnsRemaining}`, bx + bs / 2, by + bs / 2);
      }
    } else {
      // Vibrant Neon Block
      ctx.shadowColor = cell.glowColor || cell.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = cell.color;
      this.roundRect(ctx, bx, by, bs, bs, radius);
      ctx.fill();

      // Inner bevel specular highlight
      const grad = ctx.createLinearGradient(bx, by, bx, by + bs);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');

      ctx.fillStyle = grad;
      this.roundRect(ctx, bx, by, bs, bs, radius);
      ctx.fill();

      // Border highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawGhostPreview(
    ctx: CanvasRenderingContext2D,
    ghost: { piece: PieceShape; targetX: number; targetY: number; isValid: boolean },
    ox: number,
    oy: number,
    cs: number
  ) {
    const { piece, targetX, targetY, isValid } = ghost;
    const { matrix, width, height } = piece;

    ctx.save();
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (matrix[r][c] === 1) {
          const gx = targetX + c;
          const gy = targetY + r;
          if (gx >= 0 && gx < BOARD_SIZE && gy >= 0 && gy < BOARD_SIZE) {
            const x = ox + gx * cs + 3;
            const y = oy + gy * cs + 3;
            const s = cs - 6;

            if (isValid) {
              ctx.fillStyle = piece.glowColor || 'rgba(6, 182, 212, 0.4)';
              ctx.strokeStyle = piece.color;
              ctx.shadowColor = piece.color;
              ctx.shadowBlur = 10;
              ctx.lineWidth = 2;
            } else {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
              ctx.strokeStyle = '#ef4444';
              ctx.shadowColor = '#ef4444';
              ctx.shadowBlur = 6;
              ctx.lineWidth = 1.5;
            }

            this.roundRect(ctx, x, y, s, s, 6);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  private renderOpponent(board: OpponentBoardState | null) {
    const ctx = this.oppCtx;
    const width = this.oppCanvas.width / (window.devicePixelRatio || 1);
    const height = this.oppCanvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const cs = this.oppCellSize;
    const boardPx = cs * BOARD_SIZE;
    const ox = Math.floor((width - boardPx) / 2);
    const oy = Math.floor((height - boardPx) / 2);

    // Board outline
    ctx.fillStyle = '#0b0f19';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, ox - 3, oy - 3, boardPx + 6, boardPx + 6, 6);
    ctx.fill();
    ctx.stroke();

    // Opponent Grid Cells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;

        ctx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#141e33';
        this.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, 3);
        ctx.fill();

        if (board && board.grid && board.grid[r][c]) {
          const cell = board.grid[r][c]!;
          if (cell.isGarbage) {
            ctx.fillStyle = '#475569';
          } else {
            ctx.fillStyle = cell.color;
          }
          this.roundRect(ctx, x + 1.5, y + 1.5, cs - 3, cs - 3, 3);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderFloatingText(ctx: CanvasRenderingContext2D) {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.opacity;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.glowColor;
      ctx.shadowBlur = 10;
      ctx.font = `900 ${ft.fontSize}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private updateFX() {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gentle gravity
      p.life++;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life++;
      ft.opacity = Math.max(0, 1 - ft.life / ft.maxLife);

      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
