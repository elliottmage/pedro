"use client";

import React from "react";
import { Heart, Target, Zap, Trophy } from "lucide-react";
import type { GameState } from "@/game/types";

interface GameStatsProps {
  state: GameState | null;
  className?: string;
}

export function GameStats({ state, className }: GameStatsProps) {
  if (!state) {
    return (
      <div className={`grid grid-cols-2 gap-3 ${className}`}>
        <StatCard icon={Trophy} label="Score" value="-" color="cyan" />
        <StatCard icon={Heart} label="Lives" value="-" color="red" />
        <StatCard icon={Target} label="Blocks" value="-" color="green" />
        <StatCard icon={Zap} label="Combo" value="-" color="yellow" />
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <StatCard
        icon={Trophy}
        label="Score"
        value={state.score.toLocaleString()}
        color="cyan"
      />
      <StatCard
        icon={Heart}
        label="Lives"
        value={"♥".repeat(state.lives)}
        color="red"
      />
      <StatCard
        icon={Target}
        label="Blocks"
        value={`${state.blocksDestroyed}/${state.blocksDestroyed + state.blocksRemaining}`}
        color="green"
      />
      <StatCard
        icon={Zap}
        label="Combo"
        value={state.combo > 0 ? `x${state.combo}` : "-"}
        color="yellow"
        highlight={state.combo > 1}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "cyan" | "red" | "green" | "yellow";
  highlight?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  highlight,
}: StatCardProps) {
  const colorClasses = {
    cyan: "text-cyan-400",
    red: "text-red-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
  };

  return (
    <div
      className={`bg-white/5 rounded-lg p-3 border border-white/10 ${
        highlight ? "animate-pulse" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${colorClasses[color]}`} />
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={`text-lg font-bold font-mono ${colorClasses[color]}`}>
        {value}
      </div>
    </div>
  );
}

export default GameStats;
