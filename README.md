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
cannot resolve, so they need Deno's own checker. It is kept out of
`npm run lint` so the main pipeline doesn't fail on machines without Deno
installed — but CI runs it in its own `edge` job (`.github/workflows/ci.yml`),
so a type error under `supabase/functions/` no longer depends on someone
remembering. Run it locally before deploying changes there:

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


## App icons

**Never edit anything in `public/` by hand.** Every icon is generated:

```bash
npm run icons        # regenerates all nine from brand/logo-master.png
```

`brand/logo-master.png` (512x512, full lockup — illustration *and* the
"RoStory" wordmark) is the only file a human touches. `scripts/generate-icons.mjs`
derives the rest and prints what it measured.

### Why they are generated

The hand-exported set had two faults, and both came from nothing deriving
anything. Every icon was off-centre by the same amount — the artwork sat 22px
from the left of the 512 canvas and 41px from the right, 54 from the top and
67 from the bottom — because they had been cropped to the canvas rather than
to the art. And they carried the wordmark down to 16x16, where it renders as
an unreadable grey smear, and into the 42px navbar logo, where it duplicated
the typeset "The RoStory" sitting directly beside it.

So the icons use the **mark** — the illustration alone. Apple's HIG and
Android's icon guidance both advise against text in app icons, because it is
illegible at the sizes they actually render; the site already spells the name
in HTML text next to the logo. The wordmark survives in the master, and in
`og-image.jpg`, which is the one place it is seen large.

The script finds the mark by measuring the master's alpha channel: the widest
fully-transparent horizontal band inside the artwork is the gutter between
illustration and wordmark, and everything above it is the mark. Nothing is
hardcoded, so re-drawing the logo re-derives the crop. Hardcoding those rows
would reintroduce the drift this replaces.

### The Google Search favicon

`favicon-96x96.png` exists only for Google. Search picks among the icons a page
declares in `<link rel="icon">` / `apple-touch-icon` — it does **not** read the
web app manifest — and it documents wanting a favicon that is a multiple of
48px square. Before this, nothing declared qualified: 16 and 32 are not
multiples of 48, apple-touch is 180, and the `android-chrome-192` that would
have been ideal was manifest-only and therefore invisible to it. Google was
rendering the icon upscaled and soft at 128px as a result.

Search also masks the favicon to a **circle**, so anything beyond the inscribed
circle is cut. That is why this one is drawn at 0.88 rather than full bleed:
measured, its furthest ink sits at 43px against a 48px radius. The 16 and 32
stay full-bleed because browser tab strips are square and every pixel counts
at that size — and they were measured too, at 7.91/8 and 16.14/16, so the
circle costs them nothing either.

**Google caches favicons on its own schedule.** A deploy does not update the
one in search results; expect days to weeks. Requesting indexing on the
homepage in Search Console is the only way to nudge it.

### Two things that are not arbitrary

`apple-touch-icon.png` and `maskable-icon-512x512.png` are **opaque**, on the
manifest's own `background_color`. iOS composites transparency onto black and
applies its own mask; Android crops maskable icons to an OS-chosen shape
(circle, squircle, teardrop) and transparent corners show through as holes.

The maskable icon is drawn at 64% because Android's safe zone is a circle of
radius 40% — 205px of 512. At that scale the mark is 327x208, whose
half-diagonal is 194px, inside 205 with room to spare. Raising the fill past
roughly 0.68 starts clipping corners on a circular mask.


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
