# Stack Research — v1.1 Bienestar Emocional

**Domain:** React Native / Expo managed app — emotional wellbeing capture, visualization & reflection (additive milestone)
**Researched:** 2026-05-05
**Confidence:** HIGH (Context7 + official Expo SDK 54 docs + repo verification)
**Scope:** ADDITIVE only. Does NOT re-research the existing v1.0 stack (Expo 54, RN 0.81, TS 5.9, Zustand 5, expo-sqlite, Google Sign-In). Focuses on the NEW capabilities introduced in v1.1: configurable local push notifications, expanded visualizations, mood input UX, journaling text input, weekly review.

---

## Existing Stack — Verified Against Codebase (DO NOT re-add)

| Concern | Already in `package.json` | Notes |
|---------|---------------------------|-------|
| Mood input slider (0–10) | `@react-native-community/slider@5.0.1` | Used in `ReflectionModal.tsx` with `MOOD_MIN/MAX/STEP/DEFAULT_VALUE` constants. **Reuse for all v1.1 mood inputs.** |
| Charts | `react-native-chart-kit@^6.12.0` + `react-native-svg@15.12.1` | Currently only `PieChart` used in `StatsScreen.tsx:294`. Library also exposes `LineChart`, `BarChart`, `ProgressChart`, `ContributionGraph`, `StackedBarChart`. |
| Text input multiline / voice | `TextInput` (RN built-in) + `useSpeechRecognition` hook | Multiline + mic dictation already wired in `ReflectionModal.tsx` (`DescriptionWithMic`). Reuse pattern for journaling and check-in comments. |
| Local storage / migrations | `expo-sqlite@~16.0.10` + `PRAGMA user_version` | New tables for mood entries / journal / quotes go in migration v2 (additive, no schema break). |
| Haptics on commit | `expo-haptics@15.0.8` | Reuse for check-in submission feedback. |
| Iconography | `lucide-react-native@^0.564.0` | Reuse for new screen icons (book/pen/sparkle/sun/moon). |
| Styling | NativeWind 4.2.1 + Tailwind 3.4.19 | Reuse. Native props (`Slider`) keep their existing pattern of native-style objects (see `ReflectionModal.styles.ts`). |

**Conclusion:** v1.1 reuses existing primitives for mood input, voice dictation, multiline text, charts (mostly), icons, haptics, and styling. The only genuinely new capability is **scheduled local notifications** + **time pickers** for the schedule UI.

---

## Recommended Stack — Additions Only

### Core Additions

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `expo-notifications` | `~0.32.17` (SDK 54 alignment) | Schedule daily morning/evening check-in reminders + weekly review reminder; permission handling; channel management | Official Expo module, fully managed-workflow compatible (no eject). Provides `SchedulableTriggerInputTypes.DAILY` (hour+minute) and `WEEKLY` (weekday+hour+minute) triggers — exact match for our needs. Built-in iOS/Android permission flow via `requestPermissionsAsync`. Background delivery works for local notifications even when app is killed. **Required version comes from `npx expo install expo-notifications` against SDK 54** — confirmed `0.32.17` from `expo/expo@sdk-54` branch. |
| `@react-native-community/datetimepicker` | `~8.4.4` (let `expo install` pin exact) | Native time picker for the user to configure morning / evening / weekly review schedules in Settings | Listed in Expo's supported packages page (works in Expo Go and dev build). Native UI on both iOS and Android. v8.x is what `expo install` resolves for SDK 54; v9.x exists upstream but Expo's resolver is the source of truth — **always install with `npx expo install`**, do not pin manually. |

### Supporting Decisions (no new package)

