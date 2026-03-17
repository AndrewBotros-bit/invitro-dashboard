# Testing Patterns

**Analysis Date:** 2026-03-12

## Test Framework

**Status:** No testing framework configured

**Current State:**
- No test runner installed (Jest, Vitest, etc. not in `package.json`)
- No test configuration files detected (`.jest.config.js`, `vitest.config.js`, etc.)
- No test files found in codebase (no `*.test.*` or `*.spec.*` files)
- No testing dependencies in `devDependencies`

**Package.json Scripts:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

No test execution commands defined.

## Test Organization

**Location:** Not applicable (no tests currently)

**Recommendations for Future Implementation:**
- Co-locate test files with source: `components/Dashboard.test.jsx` alongside `components/Dashboard.jsx`
- UI primitives in `/components/ui/` should have corresponding `/components/ui/__tests__/` directory
- Utilities in `lib/` should have tests in `lib/__tests__/`

## Untested Code Areas

**Critical Components:**
- `InVitroDashboard` component (`/components/Dashboard.jsx`) - 536 lines
  - Complex financial dashboard with multiple data transformations
  - Renders 5 major tabs with nested charts and tables
  - Processes annual/monthly financial data
  - No validation of data structure

- UI Primitives (`/components/ui/`) - All untested
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
  - `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - includes state management via React Context
  - `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`
  - `Badge` - supports multiple variants (default, secondary, destructive, outline, success, warning, danger)

- Utilities (`/lib/utils.js`) - Not tested
  - `cn()` function - critical for class merging (combines clsx + tailwind-merge)

**Data Processing:**
- Currency formatting functions: `fmt()`, `fmtShort()`, `pct()`
- Derived data transformations in Dashboard component
- No validation or error handling for financial calculations

## Mocking Recommendations

**What to Mock:**
- External chart library components from `recharts` if testing Dashboard behavior independently
- Context providers in Tabs implementation
- Next.js app router and metadata exports

**What NOT to Mock:**
- Utility functions like `cn()` - these should be tested directly
- Tailwind classes - these are styling only
- Data objects - test with realistic financial data

## Coverage Gaps

**High Priority:**
- `InVitroDashboard` component (`/components/Dashboard.jsx`)
  - Tab switching logic (should render correct content for each tab)
  - Data formatting and display (fmt, fmtShort, pct functions)
  - Conditional rendering of trends and status badges
  - Tooltip rendering with financial data
  - Risk level: HIGH - Financial dashboard, any data display error is visible to stakeholders

- Tabs implementation (`/components/ui/tabs.jsx`)
  - Context state management
  - Active state tracking
  - Tab trigger click handlers
  - Risk level: HIGH - Core UI interaction pattern, used in Dashboard

**Medium Priority:**
- Card and layout components (`/components/ui/card.jsx`)
  - className merging with `cn()`
  - Props spreading and composition
  - Risk level: MEDIUM - UI primitives, styling errors are visible

- Table components (`/components/ui/table.jsx`)
  - All table sub-components render correctly
  - CSS class application for responsive behavior
  - Risk level: MEDIUM - Used for company performance summary display

- Badge component (`/components/ui/badge.jsx`)
  - Variant prop correctly maps to styles
  - Default fallback works when variant is invalid
  - Risk level: LOW - Simple component, visual errors only

**Low Priority:**
- Layout and page components (`/app/layout.jsx`, `/app/page.jsx`)
  - Metadata export
  - Basic page structure
  - Risk level: LOW - Minimal logic

## Suggested Test Structure

**Unit Tests Example for Dashboard:**
```javascript
// components/Dashboard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import InVitroDashboard from './Dashboard';

describe('InVitroDashboard', () => {
  // Test tab switching
  it('renders overview tab by default', () => {
    render(<InVitroDashboard />);
    // Assertions
  });

  it('switches to revenue tab when clicked', () => {
    render(<InVitroDashboard />);
    const revenueTab = screen.getByRole('tab', { name: /revenue/i });
    fireEvent.click(revenueTab);
    // Assertions
  });

  // Test formatting functions
  it('formats currency values correctly', () => {
    // Test fmt() function with various inputs
  });
});
```

**Unit Tests Example for Tabs:**
```javascript
// components/ui/tabs.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

describe('Tabs Component', () => {
  it('displays content for default tab', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('switches content when tab is clicked', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );
    fireEvent.click(screen.getByText('Tab 2'));
    expect(screen.getByText('Content 2')).toBeInTheDocument();
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
  });
});
```

## Recommended Testing Stack

**Framework:** Vitest (preferred for Next.js/React)
- Fast, ESM-native, zero-config option
- Alternative: Jest with babel-jest for JSX support

**Testing Library:** React Testing Library
- Best practices for component testing
- Focuses on user interactions rather than implementation

**Setup Requirements:**
1. Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
2. Configure `vitest.config.js`:
   ```javascript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: './vitest.setup.js',
     },
   });
   ```
3. Update `package.json` scripts:
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

## Risk Assessment

**Current Risk Level: HIGH**

**Why:**
- Financial dashboard with zero test coverage
- Complex data transformations with no validation
- UI state management (Tabs) untested
- Any changes to Dashboard component could break stakeholder-facing data
- No regression protection for formatting functions

**Mitigation Priority:**
1. Add unit tests for formatting functions (fmt, fmtShort, pct)
2. Test Tab context state management
3. Test Dashboard tab switching and content rendering
4. Test critical UI primitives (Card, Table, Badge)

---

*Testing analysis: 2026-03-12*
