# Auth & account setup checklist (Supabase + Prisma)

Use this when connecting **Chef ERP** to your existing Supabase project and Postgres database.

---

## Part A — Supabase dashboard

- [ ] **1. Open your project**  
  [Supabase Dashboard](https://supabase.com/dashboard) → select the project you want to use.

- [ ] **2. Copy API credentials**  
  **Project Settings** (gear) → **API**:
  - **Project URL** → you will set `NEXT_PUBLIC_SUPABASE_URL`.
  - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (treat as a password; never expose to the browser or commit to git).

- [ ] **3. Auth URLs (recommended for local + production)**  
  **Authentication** → **URL Configuration**:
  - **Site URL**: your production URL (e.g. `https://your-app.vercel.app`) or `http://localhost:3000` for local-only testing.
  - **Redirect URLs**: add each origin you use, e.g.  
    `http://localhost:3000/**`  
    `https://your-app.vercel.app/**`

- [ ] **4. Email sign-in behavior**  
  **Authentication** → **Providers** → **Email**:
  - Note whether **“Confirm email”** is required. If it is, users must confirm before `signInWithPassword` works; align with how you onboard people.
  - The app’s server signup uses `email_confirm: true` on create; your project settings still control whether users must verify via link.

- [ ] **5. (Optional) Google / other providers**  
  Not required for the current email/password flow. Add later if you want OAuth.

---

## Part B — Database (Prisma)

- [ ] **6. Same database for Prisma and Supabase**  
  Your `DATABASE_URL` should point at the **Postgres** instance Supabase provides (or the same DB you use for Prisma migrations).

- [ ] **7. Run migrations** (if you haven’t on this machine)

  ```bash
  cd chef-erp
  npx prisma migrate deploy
  ```

  For local dev with a fresh DB, use `npx prisma migrate dev` if that’s your usual workflow.

- [ ] **8. No extra Prisma table is required for passwords**  
  Passwords live in Supabase **Auth**. App profiles live in the Prisma **`User`** model; new accounts get a row with `id` = Supabase user id.

---

## Part C — Environment variables

Create or edit **`chef-erp/.env`** (and the same variables in **Vercel / your host** for production).

| Variable | Required? | Where it’s used |
|----------|-------------|-----------------|
| `DATABASE_URL` | Yes | Prisma → Postgres |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for signup API | **Server only** — `POST /api/auth/signup` |
| `AUTH_DEV_FALLBACK_USER_ID` | Optional | Non-production only: pretend this Prisma `User.id` when there is no session |
| `INTERNAL_APP_URL` | Optional | Server-to-server calls (e.g. network mesh → generate-batch); default tries `VERCEL_URL` or localhost |

**Example `.env` skeleton** (replace placeholders):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"

NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Optional — local dev without logging in (must exist in Prisma User table)
# AUTH_DEV_FALLBACK_USER_ID="demo-user"
```

Checklist:

- [ ] **9.** `DATABASE_URL` set and valid.
- [ ] **10.** `NEXT_PUBLIC_SUPABASE_*` set (no typos; URL has `https://`).
- [ ] **11.** `SUPABASE_SERVICE_ROLE_KEY` set **only** in server-side env (never `NEXT_PUBLIC_`).
- [ ] **12.** `.env` is listed in `.gitignore` (do not commit secrets).

---

## Part D — Verify the app

- [ ] **13. Install and run**

  ```bash
  cd chef-erp
  npm install
  npm run dev
  ```

- [ ] **14. Test signup**  
  Open [http://localhost:3000/signup](http://localhost:3000/signup), create an account, then complete onboarding if prompted.

- [ ] **15. Test sign-in**  
  Open [http://localhost:3000/login](http://localhost:3000/login) and sign in.

- [ ] **16. Confirm data in Supabase**  
  **Authentication** → **Users**: new user should appear.  
  **Table Editor** → your `User` table (via Prisma): a row with the **same id** as the auth user (UUID string).

- [ ] **17. Production deploy**  
  Add the same variables in the hosting dashboard (Vercel, etc.). Redeploy after changing env vars.

---

## Part E — Optional: dev fallback user (`demo-user`)

Use this when you want the dashboard **without** signing in during local development.

- [ ] **18.** In `.env` (non-production):

  ```env
  AUTH_DEV_FALLBACK_USER_ID=demo-user
  ```

- [ ] **19.** Ensure a Prisma **`User`** row exists with `id = demo-user` (create via onboarding against that id in the past, or insert manually / seed).

- [ ] **20.** Understand the tradeoff: middleware skips forcing login to `/login` in dev when this is set; **do not set this in production.**

---

## Quick troubleshooting

| Issue | What to check |
|--------|----------------|
| Signup returns 500 / “Missing … SERVICE_ROLE” | `SUPABASE_SERVICE_ROLE_KEY` in `.env`; restart `npm run dev`. |
| Signup returns 409 | Email already registered in Supabase Auth. |
| Always redirected to `/login` | Sign in, or set `AUTH_DEV_FALLBACK_USER_ID` in dev only. |
| APIs return 401 | Session cookies not sent (wrong domain/path) or user not logged in; for server routes, cookie must be present on the request. |
| Prisma errors on new user | `DATABASE_URL` points at the DB you migrated; run migrations. |

---

## Routes reference

| Path | Purpose |
|------|--------|
| `/signup` | Create account (API + browser sign-in) |
| `/login` | Email/password sign-in |
| `POST /api/auth/signup` | Server signup (service role + Prisma user) |
| `POST /api/auth/ensure-profile` | Ensures Prisma `User` for current session |
| `GET /api/auth/me` | Current user summary (session or dev fallback) |
