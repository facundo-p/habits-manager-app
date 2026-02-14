/**
 * types/index.ts — Tipos del dominio de la aplicación.
 *
 * Entidades principales: Habit, PerformedHabit, MoodEntry.
 */

export interface Habit {
  id: number;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  basePoints: number;
  createdAt: string;
}

export interface PerformedHabit {
  id: number;
  habitId: number;
  date: string;
  description: string;
  pointsEarned: number;
  createdAt: string;
}

export interface MoodEntry {
  id: number;
  value: number; // 1–10, step 0.5
  timestamp: string;
}
