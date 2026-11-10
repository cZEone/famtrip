// GET  /api/ideas  → list all ideas (with author name and votes)
// POST /api/ideas  → create an idea
import { api } from "../../../lib/api/server.mjs";

export const GET = api.listIdeas;
export const POST = api.createIdea;
