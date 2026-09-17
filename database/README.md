# WeGoFit database export

This directory documents the database that belongs to WeGoFit. The authoritative SQL is kept in `../supabase/migrations/` so it can be applied by any Supabase project, whether hosted by Supabase, self-hosted, or managed outside Bolt.

## Move the database

1. Create a new Supabase project or self-hosted Supabase instance.
2. Apply the migration files in timestamp order.
3. Create an administrator account in the new project's Auth dashboard.
4. Copy the new project's URL and public anon key into the web and mobile environment files.
5. Copy only server secrets to the new project's Edge Function secret store.
6. Export/import existing rows separately if the old project already has live users. Schema migrations do not copy user data.

## Important data note

The database contains authentication users and private fitness records. Do not copy the service-role key into the browser or mobile app. Before switching production traffic, take a backup of the old project and verify a test account can sign in, create a profile, save food and workout records, and complete a payment test.

## Current database contents

The migrations create profiles, nutrition and workout logs, water and weight tracking, subscriptions, squad posts and comments, challenge participation, protected RPC functions, and row-level security policies.
