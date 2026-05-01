# Technology Stack: Google Drive Backup

**Project:** Cozy Habits — Google Drive Backup Milestone
**Researched:** 2026-03-17
**Scope:** Additive to existing stack (Expo 54, React Native 0.81, expo-sqlite, Zustand 5)

---

## Recommended Stack (additions only)

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@react-native-google-signin/google-signin` | ^14.x (latest) | Google OAuth + Drive scope | Only library that supports custom Drive scopes reliably in Expo SDK 54. expo-auth-session/providers/google forces a fixed scope set and cannot add drive.file — confirmed open issue. Requires dev client (not Expo Go) but fits managed workflow via config plugin. |

**Why not `expo-auth-session/providers/google`:**
The built-in provider hard-codes its minimum scopes (`openid`, `userinfo.profile`, `userinfo.email`) and there is no documented way to inject `drive.file` or `drive.appdata` on top. This is a confirmed open issue (expo/expo#12793). Additionally, SDK 53/54 introduced instability in the auth flow for the built-in Google provider (documented in production breakage reports, December 2025). Do not use it for Drive access.

**Why not `expo-auth-session` with a custom Google discovery document:**
Technically possible (use `useAuthRequest` directly with Google's discovery endpoint and add scopes manually), but it loses the native sign-in UX, has no `getTokens()` helper, and refresh token handling is manual. More surface area, more bugs, no community pattern to follow.

### Drive API Access

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `fetch` | built-in | Google Drive REST API v3 calls | Zero dependency overhead. Drive API is a clean REST API — upload, download, and list files require 2–3 fetch calls with multipart body. No wrapper needed for a backup-only use case. |

**Why not `react-native-cloud-storage`:**
The library (v2.3.0, last published 5 months ago as of March 2026) adds complexity without meaningful gain for this use case. It requires its own config plugin, its own token provisioning setup, and still needs `@react-native-google-signin` for auth. It abstracts a thin layer over fetch calls we can write directly. Also low download volume — not a widely adopted library. Skip it.

**Why not `@robinbobin/react-native-google-drive-api-wrapper`:**
Convenience wrapper over fetch that does not provide auth. Has no config plugin and unclear Expo SDK 54 compatibility. No reason to add it when the underlying fetch calls are straightforward.

### Token Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-secure-store` | ^14.x (already in Expo SDK 54) | Persist access token and refresh token | Keychain-backed on iOS, Keystore-backed on Android. Correct storage for OAuth tokens. Do not use AsyncStorage (plain-text, not encrypted). |

### Google Drive Scope

| Scope | Purpose | Why |
|-------|---------|-----|
| `https://www.googleapis.com/auth/drive.appdata` | Store backup JSON in app-specific hidden folder | Recommended for backup use cases. Hidden from user's Drive UI. Only the app can read it. Avoids Google's restricted scope verification process (drive.file is non-sensitive; appdata is also non-sensitive). No clutter in the user's Drive root. |

**Why not `drive.file`:**
`drive.file` grants per-file access to files the app creates, and those files ARE visible to the user in their Drive UI. For a backup file that users should not accidentally delete or rename, `appdata` is cleaner. Both avoid Google's OAuth verification burden (neither is a restricted scope).

---

## Full Configuration Overview

### Config Plugin Setup (app.json)

```json
{
  "plugins": [
    "@react-native-google-signin/google-signin"
  ]
}
```

No Firebase required. The config plugin handles native configuration for both platforms.

### GoogleSignin.configure (runtime)

```typescript
GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  webClientId: '<WEB_CLIENT_ID_FROM_GOOGLE_CLOUD_CONSOLE>',
  offlineAccess: true,
});
```

### Drive API call pattern (fetch)

```typescript
// Upload backup
const response = await fetch(
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'multipart/related; boundary=boundary_string',
    },
    body: buildMultipartBody(backupJson),
  }
);

// Download latest backup
const listResponse = await fetch(
  'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)',
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
```

---

## Installation

```bash
# Google Sign-In with Drive scope
npx expo install @react-native-google-signin/google-signin

# expo-secure-store is already bundled with Expo SDK 54 — no install needed
# Verify: npx expo install expo-secure-store
```

