// Public build-time config. EXPO_PUBLIC_* values are inlined into the bundle (never secrets).
// Must be read as `process.env.EXPO_PUBLIC_…` literally for Expo to inline it.

/** Base URL of the API including /api/v1 (see mobile/.env.example). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001/api/v1').replace(
  /\/+$/,
  '',
);
