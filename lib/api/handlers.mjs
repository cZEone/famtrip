// The API's logic, written as plain functions so it can be tested without a
// server or a real database. Each Next.js route file (app/api/**/route.js)
// just wires these up with a real Supabase client.
//
// `getClient(token)` returns a Supabase client that acts AS the logged-in user,
// so the database's row-level security still decides who may do what.

import { validateIdea, parseId } from "./validate.mjs";

const IDEA_SELECT = "*, author:profiles!ideas_author_id_fkey(display_name), votes(user_id)";

const json = (body, status = 200) => Response.json(body, { status });

/** Pull the user's access token out of "Authorization: Bearer <token>". */
export function bearerToken(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/** Turn a Postgres/PostgREST error into an HTTP response without leaking internals. */
export function dbError(error) {
  switch (error?.code) {
    case "23505": return json({ error: "Already exists" }, 409); // unique violation
    case "23503": return json({ error: "Idea not found" }, 404); // foreign key violation
    case "23514": return json({ error: "Invalid value" }, 400); // CHECK constraint
    case "42501": return json({ error: "Not allowed" }, 403); // RLS insert/update refusal
    case "PGRST301":
    case "PGRST303": return json({ error: "Session expired, please log in again" }, 401); // bad/expired JWT
    default: return json({ error: "Something went wrong" }, 500);
  }
}

async function readJson(request) {
  try {
    return { body: await request.json() };
  } catch {
    return { error: json({ error: "Body must be valid JSON" }, 400) };
  }
}

/**
 * Build all route handlers around a client factory.
 * @param {(token: string) => any} getClient
 */
export function createHandlers(getClient) {
  // Every handler starts here: no token → 401, otherwise a per-user client.
  function auth(request) {
    const token = bearerToken(request);
    if (!token) return { res: json({ error: "Not logged in" }, 401) };
    return { db: getClient(token) };
  }

  async function idFrom(ctx) {
    const params = await ctx?.params; // Next 15 passes params as a Promise
    return parseId(params?.id);
  }

  return {
    // GET /api/ideas
    async listIdeas(request) {
      const { db, res } = auth(request);
      if (res) return res;
      const { data, error } = await db.from("ideas").select(IDEA_SELECT).order("created_at", { ascending: false });
      return error ? dbError(error) : json(data);
    },

    // POST /api/ideas
    async createIdea(request) {
      const { db, res } = auth(request);
      if (res) return res;
      const parsed = await readJson(request);
      if (parsed.error) return parsed.error;
      const v = validateIdea(parsed.body);
      if (v.error) return json({ error: v.error }, 400);
      const { data, error } = await db.from("ideas").insert(v.row).select(IDEA_SELECT).single();
      return error ? dbError(error) : json(data, 201);
    },

    // PATCH /api/ideas/:id  (only the author — enforced by RLS)
    async updateIdea(request, ctx) {
      const { db, res } = auth(request);
      if (res) return res;
      const id = await idFrom(ctx);
      if (!id) return json({ error: "Invalid idea id" }, 400);
      const parsed = await readJson(request);
      if (parsed.error) return parsed.error;
      const v = validateIdea(parsed.body, { partial: true });
      if (v.error) return json({ error: v.error }, 400);
      const { data, error } = await db.from("ideas").update(v.row).eq("id", id).select(IDEA_SELECT);
      if (error) return dbError(error);
      // RLS silently filters rows you can't change, so "0 rows" means missing OR not yours.
      if (!data.length) return json({ error: "Idea not found, or you're not its author" }, 404);
      return json(data[0]);
    },

    // DELETE /api/ideas/:id  (only the author — enforced by RLS)
    async deleteIdea(request, ctx) {
      const { db, res } = auth(request);
      if (res) return res;
      const id = await idFrom(ctx);
      if (!id) return json({ error: "Invalid idea id" }, 400);
      const { data, error } = await db.from("ideas").delete().eq("id", id).select("id");
      if (error) return dbError(error);
      if (!data.length) return json({ error: "Idea not found, or you're not its author" }, 404);
      return new Response(null, { status: 204 });
    },

    // POST /api/ideas/:id/vote  → "I'm in"
    async addVote(request, ctx) {
      const { db, res } = auth(request);
      if (res) return res;
      const id = await idFrom(ctx);
      if (!id) return json({ error: "Invalid idea id" }, 400);
      const { error } = await db.from("votes").insert({ idea_id: id });
      if (error?.code === "23505") return json({ ok: true, alreadyVoted: true }); // idempotent
      return error ? dbError(error) : json({ ok: true }, 201);
    },

    // DELETE /api/ideas/:id/vote  → take back "I'm in" (RLS limits it to your own vote)
    async removeVote(request, ctx) {
      const { db, res } = auth(request);
      if (res) return res;
      const id = await idFrom(ctx);
      if (!id) return json({ error: "Invalid idea id" }, 400);
      const { error } = await db.from("votes").delete().eq("idea_id", id);
      return error ? dbError(error) : new Response(null, { status: 204 });
    },
  };
}
