---
phase: 02
slug: data-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.js |
| **Quick run command** | `npx vitest run tests/data/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/data/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DATA-05 | unit | `npx vitest run tests/data/validate.test.js -t "month columns"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DATA-05 | unit | `npx vitest run tests/data/validate.test.js -t "collect all"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DATA-06 | unit | `npx vitest run tests/data/parsePnL.test.js -t "null"` | partial | ⬜ pending |
| 02-01-04 | 01 | 1 | DATA-06 | unit | `npx vitest run tests/data/parseExpenses.test.js -t "null"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | DATA-05 | unit | `npx vitest run tests/data/fetchAll.test.js -t "manifest"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/data/validate.test.js` — covers DATA-05 validation logic
- [ ] `tests/fixtures/invalidRows.js` — fixtures for missing headers, empty tabs, non-numeric cells
- [ ] Extend `tests/data/fetchAll.test.js` — validation integration and manifest tests
- [ ] Extend `tests/data/parsePnL.test.js` — non-numeric cell null coercion tests
- [ ] Extend `tests/data/parseExpenses.test.js` — null amount tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Build manifest readable by CFO | DATA-05 | Subjective readability | Run `next build` with valid credentials, check console output format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
