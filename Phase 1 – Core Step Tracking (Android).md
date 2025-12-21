# Phase 1 – Core Step Tracking (Android)

## Goal
Implement **daily step tracking** using **Android Health Connect** and display it in a **clean UI**.
When the app opens, it should read **today’s total steps** from the OS and show them on screen.

No backend, no auth, no leaderboard yet.

---

## Tech Stack (MANDATORY)
- Expo SDK 54 (Bare workflow)
- pnpm (package manager)
- Android Health Connect API
- `react-native-health-connect`
- NativeWind (Tailwind for RN)
- react-native-reusables (shadcn-style components)
- Physical Android device (no Expo Go)

---

## Success Criteria
Phase 1 is complete when:
- Health Connect permission is requested
- Permission is granted
- Today’s steps are read correctly
- Step count matches Google Fit / Health Connect
- Steps are visible in a styled UI
- Manual refresh works

---

## Step-by-Step Tasks

### 1. Install Health Connect
```bash
pnpm exec expo install react-native-health-connect
2. Android Permissions
Add Health Connect permission to:
android/app/src/main/AndroidManifest.xml

xml
Copy code
<uses-permission android:name="android.permission.health.READ_STEPS" />
3. Health Connect Setup
Create a Health Connect service layer.

File: lib/health/healthConnect.ts

Responsibilities:

Check if Health Connect is available

Request READ_STEPS permission

Handle permission denial

Query step records for today

Aggregate total steps

4. Date Utilities
Create helpers to get today’s start/end timestamps.

File: lib/utils/date.ts

Used to:

Calculate midnight → now

Pass correct ranges to Health Connect

5. Permission Flow
On app load:

Check Health Connect availability

If not installed → show UI with “Install Health Connect”

If installed but no permission → request permission

Handle:

granted

denied

permanently denied

6. Read Today’s Steps
After permission:

Query Health Connect for today’s step data

Sum total steps

Store in state

Track last updated timestamp

7. UI Implementation (Important)
Use NativeWind + react-native-reusables.

UI should include:

Card layout

Large step count number

Label: “Today’s steps”

Last updated text

Refresh button

No StyleSheet usage.

8. Manual Refresh
Add:

Refresh button OR pull-to-refresh

Re-fetch steps from Health Connect

Update UI + timestamp

9. Error States
Handle:

Health Connect not installed

Permission denied

No step data

API errors

Display user-friendly messages.

UI Components to Create
Using react-native-reusables:

StepCard

PrimaryButton

ErrorState

EmptyState

Folder Structure (Expected)
txt
Copy code
lib/
  health/
    healthConnect.ts
  utils/
    date.ts

components/
  StepCard.tsx
  ErrorState.tsx
  LoadingState.tsx
What NOT to Do in Phase 1
❌ Auth

❌ Backend

❌ Leaderboard

❌ Friends

❌ Apple Health

❌ Background sync

Testing Checklist
Walk some steps

Open app

Steps appear

Walk more

Refresh

Steps increase

Compare with Google Fit

Definition of Done
Phase 1 is complete when:

“Opening the app reliably shows today’s step count from Health Connect in a clean UI.”
