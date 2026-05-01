# Phase 3: Google Drive Backup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 03-google-drive-backup
**Areas discussed:** Auth: persistencia y estado, Estrategia de archivos en Drive, Restore: metadata y protección, UX de errores y progreso

---

## Auth: persistencia y estado

| Pregunta | Opción | Seleccionada |
|---|---|---|
| ¿Cuándo restauramos la sesión Google? | Silent sign-in al abrir la app | ✓ |
| | Solo cuando el user entra a Settings | |
| | Solo cuando el user presiona Backup/Restore | |
| ¿Dónde vive el estado de auth? | Extender useSettingsStore | ✓ |
| | Nuevo useAuthStore separado | |
| | No persistir email — recomputar de token | |
| ¿Qué hace 'Cerrar sesión'? | Solo signOut() local | ✓ |
| | signOut() + revokeAccess() | |
| | Dos botones separados (local + revoke) | |
| ¿Qué confirmación pedimos en sign-out? | Alert de confirmación nativa | ✓ |
| | Sin confirmación — un toque y listo | |

**Notas:** todas las decisiones siguen las opciones recomendadas. Razones: minimizar fricción para el flujo común, reusar patrones que ya viven en el codebase (persist + Alert.alert).

---

## Estrategia de archivos en Drive

| Pregunta | Opción | Seleccionada |
|---|---|---|
| ¿Segundo backup el mismo día? | Sobrescribir el del día | |
| | Sobrescribir, pero confirmar antes | ✓ |
| | Crear archivo nuevo con timestamp HHmm | |
| ¿Aplicamos retención automática? | No — dejar todo, el user decide | |
| | Mantener últimos N (ej: 30) | |
| | Mantener últimos N + 1 mensual + 1 anual | ✓ |
| ¿Orden de la lista de restore? | Más reciente primero | ✓ |
| | Más viejo primero | |
| ¿Filtrado de archivos? | Solo cozyhabits-*.json | ✓ |
| | Todo lo que esté en appDataFolder | |
| ¿Cuántos backups recientes preservamos? | Últimos 30 días | ✓ |
| | Últimos 14 días | |
| | Últimos 60 días | |
| | Últimos 7 días | |
| ¿Cuándo corre la limpieza de retención? | Después de cada backup exitoso | ✓ |
| | Solo al abrir la lista de Restore (lazy) | |
| | Botón manual en Settings | |
| ¿Cuándo se muestra el confirm de overwrite? | Siempre que ya exista uno hoy | ✓ |
| | Solo si el de hoy es de hace más de 1h | |
| | Sin confirmación | |

**Notas:** el usuario optó por la política Time Machine (más compleja que las recomendadas), priorizando safety long-term sobre simplicidad. Confirmó pruning post-backup y always-confirm en overwrite — defensivo y predecible.

---

## Restore: metadata y protección

| Pregunta | Opción | Seleccionada |
|---|---|---|
| ¿Metadata por item en lista? | Fecha + tamaño + conteo de items | |
| | Solo fecha y tamaño | |
| | Fecha + tamaño, conteos solo al hacer tap (preview) | ✓ |
| ¿Qué muestra el modal de confirmación? | Fecha + conteos + warning destructivo | ✓ |
| | Solo fecha + warning genérico | |
| | Fecha + conteos + diff vs datos actuales | |
| ¿Auto-export local antes del restore? | Sí — backup local automático al cache | ✓ |
| | No — confiar en el warning del modal | |
| | Sí pero opt-in (checkbox) | |
| Post-restore exitoso, ¿qué vista? | Quedarse en Settings + Alert de éxito | ✓ |
| | Navegar automáticamente al DailySheet | |
| | Modal full-screen con resumen | |

**Notas:** "conteos al hacer tap" introduce un paso adicional de preview pero evita N fetches al renderizar la lista. El auto-export al cache es la red de seguridad — el usuario eligió la opción más defensiva.

---

## UX de errores y progreso

| Pregunta | Opción | Seleccionada |
|---|---|---|
| ¿Cómo presentamos errores Drive? | Alert nativo con título + mensaje + acción | ✓ |
| | Banner/toast inline en Settings | |
| | Bottom sheet con detalle + 'Reintentar' | |
| ¿Retry para errores recuperables? | Botón manual (el Alert lo invita) | ✓ |
| | Auto-retry una vez tras token refresh | |
| | Auto-retry con backoff exponencial | |
| ¿Indicador de progreso durante upload/restore? | Spinner simple en el botón | |
| | Spinner full-screen con overlay | ✓ |
| | Progress bar real (% de bytes) | |
| ¿Caso 'no hay red al abrir lista'? | Empty state con mensaje + 'Reintentar' | ✓ |
| | Cachear última lista exitosa offline | |
| | Alert + cerrar la pantalla de Restore | |

### Follow-up sobre el overlay full-screen

| Pregunta | Opción | Seleccionada |
|---|---|---|
| Forma del overlay? | Modal transparente con spinner + texto | ✓ |
| | Solo el spinner, sin texto descriptivo | |
| | View absoluto sobre la pantalla actual | |
| ¿Cobertura del overlay? | Solo upload y restore | ✓ |
| | Los 3: upload, restore y listing | |
| ¿Aprobamos el mapping de mensajes de error? | Sí, esos son los mensajes | ✓ |
| | Quiero ajustar algún mensaje | |
| | Que Claude decida los mensajes exactos | |

**Notas:** desviación deliberada del patrón inline actual (spinner en botón) — el overlay full-screen justifica un componente nuevo (`LoadingOverlay`). El user mantuvo el resto de las recomendaciones (Alert nativo, sin auto-retry, empty state offline).

---

## Claude's Discretion

Áreas en las que el usuario delegó la decisión a Claude (a refinar en planning):

- Forma exacta del componente `LoadingOverlay` (tamaño, color, animation)
- Texto literal de los Alerts de error (approach + ejemplos aprobados)
- Estructura interna de `driveBackupService.ts` (orden, helpers)
- Estrategia de tests (mocks del SDK + tests puros para retention policy)
- Cuándo limpiar el cache pre-restore (`cozyhabits-pre-restore-*.json`)
- Forma del componente de lista (FlatList vs ScrollView, modal vs screen)
- Setup detallado de Google Cloud Console (en plan 03-01)
- Posición de la sección "Cloud backup" en Settings (arriba/abajo/fusionada con "Seguridad y Datos")

---

## Deferred Ideas

Ideas que aparecieron en discusión y se difieren a v2 / out of scope (detalle completo en CONTEXT.md `<deferred>`):

- Diff vs datos actuales en modal de restore
- Auto-retry con backoff exponencial
- Cachear lista offline read-only
- Botón manual "Limpiar backups antiguos"
- Botones separados sign-out / revoke
- Bottom sheet con detalle de error + retry
- Progress bar real durante upload (% bytes)
