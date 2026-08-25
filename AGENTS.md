# Repository Guidelines

## Product Context & Working Approach

Darbak is a student platform for cooperative-training journeys: experiences, opportunities, the “وين أتدرب” directory, portfolios, and “سيرتي بدربك” resumes. Work as a senior product engineer with UX judgment: understand student needs before changing code.

Reuse components, logic, APIs, and real data first. Do not rebuild working business logic for UI polish or create parallel models, APIs, or systems without a clear need. Prefer the smallest complete solution. Flag UX or architecture conflicts and suggest an alternative before implementation.

Preserve Darbak’s visual identity. UI is primarily Arabic: account for RTL and mixed Arabic/English text. Mobile responsiveness is required. For medium/large tasks, inspect relevant files only, identify reuse, make a short plan, implement and test the affected area, then briefly report changes. Do not rescan when this guide and relevant files suffice.

## Project Structure

The React app is in `src/`: routes in `src/pages/`, reusable UI in `src/components/`, utilities/data in `src/utils/` and `src/data/`, and resume features in `src/features/resume/`. Static assets and browser metadata are in `public/`.

The Express API is in `backend/`: routes in `server.js`, Mongoose schemas in `models/`, business/integration code in `services/`, the resume agent in `agents/`, and Node assertion tests in `tests/`. Helpers live in `scripts/`; generated exports go in `exports/`.

## Build, Test, and Development Commands

- `npm install && npm start` — run the frontend at `http://localhost:3000`.
- `npm run build` — create the production bundle in `build/`.
- `npm test` — run the CRA/Jest frontend tests.
- `cd backend && npm install && npm start` — run the API on port `3001`.
- `cd backend && npm test` — run backend validation tests.

Run relevant checks before review.

## Style & Testing

Use 2-space indentation, semicolons, double quotes, and trailing commas consistent with nearby code. Use PascalCase components/pages (`ResumePreview.jsx`) and camelCase functions/hooks (`getStoredPremiumPass`). Keep route-specific UI in `pages/` and avoid unrelated refactors. CRA ESLint runs via `react-scripts`; resolve lint issues.

Frontend tests use Testing Library and Jest. Backend tests are `*.test.js` under `backend/tests/` and use Node `assert`. Cover changed validation, subscription, and agent behavior with accepted and rejected inputs.

## Configuration, Commits & PRs

Never commit credentials. Use environment variables: `MONGO_URI`, `OPENAI_API_KEY`, and optional frontend `REACT_APP_API_URL`; payment, email, and Telegram settings are secrets. Use short imperative commits, e.g. `Fix structured resume translation output`. PRs should state the user-facing change, validation run, linked issue, and screenshots for visual changes.
