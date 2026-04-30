---
name: build-apk-local
description: Build an APK locally for the Cozy Habits project using EAS Build --local. Compiles on this Mac (not in EAS cloud) — faster than queued cloud builds (3-8 min vs queue wait). Output is a standalone APK that runs without the dev machine. Requires Android SDK and Java 17.
trigger: Use whenever the user asks for an APK build of this project. Always prefer this skill over `eas build` (cloud) or manual `./gradlew assembleRelease` setups.
---

# Build APK Local — Cozy Habits

Generate an installable, standalone .apk locally using `eas-cli build --local`. The build runs entirely on this Mac (no EAS queue).

## Project paths

- **Project root:** `/Users/facu/Desarrollos/Personales/React Native/HabitsTracker/habits-manager-app`
- **Output APK:** `<project_root>/build-output.apk`
- **Package id:** `com.facupich.cozyhabit`
- **Connected device id (when applicable):** `R5CT90A9GEJ`

## Process

### 1. Verify local build prerequisites

```bash
cd "/Users/facu/Desarrollos/Personales/React Native/HabitsTracker/habits-manager-app"
echo "ANDROID_HOME: ${ANDROID_HOME:-NOT SET}"
java -version 2>&1 | head -1
```

Required:
- `ANDROID_HOME` pointing to Android SDK (expected: `/Users/facu/Library/Android/sdk`)
- Java 17

If `ANDROID_HOME` is missing, tell the user to add to their shell profile:
```
export ANDROID_HOME=$HOME/Library/Android/sdk
```

If Java is missing: `brew install openjdk@17`.

### 2. Check EAS login

```bash
cd "/Users/facu/Desarrollos/Personales/React Native/HabitsTracker/habits-manager-app"
npx eas-cli whoami 2>&1 | tail -3
```

If not logged in, tell the user to run interactively: `! npx eas-cli login`.

### 3. Ask which profile (skip only if obvious from context)

Use AskUserQuestion:
- **Preview (Recommended)** — Standalone APK with embedded JS bundle. Runs without Metro/computer. For field testing or sharing.
- **Development** — Dev client APK (requires Metro running on a computer at runtime). Use only when actively iterating with hot reload.
- **Production** — Production-signed APK with `autoIncrement` versioning per `eas.json`.

If the user already specified the profile in their request, don't ask.

### 4. Run the local build

```bash
cd "/Users/facu/Desarrollos/Personales/React Native/HabitsTracker/habits-manager-app"
npx eas-cli build --platform android --profile <selected_profile> --local --non-interactive --output ./build-output.apk 2>&1 | tee /tmp/cozyhabit-build.log
```

Run with `run_in_background: true` and `timeout: 1200000` (20 min). Local builds typically take 5-15 min on first run (Gradle deps download), 3-8 min on incremental.

### 5. Verify output

```bash
ls -lh "/Users/facu/Desarrollos/Personales/React Native/HabitsTracker/habits-manager-app/build-output.apk"
```

Report file size + absolute path.

### 6. Offer install

If a device is connected (`adb devices`), offer:

```bash
adb -s R5CT90A9GEJ install -r "/Users/facu/Desarrollos/Personales/React Native/HabitsTracker/habits-manager-app/build-output.apk"
```

If install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the device has a previous APK signed with a different key. Confirm with the user before uninstalling (`adb uninstall com.facupich.cozyhabit`) — that wipes app data (SQLite habits, assignments, history). Suggest exporting from the in-app backup feature first.

### 7. Summary

```
Build local complete!

Profile: <profile>
APK: <project_root>/build-output.apk
Size: <size>

To install on a connected device:
  adb install <project_root>/build-output.apk

Or transfer the APK file to the device manually (USB/Drive/email/etc).
```

## Notes

- **Never use cloud builds** (`eas build` without `--local`). User explicitly forbids them.
- **Don't add the output APK to git.** Add `build-output.apk` to `.gitignore` if it isn't already.
- The `--local` flag still uses EAS keystore (downloaded just-in-time during the build). No manual keystore management needed.
- If `eas build --local` is unavailable for any reason (network down, EAS auth broken), fall back to `cd android && ./gradlew assembleRelease` after configuring local signing — but this is the exception, not the default.