After installing, rebuild the dev client:

```bash
eas build --profile development --platform android
# or locally:
npx expo run:android
```

**Note:** This feature cannot be tested in Expo Go. A development build (via EAS or local prebuild) is required.

---

## Expo Go Compatibility

| Feature | Expo Go | Dev Build |
|---------|---------|-----------|
| Google Sign-In | No (native module) | Yes |
| Drive API fetch | Yes | Yes |
| expo-secure-store | Limited | Yes |

This milestone requires switching from Expo Go to a development build for the Google Drive feature. The rest of the app (habits, stats, local backup) continues to work in Expo Go during development.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Google Auth | `@react-native-google-signin/google-signin` | `expo-auth-session/providers/google` | Cannot add Drive scopes; SDK 53/54 instability |
| Google Auth | `@react-native-google-signin/google-signin` | `expo-auth-session` (raw, custom discovery) | Manual refresh token flow, no native UX, fragile |
| Drive access | Native `fetch` | `react-native-cloud-storage` | Thin abstraction, low adoption, extra config plugin |
| Drive access | Native `fetch` | `@robinbobin/react-native-google-drive-api-wrapper` | Unclear Expo SDK 54 compat, adds dep for 3 fetch calls |
| Token storage | `expo-secure-store` | `AsyncStorage` | Plain-text storage; wrong for OAuth tokens |
| Drive scope | `drive.appdata` | `drive.file` | Files visible in user's Drive UI; appdata is cleaner for hidden backups |

---

## Confidence Levels

| Decision | Confidence | Source | Notes |
|----------|------------|--------|-------|
| `@react-native-google-signin/google-signin` as auth library | HIGH | Expo official docs recommend it; confirmed Expo SDK 53+ support (compileSdkVersion ≥ 35 met by SDK 54) | Requires dev build — not a blocker |
| `expo-auth-session/providers/google` scope limitation | HIGH | Open GitHub issue expo/expo#12793; December 2025 breakage report | Confirmed dead-end for Drive scopes |
| `drive.appdata` scope for backup | HIGH | Google Drive API official docs — confirmed non-sensitive scope, no verification process required | Stable API pattern |
| Native `fetch` for Drive REST API | HIGH | Official Google Drive API v3 docs; multiple community implementations confirmed working | Multipart upload pattern is stable |
| `expo-secure-store` for token persistence | HIGH | Expo official docs recommend it explicitly for OAuth tokens | Already in Expo SDK 54 bundle |
| `react-native-cloud-storage` as alternative | LOW | npm page shows v2.3.0 last updated 5 months ago; low adoption | Avoided |
| Exact version of google-signin (^14.x) | MEDIUM | npm shows 1M+ downloads; "over 1M downloads" noted; exact latest version not confirmed in search | Verify with `npm info @react-native-google-signin/google-signin version` before installing |

---

## Sources

- [Expo: Using Google authentication](https://docs.expo.dev/guides/google-authentication/)
- [Expo: AuthSession documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Expo: Authentication overview](https://docs.expo.dev/develop/authentication/)
- [expo/expo GitHub issue #12793: AuthSession for Google can't change scope](https://github.com/expo/expo/issues/12793)
- [React Native Google Sign In: Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo)
- [React Native Google Sign In: Installation](https://react-native-google-signin.github.io/docs/install)
- [React Native Cloud Storage: Expo install](https://react-native-cloud-storage.oss.kuatsu.de/docs/installation/expo/)
- [React Native Cloud Storage: Configure Google Drive](https://react-native-cloud-storage.oss.kuatsu.de/docs/installation/configure-google-drive/)
- [Google Drive API: Store application-specific data (appdata)](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Google Drive API: Choose scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Drive in React Native (cmichel.io)](https://cmichel.io/google-drive-in-react-native)
- [Fixing Broken Google Login After Expo SDK 53 (Medium, Dec 2025)](https://medium.com/@ruveydakayabasi/fixing-the-broken-google-login-after-expo-sdk-53-7872655e0c49)
- [@react-native-google-signin/google-signin on npm](https://www.npmjs.com/package/@react-native-google-signin/google-signin)
