"use client";

import { useState, useCallback, useEffect } from "react";
import { RotateCcw, Volume2, VolumeX, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/game-canvas";
import { HighScoreModal } from "@/components/high-score-modal";
import { isHighScore, type LeaderboardEntry } from "@/lib/leaderboard";
import type { LevelData, GameState, GameEvent } from "@/game/types";

export default function Home() {
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // High score modal
  const [showHighScore, setShowHighScore] = useState(false);
  const [finalScore, setFinalScore] = useState({ score: 0, blocks: 0, combo: 0 });

  // Initialize audio
  useEffect(() => {
    const initAudio = async () => {
      const { audioManager } = await import("@/game/engine/audio");
      audioManager.setEnabled(soundEnabled);
    };
    initAudio();
  }, [soundEnabled]);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    setIsProcessing(true);

    try {
      console.log("[Page] Starting analysis for file:", file.name, file.type, file.size);

      const { analyzeCalendar } = await import("@/lib/analysis/calendar-analyzer");
      const { generateLevel } = await import("@/game/engine/level-generator");

      console.log("[Page] Modules loaded, analyzing...");
      const analysis = await analyzeCalendar(file, false);
      console.log("[Page] Analysis complete, events:", analysis.events.length);

      const level = generateLevel(analysis);
      console.log("[Page] Level generated, blocks:", level.blocks.length);

      setLevelData(level);
    } catch (error) {
      console.error("Error processing calendar:", error);
      const msg = error instanceof Error ? error.message : String(error);
      alert(`Error: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleGameEvent = useCallback(async (event: GameEvent) => {
    const { audioManager } = await import("@/game/engine/audio");

    switch (event.type) {
      case "blockDestroyed":
        audioManager.play("block_destroy");
        if ((event.data as { combo: number }).combo > 1) {
          audioManager.playCombo((event.data as { combo: number }).combo);
        }
        break;
      case "ballLost":
        audioManager.play("ball_lost");
        break;
      case "gameWon":
        audioManager.play("game_win");
        break;
      case "gameLost":
        audioManager.play("game_over");
        break;
    }
  }, []);

  const handleStateChange = useCallback((state: GameState) => {
    if (state.status === "won" || state.status === "lost") {
      if (isHighScore(state.score) && state.score > 0) {
        setFinalScore({
          score: state.score,
          blocks: state.blocksDestroyed,
          combo: state.maxCombo,
        });
        setShowHighScore(true);
      }
    }
  }, []);

  const handleReset = useCallback(() => {
    setLevelData(null);
  }, []);

  const toggleSound = useCallback(async () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    const { audioManager } = await import("@/game/engine/audio");
    audioManager.setEnabled(newState);
  }, [soundEnabled]);

  return (
    <main className="min-h-screen bg-grid flex flex-col">
      {/* Minimal Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-cyan-400 neon-text">
              SMASH YOUR WEEK
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                title={soundEnabled ? "Mute" : "Unmute"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-500" />
                )}
              </Button>
              {levelData && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  New
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Single Centered Window */}
      <div className="flex-1 flex items-center justify-center p-4">
        {!levelData ? (
          /* Upload Zone */
          <div
            className={`
              w-full max-w-2xl aspect-video
              border-2 border-dashed rounded-xl
              flex flex-col items-center justify-center gap-4
              cursor-pointer transition-all
              ${isDragging
                ? "border-cyan-400 bg-cyan-400/10"
                : "border-white/20 bg-black/30 hover:border-white/40 hover:bg-black/40"
              }
              ${isProcessing ? "pointer-events-none opacity-50" : ""}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />

            {isProcessing ? (
              <>
                <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400">Analyzing calendar...</p>
              </>
            ) : (
              <>
                <Upload className={`w-16 h-16 ${isDragging ? "text-cyan-400" : "text-gray-500"}`} />
                <div className="text-center">
                  <p className="text-lg text-white">
                    Drop your calendar screenshot here
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    or click to browse
                  </p>
                </div>
                <div className="flex gap-6 mt-4 text-xs text-gray-600">
                  <span>Google Calendar</span>
                  <span>Outlook</span>
                  <span>Apple Calendar</span>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Game Canvas */
          <div className="flex flex-col items-center gap-3">
            <GameCanvas
              levelData={levelData}
              onGameEvent={handleGameEvent}
              onStateChange={handleStateChange}
              className="rounded-xl border border-white/10 shadow-2xl"
            />
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Mouse</kbd> Move</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd> Launch</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">P</kbd> Pause</span>
            </div>
          </div>
        )}
      </div>

      {/* High Score Modal */}
      <HighScoreModal
        isOpen={showHighScore}
        score={finalScore.score}
        blocksDestroyed={finalScore.blocks}
        maxCombo={finalScore.combo}
        onClose={() => setShowHighScore(false)}
        onSaved={() => {}}
      />
    </main>
  );
}
