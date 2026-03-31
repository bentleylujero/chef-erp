# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

All commands run from the `chef-erp/` directory:

```bash
npm run dev          # Start dev server on port 3000
npm run dev:fresh    # Kill port 3000 first, then start dev
npm run dev:alt      # Start on port 3001 (when 3000 is occupied)
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint.config.mjs)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema to database
npx prisma db seed   # Seed ingredients (prisma/seed.ts)
```

## Architecture

**Next.js 16 App Router** with Tailwind CSS v4, shadcn/ui components, and dark theme by default.

### Stack
- **Database**: PostgreSQL via Prisma (with `@prisma/adapter-pg` driver adapter) + Supabase for auth
- **AI**: OpenAI API (models configured in `src/lib/openai-models.ts`, client in `src/lib/openai.ts`)
- **State**: Zustand for client state, TanStack React Query for server state
- **UI**: shadcn/ui components in `src/components/ui/`, Lucide icons, Recharts for charts

### Key Directories
- `src/app/(dashboard)/` — Main app pages (pantry, cookbook, meal-plan, grocery, insights, chat, explore, food-web, cook/[id], profile)
- `src/app/(auth)/` — Onboarding flow
- `src/app/api/` — Route handlers: ai/, cooking-log/, grocery/, inventory/, meal-plan/, recipes/, preferences/, profile/, onboarding/, pantry-bridge/, network-mesh/, ingredients/, health/, insights/
- `src/lib/engines/` — Core business logic (recipe-matcher, recipe-scaler, cost-calculator, deduplicator, preference-aggregator, topology-builder, pantry-bridge-heuristics, generation-trigger, schedule-new-ingredient-recipes)
- `src/lib/ai/` — AI output schemas (Zod)
- `src/hooks/` — React Query hooks for each domain (use-recipes, use-meal-plan, use-grocery, use-chat, use-cooking-mode, use-insights, use-food-web, use-receipt-scan)
- `prisma/` — Schema and seed data (ingredients organized by category: proteins, produce, dairy, spices, herbs, etc.)

### Path Alias
`@/*` maps to `./src/*`

### Data Flow
- API routes use Prisma (`src/lib/prisma.ts`) for DB access and Supabase (`src/lib/supabase/server.ts`) for auth
- AI recipe generation is tracked via `GenerationJob` records with triggers like onboarding, new ingredients, pantry bridge, cuisine exploration
- Preference signals (cooked, rated, skipped, favorited, purchased, etc.) feed into the preference aggregator engine
- The "food web" visualizes ingredient/recipe relationships using d3-force

### Domain Concepts
- **Pantry Bridge**: Finds recipes that connect disparate pantry ingredients the user hasn't combined before
- **Cuisine Exploration**: Guided progression through unfamiliar cuisines with starter kits and technique paths
- **Generation Triggers**: Multiple AI recipe generation pathways (onboarding batch, new ingredients, expiry rescue, preference drift, etc.)
- **Preference Signals**: Event-sourced user behavior tracking that feeds recipe recommendations
