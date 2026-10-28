import { PieceShape } from '../shared/pieces.js';
import { BoardGrid, BOARD_SIZE } from '../shared/types.js';
import { CanvasRenderer } from './renderer.js';

export interface InputHandlers {
  onPlacePiece: (pieceIndex: number, targetX: number, targetY: number) => void;
  onPieceSelect?: (pieceIndex: number) => void;
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
  }

  public setGrid(grid: BoardGrid | null) {
    this.currentGrid = grid;
  }

  private createDragAvatar() {
    this.dragAvatar = document.createElement('div');
    this.dragAvatar.className = 'drag-avatar';
    this.dragAvatar.style.position = 'fixed';
    this.dragAvatar.style.pointerEvents = 'none';
    this.dragAvatar.style.zIndex = '9999';
    this.dragAvatar.style.display = 'none';
    this.dragAvatar.style.transform = 'translate(-50%, -50%)';
    this.dragAvatar.style.willChange = 'left, top';
    document.body.appendChild(this.dragAvatar);
  }

  private setupEventListeners() {
    // Canvas pointer move (for ghost preview when piece is selected)
    this.mainCanvas.addEventListener('mousemove', (e) => this.handleCanvasMove(e.clientX, e.clientY));
    this.mainCanvas.addEventListener('mouseleave', () => this.handleCanvasLeave());
    this.mainCanvas.addEventListener('click', (e) => this.handleCanvasClick(e.clientX, e.clientY));

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
        if (this.isDragging && e.touches.length > 0) {
          const t = e.touches[0];
          // Slight upward touch offset so piece is visible above player's fingertip
          const offsetY = -40;
          this.updateDragPosition(t.clientX, t.clientY + offsetY);
          this.handleCanvasMove(t.clientX, t.clientY + offsetY);
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener('touchend', (e) => {
      if (this.isDragging) {
        const t = e.changedTouches[0];
        const offsetY = -40;
        this.finishDrag(t.clientX, t.clientY + offsetY);
      }
    });

    window.addEventListener('touchcancel', () => {
      if (this.isDragging) {
        this.cancelDrag();
      }
    });
  }

  /**
   * Bind interactive events to a dock piece card
   */
  public bindDockPiece(cardElement: HTMLElement, piece: PieceShape, index: number) {
    const startInteraction = (clientX: number, clientY: number) => {
      this.draggedPiece = piece;
      this.draggedIndex = index;
      this.isDragging = true;
      this.selectedPieceIndex = index;

      this.renderAvatarPiece(piece);
      this.updateDragPosition(clientX, clientY);

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
          e.preventDefault();
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

    const cellSize = Math.max(34, Math.min(48, Math.round(this.renderer.mainCellSize * 0.9)));
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
          cell.style.boxShadow = `0 0 12px ${piece.color}`;
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

  private getGridCoordinates(clientX: number, clientY: number, piece?: PieceShape): { gx: number; gy: number } | null {
    const rect = this.mainCanvas.getBoundingClientRect();
    const ox = rect.left + this.renderer.mainGridOffset.x;
    const oy = rect.top + this.renderer.mainGridOffset.y;
    const cs = this.renderer.mainCellSize;
    const boardPx = cs * BOARD_SIZE;

    const relX = clientX - ox;
    const relY = clientY - oy;

    // Generous bounding box margin so piece does not disappear when dragging near edges
    const margin = cs * 1.5;
    if (
      relX < -margin ||
      relX > boardPx + margin ||
      relY < -margin ||
      relY > boardPx + margin
    ) {
      return null;
    }

    const cursorGx = Math.floor(relX / cs);
    const cursorGy = Math.floor(relY / cs);

    if (piece) {
      // Offset so the center of the block is positioned at the cursor rather than top-left corner
      const offsetX = Math.floor(piece.width / 2);
      const offsetY = Math.floor(piece.height / 2);
      return {
        gx: cursorGx - offsetX,
        gy: cursorGy - offsetY
      };
    }

    return { gx: cursorGx, gy: cursorGy };
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

    // Anchor at center of block
    const targetX = coords.gx;
    const targetY = coords.gy;
    const isValid = this.checkValid(activePiece, targetX, targetY);

    this.currentGhost = {
      piece: activePiece,
      targetX,
      targetY,
      isValid
    };
  }

  private handleCanvasLeave() {
    if (!this.isDragging) {
      this.currentGhost = null;
    }
  }

  private handleCanvasClick(clientX: number, clientY: number) {
    if (this.isDragging) return; // Handled by finishDrag

    if (this.selectedPieceIndex >= 0 && this.draggedPiece) {
      const coords = this.getGridCoordinates(clientX, clientY, this.draggedPiece);
      if (coords && this.checkValid(this.draggedPiece, coords.gx, coords.gy)) {
        this.handlers.onPlacePiece(this.selectedPieceIndex, coords.gx, coords.gy);
        this.cancelDrag();
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
      this.handlers.onPlacePiece(this.draggedIndex, coords.gx, coords.gy);
    }

    this.cancelDrag();
  }

  public cancelDrag() {
    this.isDragging = false;
    this.draggedPiece = null;
    this.draggedIndex = -1;
    this.selectedPieceIndex = -1;
    this.currentGhost = null;

    if (this.dragAvatar) {
      this.dragAvatar.style.display = 'none';
      this.dragAvatar.innerHTML = '';
    }
  }
}
