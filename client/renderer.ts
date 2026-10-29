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
  shape?: 'star' | 'circle' | 'sparkle' | 'confetti';
  rotation?: number;
  vRot?: number;
}

export interface Shockwave {
  type: 'row' | 'col';
  index: number;
  startTime: number;
  duration: number;
  color: string;
}

export interface AttackProjectile {
  id: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  progress: number;
  color: string;
  speed: number;
  trail: { x: number; y: number; alpha: number }[];
}

export const APK_CUBE_SPRITES: Record<string, { x: number; y: number; w: number; h: number }> = {
  // Red / Rose (game_cube_1)
  '#f43f5e': { x: 451, y: 831, w: 106, h: 106 },
  // Orange (game_cube_2)
  '#f97316': { x: 451, y: 495, w: 106, h: 106 },
  // Yellow / Amber (game_cube_3)
  '#f59e0b': { x: 563, y: 865, w: 106, h: 106 },
  '#eab308': { x: 563, y: 865, w: 106, h: 106 },
  // Green / Emerald (game_cube_4)
  '#10b981': { x: 265, y: 383, w: 106, h: 106 },
  '#14b8a6': { x: 265, y: 383, w: 106, h: 106 },
  // Cyan (game_cube_5)
  '#06b6d4': { x: 563, y: 529, w: 106, h: 106 },
  // Blue (game_cube_6)
  '#3b82f6': { x: 339, y: 806, w: 106, h: 106 },
  // Purple / Fuchsia (game_cube_7)
  '#a855f7': { x: 227, y: 806, w: 106, h: 106 },
  '#d946ef': { x: 227, y: 806, w: 106, h: 106 }
};

export const CUBE_DATA_URLS: Record<string, string> = {};

export class CanvasRenderer {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private oppCanvas: HTMLCanvasElement;
  private oppCtx: CanvasRenderingContext2D;

  public atlasImg: HTMLImageElement | null = null;
  public isAtlasLoaded: boolean = false;
  public onAtlasLoaded?: () => void;

  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private shockwaves: Shockwave[] = [];
  private attackProjectiles: AttackProjectile[] = [];
  private placedAnimations = new Map<string, { startTime: number; color: string }>();

  private shakeIntensity: number = 0;
  private shakeAngle: number = 0;
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

