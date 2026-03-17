# Codebase Structure

**Analysis Date:** 2026-03-12

## Directory Layout

```
invitro-dashboard/
├── app/                       # Next.js App Router pages and layout
│   ├── layout.jsx             # Root HTML layout, metadata
│   ├── page.jsx               # Home page (/)
│   └── globals.css            # Global styles and CSS variables
├── components/                # Reusable React components
│   ├── Dashboard.jsx          # Main dashboard container (all logic + data)
│   └── ui/                    # UI primitive components
│       ├── card.jsx           # Card, CardHeader, CardTitle, CardContent, etc.
│       ├── tabs.jsx           # Tabs, TabsList, TabsTrigger, TabsContent
│       ├── badge.jsx          # Badge component
│       └── table.jsx          # Table, TableHeader, TableBody, TableCell, etc.
├── lib/                       # Utility functions and helpers
│   └── utils.js               # cn() for Tailwind class merging
├── public/                    # Static assets (images, icons, etc.)
├── package.json               # Dependencies and npm scripts
├── jsconfig.json              # Path aliases (@/* = current directory)
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── next.config.js             # Next.js configuration
└── .gitignore                 # Git ignore rules
```

## Directory Purposes

**app/:**
- Purpose: Next.js App Router directory containing pages and layouts
- Contains: Page components (.jsx), layout components, global styles
- Key files: `page.jsx` (entry point), `layout.jsx` (root wrapper), `globals.css` (theme)

**components/:**
- Purpose: Reusable React components (pages, layouts, primitives)
- Contains: Dashboard component, UI building blocks
- Key files: `Dashboard.jsx` (main application logic)

**components/ui/:**
- Purpose: UI primitive components (Cards, Tabs, Badges, Tables)
- Contains: Unstyled or minimally styled component wrappers
- Key files: `card.jsx`, `tabs.jsx`, `badge.jsx`, `table.jsx`

**lib/:**
- Purpose: Utility functions and shared helpers
- Contains: Pure functions, helpers, constants
- Key files: `utils.js` (class merging utility)

**public/:**
- Purpose: Static files served directly by Next.js
- Contains: Images, icons, favicons, fonts
- Key files: None created yet

## Key File Locations

**Entry Points:**
- `app/page.jsx`: Home route - imports and renders InVitroDashboard
- `app/layout.jsx`: Root layout - wraps all pages with HTML structure and metadata

**Configuration:**
- `jsconfig.json`: Path alias (@/* = .) for imports
- `tailwind.config.js`: Tailwind theme extension (colors, border radius)
- `next.config.js`: Next.js runtime configuration (currently empty)
- `postcss.config.js`: PostCSS/Tailwind processing

**Core Logic:**
- `components/Dashboard.jsx`: All financial data, calculations, visualizations, and UI rendering
  - Lines 12-30: Format helper functions and color constants
  - Lines 35-103: Financial data objects and derived datasets
  - Lines 106-150: Sub-component definitions (CustomTooltip, KPICard, InsightCard)
  - Lines 171-535: Main render function with tab routing and layout

**Styling:**
- `app/globals.css`: CSS custom properties (color palette), Tailwind directives
- `tailwind.config.js`: Tailwind theme extensions

**Testing:**
- No test files present in codebase

## Naming Conventions

**Files:**
- PascalCase for components: `Dashboard.jsx`, `Card.jsx`, `Tabs.jsx`
- lowercase for utilities: `utils.js`, `globals.css`
- PascalCase for named exports: `Dashboard`, `Card`, `Tabs`

**Directories:**
- lowercase singular/plural based on contents:
  - `app/` (Next.js convention)
  - `components/` (multiple components)
  - `ui/` (UI subdirectory)
  - `lib/` (utility functions)
  - `public/` (static files)

**Functions:**
- camelCase for functions: `fmt()`, `fmtShort()`, `pct()`
- PascalCase for React components: `InVitroDashboard`, `KPICard`, `CustomTooltip`

**Variables:**
- camelCase for data: `monthly2026`, `consolidatedRevGrowth`, `monthlyBurn`
- UPPERCASE for constants: `C` (color object)
- Abbreviations used: `fmt` (format), `pct` (percent), `rev` (revenue), `ebitda`, `mo` (month)

**Types:**
- No TypeScript used - all JavaScript
- No PropTypes or type definitions

## Where to Add New Code

**New Feature (e.g., new tab or financial metric):**
- Primary code: `components/Dashboard.jsx`
  - Add data object in lines 35-70 section
  - Add derived dataset in lines 72-103 section
  - Add new TabsContent component in lines 204-524 section
- Tests: Create `components/Dashboard.test.jsx` (does not exist)

**New Component/Module:**
- Reusable UI component: `components/[ComponentName].jsx`
  - Use `cn()` utility from `lib/utils.js` for Tailwind class merging
  - Export named functions
  - Follow Card/Tabs/Badge pattern of composable subcomponents
- Utility function: `lib/[utilities].js`
  - Export named functions
  - Use camelCase naming

**Utilities:**
- Shared helpers: `lib/utils.js`
- Format functions: Add to `components/Dashboard.jsx` (currently inline) or extract to `lib/formatters.js`
- Color constants: Extract from `Dashboard.jsx` lines 26-30 to `lib/colors.js` for reuse

**Styling:**
- Global styles: `app/globals.css` (CSS variables and Tailwind directives)
- Component-specific styles: Use `className` props with Tailwind utility classes
- Theme variables: `tailwind.config.js` (color, border-radius extensions)

## Special Directories

**node_modules/:**
- Purpose: npm package dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (in .gitignore)

**.next/:**
- Purpose: Next.js build output cache
- Generated: Yes (created by `npm run build` or `npm run dev`)
- Committed: No (in .gitignore)

**.vercel/:**
- Purpose: Vercel deployment configuration
- Generated: Yes (created during Vercel deployment)
- Committed: No (in .gitignore)

## Module Resolution

**Path Aliases:**
- `@/*` resolves to project root (configured in `jsconfig.json`)
- Used in imports: `import { Card } from "@/components/ui/card"`
- Simplifies relative import paths

**Import Patterns:**

Relative imports for sibling/nearby files:
```javascript
// App entry point
import InVitroDashboard from '../components/Dashboard'
```

Alias imports for absolute path clarity:
```javascript
// UI components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Utilities
import { cn } from "@/lib/utils";
```

## File Organization Summary

**Single-responsibility principle NOT followed:**
- `components/Dashboard.jsx` contains all financial logic, data, helper functions, sub-components, and rendering
- Should be split into: data layer, formatters, components, but currently monolithic

**Component composition hierarchy:**
- `app/page.jsx` → `InVitroDashboard` → `Tabs` → `TabsContent` → `Card` + `KPICard` + `InsightCard` + Charts

**Data flow:**
- Hard-coded data in `Dashboard.jsx` → Derived datasets → Passed to charts/components as props

**Styling approach:**
- Tailwind-first: All styling via className utilities and CSS variables
- CSS custom properties for theming (dark mode enabled by default)
- No CSS modules or styled-components

---

*Structure analysis: 2026-03-12*
