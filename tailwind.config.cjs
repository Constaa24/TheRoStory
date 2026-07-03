/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		screens: {
  			// Extra-small breakpoint for very tight layouts (e.g. the admin
  			// tab labels). Tailwind's defaults start at sm (640px); without
  			// this, xs: variants silently generate nothing.
  			xs: '480px'
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			// Soft editorial card/button shadow (AdminDashboard cards,
  			// ScrollToTop). Was referenced as `shadow-elegant` for a long
  			// time without a definition — Tailwind silently generated nothing.
  			elegant: '0 8px 30px rgba(0, 0, 0, 0.25)'
  		},
  		fontFamily: {
  			sans: [
  				'Manrope',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'sans-serif'
  			],
  			serif: [
  				'Newsreader',
  				'Georgia',
  				'serif'
  			],
  			display: [
  				'Cormorant Garamond',
  				'Cormorant',
  				'Georgia',
  				'serif'
  			],
  			ui: [
  				'Manrope',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'sans-serif'
  			],
  			mono: [
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'monospace'
  			]
  		}
  		// No custom animation/keyframes here: `.animate-fade-in` is defined
  		// in index.css (fade-in-soft), which won the cascade over the old
  		// Tailwind-generated duplicate anyway. tailwindcss-animate provides
  		// the `animate-in` utilities used elsewhere.
  	}
  },
  plugins: [require("tailwindcss-animate")],
} 