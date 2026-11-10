// POST   /api/ideas/:id/vote  → "I'm in"
// DELETE /api/ideas/:id/vote  → take it back
import { api } from "../../../../../lib/api/server.mjs";

export const POST = api.addVote;
export const DELETE = api.removeVote;
