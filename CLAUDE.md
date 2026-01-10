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

This is a **Memory Generator** - a hackathon application that uses Google Gemini AI to generate images of random objects along with nostalgic memories associated with them. Users can edit the generated memories.

**Key Facts:**
- Built with Next.js 16 App Router and React 19
- Deployed on Vercel, automatically synced from v0.app (Vercel's AI design tool)
- Uses Google Gemini 2.0 Flash for text generation and Imagen 3 for image generation
- Client-side UI with Supabase for session persistence
- No testing infrastructure currently implemented

## Local Development Setup

### Environment Variables

Copy `.env.example` to `.env` and fill in your actual credentials:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Gemini API (required for AI generation)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (required for session persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Supabase CLI (for running migrations)
SUPABASE_ACCESS_TOKEN=your_supabase_personal_access_token
```

**Note:**
- Get Supabase credentials from your Supabase project settings
- Generate Gemini API key at https://aistudio.google.com/api-keys
- Generate Supabase Personal Access Token at https://supabase.com/dashboard/account/tokens
- The `.env` file is gitignored to keep credentials secure
- `.env.example` is committed to the repository as a template

### Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (default: http://localhost:3002)
PORT=3002 pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Run database migrations
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d= -f2) supabase db push
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
- **AI:** Google Gemini 2.0 Flash (text) + Imagen 3 (images)
- **Analytics:** Vercel Analytics
- **Theme:** next-themes for dark/light mode

### Project Structure

```
/app                    - Next.js App Router pages
  ├── layout.tsx        - Root layout with analytics & metadata
  ├── page.tsx          - Home page with hero + memory generator
  ├── capture/          - Memory capture page
  │   └── page.tsx      - Memory generator UI
  ├── memories/         - Memories list page
  │   └── page.tsx      - Table view of all memories
  ├── memory/[id]/      - Individual memory detail page
  │   └── page.tsx      - View and edit single memory
  ├── api/              - API routes
  │   ├── generate-object/route.ts - Legacy random object generation
  │   └── analyze-object/route.ts  - Analyze uploaded images with Gemini
  └── globals.css       - Global Tailwind styles with CSS variables

/components             - React components
  ├── memory-generator.tsx - Legacy memory generation UI (not used on capture page)
  ├── photo-capture.tsx    - Photo upload/camera capture with AI analysis
  ├── memories-table.tsx   - Table component for memories list page
  ├── header.tsx        - Navigation with scroll blur effect
  ├── footer.tsx        - Copyright footer
  └── ui/               - shadcn/ui components (Button, Select, Textarea)

/lib                    - Utilities & integrations
  ├── supabase/client.ts - Supabase browser client singleton
  └── utils.ts          - cn() helper for Tailwind class merging

/supabase/migrations    - Database migrations (managed by Supabase CLI)

/public                 - Static assets (images, icons)
```

### Application Flow

1. **Session Creation**: On component mount, generate UUID → stored in sessionStorage
2. **Photo Selection**: User chooses to upload a photo or take one with camera
3. **Camera Mode** (if Take Photo selected):
   - Live camera stream displayed using MediaStream API
   - User positions object and clicks Capture
   - Frame captured to canvas and converted to base64
   - Camera stream stopped
4. **Preview Mode**: User can retake or save the captured/uploaded photo
5. **Background Processing**: When saved:
   - Image processing starts immediately in background
   - UI resets to selection mode (user can capture more objects)
   - API calls Gemini to analyze image and generate description + memory
   - Results saved to Supabase database
6. **Live Feedback**: A "Recent Memories" table below the capture interface polls every 3 seconds to show background processing results
7. **View Memories**: Users can visit /memories to see all saved objects in full table format
8. **Edit Memory**: Click any memory row to view details and edit memory text at /memory/[id]

**State Management:**
- Local React state (`useState`) for UI state and current capture
- MediaStream API for live camera access
- Supabase for persistent session history
- Image analysis happens server-side via API route
- Background processing allows continuous capture workflow

### Database Schema

Table: `object_memories`
```sql
id                   BIGSERIAL PRIMARY KEY
session_id           UUID NOT NULL
object_image_base64  TEXT DEFAULT ''      -- Base64-encoded image
object_description   TEXT DEFAULT ''      -- Object description
object_memory        TEXT DEFAULT ''      -- Nostalgic memory (editable)
created_at           TIMESTAMPTZ DEFAULT NOW()
updated_at           TIMESTAMPTZ DEFAULT NOW()
```

- Row Level Security (RLS) enabled
- Public read/insert/update policies (no authentication required)
- Index on `session_id` for fast lookups
- Each memory is a separate record (same session_id for all records in a browser session)

### Component Architecture

**Key Patterns:**
- **Client Components**: All interactive components use `"use client"` directive
- **Type Safety**: Full TypeScript with strict mode enabled
- **Responsive First**: Mobile-optimized with Tailwind breakpoints (sm/md/lg)

**Color System:**
- Uses modern OkLch color space
- Theme variables defined in `globals.css`
- Dark mode automatic via CSS custom properties

### Supabase Integration

**Client Initialization:**
```typescript
import { getSupabaseClient } from "@/lib/supabase/client"
const supabase = getSupabaseClient()
```

**Critical Note:** The Supabase client is a singleton. Always use `getSupabaseClient()` instead of creating new instances.

**Common Operations:**
```typescript
// Insert new memory record
await supabase.from("object_memories").insert({
  session_id: sessionId,
  object_image_base64: imageBase64,
  object_description: description,
  object_memory: memory,
})

// Update memory text
await supabase
  .from("object_memories")
  .update({
    object_memory: newMemory,
    updated_at: new Date().toISOString(),
  })
  .eq("id", recordId)

// Fetch all memories for a session
await supabase
  .from("object_memories")
  .select("*")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: false })
