# ⚽ World Cup 2026 Betting System (Angular + Node.js + Excel DB)

The World Cup 2026 Betting System uses **Excel (.xlsx)** files stored in `backend-excel/data/` as its database. You can directly open, view, or edit these Excel files very easily.

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
6. **Knockout Stage**: No Draw results. If a match is tied after 90 minutes, the system will temporarily pause automatic settlement to allow the Admin to update the extra time/penalty shootout score and manually determine the winning team.

---

## 📊 Excel Database Structure

The Excel files are located in the `backend-excel/data/` directory. All **column headers** are written in **UPPERCASE**.

* **`accounts.xlsx`**: Stores user accounts.
  * Columns: `ID`, `USERNAME`, `PASSWORD`, `FULLNAME`, `ROLE`.
* **`matches.xlsx`**: Match schedule (automatically synchronized from FIFA API).
  * Columns: `ID`, `GROUPKEY`, `ROUND`, `TIME` (Vietnam Time), `HOMETEAMNAME`, `HOMETEAMFLAG`, `AWAYTEAMNAME`, `AWAYTEAMFLAG`, `STATUS`, `HOMETEAMGOALS`, `AWAYTEAMGOALS`, `ELAPSEDMINUTES`, `STADIUM`.
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
* `backend-excel/`: Node.js API source code & the directory storing the Excel Database `data/`.
* `frontend/`: Client application built with Angular 21 (managing bets, statistics dashboard & bet history pagination with 4 bets/page).
* `docker-compose.yml`: Docker configuration to run Backend and Frontend in parallel.
