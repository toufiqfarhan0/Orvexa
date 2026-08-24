# Orvexa

A full-stack TypeScript application monorepo structured with a React frontend, Node.js API backend, and shared TypeScript type definitions.

---

## Repository Structure

```
Orvexa/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Continuous integration pipeline
├── apps/
│   ├── server/                    # Node.js + Express API backend
│   │   ├── src/
│   │   │   ├── config/            # Environment variable configuration
│   │   │   ├── routes/            # API route handlers (/api/health)
│   │   │   ├── app.ts             # Express application factory
│   │   │   └── index.ts           # Server entrypoint
│   │   ├── tests/                 # Server test suites
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/                       # React + Vite frontend application
│       ├── src/
│       │   ├── styles/            # CSS tokens and styling
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
│       │   ├── types/             # API data contracts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
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

---

## Installation

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

---

## Environment Configuration

Configuration variables are defined in `.env.example`:

| Variable      | Description                                               | Default                 |
| :------------ | :-------------------------------------------------------- | :---------------------- |
| `PORT`        | Backend server port                                       | `4000`                  |
| `NODE_ENV`    | Runtime environment (`development`, `production`, `test`) | `development`           |
| `CORS_ORIGIN` | Allowed CORS origin                                       | `http://localhost:5173` |

---

## Available Scripts

Run these commands from the repository root:

| Command                | Description                                                               |
| :--------------------- | :------------------------------------------------------------------------ |
| `npm run dev`          | Starts both backend server and frontend development server concurrently   |
| `npm run dev:server`   | Starts backend development server with live reload                        |
| `npm run dev:web`      | Starts frontend development server with Vite                              |
| `npm run build`        | Builds all workspaces (`@orvexa/shared`, `@orvexa/server`, `@orvexa/web`) |
| `npm run test`         | Runs the test suite with Vitest                                           |
| `npm run lint`         | Lints codebase using ESLint                                               |
| `npm run typecheck`    | Type-checks all workspaces with TypeScript compiler                       |
| `npm run format:check` | Verifies code formatting with Prettier                                    |
| `npm run format`       | Formats all code with Prettier                                            |

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
