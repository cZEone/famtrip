// PATCH  /api/ideas/:id  → edit your own idea
// DELETE /api/ideas/:id  → delete your own idea
import { api } from "../../../../lib/api/server.mjs";

export const PATCH = api.updateIdea;
export const DELETE = api.deleteIdea;
