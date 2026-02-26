# SSO Integration — Implementation Status

> **Status**: Phase 1a implemented (Google SSO). Apple pending developer enrollment.

## Architecture Decision: Supabase Auth Native

Uses Supabase Auth exclusively — handles OAuth flows, JWT sessions, and provider management at zero additional cost (50k MAU free tier). No third-party auth service needed.

## Providers & Cost

| Provider | Cost | Status |
|---|---|---|
| **Google** | Free (Supabase Auth) | **Implemented** — Phase 1a |
| **Apple** | Free + $99/yr dev program | **Pending** — awaiting Apple Developer enrollment |
| **Facebook/Instagram** | Free + Meta review | Phase 2 — demand-driven |

## What's Implemented

### Database (6 migrations in `dondeBackend/supabase/migrations/`)
- `user_profiles` — extends `auth.users` with display_name, avatar, preferences, migration tracking
- `user_searches` — unlimited server-side search history (replaces 3-item localStorage cap)
- `user_favorites` — unlimited server-side bookmarks (replaces 20-item localStorage cap)
- `user_queries.auth_user_id` — links anonymous query logs to authenticated accounts
- Auto-create profile trigger on `auth.users` INSERT
- `link_anonymous_queries` RPC for data migration

All tables have RLS policies restricting access to own data.

### Frontend
- `js/auth.js` — Supabase client, OAuth flows, session management, data migration
- `js/state.js` — Added `user` and `isAuthenticated` (persist across search resets)
- `js/api.js` — Sends user JWT when authenticated, falls back to anon key
- `js/persistence.js` — Server sync functions for bookmarks and history
- `js/app.js` — Auth events wired, bookmark dual-write, auth UI updates
- `index.html` — Auth button in header, auth bottom sheet, user menu dropdown
- `css/components.css` — Auth sheet, avatar, user menu, provider button styles

### Backend
- Edge Function detects user JWTs and extracts `authUserId`
- Auto-saves searches to `user_searches` for authenticated users
- Enhanced feedback queries (50 entries for auth users vs 20 for anonymous)
- `_shared/supabase.ts` — Added `createServiceClient()` for JWT verification

### Data Migration Flow
On first sign-in: localStorage bookmarks, history, and anonymous query logs are migrated to the server. On subsequent sign-ins (including new devices): server data is loaded into localStorage for offline access.

## Remaining Setup (Manual)

1. **Supabase Dashboard**: Enable Google provider, add OAuth credentials
2. **Google Cloud Console**: Create OAuth 2.0 credentials, set redirect URL
3. **Apple** (when enrolled): Enable Apple provider in Supabase Dashboard
4. **Environment**: Add `SUPAB_SERVICE_ROLE_KEY` to Edge Function secrets

## Phase 2 (Future)
- Facebook provider (if analytics show demand)
- Soft sign-in prompts at natural friction points
- "Download My Data" export
- Manual account linking
- Search history browsing in user menu
