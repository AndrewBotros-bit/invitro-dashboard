---
phase: 3
slug: display-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.js (existing) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DISP-02 | unit | `npx vitest run tests/data/colors.test.js` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DATA-03 | unit | `npx vitest run tests/data/transforms.test.js` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | DATA-03, DISP-03 | integration | `npx vitest run tests/data/transforms.test.js` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | DISP-01 | unit | `npx vitest run tests/data/transforms.test.js` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DATA-03 | unit | `npx vitest run tests/data/insights.test.js` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | INFR-02 | unit | `npx vitest run tests/api/deploy.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/data/colors.test.js` — stubs for DISP-02 color assignment
- [ ] `tests/data/transforms.test.js` — stubs for DATA-03 data transformation
- [ ] `tests/data/insights.test.js` — stubs for insight generation
- [ ] `tests/api/deploy.test.js` — stubs for INFR-02 deploy hook

*Existing test infrastructure (vitest) is already set up from Phase 1+2.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charts render visually correct in browser | DISP-03 | Visual rendering requires browser | Run `npm run dev`, open dashboard, verify all 5 tabs show charts with data |
| Deploy hook triggers Vercel rebuild | INFR-02 | Requires real Vercel deploy hook URL | Set VERCEL_DEPLOY_HOOK_URL env var, click Refresh Data link, verify rebuild starts |
| Company colors are visually distinct | DISP-02 | Color distinction is subjective | Check that 10+ companies have non-clashing colors in charts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
