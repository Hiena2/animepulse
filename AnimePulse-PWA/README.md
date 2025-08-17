# AnimePulse — PWA

A lightweight, installable web app to track anime release times, season news, and get simple AI-style suggestions.

## Features
- Releases: next episode (local time), countdown, favorites, reminders (Notification API), `.ics` export.
- News: add announcements and tags, backup/restore JSON.
- AI: search-by-anything ranking + offline suggestions influenced by your liked genres.
- Optional AniList link: auto-pull `nextAiringEpisode` timestamps by Media ID.
- Installable PWA with offline cache. Optional Web Push (needs small backend).

## Quick Start (Local)
1. Serve the folder over HTTPS or http://localhost using any static server (e.g. `npx serve -s .`).
2. Open in Safari or Chrome: `http://localhost:3000` (or your port).
3. The app registers a service worker and caches itself for offline use.

## Deploy to GitHub Pages (No Backend)
1. Create a GitHub repo and push these files.
2. In **Settings → Pages**, set **Branch: main** and **/ (root)**. Save and wait for the URL.
3. Open the **Pages URL in Safari on your iPhone**.
4. Tap the share icon → **Add to Home Screen** to install as an app.
5. Open the app from your home screen, grant notifications if you use reminders.

> iOS requires iOS 16.4+ for Web Push (only for PWAs installed on the Home Screen).

## Optional Backend for Push + RSS News
Use the example Node server I provided in chat:
- Stores web-push subscriptions (`/api/push/subscribe`).
- Aggregates news via `/api/news` (RSS → JSON).
- Use VAPID keys to enable Web Push.
- In Settings (inside the app), paste your **VAPID Public Key** and click **Enable Push**.

## AniList Linking
- In a card, click **Find by title** to auto-fill the ID.
- Click **Link & Sync** to fetch precise next-airing timestamps and set `latestEpisode = next - 1`.

Enjoy!
