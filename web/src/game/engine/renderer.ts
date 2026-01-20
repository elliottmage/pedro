/**
 * Renderer for "Smash Your Week" Game
 *
 * Handles all canvas rendering with neon arcade aesthetic
 * Layer structure:
 *   Layer 0: Background (calendar screenshot)
 *   Layer 1: Blocks (interactive events)
 *   Layer 2: Paddle + Ball
 *   Layer 3: Particles + Effects
 *   Layer 4: UI Overlay
 */

import type { Ball, Paddle, GameBlock, GameState, GameConfig } from "../types";
import { ParticleSystem, ScreenShake } from "./particles";

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  backgroundImage: HTMLImageElement | null;
  config: GameConfig;
}

/**
 * Main game renderer
 */
export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private backgroundImage: HTMLImageElement | null = null;
  private config: GameConfig;
  private particleSystem: ParticleSystem;
  private screenShake: ScreenShake;

  // Animation state
  private blockAnimations: Map<string, { scale: number; alpha: number }> = new Map();

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas 2D context");
    }
    this.ctx = ctx;
    this.config = config;
    this.particleSystem = new ParticleSystem();
    this.screenShake = new ScreenShake();

    // Set canvas size
    this.resize(config.width, config.height);
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.config.width = width;
    this.config.height = height;
  }

  /**
   * Load background image
   */
  async loadBackground(imageSource: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.backgroundImage = img;
        resolve();
      };
      img.onerror = () => reject(new Error("Failed to load background image"));
      img.src = imageSource;
    });
  }

  /**
   * Get particle system for external use
   */
  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  /**
   * Get screen shake for external use
   */
  getScreenShake(): ScreenShake {
    return this.screenShake;
  }

  /**
   * Update animations
   */
  update(deltaTime: number): void {
    this.particleSystem.update(deltaTime);
    this.screenShake.update(deltaTime);

    // Update block animations
    for (const [id, anim] of this.blockAnimations) {
      anim.alpha -= deltaTime * 3;
      anim.scale += deltaTime * 2;
      if (anim.alpha <= 0) {
        this.blockAnimations.delete(id);
      }
    }
  }

  /**
   * Main render function
   */
  render(
    blocks: GameBlock[],
    paddle: Paddle,
    ball: Ball,
    gameState: GameState
  ): void {
    const ctx = this.ctx;
    const { width, height } = this.config;

    ctx.save();

    // Apply screen shake
    ctx.translate(this.screenShake.offsetX, this.screenShake.offsetY);

    // Clear canvas
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(-10, -10, width + 20, height + 20);

    // Layer 0: Background
    this.renderBackground();

    // Layer 0.5: Mask destroyed blocks (hide calendar events that were smashed)
    this.renderDestroyedBlockMasks(blocks);

    // Layer 1: Blocks
    this.renderBlocks(blocks);

    // Layer 2: Paddle + Ball
    this.renderPaddle(paddle);
    this.renderBall(ball);

    // Layer 3: Particles
    this.particleSystem.render(ctx, this.config.enableGlow);

    // Restore before UI (no shake on UI)
    ctx.restore();

    // Layer 4: UI Overlay
    this.renderUI(gameState);
  }

  /**
   * Render background (Layer 0)
   */
  private renderBackground(): void {
    const ctx = this.ctx;
    const { width, height } = this.config;

    if (this.backgroundImage) {
      // Draw the calendar screenshot
      ctx.globalAlpha = 0.9; // Slightly dim for better contrast
      ctx.drawImage(this.backgroundImage, 0, 0, width, height);
      ctx.globalAlpha = 1;

      // Add slight vignette effect
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        height * 0.3,
        width / 2,
        height / 2,
        height * 0.8
      );
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Fallback gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#1a1a2e");
      gradient.addColorStop(1, "#16213e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Grid pattern
      ctx.strokeStyle = "#ffffff08";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += width / 7) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += height / 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }

  /**
   * Render masks over destroyed blocks to hide background calendar events
   */
  private renderDestroyedBlockMasks(blocks: GameBlock[]): void {
    const ctx = this.ctx;

    for (const block of blocks) {
      if (block.isDestroyed) {
        // Draw white/light rectangle to show calendar background
        ctx.fillStyle = "#ffffff"; // Calendar background is typically white
        ctx.fillRect(
          block.x - 2,
          block.y - 2,
          block.width + 4,
          block.height + 4
        );
      }
    }
  }

  /**
   * Render blocks (Layer 1)
   */
  private renderBlocks(blocks: GameBlock[]): void {
    const ctx = this.ctx;

    for (const block of blocks) {
      if (block.isDestroyed) {
        // Render destruction animation if active
        const anim = this.blockAnimations.get(block.id);
        if (anim) {
          this.renderBlockExplosion(block, anim);
        }
        continue;
      }

      this.renderBlock(block);
    }
  }

  /**
   * Render a single block showing the actual calendar content
   */
  private renderBlock(block: GameBlock): void {
    const ctx = this.ctx;
    const { x, y, width, height, color } = block;

    ctx.save();

    // Glow effect
    if (this.config.enableGlow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }

    // Draw the actual calendar image portion as the block content
    if (this.backgroundImage) {
      // Calculate source coordinates from the original image
      const scaleX = this.backgroundImage.width / this.config.width;
      const scaleY = this.backgroundImage.height / this.config.height;

      const srcX = x * scaleX;
      const srcY = y * scaleY;
      const srcW = width * scaleX;
      const srcH = height * scaleY;

      // Clip to rounded rectangle
      ctx.beginPath();
      this.roundRect(x, y, width, height, 4);
      ctx.clip();

      // Draw the portion of the background image
      ctx.drawImage(
        this.backgroundImage,
        srcX, srcY, srcW, srcH,  // Source rectangle
        x, y, width, height      // Destination rectangle
      );

      ctx.restore();
      ctx.save();
    }

    // Health indicator (darker overlay for damaged blocks)
    if (block.health < block.maxHealth) {
      const damageRatio = 1 - block.health / block.maxHealth;
      ctx.fillStyle = `rgba(0, 0, 0, ${damageRatio * 0.4})`;
      ctx.beginPath();
      this.roundRect(x, y, width, height, 4);
      ctx.fill();

      // Crack effect for damaged blocks
      this.renderCracks(block, damageRatio);
    }

    // Neon border for interactivity feedback
    if (this.config.enableGlow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = this.lightenColor(color, 60);
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.roundRect(x, y, width, height, 4);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render cracks on damaged blocks
   */
  private renderCracks(block: GameBlock, damageRatio: number): void {
    const ctx = this.ctx;
    const { x, y, width, height } = block;

    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 1;

    // Number of cracks based on damage
    const numCracks = Math.ceil(damageRatio * 3);
    const seed = block.id.charCodeAt(0); // Consistent cracks per block

    for (let i = 0; i < numCracks; i++) {
      const startX = x + (((seed * (i + 1)) % 100) / 100) * width;
      const startY = y + (((seed * (i + 2)) % 100) / 100) * height;

      ctx.beginPath();
      ctx.moveTo(startX, startY);

      // Random crack path
      let cx = startX;
      let cy = startY;
      for (let j = 0; j < 3; j++) {
        cx += (Math.random() - 0.5) * width * 0.3;
        cy += (Math.random() - 0.5) * height * 0.3;
        ctx.lineTo(
          Math.max(x, Math.min(x + width, cx)),
          Math.max(y, Math.min(y + height, cy))
        );
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render block explosion animation
   */
  private renderBlockExplosion(
    block: GameBlock,
    anim: { scale: number; alpha: number }
  ): void {
    const ctx = this.ctx;
    const { x, y, width, height, color } = block;
    const cx = x + width / 2;
    const cy = y + height / 2;

    ctx.save();
    ctx.globalAlpha = anim.alpha;
    ctx.translate(cx, cy);
    ctx.scale(anim.scale, anim.scale);
    ctx.translate(-cx, -cy);

    if (this.config.enableGlow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 30 * anim.scale;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    this.roundRect(x, y, width, height, 4);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Trigger block destruction animation
   */
  triggerBlockDestruction(block: GameBlock): void {
    this.blockAnimations.set(block.id, { scale: 1, alpha: 1 });

    if (this.config.enableParticles) {
      this.particleSystem.createBlockDestruction(block, this.config.particleCount);
    }

    if (this.config.enableScreenShake) {
      this.screenShake.shake(3, 0.1);
    }
  }

  /**
   * Trigger block hit effect
   */
  triggerBlockHit(block: GameBlock, hitPoint: { x: number; y: number }): void {
    if (this.config.enableParticles) {
      this.particleSystem.createHitEffect(block, hitPoint);
    }

    if (this.config.enableScreenShake) {
      this.screenShake.shake(2, 0.05);
    }
  }

  /**
   * Render paddle
   */
  private renderPaddle(paddle: Paddle): void {
    const ctx = this.ctx;
    const { x, y, width, height, color } = paddle;

    ctx.save();

    // Glow
    if (this.config.enableGlow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
    }

    // Main paddle body
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(color, 30));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 20));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    this.roundRect(x, y, width, height, height / 2);
    ctx.fill();

    // Highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.roundRect(x + 2, y + 2, width - 4, height / 2 - 2, height / 4);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render ball
   */
  private renderBall(ball: Ball): void {
    const ctx = this.ctx;
    const { x, y, radius, color, isLaunched } = ball;

    ctx.save();

    // Trail effect
    if (isLaunched && this.config.enableParticles) {
      this.particleSystem.createBallTrail(x, y, color);
    }

    // Glow
    if (this.config.enableGlow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 25;
    }

    // Ball body
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, this.lightenColor(color, 40));
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow ring
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render UI overlay
   */
  private renderUI(gameState: GameState): void {
    const ctx = this.ctx;
    const { width } = this.config;

    // Score display (top-left)
    ctx.save();
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillStyle = "#00ffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    if (this.config.enableGlow) {
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 10;
    }

    ctx.fillText(`SCORE: ${gameState.score.toLocaleString()}`, 20, 20);

    // Lives display (top-right)
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff6b6b";
    if (this.config.enableGlow) {
      ctx.shadowColor = "#ff6b6b";
    }

    const livesText = "♥".repeat(gameState.lives);
    ctx.fillText(livesText, width - 20, 20);

    // Combo display (if active)
    if (gameState.combo > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffeb3b";
      if (this.config.enableGlow) {
        ctx.shadowColor = "#ffeb3b";
      }
      ctx.font = "bold 18px 'Courier New', monospace";
      ctx.fillText(`COMBO x${gameState.combo}`, width / 2, 20);
    }

    // Blocks remaining (small text)
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = "#888888";
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    ctx.fillText(`Blocks: ${gameState.blocksRemaining}`, 20, 50);

    ctx.restore();
  }

  /**
   * Render game over screen
   */
  renderGameOver(gameState: GameState, won: boolean): void {
    const ctx = this.ctx;
    const { width, height } = this.config;

    // Darken background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Main text
    ctx.font = "bold 48px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (won) {
      ctx.fillStyle = "#00ff00";
      if (this.config.enableGlow) {
        ctx.shadowColor = "#00ff00";
        ctx.shadowBlur = 20;
      }
      ctx.fillText("WEEK SMASHED!", width / 2, height / 2 - 40);
    } else {
      ctx.fillStyle = "#ff0000";
      if (this.config.enableGlow) {
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 20;
      }
      ctx.fillText("GAME OVER", width / 2, height / 2 - 40);
    }

    // Score
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillText(
      `Final Score: ${gameState.score.toLocaleString()}`,
      width / 2,
      height / 2 + 20
    );

    // Stats
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillStyle = "#aaaaaa";
    ctx.shadowBlur = 0;
    ctx.fillText(
      `Blocks Destroyed: ${gameState.blocksDestroyed} | Max Combo: ${gameState.maxCombo}`,
      width / 2,
      height / 2 + 60
    );

    // Restart prompt
    ctx.font = "20px 'Courier New', monospace";
    ctx.fillStyle = "#00ffff";
    ctx.fillText("Press SPACE or Click to Restart", width / 2, height / 2 + 110);

    ctx.restore();
  }

  /**
   * Render start screen
   */
  renderStartScreen(): void {
    const ctx = this.ctx;
    const { width, height } = this.config;

    ctx.save();

    // Title
    ctx.font = "bold 42px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#00ffff";

    if (this.config.enableGlow) {
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 20;
    }

    ctx.fillText("SMASH YOUR WEEK", width / 2, height / 2 - 60);

    // Subtitle
    ctx.font = "24px 'Courier New', monospace";
    ctx.fillStyle = "#ff6b6b";
    ctx.shadowColor = "#ff6b6b";
    ctx.fillText("Breakout meets Calendar", width / 2, height / 2 - 10);

    // Instructions
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 5;
    ctx.fillText("Move: Mouse / Arrow Keys / Touch", width / 2, height / 2 + 40);
    ctx.fillText("Launch: Space / Click / Tap", width / 2, height / 2 + 70);

    // Start prompt
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.fillStyle = "#ffeb3b";
    ctx.shadowColor = "#ffeb3b";
    ctx.shadowBlur = 15;

    // Pulsing effect
    const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.5;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillText("Press SPACE or Click to Start", width / 2, height / 2 + 130);

    ctx.restore();
  }

  /**
   * Render pause screen
   */
  renderPauseScreen(): void {
    const ctx = this.ctx;
    const { width, height } = this.config;

    // Darken background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    ctx.font = "bold 48px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffeb3b";

    if (this.config.enableGlow) {
      ctx.shadowColor = "#ffeb3b";
      ctx.shadowBlur = 20;
    }

    ctx.fillText("PAUSED", width / 2, height / 2);

    ctx.font = "20px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 5;
    ctx.fillText("Press P or ESC to Resume", width / 2, height / 2 + 50);

    ctx.restore();
  }

  /**
   * Helper: Draw rounded rectangle
   */
  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const ctx = this.ctx;
    radius = Math.min(radius, width / 2, height / 2);

    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Helper: Lighten a hex color
   */
  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  /**
   * Helper: Darken a hex color
   */
  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  /**
   * Helper: Get contrasting text color
   */
  private getTextColor(bgColor: string): string {
    const num = parseInt(bgColor.replace("#", ""), 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00ff;
    const b = num & 0x0000ff;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? "#000000" : "#ffffff";
  }
}

export default GameRenderer;
