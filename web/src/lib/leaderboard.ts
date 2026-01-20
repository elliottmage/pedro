/**
 * Local Leaderboard System
 *
 * Stores high scores in localStorage
 */

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  blocksDestroyed: number;
  maxCombo: number;
  date: string;
  calendarName?: string;
}

const STORAGE_KEY = "smash_your_week_leaderboard";
const MAX_ENTRIES = 10;

/**
 * Get all leaderboard entries
 */
export function getLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const entries = JSON.parse(data) as LeaderboardEntry[];
    return entries.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

/**
 * Add a new entry to the leaderboard
 */
export function addToLeaderboard(
  entry: Omit<LeaderboardEntry, "id" | "date">
): LeaderboardEntry {
  const newEntry: LeaderboardEntry = {
    ...entry,
    id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
  };

  const entries = getLeaderboard();
  entries.push(newEntry);

  // Sort by score and keep top entries
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, MAX_ENTRIES);

  // Save
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Failed to save leaderboard:", e);
  }

  return newEntry;
}

/**
 * Check if a score qualifies for the leaderboard
 */
export function isHighScore(score: number): boolean {
  const entries = getLeaderboard();

  if (entries.length < MAX_ENTRIES) return true;

  const lowestScore = entries[entries.length - 1]?.score ?? 0;
  return score > lowestScore;
}

/**
 * Get the rank for a given score
 */
export function getRank(score: number): number {
  const entries = getLeaderboard();
  const rank = entries.findIndex((e) => score > e.score);
  return rank === -1 ? entries.length + 1 : rank + 1;
}

/**
 * Clear the leaderboard
 */
export function clearLeaderboard(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear leaderboard:", e);
  }
}

/**
 * Format a leaderboard entry for display
 */
export function formatEntry(entry: LeaderboardEntry): {
  date: string;
  timeAgo: string;
} {
  const date = new Date(entry.date);

  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Calculate time ago
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  let timeAgo: string;
  if (minutes < 1) {
    timeAgo = "Just now";
  } else if (minutes < 60) {
    timeAgo = `${minutes}m ago`;
  } else if (hours < 24) {
    timeAgo = `${hours}h ago`;
  } else if (days < 7) {
    timeAgo = `${days}d ago`;
  } else {
    timeAgo = formatted;
  }

  return { date: formatted, timeAgo };
}
