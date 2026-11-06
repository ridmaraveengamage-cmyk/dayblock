# Dayblock — personal planner

One codebase that works as a **website** and as an **installable app** (desktop or phone).

## Features
- **Sign in** with Google or email + password (or continue without an account). Signed-in data syncs across devices.
- **Time blocks** — Day, Week and Month views.
  - Click empty time → 1-hour block. Drag on empty time → any length.
  - Drag a block to move it (also to another day in Week view); drag its bottom edge to resize.
  - Circle = done. ▶ = start timer. Colour-coded categories.
- **To-do** — List, Day, Week and Month views. Priorities, due dates, filters, "time needed" estimates.
- **Repeats** — blocks and tasks can repeat daily, every weekday, weekly (pick days) or monthly, every N days/weeks/months, with an optional end date.
  - Editing a repeating block asks: *only this one*, *this and following*, or *all*.
  - Ticking off a repeating task creates the next one automatically.
- **Looks** — Aurora (soft glass), Midnight (dark glow) or Paper (warm ink), each in light or dark. Pick in Settings.
- **Custom categories** — add, rename, recolor or delete categories in Settings.
- **Time tracking** — press ▶ on any task or block. Pause for breaks, Resume, and **Stop** when finished (stopping marks it complete).
  The timer shows when you actually started, the live time and your planned slot; the timeline shows tracked sessions as a slim lane.
- **Postpone** — move a task or block to tomorrow, the weekend, next week or any date, with a reason. Dragging to a later day counts too.
  History and a ↷ count show what keeps slipping.
- **Linked tasks** — “Starts after” links tasks into chains. When one is postponed or runs late, everything after it moves too
  (ask or automatic, set in Settings). See all chains in To-do → Linked.
- **Insights** — planned vs. tracked time for a day, week or month: totals, per-day chart, categories, per-item table,
  start/finish punctuality vs. plan, your real working hours, postponements, and plain-language tips.
- **Vision** — vision statement, daily affirmation, vision board, wheel of life, life goals with steps, and a daily journal.
- **Diary** — memories with mood, photos, videos, audio and files. Photos sync to your account (shrunk to < 1 MB);
  videos and other files stay on the device where you added them (the free Firebase plan has no file storage).
- **Learn** — a step-by-step guide to the app and 14 practical lessons on time management, focus, goals, habits and wellbeing.

Shortcuts: `N` new · `←` `→` move · `T` today · `D` `W` `M` day / week / month.

## Run it on this computer
```
powershell -ExecutionPolicy Bypass -File serve.ps1
```
Then open http://localhost:8080. In Chrome or Edge: **Settings → Install Dayblock as an app**.

## Turn on Google + email sign-in (Firebase, free tier)
Until you do this, the sign-in buttons are disabled and the app works on this device only.

1. Go to https://console.firebase.google.com → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** and **Google**.
3. **Build → Firestore Database → Create database** (production mode, any region).
   Open the **Rules** tab, paste the contents of `firestore.rules`, and **Publish**.
4. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` object.
5. Paste it into `firebase-config.js` (replace `null`).
6. **Authentication → Settings → Authorized domains**: `localhost` is there by default.
   Add your real website domain when you put it online (for example `yourname.github.io`).

The Firebase web config is not a secret — it's meant to be in the page. The Firestore rules are what keep
each user's data private (every user can read/write only `users/<their id>`).

## Put it online
Upload this folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, or Firebase Hosting).
Then on a phone: Android/Chrome → menu → *Install app*; iPhone/Safari → Share → *Add to Home Screen*.

## Your data
- Not signed in: saved in this browser only. Use **Settings → Export backup** to keep a copy.
- Signed in: kept on the device and synced to your account. The first time you sign in, anything you
  planned without an account is added to it.

## Files
| File | What it does |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Look and layout (light + dark) |
| `app.js` | Planner logic: views, repeats, timer, insights |
| `auth.js` | Sign-in and cloud sync (Firebase) |
| `firebase-config.js` | Your Firebase keys go here |
| `firestore.rules` | Database security rules to paste into Firebase |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Installable app + offline support |
| `serve.ps1` | Tiny local web server for Windows |
