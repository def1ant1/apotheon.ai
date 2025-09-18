# Apotheon.ai Web Platform

Apotheon.ai is an enterprise-ready analytics and operations cockpit that centralizes observability, customer insights, and workflow automation for AI-first organizations. The project packages a React + Vite single-page application backed by cloud-first integrations (AWS Amplify, Auth0, Firebase) to deliver a production-caliber starting point for building the Apotheon.ai experience.

The repository ships with a modular component system, end-to-end localization, role-based navigation, and extensive charting/reporting utilities. Use it as the foundation for executive dashboards, customer-facing portals, or internal control planes that need to scale with Apotheon.ai's AI services.

## Platform Highlights

- **AI-native dashboarding** – Prebuilt analytic tiles, KPI cards, and data grid views designed around Apotheon.ai's product telemetry and customer data lifecycle.
- **Secure authentication options** – Pluggable Auth0 single sign-on (SSO) and Firebase authentication contexts for rapid enterprise identity integration.
- **Cloud extensibility** – AWS Amplify configuration, REST-friendly API client utilities (Axios), and modular service hooks to connect to Apotheon.ai backends.
- **Enterprise UX framework** – Material UI (MUI) theming, responsive layout primitives, drag-and-drop interactions, and RTL support enable cohesive, accessible experiences.
- **Localization & internationalization** – `react-i18next` configuration ships with lazy-loaded namespaces so Apotheon.ai can localize content without code rewrites.
- **Automation-first development** – TypeScript, ESLint, and Prettier enforce consistent, maintainable code; Vite delivers fast builds and previews.

## Repository Structure

```
├─ src/
│  ├─ components/         # Reusable UI primitives (cards, forms, charts, tables)
│  ├─ contexts/           # Auth0, Firebase, Amplify, and settings providers
│  ├─ layouts/            # Dashboard shell, navigation, and responsive layouts
│  ├─ pages/              # Route-level screens (analytics, commerce, CRM, etc.)
│  ├─ page-sections/      # Hero/marketing sections for site landing experiences
│  ├─ theme/              # MUI theme overrides, typography, palette definitions
│  ├─ utils/              # Helper utilities (formatters, API helpers, mocks)
│  ├─ i18n/               # Translation resources and i18next setup
│  ├─ __fakeData__/       # Mock data used by demos and skeleton states
│  └─ main.tsx/App.tsx    # Application bootstrap and router configuration
├─ public/                # Static assets served by Vite
├─ amplify/               # AWS Amplify backend configuration stubs
├─ vercel.json            # Production hosting defaults for Vercel
└─ package.json           # Tooling, scripts, dependencies
```

> **Note:** This repository rebrands the original "Uko Admin" starter into the Apotheon.ai design system. UI text, theme tokens, and imagery should be updated incrementally to reflect Apotheon.ai's visual identity and messaging.

## Getting Started

1. **Install prerequisites**
   - Node.js ≥ 18.x (LTS recommended)
   - npm ≥ 9.x

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   The Vite dev server will print a local URL (default `http://localhost:5173`). Hot module reloading keeps the UI in sync while you iterate on Apotheon.ai features.

4. **Run quality checks**

   ```bash
   npm run lint      # ESLint with TypeScript + React hooks rules
   npm run build     # Type-check + bundle to validate production readiness
   ```

5. **Preview production build**

   ```bash
   npm run preview
   ```

## Environment Configuration

Create a `.env.local` (ignored by Git) to configure secrets for identity providers and analytics services. Common keys include:

```bash
VITE_APP_AUTH0_DOMAIN="your-auth0-domain"
VITE_APP_AUTH0_CLIENT_ID="your-auth0-client-id"

VITE_FIREBASE_APT_KEY="your-firebase-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-firebase-auth-domain"
VITE_FIREBASE_PROJECT_ID="your-firebase-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-firebase-storage-bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-firebase-messaging-sender-id"
VITE_FIREBASE_ID="your-firebase-app-id"
VITE_FIREBASE_MEASUREMENT_ID="your-firebase-measurement-id"
```

Restart the dev server after editing environment variables so Vite picks up the new values.

## Deployment

- **Vercel (default)** – `vercel.json` configures the SPA fallback for effortless hosting. Connect your Git repository, add environment variables, and deploy directly from the `main` branch.
- **AWS Amplify** – The `amplify/` directory contains starter configuration for provisioning backend resources (authentication, storage, APIs). Use the Amplify CLI or console to extend Apotheon.ai with managed cloud services.
- **Custom infrastructure** – Because the project builds to static assets in `dist/`, it can be served via any CDN (S3 + CloudFront, Azure Static Web Apps, etc.).

## Customization Roadmap

- **Branding** – Update theme palettes, typography, and assets under `src/theme/` and `public/` to reflect Apotheon.ai's identity (logos, gradients, iconography).
- **Modules** – Expand `src/pages/` and `src/routes/` with Apotheon.ai-specific flows (model management, observability, billing, etc.).
- **Data integrations** – Replace `__fakeData__` mocks with live API calls using the Axios helpers inside `src/utils/`. Centralize service endpoints to minimize repetitive wiring.
- **Automation** – Integrate CI pipelines (GitHub Actions, Vercel checks) that run `npm run lint` and `npm run build` on every pull request to maintain enterprise quality.

## Contributing

1. Fork the repository or create a feature branch.
2. Keep code self-documenting with TypeScript types, JSDoc annotations, and inline comments where complex logic exists.
3. Run linting and build commands before opening a pull request.
4. Provide screenshots or Loom walkthroughs for any significant UI updates to accelerate Apotheon.ai stakeholder review.

## Support

For roadmap discussions, bug reports, or feature requests, open a GitHub issue with reproduction details and environment information. Internal Apotheon.ai teams should tag the owning squad in Slack and link to the issue for visibility.

---

Apotheon.ai is committed to building scalable, automated platforms that help enterprises operationalize AI. Use this repository as your launchpad for delivering the Apotheon.ai web experience.
