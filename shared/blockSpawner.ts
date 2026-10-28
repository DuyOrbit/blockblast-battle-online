/**
 * Block Spawner / RNG Engine cho Block Blast trên lưới 8x8
 * Thiết kế chuẩn theo yêu cầu logic:
 * 1. 35 khối cố định (không xoay) thuộc 7 nhóm cổ điển: Dot, Lines, Squares, Corner 3, L-shapes, T-shapes, Z/S-shapes.
 * 2. Mỗi khối biểu diễn bằng ma trận nhị phân 2D kèm metadata (id, name, category, size, width, height, colors).
 * 3. Sinh bộ 3 khối (Batch Generation) với hàm canPlace(board, shape) quét tối ưu ma trận 8x8.
 * 4. Nguyên tắc sống còn (Solvability Guarantee): luôn đảm bảo ít nhất 1 khối đặt vừa vào bàn cờ hiện tại.
 * 5. Thuật toán cân bằng động theo trạng thái bàn cờ (Dynamic Weighted Balancing):
 *    - Trống nhiều (>= 40 ô): tăng trọng số khối lớn (3x3, thanh 5, L lớn 5).
 *    - Trung bình (20 - 39 ô): phân bổ đều khối vừa và nhỏ.
 *    - Nguy cấp (< 20 ô): tăng mạnh trọng số khối nhỏ linh hoạt (1x1, 1x2, 2x1, corner 3), giảm khối lớn về cực thấp.
 * 6. Hạn chế trùng lặp: không xuất hiện 2 khối 3x3 hoặc 2 khối thanh 5 trong cùng 1 bộ 3 khối.
 */

export interface Block {
  id: string;
  name: string;
  category: 'dot' | 'line' | 'square' | 'corner_3' | 'l_shape' | 't_shape' | 'z_shape';
  matrix: number[][]; // Ma trận nhị phân 2D (1 và 0)
  size: number;       // Số ô thực tế (tổng số ô = 1)
  width: number;      // Chiều rộng khung bao (bounding width)
  height: number;     // Chiều cao khung bao (bounding height)
  color: string;      // Màu sắc hiển thị
  glowColor: string;  // Màu viền phát sáng Neon
}

export const NEON_COLORS = {
  cyan: '#06b6d4',
  amber: '#f59e0b',
  emerald: '#10b981',
  purple: '#a855f7',
  rose: '#f43f5e',
  blue: '#3b82f6',
  orange: '#f97316',
  yellow: '#eab308',
  fuchsia: '#d946ef',
  teal: '#14b8a6'
};

/**
 * Danh sách 35 khối chuẩn cốt lõi (7 nhóm) không xoay
 */
