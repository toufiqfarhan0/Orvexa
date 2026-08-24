# Orvexa

A full-stack TypeScript application monorepo engineered with a React frontend, Node.js API backend, database inspection port/adapter architecture, TrueForge AI agent harness integration, and shared TypeScript domain models.

---

## Repository Structure

```
Orvexa/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Continuous integration pipeline
├── apps/
│   ├── server/                    # Node.js + Express API backend, static analyzer & database inspection
│   │   ├── src/
│   │   │   ├── analyzer/          # Static SQL migration analyzer & risk rules engine
│   │   │   │   ├── calculators/   # Deterministic risk & lock score calculators
│   │   │   │   ├── interfaces/    # MigrationAnalyzer port interface
│   │   │   │   ├── parser/        # SqlStatementParser (DDL statement splitter & tokenizer)
│   │   │   │   ├── rules/         # Modular rules (Locking, Integrity, Perf, Rollback, Compat)
│   │   │   │   └── services/      # MigrationAnalyzerService orchestration
│   │   │   ├── config/            # Environment configuration
│   │   │   ├── db/                # PostgreSQL inspection port, adapter, and service
│   │   │   │   ├── adapters/      # PgInspectionAdapter (read-only system catalog queries)
│   │   │   │   ├── errors/        # Typed database error hierarchy
│   │   │   │   ├── ports/         # PostgresInspectionPort interface
│   │   │   │   ├── services/      # PostgresInspectionService
│   │   │   │   └── utils/         # Connection string sanitizer & identifier validator
│   │   │   ├── domain/            # Core migration session domain model & state machine
│   │   │   ├── repositories/      # Migration session repositories
│   │   │   ├── routes/            # API route handlers (/api/health)
│   │   │   ├── services/          # MigrationAnalysisService & MigrationSessionService
│   │   │   ├── trueforge/         # TrueForge agent runtime adapter, secret-safe logger & verification
│   │   │   ├── app.ts             # Express application factory
│   │   │   └── index.ts           # Server entrypoint
│   │   ├── tests/                 # Unit, analyzer, TrueForge & PostgreSQL integration test suites
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/                       # React + Vite frontend application
│       ├── src/
│       │   ├── styles/            # CSS design tokens
│       │   ├── App.tsx            # Main application component
│       │   ├── main.tsx           # Client entrypoint
│       │   └── vite-env.d.ts
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   └── shared/                    # Shared TypeScript interfaces & types
│       ├── src/
│       │   ├── types/             # Domain, inspection & TrueForge agent contracts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   ├── init-db.sql                # PostgreSQL test database schema fixture
│   ├── patch-kysely.cjs           # Windows ESM path compatibility patch
│   └── write-readme.cjs           # Readme generator
├── docker-compose.yml             # Local PostgreSQL test container
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore rules
├── .prettierrc                    # Code formatting configuration
├── eslint.config.mjs              # ESLint configuration
├── package.json                   # Root workspace configuration
└── tsconfig.base.json             # Shared TypeScript configuration
```

---

## Prerequisites

- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Docker & Docker Compose** (Optional, for local PostgreSQL test container)

---

## Installation & Setup

1. Clone the repository and navigate to the project root:

   ```bash
   git clone <repo-url>
   cd Orvexa
   ```

2. Copy the environment configuration template:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. _(Optional)_ Start the isolated local PostgreSQL test environment:

   ```bash
   docker compose up -d
   ```

---

## TrueForge Agent Runtime Setup

Orvexa integrates with the **TrueForge Agent Harness** (`@truefoundry/trueforge`) via an application port/adapter architecture (`TrueForgePort` -> `TrueForgeAdapter`).

### 1. Start TrueForge Locally

Start the local TrueForge agent server in standalone mode:

```bash
npm run trueforge:start
```

TrueForge will listen on `http://localhost:8790` with SQLite persistence and Swagger API documentation at `http://localhost:8790/api/v1/docs`.

### 2. Configure Model Provider Credentials

Add the API key for your preferred model provider to your `.env` file:

