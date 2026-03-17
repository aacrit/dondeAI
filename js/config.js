/* ============================================
   DondeAI — Shared Configuration
   Single source of truth for Supabase credentials
   and debug flags used across modules.
   ============================================ */

export const SUPABASE_URL = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co';
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc';

/** Debug mode: true on localhost, false in production. Guards console output. */
export const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
