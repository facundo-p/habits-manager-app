---
status: partial
phase: 02-tech-debt
source: [02-VERIFICATION.md]
started: "2026-04-27T01:00:00Z"
updated: "2026-04-27T01:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Hook de voz funciona en dev build con módulo nativo instalado
expected: Dictar el nombre de un hábito en dispositivo iOS/Android dev build llena el campo de texto con la transcripción. `isAvailable=true` cuando voz está habilitada en settings.
why_human: El bridge nativo de `expo-speech-recognition` no se puede ejercer desde Jest — solo el path "módulo ausente" es testeable unitariamente (cubierto por los 4 tests automatizados de DEBT-01).
result: [pending]

### 2. Migración de sanitizeCategories sobre DB legacy con IDs inválidos
expected: Tras `initDatabase()` en una DB con datos sucios (p.ej. IDs viejos del schema previo `'["fisico","aprendizaje"]'`), `SELECT default_categories FROM habits` no retorna IDs fuera de `VALID_AREA_IDS`. `console.warn` emitido por el parser durante boot.
why_human: Limpieza defensiva one-shot en boot — solo se ejerce sobre data legacy real. Tests de `sanitize.test.ts` cubren el comportamiento contra DB in-memory pero no la ruta DB-real-on-device.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
