# World Cup 2026 Betting System (Angular + Node.js + Excel Database + Docker)

This project is a Full-Stack Monorepo application supporting betting for World Cup 2026 matches. Instead of using traditional relational databases, the system leverages **Excel (.xlsx) files** as a lightweight, visual, and highly portable database.

## 🛠️ Tech Stack

- **Frontend**: [Angular (v21)](./frontend) - Developed using Standalone Components, served via Nginx in Docker environments.
- **Backend**: [Node.js & Express](./backend-excel) - Serves RESTful APIs, dynamically syncs official match schedules from the FIFA API, and supports automated bet settlement.
- **Database**: **Excel (.xlsx)** - Stores accounts, matches, and bets in local Excel files located under `backend-excel/data/`.
- **Containerization**: Docker & Docker Compose for multi-container orchestration.

---

## 📂 Project Structure

```text
bet-wc2026/
├── backend-excel/               # Backend source code (Node.js + Express)
│   ├── data/                    # Folder containing Excel Database files (.xlsx)
│   │   ├── accounts.xlsx        # User and admin accounts
│   │   ├── matches.xlsx         # Match schedules and results
│   │   └── bets.xlsx            # Placed bets history
│   ├── init-data.js             # Seeding script to initialize Excel data from FIFA API
│   ├── server.js                # Express API entry point & static file server for Frontend
│   ├── Dockerfile               # Docker build file for backend
│   └── package.json             # Backend dependencies (express, xlsx, bcryptjs...)
├── frontend/                    # Frontend source code (Angular 21)
│   ├── src/                     # Angular app source (Components, Styles, Services)
│   │   └── app/
│   │       ├── services/        # Services for API communication and translations
│   │       ├── app.ts           # Main component logic
│   │       ├── app.html         # Main Angular UI view
│   │       └── app.css          # Custom stylesheets
│   ├── nginx.conf               # Nginx reverse proxy / routing configuration
│   ├── Dockerfile               # Multi-stage Docker build for Angular static hosting
│   └── package.json             # Frontend dependencies
├── docker-compose.yml           # Multi-container startup configuration
├── package.json                 # Monorepo scripts for installing and building all packages
└── railway_deployment.md        # Detailed guide for deploying to Railway Cloud
```

---

## 🚀 Running the Project Locally

Choose one of the two methods below to start the application:

### Option 1: Running with Docker Compose (Recommended)

Make sure you have **Docker** and **Docker Compose** installed on your machine.

1. **Start all services:**
   ```bash
   docker-compose up --build -d
   ```
2. **Initialize sample data (First-time setup only):**
   ```bash
   docker compose exec backend npm run init
   ```

* **Access Links:**
  - **Frontend Web**: [http://localhost:80](http://localhost:80)
  - **Backend API**: [http://localhost:3000/api](http://localhost:3000/api)

---

### Option 2: Running Locally with Node.js & NPM (Development)

Make sure you have **Node.js (v20+)** and **NPM** installed.

1. **Install dependencies and build the static Frontend:**
   Run this in the root directory:
   ```bash
   npm run build
   ```
2. **Seed the Excel Database:**
   Fetch match details from the FIFA API and create default accounts:
   ```bash
   npm run init-data
   ```
3. **Start the API Server:**
   ```bash
   npm run start
   ```

* **Access Links:**
  - **Full-Stack Application**: [http://localhost:3000](http://localhost:3000) (Auto-redirects to `/bet-wc/`).
  - **Backend API**: `http://localhost:3000/api`

---

## 👤 Default Accounts

Once you run the database initialization script, you can log in using the following accounts:

| Username | Password | Role | Full Name |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Administrator (Admin) | Administrator |
| **lctran** | `lctran123` | Administrator (Admin) | Lê Công Trân |
| **cam** | `cam123` | Standard User (User) | Nguyễn Thị Cam |

*Admin accounts have permissions to update match scores, which triggers automatic bet settlements for all related user bets.*

---

## 🌐 Exposing the App (Public Exposing)

If you want others to access your local environment over the internet, you can use tunneling tools:

* **Localtunnel:**
  ```bash
  # If running via Docker (port 80)
  npx localtunnel --port 80
  
  # If running via NPM locally (port 3000)
  npx localtunnel --port 3000
  ```
* **Ngrok:**
  ```bash
  ngrok http 80      # Or ngrok http 3000
  ```

---

## ☁️ Deploying to the Cloud (Railway)

This project is optimized for deployment on the cloud platform **Railway.app**. You have two choices:
1. **Monolithic Service (Recommended - Cost-efficient):** Runs the entire application in a single container.
2. **Multi-Service Docker Compose:** Hosts Frontend and Backend containers separately.

> [!IMPORTANT]
> **Data Persistence Warning:**
> Since this project uses Excel files as its database stored directly on the container's disk, you **must mount a volume** (Persistent Volume) at `/app/backend-excel/data` (for Option 1) or `/app/data` (for Option 2) to prevent data loss when the container restarts or rebuilds.

For step-by-step cloud instructions, refer to the [Railway Deployment Guide](./railway_deployment.md).


