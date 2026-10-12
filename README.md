# Toko Bangunan

An offline-first point-of-sale and stock app for a building-materials shop. It runs in the browser as an installable PWA. Everything the shop does is stored on the device first (IndexedDB), then copied to Supabase when the owner is signed in and online.

- Frontend: Vite, React, Dexie. Static files only, so any static host works.
- Cloud copy: one Supabase table, `public.events`, append-only and protected by row-level security. Every screen's data is rebuilt from that event log.

## Develop

```
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run lint
npm run test:e2e     # builds, serves on :4173, runs Playwright (2 workers)
```

Without a `.env` the app runs fully local, with no sync. To try sync, copy `.env.example` to `.env` and fill in the two `VITE_SUPABASE_*` values.

## Deploy (free): Cloudflare Pages + Supabase

### 1. Supabase

1. Create a project at supabase.com (free plan).
2. SQL Editor: run `supabase/migrations/0001_events.sql`.
3. Authentication, Sign In / Providers: turn **off** "Allow new users to sign up".
4. Authentication, Users: add the owner (and any staff) by hand, with a strong password. There is no sign-up screen in the app.
5. Copy the project URL and the `anon` key (Project Settings, API). The `anon` key is meant to be public; row-level security is what protects the data. **Never** put the `service_role` key anywhere in this app or in Cloudflare.
6. Check the lock: with the `anon` key and no login, `GET /rest/v1/events` must return `[]`, and an insert must be refused.

### 2. Cloudflare Pages

1. Workers & Pages, Create, Pages, connect this GitHub repo.
2. Build command `npm run build`, output directory `dist`.
3. Environment variables (Production and Preview):
   - `NODE_VERSION` = `22`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   The two `VITE_` values are baked into the build, so changing them needs a new deploy.
4. Every push to `main` deploys. Every other branch gets a preview URL; check changes there first. A bad deploy can be rolled back from the Pages dashboard.

`public/_headers` sets no-cache on `index.html` and the service worker, so a new deploy is never hidden behind a cached copy. Routes need no redirect rule: Pages serves `index.html` for unknown paths when there is no root `404.html`.

### 3. First use

Open the site, go to Akun (`/masuk`), sign in once on each device, and let the first sync finish. Install the app from the browser menu ("Install" / "Add to Home Screen").

## How updates reach a device

A push deploys new files. Each device fetches the new version the next time the app loads and takes it over at once; there is no manual step. A tab left open across a deploy keeps running the old version until it reloads, and if that tab then opens a screen it had not visited yet, the app reloads itself once to get the new version (`src/app/staleChunkReload.ts`).

## Keeping the data safe

Three independent copies, so no single failure loses the shop:

1. **The device.** Always the first copy. The app asks the browser not to evict it (`persistentStorage.ts`).
2. **Supabase.** Synced whenever the owner is signed in and online.
3. **Encrypted daily backups** in a private GitHub repo (below), plus a file the owner can download at any time from Akun, **Unduh cadangan**. That file works offline and signed out. Keep a copy somewhere other than the shop's computer.

The free Supabase plan has no backups of its own, and it pauses a project after about a week without activity. If the shop is closed for longer, resume the project from the Supabase dashboard before the first sync. The daily backup connects to the database, which probably counts as activity, but check this rather than rely on it.

### Backups (GitHub Actions)

`.github/workflows/backup.yml` runs daily (02:17 Jakarta) and on demand. It dumps `public.events`, encrypts it with `age`, and commits the file to a separate private repo, keeping the last 30.

One-time setup:

1. Create an empty **private** repo named `tokobangunan-backups` under the same account.
2. Make an encryption key pair on a trusted computer (`winget install FiloSottile.age`, then):
   ```
   age-keygen -o backup-key.txt
   ```
   It prints `Public key: age1...`. Keep `backup-key.txt` offline (a password manager and a printed copy); without it the backups cannot be opened. It never goes into any repo.
3. Create a fine-grained personal access token limited to the `tokobangunan-backups` repo, with **Contents: Read and write**.
4. In this repo, Settings, Secrets and variables, Actions, add:
   - `SUPABASE_DB_URL`: Supabase, Connect, **Session pooler** connection string (port 5432, user `postgres.<ref>`) with the database password filled in. Use the pooler, not the direct connection: the direct one is IPv6-only and GitHub's runners cannot reach it.
   - `BACKUP_AGE_PUBLIC_KEY`: the `age1...` public key.
   - `BACKUP_REPO_TOKEN`: the token from step 3.
5. Actions, "Back up the database", **Run workflow**. Check that a file appears in the backup repo and that the run summary shows a plausible event count. Failed runs email the repo owner.

GitHub switches off scheduled workflows in a **public** repository after 60 days without activity. If this repo is public, re-enable the schedule if that happens, or keep it private.

### Restore

1. Supabase: for a fresh project, run `supabase/migrations/0001_events.sql` and add the owner user (Authentication, Users). For the same project, skip this.
2. Decrypt the newest file:
   ```
   age -d -i backup-key.txt events-2026-10-12.sql.gz.age | gunzip > events.sql
   ```
3. A fresh project gives the owner a new user id, but every row carries the old one. Find the old id in `events.sql` (the `owner_id` column of any row) and swap it:
   ```
   sed "s/<old-owner-uuid>/<new-owner-uuid>/g" events.sql > restore.sql
   ```
   Restoring into the same project needs no swap.
4. Load it, and reset the counter:
   ```
   psql "<session pooler url>" -f restore.sql
   psql "<session pooler url>" -c "select setval(pg_get_serial_sequence('public.events','server_seq'), (select max(server_seq) from public.events));"
   ```
5. Devices catch up on their next sync. Anything a device recorded that is not in the backup is still in that device's own outbox and uploads then.

Do a restore drill into a throwaway Supabase project once, before you need it for real.

## Notes

- Owner and staff accounts are created by hand in Supabase (step 4 above); the app never creates accounts.
- `design-system/` and `docs/` are ignored by git on purpose.
