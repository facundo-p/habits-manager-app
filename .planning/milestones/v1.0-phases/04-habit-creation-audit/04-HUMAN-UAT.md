---
status: partial
phase: 04-habit-creation-audit
source: [04-VERIFICATION.md]
started: 2026-05-01T05:00:00Z
updated: 2026-05-01T05:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Smoke de migración v1 en device real (REQ-04-07)
expected: Build APK local, instalar sobre versión previa con DB poblada (idealmente con duplicados sembrados manualmente). Abrir app — NO hay UI bloqueante; `adb logcat -s ReactNativeJS` muestra `'DB inicializada y backfill completado'`; cero `[migration v1]` errors. Re-abrir app — idem (idempotencia, user_version ya = 1, migración no corre).
result: [pending]

### 2. Restore de backup pre-fix con duplicados (REQ-04-03)
expected: Generar JSON de backup con 2+ rows duplicadas (habit_id, date) — vía export de APK viejo o JSON sintético. Reset DB local. Restore via Drive backup UI o importBackup local. Verificar post-restore: `SELECT habit_id, date, COUNT(*) FROM daily_assignments WHERE habit_id IS NOT NULL GROUP BY habit_id, date HAVING COUNT(*) > 1` retorna 0 rows; la app abre sin alerta de error.
result: [pending]

### 3. Visibility weekly/monthly en device (REQ-04-10/11)
expected: Crear hábito weekly desde Biblioteca; el ítem aparece en DailySheet hoy. Cambiar viewDate al lunes y al domingo de la misma semana ISO — el ítem aparece en ambos. Completar el ítem hoy. Cambiar viewDate al lunes — el ítem se ve marcado como "completado para este período" (visual). Idem domingo. Repetir para monthly.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
