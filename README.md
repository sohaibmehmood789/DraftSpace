# Document Editor

A collaborative document editor assessment built with Next.js App Router,
TypeScript, Tailwind CSS, Tiptap, and Supabase.

## Current status

Login, logout, session refresh, and a protected document dashboard are implemented.
Users can create, rename, edit, save, and reopen documents. The Tiptap editor supports
bold, italic, underline, three heading levels, bulleted and numbered lists, and undo/redo.
Documents and formatting persist in Supabase Postgres. The dashboard separates
owned and shared documents. UTF-8 text file import and owner-managed sharing
are implemented. Deployment and final submission materials are upcoming.

## Requirements

- Node.js 22 LTS or newer (setup verified with Node.js 24).
- npm.
- A free Supabase project for the upcoming database and authentication work.

## Local setup

Run commands from the `document-editor` directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. You will be redirected to the login screen.
Supabase credentials and two confirmed demo users are required to sign in.

When connecting Supabase, copy the environment template:

```sh
cp .env.example .env.local
```

Fill in the project URL and publishable key from your Supabase project settings.
Do not put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.
Restart the development server after changing environment variables.

After applying the migration, verify connectivity and anonymous access restrictions:

```sh
npm run check:supabase
```

## Working with documents

1. Sign in with a demo account.
2. Choose **New document** to open a blank document.
3. Edit the title at the top and write in the page below the formatting toolbar.
4. Changes autosave after a short pause. Use **Save** or **Ctrl/⌘ + S** to save immediately.
5. Wait for **Saved**, or choose **All documents**, which saves before returning.
6. Select the document on the dashboard to reopen it.

Failed saves show an error and preserve the current edits in the editor. Use Save
to retry. The browser warns before refreshing or closing with unsaved changes.
Writes are queued so an older response cannot mark newer edits as saved.
Concurrent changes from another tab produce a conflict instead of silently
replacing its saved content. Copy unsaved work before reloading a conflicted document.
This is basic shared access, not live simultaneous collaboration.

Titles are limited to 200 characters; editor content is limited to 500 KB of JSON.
Drafts are not stored offline: keep the page open until a failed save succeeds.
The editor normalizes pasted content to its supported formatting.

## Importing files

On the dashboard, choose **Import file**, select a file, and choose **Import document**.
The filename (without `.txt`) becomes the title, and the file's text opens in a new
document owned by your account. Edit, format, rename, and save it normally.

- Supported: UTF-8 `.txt` files, up to 100 KB (102,400 bytes).
- Unicode, blank lines, and line breaks are preserved; Windows/Mac line endings
  are normalized. A UTF-8 byte-order mark is removed if present.
- File extensions are case-insensitive. Titles over 200 characters are shortened.
- Empty/whitespace-only files, invalid UTF-8, and binary/control characters are rejected.
- The editor's content size/complexity limits also apply to the converted document.
- HTML and Markdown are imported as literal text, not executed or rendered.
- The original file is not retained as an attachment; converted content is stored
  in the existing documents table. Supabase Storage is not required.

Validation runs on the server as well as basic file checks in the browser.

## Sharing documents

Apply `supabase/migrations/202611180002_list_document_shares.sql` after the initial
migration. Existing projects need only this new migration; do not rerun the initial schema.

1. Sign in as `owner@example.com`, create/open a document, and choose **Share**.
   Current edits are saved before sharing opens.
2. Enter `editor@example.com` and choose **Grant access**.
3. Sign in as the editor in another browser profile/private window. Open
   **Shared with me**, select the document, and edit/save it.
4. Reopen or refresh the owner’s document to see the saved changes.
5. Owners can remove a recipient using **Share → Remove**. Revoked users cannot
   make further saves or reopen the document; its entry disappears after refreshing
   their shared-documents list. An already-open page may retain previously loaded text.

The access list persists and shows names/emails only to the owner. Recipients
cannot list other recipients, grant access, or remove access—even through direct
API requests. Only registered users can receive access; no invitation email is sent.
Repeated sharing does not duplicate access. A recipient can edit content and rename
the document, while ownership remains unchanged. Simultaneous edits use conflict
detection rather than live collaborative merging.

## Demo accounts

Create these confirmed accounts in Supabase Authentication before testing login:

| Account | Email | Demo-only password |
| --- | --- | --- |
| Owner | owner@example.com | DocsDemo2026! |
| Editor | editor@example.com | DocsDemo2026! |

Use **Authentication → Users → Add user → Create new user** and enable **Auto
Confirm User** for each. This creates the users without changing your project's
email-confirmation policy. Their profiles are created by the database trigger.
The login page can fill either demo account. Accounts are intentionally public
for assessment review; use them only with disposable demo documents.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Browser checks (requires a configured Supabase project):

```sh
npx playwright install chromium
npm run test:e2e
```

After both demo users have been created, include successful login, refresh,
account separation, and sign-out checks:

```sh
E2E_DEMO_ACCOUNTS_READY=1 npm run test:e2e
```

If a development server is already running, point the tests at it instead of
starting a second server:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3000 E2E_DEMO_ACCOUNTS_READY=1 npm run test:e2e
```

Without that flag, hosted document tests and the two successful-login tests are explicitly skipped.
Document browser tests create disposable fixtures and remove only those fixtures afterward.

To run the production build locally, run `npm start` after `npm run build`.

## Project structure

- `src/app/`: App Router pages, root layout, and global styles.
- `src/lib/supabase/`: Typed browser/server clients and session refresh helpers.
- `src/proxy.ts`: Refreshes Supabase sessions before rendering.
- `supabase/`: SQL migration and hosted setup instructions.
- `tests/`: Database migration and access-control tests.
- `public/`: Static assets.
- `.env.example`: Supabase environment template without credentials.

## Planned assessment scope

- Two demo accounts and document ownership.
- Create, rename, edit, save, and reopen documents.
- Rich text formatting with Tiptap, stored as JSON in Supabase Postgres.
- Import `.txt` files into editable documents.
- Share with another registered user; show owned and shared documents separately.
- Database access rules, error handling, and a meaningful automated test.
- Vercel deployment, architecture and AI workflow notes, submission checklist,
  and a 3–5 minute walkthrough video.

Real-time simultaneous editing is outside the initial scope.
