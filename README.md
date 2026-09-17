# WeGoFit

WeGoFit is a fitness coaching product with a responsive web app, an Expo mobile app, and a Supabase backend.

## Portable project layout

- `src/` — web application source
- `mobile/` — standalone Expo application package
- `supabase/migrations/` — database schema and security policies
- `supabase/functions/` — server-side integrations for AI, payments, and receipts
- `database/` — database migration and handover notes
- `public/` — web assets

No part of the application depends on Bolt at runtime. Bolt metadata has been removed from this export.

## Web app

Copy `.env.example` to `.env`, set the web Supabase URL and public anon key, install the root dependencies, and use the existing Vite scripts to run or build the web app.

## Mobile app

The `mobile/` directory is a separate Expo project. Use its environment template and install its dependencies from that directory. The mobile and web apps must use the same Supabase project if accounts and fitness history are meant to be shared.

## Backend

Apply every SQL file in `supabase/migrations/` in timestamp order to the destination Supabase project. Deploy the five functions from `supabase/functions/` using the destination platform's Supabase deployment workflow. The server-side variables listed in `.env.example` belong only in the function environment.

## Before switching production traffic

1. Back up the current database and auth users.
2. Apply the migrations to the destination database.
3. Import existing data and verify foreign keys.
4. Update the web and mobile public configuration to the same destination project.
5. Configure server secrets without placing them in client code.
6. Test sign-up, sign-in, onboarding, logs, AI coaching, payment callbacks, and receipt delivery with a test account.

The mobile app still needs a final device QA pass for GPS, pedometer, push notifications, PDF export, and payment return flows before store submission.