| Concern | Decision | Why |
|---------|----------|-----|
| Charts for line-over-time (mood avg, sleep avg) | **Reuse** `react-native-chart-kit` `LineChart` | Already in stack; `LineChart` is a documented component of v6.12.0. No new dep. |
| Charts for distribution (mood histogram) | **Reuse** `react-native-chart-kit` `BarChart` | Already in stack. |
| Chart for sleep↔mood correlation | **Use grouped `BarChart`** of mood-avg-per-sleep-bucket (e.g. <5h, 5–6h, 6–7h, 7–8h, 8h+) instead of true scatter | `react-native-chart-kit` does NOT have a scatter component. Bucketed bar chart is more readable for ~30 data points (typical month) than a scatter plot anyway, and avoids adding `react-native-gifted-charts` or `victory-native-xl`. |
| Daily mood heatmap (timeline grid) | **Reuse** `react-native-chart-kit` `ContributionGraph` | Already loaded as a peer when we add `LineChart`. Same color-scale primitive used by the existing GitHub-style heatmap. |
| Mood input UX | **Reuse** `@react-native-community/slider@5.0.1` with the existing `MOOD_MIN/MAX/STEP` config | Hard project requirement: "Escala de mood unificada entre todas las fuentes (componente compartido)". Extract the existing `MoodSection` from `ReflectionModal.tsx` into `src/components/shared/MoodSlider.tsx` and reuse from morning/evening/free-note flows. **No new dep.** |
| Sleep-hours input | **Reuse** the same `Slider` (range 0–12, step 0.5) | Same library, different bounds. Avoids introducing a number stepper component. |
| Journaling text input | **Reuse** `TextInput` (RN built-in) `multiline` + `numberOfLines` + autosave on blur via Zustand store | `ReflectionModal.tsx` already does multiline + voice dictation. Pattern is proven in the codebase. **No new dep.** |
| Check-in flow state machine | **Reuse Zustand 5** | Each check-in is at most 3 fields (mood + sleep + comment). A flat Zustand store slice (`useCheckinStore`) with `draft`, `setMood`, `setSleep`, `setComment`, `submit` is sufficient. **XState would be overkill** for linear forms with no branching. |
| Quotes ("Mis frases de cabecera") | **No new dep.** Use a `quotes` SQLite table (id, text, author, created_at) accessed via the existing Repository → Service → Store pattern | Trivial CRUD, no library justified. |
| Weekly review screen | **No new dep.** Composition of existing `TextInput`s + reuse of stat queries | Saves to a new `journal_entries` table or reuses `mood_entries` with an `entry_type` discriminator (decide in REQUIREMENTS phase). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `expo install expo-notifications` | Resolves the exact version pinned for SDK 54 | Always use `expo install`, never raw `npm install`, to keep version alignment with the SDK matrix. |
| `expo install @react-native-community/datetimepicker` | Same — Expo-pinned version | Same reason. |
| `app.json` plugin entry for `expo-notifications` | Required for proper Android notification icon + iOS background modes | See "Configuration" below. |

---

## Installation

```bash
# Local notifications + scheduling
npx expo install expo-notifications

# Native time picker for schedule configuration UI
npx expo install @react-native-community/datetimepicker
```

That is the **entire** new dependency footprint for v1.1. No chart library swap. No state-machine library. No new mood/slider library.

---

## Configuration — `app.json` plugin block

`expo-notifications` requires a config-plugin entry to embed the small Android notification icon and (optionally) a default sound. Existing `app.json` already lists `expo-font` and `expo-sqlite`; append:

```jsonc
{
  "expo": {
    "plugins": [
      "expo-font",
      "expo-sqlite",
      [
        "expo-notifications",
        {
          // Path is illustrative — actual asset added during phase implementation
          "icon": "./assets/notification-icon.png",
          "color": "#b45309"
        }
      ]
    ]
  }
}
```

`@react-native-community/datetimepicker` does **not** require a plugin entry.

A new dev-client build is required after adding `expo-notifications` (it ships a native module). This is consistent with the existing project workflow which already uses `expo-dev-client@~6.0.20`.

---

## API Sketch (for downstream phase planners)

### Scheduling (one-time setup at user's first interaction or on Settings change)

