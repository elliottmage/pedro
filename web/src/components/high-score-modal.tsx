"use client";

import React, { useState, useEffect, useRef } from "react";
import { Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToLeaderboard, getRank, type LeaderboardEntry } from "@/lib/leaderboard";

interface HighScoreModalProps {
  isOpen: boolean;
  score: number;
  blocksDestroyed: number;
  maxCombo: number;
  onClose: () => void;
  onSaved: (entry: LeaderboardEntry) => void;
}

export function HighScoreModal({
  isOpen,
  score,
  blocksDestroyed,
  maxCombo,
  onClose,
  onSaved,
}: HighScoreModalProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rank = getRank(score);

  useEffect(() => {
    if (isOpen) {
      // Load saved name or default
      const savedName = localStorage.getItem("player_name") || "";
      setName(savedName);

      // Focus input after a brief delay
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const playerName = name.trim() || "Anonymous";
    setIsSaving(true);

    // Save name for next time
    localStorage.setItem("player_name", playerName);

    // Add to leaderboard
    const entry = addToLeaderboard({
      name: playerName,
      score,
      blocksDestroyed,
      maxCombo,
    });

    setTimeout(() => {
      onSaved(entry);
      onClose();
      setIsSaving(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-b from-gray-900 to-black border border-yellow-500/30 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl shadow-yellow-500/20">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <Trophy className="h-16 w-16 text-yellow-400" />
              <Star className="h-6 w-6 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-yellow-400">NEW HIGH SCORE!</h2>
          <p className="text-gray-400 mt-1">
            You ranked #{rank} on the leaderboard
          </p>
        </div>

        {/* Score display */}
        <div className="bg-black/50 rounded-lg p-4 mb-6 text-center">
          <div className="text-4xl font-bold text-cyan-400 font-mono">
            {score.toLocaleString()}
          </div>
          <div className="flex justify-center gap-4 mt-2 text-sm text-gray-400">
            <span>{blocksDestroyed} blocks</span>
            <span>·</span>
            <span>x{maxCombo} max combo</span>
          </div>
        </div>

        {/* Name input form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="player-name"
              className="block text-sm text-gray-400 mb-2"
            >
              Enter your name
            </label>
            <input
              ref={inputRef}
              id="player-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anonymous"
              maxLength={20}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
            >
              Skip
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Score"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HighScoreModal;
