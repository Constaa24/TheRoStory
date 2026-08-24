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

It runs with an explicit `--config supabase/functions/deno.check.json`,
and that file exists for one reason: `"nodeModulesDir": "none"`. Without
it, Deno sees the `node_modules` at the repo root and insists on resolving
every `npm:` type reference from there. The edge runtime's own type
declarations (`jsr:@supabase/functions-js/edge-runtime.d.ts`) reference
`npm:openai` for the built-in `Supabase.ai` API we don't use, so the check
died with `Could not find a matching package for 'npm:openai'` before it
type-checked a single line of our code. The functions are a Deno project
that merely lives inside an npm project; they should never read that
`node_modules`. The config name is deliberately not `deno.json` so the
Supabase CLI's deploy path — which references import maps by explicit
path in `config.toml` — cannot pick it up.


## Edge function secrets

The six Supabase edge functions read their configuration from Supabase's own
secret store, not from `.env`. Three are injected automatically on every
project (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`);
the five below must be set by hand, and nothing in the build or the deploy
fails if they are missing. The site keeps serving, the forms keep accepting
input, and the mail silently never arrives — so they are listed here rather
than left to be rediscovered.

| Secret | Used by | What breaks without it |
|---|---|---|
| `RESEND_API_KEY` | contact-email, newsletter-subscribe, newsletter-confirm, admin-api | All outbound mail; account deletion stops removing the Resend contact |
| `CONTACT_FROM_EMAIL` | contact-email, newsletter-subscribe | Contact form and newsletter opt-in mail |
| `CONTACT_TO_EMAIL` | contact-email | Where the contact form delivers |
| `NEWSLETTER_FROM_EMAIL` | newsletter-subscribe | Newsletter double opt-in mail |
| `RESEND_WEBHOOK_SECRET` | newsletter-webhook | Svix signature check — every webhook is rejected, so unsubscribes stop syncing back |

Set them against the linked project:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set CONTACT_FROM_EMAIL="The RoStory <hello@therostory.com>"
supabase secrets set CONTACT_TO_EMAIL=you@example.com
supabase secrets set NEWSLETTER_FROM_EMAIL="The RoStory <hello@therostory.com>"
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
```

`supabase secrets list` shows which are present (values are returned as
digests, never in clear). The `CONTACT_FROM_EMAIL` / `NEWSLETTER_FROM_EMAIL`
addresses must be on a domain verified in Resend or delivery fails at the
provider, not here.

## Dependency advisories

`npm audit` currently reports **0 vulnerabilities**, for both `--omit=dev`
and the full tree. Keep it that way; a non-empty audit here is news.

### react-router — GHSA-qwww-vcr4-c8h2 — resolved, keep 7.18.2 or newer

This section used to argue at length that the advisory didn't apply to us,
because the vulnerable code path was React Router's RSC-mode server handler
and this app is a client-rendered SPA in declarative mode. That reasoning
was sound and is no longer needed: the advisory's range is
`>=7.12.0 <7.18.2`, and the project runs **7.18.2**, the release that
patched it.

Worth knowing rather than deleting outright, because 7.18.2 is not an
incidental version number. It is also the fix floor for several other
advisories in the 7.x line — inefficient route matching (DoS), arbitrary
constructor injection via `deserializeErrors()`, the backslash open-redirect
bypass, and RSCErrorHandler protocol validation all require `>=7.18.0`, and
this one requires `.2`. The `^7.18.2` range in `package.json` is what keeps
an `npm install` from ever walking back below that floor — don't loosen it
to `^7` and don't pin it downward.
