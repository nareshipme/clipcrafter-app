# ToolNexus — Development Rules

These rules apply to all development on this project. Every agent, contributor, and AI assistant must follow them.

---

## 1. Test-Driven Development (TDD)

- **Write the test first** — always. No implementation without a failing test.
- Follow the **Red → Green → Refactor** cycle:
  1. 🔴 **Red** — write a failing test that defines the desired behaviour
  2. 🟢 **Green** — write the minimum code to make the test pass
  3. 🔵 **Refactor** — clean up without breaking tests
- Unit tests live in `src/**/__tests__/` alongside the code they test
- Every function, utility, and API route must have tests before implementation

## 2. Behaviour-Driven Development (BDD)

- Features are described in **Feature / Scenario / Given / When / Then** language
- Use the BDD helpers in `src/test/bdd.ts` for unit-level BDD tests
- E2E tests in `e2e/` use Playwright with the same BDD structure
- Test names must read like human sentences, not code
- Example:
  ```
  Feature: Video Upload
    Scenario: User uploads a valid video file
      Given a logged-in user on the dashboard
      When they select a valid MP4 file
      Then the file uploads to R2 and a project is created
  ```

## 3. Sequential Commits (Conventional Commits)

- Every commit must be **atomic** — one logical change per commit
- Use **Conventional Commit** format:
  ```
  <type>(<scope>): <short description>
  ```
- Allowed types:
  - `feat` — new feature
  - `fix` — bug fix
  - `test` — adding or updating tests
  - `chore` — tooling, config, dependencies
  - `refactor` — code change without behaviour change
  - `docs` — documentation only
  - `style` — formatting, no logic change
  - `ci` — CI/CD changes
- Commit order for each feature:
  1. `test: add failing test for <feature>` (RED)
  2. `feat: implement <feature>` (GREEN)
  3. `refactor: clean up <feature>` (if needed)
- Never bundle tests + implementation in one commit

## 4. Testing Tools

- **Vitest + React Testing Library** — unit and integration tests
- **Playwright** — E2E and BDD-style feature tests
- Run before every commit:
  ```bash
  npm test          # unit tests
  npm run test:e2e  # E2E tests (requires dev server)
  ```

## 5. Daily Dev.to Post

- Every day, publish one post on [dev.to](https://dev.to) about:
  - A general dev concept, technique, or pattern encountered that day
  - e.g. "How upsert with onConflict works in Supabase", "TDD in TypeScript", "Clerk webhooks with Svix"
- **Posts must be general and educational — NOT about ToolNexus specifically**
  - ✅ "How to sync Clerk users to Supabase with webhooks"
  - ❌ "Building ToolNexus: Wiring Clerk Auth to Supabase"
- Post should be practical, honest, and developer-focused
- Include code snippets where relevant
- Tag appropriately: `nextjs`, `typescript`, `webdev`, `opensource`, etc.
- Keep a log of published posts in `docs/devto-posts.md`

## 6. Open Source Audit

- Regularly review which parts of the codebase can be open sourced
- Criteria for open sourcing a module:
  - No business-sensitive logic (no pricing, no user data handling)
  - Generic enough to be useful to other developers
  - Has good test coverage
  - Well documented
- Candidates to evaluate: utility libs, BDD helpers, R2 upload helpers, Inngest job templates
- Track open source candidates in `docs/opensource-candidates.md`
- When a module is ready, extract it to a separate package under `packages/`

## 7. General

- No feature ships without tests
- No `console.log` left in committed code
- All API keys stay server-side only — never in client components
- Secrets only in `.env.local` — never committed to git

## 8. Manual UI Verification After Every Phase

Before marking any phase complete and moving to the next:

- Boot the dev server (`npm run dev`)
- Visually check every page/route added in that phase using a browser
- Verify: no blank pages, no broken routes, no console errors
- Check: auth flows work end-to-end (sign in, sign up, protected routes)
- Document what was verified in the commit message or a phase-complete note

**Never assume the UI works just because the backend compiles.**

## 9. Mobile-First Design

Every page must be mobile responsive. Test on mobile before marking any phase complete.

- Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) — start mobile, scale up
- No fixed widths that overflow on small screens
- Touch targets minimum 44px
- Text readable without zooming (min 16px base)
- Test at 390px width (iPhone) and 414px (Android) as baseline

## 11. Keep TODO.md Updated

`TODO.md` in the repo root is the single source of truth for what needs doing.

- **When you start a task** → move it to 🚧 In Progress
- **When you finish a task** → move it to ✅ Done
- **When you discover a new issue or production concern** → add it to 📋 Backlog with correct priority
- **After every phase or significant change** → review and update TODO.md
- Update the `*Last updated:` date at the bottom whenever you edit it

Do not let TODO.md go stale. It should always reflect the current state of the project.

---

## 10. Bug Log

Every non-trivial bug found during development must be logged in `docs/bug-log.md`.

### Format
```
## YYYY-MM-DD — [Short bug title]
**Symptom:** What the user/dev saw
**Root cause:** Why it happened
**Fix:** What was changed
**Files:** Which files were modified
**Post-worthy:** Yes/No — if yes, tag it for a future dev.to post
```

### Rules
- Log bugs as they're found — don't batch them later
- Be honest about root cause (don't just say "it was broken")
- If it's a pattern that could bite other devs, mark `Post-worthy: Yes`
- Review the log during daily dev.to post time (Rule 5) — use post-worthy bugs as content

## 12. Code Quality — KISS, DRY, SOLID, YAGNI

After every phase (and before starting the next), do a quick abstraction audit:

**KISS** — Is there a simpler way? Remove layers that don't earn their complexity.
**DRY** — Is logic duplicated? Extract shared utilities (like `callLLM`, `formatSegmentsForHighlights`).
**SOLID** — Single responsibility: one file/function = one job. New providers/features should extend, not modify.
**YAGNI** — Delete speculative code. If it's not used now, don't build it. Stubs are fine only if they're clearly marked `// TODO`.

### Checklist (run after each phase):
- [ ] Any function doing more than one thing?
- [ ] Any logic copy-pasted across files?
- [ ] Any provider/vendor names hardcoded where an abstraction exists?
- [ ] Any `// TODO` stubs that should be real or deleted?
- [ ] Any imports that pull in a whole SDK just for one method?

Document findings in `docs/abstraction-audit.md` with the phase name and what was found/fixed.
