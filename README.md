# CM Tools — Equipment Overview

A **static, front-end-only** website that hosts the **CM Tools → Equipment Overview** page —
browse equipment categories, classes, makes, models, rate history (charts), and photos.

This is a read-only public site. There is no login, no backend, and no database. All
equipment data is bundled as static JSON under [`public/equipment_data/`](public/equipment_data/)
and all photos are bundled under [`public/equipment_photos/`](public/equipment_photos/).

## Tech stack

- React 18 + Vite 7
- react-router-dom 7 (`BrowserRouter`)
- react-bootstrap / bootstrap
- d3 (sunburst visualization)
- chart.js + react-chartjs-2 (rate history charts)

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

## Build & preview

```bash
npm run build    # outputs to dist/ (also copies index.html -> 404.html for SPA routing)
npm run preview
```

## Deployment (GitHub Pages, custom domain)

Deployment is automated via GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):

1. Push to the `main` branch.
2. The workflow runs `npm ci && npm run build` and publishes `dist/` to GitHub Pages.
3. In the repository settings, set **Settings → Pages → Build and deployment → Source** to
   **GitHub Actions**.

### Custom domain

The custom domain is configured in [`public/CNAME`](public/CNAME) (`shoveldove.com`). Vite copies
`public/` into `dist/`, so the `CNAME` file is published automatically. Point the domain's DNS at
GitHub Pages and enable the custom domain in **Settings → Pages**.

### Client-side routing

The build copies `index.html` to `404.html` so that deep links (e.g.
`/cm-tools/equipment-overview`) resolve correctly on GitHub Pages.

## Updating equipment data

The static data files in `public/equipment_data/` are point-in-time exports:

- `equipment_categories.json`
- `all_standard.json`
- `all_misc.json`
- `all_photos.json`
- `date_info.json`

Photos live in `public/equipment_photos/`. To refresh, regenerate these files and replace them,
then rebuild and redeploy.