export const BLOCK_CATALOG: Block[] = [
  // ==========================================
  // 1. KHỐI 1 Ô (DOT) - 1 hình
  // ==========================================
  {
    id: 'dot_1',
    name: 'Khối 1 Ô (Dot)',
    category: 'dot',
    matrix: [[1]],
    size: 1,
    width: 1,
    height: 1,
    color: NEON_COLORS.amber,
    glowColor: 'rgba(245, 158, 11, 0.6)'
  },

  // ==========================================
  // 2. THANH THẲNG (LINES) - 8 hình
  // ==========================================
  // 2 ô: 2x1 & 1x2
  {
    id: 'line_2_h',
    name: 'Thanh 2 ô Ngang (2x1)',
    category: 'line',
    matrix: [[1, 1]],
    size: 2,
    width: 2,
    height: 1,
    color: NEON_COLORS.emerald,
    glowColor: 'rgba(16, 185, 129, 0.6)'
  },
  {
    id: 'line_2_v',
    name: 'Thanh 2 ô Dọc (1x2)',
    category: 'line',
    matrix: [[1], [1]],
    size: 2,
    width: 1,
    height: 2,
    color: NEON_COLORS.emerald,
    glowColor: 'rgba(16, 185, 129, 0.6)'
  },
  // 3 ô: 3x1 & 1x3
  {
    id: 'line_3_h',
    name: 'Thanh 3 ô Ngang (3x1)',
    category: 'line',
    matrix: [[1, 1, 1]],
    size: 3,
    width: 3,
    height: 1,
    color: NEON_COLORS.amber,
    glowColor: 'rgba(245, 158, 11, 0.6)'
  },
  {
    id: 'line_3_v',
    name: 'Thanh 3 ô Dọc (1x3)',
    category: 'line',
    matrix: [[1], [1], [1]],
    size: 3,
    width: 1,
    height: 3,
    color: NEON_COLORS.amber,
    glowColor: 'rgba(245, 158, 11, 0.6)'
  },
  // 4 ô: 4x1 & 1x4
  {
    id: 'line_4_h',
    name: 'Thanh 4 ô Ngang (4x1)',
    category: 'line',
    matrix: [[1, 1, 1, 1]],
    size: 4,
    width: 4,
    height: 1,
    color: NEON_COLORS.cyan,
    glowColor: 'rgba(6, 182, 212, 0.6)'
  },
  {
    id: 'line_4_v',
    name: 'Thanh 4 ô Dọc (1x4)',
    category: 'line',
    matrix: [[1], [1], [1], [1]],
    size: 4,
    width: 1,
    height: 4,
    color: NEON_COLORS.cyan,
    glowColor: 'rgba(6, 182, 212, 0.6)'
  },
  // 5 ô: 5x1 & 1x5 (khối dài)
  {
    id: 'line_5_h',
    name: 'Thanh 5 ô Ngang (5x1)',
    category: 'line',
    matrix: [[1, 1, 1, 1, 1]],
    size: 5,
    width: 5,
    height: 1,
    color: NEON_COLORS.rose,
    glowColor: 'rgba(244, 63, 94, 0.7)'
  },
  {
    id: 'line_5_v',
    name: 'Thanh 5 ô Dọc (1x5)',
    category: 'line',
    matrix: [[1], [1], [1], [1], [1]],
    size: 5,
    width: 1,
    height: 5,
    color: NEON_COLORS.rose,
    glowColor: 'rgba(244, 63, 94, 0.7)'
  },

  // ==========================================
  // 3. KHỐI VUÔNG (SQUARES) - 2 hình
  // ==========================================
  // Vuông nhỏ: 2x2 (4 ô)
  {
    id: 'square_2x2',
    name: 'Vuông Nhỏ 2x2',
    category: 'square',
    matrix: [
      [1, 1],
      [1, 1]
    ],
    size: 4,
    width: 2,
    height: 2,
    color: NEON_COLORS.yellow,
    glowColor: 'rgba(234, 179, 8, 0.6)'
  },
  // Vuông lớn: 3x3 (9 ô, khối to nhất game)
  {
    id: 'square_3x3',
    name: 'Vuông Lớn 3x3',
    category: 'square',
    matrix: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ],
    size: 9,
    width: 3,
    height: 3,
    color: NEON_COLORS.rose,
    glowColor: 'rgba(244, 63, 94, 0.8)'
  },

  // ==========================================
  // 4. KHỐI GÓC VUÔNG NHỎ (CORNER 3 Ô) - 4 hướng
  // ==========================================
  {
    id: 'corner_3_tl',
    name: 'Góc Nhỏ 3 ô (Trên-Trái)',
    category: 'corner_3',
    matrix: [
      [1, 1],
      [1, 0]
    ],
    size: 3,
    width: 2,
    height: 2,
    color: NEON_COLORS.blue,
    glowColor: 'rgba(59, 130, 246, 0.6)'
  },
  {
    id: 'corner_3_tr',
    name: 'Góc Nhỏ 3 ô (Trên-Phải)',
    category: 'corner_3',
    matrix: [
      [1, 1],
      [0, 1]
    ],
    size: 3,
    width: 2,
    height: 2,
    color: NEON_COLORS.blue,
    glowColor: 'rgba(59, 130, 246, 0.6)'
  },
  {
    id: 'corner_3_bl',
    name: 'Góc Nhỏ 3 ô (Dưới-Trái)',
    category: 'corner_3',
    matrix: [
      [1, 0],
      [1, 1]
    ],
    size: 3,
    width: 2,
    height: 2,
    color: NEON_COLORS.blue,
    glowColor: 'rgba(59, 130, 246, 0.6)'
  },
  {
    id: 'corner_3_br',
    name: 'Góc Nhỏ 3 ô (Dưới-Phải)',
    category: 'corner_3',
    matrix: [
      [0, 1],
      [1, 1]
    ],
    size: 3,
    width: 2,
    height: 2,
    color: NEON_COLORS.blue,
    glowColor: 'rgba(59, 130, 246, 0.6)'
  },

  // ==========================================
  // 5. KHỐI CHỮ L (L-SHAPES) - 12 hình
  // ==========================================
  // L thường 4 ô Dọc (4 hướng)
  {
    id: 'l_4_v_br',
    name: 'Chữ L 4 ô Dọc (Chân Dưới-Phải)',
    category: 'l_shape',
    matrix: [
      [1, 0],
      [1, 0],
      [1, 1]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },
  {
    id: 'l_4_v_bl',
    name: 'Chữ L 4 ô Dọc (Chân Dưới-Trái)',
    category: 'l_shape',
    matrix: [
      [0, 1],
      [0, 1],
      [1, 1]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },
  {
    id: 'l_4_v_tr',
    name: 'Chữ L 4 ô Dọc (Chân Trên-Phải)',
    category: 'l_shape',
    matrix: [
      [1, 1],
      [1, 0],
      [1, 0]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },
  {
    id: 'l_4_v_tl',
    name: 'Chữ L 4 ô Dọc (Chân Trên-Trái)',
    category: 'l_shape',
    matrix: [
      [1, 1],
      [0, 1],
      [0, 1]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },

  // L thường 4 ô Ngang (4 hướng)
  {
    id: 'l_4_h_bl',
    name: 'Chữ L 4 ô Ngang (Chân Dưới-Trái)',
    category: 'l_shape',
    matrix: [
      [1, 1, 1],
      [1, 0, 0]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },
  {
    id: 'l_4_h_br',
    name: 'Chữ L 4 ô Ngang (Chân Dưới-Phải)',
    category: 'l_shape',
    matrix: [
      [1, 1, 1],
      [0, 0, 1]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },
  {
    id: 'l_4_h_tl',
    name: 'Chữ L 4 ô Ngang (Chân Trên-Trái)',
    category: 'l_shape',
    matrix: [
      [1, 0, 0],
      [1, 1, 1]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },
  {
    id: 'l_4_h_tr',
    name: 'Chữ L 4 ô Ngang (Chân Trên-Phải)',
    category: 'l_shape',
    matrix: [
      [0, 0, 1],
      [1, 1, 1]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.orange,
    glowColor: 'rgba(249, 115, 22, 0.6)'
  },

  // L lớn 5 ô (Khung 3x3 góc vuông lớn - 4 hướng)
  {
    id: 'corner_5_tl',
    name: 'Chữ L Lớn 5 ô (Góc Trên-Trái)',
    category: 'l_shape',
    matrix: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0]
    ],
    size: 5,
    width: 3,
    height: 3,
    color: NEON_COLORS.purple,
    glowColor: 'rgba(168, 85, 247, 0.6)'
  },
  {
    id: 'corner_5_tr',
    name: 'Chữ L Lớn 5 ô (Góc Trên-Phải)',
    category: 'l_shape',
    matrix: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1]
    ],
    size: 5,
    width: 3,
    height: 3,
    color: NEON_COLORS.purple,
    glowColor: 'rgba(168, 85, 247, 0.6)'
  },
  {
    id: 'corner_5_bl',
    name: 'Chữ L Lớn 5 ô (Góc Dưới-Trái)',
    category: 'l_shape',
    matrix: [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1]
    ],
    size: 5,
    width: 3,
    height: 3,
    color: NEON_COLORS.purple,
    glowColor: 'rgba(168, 85, 247, 0.6)'
  },
  {
    id: 'corner_5_br',
    name: 'Chữ L Lớn 5 ô (Góc Dưới-Phải)',
    category: 'l_shape',
    matrix: [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1]
    ],
    size: 5,
    width: 3,
    height: 3,
    color: NEON_COLORS.purple,
    glowColor: 'rgba(168, 85, 247, 0.6)'
  },

  // ==========================================
  // 6. KHỐI CHỮ T (T-SHAPES) - 4 hướng
  // ==========================================
  {
    id: 't_4_up',
    name: 'Chữ T Hướng Lên',
    category: 't_shape',
    matrix: [
      [0, 1, 0],
      [1, 1, 1]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.fuchsia,
    glowColor: 'rgba(217, 70, 239, 0.6)'
  },
  {
    id: 't_4_down',
    name: 'Chữ T Hướng Xuống',
    category: 't_shape',
    matrix: [
      [1, 1, 1],
      [0, 1, 0]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.fuchsia,
    glowColor: 'rgba(217, 70, 239, 0.6)'
  },
  {
    id: 't_4_left',
    name: 'Chữ T Hướng Trái',
    category: 't_shape',
    matrix: [
      [0, 1],
      [1, 1],
      [0, 1]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.fuchsia,
    glowColor: 'rgba(217, 70, 239, 0.6)'
  },
  {
    id: 't_4_right',
    name: 'Chữ T Hướng Phải',
    category: 't_shape',
    matrix: [
      [1, 0],
      [1, 1],
      [1, 0]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.fuchsia,
    glowColor: 'rgba(217, 70, 239, 0.6)'
  },

  // ==========================================
  // 7. KHỐI ZÍC-ZẮC / BẬC THANG (Z & S) - 4 biến thể
  // ==========================================
  {
    id: 'z_4_h',
    name: 'Zíc-Zắc Z Ngang',
    category: 'z_shape',
    matrix: [
      [1, 1, 0],
      [0, 1, 1]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.teal,
    glowColor: 'rgba(20, 184, 166, 0.6)'
  },
  {
    id: 's_4_h',
    name: 'Zíc-Zắc S Ngang',
    category: 'z_shape',
    matrix: [
      [0, 1, 1],
      [1, 1, 0]
    ],
    size: 4,
    width: 3,
    height: 2,
    color: NEON_COLORS.teal,
    glowColor: 'rgba(20, 184, 166, 0.6)'
  },
  {
    id: 'z_4_v',
    name: 'Zíc-Zắc Z Dọc',
    category: 'z_shape',
    matrix: [
      [0, 1],
      [1, 1],
      [1, 0]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.teal,
    glowColor: 'rgba(20, 184, 166, 0.6)'
  },
  {
    id: 's_4_v',
    name: 'Zíc-Zắc S Dọc',
    category: 'z_shape',
    matrix: [
      [1, 0],
      [1, 1],
      [0, 1]
    ],
    size: 4,
    width: 2,
    height: 3,
    color: NEON_COLORS.teal,
    glowColor: 'rgba(20, 184, 166, 0.6)'
  }
];

export type BoardMatrix = (number | null | object | boolean)[][];

/**
 * Deterministic 32-bit PRNG (Mulberry32)
 */
export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

/**
 * Class BlockSpawner - Quản lý việc sinh khối ngẫu nhiên có trọng số và đảm bảo tính khả thi
 */
export class BlockSpawner {
  private rng: () => number;

  /**
   * Khởi tạo BlockSpawner với PRNG tùy chọn (để đồng bộ seed PvP) hoặc Math.random
   * @param rngOrSeed Hàm sinh số ngẫu nhiên [0, 1) hoặc số seed nguyên dương
   */
  constructor(rngOrSeed?: (() => number) | number) {
    if (typeof rngOrSeed === 'number') {
      this.rng = BlockSpawner.createMulberry32(rngOrSeed);
    } else if (typeof rngOrSeed === 'function') {
      this.rng = rngOrSeed;
    } else {
      this.rng = Math.random;
    }
  }

  /**
   * Tạo PRNG Mulberry32 xác định (deterministic) từ seed
   */
  public static createMulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Quét toàn bộ bàn cờ 8x8 để kiểm tra xem một hình có thể đặt vào bất kỳ vị trí hợp lệ nào không.
   * Tối ưu hiệu năng: thoát sớm (early return) ngay khi tìm thấy vị trí đầu tiên đặt được.
   *
   * @param board Bảng lưới 8x8 (chấp nhận ma trận 0/1, ma trận cell game hoặc boolean)
   * @param shape Khối cần kiểm tra
   * @returns true nếu có ít nhất 1 ô hợp lệ, false nếu không thể đặt
   */
  public static canPlace(board: BoardMatrix, shape: Block): boolean {
    const rows = 8;
    const cols = 8;
    const h = shape.height;
    const w = shape.width;
    const matrix = shape.matrix;

    // Khối có kích thước lớn hơn bàn cờ
    if (h > rows || w > cols) return false;

    // Quét từng vị trí góc trên-trái (r, c)
    for (let r = 0; r <= rows - h; r++) {
      for (let c = 0; c <= cols - w; c++) {
        let fits = true;

        for (let dr = 0; dr < h; dr++) {
          for (let dc = 0; dc < w; dc++) {
            if (matrix[dr][dc] === 1) {
              const cell = board[r + dr]?.[c + dc];
              // Ô coi là bị chiếm nếu khác 0, khác null, khác undefined, khác false
              if (cell !== 0 && cell !== null && cell !== undefined && cell !== false) {
                fits = false;
                break;
              }
            }
          }
          if (!fits) break;
        }

        // Tối ưu hiệu năng: tìm thấy 1 vị trí đặt được là dừng ngay lập tức
        if (fits) return true;
      }
    }

    return false;
  }

  /**
   * Đếm số ô trống hiện tại trên bảng 8x8 (tổng 64 ô)
   */
  public static countEmptyCells(board: BoardMatrix): number {
    let emptyCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r]?.[c];
        if (cell === 0 || cell === null || cell === undefined || cell === false) {
          emptyCount++;
        }
      }
    }
    return emptyCount;
  }

  /**
   * Thuật toán cân bằng trọng số động theo số ô trống trên bàn cờ (Dynamic Weighted Balancing)
   *
   * @param shape Khối cần tính trọng số
   * @param emptyCells Số ô trống hiện tại trên bàn cờ (0..64)
   * @returns Trọng số xuất hiện tương đối (> 0)
   */
  private getDynamicWeight(shape: Block, emptyCells: number): number {
    const is3x3 = shape.id === 'square_3x3';
    const isLine5 = shape.id.startsWith('line_5');
    const isLargeCorner5 = shape.id.startsWith('corner_5');
    const isLarge = is3x3 || isLine5 || isLargeCorner5;

    const isDot1 = shape.id === 'dot_1';
    const isLine2 = shape.id.startsWith('line_2');
    const isSmallCorner3 = shape.id.startsWith('corner_3');
    const isSmall = isDot1 || isLine2 || isSmallCorner3;

    // =========================================================================
    // TRƯỜNG HỢP 1: Bàn cờ trống nhiều (trống >= 40 ô)
    // Tăng trọng số (weight) xuất hiện của các khối lớn (3x3, thanh 5, L lớn 5 ô)
    // =========================================================================
    if (emptyCells >= 40) {
      if (is3x3) return 35;
      if (isLine5) return 35;
      if (isLargeCorner5) return 30;
      if (isSmall) return 12;
      return 20; // Các khối vừa (line 3, line 4, square 2x2, L 4, T, Z/S)
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: Bàn cờ trung bình (trống từ 20 đến 39 ô)
    // Trọng số phân bổ đều giữa khối vừa và khối nhỏ, giảm nhẹ khối lớn
    // =========================================================================
    if (emptyCells >= 20) {
      if (isSmall) return 30;
      if (!isLarge) return 30; // Khối vừa
      // Khối lớn giảm trọng số
      if (is3x3 || isLine5) return 8;
      return 12;
    }

    // =========================================================================
    // TRƯỜNG HỢP 3: Bàn cờ nguy cấp (trống < 20 ô)
    // Tăng mạnh trọng số các khối nhỏ, linh hoạt (1x1, 1x2, 2x1, corner 3 ô)
    // và giảm tỷ lệ khối 3x3, thanh 5 về mức cực thấp (hầu như không xuất hiện)
    // =========================================================================
    if (isDot1) return 80;            // 1x1 siêu hữu ích để vá lỗ
    if (isLine2) return 65;           // 1x2, 2x1 rất linh hoạt
    if (isSmallCorner3) return 50;    // Corner 3 dễ lách góc
    if (shape.size === 3 || shape.id === 'square_2x2') return 25;
    if (shape.size === 4) return 10;

    // Khối cực lớn (3x3, thanh 5): đưa về mức cực thấp (weight = 1)
    if (is3x3 || isLine5) return 1;
    return 3;
  }

  /**
   * Chọn 1 khối theo phân phối xác suất trọng số ngẫu nhiên
   * Áp dụng luật hạn chế trùng lặp:
   * - Trong 1 lượt 3 khối, không xuất hiện 2 khối 3x3 hoặc 2 khối thanh 5 cùng lúc.
   */
  private pickWeightedBlock(
    candidates: Block[],
    emptyCells: number,
    alreadySelected: Block[]
  ): Block {
    const has3x3 = alreadySelected.some(b => b.id === 'square_3x3');
    const hasLine5 = alreadySelected.some(b => b.id.startsWith('line_5'));

    // Tính toán bảng trọng số cho từng ứng viên
    const weightedPool: { block: Block; weight: number }[] = [];
    let totalWeight = 0;

    for (const block of candidates) {
      let weight = this.getDynamicWeight(block, emptyCells);

      // Luật hạn chế trùng lặp 1: không có 2 khối 3x3 trong 1 lượt
      if (has3x3 && block.id === 'square_3x3') {
        weight = 0;
      }

      // Luật hạn chế trùng lặp 2: không có 2 khối thanh 5 (ngang hoặc dọc) trong 1 lượt
      if (hasLine5 && block.id.startsWith('line_5')) {
        weight = 0;
      }

      // Luật cân bằng bổ sung: không kết hợp cả 3x3 và thanh 5 trong cùng 1 lượt để tránh kẹt chết bàn cờ
      if ((has3x3 && block.id.startsWith('line_5')) || (hasLine5 && block.id === 'square_3x3')) {
        weight = 0;
      }

      if (weight > 0) {
        weightedPool.push({ block, weight });
        totalWeight += weight;
      }
    }

    // Trường hợp dự phòng nếu tất cả weight = 0
    if (totalWeight <= 0 || weightedPool.length === 0) {
      const fallback = candidates.filter(
        b => (!has3x3 || (b.id !== 'square_3x3' && !b.id.startsWith('line_5'))) && (!hasLine5 || (!b.id.startsWith('line_5') && b.id !== 'square_3x3'))
      );
      return fallback[Math.floor(this.rng() * fallback.length)] || candidates[0];
    }

    // Bốc ngẫu nhiên theo tích lũy trọng số
    const randomVal = this.rng() * totalWeight;
    let accumulated = 0;

    for (const item of weightedPool) {
      accumulated += item.weight;
      if (randomVal <= accumulated) {
        return item.block;
      }
    }

    return weightedPool[weightedPool.length - 1].block;
  }

  /**
   * Sinh đợt 3 khối mới (Batch Generation of 3 Blocks) theo trạng thái bàn cờ hiện tại.
   *
   * Quy trình xử lý:
   * 1. Đếm số ô trống để xác định phân vùng trạng thái (Trống nhiều / Trung bình / Nguy cấp).
   * 2. Bốc lần lượt 3 khối theo trọng số động, kiểm soát không trùng 2 khối 3x3 hay 2 khối thanh 5.
   * 3. Kiểm tra Nguyên tắc sống còn (Solvability Guarantee):
   *    Trong bộ 3 khối sinh ra, BẮT BUỘC phải có ít nhất 1 khối đặt vừa vào bàn cờ hiện tại.
   *    Nếu cả 3 khối ngẫu nhiên đều không đặt vừa (bế tắc), thuật toán sẽ thay thế 1 khối
   *    bằng 1 khối hợp lệ có thể đặt được ngay lập tức (ưu tiên khối nhỏ theo trạng thái).
   *
   * @param currentBoardMatrix Ma trận bàn cờ 8x8 (0/1 hoặc GridCell)
   * @returns Mảng đúng 3 khối [Block, Block, Block]
   */
  public generateBlockBatch(currentBoardMatrix: BoardMatrix): Block[] {
    const emptyCells = BlockSpawner.countEmptyCells(currentBoardMatrix);
    const batch: Block[] = [];

    // Bốc 3 khối theo phân bổ trọng số và luật không trùng lặp khối lớn
    for (let i = 0; i < 3; i++) {
      const picked = this.pickWeightedBlock(BLOCK_CATALOG, emptyCells, batch);
      batch.push(picked);
    }

    // =========================================================================
    // NGUYÊN TẮC SỐNG CÒN (SOLVABILITY GUARANTEE)
    // Trong bộ 3 khối được sinh ra, PHẢI có ít nhất 1 khối đặt vừa vào bàn cờ hiện tại.
    // Không bao giờ sinh ra 3 khối mà cả 3 đều không thể đi được ngay lập tức.
    // =========================================================================
    const canAnyFit = batch.some(shape => BlockSpawner.canPlace(currentBoardMatrix, shape));

    if (!canAnyFit && emptyCells > 0) {
      // Tìm tất cả các khối trong kho 35 khối có thể đặt vừa vào bàn cờ hiện tại
      const placeableShapes = BLOCK_CATALOG.filter(shape =>
        BlockSpawner.canPlace(currentBoardMatrix, shape)
      );

      if (placeableShapes.length > 0) {
        // Chọn 1 khối cứu trợ hợp lệ theo trọng số của bàn cờ hiện tại
        const rescueBlock = this.pickWeightedBlock(placeableShapes, emptyCells, batch.slice(0, 2));

        // Tìm vị trí khối có kích thước lớn nhất trong 3 khối không vừa để thay thế
        let replaceIndex = 2;
        let maxSize = -1;
        for (let i = 0; i < batch.length; i++) {
          if (batch[i].size > maxSize) {
            maxSize = batch[i].size;
            replaceIndex = i;
          }
        }

        batch[replaceIndex] = rescueBlock;
      }
    }

    return batch;
  }

  /**
   * Phương thức static tiện lợi để sinh bộ 3 khối trực tiếp không cần khởi tạo class
   */
  public static generateBlockBatch(
    currentBoardMatrix: BoardMatrix,
    rngOrSeed?: (() => number) | number
  ): Block[] {
    const spawner = new BlockSpawner(rngOrSeed);
    return spawner.generateBlockBatch(currentBoardMatrix);
  }
}
