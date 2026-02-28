# SQX Lite — Acceptance Master

**Project:** SQX Lite
**Version:** 1.0.0
**Last Updated:** 2026-02-28

---

## Format

Criteria are written in Given/When/Then format. Each criterion is tagged as:
- `[MUST]` — Required for the release. Verification fails if not met.
- `[SHOULD]` — Strongly recommended. Treated as a warning if not met.
- `[MAY]` — Optional. Will not block release.

---

## CLI Bootstrap

[MUST] AC-01: CLI boots and shows help
  Given: The `sqx-lite` package is installed globally
  When: The user runs `sqx-lite --help`
  Then: The program exits with code 0 and outputs a usage section containing the program name,
        a description, a list of all flags (--output, --no-pager, --version, --help),
        and at least 3 usage examples

[MUST] AC-02: CLI shows version number
  Given: The `sqx-lite` package is installed
  When: The user runs `sqx-lite --version`
  Then: The program exits with code 0 and outputs the current version string in semver format
        (e.g., "1.0.0")

[SHOULD] AC-03: CLI shows a short description when no arguments are provided
  Given: The `sqx-lite` package is installed
  When: The user runs `sqx-lite` with no arguments
  Then: The program outputs a short usage hint (e.g., "Usage: sqx-lite <database> <query>")
        and exits with code 0 or 1 (but does not crash with an unhandled exception)

---

## Database Connection

[MUST] AC-04: Connect to an existing SQLite database file
  Given: A SQLite database file exists at a known path
  When: The user runs `sqx-lite <path> "SELECT 1 as val"`
  Then: The program connects to the database, executes the query,
        and outputs a table containing one row with the value 1 in a column named "val",
        and exits with code 0

[MUST] AC-05: Fail gracefully when the database file does not exist
  Given: No file exists at the specified path
  When: The user runs `sqx-lite /nonexistent/database.sqlite "SELECT 1"`
  Then: The program outputs an error message containing "not found" or "does not exist"
        and the specified path, then exits with code 2

[SHOULD] AC-06: Fail gracefully when the database file is not a valid SQLite database
  Given: A file exists at the path but contains random binary data, not a SQLite database
  When: The user runs `sqx-lite /path/to/bad.bin "SELECT 1"`
  Then: The program outputs an error message indicating the file is not a valid SQLite database
        and exits with code 2

---

## Query Execution

[MUST] AC-07: Execute a SELECT query and display results in tabular format
  Given: A SQLite database with a "products" table containing columns: id, name, price
  When: The user runs `sqx-lite mydb.sqlite "SELECT id, name, price FROM products"`
  Then: The program outputs a table with column headers "id", "name", "price" and
        one row per matching record, properly aligned in columns,
        and exits with code 0

[MUST] AC-08: Execute a query that returns no rows
  Given: A SQLite database with an empty "orders" table
  When: The user runs `sqx-lite mydb.sqlite "SELECT * FROM orders"`
  Then: The program outputs a message indicating zero rows were returned (e.g., "(0 rows)")
        and exits with code 0 — it does not crash or produce garbled output

[MUST] AC-09: Execute a non-SELECT query (INSERT, UPDATE, DELETE)
  Given: A SQLite database with a writable "users" table
  When: The user runs `sqx-lite mydb.sqlite "INSERT INTO users (name) VALUES ('Alice')"`
  Then: The program reports the number of rows affected (e.g., "1 row affected")
        and exits with code 0

---

## Error Handling

[MUST] AC-10: Report a SQL syntax error clearly
  Given: A SQLite database is open
  When: The user runs `sqx-lite mydb.sqlite "SLECT * FROM users"`
  Then: The program outputs an error message that includes:
        - The word "Error" or "syntax error"
        - The approximate location of the problem (e.g., "near 'SLECT'")
        And exits with code 1

[MUST] AC-11: Report a missing table error clearly
  Given: A SQLite database that does not have a "nonexistent_table" table
  When: The user runs `sqx-lite mydb.sqlite "SELECT * FROM nonexistent_table"`
  Then: The program outputs an error message indicating the table does not exist
        and exits with code 1

[SHOULD] AC-12: Report a constraint violation error clearly
  Given: A SQLite database with a UNIQUE constraint on the "email" column of "users"
  When: The user attempts to insert a duplicate email via `sqx-lite`
  Then: The program outputs an error message mentioning "constraint" or "unique"
        and exits with code 1

---

## Output Formatting

[MUST] AC-13: Paginate results when more than 100 rows are returned
  Given: A query returns 250 rows
  When: The user runs the query in an interactive terminal
  Then: The program shows the first 100 rows, then pauses and displays a "Press n for next page"
        prompt. Pressing "n" shows the next 100 rows. Pressing "q" exits the pager.

[MUST] AC-14: Output results as JSON with --output json flag
  Given: A SQLite database with a "users" table containing 3 rows
  When: The user runs `sqx-lite mydb.sqlite "SELECT * FROM users" --output json`
  Then: The program outputs a JSON array where each element is an object with column names as keys,
        and exits with code 0. The output is valid parseable JSON.

[MUST] AC-15: Disable pagination with --no-pager flag
  Given: A query that would normally paginate (returns > 100 rows)
  When: The user runs the query with `--no-pager`
  Then: The program outputs all rows without any interactive prompts
        and exits with code 0 — suitable for use in shell scripts

[SHOULD] AC-16: Truncate very long column values in table output
  Given: A query that returns a column value longer than 80 characters
  When: The table is displayed in the terminal
  Then: The long value is truncated with "..." at a configurable maximum width (default: 50 chars)
        The original full value is available via `--output json`

---

## Scripting and Pipelines

[MUST] AC-17: Exit with code 0 on success, non-zero on error
  Given: Any query execution
  When: The query succeeds
  Then: sqx-lite exits with code 0
  And: When the query fails for any reason, sqx-lite exits with a non-zero code as documented
        in the Technical Constraints section of the PRD

[SHOULD] AC-18: Suppress ANSI color codes when stdout is not a TTY
  Given: The output of sqx-lite is piped to another process (not a terminal)
  When: `sqx-lite mydb.sqlite "SELECT 1" | cat`
  Then: The output contains no ANSI escape codes for colors or formatting
