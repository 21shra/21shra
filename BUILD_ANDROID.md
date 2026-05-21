# BillShiHai – Build APK & AAB

## Prerequisites
- Node.js 18+
- Expo account (free): https://expo.dev/signup
- Install EAS CLI:
  ```bash
  npm install -g eas-cli
  ```

## Steps

### 1. Clone this repo
```bash
git clone <your-github-url>
cd <repo>/frontend
yarn install
```

### 2. Login to Expo
```bash
eas login
```

### 3. Link project
```bash
eas init --id <leave-blank-to-create-new>
```

### 4. Build APK (for sideload / testing)
```bash
eas build --platform android --profile preview
```
Download URL appears after ~15 min in EAS dashboard.

### 5. Build AAB (for Google Play Store)
```bash
eas build --platform android --profile production
```

### 6. Submit to Play Store (optional)
```bash
eas submit --platform android --latest
```

## Configuration Already Set
- ✅ `app.json` — `android.package: "com.billshihai.app"`, `versionCode: 1`
- ✅ Android permissions: `CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`
- ✅ iOS Info.plist usage descriptions
- ✅ `eas.json` — preview (APK) + production (AAB) profiles

## Backend
The Android app calls the backend at `EXPO_PUBLIC_BACKEND_URL` (set in `frontend/.env`).
**Before building APK, deploy your backend to a stable URL** (Emergent Publish or any host),
then update `EXPO_PUBLIC_BACKEND_URL` in `.env` to that URL.

## Costs
- EAS Build free tier: 30 builds/month
- Google Play Console: $25 one-time

## Required Backend env vars on deployment
- `MONGO_URL` (MongoDB Atlas URI)
- `DB_NAME`
- `EMERGENT_LLM_KEY` (or your own OpenAI/Anthropic/Gemini key)
