/**
 * Type definitions for "Smash Your Week" Breakout Game
 */

// Re-export analysis types
export interface CalendarEvent {
  id: string;
  x: number; // Relative position (0-1)
  y: number;
  width: number; // Relative size (0-1)
  height: number;
  color: string;
  text: string;
  confidence: number;
}

export interface CalendarGrid {
  days: string[];
  timeRange: {
    start: string;
    end: string;
  };
  columns: number;
  rows: number;
}

export interface AnalysisResult {
  imageWidth: number;
  imageHeight: number;
  imageDataUrl: string;
  calendar: CalendarGrid;
  events: CalendarEvent[];
}

// Game-specific types

export interface Vector2D {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameBlock extends Rectangle {
  id: string;
  color: string;
  text: string;
  health: number; // Hits remaining before destroyed
  maxHealth: number;
  isDestroyed: boolean;
  originalEvent: CalendarEvent;
}

export interface Paddle extends Rectangle {
  speed: number;
  color: string;
}

export interface Ball {
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  speed: number;
  color: string;
  isLaunched: boolean;
}

export interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface GameState {
  status: "idle" | "playing" | "paused" | "won" | "lost";
  score: number;
  lives: number;
  level: number;
  blocksRemaining: number;
  blocksDestroyed: number;
  combo: number;
  maxCombo: number;
}

export interface GameConfig {
  // Canvas
  width: number;
  height: number;

  // Paddle
  paddleWidth: number;
  paddleHeight: number;
  paddleSpeed: number;
  paddleColor: string;
  paddleY: number; // Distance from bottom

  // Ball
  ballRadius: number;
  ballSpeed: number;
  ballColor: string;
  ballSpeedIncrease: number; // Speed increase per block hit

  // Game
  lives: number;
  pointsPerBlock: number;
  comboMultiplier: number;

  // Visual
  enableParticles: boolean;
  enableGlow: boolean;
  enableScreenShake: boolean;
  particleCount: number;

  // Block health based on color brightness
  blockHealthMultiplier: number;
}

export interface LevelData {
  backgroundImage: string; // Data URL or path
  blocks: GameBlock[];
  config?: Partial<GameConfig>;
}

export type GameEventType =
  | "blockDestroyed"
  | "ballLost"
  | "gameWon"
  | "gameLost"
  | "scoreChanged"
  | "livesChanged"
  | "comboChanged";

export interface GameEvent {
  type: GameEventType;
  data?: unknown;
}

export type GameEventCallback = (event: GameEvent) => void;
