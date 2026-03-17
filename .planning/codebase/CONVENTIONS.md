# Coding Conventions

**Analysis Date:** 2026-03-12

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `Dashboard.jsx`, `Card.jsx`)
- UI primitives: PascalCase (e.g., `badge.jsx`, `card.jsx` - lowercase directory, PascalCase exports)
- Utilities: camelCase (e.g., `utils.js`)
- Config files: kebab-case or conventional names (e.g., `next.config.js`, `tailwind.config.js`)

**Functions:**
- Component functions: PascalCase (e.g., `function KPICard()`, `function InVitroDashboard()`, `function CustomTooltip()`)
- Helper/utility functions: camelCase (e.g., `fmt()`, `fmtShort()`, `pct()`)
- Sub-components within files: PascalCase when extracted as functions (e.g., `KPICard`, `InsightCard`)

**Variables:**
- Data objects: camelCase (e.g., `monthly2026`, `annual`, `cashflow2026`, `companies`, `watchMetrics`)
- Constants (objects/arrays): camelCase (e.g., `months`, `revenueByMonth`, `ebitdaByMonth`)
- Color map: Single uppercase letter `C` for color constants (e.g., `C.allrx`, `C.positive`)
- Context: camelCase (e.g., `TabsContext`)

**Types:**
- No explicit type annotations in use (JavaScript/JSX, not TypeScript)
- Variant props use string literals (e.g., `variant = "default"`)
- JSDoc comments for component props when present

## Code Style

**Formatting:**
- No explicit formatter configuration (ESLint or Prettier) detected in config files
- Indentation: 2 spaces (observed throughout)
- Line breaks: Single blank lines between logical sections
- Semicolons: Present at end of statements
- Quotes: Double quotes for strings (e.g., `"use client"`, `"rounded-lg"`)

**Linting:**
- No `.eslintrc` file detected
- No TypeScript configuration (using JavaScript/JSX with JSX syntax)

## Import Organization

**Order:**
1. React imports (`import React from "react"`, `import { useState } from "react"`)
2. Third-party library imports (e.g., `from "recharts"`, `from "clsx"`)
3. Local component imports (e.g., `from "@/components/ui/card"`)
4. Local utility imports (e.g., `from "@/lib/utils"`)

**Path Aliases:**
- `@/*` resolves to project root (defined in `jsconfig.json`)
- Used consistently: `@/components/`, `@/lib/`
- Example: `import { cn } from "@/lib/utils"`

## Error Handling

**Patterns:**
- Conditional rendering with optional chaining and null checks (e.g., `if (!active || !payload) return null;`)
- Logical operators for fallbacks (e.g., `context?.value !== value` with conditional return)
- No explicit try-catch blocks observed in codebase
- UI components handle missing data through conditional rendering

## Logging

**Framework:** console (no logging framework detected)

**Patterns:**
- No console logging found in examined code
- No structured logging implementation

## Comments

**When to Comment:**
- Section headers with visual separators: `/* ── Formatters ── */`, `/* ── Colors ── */`
- Complex business logic groupings marked with separators
- Minimal inline comments; code is generally self-documenting

**JSDoc/TSDoc:**
- No JSDoc annotations observed
- Component props documented through example usage rather than explicit comments

## Function Design

**Size:**
- Small, focused functions preferred
- Utility formatters are concise one-liners (e.g., `const fmt = (v) => { ... }`)
- Sub-components typically 10-20 lines

**Parameters:**
- Destructured props (e.g., `function KPICard({ title, value, subtitle, trend, trendUp })`)
- Optional parameters with default values (e.g., `type = "info"`)
- Spread operator for remaining props (e.g., `...props`)

**Return Values:**
- JSX from component functions
- Formatted strings from utility functions
- Conditional null returns for conditional rendering

## Module Design

**Exports:**
- Default export for main components (e.g., `export default function InVitroDashboard()`)
- Named exports for UI primitives (e.g., `export { Card, CardHeader, ... }`)
- Barrel exports from component collections (e.g., `export { Tabs, TabsList, TabsTrigger, TabsContent }`)

**Barrel Files:**
- UI components grouped in `/components/ui/` directory with individual exports
- Example: `card.jsx` exports five related card sub-components in single file

## Component Structure

**Patterns:**
- Inline component definitions in single file when related (e.g., `CardHeader`, `CardTitle`, `CardContent` in `card.jsx`)
- Sub-components for complex visualizations (e.g., `CustomTooltip`, `KPICard`, `InsightCard` in `Dashboard.jsx`)
- Data structures defined at module level, before component definitions
- Context creation with `React.createContext()` for state management

**Data Organization:**
- Financial data stored as constants at module top
- Derived data computed from base constants using `.map()`
- Color schemes defined as object constants (`const C = { ... }`)

## Styling

**Framework:** Tailwind CSS with utility classes

**Patterns:**
- All styling through Tailwind utility classes in `className` prop
- `cn()` utility function (from `@/lib/utils`) for conditional class merging:
  - `cn("base-classes", conditionalClass, className)`
  - Combines `clsx` and `tailwind-merge` for smart class deduplication
- Inline styles for dynamic values (e.g., `style={{ color: entry.color }}`)
- CSS custom properties for theme colors (defined in `app/globals.css`)

**Component Composition:**
- Composable sub-components with className prop forwarding
- Example: `Card` accepts `className` and spreads to div with `{...props}`

---

*Convention analysis: 2026-03-12*
