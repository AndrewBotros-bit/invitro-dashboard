# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- JavaScript (ES6+) - Used for all application code
- JSX - React component syntax in `.jsx` files

## Runtime

**Environment:**
- Node.js v24.14.0 - JavaScript runtime environment

**Package Manager:**
- npm - Node Package Manager
- Lockfile: Not detected (no package-lock.json, yarn.lock, or pnpm-lock.yaml found)

## Frameworks

**Core:**
- Next.js 14.2.15 - React-based full-stack framework
- React 18.3.1 - UI library for building components
- React DOM 18.3.1 - React rendering library for web

**Styling:**
- Tailwind CSS 3.4.13 - Utility-first CSS framework
- PostCSS 8.4.47 - CSS transformation tool
- Autoprefixer 10.4.20 - Adds vendor prefixes to CSS

**Visualization:**
- Recharts 2.12.7 - Composable charting library built on React components

**Utilities:**
- clsx 2.1.1 - Utility for constructing className strings conditionally
- tailwind-merge 2.5.2 - Utility to merge Tailwind CSS classes without conflicts

## Key Dependencies

**Critical:**
- recharts 2.12.7 - Provides comprehensive charting components (BarChart, LineChart, PieChart, AreaChart, ComposedChart) used throughout dashboard
- tailwind-merge 2.5.2 - Prevents CSS class conflicts when merging Tailwind utilities, critical for component composition in `lib/utils.js`
- clsx 2.1.1 - Enables conditional className logic used by all UI components

**Build/Development:**
- tailwindcss 3.4.13 - CSS framework dev dependency for building Tailwind classes
- postcss 8.4.47 - CSS processor used with Tailwind in PostCSS pipeline
- autoprefixer 10.4.20 - Auto-prefixes CSS for cross-browser compatibility

## Configuration

**Build Configuration:**
- `next.config.js` - Empty Next.js configuration file, using all defaults
- `tailwind.config.js` - Tailwind CSS configuration with custom color theme (dark slate-based palette with accent colors: blue, violet, amber, green, red, emerald)
- `postcss.config.js` - PostCSS pipeline configured with Tailwind and Autoprefixer plugins
- `jsconfig.json` - JavaScript/JSX configuration with path alias `@/*` pointing to project root for clean imports

**Code Formatting:**
- Imports use path aliases: `@/` resolves to project root (e.g., `@/components/ui/card`, `@/lib/utils`)

## Platform Requirements

**Development:**
- Node.js 24.14.0 or compatible
- npm for package installation
- Web browser with ES6+ support

**Production:**
- Vercel deployment platform (`.vercel/` directory present in project)
- Node.js compatible runtime environment
- Standard HTTP server capabilities

---

*Stack analysis: 2026-03-12*
