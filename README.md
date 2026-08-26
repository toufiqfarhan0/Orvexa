# Orvexa

Orvexa is a PostgreSQL migration safety and controlled execution platform. It provides deterministic DDL static analysis, isolated sandbox rehearsal, cryptographic human approval gating, bounded live execution, and post-execution verification probes.

---

## End-to-End Workflow

Orvexa orchestrates database changes through a five-stage safety lifecycle:

```
Analyze ──► Rehearse ──► Approve ──► Execute ──► Verify
```

1. **Analyze**: Parses raw SQL into discrete statements, inspects the live target schema catalogs, classifies table locks, and computes deterministic risk scores.
2. **Rehearse**: Provisions an isolated disposable PostgreSQL environment inside a TrueForge / Daytona sandbox, clones table schemas with synthetic fixtures, applies the migration, captures pre/post snapshots, computes schema diffs, and proves zero target database mutation.
3. **Approve**: Gates live deployment behind explicit human review. Generates a deterministic SHA-256 cryptographic fingerprint binding the SQL, risk score, schema diff, target catalog, and rehearsal ID.
4. **Execute**: Acquires an execution lock on the session, verifies the approval fingerprint against current state, classifies transaction safety, validates schema identifiers, applies bounded statement timeouts, and executes the migration against the target database.
5. **Verify**: Runs post-execution health and integrity probes on the target database (schema diff parity against approved rehearsal, connection pool responsiveness, and index validity).

---

## Migration Console

Orvexa includes an interactive operator console:

- **URL**: `http://localhost:5173/console`

The console directly drives the real backend API:

- Create migration sessions from raw SQL or preset templates
- Trigger static analysis and review lock level classifications
- Run disposable sandbox rehearsals and inspect schema diff evidence
- Review cryptographic fingerprint hashes, request approval, and grant approval or rejection
- Trigger controlled live execution with explicit confirmation and live status telemetry
- Review post-execution verification probe results and audit history

---

## Core Lifecycle Stages

### 1. Analyze

- **Deterministic SQL Parsing**: Breaks complex multi-statement migrations into discrete AST tokens.
- **System Catalog Inspection**: Reads live target metadata (tables, columns, indexes, constraints, row estimates) without table locking.
- **Lock & Risk Scoring**: Classifies lock levels (`ACCESS EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`, etc.) and calculates category risk scores across data loss, lock duration, performance, availability, and rollback complexity.
- **Sandbox Eligibility**: Evaluates whether the migration is safe to proceed to isolated sandbox rehearsal.

### 2. Rehearse

- **Disposable Database Provisioning**: Spawns an isolated PostgreSQL database for each rehearsal run.
- **Sandbox Isolation**: Uses the TrueForge runtime and Daytona isolated workspaces to execute DDL away from production targets.
- **Schema & Fixture Cloning**: Clones table definitions and populates deterministic synthetic fixtures.
- **Pre/Post Snapshots & Schema Diff**: Captures full table definitions before and after migration to compute exact added/removed/modified tables, columns, indexes, and constraints.
- **Target-Untouched Verification**: Proves target database remained completely untouched during rehearsal.

### 3. Approve

- **Strict Human Approval Gate**: Transitions session to `AWAITING_APPROVAL`. Sessions cannot execute without explicit human authorization.
- **Cryptographic Fingerprint Binding**: Binds migration SQL, target database name, schema name, risk score, rehearsal ID, and schema diff into a SHA-256 hash. Any tampering or drift invalidates the approval.
- **Approval / Rejection Decision**: Human operator records approval or rejection with mandatory approver identity, comments, and fingerprint confirmation.
- **Immutable Audit Trail**: Preserves full event history and decision timestamps.

### 4. Execute

- **State Enforcement**: Execution is strictly restricted to sessions in `APPROVED` status.
- **Explicit Confirmation**: Requires explicit `confirmExecution: true` at the API boundary.
- **Execution Exclusivity**: Enforces execution locks to prevent concurrent runs on the same session.
- **Transaction Classification**: Automatically wraps transaction-safe DDL in `BEGIN...COMMIT` blocks, while executing non-transactional statements (such as `CREATE INDEX CONCURRENTLY`) independently.
- **DML Rejection**: Strictly rejects unsupported data manipulation language (`INSERT`, `UPDATE`, `DELETE`) during DDL migration execution.
- **Identifier Validation**: Validates schema and table identifiers against injection attempts.
- **Bounded Timeouts**: Enforces positive integer statement timeouts (`timeoutMs` between 1ms and 600,000ms) with `SET statement_timeout`.

### 5. Verify

Live execution success alone does not mark a migration as `COMPLETED`. Orvexa executes three automated verification probes:

1. **`SCHEMA_PARITY`**: Compares post-execution target schema diff against the approved rehearsal schema diff (tables, columns, primary keys, foreign keys, constraints, indexes). Any discrepancy marks the run as `VERIFICATION_FAILED`.
2. **`CONNECTION_POOL`**: Probes target database connectivity and ping latency to confirm the database remains responsive.
3. **`INDEX_VALIDITY`**: Inspects target table indexes in `pg_index` to confirm all created indexes are valid (`indisvalid = true`).

---

## Safety Model

- **Fail-Closed by Default**: If any check, rehearsal probe, fingerprint comparison, or post-execution verification fails, the workflow immediately halts and records failure state.
- **Target Database Isolation**: Rehearsals run exclusively in disposable sandbox environments. Target credentials are never used during rehearsal.
- **Cryptographic Integrity**: Approvals are bound to the exact SQL and schema diff via SHA-256 fingerprints. Any SQL modification requires re-analysis, re-rehearsal, and re-approval.
- **Execution Locking**: Mutually exclusive execution lock ensures no race conditions or duplicate execution attempts.
- **Credential Sanitization**: Passwords and connection secrets are redacted from all logs, descriptors, and API responses.
- **Verification-Before-Completion**: Sessions transition to `COMPLETED` only after all post-execution integrity probes pass.

