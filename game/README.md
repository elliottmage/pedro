# "Smash Your Week" Game Engine

A Breakout-style game engine that converts calendar screenshots into playable levels.

## Architecture

```
game/
├── engine/
│   ├── game.ts           # Main game class (loop, state, input)
│   ├── renderer.ts       # Canvas rendering with neon effects
│   ├── physics.ts        # Collision detection and physics
│   ├── particles.ts      # Particle system for visual effects
│   ├── level-generator.ts # Converts JSON to game blocks
│   └── index.ts          # Exports
└── types/
    └── index.ts          # TypeScript type definitions
```

## Canvas Layers

The game uses a layered rendering approach:

1. **Layer 0 - Background**: Original calendar screenshot (dimmed)
2. **Layer 1 - Blocks**: Interactive calendar events (neon styled)
3. **Layer 2 - Gameplay**: Paddle and ball
4. **Layer 3 - Effects**: Particles, explosions, trails
5. **Layer 4 - UI**: Score, lives, combo display

## Usage

### Basic Setup

```typescript
import { BreakoutGame, generateLevel } from './game/engine';
import { analyzeCalendar } from './analysis/web/calendar-analyzer';

// Get canvas element
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

// Create game instance
const game = new BreakoutGame(canvas, {
  width: 800,
  height: 600,
  enableParticles: true,
  enableGlow: true,
});

// Load a calendar screenshot
const analysis = await analyzeCalendar(screenshotFile);
const level = generateLevel(analysis);

// Load level and start
await game.loadLevel(level);
game.start();
```

### Demo Mode

```typescript
import { BreakoutGame, generateDemoLevel } from './game/engine';

const canvas = document.getElementById('gameCanvas');
const game = new BreakoutGame(canvas);

// Load demo level (no screenshot needed)
const demoLevel = generateDemoLevel(800, 600);
await game.loadLevel(demoLevel);
game.start();
```

### Event Handling

```typescript
game.on('blockDestroyed', (event) => {
  console.log(`Block destroyed! +${event.data.points} points`);
  console.log(`Combo: x${event.data.combo}`);
});

game.on('gameWon', (event) => {
  console.log(`You won! Final score: ${event.data.score}`);
});

game.on('gameLost', (event) => {
  console.log(`Game over! Final score: ${event.data.score}`);
});
```

## Controls

| Input | Action |
|-------|--------|
| Mouse | Move paddle |
| Arrow Keys / A/D | Move paddle |
| Space / Click | Launch ball / Restart |
| P / Escape | Pause/Resume |
| Touch | Move paddle + Launch |

## Game Mechanics

### Blocks

- Each calendar event becomes a destructible block
- Block health based on color darkness (darker = stronger)
- Multi-hit blocks show crack effects
- Blocks inherit color, position, and text from calendar events

### Scoring

- Base points per block: 100 × block health
- Combo multiplier: 1.5× per consecutive hit
- Combo resets after 2 seconds without hitting a block

### Ball Physics

- Bounces off walls (top, left, right)
- Reflects off paddle based on hit position
- Speed increases slightly with each block destroyed
- Lost when falling below paddle

## Configuration

```typescript
const config: Partial<GameConfig> = {
  // Canvas
  width: 800,
  height: 600,

  // Paddle
  paddleWidth: 120,
  paddleHeight: 16,
  paddleSpeed: 600,
  paddleColor: '#00ffff',

  // Ball
  ballRadius: 10,
  ballSpeed: 400,
  ballColor: '#ffffff',

  // Game
  lives: 3,
  pointsPerBlock: 100,
  comboMultiplier: 1.5,

  // Visual effects
  enableParticles: true,
  enableGlow: true,
  enableScreenShake: true,
  particleCount: 20,
};
```

## Visual Effects

- **Neon glow**: Blocks, paddle, and ball have CSS-like glow effects
- **Particles**: Explosions when blocks are destroyed, ball trails
- **Screen shake**: Brief shake on block destruction
- **Combo display**: Shows current combo multiplier

## Performance Notes

- Particle system capped at 500 particles
- Delta time capped at 100ms to prevent physics tunneling
- Uses `willReadFrequently` hint for Canvas optimization
- Efficient collision detection (early exit on first collision)
