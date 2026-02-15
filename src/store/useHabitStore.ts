/**
 * useHabitStore.ts — Store de estado para hábitos (Zustand).
 *
 * Los componentes consumen este store; la lógica real vive en services/.
 */

import { create } from 'zustand';
import type { Habit, DailyHabit, DailyStats, PendingReflection, HabitFormData } from '../types';
import { MOOD_DEFAULT_VALUE } from '../config/constants';
import {
  getDailyHabits,
  getDailyPointsProgress,
  getAllHabits,
  getPerformedDescription,
  markHabitDone,
  unmarkHabit,
  updatePerformedDescription,
  createHabit,
  updateHabit,
  deleteHabit,
} from '../services/habitService';
import {
  createMoodEntry,
  getMoodForHabitToday,
  deleteMoodForHabitToday,
} from '../services/moodService';

// ─── Interfaz del store ─────────────────────────────────────────────

interface HabitState {
  // Daily
  dailyHabits: DailyHabit[];
  dailyStats: DailyStats;
  isLoading: boolean;
  pendingReflection: PendingReflection | null;

  // Library
  allHabits: Habit[];
  isLibraryLoading: boolean;

  // Daily actions
  fetchDailyHabits: () => Promise<void>;
  toggleHabit: (habit: DailyHabit) => Promise<void>;
  openEditReflection: (habit: DailyHabit) => Promise<void>;
  saveReflection: (description: string, moodValue: number) => Promise<void>;
  skipReflection: () => void;

  // Library actions
  fetchAllHabits: () => Promise<void>;
  addHabit: (data: HabitFormData) => Promise<void>;
  editHabit: (id: string, data: HabitFormData) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
}

const EMPTY_STATS: DailyStats = { earned: 0, total: 0, percentage: 0 };

// ─── Store ──────────────────────────────────────────────────────────

export const useHabitStore = create<HabitState>((set, get) => ({
  dailyHabits: [],
  dailyStats: EMPTY_STATS,
  isLoading: false,
  pendingReflection: null,
  allHabits: [],
  isLibraryLoading: false,

  // ─── Daily actions ──────────────────────────────────────────────

  fetchDailyHabits: async () => {
    set({ isLoading: true });
    const [habits, stats] = await Promise.all([
      getDailyHabits(),
      getDailyPointsProgress(),
    ]);
    set({ dailyHabits: habits, dailyStats: stats, isLoading: false });
  },

  toggleHabit: async (habit: DailyHabit) => {
    if (habit.completedToday && habit.performedHabitId) {
      await unmarkHabit(habit.performedHabitId);
      await deleteMoodForHabitToday(habit.id);
      await refreshDaily(set);
    } else {
      const performedHabitId = await markHabitDone(habit);
      await refreshDaily(set);
      set({
        pendingReflection: {
          habit,
          performedHabitId,
          isEditing: false,
          initialDescription: '',
          initialMoodValue: MOOD_DEFAULT_VALUE,
        },
      });
    }
  },

  openEditReflection: async (habit: DailyHabit) => {
    if (!habit.performedHabitId) return;

    const [description, moodValue] = await Promise.all([
      getPerformedDescription(habit.performedHabitId),
      getMoodForHabitToday(habit.id),
    ]);

    set({
      pendingReflection: {
        habit,
        performedHabitId: habit.performedHabitId,
        isEditing: true,
        initialDescription: description,
        initialMoodValue: moodValue ?? MOOD_DEFAULT_VALUE,
      },
    });
  },

  saveReflection: async (description: string, moodValue: number) => {
    const { pendingReflection } = get();
    if (!pendingReflection) return;

    const { habit, performedHabitId, isEditing } = pendingReflection;

    await updatePerformedDescription(performedHabitId, description);

    if (isEditing) {
      await deleteMoodForHabitToday(habit.id);
    }

    await createMoodEntry(moodValue, description, habit.id);
    set({ pendingReflection: null });
  },

  skipReflection: () => {
    set({ pendingReflection: null });
  },

  // ─── Library actions ────────────────────────────────────────────

  fetchAllHabits: async () => {
    set({ isLibraryLoading: true });
    const habits = await getAllHabits();
    set({ allHabits: habits, isLibraryLoading: false });
  },

  addHabit: async (data: HabitFormData) => {
    await createHabit(data.name, data.frequency, data.basePoints, data.categories);
    await refreshAll(set);
  },

  editHabit: async (id: string, data: HabitFormData) => {
    await updateHabit(id, data.name, data.frequency, data.basePoints, data.categories);
    await refreshAll(set);
  },

  removeHabit: async (id: string) => {
    await deleteHabit(id);
    await refreshAll(set);
  },
}));

// ─── Helpers internos ───────────────────────────────────────────────

async function refreshDaily(
  set: (partial: Partial<HabitState>) => void,
): Promise<void> {
  const [habits, stats] = await Promise.all([
    getDailyHabits(),
    getDailyPointsProgress(),
  ]);
  set({ dailyHabits: habits, dailyStats: stats });
}

async function refreshAll(
  set: (partial: Partial<HabitState>) => void,
): Promise<void> {
  const [dailyHabits, stats, allHabits] = await Promise.all([
    getDailyHabits(),
    getDailyPointsProgress(),
    getAllHabits(),
  ]);
  set({ dailyHabits, dailyStats: stats, allHabits });
}
