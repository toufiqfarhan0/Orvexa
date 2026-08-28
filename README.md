# Orvexa

Orvexa is a PostgreSQL migration safety and controlled execution platform that uses an agent and sandbox workflow to analyze, rehearse, obtain human approval, execute, and verify database migrations.

---

## Table of Contents

- [Hackathon Mission & Core Agent Job](#hackathon-mission--core-agent-job)
- [End-to-End Safety Workflow](#end-to-end-safety-workflow)
- [Interactive Migration Console](#interactive-migration-console)
- [Target Database Tables & Schema Evolution Inspector](#target-database-tables--schema-evolution-inspector)
- [Core Lifecycle Stages](#core-lifecycle-stages)
  - [1. Analyze](#1-analyze)
  - [2. Rehearse](#2-rehearse)
  - [3. Approve](#3-approve)
  - [4. Execute](#4-execute)
  - [5. Verify](#5-verify)
- [TrueForge, Daytona & Multi-Model Architecture](#trueforge-daytona--multi-model-architecture)
- [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
- [Google Gemini Executive Release Brief](#google-gemini-executive-release-brief)
- [Migration Presets & Canonical Baseline](#migration-presets--canonical-baseline)
- [Safety Guarantees & Security Model](#safety-guarantees--security-model)
- [System Architecture](#system-architecture)
- [Monorepo Workspace Structure](#monorepo-workspace-structure)
- [Quick Start Guide for Evaluators & Judges](#quick-start-guide-for-evaluators--judges)
- [Verification Scripts](#verification-scripts)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Production Render Deployment](#production-render-deployment)
- [Qodo Code Review Evidence](#qodo-code-review-evidence)
- [Current Architecture Limitations](#current-architecture-limitations)
- [License](#license)

---

## Hackathon Mission & Core Agent Job

> **Core Agent Job**: Safely take a proposed PostgreSQL migration from raw SQL through deterministic static analysis, isolated sandbox rehearsal, cryptographic human approval, controlled live execution, and verified completion.

Orvexa is designed for autonomous AI coding agents, DevOps pipelines, and lead DBAs. It is not an unchecked autonomous SQL executor that applies unverified code to production databases. Instead, it acts as a deterministic safety harness that:

1. Inspects live PostgreSQL catalog metadata via the **Model Context Protocol (MCP)**.
2. Evaluates table lock severity, blast radius, and migration hazards deterministically before any execution.
3. Verifies sandbox workspace execution via **TrueForge** and **Daytona**, applying candidate migrations against disposable PostgreSQL database clones populated with synthetic data.
4. Generates plain-English **Google Gemini** executive release briefs for DBAs and technical leadership.
5. Halts and enforces a cryptographic **SHA-256 human approval gate** before live execution.
6. Executes transaction-safe DDL within atomic transaction blocks (with independent execution for concurrent operations) and verifies post-execution catalog parity.

---

## End-to-End Safety Workflow

Orvexa orchestrates all database operations through a deterministic five-phase lifecycle:

```
Analyze ──► Rehearse ──► Approve ──► Execute ──► Verify
```

1. **Analyze**: Parses DDL statements using a deterministic lexical tokenizer, inspects the live target schema catalogs, classifies table locks (`ACCESS EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`, etc.), and computes deterministic risk scores across 5 risk categories.
2. **Rehearse**: Provisions an isolated disposable PostgreSQL clone, verifies sandbox workspace dispatch via the TrueForge Daytona sandbox adapter, applies the migration, captures pre/post snapshots, computes schema diffs, and proves zero mutation on the target database.
3. **Approve**: Gates live deployment behind explicit human review. Generates a deterministic SHA-256 cryptographic fingerprint binding the proposed SQL hash, target database descriptor hash, rehearsal ID, and rehearsal status.
4. **Execute**: Acquires a single-flight execution lock on the session, verifies the approval fingerprint against current state, classifies transaction safety, validates schema identifiers, applies bounded statement timeouts, and executes transaction-safe DDL inside transaction blocks while running non-transactional statements independently.
5. **Verify**: Runs post-execution health and integrity probes on the target database (schema diff parity against approved rehearsal, connection pool responsiveness, and index validity).

---

## Interactive Migration Console

Orvexa includes an interactive operator console designed for lead DBAs and engineering teams:

- **Local Route**: `http://localhost:5173/console`

### Real Backend Capabilities

The Migration Console directly interfaces with the Orvexa REST API (`/api/migrations/*`) and drives the real lifecycle engine:

- **SQL Migration Editor**: Single-pass lexical character scanner with real-time token normalization that strips line/block comments and semicolons while preserving single-quoted literals and PostgreSQL dollar-quoted string bodies (`$$...$$`, `$body$...$body$`).
- **Migration Presets**: Preloaded canonical migrations covering additive columns, concurrent indexes, check constraints, multi-column batches, and destructive mutations.
- **Target Database Inspector**: Live telemetry displaying target database connection name, active schema, catalog table count, and health readiness.
- **Deterministic Risk Analysis**: Real-time evaluation of statement lock modes, estimated lock durations, table size impact, and reversibility.
- **Rehearsal Evidence & Schema Diff Panel**: Complete structural diff breakdown showing added, removed, and modified tables, columns, indexes, and constraints with automated filter synchronization.
- **TrueForge & Gemini Executive Release Brief**: Interactive briefing generator powered by Google Gemini via TrueForge agent sessions with in-flight single-flight protection and per-session brief scoping.
- **Human Approval Gate**: Interactive approval form requiring reviewer sign-off, comment logging, and SHA-256 fingerprint verification.
- **Controlled Live Execution**: Fail-closed execution trigger requiring explicit confirmation, statement timeout bounds, and real-time execution telemetry.
- **Automated Verification Probes**: Live verification results displaying `SCHEMA_PARITY`, `CONNECTION_POOL`, and `INDEX_VALIDITY` probe statuses.

---

## Target Database Tables & Schema Evolution Inspector

Orvexa features a live, non-mutating Database Tables & Schema Inspector available directly in the Migration Console under the **Target & Activity** panel:

### Capabilities

- **Live Catalog Telemetry (`GET /api/migrations/target/tables`)**: Reads PostgreSQL `information_schema` and `pg_catalog` without acquiring locks or mutating database state.
- **Column Schema Details**: Displays column names, normalized canonical data types (`timestamptz`, `varchar`, `integer`, `boolean`), nullability constraints, and default expressions.
- **Constraint & Index Visualizers**: Identifies Primary Keys (`PK`), Foreign Key references (`FK`), and indexed columns (`IDX`).
- **Real-Time Schema Evolution Overlays**:
  - `+ NEW TABLE`: Highlighted in green for newly created tables.
  - `+ ADDED`: Highlighted in green for columns added during migration execution.
  - `~ MODIFIED`: Highlighted in amber for altered column definitions and data type conversions.
  - `- DROPPED`: Highlighted in red for dropped tables and removed columns.
- **Instant Search & Filter**: Real-time filtering by table name or column definition.

---

## Core Lifecycle Stages

### 1. Analyze

- **Deterministic Statement Parsing**: Splits raw multi-statement SQL scripts into discrete statements safely, respecting single quotes, double quotes, dollar-quoted blocks (`$$...$$`), and SQL comments.
- **System Catalog Inspection**: Reads live target metadata (tables, columns, indexes, constraints, row estimates) without table locking.
- **Lock & Risk Scoring**: Classifies lock levels (`ACCESS EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`, `ACCESS SHARE`, etc.) and calculates category risk scores across data loss, lock duration, performance, availability, and rollback complexity.
- **Sandbox Eligibility**: Evaluates whether the migration statements are syntactically supported and safe to proceed to isolated sandbox rehearsal.

### 2. Rehearse

- **Disposable Database Provisioning**: Spawns an isolated disposable PostgreSQL sibling database for each rehearsal run on the configured database server.
- **Schema & Fixture Cloning**: Clones table definitions and populates deterministic synthetic fixtures into the disposable database.
- **Sandbox Workspace Execution**: Dispatches command execution verification through the TrueForge Daytona sandbox adapter to validate isolated workspace availability.
- **Pre/Post Snapshots & Schema Diff**: Captures full table definitions before and after migration on the disposable database to compute exact added, removed, and modified tables, columns, indexes, and constraints.
- **Target Schema Untouched**: Rehearsal DDL executes exclusively against the disposable sibling database; the live target database schema remains untouched with zero mutations during rehearsal.

### 3. Approve

- **Strict Human Approval Gate**: Transitions session to `AWAITING_APPROVAL`. Sessions cannot execute without explicit human authorization.
- **Cryptographic Fingerprint Binding**: Computes a deterministic SHA-256 fingerprint binding the proposed migration ID, SQL hash (`sqlHash`), target database descriptor hash (`engine`, `databaseName`, `schemaName`), rehearsal ID, and rehearsal status. Any drift invalidates the approval.
- **Approval / Rejection Decision**: Human operator records approval or rejection with mandatory approver identity, comments, and fingerprint confirmation.
- **Immutable Audit Trail**: Preserves full event history and decision timestamps.

### 4. Execute

- **State Enforcement**: Execution is strictly restricted to sessions in `APPROVED` status.
- **Explicit Confirmation**: Requires explicit `confirmExecution: true` at the API boundary.
- **Execution Exclusivity**: Enforces execution locks to prevent concurrent runs on the same session.
- **Transaction Classification**: Automatically classifies statements:
  - `TRANSACTION_SAFE` DDL (e.g. `CREATE TABLE`, `ALTER TABLE`, standard `CREATE INDEX`) is wrapped in atomic `BEGIN...COMMIT` transaction blocks.
  - `NON_TRANSACTIONAL` statements (e.g. `CREATE INDEX CONCURRENTLY`, `VACUUM`) are executed independently outside transaction blocks as required by PostgreSQL.
- **DML Rejection**: Strictly rejects unsupported data manipulation language (`INSERT`, `UPDATE`, `DELETE`) during DDL migration execution.
- **Identifier Validation**: Validates schema and table identifiers against injection attempts.
- **Bounded Timeouts**: Enforces positive integer statement timeouts (`timeoutMs` between 1ms and 600,000ms) with `SET statement_timeout`.

### 5. Verify

Live execution success alone does not mark a migration as `COMPLETED`. Orvexa executes three automated verification probes:

1. **`SCHEMA_PARITY`**: Compares post-execution target schema diff against the approved rehearsal schema diff (tables, columns, primary keys, foreign keys, constraints, indexes). Any discrepancy marks the run as `VERIFICATION_FAILED`.
2. **`CONNECTION_POOL`**: Probes target database connectivity and ping latency to confirm the database remains responsive.
3. **`INDEX_VALIDITY`**: Inspects target table indexes in `pg_index` to confirm all created indexes are valid (`indisvalid = true`).

---

## TrueForge, Daytona & Multi-Model Architecture

Orvexa is built on a decoupled, robust multi-agent architecture utilizing TrueForge, Daytona, and Google Gemini:

- **TrueForge Agent Harness (`@truefoundry/trueforge-sdk`)**:
  - Runs locally on port 8790 (or configured via `TRUEFORGE_BASE_URL` in production) as the headless agent runtime.
  - Orvexa backend communicates programmatically via `TrueForgeAdapter`.
  - Manages agent loops, session lifecycles, tool dispatch, and model turns.
- **Multi-Model Support**:
  - Supports Google Gemini (Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 1.5 Pro, Gemini 1.5 Flash), Claude, and GPT models via the TrueForge agent protocol.
- **Daytona Cloud Sandboxes (`@daytona/sdk`)**:
  - Provisions ephemeral sandbox workspaces during migration rehearsal.
  - Validates sandbox container readiness and isolated execution commands via TrueForge.
  - Paired with disposable database cloning to execute candidate DDL against isolated sibling databases rather than the live target schema.
- **Remote Production Architecture (Render / Cloud)**:
  - In cloud production deployments (e.g. Render), TrueForge and Daytona operate as external execution planes configured via environment variables (`TRUEFORGE_BASE_URL`, `DAYTONA_API_KEY`, `DAYTONA_SERVER_URL`), with fail-safe local sandbox fallbacks.

---

## Model Context Protocol (MCP) Server

Orvexa exposes an official Model Context Protocol (MCP) server over SSE transport:

- **Endpoint**: `/api/mcp`
- **Transport**: Server-Sent Events (SSE)

### Registered Tools

1. **`inspect_postgres_target`**:
   - **Parameters**: `table: string`, `schema?: string`, `includeDependencies?: boolean`
   - **Description**: Inspects live PostgreSQL catalog metadata (columns, data types, nullability, constraints, indexes, estimated row count) without acquiring locks.
   - **Output**: Structured `InspectPostgresTargetOutput` for AI coding agents.

2. **`simulate_lock_contention`**:
   - **Parameters**: `table: string`, `statement: string`, `schema?: string`
   - **Description**: Evaluates table lock severity and concurrent transaction contention risks before execution.

3. **`generate_recipe`**:
   - **Parameters**: `operation: string`, `tableName: string`, `parameters: object`
   - **Description**: Generates safe, zero-downtime PostgreSQL migration recipes (e.g., adding not-null columns safely or concurrent index creation).

---

## Google Gemini Executive Release Brief

Orvexa provides an automated executive briefing service designed for lead DBAs, engineering leadership, and product managers:

- **Endpoint**: `POST /api/migrations/:sessionId/executive-brief`
- **Supported Models**: `google-gemini/gemini-2.5-flash`, `google-gemini/gemini-2.5-pro`, `google-gemini/gemini-1.5-pro`

### Workflow & Invariants

1. **Context Synthesis**: Extracts migration SQL, lock modes, risk scores, sandbox rehearsal duration, statement outcomes, and schema diffs from the session.
2. **TrueForge Agent Session**: Spawns an isolated TrueForge agent session with explicit briefing instructions.
3. **Gemini Inference**: Google Gemini synthesizes technical telemetry into a structured executive brief containing:
   - **Executive Summary**: High-level verdict on deployment readiness.
   - **Risk Assessment**: Clear explanation of table locks, row rewrite hazards, and reversibility.
   - **Schema Modifications**: Human-readable list of structural changes.
   - **Operational Recommendations**: Suggested maintenance window and backup precautions.
4. **Single-Flight Protection**: Enforces an in-flight guard (`briefGenerationInProgress`) preventing duplicate concurrent model calls for the same session.
5. **Fail-Safe Cleanup**: Ensures the TrueForge agent session is always deleted in a `finally` block, preventing orphaned agent sessions on success or failure.
6. **Explicit Error Handling**: If TrueForge credentials or model provider endpoints are misconfigured, returns clean, typed `502 Bad Gateway` error responses.

---

## Migration Presets & Canonical Baseline

The Orvexa Migration Console includes 8 categorized migration presets designed around a canonical PostgreSQL database baseline:

### Canonical Schema Baseline

The preloaded test database (`schemasentry_test`) defines the following canonical tables:

- **`public.organizations`**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `name`: `VARCHAR(255) NOT NULL`
  - `slug`: `VARCHAR(100) NOT NULL UNIQUE`
  - `plan`: `VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise'))`
  - `is_active`: `BOOLEAN NOT NULL DEFAULT true`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
- **`public.users`**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `organization_id`: `UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
  - `email`: `VARCHAR(255) NOT NULL UNIQUE`
  - `full_name`: `VARCHAR(255) NOT NULL`
  - `role`: `VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest'))`
  - `metadata`: `JSONB DEFAULT '{}'::jsonb`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
- **`public.events`**:
  - `id`: `BIGSERIAL PRIMARY KEY`
  - `organization_id`: `UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
  - `user_id`: `UUID REFERENCES users(id) ON DELETE SET NULL`
  - `event_type`: `VARCHAR(100) NOT NULL`
  - `payload`: `JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
- **`public.orders`**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `organization_id`: `UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`
  - `user_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
  - `total_amount`: `NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0)`
  - `status`: `VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded'))`
  - `notes`: `TEXT`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`

### Supported Migration Presets

1. **Step 1: Create Baseline Table** (`baseline`): Initializes `public.events` if not already created.
2. **Step 2: Safe Add Column** (`safe`): Adds `status text NOT NULL DEFAULT 'active'` to `public.events`.
3. **Step 3: Concurrent Index** (`constraint`): Creates non-blocking `CREATE INDEX CONCURRENTLY idx_events_type ON public.events(event_type)`.
4. **Step 4: Add JSON Column** (`safe`): Adds `metadata jsonb NOT NULL DEFAULT '{}'::jsonb` to `public.events`.
5. **Step 5: Check Constraint** (`constraint`): Adds `CHECK (total_amount >= 0) NOT VALID` constraint on `public.orders`.
6. **Step 6: Multi-Column Batch** (`safe`): Atomically adds profile columns `phone` and `avatar_url` to `public.users`.
7. **Step 7: Destructive Drop** (`destructive`): Drops `payload` column on `public.events` to verify high-risk classification and approval gating.
8. **Step 8: Alter Column Type** (`destructive`): Mutates `status` column type on `public.orders` triggering table lock evaluation and full row scan risk check.

---

## Safety Guarantees & Security Model

- **Deterministic Statement Analysis**: Parses raw DDL statements into normalized tokens and maps table-level lock conflicts without LLM hallucination.
- **Target Database Protection**: Rehearsal DDL executes exclusively inside disposable sibling databases created for each run. The live target database schema remains untouched with zero mutations during rehearsal.
- **Cryptographic SHA-256 Fingerprints**: Approvals bind proposed SQL hash, target database descriptor hash, rehearsal ID, and rehearsal status into a SHA-256 hash. Any SQL or target modification invalidates the approval.
- **Fail-Closed by Default**: Any probe failure, fingerprint mismatch, or rehearsal timeout halts execution and sets failure state.
- **Single-Session Execution Lock**: Mutually exclusive execution lock prevents concurrent execution attempts on the same session.
- **DML Rejection**: Restricts execution strictly to DDL operations, rejecting unauthorized `INSERT`, `UPDATE`, or `DELETE` statements.
- **Input Prose Validation**: Blocks plain text natural language or non-SQL programming code from entering the pipeline.
- **Credential Sanitization**: Passwords and connection strings (`postgresql://user:***@host:port/db`) are redacted from all public DTOs and logs.
- **Error Masking**: Database driver stack traces and system file paths are scrubbed from production API error responses.
- **Strict Content Security Policy**: Tailored Helmet CSP whitelist permits Vite bundles, Google Fonts, and data URIs while blocking unauthorized third-party scripts.

---

## System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["1. CLIENT & OPERATOR LAYER"]
        WebUI["Orvexa Web Console (React + Vite)<br/>http://localhost:5173/console"]
        AIAgents["AI Coding Agents (Claude, Cursor, Copilot)<br/>Autonomous Migration Generators"]
    end

    subgraph AgentHarness ["2. AGENT HARNESS & AI INTELLIGENCE"]
        TrueForge["TrueForge Agent Harness (:8790)<br/>@truefoundry/trueforge-sdk"]
        Gemini["Google Gemini (gemini-2.5-flash)<br/>Executive Release Brief Engine"]
    end

    subgraph ServerLayer ["3. ORVEXA BACKEND RUNTIME (:4000)"]
        APIServer["Express API & REST Controllers<br/>/api/migrations, /api/health"]
        MCPServer["Model Context Protocol (MCP) Server<br/>/api/mcp (inspect_postgres_target)"]

        subgraph CoreEngines ["Deterministic Safety Engines (Zero-LLM)"]
            AnalyzerEngine["Deterministic Migration Analyzer & Risk Engine<br/>(Lock Classification & Sandbox Eligibility)"]
            RehearsalEngine["Rehearsal Workflow Engine<br/>(Disposable DB Cloning & Sandbox Dispatch)"]
            DiffEngine["Catalog Differential Engine<br/>(pg_catalog structural diffing)"]
            GateEngine["Approval & Cryptographic Sealing<br/>(SHA-256 Fingerprinting)"]
            ExecEngine["Transactional Execution Engine<br/>(Fail-Closed, Lock Timeouts)"]
        end
    end

    subgraph IsolationLayer ["4. ISOLATION & REHEARSAL LAYER"]
        Daytona["Daytona Sandboxes / Ephemeral Containers<br/>@daytona/sdk"]
        RehearsalDB["Disposable PostgreSQL Sibling Clone<br/>(Synthetic Fixtures + DDL Execution)"]
    end

    subgraph ProductionLayer ["5. TARGET DATABASE LAYER"]
        TargetDB[(Live PostgreSQL Target Database<br/>localhost:5432 / schemasentry_test)]
    end

    %% Flows
    WebUI -->|REST API| APIServer
    AIAgents -->|MCP Protocol / SSE| MCPServer
    APIServer -->|Session Findings| TrueForge
    TrueForge -->|Inference & Summaries| Gemini
    Gemini -->|Executive Release Brief| APIServer

    APIServer --> AnalyzerEngine
    AnalyzerEngine -->|Risk Evaluation & Eligibility| RehearsalEngine
    RehearsalEngine --> IsolationLayer
    Daytona --> RehearsalDB
    RehearsalDB --> DiffEngine
    DiffEngine --> GateEngine

    GateEngine -->|Signed Approval Decision| ExecEngine
    ExecEngine -->|DDL + Verification Probes| TargetDB
```

---

## Monorepo Workspace Structure

```
Orvexa/
├── apps/
│   ├── server/          # Node.js + Express API backend, static analyzer & execution engine
│   │   ├── src/
│   │   │   ├── analyzer/     # Static SQL migration parser & risk rules engine
│   │   │   ├── approval/     # Human approval service & SHA-256 fingerprinting
│   │   │   ├── db/           # Read-only PostgreSQL inspection port & pg adapter
│   │   │   ├── domain/       # Session entity, state machine, and domain validators
│   │   │   ├── execution/    # Live execution service, lock, classifier & verification probes
│   │   │   ├── mcp/          # Model Context Protocol (MCP) server & tools
│   │   │   ├── rehearsal/    # Disposable database manager & schema diff generator
│   │   │   ├── repositories/ # Migration session persistence
│   │   │   ├── routes/       # Express REST endpoints (/api/migrations, /api/health)
│   │   │   ├── sandbox/      # Sandbox port & TrueForge Daytona adapter
│   │   │   └── trueforge/    # TrueForge harness client & Gemini brief generator
│   │   └── tests/            # 37 test files (454 unit & integration tests)
│   └── web/             # React + Vite frontend application & operator console
│       ├── src/
│       │   ├── components/   # Console panels (TargetTables, Evidence, Risk, Chat, Models)
│       │   ├── pages/        # LandingPage & MigrationConsolePage
│       │   ├── services/     # Typed MigrationApiClient with AbortController support
│       │   └── styles/       # CSS design tokens & responsive styles
│       └── tests/            # 12 test files (45 unit tests)
└── packages/
    └── shared/          # Shared TypeScript types, DTO contracts, and SQL validators
```

---

## Quick Start Guide for Evaluators & Judges

Follow these steps to run and evaluate Orvexa locally:

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker & Docker Compose** (for local PostgreSQL 16 test database container)

### Step 1: Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/toufiqfarhan0/Orvexa.git
cd Orvexa

# Install dependencies from lockfile
npm ci

# Configure environment variables
cp .env.example .env
```

Ensure `.env` contains your configuration:

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/schemasentry_test

# TrueForge Agent Harness Configuration
TRUEFORGE_BASE_URL=http://localhost:8790
TRUEFORGE_MODEL_PROVIDER=google-gemini
TRUEFORGE_MODEL_NAME=google-gemini/gemini-2.5-flash

# Model Provider Credentials
GEMINI_API_KEY=your_gemini_api_key
DAYTONA_API_KEY=your_daytona_api_key
```

### Step 2: Start Local Database & Infrastructure

```bash
# Start the local PostgreSQL 16 test database container with preloaded tables
npm run docker:db:up

# Start local TrueForge agent runtime on port 8790
npm run trueforge:start
```

### Step 3: Launch Local Development Servers

```bash
# Start backend API (port 4000) and frontend console (port 5173) concurrently
npm run dev
```

Open **`http://localhost:5173`** in your browser to interact with the Landing Page and Operator Console.

---

## Verification Scripts

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

# Verify isolated sandbox database provisioning
npm run verify:rehearsal

# Verify migration rehearsal workflow against disposable database
npm run verify:migration-rehearsal

# Verify controlled live migration execution and post-execution probes
npm run verify:live-migration
```

---

## Testing & Quality Assurance

Run the comprehensive test and validation stack across the monorepo:

```bash
# Verify formatting across all files
npm run format:check

# Run ESLint across apps and packages
npm run lint

# Type-check all workspaces (shared, server, web)
npm run typecheck

# Run monorepo test suites (49 test files, 499 tests)
npm test

# Run live PostgreSQL integration tests
npm run test:integration

# Build production bundles for all workspaces
npm run build
```

---

## Production Render Deployment

Orvexa includes a verified unified deployment configuration for [Render](https://render.com) (`render.yaml`):

- **Service Type**: Render Web Service
- **Build Command**: `npm ci --include=dev && npm run build`
- **Start Command**: `npm start`
- **Production Static Serving**: Express hosts production Vite assets with strict MIME caching and returns HTTP 404 for missing static assets (`STATIC_ASSET_REGEX`).
- **Content Security Policy (CSP)**: Explicit Helmet whitelist configured for Vite assets, Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), and data URIs.
- **Health & Subsystems Diagnostics**: `GET /api/health` reports service uptime, environment, and subsystem configuration readiness for target database (`DATABASE_URL`) and Daytona/TrueForge sandbox execution (`DAYTONA_API_KEY`, `TRUEFORGE_BASE_URL`).

---

## Qodo Code Review Evidence

Orvexa utilized **Qodo automated code review** throughout the major pull requests in the repository. Each PR underwent automated review, issue remediation, regression test additions, follow-up verification, and clean merging.

- **All Merged Pull Requests**: [https://github.com/toufiqfarhan0/Orvexa/pulls?q=is%3Apr+is%3Amerged](https://github.com/toufiqfarhan0/Orvexa/pulls?q=is%3Apr+is%3Amerged)

### Representative Reviewed Pull Requests

| Pull Request                                                  | Title                                                                                    | Qodo Review Status      | Resolution Summary                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------------------------------------------ | :--------------------------------------------------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [**PR #28**](https://github.com/toufiqfarhan0/Orvexa/pull/28) | `feat: Target Database Tables Inspector & Post-Execution Schema Evolution`               | **Reviewed & Verified** | Qodo identified 2 findings: `IMPORT FOREIGN SCHEMA` rejected as programming code, and unconstrained plain text prose passing validation. Remediated with SQL grammar preservation for foreign schema imports, natural prose detection, and 6 new unit tests. All findings resolved.                                                                                                                                       |
| [**PR #24**](https://github.com/toufiqfarhan0/Orvexa/pull/24) | `feat(web): refine landing page and proof engine`                                        | **Reviewed & Verified** | Qodo identified 4 findings: mobile navbar CTA clipping at 320px–360px, fictional MCP tools in UI, 6-stage vs 5-stage heading mismatch, and localStorage exceptions stranding proof simulation. Remediated with responsive CSS breakpoints, canonical MCP registry alignment, 6-stage heading synchronization, safe storage fallback wrapper, and 4 new test suites. All findings resolved.                                |
| [**PR #23**](https://github.com/toufiqfarhan0/Orvexa/pull/23) | `feat(web): harden migration console UI and diff inspector layout`                       | **Reviewed & Verified** | Qodo identified 11 findings across review passes: undefined console tokens, disappearing column diffs, executive brief session leakage, collision-prone SQL placeholders, dollar-quoted PostgreSQL function parsing, stale diff filters, and mobile header styling. Remediated with token scoping, AbortController brief cancellation, single-pass lexical scanner, and automatic filter reset. All 11 findings resolved. |
| [**PR #22**](https://github.com/toufiqfarhan0/Orvexa/pull/22) | `feat(server): add TrueForge Gemini executive release brief endpoint and client service` | **Reviewed & Verified** | Qodo identified 6 findings: failed TrueForge turns returning success, omitted rehearsal failure context, agent session leakage on error, silent provider config failures, unbounded concurrent brief requests, and inaccurate reported model names. Remediated with session cleanup in `finally` block, in-flight debounce guard, explicit 502 status mapping, and 12 new unit tests. All 6 findings resolved.            |
| [**PR #21**](https://github.com/toufiqfarhan0/Orvexa/pull/21) | `feat(server): harden TrueForge integration, state machine, and migration console API`   | **Reviewed & Verified** | Qodo reviewed TrueForge SDK adapter, state machine transitions, and catalog inspection error boundaries. Remediated with regression coverage and follow-up verification.                                                                                                                                                                                                                                                  |
| [**PR #19**](https://github.com/toufiqfarhan0/Orvexa/pull/19) | `feat: add unified Render deployment config and production static serving`               | **Reviewed & Verified** | Qodo identified build-time dev dependency availability, Helmet CSP disabling, missing asset 404 routing, and remote sandbox observability. Remediated with `npm ci --include=dev`, restored Helmet CSP whitelist, and diagnostic `/api/health` reporting. All 4 findings resolved.                                                                                                                                        |
| [**PR #17**](https://github.com/toufiqfarhan0/Orvexa/pull/17) | `feat(web): revamp UI to light mode with design system`                                  | **Reviewed & Verified** | Qodo identified 4 UI findings covering RiskPreviewPanel empty-state contrast, mobile Navbar clipping, ConsoleHeader overflow, and SQL line-number contrast. Remediated and verified with 0 active bugs before merge.                                                                                                                                                                                                      |
| [**PR #16**](https://github.com/toufiqfarhan0/Orvexa/pull/16) | `feat: connect Orvexa console to live execution`                                         | **Reviewed & Verified** | Qodo identified execution-state persistence, timeout validation, rehearsal schema-diff parity, UI pre-flight truthfulness, and API confirmation concerns. Remediated and re-reviewed before merge.                                                                                                                                                                                                                        |
| [**PR #15**](https://github.com/toufiqfarhan0/Orvexa/pull/15) | `feat: connect Orvexa console to approval workflow`                                      | **Reviewed & Verified** | Qodo identified approval-state, repository composition, input validation, JSON response handling, rejection fingerprint, and session hydration concerns. Remediated and re-reviewed before merge.                                                                                                                                                                                                                         |
| [**PR #14**](https://github.com/toufiqfarhan0/Orvexa/pull/14) | `feat: connect Orvexa console to migration rehearsal`                                    | **Reviewed & Verified** | Qodo reviewed the real rehearsal integration and identified target-verification, failure-state, repository composition, concurrency, failure-evidence, and schema-diff presentation concerns. Remediated and re-reviewed before merge.                                                                                                                                                                                    |

---

## Current Architecture Limitations

The current release is designed for single-instance, developer-controlled workflows. The following architectural boundaries are documented:

- **In-Memory Session Repository**: The current session repository stores session state in-memory (`InMemoryMigrationSessionRepository`). Restarting the server process resets active sessions. Persistent database storage is planned for multi-instance deployments.
- **Process-Local Execution Lock**: The execution lock (`ExecutionLock`) manages concurrency within a single process. Multi-instance distributed deployments require distributed locking infrastructure (e.g. Redis Redlock or Postgres advisory lock pooling).
- **Authentication & RBAC**: The platform does not currently enforce user authentication or role-based access control. In its current form, it is intended to run as an internal operator tool.
- **Multi-Instance Coordination**: Clustered horizontal scaling requires externalizing session state and execution locks to shared infrastructure.

---

## License

This project is licensed under the [MIT License](./LICENSE).
