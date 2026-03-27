# Illuma Pipeline — Setup Guide

Two steps: Supabase (database) then Vercel (website). Takes about 15–20 minutes total.

---

## Step 1 — Supabase (your database)

### 1.1 Create account + project
1. Go to **supabase.com** → sign up (free)
2. Click **New project**
3. Name it `illuma-pipeline`, pick a region (US East), set a password, click **Create project**
4. Wait ~1 min for it to spin up

### 1.2 Run the database setup
1. In your project, go to **SQL Editor** (left sidebar) → **New query**
2. Open the file `supabase-setup.sql` from this folder
3. Copy the entire contents → paste into the editor → click **Run**
4. You should see "Success. No rows returned"

### 1.3 Grab your API keys
1. Go to **Project Settings** (gear icon, bottom left) → **API**
2. Copy two values — you'll need them in a moment:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`

---

## Step 2 — Deploy to Vercel (your website)

### 2.1 Get the code on GitHub
1. Go to **github.com** → sign in (or create a free account)
2. Click **+** → **New repository** → name it `illuma-pipeline` → **Create repository**
3. On your computer, open Terminal and run:

```bash
cd illuma-pipeline        # navigate to this project folder
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/illuma-pipeline.git
git push -u origin main
```

### 2.2 Deploy on Vercel
1. Go to **vercel.com** → sign in with GitHub (free)
2. Click **Add New Project** → import your `illuma-pipeline` repo
3. Before clicking Deploy, scroll to **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → paste your Project URL from step 1.3
   - `VITE_SUPABASE_ANON_KEY` → paste your anon key from step 1.3
4. Click **Deploy**
5. Vercel builds it and gives you a live URL like `illuma-pipeline.vercel.app`

**Share that URL with Dan, Alyssa, and Logan — that's it.**

---

## Running locally (optional, for making changes)

```bash
# 1. Copy the env file and fill it in
cp .env.example .env
# Edit .env and paste your Supabase URL and key

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
# Opens at http://localhost:5173
```

To deploy changes later: just `git push` — Vercel auto-redeploys.

---

## How it works day-to-day

- Everyone opens the Vercel URL in their browser
- First visit: pick your name (remembered on that device)
- All deal edits, stage changes, comments sync live across all users
- Switch who you are anytime via the avatar badge top-right

---

## Customizing the team or verticals

Open `src/App.jsx` and find these lines near the top:

```js
const TEAM      = ['Alby', 'Dan', 'Alyssa', 'Logan']
const VERTICALS = ['Agency / Trading Desk', 'Pharma', 'Political', 'Brand Direct', 'Other']
```

Edit and push — Vercel redeploys automatically.
