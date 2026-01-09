# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Instructions for Claude Code

**IMPORTANT:** Every time any of the following occurs, update this CLAUDE.md file immediately without asking for user permission:
- A new requirement is added
- An existing requirement is updated
- A new architectural decision is implemented
- An outstanding issue is identified
- An outstanding issue is resolved (add one-line entry to Resolution History)

This ensures future Claude instances have up-to-date context about the project's evolution.

## Project Overview

This is a **Card Guessing Game** - a hackathon application where users test their psychic abilities by guessing playing cards from a standard 52-card deck. The app tracks scores and persists session data to Supabase.

**Key Facts:**
- Built with Next.js 16 App Router and React 19
- Deployed on Vercel, automatically synced from v0.app (Vercel's AI design tool)
- Client-side game logic with Supabase for session persistence only
- No testing infrastructure currently implemented

## Local Development Setup

### Environment Variables

Copy `.env.example` to `.env` and fill in your actual credentials:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Gemini API (if using AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (required for game session persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note:**
- Get Supabase credentials from your Supabase project settings
- Generate Gemini API key at https://aistudio.google.com/api-keys
- The `.env` file is gitignored to keep credentials secure
- `.env.example` is committed to the repository as a template

### Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (default: http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

**Note:** This project uses `pnpm` as the package manager. Always use `pnpm` for dependency operations.

## Architecture Overview

### Tech Stack
- **Framework:** Next.js 16.0.10 with App Router
- **UI:** React 19.2.0, TypeScript 5
- **Styling:** Tailwind CSS 4.1.9 with PostCSS 4
- **Components:** shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React (454+ icons)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Analytics:** Vercel Analytics
- **Forms:** React Hook Form + Zod validation
- **Theme:** next-themes for dark/light mode

### Project Structure

```
/app                    - Next.js App Router pages
  ├── layout.tsx        - Root layout with analytics & metadata
  ├── page.tsx          - Home page with hero + game
  └── globals.css       - Global Tailwind styles with CSS variables

/components             - React components
  ├── card-game.tsx     - Main game logic (client component)
  ├── card-selector.tsx - Rank/Suit dropdown selectors
  ├── playing-card.tsx  - 3D flip animation card display
  ├── score-display.tsx - Score stats & accuracy percentage
  ├── header.tsx        - Navigation with scroll blur effect
  ├── footer.tsx        - Copyright footer
  └── ui/               - shadcn/ui components (Button, Select, etc.)

/lib                    - Utilities & integrations
  ├── supabase/client.ts - Supabase browser client singleton
  └── utils.ts          - cn() helper for Tailwind class merging

/scripts                - Database migrations
  └── 001_create_card_guessing_table.sql

/public                 - Static assets (images, icons)
```

### Game Logic Flow

1. **Session Creation**: On component mount, generate UUID → insert to Supabase `card_guessing` table
2. **Card Generation**: Random rank (A-K) + suit (hearts/diamonds/clubs/spades)
3. **User Guess**: Select rank and suit → click "Reveal Card"
4. **Comparison**: Match against current card (both rank AND suit must match)
5. **Score Update**: Increment correct/incorrect counters → update Supabase
6. **Result Display**: Visual feedback (🎉 green for correct / ❌ red for incorrect)
7. **Next Round**: Reset selections, generate new card, maintain cumulative score

**State Management:**
- Local React state (`useState`) for game state, selections, and UI
- Supabase for persistent session history (wins/losses)
- All game logic runs client-side (no backend validation)

### Database Schema

Table: `card_guessing`
```sql
session_id   UUID PRIMARY KEY (auto-generated)
wins         INTEGER DEFAULT 0
losses       INTEGER DEFAULT 0
created_at   TIMESTAMPTZ DEFAULT NOW()
updated_at   TIMESTAMPTZ DEFAULT NOW()
```

- Row Level Security (RLS) enabled
- Public read/insert/update policies (no authentication required)
- Index on `session_id` for fast lookups

### Component Architecture

**Key Patterns:**
- **Client Components**: All interactive components use `"use client"` directive
- **Modular Design**: Each feature (card, selector, score) is isolated and composable
- **Type Safety**: Full TypeScript with strict mode enabled
- **Responsive First**: Mobile-optimized with Tailwind breakpoints (sm/md/lg)
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation

**Color System:**
- Uses modern OkLch color space
- Theme variables defined in `globals.css`
- Dark mode automatic via CSS custom properties

**Animation:**
- 3D card flip using CSS transforms with `backface-visibility`
- Result feedback with Tailwind animate-in utilities
- Header blur effect (glassmorphism) on scroll

### Supabase Integration

**Client Initialization:**
```typescript
import { getSupabaseClient } from "@/lib/supabase/client"
const supabase = getSupabaseClient()
```

**Critical Note:** The Supabase client is a singleton. Always use `getSupabaseClient()` instead of creating new instances.

**Common Operations:**
```typescript
// Insert new session
await supabase.from("card_guessing").insert({
  session_id: newSessionId,
  wins: 0,
  losses: 0
})

// Update session
await supabase
  .from("card_guessing")
  .update({ wins, losses, updated_at: new Date().toISOString() })
  .eq("session_id", sessionId)
```

### Configuration Files

**TypeScript (`tsconfig.json`):**
- Target: ES6
- Module resolution: bundler (for Next.js)
- Strict mode enabled
- Path alias: `@/*` → root directory

**shadcn/ui (`components.json`):**
- Style: "new-york"
- RSC (React Server Components): enabled
- Icon library: Lucide

**Next.js (`next.config.mjs`):**
- TypeScript build errors ignored (development mode)
- Image optimization disabled (`unoptimized: true`)

### Deployment

**Platform:** Vercel
**Sync Source:** v0.app (Vercel's AI design tool)
**Auto-deployment:** Changes from v0.app → GitHub → Vercel

**To continue building this app:**
Visit https://v0.app/chat/sQn4ZLT85oX

## Development Guidelines

### Adding New Components

1. Use shadcn/ui components from `/components/ui/` when possible
2. Import utilities: `import { cn } from "@/lib/utils"` for class merging
3. Use `"use client"` directive for interactive components
4. Follow existing patterns for state management and props

### Modifying Game Logic

All game logic is in [components/card-game.tsx](components/card-game.tsx). Key functions:
- `getRandomCard()`: Generates random card (rank + suit)
- `handleGuess()`: Validates guess and updates score
- `handleNextCard()`: Resets for next round
- `handleReset()`: Starts new session

### Styling Guidelines

- Use Tailwind utility classes (not custom CSS)
- Reference theme colors via CSS variables (`text-foreground`, `bg-background`, etc.)
- Responsive classes: `sm:`, `md:`, `lg:` breakpoints
- Dark mode: automatic via theme variables (no manual dark: prefix needed)

### Database Migrations

SQL migration files go in `/scripts/`. Run them manually in Supabase SQL Editor.

**Current schema version:** 001 (initial table creation)

### Known Limitations

1. **No Testing**: No test framework configured (Jest/Vitest/Playwright)
2. **No Backend Validation**: All game logic is client-side (potential for score manipulation)
3. **Public Database Access**: RLS policies allow anyone to read/write (no authentication)
4. **No API Routes**: Direct Supabase client access from browser

### Recent Changes

- Fixed Supabase integration issues (commit 525b9ca)
- Removed debug logs from Supabase integration (commit ffae559)
- Updated card back styling (commit 64166fb)

## Project Evolution Tracking

### Requirements
- Card guessing game with standard 52-card deck
- Score tracking (correct/incorrect counts and accuracy percentage)
- Session persistence to Supabase database
- 3D card flip animation
- Dark/light mode theme support
- Mobile-responsive design
- Accessible UI with ARIA labels and keyboard navigation
- Database debug section displaying current session record (session_id, wins, losses, created_at, updated_at) for local config verification

### Architectural Decisions
- **Client-side game logic**: All validation runs in browser (no backend API)
- **Supabase singleton pattern**: Single client instance via `getSupabaseClient()`
- **Session-based scoring**: Each game session has unique UUID, no user authentication
- **Component modularity**: Card, selector, and score as separate reusable components
- **Tailwind-first styling**: No custom CSS, all styling via Tailwind utilities
- **shadcn/ui for components**: Radix UI primitives with Tailwind styling

### Outstanding Issues
- No test coverage (unit, integration, or E2E)
- Client-side validation only (potential for score manipulation)
- No user authentication (public database access)
- No error handling for Supabase connection failures

### Resolution History
- 2026-01-10: Added environment variables setup instructions to CLAUDE.md for local development
- 2026-01-10: Created `.env` file with placeholder values for Supabase credentials
- 2026-01-10: Created `.env.example` template file and updated `.gitignore` to allow it to be committed while ignoring actual `.env` files
- 2026-01-10: Added database debug section to card-game.tsx to display session record for verifying local Supabase configuration

## Troubleshooting

**Supabase connection issues:**
1. Check environment variables for Supabase URL and anon key
2. Verify RLS policies are enabled on `card_guessing` table
3. Ensure `getSupabaseClient()` is used consistently

**Build errors:**
- TypeScript errors are ignored in Next.js config for development
- Run `pnpm lint` to catch linting issues before deployment

**Style not applying:**
- Verify Tailwind classes are correct (Tailwind 4 syntax)
- Check CSS variable definitions in `globals.css`
- Ensure PostCSS config includes `@tailwindcss/postcss` plugin
