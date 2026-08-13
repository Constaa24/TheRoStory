# The RoStory

A bilingual (English / Romanian) visual storytelling platform dedicated to showcasing Romania's culture, history, traditions, and hidden gems.

## About

The RoStory was born from a desire to correct misconceptions and limited perceptions of Romania encountered abroad. The platform educates people about Romania's rich history, breathtaking nature, warm culture, and unexpected contributions to science and innovation.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 7
- **Routing:** React Router DOM v7
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Animation:** Framer Motion
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Email:** Resend
- **Maps:** d3-geo + TopoJSON (custom SVG map of Romania's 42 counties)
- **Deployment:** Vercel

## Features

### Interactive Story Map
A custom SVG map of all 42 Romanian counties. Counties with stories are highlighted and clickable, zooming in with spring animations to reveal articles tagged to that location.

### Article System
Three content types supported:
- **Text** — Multi-chapter prose articles
- **Video** — Video player with poster images
- **Carousel** — Multi-image slideshows

Each article includes view tracking, favorites, social sharing, comments, and related story suggestions.

### Bilingual Support
Full English and Romanian translations throughout the entire interface.

### Authentication
Email/password and Google OAuth sign-in. Role-based access control with admin, writer, and reader roles.

### Admin Dashboard
Full CMS for managing articles, categories, and users. Supports creating and editing all three story types with media uploads to Supabase Storage.

### Category Browser
Browse stories organized by thematic categories with article counts and filtering.

## Pages

| Route | Description |
|---|---|
| `/` | Hero landing page with filterable article grid and random story discovery |
| `/map` | Interactive county map with story counts and zoom-in panels |
| `/categories` | Category browser with story counts |
| `/category/:id` | Stories within a single category |
| `/article/:id` | Full article viewer with parchment-style design |
| `/my-story` | About page explaining the creator's mission |
| `/support` | Donation page for supporting the project |
| `/contact-us` | Contact form powered by Resend |
| `/profile` | User profile management and favorites |
| `/auth` | Sign in, sign up, and password recovery |
| `/reset-password` | Password reset (recovery-link landing) |
| `/newsletter/confirm` | Newsletter double opt-in confirmation |
| `/privacy`, `/terms` | Privacy policy and terms of use |
| `/admin/*` | Admin dashboard for content and user management |

## Getting Started

```bash
# Navigate to the project directory
cd TheRoStory

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Available Scripts

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run all linting (TypeScript, ESLint, Stylelint)
npm run lint:types   # TypeScript typecheck (src + middleware.ts/api)
npm run lint:js      # ESLint only
npm run lint:css     # Stylelint only
npm run lint:edge    # Type-check the Deno edge functions (requires Deno)
```

`lint:edge` is intentionally outside `npm run lint`: the Supabase edge
functions import via `jsr:` and `https://esm.sh/...` specifiers that `tsc`
cannot resolve, so they need Deno's own checker. It is kept opt-in so the
main lint pipeline doesn't fail on machines without Deno installed. Run it
before deploying changes under `supabase/functions/`:

```bash
npm run lint:edge
```

## Known `npm audit` findings

### react-router — GHSA-qwww-vcr4-c8h2 (high) — accepted, not applicable

`npm audit` reports a high-severity advisory against `react-router`
(7.12.0 – 8.2.0). **It does not apply to this project, and the reported
"fix" is worse than the finding.** Recorded here so it doesn't get
re-litigated on every audit.

**The bug:** in React Router's *RSC mode*, the server handler ran a server
action *before* returning the 400 for a failed CSRF origin check. The
rejection was cosmetic — the mutation had already happened.

**Why it can't reach us:** this app is a purely client-rendered SPA in
*declarative mode* — `<BrowserRouter>` with `<Routes>`/`<Route>`. There is
no React Router server runtime: no `loader` or `action` exports anywhere, no
`react-router.config.ts`, no `entry.server.tsx`, no `@react-router/serve`.
The only server-side code is the Vercel Edge Middleware (`middleware.ts`,
plain `Request`/`Response`) and the Supabase Deno functions, which do their
own origin allow-listing and JWT verification. Every mutation goes through
Supabase behind RLS. The vulnerable handler is never imported, bundled, or
executed.

**Why we didn't "fix" it:** `npm audit fix --force` downgrades to
`react-router-dom@7.11.0` — npm labels this a breaking change itself —
because no patched release above 7.12 existed at the time of writing. That
surrenders seven minor versions of fixes to the router code we *do* run, and
only sticks if the version is pinned (`~7.11.0`), or the next `npm install`
walks straight back into the range. Concrete regression risk traded for a
theoretical one in a mode we don't use.

**When to revisit:**

- A patched 7.x release appears → `npm install react-router-dom@latest`;
  the existing `^7.11.0` range already allows it, no code changes needed.
- **We adopt React Router framework or RSC mode with server actions.** At
  that point the advisory becomes directly exploitable and must be resolved
  *before* shipping.

Until then, expect `npm audit` to keep listing it. That is not a regression.
