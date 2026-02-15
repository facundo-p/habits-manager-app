/**
 * useHabitStore.ts — Store de estado para hábitos (Zustand).
 *
 * Los componentes consumen este store; la lógica real vive en services/.
 */

import { create } from 'zustand';
import type {
  Habit, DailyHabit, DailyStats, PendingReflection,
  HabitFormData, LibraryHabit,
} from '../types';
import { MOOD_DEFAULT_VALUE } from '../config/constants';
import {
  getHabitsForDay,
  getDailyPointsProgress,
  getAllHabits,
  getPerformedDescription,
  getCompletionCounts,
  markHabitDone,
  unmarkHabit,
  updatePerformedDescription,
  toggleHabitActive,
  createHabit,
  updateHabit,
  deleteHabit,
} from '../services/habitService';
import {
  createMoodEntry,
  getMoodForHabit,
  deleteMoodForHabit,
} from '../services/moodService';

// ─── Interfaz del store ─────────────────────────────────────────────

interface HabitState {
  // Daily
  viewDate: string | null; // null = hoy
  dailyHabits: DailyHabit[];
  dailyStats: DailyStats;
  isLoading: boolean;
  pendingReflection: PendingReflection | null;

  // Library
  libraryHabits: LibraryHabit[];
  isLibraryLoading: boolean;

  // Daily actions
  setViewDate: (date: string | null) => void;
  fetchHabitsForDate: (date?: string | null) => Promise<void>;
  toggleHabit: (habit: DailyHabit) => Promise<void>;
  openEditReflection: (habit: DailyHabit) => Promise<void>;
  saveReflection: (description: string, moodValue: number) => Promise<void>;
  skipReflection: () => void;

  // Library actions
  fetchLibrary: () => Promise<void>;
  addHabit: (data: HabitFormData) => Promise<void>;
  editHabit: (id: string, data: HabitFormData) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
}

const EMPTY_STATS: DailyStats = { earned: 0, total: 0, percentage: 0 };

// ─── Store ──────────────────────────────────────────────────────────

export const useHabitStore = create<HabitState>((set, get) => ({
  viewDate: null,
  dailyHabits: [],
  dailyStats: EMPTY_STATS,
  isLoading: false,
  pendingReflection: null,
  libraryHabits: [],
  isLibraryLoading: false,

  // ─── Daily actions ──────────────────────────────────────────────

  setViewDate: (date) => {
    set({ viewDate: date });
  },

  fetchHabitsForDate: async (date) => {
    set({ isLoading: true });
    const d = date ?? get().viewDate ?? undefined;
    const [habits, stats] = await Promise.all([
      getHabitsForDay(d ?? undefined),
      getDailyPointsProgress(d ?? undefined),
    ]);
    set({ dailyHabits: habits, dailyStats: stats, isLoading: false });
  },

  toggleHabit: async (habit) => {
    const datePrefix = get().viewDate ?? undefined;

    if (habit.completedToday && habit.performedHabitId) {
      await unmarkHabit(habit.performedHabitId);
      await deleteMoodForHabit(habit.id, datePrefix);
      await refreshDaily(set, get);
    } else {
      const performedHabitId = await markHabitDone(habit, datePrefix);
      await refreshDaily(set, get);
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

  openEditReflection: async (habit) => {
    if (!habit.performedHabitId) return;
    const datePrefix = get().viewDate ?? undefined;

    const [description, moodValue] = await Promise.all([
      getPerformedDescription(habit.performedHabitId),
      getMoodForHabit(habit.id, datePrefix),
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

  saveReflection: async (description, moodValue) => {
    const { pendingReflection, viewDate } = get();
    if (!pendingReflection) return;

    const { habit, performedHabitId, isEditing } = pendingReflection;
    const datePrefix = viewDate ?? undefined;

    await updatePerformedDescription(performedHabitId, description);

    if (isEditing) {
      await deleteMoodForHabit(habit.id, datePrefix);
    }

    await createMoodEntry(moodValue, description, habit.id, datePrefix);
    set({ pendingReflection: null });
  },

  skipReflection: () => set({ pendingReflection: null }),

  // ─── Library actions ────────────────────────────────────────────

  fetchLibrary: async () => {
    set({ isLibraryLoading: true });
    const [habits, counts] = await Promise.all([
      getAllHabits(),
      getCompletionCounts(),
    ]);
    const libraryHabits = enrichWithCounts(habits, counts);
    set({ libraryHabits, isLibraryLoading: false });
  },

  addHabit: async (data) => {
    await createHabit(data.name, data.frequency, data.basePoints, data.categories);
    await refreshAll(set, get);
  },

  editHabit: async (id, data) => {
    await updateHabit(id, data.name, data.frequency, data.basePoints, data.categories);
    await refreshAll(set, get);
  },

  removeHabit: async (id) => {
    await deleteHabit(id);
    await refreshAll(set, get);
  },

  toggleActive: async (id, isActive) => {
    await toggleHabitActive(id, isActive);
    await refreshAll(set, get);
  },
}));

// ─── Helpers internos ───────────────────────────────────────────────

function enrichWithCounts(
  habits: Habit[],
  counts: Record<string, number>,
): LibraryHabit[] {
  return habits.map((h) => ({
    ...h,
    completionCount: counts[h.id] ?? 0,
  }));
}

async function refreshDaily(
  set: (partial: Partial<HabitState>) => void,
  get: () => HabitState,
): Promise<void> {
  const d = get().viewDate ?? undefined;
  const [habits, stats] = await Promise.all([
    getHabitsForDay(d),
    getDailyPointsProgress(d),
  ]);
  set({ dailyHabits: habits, dailyStats: stats });
}

async function refreshAll(
  set: (partial: Partial<HabitState>) => void,
  get: () => HabitState,
): Promise<void> {
  const d = get().viewDate ?? undefined;
  const [dailyHabits, stats, allHabits, counts] = await Promise.all([
    getHabitsForDay(d),
    getDailyPointsProgress(d),
    getAllHabits(),
    getCompletionCounts(),
  ]);
  const libraryHabits = enrichWithCounts(allHabits, counts);
  set({ dailyHabits, dailyStats: stats, libraryHabits });
}