```

### Gemini API Integration

The `/api/generate-object` route handles AI generation:

1. Selects random object from predefined list
2. Calls Gemini 2.0 Flash to generate description and memory as JSON
3. Calls Gemini 2.0 Flash Image Generation to generate photorealistic image
4. Returns `{ imageBase64, description, memory }`

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

### Modifying Memory Generator

All UI logic is in [components/memory-generator.tsx](components/memory-generator.tsx). Key functions:
- `handleGenerate()`: Triggers AI generation via API
- `handleMemoryChange()`: Updates local memory state
- `handleSaveMemoryEdit()`: Persists edited memory to database
- `saveMemory()`: Appends new generation to database arrays

### Styling Guidelines

- Use Tailwind utility classes (not custom CSS)
- Reference theme colors via CSS variables (`text-foreground`, `bg-background`, etc.)
- Responsive classes: `sm:`, `md:`, `lg:` breakpoints
- Dark mode: automatic via theme variables (no manual dark: prefix needed)

### Database Migrations

SQL migration files are in `/supabase/migrations/`. Run them with Supabase CLI:

```bash
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d= -f2) supabase db push
```

**Current migrations:**
- 20250110000001: Add guess/actual columns (legacy, columns removed)
- 20250110000002: Add Gemini columns (legacy, schema changed)
- 20250110000003: Remove card guessing columns, rename table to kitchen_memories
- 20250110000004: Change to per-record schema with individual columns
- 20250110000005: Rename table to object_memories, rename columns to object_image_base64, object_description, object_memory

### Known Limitations

1. **No Testing**: No test framework configured (Jest/Vitest/Playwright)
2. **Public Database Access**: RLS policies allow anyone to read/write (no authentication)
3. **No Rate Limiting**: API route doesn't limit Gemini API calls
4. **Port Configuration**: Application is configured to run on port 3002 via .env and dev scripts.

## Project Evolution Tracking

### Requirements
- Memory generator with AI-generated content (any objects, not limited to kitchen)
- Google Gemini AI integration for image and text generation
- Session persistence to Supabase database
- Editable memory text after generation
- Dark/light mode theme support
- Mobile-responsive design
- Database debug section displaying current session record for local config verification
- Memories table page showing all saved memories with truncated descriptions (72 chars)
- Individual memory detail page at /memory/[id] for viewing and editing specific memories

### Architectural Decisions
- **Server-side AI generation**: API route handles Gemini calls to protect API key
- **Supabase singleton pattern**: Single client instance via `getSupabaseClient()`
- **Session-based storage**: Each session has unique UUID, no user authentication
- **Tailwind-first styling**: No custom CSS, all styling via Tailwind utilities
- **shadcn/ui for components**: Radix UI primitives with Tailwind styling
- **Gemini API integration**: Server-side API route using Gemini 2.0 Flash and Imagen 3

### Outstanding Issues
- No test coverage (unit, integration, or E2E)
- No user authentication (public database access)
- No error handling for Supabase connection failures
- No rate limiting on AI generation

### Resolution History
- 2026-01-10: Added environment variables setup instructions to CLAUDE.md for local development
- 2026-01-10: Created `.env` file with placeholder values for Supabase credentials
- 2026-01-10: Created `.env.example` template file and updated `.gitignore` to allow it to be committed while ignoring actual `.env` files
- 2026-01-10: Added database debug section to display session record for verifying local Supabase configuration
- 2026-01-10: Added Google Gemini integration to generate kitchen object images, descriptions, and memories
- 2026-01-10: Created API route /api/generate-kitchen-object for server-side Gemini API calls
- 2026-01-10: Added three new database columns (kitchen_images, kitchen_descriptions, kitchen_memories)
- 2026-01-10: Removed card guessing game, converted to Kitchen Memory Generator
- 2026-01-10: Renamed database table from card_guessing to kitchen_memories
- 2026-01-10: Removed wins, losses, guesses, actuals columns from database
- 2026-01-10: Added SUPABASE_ACCESS_TOKEN to .env for CLI authentication
- 2026-01-10: Renamed table from kitchen_memories to object_memories
- 2026-01-10: Renamed columns: kitchen_image→object_image_base64, kitchen_description→object_description, kitchen_memory→object_memory
- 2026-01-10: Renamed API endpoint from /api/generate-kitchen-object to /api/generate-object
- 2026-01-10: Added memories table component to /memories page showing all saved memories with truncated text (72 chars)
- 2026-01-10: Created dynamic route /memory/[id] for viewing and editing individual memories
- 2026-01-10: Replaced auto-generation with photo upload/camera capture on /capture page
- 2026-01-10: Created /api/analyze-object endpoint to analyze uploaded images with Gemini AI
- 2026-01-10: Added PhotoCapture component with upload, camera, preview, retake, and save workflow
- 2026-01-10: Implemented live camera streaming using MediaStream API with real-time preview
- 2026-01-10: Added background processing - images analyzed while user can continue capturing more objects
- 2026-01-10: Removed "generated" mode - users can immediately start new captures after saving
- 2026-01-10: Configured development server to run on port 3002 as per user env requirements
- 2026-01-10: Added "Recent Memories" table to capture page with 3s background polling for live status updates

## Troubleshooting

**Supabase connection issues:**
1. Check environment variables for Supabase URL and anon key
2. Verify RLS policies are enabled on `object_memories` table
3. Ensure `getSupabaseClient()` is used consistently

**Gemini API issues:**
1. Verify GEMINI_API_KEY is set in .env
2. Check API quota at https://aistudio.google.com/
3. Review server logs for API error responses

**Database migrations:**
1. Ensure SUPABASE_ACCESS_TOKEN is set in .env
2. Run `supabase link --project-ref YOUR_PROJECT_REF` first
3. Then run `supabase db push`

**Build errors:**
- TypeScript errors are ignored in Next.js config for development
- Run `pnpm lint` to catch linting issues before deployment

**Style not applying:**
- Verify Tailwind classes are correct (Tailwind 4 syntax)
- Check CSS variable definitions in `globals.css`
- Ensure PostCSS config includes `@tailwindcss/postcss` plugin
