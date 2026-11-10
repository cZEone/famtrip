import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../lib/api/server.mjs";
import * as ideas from "../app/api/ideas/route.js";
import * as idea from "../app/api/ideas/[id]/route.js";
import * as vote from "../app/api/ideas/[id]/vote/route.js";

test("each route file maps HTTP methods to the right API handler", () => {
  assert.equal(ideas.GET, api.listIdeas);
  assert.equal(ideas.POST, api.createIdea);
  assert.equal(idea.PATCH, api.updateIdea);
  assert.equal(idea.DELETE, api.deleteIdea);
  assert.equal(vote.POST, api.addVote);
  assert.equal(vote.DELETE, api.removeVote);
});

test("route files export only the methods they support", () => {
  assert.deepEqual(Object.keys(ideas).sort(), ["GET", "POST"]);
  assert.deepEqual(Object.keys(idea).sort(), ["DELETE", "PATCH"]);
  assert.deepEqual(Object.keys(vote).sort(), ["DELETE", "POST"]);
});
