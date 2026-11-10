// Input validation for ideas. Mirrors the database CHECK constraints so the API
// can return a clear 400 before ever touching the database.

export const CATEGORIES = ["Eat", "Go", "Do"];

const LIMITS = { title: 120, note: 2000, link: 2048 };

/**
 * Validate an idea payload.
 * @param {unknown} body  parsed JSON from the request
 * @param {{ partial?: boolean }} opts  partial=true for PATCH (only provided fields are checked)
 * @returns {{ row: object } | { error: string }}
 */
export function validateIdea(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Body must be a JSON object" };
  }

  const row = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  // title (required on create)
  if (has("title") || !partial) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return { error: "title is required" };
    if (title.length > LIMITS.title) return { error: `title must be at most ${LIMITS.title} characters` };
    row.title = title;
  }

  // category (required on create)
  if (has("category") || !partial) {
    if (!CATEGORIES.includes(body.category)) return { error: `category must be one of ${CATEGORIES.join(", ")}` };
    row.category = body.category;
  }

  // note (optional; empty string → null)
  if (has("note")) {
    const r = optionalString(body.note, "note", LIMITS.note);
    if (r.error) return r;
    row.note = r.value;
  }

  // link (optional; must be http/https)
  if (has("link")) {
    const r = optionalString(body.link, "link", LIMITS.link);
    if (r.error) return r;
    if (r.value !== null && !/^https?:\/\/\S+$/i.test(r.value)) {
      return { error: "link must start with http:// or https://" };
    }
    row.link = r.value;
  }

  // trip_day (optional integer 1–60; "" / null → null)
  if (has("trip_day")) {
    const d = body.trip_day;
    if (d === null || d === "") row.trip_day = null;
    else if (Number.isInteger(d) && d >= 1 && d <= 60) row.trip_day = d;
    else return { error: "trip_day must be a whole number from 1 to 60" };
  }

  if (partial && Object.keys(row).length === 0) return { error: "Nothing to update" };
  return { row };
}

function optionalString(value, name, max) {
  if (value === null || value === undefined) return { value: null };
  if (typeof value !== "string") return { error: `${name} must be a string` };
  const v = value.trim();
  if (!v) return { value: null };
  if (v.length > max) return { error: `${name} must be at most ${max} characters` };
  return { value: v };
}

/** Parse a route id like "42" → 42, or null if it isn't a positive integer. */
export function parseId(raw) {
  return /^[1-9]\d*$/.test(String(raw)) ? Number(raw) : null;
}
