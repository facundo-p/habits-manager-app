# Quick Task: Fix UTC → Local Timezone Day Boundary

**Researched:** 2026-05-04
**Domain:** JavaScript Date / React Native timezone handling
**Confidence:** HIGH

---

## Summary

The app determines "today" using `new Date().toISOString().slice(0, 10)`, which returns the date in **UTC**. For a user in Argentina (GMT-3), this means the app rolls over to the next day at **21:00 local time** — 3 hours before local midnight. The same bug affects `isFutureDate`, `getNowTimestamp`, `getTimestampForDate`, and the week-bounds calculation in `statsService.ts`.

The fix is a single-function change in `src/services/db.ts`: replace `getTodayPrefix`'s UTC implementation with one that reads the local calendar date. No external library is needed — vanilla JS local date methods (`getFullYear`, `getMonth`, `getDate`) already return local-time values on both Android and iOS. React Native's JS runtime inherits the device timezone from the OS, so no explicit locale/timezone configuration is required.

`periodHelpers.ts` and most of `assignmentService.ts` are intentionally UTC-pinned (they operate on `YYYY-MM-DD` strings that were already produced correctly) — those files do **not** need changes.

**Primary recommendation:** Fix `getTodayPrefix` in `db.ts` to use local calendar date. Audit the two secondary sites (`getWeekBounds` in `statsService.ts` and the `StatsScreen` initial month state).

---

## Root Cause Map

| File | Line(s) | Bug | Severity |
|------|---------|-----|----------|
| `src/services/db.ts` | 32 | `new Date().toISOString().slice(0,10)` — UTC date | **Critical** — all "today" logic flows through here |
| `src/services/db.ts` | 40, 45 | `getNowTimestamp` / `getTimestampForDate` — UTC time in stored timestamps | Low — timestamps are display-only, not compared as dates |
| `src/services/statsService.ts` | 26-37 | `getWeekBounds`: `now.getDay()` is local but `dateToPrefix(monday)` calls `toISOString()` — UTC offset applied at the final step | Medium — weekly comparison range could be off by 1 day near midnight |
| `src/screens/StatsScreen.tsx` | 34-35 | `now.getMonth() + 1` — local month, correct | No bug |

### How the bug propagates

```
getTodayPrefix()          ← new Date().toISOString().slice(0,10)  [UTC]
    │
    ├── assignmentService.getItemsForDate()    ← wrong "today" date key
    ├── assignmentService.isFutureDate()       ← wrong guard boundary
    ├── assignmentService.checkAndBackfillHistory()  ← wrong "today" anchor
    ├── assignmentService.addAssignmentForHabit()    ← wrong "today" guard
    ├── assignmentService.updateTodaySnapshotForHabit() ← wrong "today"
    ├── moodService (via getTodayPrefix)       ← wrong date for mood
    ├── driveBackupService (via getTodayPrefix) ← backup label wrong
    └── screens: SettingsScreen, RestoreFromDriveScreen, useDriveActions
```

---

## The Fix

### Why `new Date()` is already local in JS/React Native

`new Date()` always represents the current instant. The difference is in which *methods* you call on it:

- `.toISOString()` — always UTC → **wrong for local-date extraction**
- `.getFullYear()` / `.getMonth()` / `.getDate()` — local timezone → **correct**

React Native's JS engine (Hermes / JSC) inherits the device OS timezone automatically. `Intl.DateTimeFormat().resolvedOptions().timeZone` returns the IANA timezone string (e.g. `"America/Argentina/Buenos_Aires"`). No configuration needed. [VERIFIED: standard JS behavior, confirmed React Native uses OS timezone]

### Fix for `getTodayPrefix` (the single critical change)

