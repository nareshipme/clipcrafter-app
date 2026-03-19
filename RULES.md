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
  - A development challenge we encountered that day, OR
  - A topic/technique we worked on (TDD, BDD, R2 uploads, Clerk webhooks, etc.)
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
