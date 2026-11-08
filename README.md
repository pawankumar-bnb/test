# Rafey Personal Performance Hub

Training, nutrition, supplements, physique, goals, Instagram and a printable weekly report, in one site. There is no login: it opens straight to the dashboard.

## Where data lives

Everything saves first in the browser on the device being used, in IndexedDB, so the site opens instantly and works offline.

**Sync across devices** (Settings) keeps the same data on every phone, laptop and browser. Turning it on makes a 20-character sync code; typing that code on another device links it. There are no accounts: the code is the key.

- Each device derives two things from the code: a token for the sync service, which stores only a hash of it, and an AES-256 key that never leaves the device. Entries and photos are encrypted on the device before upload, so the service, and anyone with access to the Cloudflare account, holds only ciphertext.
- Data syncs as small records (one per member, week and fitness test). Edits made on two devices at the same time are merged field by field, so neither is lost.
- Photos upload once and download on another device when first shown.
- Anyone who has the code can see and change the data. Losing every device and the code means losing the cloud copy too, so **Settings → Download backup** is still worth doing now and then.

Without sync, nothing leaves the device, and the public link shows each visitor only their own copy.

Backups from the old single-file tracker (v14) restore directly: press **Backup Data** in the old file, then **Restore backup** here.

## Run it locally

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for goals, dates, backups, the v14 import, fitness test PRs and two-device sync |
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

## The sync service

`worker/` is a Cloudflare Worker: D1 holds the encrypted records, and R2 holds the encrypted photos (or KV, if R2 is not enabled on the account). It accepts at most `MAX_VAULTS` sync codes, so strangers cannot use it as free storage.

```bash
cd worker
npm install
npm run migrate:local && npm run dev   # local service on 127.0.0.1:8787, used by `npm run dev` of the site
npx wrangler deploy                    # publish changes to the Worker
```

The site finds the service through `VITE_SYNC_URL`: `.env.development` points at the local one, `.env.production` at the deployed Worker.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Recharts, and a service worker for offline use. Sync runs on Cloudflare Workers, D1 and R2.
