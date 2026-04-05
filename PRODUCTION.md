# Production Readiness Checklist

## Before First Deploy

- [x] Add production domain to CORS whitelist in `middleware.ts` (Vercel `*.vercel.app` auto-allowed)
- [ ] Rotate Supabase credentials (Dashboard > Settings > API > regenerate keys)
- [ ] Rotate OpenAI API key (Dashboard > API keys > create new, revoke old)
- [ ] Update `.env` with new credentials after rotation
- [ ] Migrate API routes to use structured error helpers from `src/lib/api-response.ts`

## Scaling / Multi-Instance

- [ ] Swap in-memory rate limiter for Redis-backed (`@upstash/ratelimit`) in `src/lib/rate-limit.ts`

## Observability

- [ ] Add structured logging (Pino or similar) — replace `console.log`/`console.warn`
- [ ] Add error tracking (Sentry) for API routes and client
- [ ] Add request ID middleware for tracing

## CI/CD

- [ ] Set up GitHub Actions: lint, typecheck, build on every push
- [ ] Add pre-commit hooks (Husky + lint-staged)

## Testing

- [ ] Install test framework (vitest)
- [ ] Add API route tests for core paths (recipes, inventory, auth)
- [ ] Add E2E tests (Playwright) for critical user flows

## Data Safety

- [ ] Enable Row-Level Security policies in Supabase
- [ ] Set up database backups / point-in-time recovery
- [ ] Add soft delete (`deletedAt`) for recipes and user data

## Deployment (Vercel)

- [ ] Push repo to GitHub
- [ ] Connect repo to Vercel (`vercel` CLI or dashboard)
- [ ] Add all env vars from `.env.example` in Vercel project settings
- [ ] Verify health check endpoint (`/api/health`) works in production
- [ ] Add custom domain when ready (update `ALLOWED_ORIGINS` in `middleware.ts`)
