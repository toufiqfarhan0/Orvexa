# Orvexa

A full-stack TypeScript application monorepo engineered with a React frontend, Node.js API backend, database inspection port/adapter architecture, and shared TypeScript domain models.

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
│   │   │   ├── app.ts             # Express application factory
│   │   │   └── index.ts           # Server entrypoint
│   │   ├── tests/                 # Unit, analyzer & integration test suites
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
│       │   ├── types/             # Domain & inspection data contracts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   └── init-db.sql                # PostgreSQL test database schema fixture
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

## Environment Configuration

Configuration variables are defined in `.env.example`:

| Variable       | Description                                               | Default                                                           |
| :------------- | :-------------------------------------------------------- | :---------------------------------------------------------------- |
| `PORT`         | Backend server port                                       | `4000`                                                            |
| `NODE_ENV`     | Runtime environment (`development`, `production`, `test`) | `development`                                                     |
| `CORS_ORIGIN`  | Allowed CORS origin                                       | `http://localhost:5173`                                           |
| `DATABASE_URL` | PostgreSQL connection URL for database inspection         | `postgresql://postgres:postgres@localhost:5432/schemasentry_test` |

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
npm run test
npm run build
```
