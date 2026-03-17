---
phase: 01
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (needs install — Wave 0) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DATA-01 | integration | `npx vitest run tests/data/fetchAll.test.js -t "fetches data"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | DATA-02 | unit | `npx vitest run tests/data/parsePnL.test.js -t "discovers companies"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | DATA-04 | unit | `npx vitest run tests/data/parsePnL.test.js -t "header-based"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | INFR-01 | unit | `npx vitest run tests/data/env.test.js -t "env validation"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install vitest: `npm install -D vitest`
- [ ] `vitest.config.js` — configure with path aliases matching jsconfig.json
- [ ] `tests/data/parsePnL.test.js` — unit tests for P&L parser with mock sheet data
- [ ] `tests/data/parseCashflow.test.js` — unit tests for cashflow parser
- [ ] `tests/data/parseExpenses.test.js` — unit tests for expense parser
- [ ] `tests/data/companyMapping.test.js` — name mapping tests
- [ ] `tests/data/fetchAll.test.js` — integration test with mocked googleapis
- [ ] `tests/data/env.test.js` — environment variable validation tests
- [ ] `tests/fixtures/` — mock sheet data matching real layout for deterministic testing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Service account authenticates to real Google Sheet | INFR-01 | Requires real credentials + network | Run `next build` with valid `.env.local` and verify data fetched |
| New company appears in fetched data | DATA-02 | Requires modifying live sheet | Add test company row to sheet, run build, verify in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
