import { PieceShape } from '../shared/pieces.js';
import { BoardGrid, BOARD_SIZE } from '../shared/types.js';
import { CanvasRenderer } from './renderer.js';

export interface InputHandlers {
  onPlacePiece: (pieceIndex: number, targetX: number, targetY: number) => void;
  onPieceSelect?: (pieceIndex: number) => void;
  onRestartGame?: () => void;
  onToggleShortcutsModal?: () => void;
}

export class InputManager {
  private mainCanvas: HTMLCanvasElement;
  private dockContainer: HTMLElement;
  private renderer: CanvasRenderer;
  private handlers: InputHandlers;

  // Active Drag / Selection State
  private draggedPiece: PieceShape | null = null;
  private draggedIndex: number = -1;
  private isDragging: boolean = false;
  private selectedPieceIndex: number = -1;

  // Keyboard Cursor Coordinates on 8x8 Board
  private cursorX: number = 3;
  private cursorY: number = 3;
  private isKeyboardActive: boolean = false;

  // Cached active pieces list from the game
  private activePieces: (any | null)[] = [];

  // Floating drag avatar element
  private dragAvatar: HTMLElement | null = null;

  // Current ghost grid coordinates
  public currentGhost: {
    piece: PieceShape;
    targetX: number;
    targetY: number;
    isValid: boolean;
  } | null = null;

  // Current client board grid for validation preview
  private currentGrid: BoardGrid | null = null;

  constructor(
    mainCanvas: HTMLCanvasElement,
    dockContainer: HTMLElement,
    renderer: CanvasRenderer,
    handlers: InputHandlers
  ) {
    this.mainCanvas = mainCanvas;
    this.dockContainer = dockContainer;
    this.renderer = renderer;
    this.handlers = handlers;

    this.createDragAvatar();
    this.setupEventListeners();
    this.setupKeyboardListeners();
  }

  public isSlotActive(index: number): boolean {
    return (this.isDragging && this.draggedIndex === index) || (this.selectedPieceIndex === index);
  }

  public setGrid(grid: BoardGrid | null) {
    this.currentGrid = grid;
  }

  public setActivePieces(pieces: (any | null)[]) {
    this.activePieces = pieces;
  }

  private createDragAvatar() {
    this.dragAvatar = document.createElement('div');
    this.dragAvatar.className = 'drag-avatar';
    this.dragAvatar.style.position = 'fixed';
    this.dragAvatar.style.pointerEvents = 'none';
    this.dragAvatar.style.touchAction = 'none';
    this.dragAvatar.style.zIndex = '9999';
    this.dragAvatar.style.display = 'none';
    this.dragAvatar.style.transform = 'translate(-50%, -50%)';
    this.dragAvatar.style.willChange = 'left, top';
    document.body.appendChild(this.dragAvatar);
  }

