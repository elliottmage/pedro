"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { LevelData, GameState, GameEvent } from "@/game/types";

interface GameCanvasProps {
  levelData: LevelData | null;
  onGameEvent?: (event: GameEvent) => void;
  onStateChange?: (state: GameState) => void;
  className?: string;
}

export function GameCanvas({
  levelData,
  onGameEvent,
  onStateChange,
  className,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<import("@/game/engine").BreakoutGame | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize game
  useEffect(() => {
    if (!canvasRef.current) return;

    const initGame = async () => {
      const { BreakoutGame } = await import("@/game/engine");

      // Clean up existing game
      if (gameRef.current) {
        gameRef.current.destroy();
      }

      // Create new game instance
      // Note: width/height are set based on the uploaded image when level loads
      const game = new BreakoutGame(canvasRef.current!, {
        enableParticles: true,
        enableGlow: true,
        enableScreenShake: true,
      });

      // Set up event listeners
      game.on("all", (event: GameEvent) => {
        onGameEvent?.(event);
        onStateChange?.(game.getState());
      });

      gameRef.current = game;
      setIsLoaded(true);
    };

    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, [onGameEvent, onStateChange]);

  // Load level when levelData changes
  useEffect(() => {
    if (!gameRef.current || !levelData) return;

    const loadLevel = async () => {
      await gameRef.current!.loadLevel(levelData);
      onStateChange?.(gameRef.current!.getState());
    };

    loadLevel();
  }, [levelData, onStateChange]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;

      const container = containerRef.current;
      const canvas = canvasRef.current;
      const config = gameRef.current?.getConfig();

      if (!config) return;

      // Calculate scale to fit container while maintaining aspect ratio
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const gameAspect = config.width / config.height;
      const containerAspect = containerWidth / containerHeight;

      let displayWidth: number;
      let displayHeight: number;

      if (containerAspect > gameAspect) {
        displayHeight = containerHeight;
        displayWidth = displayHeight * gameAspect;
      } else {
        displayWidth = containerWidth;
        displayHeight = displayWidth / gameAspect;
      }

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isLoaded]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="rounded-lg shadow-2xl shadow-cyan-500/20"
        style={{ imageRendering: "pixelated" }}
      />
      {!levelData && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-400 text-center">
            Upload a calendar screenshot to start playing
          </p>
        </div>
      )}
    </div>
  );
}

export default GameCanvas;
