/**
 * useHabitStore.ts — Store de estado para hábitos (Zustand).
 *
 * Los componentes consumen este store; la lógica real vive en services/.
 * La vista diaria ahora se basa en daily_assignments (DailyItem).
 */

import { create } from 'zustand';
import type {
  Habit, DailyItem, DailyStats, PendingReflection,
  HabitFormData, LibraryHabit,
} from '../types';
import { MOOD_DEFAULT_VALUE } from '../config/constants';
import {
  getItemsForDate,
  getPointsForDate,
  completeAssignment,
  uncompleteAssignment,
  addSpontaneous as addSpontaneousSvc,
  removeSpontaneous,
  addAssignmentForHabit,
  removeAssignmentForHabit,
} from '../services/assignmentService';
import {
  getAllHabits,
  getPerformedDescription,
  updatePerformedDescription,
  getCompletionCounts,
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
  dailyItems: DailyItem[];
  dailyStats: DailyStats;
  isLoading: boolean;
  pendingReflection: PendingReflection | null;

  // Library
  libraryHabits: LibraryHabit[];
  isLibraryLoading: boolean;

  // Daily actions
  resetToToday: () => void;
  setViewDate: (date: string | null) => void;
  fetchHabitsForDate: (date?: string | null) => Promise<void>;
  toggleItem: (item: DailyItem) => Promise<void>;
  openEditReflection: (item: DailyItem) => Promise<void>;
  saveReflection: (description: string, moodValue: number) => Promise<void>;
  skipReflection: () => void;

  // Spontaneous
  addSpontaneous: (name: string, categories: string[]) => Promise<void>;
  removeSpontaneousItem: (item: DailyItem) => Promise<void>;

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
  dailyItems: [],
  dailyStats: EMPTY_STATS,
  isLoading: false,
  pendingReflection: null,
  libraryHabits: [],
  isLibraryLoading: false,

  // ─── Daily actions ──────────────────────────────────────────────

  resetToToday: () => {
    set({ viewDate: null });
  },

  setViewDate: (date) => {
    set({ viewDate: date });
  },

  fetchHabitsForDate: async (date) => {
    set({ isLoading: true });
    try {
      const d = date ?? get().viewDate ?? undefined;
      const [items, stats] = await Promise.all([
        getItemsForDate(d ?? undefined),
        getPointsForDate(d ?? undefined),
      ]);
      set({ dailyItems: items, dailyStats: stats, isLoading: false });
    } catch (err) {
      console.error('[fetchHabitsForDate]', err);
      set({ isLoading: false });
    }
  },

  toggleItem: async (item) => {
    const datePrefix = get().viewDate ?? undefined;
    try {
      if (item.isCompleted) {
        await uncompleteAssignment(item, datePrefix);
        if (item.habitId) {
          await deleteMoodForHabit(item.habitId, datePrefix);
        }
        await refreshDaily(set, get);
      } else {
        const performedHabitId = await completeAssignment(item, datePrefix);
        await refreshDaily(set, get);

        if (item.habitId && performedHabitId) {
          set({
            pendingReflection: {
              item,
              performedHabitId,
              isEditing: false,
              initialDescription: '',
              initialMoodValue: MOOD_DEFAULT_VALUE,
            },
          });
        }
      }
    } catch (err) {
      console.error('[toggleItem]', err);
    }
  },

  openEditReflection: async (item) => {
    if (!item.performedHabitId || !item.habitId) return;
    const datePrefix = get().viewDate ?? undefined;

    const [description, moodValue] = await Promise.all([
      getPerformedDescription(item.performedHabitId),
      getMoodForHabit(item.habitId, datePrefix),
    ]);

    set({
      pendingReflection: {
        item,
        performedHabitId: item.performedHabitId,
        isEditing: true,
        initialDescription: description,
        initialMoodValue: moodValue ?? MOOD_DEFAULT_VALUE,
      },
    });
  },

  saveReflection: async (description, moodValue) => {
    const { pendingReflection, viewDate } = get();
    if (!pendingReflection) return;

    const { item, performedHabitId, isEditing } = pendingReflection;
    const datePrefix = viewDate ?? undefined;

    try {
      await updatePerformedDescription(performedHabitId, description);

      if (isEditing && item.habitId) {
        await deleteMoodForHabit(item.habitId, datePrefix);
      }

      if (item.habitId) {
        await createMoodEntry(moodValue, description, item.habitId, datePrefix);
      }
    } catch (err) {
      console.error('[saveReflection]', err);
    } finally {
      set({ pendingReflection: null });
    }
  },

  skipReflection: () => set({ pendingReflection: null }),

  // ─── Spontaneous actions ────────────────────────────────────────

  addSpontaneous: async (name, categories) => {
    const datePrefix = get().viewDate ?? undefined;
    await addSpontaneousSvc(name, categories, datePrefix);
    await refreshDaily(set, get);
  },

  removeSpontaneousItem: async (item) => {
    await removeSpontaneous(item.assignmentId);
    await refreshDaily(set, get);
  },

  // ─── Library actions ────────────────────────────────────────────

  fetchLibrary: async () => {
    set({ isLibraryLoading: true });
    try {
      const [habits, counts] = await Promise.all([
        getAllHabits(),
        getCompletionCounts(),
      ]);
      const libraryHabits = enrichWithCounts(habits, counts);
      set({ libraryHabits, isLibraryLoading: false });
    } catch (err) {
      console.error('[fetchLibrary]', err);
      set({ isLibraryLoading: false });
    }
  },

  addHabit: async (data) => {
    try {
      const habitId = await createHabit(data.name, data.frequency, data.basePoints, data.categories);
      await addAssignmentForHabit(habitId);
      await refreshAll(set, get);
    } catch (err) { console.error('[addHabit]', err); }
  },

  editHabit: async (id, data) => {
    try {
      await updateHabit(id, data.name, data.frequency, data.basePoints, data.categories);
      await refreshAll(set, get);
    } catch (err) { console.error('[editHabit]', err); }
  },

  removeHabit: async (id) => {
    try {
      await deleteHabit(id);
      await refreshAll(set, get);
    } catch (err) { console.error('[removeHabit]', err); }
  },

  toggleActive: async (id, isActive) => {
    try {
      await toggleHabitActive(id, isActive);
      if (isActive) {
        await addAssignmentForHabit(id);
      } else {
        await removeAssignmentForHabit(id);
      }
      await refreshAll(set, get);
    } catch (err) { console.error('[toggleActive]', err); }
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
  const [items, stats] = await Promise.all([
    getItemsForDate(d),
    getPointsForDate(d),
  ]);
  set({ dailyItems: items, dailyStats: stats });
}

async function refreshAll(
  set: (partial: Partial<HabitState>) => void,
  get: () => HabitState,
): Promise<void> {
  const d = get().viewDate ?? undefined;
  const [dailyItems, stats, allHabits, counts] = await Promise.all([
    getItemsForDate(d),
    getPointsForDate(d),
    getAllHabits(),
    getCompletionCounts(),
  ]);
  const libraryHabits = enrichWithCounts(allHabits, counts);
  set({ dailyItems, dailyStats: stats, libraryHabits });
}
