# ⚽ World Cup 2026 X-CUP (Angular + Node.js + Excel DB)

The World Cup 2026 X-CUP uses **Excel (.xlsx)** files stored in the active data directory as its database. You can directly open, view, or edit these Excel files very easily. All matches and scores are synchronized in real-time exclusively from **Flashscore VN**.

---

## 📋 Rules & Scoring

1. **Stake**: Each bet defaults to **10,000 ₫** (automatically applied by the system).
2. **Bet limits**: Each player can only place a bet **at most once per match**. The interface will display the bet button as **BET PLACED** (ĐÃ CƯỢC) and disable it after a successful bet.
3. **Locking bets**: The system automatically locks bets when a match is in progress (**LIVE**) or has ended (**FT**).
4. **Bet option rules (column `BETTYPE`)**:
   - Betting on Home team or Away team win: Save the team name in English (e.g., `USA`, `France`).
   - Selecting a Draw: Save as `Draw` (do not use Vietnamese equivalents like "hòa" or "hóa").
5. **Scoring**:
   - **Correct Prediction**: Receive **0 ₫** (no deduction).
   - **Incorrect Prediction**: Deduct **-10,000 ₫** from the ranking points.
6. **Knockout Stage & Extra Time**:
   - The system fully supports and displays both **injury time** (e.g., `45+2'`, `90+3'`) and **extra time** (`ET` / Hiệp phụ) / **penalty shootouts** (`Pen`).
   - It stores the 90-minute regular time score (`homeGoals90`/`awayGoals90`) and the final after-extra-time score (`extraHomeGoals`/`extraAwayGoals`/`penHomeGoals`/`penAwayGoals`) separately.
   - Settle rules automatically evaluate correct predictions based on the regulation 90-minute score.

---

## 🛠️ Architecture & Design Patterns

The backend has been refactored to implement clean software engineering design patterns:

1. **Strategy Design Pattern**:
   - Scraper logic is decoupled from the main match services. A base `ScraperStrategy` interface defines scraping routines, and `FlashscoreScraper` implements the Puppeteer crawler for Flashscore VN.
2. **Factory Design Pattern**:
   - A `ScraperFactory` resolves and instantiates the correct scraper strategy class dynamically.
3. **Observer Design Pattern (Event-Driven)**:
   - Circular dependencies between `MatchService` and `BetService` have been removed.
   - `MatchService` inherits from Node's built-in `EventEmitter` and emits a `matchCompleted` event when a match finishes.
   - `BetService` subscribes to this event on startup and automatically settles bets, maintaining clean decoupling.

---

## ⚙️ Environment Configuration

You can configure the server dynamically using the following environment variables (with default values for local development):

| Environment Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | Web server port. | `3000` |
| `DATA_DIR` | Directory path where active Excel database files are saved. | `./backend-excel/data/` |
| `ACCOUNTS_FILE_NAME` | Name of the accounts database file. | `accounts.xlsx` |
| `BETS_FILE_NAME` | Name of the bets database file. | `bets.xlsx` |
| `MATCHES_FILE_NAME` | Name of the matches database file. | `matches.xlsx` |
| `CHROME_PATH` | Path to the Chrome/Chromium executable (probes standard OS paths if empty). | *Auto-detected depending on OS* |
| `FLASHSCORE_RESULTS_URL` | Flashscore VN URL for past results. | `https://www.flashscore.vn/bong-da/world/world-cup/ket-qua/` |
| `FLASHSCORE_FIXTURES_URL` | Flashscore VN URL for upcoming fixtures. | `https://www.flashscore.vn/bong-da/world/world-cup/lich-thi-dau/` |
| `SYNC_INTERVAL_MS` | Repeating background synchronization interval. | `120000` (2 minutes) |
| `KNOWN_SCORES` | Optional JSON string to manually override specific match scores. | *Pre-configured defaults* |

---

## 📊 Excel Database Structure

The Excel files are located in the active data directory. All **column headers** are written in **UPPERCASE**.

* **`accounts.xlsx`**: Stores user accounts.
  * Columns: `ID`, `USERNAME`, `PASSWORD`, `FULLNAME`, `ROLE`.
* **`matches.xlsx`**: Match schedule and live scores (automatically updated in real-time from Flashscore VN).
  * Columns: `ID`, `GROUPKEY`, `ROUND`, `TIME` (Vietnam Time), `HOMETEAMNAME`, `HOMETEAMFLAG`, `AWAYTEAMNAME`, `AWAYTEAMFLAG`, `STATUS`, `HOMETEAMGOALS`, `AWAYTEAMGOALS`, `ELAPSEDMINUTES`, `STADIUM`, `HOMEGOALS90`, `AWAYGOALS90`, `EXTRAHOMEGOALS`, `EXTRAAWAYGOALS`, `PENHOMEGOALS`, `PENAWAYGOALS`.
* **`bets.xlsx`**: List of placed bets.
  * Columns: `ID`, `DATE`, `NAME`, `USERNAME`, `MATCHID`, `MATCHNAME`, `BETTYPE`, `STAKE`, `STATUS` (`pending`/`won`/`lost`), `PAYOUT`.

---

## 🚀 Running the Project

### Method 1: Running locally (Recommended for Development)
Requires **Node.js (v20+)** installed:

1. **Install & Build:**
   ```bash
   npm run build
   ```
2. **Initialize initial data:**
   ```bash
   npm run init-data
   ```
3. **Start the server:**
   ```bash
   npm run start
   ```
4. **Access:** [http://localhost:3000](http://localhost:3000) (The website automatically redirects to `/bet-wc/`).

---

### Method 2: Running via Docker
1. **Start the containers:**
   ```bash
   docker-compose up --build -d
   ```
2. **Initialize initial Excel data:**
   ```bash
   docker compose exec backend npm run init
   ```
3. **Access:**
   - **Web Interface:** [http://localhost:80](http://localhost:80)
   - **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)

---

## 👤 Default Login Accounts

| Username | Password | Role | Full Name | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Admin | Administrator | Manage matches, update scores, determine results |
| **lctran** | `lctran123` | Admin | Tran Chanh Luan | Manage matches, update scores, determine results |

---

## 📂 Directory Structure
* `backend-excel/`: Node.js API source code & service implementations.
  * `backend-excel/src/services/scrapers/`: Flashscore Puppeteer scraping strategies and factories.
  * `backend-excel/data/`: Default local directory storing active Excel sheets.
  * `backend-excel/initial-data/`: Read-only baseline templates used to copy/seed data folders on startup.
* `frontend/`: Client web app built with Angular (managing bets, statistics dashboard & bet history).
* `Dockerfile`: Root multi-stage Docker build file (automatically installs Chromium and required Alpine font dependencies for Puppeteer to run out-of-the-box on Railway).
* `docker-compose.yml`: Docker configuration to run Backend and Frontend services in parallel.