---

## Architecture & Workspaces

```
Orvexa/
├── apps/
│   ├── server/          # Node.js + Express API backend, static analyzer & execution engine
│   │   ├── src/
│   │   │   ├── analyzer/     # Static SQL migration analyzer & risk rules engine
│   │   │   ├── approval/     # Human approval service & SHA-256 fingerprinting
│   │   │   ├── db/           # Read-only PostgreSQL inspection port & pg adapter
│   │   │   ├── domain/       # Session entity, state machine, and domain validators
│   │   │   ├── execution/    # Live execution service, lock, classifier & verification probes
│   │   │   ├── mcp/          # Model Context Protocol (MCP) server & inspection tools
│   │   │   ├── rehearsal/    # Disposable database manager & schema diff generator
│   │   │   ├── repositories/ # Migration session persistence
│   │   │   ├── routes/       # Express REST endpoints (/api/migrations, /api/health)
│   │   │   ├── sandbox/      # Sandbox port & TrueForge Daytona adapter
│   │   │   └── trueforge/    # TrueForge harness client & verification
│   │   └── tests/            # Unit, route, and PostgreSQL integration test suites
│   └── web/             # React + Vite frontend application & operator console
│       ├── src/
│       │   ├── components/   # Console panels (Analysis, Rehearsal, Approval, Execution)
│       │   ├── pages/        # Landing page & MigrationConsolePage
│       │   ├── services/     # Typed MigrationApiClient
│       │   └── styles/       # CSS design tokens & responsive styles
└── packages/
    └── shared/          # Shared TypeScript types, DTO contracts, and domain models
```

---

## TrueForge & Daytona Architecture

- **TrueForge**: Provides the agent harness and sandbox runtime manager (`@truefoundry/trueforge`), exposing REST endpoints on port 8790.
- **Daytona**: Provides remote isolated workspace sandboxes for disposable environment provisioning, allowing DDL rehearsal without local Docker socket requirements.

---

## Local Development Setup

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker & Docker Compose** (for local target PostgreSQL container)

### 1. Installation & Environment Configuration

```bash
# Clone the repository
git clone <repo-url>
cd Orvexa

# Install all dependencies from lockfile
npm ci

# Configure environment variables
cp .env.example .env
```

Ensure `.env` contains your database connection string and optional provider keys:

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/schemasentry_test
TRUEFORGE_BASE_URL=http://localhost:8790
```

### 2. Infrastructure Startup

```bash
# Start local PostgreSQL 16 test database container
npm run docker:db:up

# Start local TrueForge agent runtime on port 8790
npm run trueforge:start
```

### 3. Development Server

```bash
# Start backend API (port 4000) and frontend UI (port 5173) concurrently
npm run dev

# Or start services independently
npm run dev:server
npm run dev:web
```

---

## Verification Commands

Orvexa provides standalone verification scripts to validate each subsystem independently:

```bash
# Verify live PostgreSQL catalog inspection and connectivity
npm run verify:db

# Verify Daytona-backed TrueForge isolated sandbox execution
npm run verify:sandbox

# Verify TrueForge agent harness connectivity and turn execution
npm run verify:trueforge

# Verify Model Context Protocol (MCP) tool registration and queries
npm run verify:mcp

# Verify controlled live migration execution and post-execution probes
npm run verify:live-migration
```

---

## Testing & Quality Assurance

Run the comprehensive test and validation stack:

```bash
# Verify formatting across all files
npm run format:check

# Run ESLint across apps and packages
npm run lint

# Type-check all workspaces (shared, server, web)
npm run typecheck

# Run deterministic unit and route test suites
npm test

# Run live PostgreSQL integration tests
npm run test:integration

# Build production bundles for all workspaces
npm run build
```

---

## Architecture Limitations

The current release is designed for single-instance, developer-controlled workflows. The following architectural limitations are documented for future milestone roadmaps:

- **In-Memory Session Repository**: The current session repository stores session state in-memory (`InMemoryMigrationSessionRepository`). Restarting the server process resets active sessions. Persistent database storage is planned for multi-instance deployments.
- **Process-Local Execution Lock**: The execution lock (`ExecutionLock`) manages concurrency within a single process. Multi-instance distributed deployments require distributed locking infrastructure (e.g. Redis Redlock or Postgres advisory lock pooling).
- **Authentication & RBAC**: The platform does not currently enforce user authentication or role-based access control. In its current form, it is intended to run as an internal operator tool.
- **Multi-Instance Coordination**: Clustered horizontal scaling requires externalizing session state and execution locks to shared infrastructure.

---

## Security Model

- **No Credential Exposure**: Passwords, connection secrets, and authentication tokens are redacted from all public API DTOs, logs, and UI descriptors.
- **Sanitized Connection Strings**: Connection URLs are stripped of credentials (`postgresql://user:***@host:port/db`) before exposure.
- **Internal Error Masking**: Internal database driver stack traces and system paths are scrubbed from production API error responses.
- **Read-Only Inspection**: Catalog inspection queries only read metadata from PostgreSQL system catalogs (`pg_class`, `pg_attribute`, `pg_indexes`, `pg_constraint`, `pg_stat_user_tables`) and never execute mutating operations on target databases.
