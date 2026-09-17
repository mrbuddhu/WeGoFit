# WeGoFit mobile app

This is the portable Expo entry point for the existing WeGoFit mobile experience. It is independent of Bolt and connects to the same Supabase backend as the web app.

## Run it

Install the dependencies with the Expo-compatible package manager, copy `.env.example` to `.env`, add the new Supabase URL and public anon key, then start Expo. Test location, pedometer, notifications, printing, and sharing on physical devices before publishing.

The current mobile experience originated as an Expo Snack file and is retained as a working entry point while its screens are separated into maintainable files. Do not place service-role keys, payment credentials, or AI keys in this directory.
