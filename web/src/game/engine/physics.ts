/**
 * Physics and Collision Detection for Breakout Game
 */

import type { Ball, Rectangle, GameBlock, Paddle, Vector2D } from "../types";

/**
 * Collision result with collision point and normal
 */
export interface CollisionResult {
  collided: boolean;
  normal: Vector2D; // Direction to push ball
  penetration: number;
  hitPoint: Vector2D;
  side: "top" | "bottom" | "left" | "right" | "none";
}

/**
 * Check collision between ball and rectangle
 */
export function ballRectCollision(
  ball: Ball,
  rect: Rectangle
): CollisionResult {
  // Find closest point on rectangle to ball center
  const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));

  // Calculate distance
  const distanceX = ball.x - closestX;
  const distanceY = ball.y - closestY;
  const distanceSquared = distanceX * distanceX + distanceY * distanceY;

  // No collision if distance > radius
  if (distanceSquared > ball.radius * ball.radius) {
    return {
      collided: false,
      normal: { x: 0, y: 0 },
      penetration: 0,
      hitPoint: { x: closestX, y: closestY },
      side: "none",
    };
  }

  // Calculate collision normal
  const distance = Math.sqrt(distanceSquared);
  let normalX = 0;
  let normalY = 0;

  if (distance > 0) {
    normalX = distanceX / distance;
    normalY = distanceY / distance;
  } else {
    // Ball center is inside rectangle, push out based on smallest overlap
    const overlapLeft = ball.x + ball.radius - rect.x;
    const overlapRight = rect.x + rect.width - (ball.x - ball.radius);
    const overlapTop = ball.y + ball.radius - rect.y;
    const overlapBottom = rect.y + rect.height - (ball.y - ball.radius);

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapTop) {
      normalY = -1;
    } else if (minOverlap === overlapBottom) {
      normalY = 1;
    } else if (minOverlap === overlapLeft) {
      normalX = -1;
    } else {
      normalX = 1;
    }
  }

  // Determine which side was hit
  let side: "top" | "bottom" | "left" | "right" = "top";
  if (Math.abs(normalY) > Math.abs(normalX)) {
    side = normalY < 0 ? "top" : "bottom";
  } else {
    side = normalX < 0 ? "left" : "right";
  }

  return {
    collided: true,
    normal: { x: normalX, y: normalY },
    penetration: ball.radius - distance,
    hitPoint: { x: closestX, y: closestY },
    side,
  };
}

/**
 * Check collision between ball and paddle with angle reflection
 */
export function ballPaddleCollision(
  ball: Ball,
  paddle: Paddle
): CollisionResult & { reflectionAngle: number } {
  const baseResult = ballRectCollision(ball, paddle);

  if (!baseResult.collided) {
    return { ...baseResult, reflectionAngle: 0 };
  }

  // Calculate reflection angle based on where ball hit paddle
  // Hit left side = angle left, hit right side = angle right
  const paddleCenter = paddle.x + paddle.width / 2;
  const hitOffset = (ball.x - paddleCenter) / (paddle.width / 2);

  // Clamp to [-1, 1] and convert to angle
  // Max angle is about 60 degrees (PI/3) from vertical
  const maxAngle = Math.PI / 3;
  const reflectionAngle = hitOffset * maxAngle;

  // Override normal for paddle collision - always reflect upward with angle
  return {
    ...baseResult,
    normal: {
      x: Math.sin(reflectionAngle),
      y: -Math.cos(reflectionAngle),
    },
    reflectionAngle,
  };
}

/**
 * Reflect ball velocity based on collision normal
 */
export function reflectBall(ball: Ball, normal: Vector2D): void {
  // v' = v - 2(v·n)n
  const dot = ball.velocityX * normal.x + ball.velocityY * normal.y;
  ball.velocityX = ball.velocityX - 2 * dot * normal.x;
  ball.velocityY = ball.velocityY - 2 * dot * normal.y;
}

/**
 * Resolve collision by moving ball out of overlap
 */
export function resolveCollision(ball: Ball, collision: CollisionResult): void {
  if (collision.penetration > 0) {
    ball.x += collision.normal.x * (collision.penetration + 1);
    ball.y += collision.normal.y * (collision.penetration + 1);
  }
}

/**
 * Check if ball is out of bounds
 */
export function isBallOutOfBounds(
  ball: Ball,
  canvasWidth: number,
  canvasHeight: number
): { out: boolean; side: "top" | "bottom" | "left" | "right" | "none" } {
  if (ball.y - ball.radius > canvasHeight) {
    return { out: true, side: "bottom" };
  }
  if (ball.y + ball.radius < 0) {
    return { out: true, side: "top" };
  }
  if (ball.x - ball.radius > canvasWidth) {
    return { out: true, side: "right" };
  }
  if (ball.x + ball.radius < 0) {
    return { out: true, side: "left" };
  }
  return { out: false, side: "none" };
}

/**
 * Handle wall collisions
 */
export function handleWallCollision(
  ball: Ball,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  let collided = false;

  // Left wall
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.velocityX = Math.abs(ball.velocityX);
    collided = true;
  }

  // Right wall
  if (ball.x + ball.radius > canvasWidth) {
    ball.x = canvasWidth - ball.radius;
    ball.velocityX = -Math.abs(ball.velocityX);
    collided = true;
  }

  // Top wall
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.velocityY = Math.abs(ball.velocityY);
    collided = true;
  }

  return collided;
}

/**
 * Update ball position
 */
export function updateBall(ball: Ball, deltaTime: number): void {
  if (!ball.isLaunched) return;

  ball.x += ball.velocityX * deltaTime;
  ball.y += ball.velocityY * deltaTime;
}

/**
 * Update paddle position with bounds checking
 * Paddle follows mouse/touch instantly for responsive controls
 */
export function updatePaddle(
  paddle: Paddle,
  targetX: number,
  canvasWidth: number,
  _deltaTime: number
): void {
  // Calculate desired position (centered on target)
  const desiredX = targetX - paddle.width / 2;

  // Instant follow - paddle moves directly to target position
  paddle.x = desiredX;

  // Clamp to bounds
  paddle.x = Math.max(0, Math.min(canvasWidth - paddle.width, paddle.x));
}

/**
 * Launch ball from paddle
 */
export function launchBall(ball: Ball, paddle: Paddle, speed: number): void {
  if (ball.isLaunched) return;

  ball.isLaunched = true;

  // Random angle between -30 and 30 degrees from vertical
  const angle = (Math.random() - 0.5) * (Math.PI / 3);

  ball.velocityX = Math.sin(angle) * speed;
  ball.velocityY = -Math.cos(angle) * speed;
}

/**
 * Reset ball to paddle
 */
export function resetBallToPaddle(ball: Ball, paddle: Paddle): void {
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius - 2;
  ball.velocityX = 0;
  ball.velocityY = 0;
  ball.isLaunched = false;
}

/**
 * Increase ball speed
 */
export function increaseBallSpeed(ball: Ball, amount: number): void {
  const currentSpeed = Math.sqrt(
    ball.velocityX * ball.velocityX + ball.velocityY * ball.velocityY
  );
  const newSpeed = currentSpeed + amount;
  const ratio = newSpeed / currentSpeed;

  ball.velocityX *= ratio;
  ball.velocityY *= ratio;
  ball.speed = newSpeed;
}
