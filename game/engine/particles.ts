/**
 * Particle System for Visual Effects
 *
 * Creates neon arcade-style explosion effects when blocks are destroyed
 */

import type { Particle, GameBlock } from "../types";

/**
 * Particle system manager
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number = 500;

  /**
   * Create explosion particles when a block is destroyed
   */
  createExplosion(
    x: number,
    y: number,
    color: string,
    count: number = 20
  ): void {
    const baseColor = this.hexToRgb(color);
    if (!baseColor) return;

    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;

      // Vary the color slightly
      const colorVariation = 30;
      const r = Math.min(255, Math.max(0, baseColor.r + (Math.random() - 0.5) * colorVariation));
      const g = Math.min(255, Math.max(0, baseColor.g + (Math.random() - 0.5) * colorVariation));
      const b = Math.min(255, Math.max(0, baseColor.b + (Math.random() - 0.5) * colorVariation));

      this.particles.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        color: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
        size: 2 + Math.random() * 4,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        alpha: 1,
      });
    }
  }

  /**
   * Create block destruction effect
   */
  createBlockDestruction(block: GameBlock, particleCount: number = 20): void {
    // Create particles from the center of the block
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;

    // Main explosion
    this.createExplosion(centerX, centerY, block.color, particleCount);

    // Additional particles along the edges
    const edgeParticles = Math.floor(particleCount / 4);
    for (let i = 0; i < edgeParticles; i++) {
      const t = i / edgeParticles;
      // Top and bottom edges
      this.createExplosion(
        block.x + block.width * t,
        block.y,
        block.color,
        2
      );
      this.createExplosion(
        block.x + block.width * t,
        block.y + block.height,
        block.color,
        2
      );
    }
  }

  /**
   * Create hit effect (for multi-hit blocks)
   */
  createHitEffect(block: GameBlock, hitPoint: { x: number; y: number }): void {
    this.createExplosion(hitPoint.x, hitPoint.y, block.color, 8);

    // Add some white sparkles
    this.createExplosion(hitPoint.x, hitPoint.y, "#ffffff", 4);
  }

  /**
   * Create trail effect for ball
   */
  createBallTrail(x: number, y: number, color: string): void {
    if (this.particles.length >= this.maxParticles - 10) return;

    this.particles.push({
      x,
      y,
      velocityX: (Math.random() - 0.5) * 20,
      velocityY: (Math.random() - 0.5) * 20,
      color,
      size: 3 + Math.random() * 2,
      life: 0.2,
      maxLife: 0.2,
      alpha: 0.5,
    });
  }

  /**
   * Create wall bounce effect
   */
  createWallBounce(x: number, y: number): void {
    this.createExplosion(x, y, "#00ffff", 6);
  }

  /**
   * Create paddle hit effect
   */
  createPaddleHit(x: number, y: number, color: string): void {
    this.createExplosion(x, y, color, 10);
    this.createExplosion(x, y, "#ffffff", 5);
  }

  /**
   * Update all particles
   */
  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Update position
      particle.x += particle.velocityX * deltaTime;
      particle.y += particle.velocityY * deltaTime;

      // Apply gravity
      particle.velocityY += 200 * deltaTime;

      // Apply drag
      particle.velocityX *= 0.98;
      particle.velocityY *= 0.98;

      // Update life and alpha
      particle.life -= deltaTime;
      particle.alpha = Math.max(0, particle.life / particle.maxLife);

      // Shrink particle
      particle.size *= 0.99;

      // Remove dead particles
      if (particle.life <= 0 || particle.size < 0.5) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Render all particles
   */
  render(ctx: CanvasRenderingContext2D, enableGlow: boolean = true): void {
    if (this.particles.length === 0) return;

    ctx.save();

    for (const particle of this.particles) {
      ctx.globalAlpha = particle.alpha;

      if (enableGlow) {
        // Glow effect
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = particle.size * 2;
      }

      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Clear all particles
   */
  clear(): void {
    this.particles = [];
  }

  /**
   * Get particle count
   */
  get count(): number {
    return this.particles.length;
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }
}

/**
 * Screen shake effect manager
 */
export class ScreenShake {
  private intensity: number = 0;
  private duration: number = 0;
  private elapsed: number = 0;
  public offsetX: number = 0;
  public offsetY: number = 0;

  /**
   * Trigger screen shake
   */
  shake(intensity: number = 5, duration: number = 0.2): void {
    this.intensity = Math.max(this.intensity, intensity);
    this.duration = Math.max(this.duration, duration);
    this.elapsed = 0;
  }

  /**
   * Update shake effect
   */
  update(deltaTime: number): void {
    if (this.duration <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    this.elapsed += deltaTime;

    if (this.elapsed >= this.duration) {
      this.intensity = 0;
      this.duration = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    // Calculate shake with decay
    const progress = this.elapsed / this.duration;
    const currentIntensity = this.intensity * (1 - progress);

    this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
    this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
  }

  /**
   * Reset shake
   */
  reset(): void {
    this.intensity = 0;
    this.duration = 0;
    this.elapsed = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}

export default ParticleSystem;
