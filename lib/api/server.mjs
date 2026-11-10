// Server-side wiring: real Supabase client per request, acting as the caller.
import { createClient } from "@supabase/supabase-js";
import { createHandlers } from "./handlers.mjs";

export const MISSING_SETTINGS_ERROR =
  "Server is missing its Supabase settings (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_KEY)";

const HANDLER_NAMES = ["listIdeas", "createIdea", "updateIdea", "deleteIdea", "addVote", "removeVote"];

/**
 * Build the API for a Supabase project.
 * If the URL or key is missing (e.g. env vars not set on a new deployment), every
 * route answers with a clear 500 JSON error instead of crashing the request.
 */
export function makeApi({ url, key } = {}) {
  if (!url || !key) {
    let logged = false;
    const misconfigured = async () => {
      if (!logged) {
        console.error(MISSING_SETTINGS_ERROR);
        logged = true;
      }
      return Response.json({ error: MISSING_SETTINGS_ERROR }, { status: 500 });
    };
    return Object.fromEntries(HANDLER_NAMES.map((name) => [name, misconfigured]));
  }

  return createHandlers((token) =>
    createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
  );
}

// Literal process.env.NEXT_PUBLIC_* access so Next.js can inline the values at build time.
export const api = makeApi({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_KEY,
});
