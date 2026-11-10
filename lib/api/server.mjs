// Server-side wiring: real Supabase client per request, acting as the caller.
import { createClient } from "@supabase/supabase-js";
import { createHandlers } from "./handlers.mjs";

function clientForToken(token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const api = createHandlers(clientForToken);
