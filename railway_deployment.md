# Deploying to Railway.app

This guide explains how to host your **WC2026 Betting App** on Railway. There are two primary approaches for deployment, depending on your preference for simplicity and cost.

---

## Comparison of Deployment Options

| Feature | Option 1: Monolithic Service (Recommended) | Option 2: Docker Compose (Multi-Service) |
| :--- | :--- | :--- |
| **Railway Cost** | **Low** (Uses only 1 service slot) | **Medium** (Uses 2 services: frontend + backend) |
| **Complexity** | **Very Simple** (Built-in monorepo scripts) | **Moderate** (Requires private networking configuration) |
| **CORS / API Routing** | **Automatic** (Served on the same domain & port) | **Proxied** (Uses Nginx reverse proxy configuration) |
| **Data Persistence** | Yes (Requires 1 Volume) | Yes (Requires 1 Volume) |

---

## Option 1: Monolithic Single-Service (Recommended)

Since the root [package.json](file:///C:/Users/lctran/wc2026-bet/package.json) contains scripts to build the Angular frontend and start the Express server, you can run the entire application as a single Node.js service. The backend will automatically serve the built static Angular files.

### Step-by-step Deployment

1. **Push your code to GitHub**:
   Ensure all changes are committed and pushed to your GitHub repository.

2. **Create a new project on Railway**:
   - Go to [Railway.app](https://railway.app) and log in.
   - Click **New Project** -> **Deploy from GitHub repo**.
   - Select your repository.

3. **Configure the Service settings**:
   Railway will automatically detect the root Node.js project and run the build command.
   - Go to your service's **Settings** tab.
   - Under **Build Command**, verify it runs: `npm run build`
   - Under **Start Command**, verify it runs: `npm run start`

4. **Add a Persistent Volume (Crucial for Excel DB)**:
   Since the Express server saves users and bets to Excel files inside the container, you **must** use a volume to prevent data loss on restarts or redeployments:
   - Go to your service in the canvas.
   - Click **+ New** -> **Volume** (or click **Volumes** -> **Add Volume** in settings).
   - Set the mount path to:
     ```text
     /app/backend-excel/data
     ```
   - Set the size (e.g., `1 GB` or `5 GB` is more than enough).

5. **Expose the app**:
   - Go to your service's **Settings** tab.
   - Under **Networking**, click **Generate Domain** to get a public URL (e.g., `https://wc2026-production.up.railway.app`).
   - The app will be accessible at that URL (it will automatically redirect from `/` to `/bet-wc/`).

---

## Option 2: Multi-Service Docker Compose

Railway supports `docker-compose.yml` natively. When you link your GitHub repository, Railway will parse [docker-compose.yml](file:///C:/Users/lctran/wc2026-bet/docker-compose.yml) and spin up two separate services.

### Configuration Adjustment for Railway

When deploying separate containers, you need to link the Nginx proxy to the backend container over Railway's private network:

1. **Backend Service setup**:
   - Create a Volume in Railway and mount it to `/app/data` (as defined in [docker-compose.yml](file:///C:/Users/lctran/wc2026-bet/docker-compose.yml#L10-L11)).
   - Set the internal port mapping for backend to `3000`.

2. **Frontend Service setup**:
   - Railway will provision a frontend service running on port `80` (mapped from Nginx).
   - You need to generate a public domain on the **Frontend** service so users can access the web page.
   - *Private Networking Note*: In [frontend/nginx.conf](file:///C:/Users/lctran/wc2026-bet/frontend/nginx.conf#L11-L17), the proxy passes `/api/` requests to `http://backend:3000/api/`. On Railway, you must configure a variable in your Frontend service:
     - Add environment variable `BACKEND_URL` on the frontend pointing to the backend's private internal URL (e.g., `http://backend.railway.internal:3000`).

---

> [!IMPORTANT]
> **Data Persistence Warning**
> Since this project uses an Excel-based database, any write operations (registering users, placing bets) are saved directly onto the server disk. You **must attach a volume** to your backend service (using mount path `/app/backend-excel/data` for Option 1, or `/app/data` for Option 2) to prevent all data from being wiped out when the service restarts or redeploys.