  private setupEventListeners() {
    // Canvas pointer move (for ghost preview when piece is selected)
    this.mainCanvas.addEventListener('mousemove', (e) => {
      this.isKeyboardActive = false;
      this.handleCanvasMove(e.clientX, e.clientY);
    });
    this.mainCanvas.addEventListener('mouseleave', () => this.handleCanvasLeave());
    this.mainCanvas.addEventListener('click', (e) => this.handleCanvasClick(e.clientX, e.clientY));

    // Canvas tap-to-place for mobile touchscreens
    let canvasTouchStartTime = 0;
    let canvasTouchStartX = 0;
    let canvasTouchStartY = 0;

    this.mainCanvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          canvasTouchStartTime = performance.now();
          canvasTouchStartX = t.clientX;
          canvasTouchStartY = t.clientY;
        }
      },
      { passive: true }
    );

    this.mainCanvas.addEventListener(
      'touchend',
      (e) => {
        const elapsed = performance.now() - canvasTouchStartTime;
        const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
        if (t && elapsed < 350) {
          const dist = Math.hypot(t.clientX - canvasTouchStartX, t.clientY - canvasTouchStartY);
          if (dist < 18) {
            // Clean tap on board canvas!
            this.handleCanvasClick(t.clientX, t.clientY);
            if (e.cancelable) e.preventDefault();
          }
        }
      },
      { passive: false }
    );

    // Global drag move & release
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.updateDragPosition(e.clientX, e.clientY);
        this.handleCanvasMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDragging) {
        this.finishDrag(e.clientX, e.clientY);
      }
    });

    // Touch Event Listeners for mobile/tablets
    window.addEventListener(
      'touchmove',
      (e) => {
        if (this.isDragging && e.touches && e.touches.length > 0) {
          const t = e.touches[0];
          const offsetY = this.getTouchOffsetY(this.draggedPiece);
          this.updateDragPosition(t.clientX, t.clientY + offsetY);
          this.handleCanvasMove(t.clientX, t.clientY + offsetY);
          if (e.cancelable) e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener('touchend', (e) => {
      if (this.isDragging) {
        try {
          const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
          if (t) {
            const offsetY = this.getTouchOffsetY(this.draggedPiece);
            this.finishDrag(t.clientX, t.clientY + offsetY);
          } else {
            this.cancelDrag();
          }
        } catch (err) {
          console.warn('[Input] touchend error:', err);
          this.cancelDrag();
        }
      }
    });

    window.addEventListener('touchcancel', () => {
      if (this.isDragging) {
        this.cancelDrag();
      }
    });
  }

  /**
   * Adaptive touch offset: keeps the bottom of the piece 28px above the finger
   */
  private getTouchOffsetY(piece: PieceShape | null): number {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return -30;
    const cs = Math.max(34, Math.min(48, Math.round(this.renderer.mainCellSize * 0.95)));
    const pieceH = piece ? piece.height : 2;
    return -(Math.round((pieceH * cs) / 2) + 28);
  }

  /**
   * Keyboard Controls setup: 1, 2, 3 + WASD/Arrows + Space/Enter + Tab + Esc/C + R
   */
  private setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is currently typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();

      // 1, 2, 3: Select dock piece by slot index
      if (key === '1' || key === '2' || key === '3') {
        const slotIdx = parseInt(key, 10) - 1;
        this.selectPieceByKeyboard(slotIdx);
        e.preventDefault();
        return;
      }

      // Tab: Cycle to next available piece
      if (key === 'tab') {
        this.cycleNextPiece();
        e.preventDefault();
        return;
      }

      // WASD / Arrow Keys: Move placement cursor on board
      if (key === 'w' || e.key === 'ArrowUp') {
        this.moveKeyboardCursor(0, -1);
        e.preventDefault();
        return;
      }
      if (key === 's' || e.key === 'ArrowDown') {
        this.moveKeyboardCursor(0, 1);
        e.preventDefault();
        return;
      }
      if (key === 'a' || e.key === 'ArrowLeft') {
        this.moveKeyboardCursor(-1, 0);
        e.preventDefault();
        return;
      }
      if (key === 'd' || e.key === 'ArrowRight') {
        this.moveKeyboardCursor(1, 0);
        e.preventDefault();
        return;
      }

      // Space / Enter: Place selected piece onto board
      if (key === ' ' || key === 'enter') {
        this.dropKeyboardPiece();
        e.preventDefault();
        return;
      }

      // Esc / C: Deselect current piece
      if (key === 'escape' || key === 'c') {
        this.cancelDrag();
        e.preventDefault();
        return;
      }

      // R: Quick Restart
      if (key === 'r') {
        if (this.handlers.onRestartGame) {
          this.handlers.onRestartGame();
          e.preventDefault();
        }
        return;
      }

      // ? or H: Toggle shortcuts modal
      if (key === '?' || key === 'h') {
        if (this.handlers.onToggleShortcutsModal) {
          this.handlers.onToggleShortcutsModal();
          e.preventDefault();
        }
        return;
      }
    });
  }

  /**
   * Select a piece by index (0, 1, 2) via keyboard with Smart Auto-Snap
   */
  public selectPieceByKeyboard(index: number) {
    const ap = this.activePieces[index];
    if (!ap || ap.placed) return;

    this.isKeyboardActive = true;
    this.selectedPieceIndex = index;
    this.draggedIndex = index;
    this.draggedPiece = ap.piece;

    this.updateDockSelectionUI(index);

    // Smart Auto-Snap:
    // If the piece already fits at current (cursorX, cursorY), stay there.
    // Otherwise, scan the 8x8 grid to automatically snap to the nearest valid spot!
    if (!this.checkValid(ap.piece, this.cursorX, this.cursorY)) {
      const snapSpot = this.findSmartSnapPosition(ap.piece);
      if (snapSpot) {
        this.cursorX = snapSpot.x;
        this.cursorY = snapSpot.y;
      }
    }

    const isValid = this.checkValid(ap.piece, this.cursorX, this.cursorY);
    this.currentGhost = {
      piece: ap.piece,
      targetX: this.cursorX,
      targetY: this.cursorY,
      isValid
    };

    if (this.handlers.onPieceSelect) {
      this.handlers.onPieceSelect(index);
    }
  }

  /**
   * Move the keyboard cursor and update ghost preview
   */
  private moveKeyboardCursor(dx: number, dy: number) {
    this.isKeyboardActive = true;

    // If no piece is currently selected, auto-select the first available piece
    if (!this.draggedPiece) {
      this.autoSelectAvailablePiece();
    }

    const piece = this.draggedPiece;
    const maxX = piece ? BOARD_SIZE - piece.width : BOARD_SIZE - 1;
    const maxY = piece ? BOARD_SIZE - piece.height : BOARD_SIZE - 1;

    this.cursorX = Math.max(0, Math.min(maxX, this.cursorX + dx));
    this.cursorY = Math.max(0, Math.min(maxY, this.cursorY + dy));

    if (piece) {
      const isValid = this.checkValid(piece, this.cursorX, this.cursorY);
      this.currentGhost = {
        piece,
        targetX: this.cursorX,
        targetY: this.cursorY,
        isValid
      };
    }
  }

  /**
   * Drop the selected piece onto the current keyboard cursor position
   */
  private dropKeyboardPiece() {
    if (!this.draggedPiece || this.selectedPieceIndex < 0) return;

    const isValid = this.checkValid(this.draggedPiece, this.cursorX, this.cursorY);
    if (isValid) {
      const placedIndex = this.selectedPieceIndex;
      const targetX = this.cursorX;
      const targetY = this.cursorY;

      this.cancelDrag();
      this.handlers.onPlacePiece(placedIndex, targetX, targetY);

      // Automatically select next unplaced piece if still actively using keyboard
      setTimeout(() => {
        if (this.isKeyboardActive && this.activePieces.some(ap => ap && !ap.placed)) {
          this.autoSelectAvailablePiece();
        }
      }, 80);
    } else {
      // Trigger temporary red warning shake on ghost
      if (this.currentGhost) {
        this.currentGhost.isValid = false;
      }
    }
  }

  /**
   * Cycle to the next available unplaced piece (Tab key)
   */
  private cycleNextPiece() {
    const unplacedIndices: number[] = [];
    for (let i = 0; i < this.activePieces.length; i++) {
      const ap = this.activePieces[i];
      if (ap && !ap.placed) unplacedIndices.push(i);
    }

    if (unplacedIndices.length === 0) return;

    const currentPos = unplacedIndices.indexOf(this.selectedPieceIndex);
    const nextIdx = unplacedIndices[(currentPos + 1) % unplacedIndices.length];
    this.selectPieceByKeyboard(nextIdx);
  }

  /**
   * Auto-select the first available unplaced piece
   */
  private autoSelectAvailablePiece() {
    for (let i = 0; i < this.activePieces.length; i++) {
      const ap = this.activePieces[i];
      if (ap && !ap.placed) {
        this.selectPieceByKeyboard(i);
        break;
      }
    }
  }

  /**
   * Find a smart placement spot for piece on the current board
   */
  private findSmartSnapPosition(piece: PieceShape): { x: number; y: number } | null {
    // 1. Check surrounding cells around current cursor position
    const radiusOrder = [0, 1, 2, 3, 4, 5, 6, 7];
    for (const r of radiusOrder) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const testX = this.cursorX + dx;
          const testY = this.cursorY + dy;
          if (this.checkValid(piece, testX, testY)) {
            return { x: testX, y: testY };
          }
        }
      }
    }
    return null;
  }

  /**
   * Update visual highlight on dock slots
   */
  private updateDockSelectionUI(selectedIndex: number) {
    const slots = Array.from(this.dockContainer.querySelectorAll('.dock-slot')) as HTMLElement[];
    slots.forEach((slot, i) => {
      if (i === selectedIndex) {
        slot.classList.add('selected');
        if (this.isDragging) {
          slot.classList.add('dragging');
        } else {
          slot.classList.remove('dragging');
        }
      } else {
        slot.classList.remove('selected');
        slot.classList.remove('dragging');
      }
    });
  }

  /**
   * Bind interactive events to a dock piece card or slot
   */
  public bindDockPiece(cardElement: HTMLElement, piece: PieceShape, index: number) {
    const startInteraction = (clientX: number, clientY: number) => {
      // If clicking the already selected piece, deselect/toggle it
      if (this.selectedPieceIndex === index && !this.isDragging) {
        this.cancelDrag();
        return;
      }

      this.isKeyboardActive = false;
      this.draggedPiece = piece;
      this.draggedIndex = index;
      this.isDragging = true;
      this.selectedPieceIndex = index;

      this.renderAvatarPiece(piece);
      const offsetY = this.getTouchOffsetY(piece);
      this.updateDragPosition(clientX, clientY + offsetY);
      this.handleCanvasMove(clientX, clientY + offsetY);
      this.updateDockSelectionUI(index);

      if (this.handlers.onPieceSelect) {
        this.handlers.onPieceSelect(index);
      }
    };

    // Mouse drag
    cardElement.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      startInteraction(e.clientX, e.clientY);
      e.preventDefault();
    });

    // Touch drag
    cardElement.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          startInteraction(t.clientX, t.clientY);
          if (e.cancelable) e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  private renderAvatarPiece(piece: PieceShape) {
    if (!this.dragAvatar) return;
    this.dragAvatar.innerHTML = '';
    this.dragAvatar.style.display = 'block';
    this.dragAvatar.style.transform = 'translate(-50%, -50%)';

    const cellSize = Math.max(34, Math.min(48, Math.round(this.renderer.mainCellSize * 0.95)));
    const table = document.createElement('div');
    table.style.display = 'grid';
    table.style.gridTemplateColumns = `repeat(${piece.width}, ${cellSize}px)`;
    table.style.gridTemplateRows = `repeat(${piece.height}, ${cellSize}px)`;
    table.style.gap = '3px';

    for (let r = 0; r < piece.height; r++) {
      for (let c = 0; c < piece.width; c++) {
        const cell = document.createElement('div');
        if (piece.matrix[r][c] === 1) {
          cell.style.backgroundColor = piece.color;
          cell.style.backgroundImage = 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.12) 45%, rgba(0, 0, 0, 0.4) 100%)';
          cell.style.boxShadow = `0 0 14px ${piece.color}, inset 0 0 6px rgba(255, 255, 255, 0.7)`;
          cell.style.border = '1px solid rgba(255, 255, 255, 0.6)';
          cell.style.borderRadius = '6px';
        } else {
          cell.style.backgroundColor = 'transparent';
        }
        table.appendChild(cell);
      }
    }

    this.dragAvatar.appendChild(table);
  }

  private updateDragPosition(clientX: number, clientY: number) {
    if (!this.dragAvatar) return;
    this.dragAvatar.style.left = `${clientX}px`;
    this.dragAvatar.style.top = `${clientY}px`;
    this.dragAvatar.style.transform = 'translate(-50%, -50%)';
  }

  /**
   * Calculate grid coordinates with Magnetic Snap & Clamping for silky smooth mobile touch
   */
  private getGridCoordinates(clientX: number, clientY: number, piece?: PieceShape): { gx: number; gy: number } | null {
    const rect = this.mainCanvas.getBoundingClientRect();
    const ox = rect.left + this.renderer.mainGridOffset.x;
    const oy = rect.top + this.renderer.mainGridOffset.y;
    const cs = this.renderer.mainCellSize;
    const boardPx = cs * BOARD_SIZE;

    const relX = clientX - ox;
    const relY = clientY - oy;

    // Generous bounding margins so dragging near any edge of the board is recognized
    const topMargin = Math.max(cs * 2.5, 90);
    const bottomMargin = Math.max(cs * 2.5, 90);
    const sideMargin = Math.max(cs * 2.0, 70);

    if (
      relX < -sideMargin ||
      relX > boardPx + sideMargin ||
      relY < -topMargin ||
      relY > boardPx + bottomMargin
    ) {
      return null;
    }

    const cursorGx = Math.floor(relX / cs);
    const cursorGy = Math.floor(relY / cs);

    if (!piece) {
      return {
        gx: Math.max(0, Math.min(BOARD_SIZE - 1, cursorGx)),
        gy: Math.max(0, Math.min(BOARD_SIZE - 1, cursorGy))
      };
    }

    const { width, height } = piece;
    const maxGx = BOARD_SIZE - width;
    const maxGy = BOARD_SIZE - height;

    const offsetX = Math.floor(width / 2);
    const offsetY = Math.floor(height / 2);

    const rawGx = cursorGx - offsetX;
    const rawGy = cursorGy - offsetY;

    // Clamp ideal placement to board boundaries
    const clampedGx = Math.max(0, Math.min(maxGx, rawGx));
    const clampedGy = Math.max(0, Math.min(maxGy, rawGy));

    // 1. Direct hit: check if clamped spot is 100% valid
    if (this.checkValid(piece, clampedGx, clampedGy)) {
      return { gx: clampedGx, gy: clampedGy };
    }

    // 2. Magnetic Snap: Search immediate neighboring cells in order of proximity
    const neighborDeltas = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 }
    ];

    for (const d of neighborDeltas) {
      const testX = clampedGx + d.dx;
      const testY = clampedGy + d.dy;
      if (testX >= 0 && testX <= maxGx && testY >= 0 && testY <= maxGy) {
        if (this.checkValid(piece, testX, testY)) {
          return { gx: testX, gy: testY };
        }
      }
    }

    // 3. Fallback: return clamped spot (will display red invalid preview)
    return { gx: clampedGx, gy: clampedGy };
  }

  private checkValid(piece: PieceShape, targetX: number, targetY: number): boolean {
    if (!this.currentGrid) return false;
    const { width, height, matrix } = piece;

    if (targetX < 0 || targetY < 0 || targetX + width > BOARD_SIZE || targetY + height > BOARD_SIZE) {
      return false;
    }

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (matrix[r][c] === 1) {
          if (this.currentGrid[targetY + r][targetX + c] !== null) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private handleCanvasMove(clientX: number, clientY: number) {
    const activePiece = this.draggedPiece;
    if (!activePiece) {
      this.currentGhost = null;
      return;
    }

    const coords = this.getGridCoordinates(clientX, clientY, activePiece);
    if (!coords) {
      this.currentGhost = null;
      return;
    }

    const targetX = coords.gx;
    const targetY = coords.gy;
    const isValid = this.checkValid(activePiece, targetX, targetY);

    this.cursorX = targetX;
    this.cursorY = targetY;

    this.currentGhost = {
      piece: activePiece,
      targetX,
      targetY,
      isValid
    };
  }

  private handleCanvasLeave() {
    if (!this.isDragging && !this.isKeyboardActive) {
      this.currentGhost = null;
    }
  }

  private handleCanvasClick(clientX: number, clientY: number) {
    if (this.isDragging) return;

    if (this.selectedPieceIndex >= 0 && this.draggedPiece) {
      const coords = this.getGridCoordinates(clientX, clientY, this.draggedPiece);
      if (coords && this.checkValid(this.draggedPiece, coords.gx, coords.gy)) {
        const placedIndex = this.selectedPieceIndex;
        const targetX = coords.gx;
        const targetY = coords.gy;
        this.cancelDrag();
        this.handlers.onPlacePiece(placedIndex, targetX, targetY);
      }
    }
  }

  private finishDrag(clientX: number, clientY: number) {
    if (!this.isDragging || !this.draggedPiece) {
      this.cancelDrag();
      return;
    }

    const coords = this.getGridCoordinates(clientX, clientY, this.draggedPiece);
    if (coords && this.checkValid(this.draggedPiece, coords.gx, coords.gy)) {
      const placedIndex = this.draggedIndex;
      const targetX = coords.gx;
      const targetY = coords.gy;
      this.cancelDrag();
      this.handlers.onPlacePiece(placedIndex, targetX, targetY);
    } else {
      // Releasing outside board / over dock:
      // Hide the drag avatar and disable active dragging mode,
      // but KEEP the piece selected for Click-to-Place / Tap-to-Place on the board!
      this.isDragging = false;
      this.draggedIndex = -1;
      if (this.dragAvatar) {
        this.dragAvatar.style.display = 'none';
        this.dragAvatar.innerHTML = '';
      }
      this.updateDockSelectionUI(this.selectedPieceIndex);
    }
  }

  public cancelDrag() {
    this.isDragging = false;
    this.draggedPiece = null;
    this.draggedIndex = -1;
    this.selectedPieceIndex = -1;
    this.currentGhost = null;

    this.updateDockSelectionUI(-1);

    if (this.dragAvatar) {
      this.dragAvatar.style.display = 'none';
      this.dragAvatar.innerHTML = '';
    }
  }
}
