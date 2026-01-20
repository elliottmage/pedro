/**
 * Power-up System for "Smash Your Week"
 *
 * Power-ups drop from destroyed blocks and provide temporary bonuses
 */

import type { Rectangle, Ball, Paddle } from "../types";

export type PowerUpType =
  | "wider_paddle"    // Increases paddle width
  | "multi_ball"      // Spawns extra balls
  | "slow_motion"     // Slows ball speed
  | "extra_life"      // Adds a life
  | "fireball"        // Ball passes through blocks
  | "magnet";         // Ball sticks to paddle

export interface PowerUp extends Rectangle {
  id: string;
  type: PowerUpType;
  color: string;
  icon: string;
  velocityY: number;
  isCollected: boolean;
}

export interface ActivePowerUp {
  type: PowerUpType;
  duration: number;
  remaining: number;
}

// Power-up configuration
export const POWERUP_CONFIG: Record<PowerUpType, {
  color: string;
  icon: string;
  duration: number; // seconds, 0 = instant
  dropChance: number; // 0-1
  description: string;
}> = {
  wider_paddle: {
    color: "#00ff00",
    icon: "↔",
    duration: 15,
    dropChance: 0.15,
    description: "Wider Paddle",
  },
  multi_ball: {
    color: "#ff00ff",
    icon: "◉",
    duration: 0,
    dropChance: 0.08,
    description: "Multi Ball",
  },
  slow_motion: {
    color: "#00ffff",
    icon: "⏱",
    duration: 10,
    dropChance: 0.12,
    description: "Slow Motion",
  },
  extra_life: {
    color: "#ff6b6b",
    icon: "♥",
    duration: 0,
    dropChance: 0.05,
    description: "Extra Life",
  },
  fireball: {
    color: "#ff8c00",
    icon: "🔥",
    duration: 8,
    dropChance: 0.10,
    description: "Fireball",
  },
  magnet: {
    color: "#9c27b0",
    icon: "🧲",
    duration: 12,
    dropChance: 0.10,
    description: "Magnet Paddle",
  },
};

/**
 * Power-up manager class
 */
export class PowerUpManager {
  private powerUps: PowerUp[] = [];
  private activePowerUps: Map<PowerUpType, ActivePowerUp> = new Map();
  private readonly fallSpeed = 150;
  private readonly size = 24;

  // Callbacks for power-up effects
  public onExtraLife?: () => void;
  public onMultiBall?: (ball: Ball) => Ball[];

  /**
   * Maybe spawn a power-up from a destroyed block
   */
  maybeSpawnPowerUp(x: number, y: number): PowerUp | null {
    // Calculate total drop chance
    const types = Object.entries(POWERUP_CONFIG);
    const roll = Math.random();

    let cumulative = 0;
    for (const [type, config] of types) {
      cumulative += config.dropChance;
      if (roll < cumulative) {
        return this.spawnPowerUp(type as PowerUpType, x, y);
      }
    }

    return null;
  }

  /**
   * Spawn a specific power-up
   */
  spawnPowerUp(type: PowerUpType, x: number, y: number): PowerUp {
    const config = POWERUP_CONFIG[type];

    const powerUp: PowerUp = {
      id: `powerup-${Date.now()}-${Math.random()}`,
      type,
      x: x - this.size / 2,
      y,
      width: this.size,
      height: this.size,
      color: config.color,
      icon: config.icon,
      velocityY: this.fallSpeed,
      isCollected: false,
    };

    this.powerUps.push(powerUp);
    return powerUp;
  }

  /**
   * Update power-ups (movement and expiration)
   */
  update(deltaTime: number, paddle: Paddle, canvasHeight: number): PowerUp[] {
    const collectedPowerUps: PowerUp[] = [];

    // Update falling power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];

      // Move down
      powerUp.y += powerUp.velocityY * deltaTime;

      // Check collision with paddle
      if (this.checkPaddleCollision(powerUp, paddle)) {
        powerUp.isCollected = true;
        collectedPowerUps.push(powerUp);
        this.activatePowerUp(powerUp.type);
        this.powerUps.splice(i, 1);
        continue;
      }

      // Remove if off screen
      if (powerUp.y > canvasHeight) {
        this.powerUps.splice(i, 1);
      }
    }

    // Update active power-up durations
    for (const [type, active] of this.activePowerUps) {
      if (active.duration > 0) {
        active.remaining -= deltaTime;
        if (active.remaining <= 0) {
          this.deactivatePowerUp(type);
        }
      }
    }

    return collectedPowerUps;
  }

  /**
   * Check collision with paddle
   */
  private checkPaddleCollision(powerUp: PowerUp, paddle: Paddle): boolean {
    return (
      powerUp.x < paddle.x + paddle.width &&
      powerUp.x + powerUp.width > paddle.x &&
      powerUp.y < paddle.y + paddle.height &&
      powerUp.y + powerUp.height > paddle.y
    );
  }

  /**
   * Activate a power-up
   */
  private activatePowerUp(type: PowerUpType): void {
    const config = POWERUP_CONFIG[type];

    if (config.duration > 0) {
      // Timed power-up
      this.activePowerUps.set(type, {
        type,
        duration: config.duration,
        remaining: config.duration,
      });
    } else {
      // Instant power-up
      if (type === "extra_life") {
        this.onExtraLife?.();
      }
      // multi_ball is handled externally via getEffects()
    }
  }

  /**
   * Deactivate a power-up
   */
  private deactivatePowerUp(type: PowerUpType): void {
    this.activePowerUps.delete(type);
  }

  /**
   * Check if a power-up is active
   */
  isActive(type: PowerUpType): boolean {
    return this.activePowerUps.has(type);
  }

  /**
   * Get remaining time for a power-up
   */
  getRemainingTime(type: PowerUpType): number {
    return this.activePowerUps.get(type)?.remaining ?? 0;
  }

  /**
   * Get current effects to apply to game
   */
  getEffects(): {
    paddleWidthMultiplier: number;
    ballSpeedMultiplier: number;
    isFireball: boolean;
    isMagnet: boolean;
  } {
    return {
      paddleWidthMultiplier: this.isActive("wider_paddle") ? 1.5 : 1,
      ballSpeedMultiplier: this.isActive("slow_motion") ? 0.6 : 1,
      isFireball: this.isActive("fireball"),
      isMagnet: this.isActive("magnet"),
    };
  }

  /**
   * Get all falling power-ups for rendering
   */
  getPowerUps(): PowerUp[] {
    return this.powerUps;
  }

  /**
   * Get all active power-ups for UI display
   */
  getActivePowerUps(): ActivePowerUp[] {
    return Array.from(this.activePowerUps.values());
  }

  /**
   * Clear all power-ups (on reset)
   */
  clear(): void {
    this.powerUps = [];
    this.activePowerUps.clear();
  }

  /**
   * Render power-ups
   */
  render(ctx: CanvasRenderingContext2D, enableGlow: boolean): void {
    for (const powerUp of this.powerUps) {
      ctx.save();

      // Glow effect
      if (enableGlow) {
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 15;
      }

      // Background circle
      ctx.fillStyle = powerUp.color + "40";
      ctx.beginPath();
      ctx.arc(
        powerUp.x + powerUp.width / 2,
        powerUp.y + powerUp.height / 2,
        powerUp.width / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Border
      ctx.strokeStyle = powerUp.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.fillStyle = powerUp.color;
      ctx.font = `bold ${powerUp.width * 0.6}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        powerUp.icon,
        powerUp.x + powerUp.width / 2,
        powerUp.y + powerUp.height / 2
      );

      ctx.restore();
    }
  }
}

export default PowerUpManager;
