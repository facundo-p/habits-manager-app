/**
 * useDraftAutosave — Hook genérico para autosave de drafts con debounce 500ms (D-04).
 *
 * Consumido por Phase 2 surfaces (morning / evening / note) y Phase 4 (weekly
 * review). Mantiene la lógica de debounce en una función pura
 * (`createDraftAutosaveScheduler`) para que se pueda testear sin
 * `@testing-library/react-native` (Option B del plan).
 *
 * Usage (Phase 2):
 *   useDraftAutosave('morning', getLocalDayKey(), { mood, sleep, comment });
 */

import { useEffect, useRef } from 'react';
import * as draftsRepo from '../repositories/draftsRepository';

const DEFAULT_DEBOUNCE_MS = 500;

export interface DraftAutosaveScheduler {
  /** Encola un upsert; si llega otro schedule antes de `debounceMs`, se reemplaza. */
  schedule: (payloadJson: string) => void;
  /** Cancela el timer pendiente (cleanup en unmount). */
  cancel: () => void;
}

/**
 * Crea un scheduler de debounce para autosave de drafts. Pura: testable con
 * fake timers + un upsertFn mockeado, sin necesidad de render.
 */
export function createDraftAutosaveScheduler(
  kind: string,
  key: string,
  upsertFn: (kind: string, key: string, payloadJson: string) => Promise<void>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): DraftAutosaveScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastJson: string | null = null;

  return {
    schedule(payloadJson: string) {
      if (payloadJson === lastJson) return; // no-op si el payload no cambió
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        upsertFn(kind, key, payloadJson).catch((err) => {
          const msg = err instanceof Error ? err.message : 'unknown';
          console.warn('[useDraftAutosave] upsert failed:', msg);
        });
        lastJson = payloadJson;
        timer = null;
      }, debounceMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/**
 * Hook React: convierte `payload` en JSON, schedule en cada cambio, cleanup
 * en unmount.
 */
export function useDraftAutosave(
  kind: string,
  key: string,
  payload: unknown,
  options: { debounceMs?: number } = {},
): void {
  const { debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const schedulerRef = useRef<DraftAutosaveScheduler | null>(null);

  if (!schedulerRef.current) {
    schedulerRef.current = createDraftAutosaveScheduler(
      kind,
      key,
      draftsRepo.upsert,
      debounceMs,
    );
  }

  useEffect(() => {
    schedulerRef.current?.schedule(JSON.stringify(payload));
    return () => {
      schedulerRef.current?.cancel();
    };
  }, [payload]);
}