```typescript
import * as Notifications from 'expo-notifications';

// Daily morning check-in @ 08:00
await Notifications.scheduleNotificationAsync({
  content: { title: 'Buenos días', body: 'Tu check-in matutino te espera' },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: 8, minute: 0,
  },
});

// Weekly review @ Sunday 20:00 (Sunday=1 in Expo's 1–7 scale)
await Notifications.scheduleNotificationAsync({
  content: { title: 'Cierre de semana', body: 'Reflexionemos sobre tu semana' },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: 1, hour: 20, minute: 0,
  },
});
```

### Cancellation when user changes the schedule

```typescript
await Notifications.cancelScheduledNotificationAsync(savedId);
// or wholesale:
await Notifications.cancelAllScheduledNotificationsAsync();
```

Persist the returned identifier in SQLite (settings table) so we can cancel/rebuild on schedule change.

### iOS 64-notification cap

iOS limits scheduled local notifications to 64 system-wide. Cozy Habits will only ever schedule **3 recurring notifications** (morning, evening, weekly) at most, so the cap is irrelevant. **Do NOT** pre-schedule N future occurrences manually — use the `DAILY` / `WEEKLY` recurring triggers, which OS handles internally as a single recurring entry.

---

## Alternatives Considered

| Recommended | Alternative | When the Alternative Would Make Sense |
|-------------|-------------|---------------------------------------|
| `expo-notifications` | `notifee` / `@react-native-async-storage` cron polling | Only if we needed deep notification customization (custom layouts, action buttons that mutate state in background). v1.1 does not. `expo-notifications` ships managed-workflow first; notifee adds config complexity and a second native module. |
| Reuse `react-native-chart-kit` | `react-native-gifted-charts` (supports scatter, radar, bubble, animations) | If a future milestone needs animated/interactive charts (drill-down, tooltips on touch) chart-kit can't deliver. For v1.1 the existing lib covers Line, Bar, Pie, ContributionGraph — sufficient. |
| Reuse `react-native-chart-kit` | `victory-native-xl` (Skia + Reanimated, very fast) | If perf becomes a problem at large datasets (500+ points). Cozy Habits user data is at most ~365 points/year, far below where SVG-based chart-kit struggles. |
| Reuse `@react-native-community/slider` | Custom emoji picker (😀 😐 ☹️) | If product/UX research shows emoji picker improves capture rate. Out of scope for v1.1 — project doc explicitly says "Escala de mood unificada entre todas las fuentes (componente compartido)" → keep slider. |
| Zustand-only check-in flow | XState / `@xstate/react` | If check-ins gain branching (skip questions, conditional follow-ups, A/B variants). v1.1 flows are linear. Don't add a state-machine lib for 3 fields. |
| Reuse RN `TextInput` for journaling | `react-native-rich-editor` / `tiptap-react-native` | Only if rich text (bold/italic/lists) is required. Project doc describes plain comments + reflections — `TextInput` is enough. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-native-gifted-charts` | Adds ~150KB + a second chart paradigm next to chart-kit. v1.1 viz needs are covered by the existing lib. Bucketed `BarChart` replaces the imagined scatter chart with no clarity loss. | Existing `react-native-chart-kit` (Line/Bar/Pie/ContributionGraph). |
| `victory-native-xl` | Requires `react-native-skia` + `react-native-reanimated` worklet contracts and a non-trivial migration. Overkill for ≤365 datapoints. | Existing `react-native-chart-kit`. |
| `notifee` | Two notification systems in one app = footgun. Permission flow and channel management would conflict with `expo-notifications`. | `expo-notifications` only. |
| `react-native-modal-datetime-picker` (a wrapper around datetimepicker) | Adds a dependency on top of datetimepicker just for a controlled-modal API we can write in 30 lines. | `@react-native-community/datetimepicker` directly + a thin wrapper component. |
| `xstate` / `@xstate/react` | v1.1 check-ins are linear forms with at most 3 fields. State machine layer adds cognitive load with zero branching benefit. | Zustand store slice per flow. |
| `react-hook-form` / `formik` | Same — form complexity does not warrant a form library; project already uses local `useState` + Zustand persistence successfully (`ReflectionModal.tsx`). | Local `useState` + Zustand on submit. |
| New mood-input library (e.g. emoji slider, faces picker) | Project doc constraint: "Escala de mood unificada entre todas las fuentes (componente compartido)". Existing slider is the unified scale. | Extract `MoodSlider` shared component from `ReflectionModal`'s `MoodSection`. |
| `expo-secure-store` for notification IDs | Notification identifiers are not secrets. SQLite (already the source of truth) is the right place. | SQLite `settings` table. |

---

## Stack Patterns by Variant

**If user device denies notification permission:**
- Skip scheduling; show an in-app banner on Home/Settings ("Activá las notificaciones para recibir tus check-ins").
- Do not block check-in capture — the screens remain accessible manually.
- Re-prompt only on explicit user action (Settings tap), never automatically.

**If user wants reminders only on weekdays:**
- Schedule 5 `WEEKLY` triggers (Mon=2 ... Fri=6) instead of 1 `DAILY` trigger. Still well under the 64-cap.

**If notification fires while app is foregrounded:**
- Use `Notifications.setNotificationHandler` with `shouldShowBanner: true, shouldPlaySound: false` to keep UX consistent with passive reminder intent.

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `expo-notifications` | `~0.32.17` | `expo@^54.0.33`, `react-native@0.81.5` | Pinned by `expo install`. SDK 54 branch verified on `expo/expo@sdk-54/packages/expo-notifications/package.json`. |
| `@react-native-community/datetimepicker` | `~8.4.x` (whatever `expo install` resolves) | `expo@^54.0.33` | Listed as Expo-supported. Do NOT pin v9.x manually unless Expo's compatibility matrix updates. |
| `react-native-chart-kit` | `^6.12.0` (already installed) | `react-native-svg@15.12.1` | Existing combo; LineChart/BarChart/ContributionGraph all work. |
| `@react-native-community/slider` | `5.0.1` (already installed) | `react-native@0.81.5` | Existing usage in `ReflectionModal.tsx` validated. |

---

## Confidence & Sources

| Claim | Confidence | Source |
|-------|------------|--------|
| `expo-notifications@0.32.17` is the SDK-54-aligned version | HIGH | `expo/expo` repo `sdk-54` branch `packages/expo-notifications/package.json` |
| `expo-notifications` supports `DAILY` + `WEEKLY` recurring triggers | HIGH | Context7 `/websites/expo_dev_versions_sdk_notifications` — `DailyTriggerInput`, `WeeklyTriggerInput`, `SchedulableTriggerInputTypes` |
| `@react-native-community/datetimepicker` is Expo-supported, install via `expo install` | HIGH | `https://docs.expo.dev/versions/v54.0.0/sdk/date-time-picker/` |
| `react-native-chart-kit` lacks scatter chart | HIGH | npm/GitHub README of `react-native-chart-kit` + multiple corroborating articles |
| `react-native-chart-kit` supports Line/Bar/Pie/Progress/ContributionGraph | HIGH | npm README + existing usage in `StatsScreen.tsx` |
| iOS 64-notification cap does not apply when using a single recurring `DAILY`/`WEEKLY` trigger | HIGH | Apple `UNUserNotificationCenter` docs + Expo notifications docs |
| Existing slider 0–10 is the project's unified mood scale | HIGH | `.planning/PROJECT.md` v1.1 Key context + `src/config/constants.ts` (`MOOD_MIN/MAX/STEP`) + `ReflectionModal.tsx:11` |

---

*Last updated: 2026-05-05 — v1.1 Bienestar emocional research. Net new dependencies: `expo-notifications`, `@react-native-community/datetimepicker`. Everything else: reuse.*
