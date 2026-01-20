"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameCanvas } from "@/components/game-canvas";
import { UploadZone } from "@/components/upload-zone";
import { GameStats } from "@/components/game-stats";
import { Leaderboard } from "@/components/leaderboard";
import { HighScoreModal } from "@/components/high-score-modal";
import { isHighScore, type LeaderboardEntry } from "@/lib/leaderboard";
import type { LevelData, GameState, GameEvent } from "@/game/types";

export default function Home() {
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // High score modal
  const [showHighScore, setShowHighScore] = useState(false);
  const [finalScore, setFinalScore] = useState({ score: 0, blocks: 0, combo: 0 });
  const [highlightEntryId, setHighlightEntryId] = useState<string | undefined>();

  // Leaderboard refresh key
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  // Initialize audio
  useEffect(() => {
    const initAudio = async () => {
      const { audioManager } = await import("@/game/engine/audio");
      audioManager.setEnabled(soundEnabled);
    };
    initAudio();
  }, [soundEnabled]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);

    try {
      const { analyzeCalendar } = await import("@/lib/analysis/calendar-analyzer");
      const { generateLevel } = await import("@/game/engine/level-generator");

      const analysis = await analyzeCalendar(file, false);
      setEventsCount(analysis.events.length);

      const level = generateLevel(analysis, {
        width: 800,
        height: 600,
      });

      setLevelData(level);
    } catch (error) {
      console.error("Error processing calendar:", error);
      alert("Failed to process calendar image. Please try another screenshot.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleGameEvent = useCallback(async (event: GameEvent) => {
    // Play sounds
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
    setGameState(state);

    // Check for game end and high score
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

  const handleDemoMode = useCallback(async () => {
    setIsProcessing(true);

    try {
      const { generateDemoLevel } = await import("@/game/engine/level-generator");
      const level = generateDemoLevel(800, 600);
      setEventsCount(level.blocks.length);
      setLevelData(level);
    } catch (error) {
      console.error("Error loading demo:", error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setLevelData(null);
    setGameState(null);
    setEventsCount(0);
    setHighlightEntryId(undefined);
  }, []);

  const handleHighScoreSaved = useCallback((entry: LeaderboardEntry) => {
    setHighlightEntryId(entry.id);
    setLeaderboardKey((k) => k + 1);
  }, []);

  const toggleSound = useCallback(async () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    const { audioManager } = await import("@/game/engine/audio");
    audioManager.setEnabled(newState);
  }, [soundEnabled]);

  return (
    <main className="min-h-screen bg-grid">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-cyan-400 neon-text">
                SMASH YOUR WEEK
              </h1>
              <p className="text-sm text-gray-400">
                Breakout meets Calendar
              </p>
            </div>
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
                  New Game
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Game Area */}
          <div className="flex flex-col gap-4">
            <GameCanvas
              levelData={levelData}
              onGameEvent={handleGameEvent}
              onStateChange={handleStateChange}
              className="w-full aspect-[4/3] bg-black/50 rounded-xl border border-white/10"
            />

            {/* Controls hint */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Mouse</kbd>{" "}
                Move paddle
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Space</kbd>{" "}
                Launch / Restart
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">P</kbd>{" "}
                Pause
              </span>
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Upload Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Upload Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadZone
                  onFileSelect={handleFileSelect}
                  isProcessing={isProcessing}
                />
                <div className="mt-3 text-center">
                  <span className="text-gray-500 text-sm">or</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={handleDemoMode}
                  disabled={isProcessing}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Try Demo Mode
                </Button>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Game Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <GameStats state={gameState} />
                {eventsCount > 0 && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    {eventsCount} calendar events detected
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Leaderboard
              key={leaderboardKey}
              onHighlightEntry={highlightEntryId}
            />

            {/* Instructions Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">How to Play</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-400 space-y-2">
                <p>1. Upload a calendar screenshot</p>
                <p>2. Events become breakout blocks</p>
                <p>3. Destroy all blocks to win!</p>
                <p className="text-cyan-400 mt-3">
                  Build combos for bonus points
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/30 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-500">
          Smash Your Week - A calendar breakout game
        </div>
      </footer>

      {/* High Score Modal */}
      <HighScoreModal
        isOpen={showHighScore}
        score={finalScore.score}
        blocksDestroyed={finalScore.blocks}
        maxCombo={finalScore.combo}
        onClose={() => setShowHighScore(false)}
        onSaved={handleHighScoreSaved}
      />
    </main>
  );
}
