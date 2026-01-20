"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getLeaderboard,
  clearLeaderboard,
  formatEntry,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

interface LeaderboardProps {
  onHighlightEntry?: string; // ID to highlight
  className?: string;
}

export function Leaderboard({ onHighlightEntry, className }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setEntries(getLeaderboard());
  }, []);

  const handleClear = () => {
    if (showConfirm) {
      clearLeaderboard();
      setEntries([]);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 3000);
    }
  };

  const getMedalColor = (rank: number): string => {
    switch (rank) {
      case 1:
        return "text-yellow-400";
      case 2:
        return "text-gray-300";
      case 3:
        return "text-amber-600";
      default:
        return "text-gray-500";
    }
  };

  const getMedal = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `${rank}.`;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            High Scores
          </CardTitle>
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-400"
              onClick={handleClear}
            >
              <Trash2 className="h-4 w-4" />
              {showConfirm && <span className="ml-1 text-xs">Confirm?</span>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No scores yet. Play a game!
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const { timeAgo } = formatEntry(entry);
              const isHighlighted = entry.id === onHighlightEntry;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    isHighlighted
                      ? "bg-cyan-500/20 border border-cyan-500/50"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`text-lg font-bold w-8 ${getMedalColor(index + 1)}`}
                  >
                    {getMedal(index + 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium truncate">{entry.name}</span>
                      <span className="text-cyan-400 font-mono font-bold">
                        {entry.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{entry.blocksDestroyed} blocks</span>
                      <span>·</span>
                      <span>x{entry.maxCombo} combo</span>
                      <span>·</span>
                      <span>{timeAgo}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Leaderboard;