    // Load authentic mobile Block Blast texture atlas
    this.atlasImg = new Image();
    this.atlasImg.src = '/textures/blocks_bg.png';
    this.atlasImg.onload = () => {
      this.isAtlasLoaded = true;
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 106;
        offCanvas.height = 106;
        const offCtx = offCanvas.getContext('2d');
        if (offCtx && this.atlasImg) {
          for (const [color, rect] of Object.entries(APK_CUBE_SPRITES)) {
            offCtx.clearRect(0, 0, 106, 106);
            offCtx.drawImage(this.atlasImg, rect.x, rect.y, rect.w, rect.h, 0, 0, 106, 106);
            CUBE_DATA_URLS[color] = offCanvas.toDataURL('image/png');
          }
          if (this.onAtlasLoaded) {
            this.onAtlasLoaded();
          }
        }
      } catch (err) {
        console.warn('Could not generate cube dataURLs:', err);
      }
    };
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
    const availableSize = Math.min(mainWidth, mainHeight) - padding * 2;
    this.mainCellSize = Math.floor(availableSize / BOARD_SIZE);

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

  /**
   * Register newly placed block positions for juicy squash & stretch animation
   */
  public registerPlacedCells(cells: { x: number; y: number; color?: string }[]) {
    const now = performance.now();
    for (const c of cells) {
      this.placedAnimations.set(`${c.y},${c.x}`, {
        startTime: now,
        color: c.color || '#38bdf8'
      });
    }
  }

  /**
   * Trigger screen shake with micro-rotational angle
   */
  public triggerScreenShake(intensity = 8) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 25);
    this.shakeAngle = (Math.random() - 0.5) * (this.shakeIntensity * 0.003);
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

  /**
   * Spawn shockwave laser line and velocity sparks
   */
  public spawnLineClearParticles(rows: number[], cols: number[]) {
    const cs = this.mainCellSize;
    const ox = this.mainGridOffset.x;
    const oy = this.mainGridOffset.y;
    const now = performance.now();

    // Spawn Laser Shockwaves
    for (const r of rows) {
      this.shockwaves.push({
        type: 'row',
        index: r,
        startTime: now,
        duration: 260,
        color: '#38bdf8'
      });

      const y = oy + r * cs + cs / 2;
      for (let i = 0; i < 35; i++) {
        const x = ox + Math.random() * (cs * BOARD_SIZE);
        this.createSparkParticle(x, y, ['#06b6d4', '#38bdf8', '#ffffff', '#a855f7']);
      }
    }

    for (const c of cols) {
      this.shockwaves.push({
        type: 'col',
        index: c,
        startTime: now,
        duration: 260,
        color: '#f59e0b'
      });

      const x = ox + c * cs + cs / 2;
      for (let i = 0; i < 35; i++) {
        const y = oy + Math.random() * (cs * BOARD_SIZE);
        this.createSparkParticle(x, y, ['#f59e0b', '#fbbf24', '#ffffff', '#10b981']);
      }
    }
  }

  /**
   * Spawn PvP plasma projectiles flying between boards
   */
  public spawnAttackProjectile(outgoing: boolean, count: number) {
    const width = this.mainCanvas.width / (window.devicePixelRatio || 1);
    const height = this.mainCanvas.height / (window.devicePixelRatio || 1);
    const centerX = this.mainGridOffset.x + (this.mainCellSize * BOARD_SIZE) / 2;
    const centerY = this.mainGridOffset.y + (this.mainCellSize * BOARD_SIZE) / 2;

    const projectileCount = Math.min(count, 5);

    for (let i = 0; i < projectileCount; i++) {
      const delay = i * 0.08;
      const startX = outgoing ? centerX + (Math.random() - 0.5) * 60 : width + 30;
      const startY = outgoing ? centerY + (Math.random() - 0.5) * 60 : 60 + Math.random() * 80;
      const targetX = outgoing ? width + 50 : centerX + (Math.random() - 0.5) * 80;
      const targetY = outgoing ? 60 + Math.random() * 80 : centerY + (Math.random() - 0.5) * 80;

      this.attackProjectiles.push({
        id: Math.random().toString(),
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        targetX,
        targetY,
        progress: -delay,
        color: outgoing ? '#10b981' : '#f43f5e',
        speed: 0.035,
        trail: []
      });
    }
  }

  private createSparkParticle(x: number, y: number, colorPalette: string[]) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6.5 + 2.0;
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    const shapeRoll = Math.random();
    const shape: 'star' | 'confetti' | 'sparkle' | 'circle' =
      shapeRoll < 0.35 ? 'star' : shapeRoll < 0.65 ? 'confetti' : shapeRoll < 0.85 ? 'sparkle' : 'circle';

    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      color,
      size: Math.random() * 4.5 + 2.0,
      life: 0,
      maxLife: Math.floor(Math.random() * 25) + 35,
      alpha: 1.0,
      shape,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
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

    // Dynamic Screen Shake with rotational tilt
    if (this.shakeIntensity > 0.05) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(this.shakeAngle);
      ctx.translate(-width / 2 + sx, -height / 2 + sy);
      this.shakeIntensity *= 0.88;
      this.shakeAngle *= 0.88;
    } else {
      this.shakeIntensity = 0;
      this.shakeAngle = 0;
    }

    const ox = this.mainGridOffset.x;
    const oy = this.mainGridOffset.y;
    const cs = this.mainCellSize;
    const boardPx = cs * BOARD_SIZE;

    // Authentic Block Blast deep indigo-navy board container with bevel
    ctx.fillStyle = '#0c1228';
    ctx.strokeStyle = '#1d2a52';
    ctx.lineWidth = 3;
    this.roundRect(ctx, ox - 8, oy - 8, boardPx + 16, boardPx + 16, 16);
    ctx.fill();
    ctx.stroke();

    // Subtle inner bevel highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, ox - 6, oy - 6, boardPx + 12, boardPx + 12, 14);
    ctx.stroke();

    // Authentic Block Blast empty cell wells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;

        // Inset cell well
        ctx.fillStyle = '#141d3b';
        this.roundRect(ctx, x + 2.5, y + 2.5, cs - 5, cs - 5, 8);
        ctx.fill();

        // Inner shadow and subtle edge
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeRect(x + 3.5, y + 3.5, cs - 7, cs - 7);
      }
    }

    // Render Placed Blocks with Squash & Stretch bounce
    let occupiedCellsCount = 0;
    if (board && board.grid) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = board.grid[r][c];
          if (cell) {
            occupiedCellsCount++;
            const x = ox + c * cs;
            const y = oy + r * cs;
            this.drawBlock(ctx, x, y, cs, cell, r, c);
          }
        }
      }
    }

    // Render Ghost Piece Preview
    if (ghost && ghost.piece) {
      this.drawGhostPreview(ctx, ghost, ox, oy, cs);
    }

    // Render Shockwaves across cleared lines
    this.renderShockwaves(ctx, ox, oy, cs, boardPx);

    // Render Attack Projectiles
    this.renderAttackProjectiles(ctx);

    // Render Particles
    this.renderParticles(ctx);

    // Render Floating Text
    this.renderFloatingText(ctx);

    // Render Danger Zone Alert Vignette if board is > 70% full
    if (occupiedCellsCount >= 46) {
      this.renderDangerVignette(ctx, ox, oy, boardPx, (occupiedCellsCount - 45) / 19);
    }

    ctx.restore();
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, cell: GridCell, r?: number, c?: number) {
    const pad = 3;
    const bx = x + pad;
    const by = y + pad;
    const bs = size - pad * 2;
    const radius = 6;

    ctx.save();

    // Check placed squash & stretch animation
    let isAnimated = false;
    let animProgress = 0;
    if (r !== undefined && c !== undefined) {
      const animKey = `${r},${c}`;
      const anim = this.placedAnimations.get(animKey);
      if (anim) {
        const elapsed = performance.now() - anim.startTime;
        if (elapsed < 200) {
          isAnimated = true;
          animProgress = elapsed / 200;
          // Juicy overshoot bounce
          const scale = 1 + Math.sin(animProgress * Math.PI) * 0.16;
          const cx = bx + bs / 2;
          const cy = by + bs / 2;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);
        } else {
          this.placedAnimations.delete(animKey);
        }
      }
    }

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
      const sprite = APK_CUBE_SPRITES[cell.color] || APK_CUBE_SPRITES['#f59e0b'];
      if (this.isAtlasLoaded && this.atlasImg && sprite) {
        // Draw 100% authentic Block Blast mobile 3D beveled block
        ctx.drawImage(
          this.atlasImg,
          sprite.x, sprite.y, sprite.w, sprite.h,
          bx, by, bs, bs
        );
      } else {
        // High quality fallback
        const cornerRadius = Math.max(5, Math.round(bs * 0.16));
        ctx.shadowColor = cell.glowColor || cell.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = cell.color;
        this.roundRect(ctx, bx, by, bs, bs, cornerRadius);
        ctx.fill();

        const bevelGrad = ctx.createLinearGradient(bx, by, bx + bs, by + bs);
        bevelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        bevelGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.15)');
        bevelGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.1)');
        bevelGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        ctx.fillStyle = bevelGrad;
        this.roundRect(ctx, bx, by, bs, bs, cornerRadius);
        ctx.fill();
      }
    }

    // Flash highlight overlay for newly placed blocks
    if (isAnimated) {
      const flashAlpha = Math.max(0, (1 - animProgress) * 0.7);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      this.roundRect(ctx, bx, by, bs, bs, radius);
      ctx.fill();
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
              const sprite = APK_CUBE_SPRITES[piece.color] || APK_CUBE_SPRITES['#f59e0b'];
              if (this.isAtlasLoaded && this.atlasImg && sprite) {
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.drawImage(this.atlasImg, sprite.x, sprite.y, sprite.w, sprite.h, x, y, s, s);
                ctx.restore();
              } else {
                ctx.fillStyle = piece.glowColor || 'rgba(6, 182, 212, 0.45)';
                ctx.strokeStyle = piece.color;
                ctx.shadowColor = piece.color;
                ctx.shadowBlur = 12;
                ctx.lineWidth = 2;
                this.roundRect(ctx, x, y, s, s, 6);
                ctx.fill();
                ctx.stroke();
              }
            } else {
              ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
              ctx.strokeStyle = '#f43f5e';
              ctx.shadowColor = '#f43f5e';
              ctx.shadowBlur = 8;
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

  private renderShockwaves(ctx: CanvasRenderingContext2D, ox: number, oy: number, cs: number, boardPx: number) {
    const now = performance.now();
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      const elapsed = now - sw.startTime;
      if (elapsed >= sw.duration) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      const p = elapsed / sw.duration;
      const alpha = (1 - p) * 0.85;
      const beamSpread = Math.sin(p * Math.PI) * (cs * 0.8);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 20;

      if (sw.type === 'row') {
        const centerY = oy + sw.index * cs + cs / 2;
        const grad = ctx.createLinearGradient(ox, centerY - beamSpread / 2, ox, centerY + beamSpread / 2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.5, sw.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(ox, centerY - beamSpread / 2, boardPx, beamSpread);
      } else {
        const centerX = ox + sw.index * cs + cs / 2;
        const grad = ctx.createLinearGradient(centerX - beamSpread / 2, oy, centerX + beamSpread / 2, oy);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.5, sw.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(centerX - beamSpread / 2, oy, beamSpread, boardPx);
      }

      ctx.restore();
    }
  }

  private renderAttackProjectiles(ctx: CanvasRenderingContext2D) {
    for (let i = this.attackProjectiles.length - 1; i >= 0; i--) {
      const proj = this.attackProjectiles[i];
      proj.progress += proj.speed;

      if (proj.progress < 0) continue; // Waiting for delay

      if (proj.progress >= 1.0) {
        // Spawn impact burst at destination
        for (let k = 0; k < 16; k++) {
          this.createSparkParticle(proj.targetX, proj.targetY, [proj.color, '#ffffff']);
        }
        this.attackProjectiles.splice(i, 1);
        continue;
      }

      // Bezier curve interpolation with arch
      const t = proj.progress;
      const arcHeight = -60 * Math.sin(t * Math.PI);
      proj.currentX = (1 - t) * proj.startX + t * proj.targetX;
      proj.currentY = (1 - t) * proj.startY + t * proj.targetY + arcHeight;

      // Update trail
      proj.trail.push({ x: proj.currentX, y: proj.currentY, alpha: 1.0 });
      if (proj.trail.length > 8) proj.trail.shift();

      ctx.save();

      // Draw trail
      for (let j = 0; j < proj.trail.length; j++) {
        const pt = proj.trail[j];
        const trAlpha = (j / proj.trail.length) * 0.7;
        ctx.fillStyle = proj.color;
        ctx.globalAlpha = trAlpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (j / proj.trail.length) * 5 + 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw blazing core head
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(proj.currentX, proj.currentY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderDangerVignette(ctx: CanvasRenderingContext2D, ox: number, oy: number, boardPx: number, intensity: number) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
    const alpha = Math.min(intensity * 0.65 * pulse, 0.7);

    ctx.save();
    ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
    ctx.lineWidth = 5;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 20;
    this.roundRect(ctx, ox - 4, oy - 4, boardPx + 8, boardPx + 8, 12);
    ctx.stroke();
    ctx.restore();
  }

  private renderOpponent(opponent: OpponentBoardState | null) {
    const ctx = this.oppCtx;
    const width = this.oppCanvas.width / (window.devicePixelRatio || 1);
    const height = this.oppCanvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const pad = 6;
    const cs = this.oppCellSize;
    const ox = Math.floor((width - cs * BOARD_SIZE) / 2);
    const oy = Math.floor((height - cs * BOARD_SIZE) / 2);

    ctx.save();
    // Backdrop
    ctx.fillStyle = '#080c18';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    this.roundRect(ctx, ox - 2, oy - 2, cs * BOARD_SIZE + 4, cs * BOARD_SIZE + 4, 6);
    ctx.fill();
    ctx.stroke();

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;

        ctx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#131c31';
        this.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, 2);
        ctx.fill();

        if (opponent && opponent.grid && opponent.grid[r][c]) {
          const cell = opponent.grid[r][c]!;
          ctx.fillStyle = cell.isGarbage ? '#475569' : cell.color;
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
      ctx.shadowBlur = 8;
      ctx.translate(p.x, p.y);
      if (p.rotation !== undefined) {
        ctx.rotate(p.rotation);
      }

      if (p.shape === 'star') {
        this.drawStar(ctx, 0, 0, 5, p.size * 1.5, p.size * 0.7);
        ctx.fill();
      } else if (p.shape === 'confetti') {
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      } else if (p.shape === 'sparkle') {
        this.drawStar(ctx, 0, 0, 4, p.size * 1.6, p.size * 0.35);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  private renderFloatingText(ctx: CanvasRenderingContext2D) {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.opacity;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.glowColor;
      ctx.shadowBlur = 12;
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
      if (p.vRot) {
        p.rotation = (p.rotation || 0) + p.vRot;
      }
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
