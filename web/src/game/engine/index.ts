/**
 * "Smash Your Week" Game Engine
 *
 * Export all game components
 */

// Main game class
export { BreakoutGame, default } from "./game";

// Renderer
export { GameRenderer } from "./renderer";

// Level generation
export {
  generateLevel,
  generateLevelFromEvents,
  generateDemoLevel,
  validateLevel,
  DEFAULT_CONFIG,
} from "./level-generator";

// Physics
export {
  ballRectCollision,
  ballPaddleCollision,
  reflectBall,
  resolveCollision,
  handleWallCollision,
  updateBall,
  updatePaddle,
  launchBall,
  resetBallToPaddle,
  increaseBallSpeed,
  isBallOutOfBounds,
} from "./physics";

// Particles and effects
export { ParticleSystem, ScreenShake } from "./particles";

// Power-ups
export { PowerUpManager, POWERUP_CONFIG } from "./powerups";
export type { PowerUp, PowerUpType, ActivePowerUp } from "./powerups";

// Audio
export { AudioManager, audioManager } from "./audio";
export type { SoundType } from "./audio";

// Types (re-export from types folder)
export type {
  CalendarEvent,
  CalendarGrid,
  AnalysisResult,
  Vector2D,
  Rectangle,
  GameBlock,
  Paddle,
  Ball,
  Particle,
  GameState,
  GameConfig,
  LevelData,
  GameEventType,
  GameEvent,
  GameEventCallback,
} from "../types";
