/**
 * Main Game Engine for "Smash Your Week"
 *
 * Manages game loop, state, input, and coordinates all systems
 */

import type {
  Ball,
  Paddle,
  GameBlock,
  GameState,
  GameConfig,
  LevelData,
  GameEvent,
  GameEventCallback,
} from "../types";
import { GameRenderer } from "./renderer";
import {
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
import { DEFAULT_CONFIG } from "./level-generator";

/**
 * Main game class
 */
export class BreakoutGame {
  // Core components
  private canvas: HTMLCanvasElement;
  private renderer: GameRenderer;
  private config: GameConfig;

  // Game objects
  private blocks: GameBlock[] = [];
  private paddle: Paddle;
  private ball: Ball;

  // Game state
  private state: GameState;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;

  // Input state
  private inputX: number = 0;
  private keys: Set<string> = new Set();
  private isTouching: boolean = false;

  // Event system
  private eventListeners: Map<string, GameEventCallback[]> = new Map();

  // Combo system
  private comboTimer: number = 0;
  private readonly COMBO_TIMEOUT = 2; // seconds

  constructor(canvas: HTMLCanvasElement, config: Partial<GameConfig> = {}) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize renderer
    this.renderer = new GameRenderer(canvas, this.config);

    // Initialize paddle
    this.paddle = this.createPaddle();

    // Initialize ball
    this.ball = this.createBall();

    // Initialize state
    this.state = this.createInitialState();

    // Set up input handlers
    this.setupInputHandlers();
  }

  /**
   * Create initial paddle
   */
  private createPaddle(): Paddle {
    const { width, height, paddleWidth, paddleHeight, paddleColor, paddleY, paddleSpeed } =
      this.config;

    return {
      x: (width - paddleWidth) / 2,
      y: height - paddleY - paddleHeight,
      width: paddleWidth,
      height: paddleHeight,
      speed: paddleSpeed,
      color: paddleColor,
    };
  }

  /**
   * Create initial ball
   */
  private createBall(): Ball {
    const { ballRadius, ballSpeed, ballColor } = this.config;

    return {
      x: this.paddle.x + this.paddle.width / 2,
      y: this.paddle.y - ballRadius - 2,
      radius: ballRadius,
      velocityX: 0,
      velocityY: 0,
      speed: ballSpeed,
      color: ballColor,
      isLaunched: false,
    };
  }

  /**
   * Create initial game state
   */
  private createInitialState(): GameState {
    return {
      status: "idle",
      score: 0,
      lives: this.config.lives,
      level: 1,
      blocksRemaining: 0,
      blocksDestroyed: 0,
      combo: 0,
      maxCombo: 0,
    };
  }

  /**
   * Load a level
   */
  async loadLevel(levelData: LevelData): Promise<void> {
    console.log("[Game] loadLevel called with", levelData.blocks.length, "blocks");

    // Stop current game loop if running
    this.stop();

    // Update config if provided
    if (levelData.config) {
      this.config = { ...this.config, ...levelData.config };
      this.renderer.resize(this.config.width, this.config.height);
    }

    // Load background
    if (levelData.backgroundImage) {
      await this.renderer.loadBackground(levelData.backgroundImage);
    }

    // Set up blocks
    this.blocks = levelData.blocks.map((block) => ({ ...block }));
    console.log("[Game] Blocks loaded:", this.blocks.length, "isDestroyed counts:", this.blocks.filter(b => b.isDestroyed).length);

    // Reset game objects
    this.paddle = this.createPaddle();
    this.ball = this.createBall();

    // Update state
    this.state = this.createInitialState();
    this.state.blocksRemaining = this.blocks.filter((b) => !b.isDestroyed).length;

    console.log("[Game] State after load:", this.state.status, "blocksRemaining:", this.state.blocksRemaining);

    // Center input
    this.inputX = this.config.width / 2;

    // Start render loop in idle state (shows calendar, waits for user to start)
    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Start the game (transition from idle to playing)
   */
  start(): void {
    if (this.state.status === "playing") return;

    this.state.status = "playing";

    // Start loop if not already running
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.gameLoop();
    }
  }

  /**
   * Pause the game
   */
  pause(): void {
    if (this.state.status !== "playing") return;

    this.state.status = "paused";
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume the game
   */
  resume(): void {
    if (this.state.status !== "paused") return;

    this.state.status = "playing";
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    if (this.state.status === "playing") {
      this.pause();
    } else if (this.state.status === "paused") {
      this.resume();
    }
  }

  /**
   * Reset the game (keep same level)
   */
  reset(): void {
    // Reset blocks
    this.blocks.forEach((block) => {
      block.isDestroyed = false;
      block.health = block.maxHealth;
    });

    // Reset game objects
    this.paddle = this.createPaddle();
    this.ball = this.createBall();

    // Reset state
    this.state = this.createInitialState();
    this.state.blocksRemaining = this.blocks.filter((b) => !b.isDestroyed).length;

    // Clear effects
    this.renderer.getParticleSystem().clear();
    this.renderer.getScreenShake().reset();
  }

  /**
   * Stop the game
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main game loop
   */
  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    // Always update paddle position (allows movement before game starts)
    this.updatePaddleOnly(deltaTime);

    if (this.state.status === "playing") {
      this.update(deltaTime);
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  /**
   * Update paddle position only (used in idle/paused states)
   */
  private updatePaddleOnly(deltaTime: number): void {
    // Handle keyboard input for paddle
    this.handleKeyboardInput(deltaTime);

    // Update paddle position
    updatePaddle(this.paddle, this.inputX, this.config.width, deltaTime);

    // Ball follows paddle when not launched
    if (!this.ball.isLaunched) {
      resetBallToPaddle(this.ball, this.paddle);
    }
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    // Update combo timer
    if (this.state.combo > 0) {
      this.comboTimer -= deltaTime;
      if (this.comboTimer <= 0) {
        this.state.combo = 0;
      }
    }

    // Handle keyboard input
    this.handleKeyboardInput(deltaTime);

    // Update paddle position
    updatePaddle(this.paddle, this.inputX, this.config.width, deltaTime);

    // Update ball position
    if (this.ball.isLaunched) {
      updateBall(this.ball, deltaTime);

      // Handle wall collisions
      if (handleWallCollision(this.ball, this.config.width, this.config.height)) {
        this.renderer.getParticleSystem().createWallBounce(this.ball.x, this.ball.y);
      }

      // Handle paddle collision
      this.handlePaddleCollision();

      // Handle block collisions
      this.handleBlockCollisions();

      // Check if ball is lost
      const outOfBounds = isBallOutOfBounds(
        this.ball,
        this.config.width,
        this.config.height
      );
      if (outOfBounds.out && outOfBounds.side === "bottom") {
        this.handleBallLost();
      }
    } else {
      // Ball follows paddle
      resetBallToPaddle(this.ball, this.paddle);
    }

    // Update renderer (particles, etc.)
    this.renderer.update(deltaTime);

    // Check win condition
    if (this.state.blocksRemaining === 0) {
      this.handleWin();
    }
  }

  /**
   * Handle keyboard movement
   */
  private handleKeyboardInput(deltaTime: number): void {
    const moveAmount = this.config.paddleSpeed * deltaTime;

    if (this.keys.has("ArrowLeft") || this.keys.has("a")) {
      this.inputX = Math.max(
        this.config.paddleWidth / 2,
        this.inputX - moveAmount
      );
    }
    if (this.keys.has("ArrowRight") || this.keys.has("d")) {
      this.inputX = Math.min(
        this.config.width - this.config.paddleWidth / 2,
        this.inputX + moveAmount
      );
    }
  }

  /**
   * Handle paddle collision
   */
  private handlePaddleCollision(): void {
    const collision = ballPaddleCollision(this.ball, this.paddle);

    if (collision.collided) {
      resolveCollision(this.ball, collision);

      // Reflect with angle based on hit position
      const speed = Math.sqrt(
        this.ball.velocityX * this.ball.velocityX +
          this.ball.velocityY * this.ball.velocityY
      );
      this.ball.velocityX = collision.normal.x * speed;
      this.ball.velocityY = collision.normal.y * speed;

      // Ensure ball is moving upward
      if (this.ball.velocityY > 0) {
        this.ball.velocityY = -Math.abs(this.ball.velocityY);
      }

      // Visual effect
      this.renderer
        .getParticleSystem()
        .createPaddleHit(collision.hitPoint.x, collision.hitPoint.y, this.paddle.color);
    }
  }

  /**
   * Handle block collisions
   */
  private handleBlockCollisions(): void {
    for (const block of this.blocks) {
      if (block.isDestroyed) continue;

      const collision = ballRectCollision(this.ball, block);

      if (collision.collided) {
        // Resolve collision
        resolveCollision(this.ball, collision);
        reflectBall(this.ball, collision.normal);

        // Damage block
        block.health--;

        if (block.health <= 0) {
          // Destroy block
          block.isDestroyed = true;
          this.state.blocksRemaining--;
          this.state.blocksDestroyed++;

          // Update combo
          this.state.combo++;
          this.comboTimer = this.COMBO_TIMEOUT;
          this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);

          // Calculate score with combo
          const basePoints = this.config.pointsPerBlock * block.maxHealth;
          const comboBonus = Math.pow(this.config.comboMultiplier, this.state.combo - 1);
          const points = Math.round(basePoints * comboBonus);
          this.state.score += points;

          // Increase ball speed slightly
          increaseBallSpeed(this.ball, this.config.ballSpeedIncrease);

          // Visual effects
          this.renderer.triggerBlockDestruction(block);

          // Emit event
          this.emit({
            type: "blockDestroyed",
            data: { block, points, combo: this.state.combo },
          });
        } else {
          // Block hit but not destroyed
          this.renderer.triggerBlockHit(block, collision.hitPoint);
        }

        // Only handle one collision per frame
        break;
      }
    }
  }

  /**
   * Handle ball lost
   */
  private handleBallLost(): void {
    this.state.lives--;
    this.state.combo = 0;

    this.emit({ type: "ballLost", data: { livesRemaining: this.state.lives } });
    this.emit({ type: "livesChanged", data: { lives: this.state.lives } });

    if (this.state.lives <= 0) {
      this.handleLoss();
    } else {
      // Reset ball to paddle
      resetBallToPaddle(this.ball, this.paddle);
    }
  }

  /**
   * Handle game win
   */
  private handleWin(): void {
    this.state.status = "won";
    this.emit({ type: "gameWon", data: { score: this.state.score } });
  }

  /**
   * Handle game loss
   */
  private handleLoss(): void {
    this.state.status = "lost";
    this.emit({ type: "gameLost", data: { score: this.state.score } });
  }

  /**
   * Render game
   */
  private render(): void {
    switch (this.state.status) {
      case "idle":
        this.renderer.render(this.blocks, this.paddle, this.ball, this.state);
        this.renderer.renderStartScreen();
        break;

      case "playing":
        this.renderer.render(this.blocks, this.paddle, this.ball, this.state);
        break;

      case "paused":
        this.renderer.render(this.blocks, this.paddle, this.ball, this.state);
        this.renderer.renderPauseScreen();
        break;

      case "won":
      case "lost":
        this.renderer.render(this.blocks, this.paddle, this.ball, this.state);
        this.renderer.renderGameOver(this.state, this.state.status === "won");
        break;
    }
  }

  /**
   * Set up input event handlers
   */
  private setupInputHandlers(): void {
    // Mouse movement
    this.canvas.addEventListener("mousemove", this.handleMouseMove);

    // Mouse click
    this.canvas.addEventListener("click", this.handleClick);

    // Touch events
    this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.handleTouchEnd);

    // Keyboard events
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  /**
   * Remove input handlers
   */
  destroy(): void {
    this.stop();

    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchmove", this.handleTouchMove);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  /**
   * Handle mouse movement
   */
  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    this.inputX = (e.clientX - rect.left) * scaleX;
  };

  /**
   * Handle click
   */
  private handleClick = (): void => {
    this.handleAction();
  };

  /**
   * Handle touch start
   */
  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.isTouching = true;

    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.inputX = (e.touches[0].clientX - rect.left) * scaleX;
    }
  };

  /**
   * Handle touch move
   */
  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.inputX = (e.touches[0].clientX - rect.left) * scaleX;
    }
  };

  /**
   * Handle touch end
   */
  private handleTouchEnd = (): void => {
    if (this.isTouching) {
      this.handleAction();
    }
    this.isTouching = false;
  };

  /**
   * Handle key down
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key);

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      this.handleAction();
    }

    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      this.togglePause();
    }
  };

  /**
   * Handle key up
   */
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
  };

  /**
   * Handle action (launch ball, restart, etc.)
   */
  private handleAction(): void {
    switch (this.state.status) {
      case "idle":
        this.start();
        launchBall(this.ball, this.paddle, this.config.ballSpeed);
        break;

      case "playing":
        if (!this.ball.isLaunched) {
          launchBall(this.ball, this.paddle, this.config.ballSpeed);
        }
        break;

      case "won":
      case "lost":
        this.reset();
        this.state.status = "idle";
        break;
    }
  }

  /**
   * Event system: add listener
   */
  on(event: string, callback: GameEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Event system: remove listener
   */
  off(event: string, callback: GameEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Event system: emit event
   */
  private emit(event: GameEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }

    // Also emit to "all" listeners
    const allListeners = this.eventListeners.get("all");
    if (allListeners) {
      allListeners.forEach((callback) => callback(event));
    }
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get current config
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(newConfig: Partial<GameConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default BreakoutGame;
