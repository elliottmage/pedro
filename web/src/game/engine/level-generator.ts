/**
 * Level Generator for "Smash Your Week" Game
 *
 * Converts analysis JSON to game blocks with proper positioning
 */

import type {
  AnalysisResult,
  CalendarEvent,
  GameBlock,
  LevelData,
  GameConfig,
} from "../types";

/**
 * Default game configuration
 */
export const DEFAULT_CONFIG: GameConfig = {
  // Canvas (will be set based on container)
  width: 800,
  height: 600,

  // Paddle
  paddleWidth: 120,
  paddleHeight: 16,
  paddleSpeed: 600,
  paddleColor: "#00ffff",
  paddleY: 40,

  // Ball
  ballRadius: 10,
  ballSpeed: 400,
  ballColor: "#bf00ff", // Neon violet
  ballSpeedIncrease: 10,

  // Game
  lives: 3,
  pointsPerBlock: 100,
  comboMultiplier: 1.5,

  // Visual
  enableParticles: true,
  enableGlow: true,
  enableScreenShake: true,
  particleCount: 20,

  // Block health
  blockHealthMultiplier: 1,
};

/**
 * Calculate block health based on color (darker = stronger)
 */
function calculateBlockHealth(color: string, multiplier: number = 1): number {
  // Parse hex color
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate brightness (0-255)
  const brightness = (r + g + b) / 3;

  // Darker colors = more health (1-3 hits)
  if (brightness < 100) {
    return Math.ceil(3 * multiplier);
  } else if (brightness < 170) {
    return Math.ceil(2 * multiplier);
  }
  return Math.ceil(1 * multiplier);
}

/**
 * Convert a calendar event to a game block
 */
function eventToBlock(
  event: CalendarEvent,
  canvasWidth: number,
  canvasHeight: number,
  healthMultiplier: number
): GameBlock {
  return {
    id: event.id,
    // Convert relative coordinates to absolute pixels
    x: event.x * canvasWidth,
    y: event.y * canvasHeight,
    width: event.width * canvasWidth,
    height: event.height * canvasHeight,
    color: event.color,
    text: event.text,
    health: calculateBlockHealth(event.color, healthMultiplier),
    maxHealth: calculateBlockHealth(event.color, healthMultiplier),
    isDestroyed: false,
    originalEvent: event,
  };
}

/**
 * Generate a game level from analysis result
 */
export function generateLevel(
  analysis: AnalysisResult,
  config: Partial<GameConfig> = {}
): LevelData {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Use exact image dimensions - no scaling, no deformation
  const canvasWidth = analysis.imageWidth;
  const canvasHeight = analysis.imageHeight;

  // Update config with exact image dimensions
  mergedConfig.width = canvasWidth;
  mergedConfig.height = canvasHeight;

  // Convert events to blocks
  const blocks: GameBlock[] = analysis.events.map((event) =>
    eventToBlock(
      event,
      canvasWidth,
      canvasHeight,
      mergedConfig.blockHealthMultiplier
    )
  );

  // Filter out any blocks that are too small to be playable
  const MIN_BLOCK_SIZE = 20;
  const validBlocks = blocks.filter(
    (block) => block.width >= MIN_BLOCK_SIZE && block.height >= MIN_BLOCK_SIZE
  );

  return {
    backgroundImage: analysis.imageDataUrl,
    blocks: validBlocks,
    config: mergedConfig,
  };
}

/**
 * Generate a level directly from events (without full analysis)
 */
export function generateLevelFromEvents(
  events: CalendarEvent[],
  backgroundImage: string,
  imageWidth: number,
  imageHeight: number,
  config: Partial<GameConfig> = {}
): LevelData {
  const analysis: AnalysisResult = {
    imageWidth,
    imageHeight,
    imageDataUrl: backgroundImage,
    calendar: {
      days: [],
      timeRange: { start: "00:00", end: "24:00" },
      columns: 7,
      rows: 24,
    },
    events,
  };

  return generateLevel(analysis, config);
}

/**
 * Create a demo level with predefined blocks (for testing)
 */
export function generateDemoLevel(
  canvasWidth: number = 800,
  canvasHeight: number = 600
): LevelData {
  const colors = [
    "#4285f4",
    "#ea4335",
    "#34a853",
    "#fbbc04",
    "#9c27b0",
    "#00acc1",
    "#ff7043",
  ];
  const texts = [
    "Team Standup",
    "Code Review",
    "Client Call",
    "Lunch",
    "Sprint Planning",
    "Design Review",
    "Deploy",
  ];

  const events: CalendarEvent[] = [];
  const cols = 5;
  const rows = 4;
  const blockWidth = 0.15;
  const blockHeight = 0.06;
  const startX = 0.1;
  const startY = 0.1;
  const gapX = 0.02;
  const gapY = 0.02;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      events.push({
        id: `demo-${idx}`,
        x: startX + col * (blockWidth + gapX),
        y: startY + row * (blockHeight + gapY),
        width: blockWidth,
        height: blockHeight,
        color: colors[idx % colors.length],
        text: texts[idx % texts.length],
        confidence: 1,
      });
    }
  }

  // Create a simple gradient background
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Grid pattern
    ctx.strokeStyle = "#ffffff10";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < canvasWidth; x += canvasWidth / 7) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < canvasHeight; y += canvasHeight / 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  return generateLevelFromEvents(
    events,
    canvas.toDataURL(),
    canvasWidth,
    canvasHeight
  );
}

/**
 * Validate level data
 */
export function validateLevel(level: LevelData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!level.backgroundImage) {
    errors.push("Missing background image");
  }

  if (!level.blocks || level.blocks.length === 0) {
    errors.push("No blocks in level");
  }

  // Check for overlapping blocks
  for (let i = 0; i < level.blocks.length; i++) {
    const blockA = level.blocks[i];

    // Check bounds
    if (
      blockA.x < 0 ||
      blockA.y < 0 ||
      blockA.x + blockA.width > (level.config?.width || 800) ||
      blockA.y + blockA.height > (level.config?.height || 600)
    ) {
      errors.push(`Block ${blockA.id} is out of bounds`);
    }

    // Check for significant overlaps
    for (let j = i + 1; j < level.blocks.length; j++) {
      const blockB = level.blocks[j];
      const overlapX = Math.max(
        0,
        Math.min(blockA.x + blockA.width, blockB.x + blockB.width) -
          Math.max(blockA.x, blockB.x)
      );
      const overlapY = Math.max(
        0,
        Math.min(blockA.y + blockA.height, blockB.y + blockB.height) -
          Math.max(blockA.y, blockB.y)
      );
      const overlapArea = overlapX * overlapY;
      const blockAArea = blockA.width * blockA.height;

      if (overlapArea > blockAArea * 0.5) {
        errors.push(`Blocks ${blockA.id} and ${blockB.id} significantly overlap`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default generateLevel;
