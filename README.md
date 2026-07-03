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
npm run build        # Production build (regenerates public/sitemap.xml first)
npm run preview      # Preview production build
npm run lint         # Run all linting (TypeScript, ESLint, Stylelint)
npm run lint:types   # TypeScript typecheck only
npm run lint:js      # ESLint only
npm run lint:css     # Stylelint only
```
