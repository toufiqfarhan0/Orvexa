# Orvexa Production Deployment Guide (Render)

This guide walks you through deploying the complete Orvexa platform (**Backend API + React Frontend + MCP Server + Static Analyzer + Sandbox Workflow Engine**) as an all-in-one free-tier Web Service on [Render](https://render.com).

---

## Option 1: Automatic Deployment with Render Blueprint (Recommended)

Orvexa includes a [`render.yaml`](../render.yaml) Blueprint file configured for 1-click deployment.

### Steps:

1. Push your latest code to your GitHub repository (`https://github.com/toufiqfarhan0/Orvexa`).
2. Log in to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** in the top-right corner and select **Blueprint**.
4. Connect your GitHub repository (`toufiqfarhan0/Orvexa`).
5. Render will automatically detect `render.yaml` and configure:
   - **Service Name**: `orvexa`
   - **Runtime**: `Node`
   - **Plan**: `Free`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
6. Click **Apply**.
7. Render will build the shared library, server, and web frontend, then launch the service on a public HTTPS URL (e.g. `https://orvexa.onrender.com`).

---

## Option 2: Manual Web Service Setup on Render

If you prefer to configure the Web Service manually:

1. In the [Render Dashboard](https://dashboard.render.com), click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** and pick `toufiqfarhan0/Orvexa`.
3. Configure the following settings:

| Setting           | Value                                              |
| :---------------- | :------------------------------------------------- |
| **Name**          | `orvexa`                                           |
| **Language**      | `Node`                                             |
| **Branch**        | `main`                                             |
| **Region**        | Any (e.g., `Oregon (US West)` or `Frankfurt (EU)`) |
| **Build Command** | `npm ci && npm run build`                          |
| **Start Command** | `npm start`                                        |
| **Instance Type** | `Free`                                             |

4. Under **Environment Variables**, add:

| Key                                 | Value        | Notes                                            |
| :---------------------------------- | :----------- | :----------------------------------------------- |
| `NODE_ENV`                          | `production` | Enables production static asset serving          |
| `PORT`                              | `10000`      | Render default web port                          |
| `CORS_ORIGIN`                       | `*`          | Or specify your domain                           |
| `DATABASE_URL`                      | _(Optional)_ | Link to a Render PostgreSQL or external database |
| `DAYTONA_API_KEY`                   | _(Optional)_ | For isolated remote sandbox rehearsals           |
| `DAYTONA_SERVER_URL`                | _(Optional)_ | Daytona remote server endpoint                   |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | _(Optional)_ | Model keys for TrueForge agent harness           |

5. Under **Advanced Settings**:
   - Set **Health Check Path** to `/api/health`.
   - Set **Auto-Deploy** to `Yes`.
6. Click **Create Web Service**.

---

## Verifying Your Live Deployment

Once Render finishes the build:

1. **Health Check**: Open `https://<your-render-subdomain>.onrender.com/api/health` in your browser. It will return:
   ```json
   {
     "success": true,
     "data": {
       "status": "healthy",
       "service": "orvexa-backend",
       "version": "0.1.0",
       "timestamp": "..."
     }
   }
   ```
2. **Landing Page**: Open `https://<your-render-subdomain>.onrender.com/` to view the landing page and architecture visualizer.
3. **Migration Console**: Open `https://<your-render-subdomain>.onrender.com/console` to use the interactive operator console.
