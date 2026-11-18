# Supabase setup

## 1. Create the free project

1. Open https://supabase.com/dashboard and create a project on the Free plan.
2. Keep your database password private; the app does not need it.
3. From the project's Connect dialog or API settings, copy the **Project URL**
   and **publishable key**.
4. Copy `.env.example` to `.env.local` in the project root and fill both values.
   Restart Next.js after changes. Never use a secret/service-role key here.

## 2. Apply the database migration

For a new assessment project, open **SQL Editor → New query** in Supabase.
Paste the contents of `migrations/202611180001_initial_schema.sql` and click Run.
Run this migration once. It creates the three tables, indexes, triggers, access
policies, and the `share_document` function in one transaction.

Then run `migrations/202611180002_list_document_shares.sql` in a second SQL Editor
query. It adds the owner-only recipient list used by the sharing dialog. For an
existing project with the initial schema already installed, run **only this new
migration**. It does not change the existing tables or broaden profile access.

The `private` schema must stay outside the Data API's exposed schemas
(the default exposed `public` schema is sufficient).

CLI alternative, if Supabase CLI is installed and authenticated:

```sh
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Use either SQL Editor or CLI for this migration. If you used SQL Editor and later
switch to CLI migrations, reconcile migration history before running `db push`.

After running the migration, use `npm run check:supabase` locally to confirm the
connection, table presence, and that anonymous access is blocked. This check
does not replace signed-in login and sharing verification.

## 3. Create two demo users

In **Authentication → Users → Add user → Create new user**, create:

- `owner@example.com`
- `editor@example.com`

Use the demo-only password `DocsDemo2026!` for both and enable **Auto Confirm User** so reviewers can
sign in without email verification. Do not reuse a personal password. The database
trigger creates each user's profile automatically. Record the demo credentials
for the final README; do not put any production credentials in source control.

## Access model

- Owners can create, read, edit, delete, and share their documents.
- Recipients can read and edit shared documents, but cannot share or delete them.
- Only owners can revoke access by deleting a `document_shares` row.
- Unrelated users cannot read or modify a document.
- Anonymous clients have no access to these tables or the sharing function.
- Owner IDs and creation timestamps cannot be changed through the app API.
- Profiles are readable/editable only by their user. User emails remain in Auth.
- Sharing uses an owner-only RPC to find a registered recipient by exact email;
  it does not expose an email directory. Repeated shares create no duplicates.

Use the signed-in user's client for every request so RLS applies. The app does
not use a service-role key.

## Local database checks

```sh
npm test
```

Tests execute both actual migrations in PGlite (embedded PostgreSQL) and exercise
access as owner, recipient, unrelated user, and anonymous user. A minimal Auth
schema and JWT user ID function stand in for Supabase Auth in tests. These tests
do not verify hosted credentials, actual Auth login, or hosted PostgREST wiring;
those checks need the real Supabase project.

`src/lib/supabase/database.types.ts` mirrors this migration. After connecting a
project, regenerate it if the schema changes:

```sh
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/supabase/database.types.ts
```
