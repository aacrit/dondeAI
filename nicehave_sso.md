# SSO Integration — Nice-to-Have (Future Reference)

## Providers & Cost

| Provider | Cost | Requirements |
|---|---|---|
| **Google** | Free | Google Cloud Console project + OAuth 2.0 credentials |
| **Apple** | Free (auth API), $99/yr (Apple Developer Program required) | Services ID registration |
| **Instagram** | Free, needs Meta app review (days-weeks) | Facebook/Meta Developer account, `instagram_basic` permission |
| **TikTok** | Free, hardest approval | TikTok Developer Portal, Login Kit, opaque review process |

**Recommended order:** Google + Apple first (covers ~90% of users), Instagram later, TikTok lowest priority.

## UI Changes

- **Header:** Add user avatar button (right of existing toggles). Logged out = "Sign In" pill. Logged in = circular avatar with dropdown (name, My Searches, Favorites, Sign Out).
- **Auth flow:** Bottom sheet modal (matches existing share sheet / theme picker pattern). 4 branded SSO buttons stacked. Dismisses on success, avatar appears. No page reload.
- **New features when logged in:** Save button on result cards, unlimited "My Searches" on Step 0 (replaces 3-item anonymous history), Favorites gallery in dropdown.

## Backend Changes Required

### New endpoints:
```
POST /auth/{google,apple,instagram}/callback  — Exchange OAuth code for session
POST /auth/logout
GET  /auth/me                                 — Current user profile
GET  /user/searches                           — Saved search history (paginated)
POST /user/searches                           — Save search + result
GET  /user/favorites
POST /user/favorites
DELETE /user/favorites/:id
```

### Database tables needed:
- **Users:** id, email, name, avatar_url, provider, created_at
- **Searches:** id, user_id, craving, occasion, neighborhood, price_level, result_json, created_at
- **Favorites:** id, user_id, restaurant_name, result_json, created_at

**Storage options:** Supabase (free tier: 50k MAU, Postgres, built-in auth), Firebase (free: 10k auth/month), or Postgres behind n8n.

### Existing endpoint change:
Add optional `Authorization: Bearer <token>` header to `POST /donde-recommend`. If present, auto-save search+result to user history.

**Session management:** HTTP-only cookies (XSS-safe, works with `fetch` via `credentials: 'include'`).

## Frontend Code Changes

| File | Changes |
|---|---|
| `js/state.js` | Add `user: null`, `isAuthenticated: false` |
| `js/persistence.js` | Add `dondeai-user` key (or rely on cookies) |
| `js/api.js` | Add `credentials: 'include'`, auth endpoint wrappers |
| New: `js/auth.js` | OAuth flow, callback handling, session management |
| `index.html` | Auth bottom sheet markup, header avatar, save buttons |
| `css/components.css` | Auth sheet, avatar, save button styles |
| `js/app.js` | Wire auth events, conditionally render save/favorites UI |

## Data Tracking Payload

```json
{
  "user_id": "...",
  "input": { "craving": "...", "occasion": "...", "neighborhood": "...", "price_level": "..." },
  "result": { /* full API response */ },
  "timestamp": "ISO-8601",
  "theme": "japanese",
  "source": "web"
}
```

Enables analytics: popular searches, neighborhood trends, price tier distribution, search-to-save conversion.
