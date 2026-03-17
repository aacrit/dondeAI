/* ============================================
   DondeAI — Authentication Module (SSO)
   Supabase Auth: Google (Phase 1a), Apple (1b)
   Optional, non-blocking — app works fully anonymous.
   ============================================ */

import { getState, setState } from './state.js';
import {
  getOrCreateUserId, loadBookmarks, loadHistory, loadVisits,
  syncBookmarksToServer, syncHistoryToServer, syncVisitsToServer,
  loadBookmarksFromServer, loadHistoryFromServer, loadVisitsFromServer,
} from './persistence.js';
import { SUPABASE_URL, ANON_KEY as SUPABASE_ANON_KEY, DEBUG } from './config.js';

/* ---- Supabase Client ---- */

let supabaseClient = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (e) {
    console.error('[auth] Failed to load Supabase client:', e);
    return null;
  }
}

/* ---- Public API ---- */

export async function initAuth() {
  const sb = await getSupabase();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session) setUserFromSession(session);

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      setUserFromSession(session);
      await handleFirstSignIn(sb, session.user);
    } else if (event === 'SIGNED_OUT') {
      setState({ user: null, isAuthenticated: false });
    } else if (event === 'TOKEN_REFRESHED' && session) {
      setUserFromSession(session);
    }
  });
}

export async function signIn(provider) {
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) console.error('[auth] Sign-in error:', error.message);
}

export async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) console.error('[auth] Sign-out error:', error.message);
}

export function getUser() { return getState().user; }
export function isAuthenticated() { return getState().isAuthenticated; }

export async function getAccessToken() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

export async function getSupabaseClient() { return getSupabase(); }

/* ---- Server-side favorites ---- */

export async function addFavoriteToServer(restaurant) {
  const sb = await getSupabase();
  if (!sb || !isAuthenticated()) return;
  const user = getUser();
  sb.from('user_favorites').upsert({
    user_id: user.id, restaurant_id: restaurant.id, restaurant_name: restaurant.name,
    cuisine_type: restaurant.cuisine_type || null, neighborhood_name: restaurant.neighborhood_name || null,
    price_level: restaurant.price_level || null, google_place_id: restaurant.google_place_id || null,
  }, { onConflict: 'user_id,restaurant_id' })
    .then(() => {})
    .catch(e => DEBUG && console.error('[auth] Failed to save favorite:', e));
}

export async function removeFavoriteFromServer(restaurantId) {
  const sb = await getSupabase();
  if (!sb || !isAuthenticated()) return;
  const user = getUser();
  sb.from('user_favorites').delete()
    .eq('user_id', user.id).eq('restaurant_id', restaurantId)
    .then(() => {})
    .catch(e => DEBUG && console.error('[auth] Failed to remove favorite:', e));
}

/* ---- Server-side visits ---- */

export async function addVisitToServer(restaurant) {
  const sb = await getSupabase();
  if (!sb || !isAuthenticated()) return;
  const user = getUser();
  sb.from('user_visits').upsert({
    auth_user_id: user.id, restaurant_id: restaurant.id, restaurant_name: restaurant.name,
    cuisine_type: restaurant.cuisine_type || null, neighborhood_name: restaurant.neighborhood_name || null,
  }, { onConflict: 'auth_user_id,restaurant_id', ignoreDuplicates: true })
    .then(() => {})
    .catch(e => DEBUG && console.error('[auth] Failed to save visit:', e));
}

/* ---- Internal ---- */

function setUserFromSession(session) {
  const u = session.user;
  const meta = u.user_metadata || {};
  setState({
    user: { id: u.id, email: u.email, name: meta.full_name || meta.name || '', avatar_url: meta.avatar_url || meta.picture || '' },
    isAuthenticated: true,
  });
}

async function handleFirstSignIn(sb, user) {
  const { data: profile } = await sb.from('user_profiles').select('data_migrated_at').eq('id', user.id).single();
  if (profile?.data_migrated_at) { await loadServerDataIntoLocal(sb); return; }

  const anonymousId = getOrCreateUserId();
  const bookmarks = loadBookmarks();
  const history = loadHistory();
  const visits = loadVisits();

  if (bookmarks.length > 0) await syncBookmarksToServer(sb, user.id, bookmarks);
  if (history.length > 0) await syncHistoryToServer(sb, user.id, history);
  if (visits.length > 0) await syncVisitsToServer(sb, user.id, visits);

  if (anonymousId) {
    await sb.rpc('link_anonymous_queries', { p_auth_user_id: user.id, p_anonymous_id: anonymousId })
      .catch(e => DEBUG && console.error('[auth] Failed to link anonymous queries:', e));
    await sb.rpc('link_anonymous_visits', { p_auth_user_id: user.id, p_anonymous_id: anonymousId })
      .catch(e => DEBUG && console.error('[auth] Failed to link anonymous visits:', e));
  }

  await sb.from('user_profiles').update({ anonymous_user_id: anonymousId, data_migrated_at: new Date().toISOString() })
    .eq('id', user.id)
    .catch(e => DEBUG && console.error('[auth] Failed to mark migration:', e));
}

async function loadServerDataIntoLocal(sb) {
  try {
    const [serverBookmarks, serverHistory] = await Promise.all([
      loadBookmarksFromServer(sb), loadHistoryFromServer(sb),
    ]);
    if (serverBookmarks.length > 0 || serverHistory.length > 0) {
      const patch = {};
      if (serverHistory.length > 0) patch.history = serverHistory;
      if (Object.keys(patch).length > 0) setState(patch);
    }
  } catch (e) {
    DEBUG && console.error('[auth] Failed to load server data:', e);
  }
}
