# Rafey Personal Performance Hub

Training, nutrition, supplements, physique, goals, Instagram and a printable weekly report, in one site. There is no login: it opens straight to the dashboard.

## Where data lives

Everything saves automatically in the browser on the device being used, in IndexedDB. Nothing is uploaded, so the public link shows each visitor only their own empty or saved copy. It also means data does not sync between devices. Use **Settings → Download backup / Restore backup** to move it or keep it safe.

Backups from the old single-file tracker (v14) restore directly: press **Backup Data** in the old file, then **Restore backup** here.

## Run it locally

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for goals, dates, backups and the v14 import |
| `npm run lint` | Lint |
| `npm run build` | Type-check and build to `dist/` |

## Deploying

Every push to `main` runs the tests, builds, and publishes to GitHub Pages through `.github/workflows/deploy.yml`.

## Adding a custom domain later

1. In the repository, open **Settings → Pages → Custom domain**, enter the domain and save.
2. Add the DNS records GitHub shows.

No code change is needed: the build uses relative paths and hash routes. One thing to plan for is that browser storage belongs to a web address, so data does not follow automatically to a new domain. Download a backup on the old address and restore it on the new one.

## Adding login and cloud sync later

All persistence goes through the `StorageAdapter` interface in `src/lib/storage/adapter.ts`. A cloud version implements that interface and is swapped in at `src/store/hub.ts`; the pages do not change.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Recharts, and a service worker for offline use.