```bash
# Target Model Configuration
TRUEFORGE_BASE_URL=http://localhost:8790
TRUEFORGE_MODEL_PROVIDER=google-gemini
TRUEFORGE_MODEL_NAME=google-gemini/gemini-3.6-flash

# Model Provider API Key (set the key for your provider)
GEMINI_API_KEY=your_gemini_api_key
# OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Verify TrueForge Runtime

Run the developer verification utility to confirm server reachability, session lifecycle, and turn execution:

```bash
npm run verify:trueforge
```

---

## SchemaSentry Model Context Protocol (MCP) Server

Orvexa exposes a dedicated, read-only **Model Context Protocol (MCP)** server on `/api/mcp` powered by `@modelcontextprotocol/sdk`. This allows TrueForge AI agents to safely query and inspect live PostgreSQL catalogs during migration risk evaluation.

### Available MCP Tools

| Tool Name                 | Parameters                                                                                                                                   | Description                                                                                                                               |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `inspect_postgres_target` | `table` (string, required)<br>`schema` (string, optional, default: `"public"`)<br>`includeDependencies` (boolean, optional, default: `true`) | Performs safe, read-only inspection of target table columns, constraints, foreign keys, indexes, table statistics, and active lock state. |

### Verify MCP Tool Integration

Run the end-to-end MCP verification utility to confirm tool registration, remote SSE transport discovery, database querying, and AI summarization:

```bash
npm run verify:mcp
```

---

## Environment Configuration

Configuration variables are defined in `.env.example`:

| Variable                   | Description                                               | Default                                                           |
| :------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------- |
| `PORT`                     | Backend server port                                       | `4000`                                                            |
| `NODE_ENV`                 | Runtime environment (`development`, `production`, `test`) | `development`                                                     |
| `CORS_ORIGIN`              | Allowed CORS origin                                       | `http://localhost:5173`                                           |
| `DATABASE_URL`             | PostgreSQL connection URL for database inspection         | `postgresql://postgres:postgres@localhost:5432/schemasentry_test` |
| `TRUEFORGE_BASE_URL`       | TrueForge server base URL                                 | `http://localhost:8790`                                           |
| `TRUEFORGE_API_KEY`        | Optional ID token for TrueForge authenticated instances   | `undefined`                                                       |
| `TRUEFORGE_MODEL_PROVIDER` | Selected model provider (`google-gemini`, `openai`, etc.) | `google-gemini`                                                   |
| `TRUEFORGE_MODEL_NAME`     | Default model fully qualified name                        | `google-gemini/gemini-3.6-flash`                                  |
| `GEMINI_API_KEY`           | Google Gemini API key                                     | `undefined`                                                       |
| `OPENAI_API_KEY`           | OpenAI API key                                            | `undefined`                                                       |
| `ANTHROPIC_API_KEY`        | Anthropic API key                                         | `undefined`                                                       |

---

## Available Scripts

Run these commands from the repository root:

| Command                          | Description                                                                |
| :------------------------------- | :------------------------------------------------------------------------- |
| `npm run dev`                    | Starts both backend server and frontend development server concurrently    |
| `npm run dev:server`             | Starts backend development server with live reload                         |
| `npm run dev:web`                | Starts frontend development server with Vite                               |
| `npm run build`                  | Builds all workspaces (`@orvexa/shared`, `@orvexa/server`, `@orvexa/web`)  |
| `npm test` / `npm run test:unit` | Runs deterministic unit & domain test suite without requiring Docker       |
| `npm run test:integration`       | Runs the real PostgreSQL integration test suite against the local database |
| `npm run test:all`               | Runs both unit and real PostgreSQL integration test suites                 |
| `npm run verify:trueforge`       | Verifies connectivity, session lifecycle, and turns against TrueForge      |
| `npm run trueforge:start`        | Launches the local TrueForge agent server on port 8790                     |
| `npm run docker:db:up`           | Starts the isolated local PostgreSQL 16 test database container            |
| `npm run docker:db:down`         | Stops and removes the local PostgreSQL test container                      |
| `npm run verify:db`              | Executes the live PostgreSQL inspection verification utility               |
| `npm run lint`                   | Lints codebase using ESLint                                                |
| `npm run typecheck`              | Type-checks all workspaces with TypeScript compiler                        |
| `npm run format:check`           | Verifies code formatting with Prettier                                     |
| `npm run format`                 | Formats all code with Prettier                                             |

---

## Testing & Quality

Run the quality check suite locally:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run verify:db
npm run verify:trueforge
npm run build
```
