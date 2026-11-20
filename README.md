# TaskFlow – Frontend (Jira-inspired project management)

React + Vite + TypeScript + Tailwind CSS frontend for the project-management app.
There is **no backend yet**: all data comes from a typed mock data layer that is
persisted to `localStorage`, behind an API-service layer that can later be swapped
for Django REST calls.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Script            | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run build`   | Type-check (`tsc -b`) and production build |
| `npm run lint`    | Lint with oxlint                           |
| `npm run preview` | Serve the production build                 |

## Demo login

Open the app and pick a user on the login screen (mock login). You can switch user
at any time from the avatar menu (top-right) – "Switch user (demo)". The same menu
has **Reset demo data** which restores the seed data.

| User          | Role                | Spaces          | Notes                                    |
| ------------- | ------------------- | --------------- | ---------------------------------------- |
| Akshay Kumar  | Admin               | all             | sees every module (Apps, Plans, Assets…) |
| Priya Sharma  | Project Manager     | CP, MOB         | can create spaces                        |
| Rahul Verma   | Project Coordinator | CP, MOB, INT    | can manage sprints                       |
| Neha Gupta    | Developer           | CP, INT         | limited sidebar, own worklogs only       |
| Arjun Patel   | Developer           | CP, MOB         |                                          |
| Sneha Iyer    | QA                  | CP, MOB         |                                          |

Role → module visibility lives in `src/lib/permissions.ts`.

## Project structure

```
src/
  types/          Domain types (User, Project, WorkItem, Sprint, Comment, WorkLog, …)
  data/seed.ts    Seed data (org, 6 users, 3 spaces, ~30 work items, sprints, comments, worklogs, history)
  store/          Zustand store (persisted to localStorage) + derived hooks + UI store
  services/       API service layer (api.ts) + http.ts client placeholder for Django REST
  lib/            Utilities, permissions, JQL parser/evaluator, default filters
  components/     App shell (Sidebar, TopBar, notifications), modals, shared UI
  pages/          For You, Recent, Starred, Spaces, Dashboards, Work item detail, placeholders
    project/      Space workspace: Summary, Timeline, Backlog, Board, Calendar, List
    filters/      Search / All work items (basic + JQL), filters list (saved & default)
```

## Connecting the Django backend later

All mutations from the UI go through `src/services/api.ts` (each function is annotated
with the REST endpoint it will map to). To switch to the real backend, set
`VITE_API_URL` (e.g. in `.env.local`) and re-implement those functions using the
`http` helper in `src/services/http.ts`, then hydrate the store from the API
responses (or replace the store reads with a data-fetching library such as React Query).

## JQL-like search

The advanced search supports e.g.

```
project = CP AND status = "In Progress" AND assignee = currentUser()
type in (Bug, Story) AND priority in (Highest, High) ORDER BY created DESC
statusCategory != Done AND due < startOfDay()
text ~ "login" OR labels = auth
created >= -7d
```

Fields: project, status, statusCategory, assignee, reporter, type, priority, labels,
sprint, team, key, parent, text/summary/description (`~`), created, updated, resolved, due.
Invalid queries show a validation error instead of results.
