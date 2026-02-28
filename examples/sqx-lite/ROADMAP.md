# SQX Lite — Nexus Roadmap

**Project:** SQX Lite
**Format:** Nexus ROADMAP v6
**Last Updated:** 2026-02-28

---

phase_1:
  goal: >
    Scaffold the CLI entry point and establish the project structure. By the end of this phase,
    running `sqx-lite --help` works and the CLI parses all flags correctly. No database
    connectivity yet — just the command skeleton.
  risk_tier: low
  tdd_mode: true
  playwright_required: false
  tasks:
    - id: sqx-p1-t1
      title: Initialize npm package with TypeScript and commander
      description: >
        Create package.json, tsconfig.json, and install dependencies: commander, better-sqlite3,
        cli-table3, @types/better-sqlite3. Set up the bin entry point at src/cli.ts.
        The compiled output must be executable via `node dist/cli.js`.
      files_to_touch:
        - package.json
        - tsconfig.json
        - src/cli.ts
        - src/index.ts
      acceptance_criteria:
        - AC-01
        - AC-02
      wave: 1
      dependencies: []

    - id: sqx-p1-t2
      title: Implement argument parsing and flag definitions
      description: >
        Use commander to define: positional args (database, query), --output (table|json),
        --no-pager, --version, --help. All flags must appear in the --help output.
        Write unit tests for the argument parser covering all flags.
      files_to_touch:
        - src/args.ts
        - tests/args.test.ts
      acceptance_criteria:
        - AC-01
        - AC-02
        - AC-03
      wave: 2
      dependencies:
        - sqx-p1-t1

    - id: sqx-p1-t3
      title: Set up Vitest test runner and CI config
      description: >
        Configure Vitest in vitest.config.ts. Add a test npm script. Write a smoke test that
        asserts the CLI exports a run() function. Ensure pnpm test exits 0.
      files_to_touch:
        - vitest.config.ts
        - tests/smoke.test.ts
      acceptance_criteria: []
      wave: 2
      dependencies:
        - sqx-p1-t1

---

phase_2:
  goal: >
    Implement the core query engine: connecting to SQLite databases, executing queries, and
    returning structured results. By the end of this phase, all query execution acceptance
    criteria pass. Error handling for SQL errors and file-not-found errors is complete.
  risk_tier: medium
  tdd_mode: true
  playwright_required: false
  tasks:
    - id: sqx-p2-t1
      title: Implement SQLite connection manager
      description: >
        Create src/db/connection.ts that wraps better-sqlite3. Must handle:
        - File existence check before opening (exits code 2 if missing)
        - Invalid SQLite file detection (exits code 2 with clear message)
        - Successful connection returning a Database instance
        Write unit tests using an in-memory :memory: database.
      files_to_touch:
        - src/db/connection.ts
        - tests/db/connection.test.ts
      acceptance_criteria:
        - AC-04
        - AC-05
        - AC-06
      wave: 1
      dependencies: []

    - id: sqx-p2-t2
      title: Implement query executor with result typing
      description: >
        Create src/db/executor.ts that takes a Database instance and a SQL string and returns:
        - For SELECT: { type: 'rows', columns: string[], rows: unknown[][] }
        - For INSERT/UPDATE/DELETE: { type: 'mutation', rowsAffected: number }
        - On SQL error: throws a SqlError with message and position
        Write unit tests for happy path and error cases.
      files_to_touch:
        - src/db/executor.ts
        - src/db/types.ts
        - tests/db/executor.test.ts
      acceptance_criteria:
        - AC-07
        - AC-08
        - AC-09
        - AC-10
        - AC-11
        - AC-12
      wave: 1
      dependencies: []

    - id: sqx-p2-t3
      title: Wire connection manager and executor into CLI run()
      description: >
        Update src/cli.ts to call ConnectionManager and QueryExecutor in sequence.
        Handle all error types and map them to the correct exit codes (0, 1, 2, 3).
        Write an integration test that uses a real :memory: database.
      files_to_touch:
        - src/cli.ts
        - tests/integration/cli-run.test.ts
      acceptance_criteria:
        - AC-04
        - AC-07
        - AC-10
        - AC-17
      wave: 2
      dependencies:
        - sqx-p2-t1
        - sqx-p2-t2

---

phase_3:
  goal: >
    Implement output formatting and pagination. By the end of this phase, all acceptance
    criteria pass including: table formatting with cli-table3, JSON output, pagination for
    large result sets, --no-pager flag, TTY detection for ANSI colors, and column truncation.
  risk_tier: low
  tdd_mode: true
  playwright_required: false
  tasks:
    - id: sqx-p3-t1
      title: Implement table formatter using cli-table3
      description: >
        Create src/output/table-formatter.ts. Accepts columns and rows, returns a formatted
        table string. Implements column truncation at 50 chars (configurable). Uses ANSI
        colors only when process.stdout.isTTY is true. Write unit tests for formatting,
        truncation, and TTY detection.
      files_to_touch:
        - src/output/table-formatter.ts
        - tests/output/table-formatter.test.ts
      acceptance_criteria:
        - AC-07
        - AC-08
        - AC-16
        - AC-18
      wave: 1
      dependencies: []

    - id: sqx-p3-t2
      title: Implement JSON output formatter
      description: >
        Create src/output/json-formatter.ts. Accepts columns and rows, returns a JSON string
        where each row is an object with column names as keys. Uses JSON.stringify with 2-space
        indentation. Write unit tests.
      files_to_touch:
        - src/output/json-formatter.ts
        - tests/output/json-formatter.test.ts
      acceptance_criteria:
        - AC-14
      wave: 1
      dependencies: []

    - id: sqx-p3-t3
      title: Implement pager for large result sets
      description: >
        Create src/output/pager.ts. When row count exceeds 100 and --no-pager is not set and
        process.stdout.isTTY is true, display rows in pages of 100 with n/p/q navigation.
        When --no-pager is set or stdout is not a TTY, output all rows at once. Write unit tests
        mocking readline. Write integration test with 150-row result set.
      files_to_touch:
        - src/output/pager.ts
        - tests/output/pager.test.ts
      acceptance_criteria:
        - AC-13
        - AC-15
      wave: 1
      dependencies: []

    - id: sqx-p3-t4
      title: Wire all output formatters into CLI and run full acceptance test suite
      description: >
        Update src/cli.ts to route output through the appropriate formatter based on --output flag.
        Route through pager if result is large and pager is not disabled. Run the full test suite
        and ensure all 18 acceptance criteria pass. Fix any gaps found during verification.
      files_to_touch:
        - src/cli.ts
        - tests/integration/full-acceptance.test.ts
      acceptance_criteria:
        - AC-01
        - AC-02
        - AC-03
        - AC-04
        - AC-05
        - AC-07
        - AC-08
        - AC-09
        - AC-10
        - AC-11
        - AC-13
        - AC-14
        - AC-15
        - AC-17
      wave: 2
      dependencies:
        - sqx-p3-t1
        - sqx-p3-t2
        - sqx-p3-t3
