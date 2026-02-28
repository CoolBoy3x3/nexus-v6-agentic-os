# SQX Lite — Product Requirements Document

**Project:** SQX Lite
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-02-28

---

## Project Overview

SQX Lite is a command-line SQL query executor that allows developers and data analysts to connect
to SQLite database files, execute SQL queries, and view formatted results — all from the terminal.

SQX Lite is designed as a lightweight alternative to full-featured database GUIs. Its target users
are developers who are comfortable in the terminal and want a fast, scriptable way to inspect and
query SQLite databases without installing a desktop application.

The name "SQX" stands for **SQL eXecutor**. The "Lite" suffix reflects that this initial version
focuses on SQLite only, with future versions planned to support PostgreSQL and MySQL.

---

## Goals

1. **Provide a simple, ergonomic CLI for SQLite query execution.**
   Users should be able to run a query against a SQLite file with a single command and see results
   within 2 seconds for datasets under 100,000 rows.

2. **Format query results readably in the terminal.**
   Results must be displayed in a tabular format with column headers, proper alignment, and support
   for wide terminals. Results should degrade gracefully to a minimal format in narrow terminals.

3. **Handle errors with actionable feedback.**
   SQL syntax errors, file-not-found errors, and permission errors must produce clear, human-readable
   error messages that describe what went wrong and how to fix it.

4. **Support pagination for large result sets.**
   Queries that return more than 100 rows should automatically paginate. Users can navigate pages
   with keyboard shortcuts (n for next, p for previous, q to quit).

5. **Be easily scriptable and embeddable in shell pipelines.**
   SQX Lite must support non-interactive mode with `--no-pager` and `--output json` flags so results
   can be piped to other tools (jq, awk, etc.).

---

## Non-Goals

1. **No support for non-SQLite databases in v1.0.**
   PostgreSQL, MySQL, and other databases are explicitly out of scope for this version. The
   connection string format and driver are SQLite-only.

2. **No interactive SQL editor.**
   SQX Lite does not provide a REPL or interactive query editor. Each invocation executes a single
   SQL statement passed as an argument or read from stdin. A future version may add REPL support.

3. **No schema migration tooling.**
   SQX Lite is a read/write query executor, not a migration tool. It has no concept of migrations,
   schema versions, or schema diffs. Use a dedicated migration tool for those needs.

---

## User Stories

### US-01: Run a query from the command line

**As a** developer inspecting a SQLite database,
**I want to** run `sqx-lite mydb.sqlite "SELECT * FROM users LIMIT 10"`,
**So that** I can quickly see the first 10 rows of the users table without opening a GUI.

**Acceptance:** The command outputs a formatted table with column headers and the first 10 rows.

---

### US-02: Connect to a database file by path

**As a** developer working with multiple databases,
**I want to** specify the full or relative path to a `.sqlite` or `.db` file,
**So that** I can query databases in any directory without changing my working directory.

**Acceptance:** `sqx-lite /path/to/mydb.sqlite "SELECT 1"` works and does not require the database
to be in the current directory.

---

### US-03: See a helpful error for invalid SQL

**As a** developer who made a typo in their query,
**I want to** see a clear error message that identifies the problem,
**So that** I can fix my query quickly without guessing what went wrong.

**Acceptance:** Running `sqx-lite mydb.sqlite "SLECT * FROM users"` outputs:
```
Error: near "SLECT": syntax error (line 1, column 1)
```
and exits with code 1.

---

### US-04: Navigate large result sets with pagination

**As a** data analyst running a query that returns thousands of rows,
**I want to** navigate through results page by page,
**So that** I can read the data without it scrolling off the screen.

**Acceptance:** When a result set exceeds 100 rows, the pager activates automatically. Pressing `n`
shows the next page, `p` shows the previous page, and `q` exits.

---

### US-05: Output results as JSON for scripting

**As a** developer integrating SQX Lite into a shell pipeline,
**I want to** get query results as JSON with `--output json`,
**So that** I can pipe the output to `jq` or other tools for further processing.

**Acceptance:** `sqx-lite mydb.sqlite "SELECT * FROM users" --output json` outputs a JSON array of
objects where each key is a column name and each value is the column value.

---

### US-06: Skip the pager for scripting

**As a** developer using SQX Lite in a script,
**I want to** pass `--no-pager` to disable pagination,
**So that** I can capture all output without interactive prompts blocking the script.

**Acceptance:** `sqx-lite mydb.sqlite "SELECT * FROM users" --no-pager` outputs all rows without
pagination and exits cleanly.

---

### US-07: See help text and usage examples

**As a** new user of SQX Lite,
**I want to** run `sqx-lite --help` and see a description of all commands and flags,
**So that** I can learn how to use the tool without reading documentation.

**Acceptance:** `sqx-lite --help` outputs a usage summary with all flags, their descriptions, and
at least 3 usage examples.

---

### US-08: Connect and fail gracefully if the file does not exist

**As a** developer who mistyped the database path,
**I want to** see a clear "file not found" error,
**So that** I know immediately that the problem is the path, not the query.

**Acceptance:** `sqx-lite /nonexistent/path.sqlite "SELECT 1"` outputs:
```
Error: Database file not found: /nonexistent/path.sqlite
```
and exits with code 2.

---

## Technical Constraints

1. **Runtime:** Node.js >= 18. The CLI is distributed as an npm package (`sqx-lite`).

2. **Database driver:** Must use `better-sqlite3` as the SQLite driver. No other SQLite drivers
   are permitted. The driver must be a production dependency, not dev-only.

3. **TypeScript:** All source code is TypeScript. Compiled to CommonJS for distribution.

4. **Testing:** All business logic must have unit tests using Vitest. Integration tests use a
   temporary in-memory SQLite database (`:memory:`).

5. **CLI framework:** Must use `commander` for argument parsing. No other CLI frameworks.

6. **Terminal UI:** Pagination must use `@inquirer/core` or plain readline — no heavy TUI libraries.

7. **Output:** Default output is a table formatted with `cli-table3`. JSON output is plain
   `JSON.stringify` with 2-space indentation.

8. **Exit codes:**
   - 0: Success
   - 1: SQL error (syntax error, constraint violation, etc.)
   - 2: File/connection error (file not found, permission denied)
   - 3: Internal error (unexpected exception)
