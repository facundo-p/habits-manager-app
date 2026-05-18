# Tone of Voice — Cozy Habits v1.1+

**Audience:** writers, designers, devs creando copy para v1.1 wellbeing features.
**Locale:** es-AR (rioplatense, voseo).
**Status:** living document — evoluciona con cada surface implementada.
**Owner:** product (facundo). Last updated: 2026-05-18.

---

## 1. Principios negativos (NO hacer)

- **No usar "te extrañamos", "volvé pronto", "no te olvides"** — manipulación parasocial, antipattern de wellbeing.
- **No mostrar streaks** ("12 días seguidos"), **badges**, ni **achievements emocionales** — la gamificación choca con bienestar.
- **No usar "missed" / "perdido" / "saltado"** para días sin entrada — shaming.
- **No comparar al usuario consigo mismo en sentido evaluativo** ("tu mood bajó respecto a la semana pasada") — la app no juzga la trayectoria.
- **No comparar al usuario con otros** — wellbeing es individual.
- **No urgencia falsa** ("¡última oportunidad!", "antes de medianoche") — wellbeing no tiene deadlines.
- **No frasear el mood en términos morales** ("mood bajo" como problema, "mood alto" como éxito).
- **No requerir un mood value para escribir una nota** — a veces la persona solo quiere escribir.
- **No exponer contenido user-typed en notificaciones** (privacy — el body de la notif NUNCA contiene texto de notas ni de comentarios).

## 2. Principios positivos (SÍ hacer)

- **Voz: empática, serena, en segunda persona neutral.** Convención del proyecto: **vos** (rioplatense). Mantener.
- **Lenguaje accionable sin presión:** "Registrá tu mood" (OK) ; "Tenés que registrar tu mood" (NO).
- **Descriptivo, no diagnóstico:** "Hoy registraste mood 7" (OK) ; "Tuviste un buen día" (NO) (la app no juzga).
- **Validar al usuario sin elogiar la acción:** el usuario decide qué significa lo que escribe.
- **Si la app sugiere algo, sugerir como invitación**, no como obligación.

## 3. Empty states

- **Nunca culposos.** Nunca recriminan ausencia.
- **Ofrecen una acción concreta** cuando aplica; sino, neutralidad.
- Ejemplos:
  - "Sin entrada para hoy" (OK) — vs. "No registraste nada" (NO).
  - "Cuando registres mood, lo vas a ver acá" (OK) — vs. "Te falta registrar mood" (NO).
- **Días vacíos en timeline/journal:** render neutral. Ningún ícono rojo ni alerta.

## 4. Glosario mínimo (v1.1)

| Término app | Significado | Notas |
|-------------|-------------|-------|
| ánimo / mood | el campo numérico de mood [1,10] | "mood" en código/DB; "ánimo" en UI cuando suena natural en es-AR |
| nota | entrada libre con mood + texto | NOTE feature (Issue #8) |
| frase de cabecera | quote en `text_library` | PHRA feature (Issue #20) |
| revisión semanal | weekly review | REVI feature |
| sueño | horas de sueño 0–14, step 0.25 | morning check-in |
| reflexión | comentario asociado a habit completion (legacy v1) | `mood_log.kind='reflection'` post-Phase-1 |
| check-in matutino | morning capture | MORN feature |
| check-in nocturno | evening capture | EVEN feature |

> **Glosario completo** se difiere — crece orgánicamente en Phase 2/5 cuando hay copy concreto. Ver CONTEXT Deferred Ideas.

## 5. Notificaciones (consumido en Phase 5)

- **Copy neutral, fáctico, en infinitivo o imperativo amable.**
- Ejemplos OK:
  - "Registrar mood matutino"
  - "Tu revisión semanal está disponible"
- Ejemplos NO:
  - "¡No te olvides de tu check-in!" (NO)
  - "Cozy te extraña" (NO)
  - "Llevás 3 días sin registrar" (NO)
- **El body de la notificación NUNCA incluye contenido user-typed** (privacy — PITFALLS Security).
- **Deep-link al primary action** del screen target; el body solo invita.

## 6. Migration / error UX (consumido en Phase 1, ya implementado)

Mensaje del `MigrationErrorScreen` (Wave 5):

- Headline: "No se pudo actualizar la base de datos."
- Subhead: "Tu información está a salvo. Podés restaurar desde un backup o reintentar la actualización."
- Botones: "Restaurar desde backup" / "Reintentar migración".

**NO:** "Error fatal", "Algo salió mal", "Ups", "Lo sentimos mucho".

## 7. Lifecycle del documento

- **Currently:** es-AR only. Traducciones futuras out of scope v1.1.
- **Updates:** cada PR que agregue copy nuevo debe (a) chequear consistencia con este doc, (b) si emerge un nuevo principio, agregarlo en sección 1 o 2 con una entrada datada.
- **Owner sign-off:** los strings finales de Phase 2 + Phase 5 deben pasar por una review contra este doc.

---

*Phase 1 deliverable — D-07. Created: 2026-05-18. Living document.*
