import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIdea, parseId } from "../lib/api/validate.mjs";

const ok = { title: "Laksa", category: "Eat" };

test("accepts a minimal idea and trims the title", () => {
  assert.deepEqual(validateIdea({ title: "  Laksa  ", category: "Eat" }), { row: { title: "Laksa", category: "Eat" } });
});

test("rejects non-object bodies", () => {
  for (const b of [null, "x", 5, [1]]) assert.match(validateIdea(b).error, /JSON object/);
});

test("title is required and limited to 120 chars", () => {
  assert.match(validateIdea({ category: "Eat" }).error, /title is required/);
  assert.match(validateIdea({ title: "   ", category: "Eat" }).error, /title is required/);
  assert.match(validateIdea({ title: 42, category: "Eat" }).error, /title is required/);
  assert.match(validateIdea({ title: "x".repeat(121), category: "Eat" }).error, /at most 120/);
});

test("category must be Eat, Go or Do", () => {
  assert.match(validateIdea({ title: "x", category: "Shop" }).error, /category/);
  assert.match(validateIdea({ title: "x" }).error, /category/);
});

test("note: empty → null, non-string rejected, max 2000", () => {
  assert.equal(validateIdea({ ...ok, note: "   " }).row.note, null);
  assert.equal(validateIdea({ ...ok, note: null }).row.note, null);
  assert.equal(validateIdea({ ...ok, note: " hi " }).row.note, "hi");
  assert.match(validateIdea({ ...ok, note: 3 }).error, /note must be a string/);
  assert.match(validateIdea({ ...ok, note: "x".repeat(2001) }).error, /at most 2000/);
});

test("link must be http(s) and at most 2048 chars", () => {
  assert.equal(validateIdea({ ...ok, link: "https://maps.app/x" }).row.link, "https://maps.app/x");
  assert.equal(validateIdea({ ...ok, link: "" }).row.link, null);
  for (const bad of ["javascript:alert(1)", "ftp://x", "maps.app", "https://has space"]) {
    assert.match(validateIdea({ ...ok, link: bad }).error, /http/, bad);
  }
  assert.match(validateIdea({ ...ok, link: "https://" + "x".repeat(2050) }).error, /at most 2048/);
});

test("trip_day: whole number 1–60, or null", () => {
  assert.equal(validateIdea({ ...ok, trip_day: 3 }).row.trip_day, 3);
  assert.equal(validateIdea({ ...ok, trip_day: "" }).row.trip_day, null);
  assert.equal(validateIdea({ ...ok, trip_day: null }).row.trip_day, null);
  for (const bad of [0, 61, 2.5, "3"]) assert.match(validateIdea({ ...ok, trip_day: bad }).error, /trip_day/);
});

test("partial (PATCH) only checks provided fields and rejects empty updates", () => {
  assert.deepEqual(validateIdea({ note: "later" }, { partial: true }), { row: { note: "later" } });
  assert.match(validateIdea({}, { partial: true }).error, /Nothing to update/);
  assert.match(validateIdea({ title: "" }, { partial: true }).error, /title is required/);
});

test("parseId accepts only positive integers", () => {
  assert.equal(parseId("42"), 42);
  for (const bad of ["0", "-1", "1.5", "abc", "", undefined, "1; drop"]) assert.equal(parseId(bad), null, String(bad));
});
