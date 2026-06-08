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

Since the root [package.json](./package.json) contains scripts to build the Angular frontend and start the Express server, you can run the entire application as a single Node.js service. The backend will automatically serve the built static Angular files.

### Step-by-step Deployment

1. **Push your code to GitHub**:
   Ensure all changes are committed and pushed to your GitHub repository.

2. **Create a new project on Railway**:
   - Go to [Railway.app](https://railway.app) and log in.
   - Click **New Project** -> **Deploy from GitHub repo**.
   - Select your repository.

3. **Service detection and builds**:
   Railway will automatically detect the root [Dockerfile](./Dockerfile) and build it using Docker (bypassing Nixpacks/Railpack, which avoids download failures like "Failed to ensure mise is installed").
   - Under **Build Command**, keep it empty (default) as the Dockerfile handles the multi-stage build.
   - Under **Start Command**, keep it empty (default) as the Dockerfile defines the start command.

4. **Add a Persistent Volume (Crucial for Excel DB)**:
   Since the Express server saves users and bets to Excel files inside the container, you **must** use a volume to prevent data loss on restarts or redeployments:
   - Go to your service in the canvas.
   - Click **+ New** -> **Volume** (or click **Volumes** -> **Add Volume** in settings).
   - Set the mount path to:
     ```text
     /app/backend-excel/data
     ```
   - Set the size (e.g., `1 GB` or `5 GB` is more than enough).

   > [!NOTE]
   > **How Initial Data is Kept**: Because Railway volumes start empty, they hide any Excel files compiled into the Docker image under `/app/backend-excel/data`.
   > To solve this, the server keeps a read-only template of your checked-in Excel files in `/app/backend-excel/initial-data`. On first startup, if the volume directory is empty, the application automatically copies the template Excel files (`accounts.xlsx`, `bets.xlsx`, and `matches.xlsx`) into your persistent volume. Subsequent data updates are then saved directly to the volume, securing both your initial configuration and all live user bets!

5. **Expose the app**:
   - Go to your service's **Settings** tab.
   - Under **Networking**, click **Generate Domain** to get a public URL (e.g., `https://wc2026-production.up.railway.app`).
   - The app will be accessible at that URL (it will automatically redirect from `/` to `/bet-wc/`).

---

## Option 2: Multi-Service Docker Compose

Railway supports `docker-compose.yml` natively. When you link your GitHub repository, Railway will parse [docker-compose.yml](./docker-compose.yml) and spin up two separate services.

### Configuration Adjustment for Railway

When deploying separate containers, you need to link the Nginx proxy to the backend container over Railway's private network:

1. **Backend Service setup**:
   - Create a Volume in Railway and mount it to `/app/data` (as defined in [docker-compose.yml](./docker-compose.yml#L10-L11)).
   - Set the internal port mapping for backend to `3000`.

2. **Frontend Service setup**:
   - Railway will provision a frontend service running on port `80` (mapped from Nginx).
   - You need to generate a public domain on the **Frontend** service so users can access the web page.
   - *Private Networking Note*: In [frontend/nginx.conf](./frontend/nginx.conf#L11-L17), the proxy passes `/api/` requests to `http://backend:3000/api/`. On Railway, you must configure a variable in your Frontend service:
     - Add environment variable `BACKEND_URL` on the frontend pointing to the backend's private internal URL (e.g., `http://backend.railway.internal:3000`).

---

> [!IMPORTANT]
> **Data Persistence Warning**
> Since this project uses an Excel-based database, any write operations (registering users, placing bets) are saved directly onto the server disk. You **must attach a volume** to your backend service (using mount path `/app/backend-excel/data` for Option 1, or `/app/data` for Option 2) to prevent all data from being wiped out when the service restarts or redeploys.
> 
> *Note on Initial Data*: Railway volumes are blank by default. The system has been modified to automatically copy the pre-seeded Excel databases from `initial-data/` to the volume directory on the first run, so you won't lose your initial accounts/matches. Subsequent deployments will not overwrite your active data volume.
