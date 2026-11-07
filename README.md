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

## Live site

**https://rafeysupermodel.in**

Every push to `main` runs the tests, builds, and publishes there through `.github/workflows/deploy.yml`, usually within two minutes. The old `pawankumar-bnb.github.io/test/` address redirects to it.

## Domain setup

The domain is registered at GoDaddy and set as the custom domain under **Settings → Pages** in this repository. Its DNS records at GoDaddy:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `pawankumar-bnb.github.io` |

Changing domain again needs no code change: the build uses relative paths and hash routes. Browser storage belongs to a web address, though, so saved data does not follow to a new domain. Download a backup on the old address and restore it on the new one.

## Adding login and cloud sync later

All persistence goes through the `StorageAdapter` interface in `src/lib/storage/adapter.ts`. A cloud version implements that interface and is swapped in at `src/store/hub.ts`; the pages do not change.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Recharts, and a service worker for offline use.