```typescript
// BEFORE (db.ts:32) — UTC date, wrong for GMT-3
export function getTodayPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

// AFTER — local calendar date
export function getTodayPrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

This is a **one-line-logic change** with no new dependencies. [VERIFIED: getFullYear/getMonth/getDate are local-time methods per ECMAScript spec]

### Fix for `dateToPrefix` (used in statsService.ts week bounds)

`dateToPrefix` in `src/utils/dateHelpers.ts` also uses `toISOString()`:

```typescript
// BEFORE (dateHelpers.ts:28)
export function dateToPrefix(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

This is called in `statsService.getWeekBounds()` after doing local `setDate()` math on `monday`. Because `monday` has `setHours(0,0,0,0)` applied (local midnight), calling `.toISOString()` on it shifts back to UTC, potentially producing the previous day for GMT-3.

```typescript
// AFTER
export function dateToPrefix(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

**Important:** `periodHelpers.ts` and `assignmentService.ts` use `dateToPrefix` only on Dates constructed with `new Date(\`${datePrefix}T00:00:00Z\`)` — those are intentionally UTC-pinned string → string operations. Fixing `dateToPrefix` to local does **not** break those paths because the input Date is explicitly UTC-midnight and the local date of a UTC-midnight Date is the same calendar day for all timezones (no day boundary crossing unless offset > 24h, which doesn't exist). [ASSUMED — verify: UTC midnight Date's local getDate() returns same day for GMT-3: 2025-01-15T00:00:00Z → local is 2025-01-14 at 21:00 GMT-3 → getDate() returns 14, not 15!]

**This is a critical pitfall** — see below.

---

## Critical Pitfall: `periodHelpers` / `assignmentService` UTC-pinned Date Objects

`periodHelpers.ts` and `assignmentService.ts` deliberately construct dates as:

```typescript
const d = new Date(`${datePrefix}T00:00:00Z`);  // UTC midnight
```

Then call `dateToPrefix(d)` on the result. If `dateToPrefix` switches to local methods:

- Input: `"2025-01-15T00:00:00Z"` (UTC midnight Jan 15)
- In GMT-3: this moment is Jan 14 at 21:00 local
- `d.getDate()` → **14** (wrong!)

**Conclusion:** `dateToPrefix` in `dateHelpers.ts` must NOT be changed. The fix must be isolated to a **new function** in `db.ts` or a separate local-date helper. `periodHelpers` and `assignmentService` internal date math must continue using `toISOString()` on UTC-anchored dates.

### Revised Minimal Fix Plan

1. **`db.ts` only** — replace `getTodayPrefix()` inline implementation. Do not touch `dateToPrefix`.
2. **`statsService.ts` `getWeekBounds`** — fix the single UTC drift at the `dateToPrefix(monday)` call by replacing it with local-date extraction inline (since `monday` is a local-time Date object after `setHours(0,0,0,0)`).
3. **`dateToPrefix` in `dateHelpers.ts`** — leave unchanged. It is correctly used on UTC-anchored Date objects everywhere else.

---

## Files to Change (Minimal)

| File | Change |
|------|--------|
| `src/services/db.ts` | Fix `getTodayPrefix()` — use local `getFullYear/getMonth/getDate` |
| `src/services/statsService.ts` | Fix `getWeekBounds()` — extract date from `monday` using local methods, not `dateToPrefix` |

Files explicitly **not** changing:
- `src/utils/dateHelpers.ts` — `dateToPrefix` stays UTC (used by UTC-pinned paths)
- `src/utils/periodHelpers.ts` — already UTC-correct by design
- `src/services/assignmentService.ts` — all internal date math is UTC-string-based, correct

---

## No New Dependencies

No library needed. The project has no `date-fns`, `dayjs`, or `moment-timezone` in `package.json`, and none are needed. Vanilla JS local date methods are sufficient and are the standard pattern for this. [VERIFIED: package.json inspected]

---

## Test Impact

Existing tests in `src/__tests__/periodHelpers.test.ts` and `src/__tests__/dailyAssignments.test.ts` use fixed `datePrefix` strings — they are not affected by the `getTodayPrefix` change.

Tests that mock `getTodayPrefix` (e.g. via `jest.useFakeTimers`) will continue to work — `new Date()` with fake timers returns local methods consistently.

**New test to add:** A unit test for the fixed `getTodayPrefix` that asserts the result matches `new Date().getFullYear()` etc. — or use fake timers set to a UTC-midnight boundary (e.g. `2025-01-15T02:00:00Z`, which in GMT-3 is `2025-01-14`) and assert `getTodayPrefix()` returns `"2025-01-14"` not `"2025-01-15"`.

---

## Project Constraints (from CLAUDE.md)

- No inline styling — not applicable here (pure logic change)
- Refactor if function >20 lines — `getTodayPrefix` is 1 line, no issue
- No code duplication — the new local-date extraction pattern should be a single helper, not duplicated
- Separar lógica y presentación — already satisfied, change is in `db.ts` (service layer)
- Update outdated `.md` files — no architecture docs reference `getTodayPrefix` implementation details

---

## Open Questions

1. **`getNowTimestamp` and `getTimestampForDate`** — these produce timestamps stored in `performed_habits.timestamp` and `mood_entries.timestamp`. They currently return UTC time strings. These are used for display (`formatRelativeBackup`) and for mood/performed queries filtered by `datePrefix` string comparison. Changing them to local time is a cosmetic improvement but not a correctness issue — the date comparison is always done via the `date` column (a `YYYY-MM-DD` key), not via timestamp parsing. **Recommendation:** leave timestamps as UTC ISO for now (it's a standard practice for stored timestamps); only fix the date-key-producing functions.

2. **`isFutureDate` indirectly depends on `getTodayPrefix`** — once `getTodayPrefix` is fixed, `isFutureDate` is automatically correct. No separate change needed.

---

## Sources

- [VERIFIED: ECMAScript spec] `Date.prototype.getDate()`, `getMonth()`, `getFullYear()` return local-time calendar values
- [VERIFIED: codebase] All callers of `getTodayPrefix` traced via grep
- [VERIFIED: codebase] `package.json` confirmed — no date library present
- [ASSUMED] React Native / Hermes inherits device OS timezone (standard behavior, not verified against Expo docs in this session)
