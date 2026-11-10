import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHandlers, bearerToken, dbError } from "../lib/api/handlers.mjs";
import { fakeSupabase, req, ctx } from "./fakeSupabase.mjs";

const setup = (result) => {
  const fake = fakeSupabase(result);
  return { api: createHandlers(fake.getClient), state: fake.state };
};
const body = (res) => res.json();

describe("auth", () => {
  test("bearerToken parses the header", () => {
    assert.equal(bearerToken(req("GET", { token: "abc" })), "abc");
    assert.equal(bearerToken(req("GET", { token: null })), null);
    assert.equal(
      bearerToken(new Request("http://x", { headers: { authorization: "Basic abc" } })),
      null
    );
  });

  test("every route returns 401 without a token and never touches the database", async () => {
    const { api, state } = setup();
    const calls = [
      api.listIdeas(req("GET", { token: null })),
      api.createIdea(req("POST", { token: null, body: {} })),
      api.updateIdea(req("PATCH", { token: null, body: {} }), ctx(1)),
      api.deleteIdea(req("DELETE", { token: null }), ctx(1)),
      api.addVote(req("POST", { token: null }), ctx(1)),
      api.removeVote(req("DELETE", { token: null }), ctx(1)),
    ];
    for (const res of await Promise.all(calls)) assert.equal(res.status, 401);
    assert.equal(state.calls.length, 0);
  });

  test("the user's token is passed to the database client (so RLS applies)", async () => {
    const { api, state } = setup();
    await api.listIdeas(req("GET", { token: "user-jwt" }));
    assert.deepEqual(state.tokens, ["user-jwt"]);
  });
});

describe("GET /api/ideas", () => {
  test("returns ideas newest first", async () => {
    const ideas = [{ id: 1, title: "Laksa" }];
    const { api, state } = setup({ data: ideas, error: null });
    const res = await api.listIdeas(req("GET"));
    assert.equal(res.status, 200);
    assert.deepEqual(await body(res), ideas);
    const chain = state.calls[0];
    assert.deepEqual(chain[0], ["from", "ideas"]);
    assert.deepEqual(chain[2], ["order", "created_at", { ascending: false }]);
  });

  test("database errors become a generic 500 (no internals leaked)", async () => {
    const { api } = setup({ data: null, error: { code: "XX000", message: "secret internals" } });
    const res = await api.listIdeas(req("GET"));
    assert.equal(res.status, 500);
    assert.deepEqual(await body(res), { error: "Something went wrong" });
  });
});

describe("POST /api/ideas", () => {
  test("creates a validated idea → 201", async () => {
    const created = { id: 7, title: "Night market", category: "Go" };
    const { api, state } = setup({ data: created, error: null });
    const res = await api.createIdea(req("POST", { body: { title: " Night market ", category: "Go", link: "" } }));
    assert.equal(res.status, 201);
    assert.deepEqual(await body(res), created);
    assert.deepEqual(state.calls[0][1], ["insert", { title: "Night market", category: "Go", link: null }]);
  });

  test("invalid JSON → 400", async () => {
    const { api } = setup();
    const res = await api.createIdea(req("POST", { rawBody: "{nope" }));
    assert.equal(res.status, 400);
    assert.match((await body(res)).error, /valid JSON/);
  });

  test("invalid idea → 400 and nothing is inserted", async () => {
    const { api, state } = setup();
    const res = await api.createIdea(req("POST", { body: { title: "x", category: "Eat", link: "javascript:alert(1)" } }));
    assert.equal(res.status, 400);
    assert.equal(state.calls.length, 0);
  });

  test("a CHECK-constraint error from the database → 400", async () => {
    const { api } = setup({ data: null, error: { code: "23514" } });
    const res = await api.createIdea(req("POST", { body: { title: "x", category: "Eat" } }));
    assert.equal(res.status, 400);
  });
});

describe("PATCH /api/ideas/:id", () => {
  test("updates your own idea → 200", async () => {
    const { api, state } = setup({ data: [{ id: 3, note: "updated" }], error: null });
    const res = await api.updateIdea(req("PATCH", { body: { note: "updated" } }), ctx(3));
    assert.equal(res.status, 200);
    assert.deepEqual(await body(res), { id: 3, note: "updated" });
    assert.deepEqual(state.calls[0][1], ["update", { note: "updated" }]);
    assert.deepEqual(state.calls[0][2], ["eq", "id", 3]);
  });

  test("someone else's (or missing) idea → 404, because RLS returns 0 rows", async () => {
    const { api } = setup({ data: [], error: null });
    const res = await api.updateIdea(req("PATCH", { body: { note: "hack" } }), ctx(3));
    assert.equal(res.status, 404);
  });

  test("bad id, bad JSON, empty update → 400", async () => {
    const { api } = setup();
    assert.equal((await api.updateIdea(req("PATCH", { body: { note: "x" } }), ctx("abc"))).status, 400);
    assert.equal((await api.updateIdea(req("PATCH", { rawBody: "{" }), ctx(1))).status, 400);
    assert.equal((await api.updateIdea(req("PATCH", { body: {} }), ctx(1))).status, 400);
  });

  test("database error is mapped", async () => {
    const { api } = setup({ data: null, error: { code: "42501" } });
    assert.equal((await api.updateIdea(req("PATCH", { body: { note: "x" } }), ctx(1))).status, 403);
  });
});

describe("DELETE /api/ideas/:id", () => {
  test("deletes your own idea → 204", async () => {
    const { api } = setup({ data: [{ id: 3 }], error: null });
    const res = await api.deleteIdea(req("DELETE"), ctx(3));
    assert.equal(res.status, 204);
  });

  test("someone else's idea → 404", async () => {
    const { api } = setup({ data: [], error: null });
    assert.equal((await api.deleteIdea(req("DELETE"), ctx(3))).status, 404);
  });

  test("bad id → 400; database error → mapped", async () => {
    assert.equal((await setup().api.deleteIdea(req("DELETE"), ctx("0"))).status, 400);
    const { api } = setup({ data: null, error: { code: "PGRST301" } });
    assert.equal((await api.deleteIdea(req("DELETE"), ctx(3))).status, 401);
  });
});

describe("POST/DELETE /api/ideas/:id/vote", () => {
  test("vote → 201", async () => {
    const { api, state } = setup({ data: null, error: null });
    const res = await api.addVote(req("POST"), ctx(5));
    assert.equal(res.status, 201);
    assert.deepEqual(state.calls[0], [["from", "votes"], ["insert", { idea_id: 5 }]]);
  });

  test("voting twice is harmless (idempotent) → 200", async () => {
    const { api } = setup({ data: null, error: { code: "23505" } });
    const res = await api.addVote(req("POST"), ctx(5));
    assert.equal(res.status, 200);
    assert.deepEqual(await body(res), { ok: true, alreadyVoted: true });
  });

  test("voting on a missing idea → 404", async () => {
    const { api } = setup({ data: null, error: { code: "23503" } });
    assert.equal((await api.addVote(req("POST"), ctx(999))).status, 404);
  });

  test("unvote → 204, scoped to the idea (RLS limits it to your own vote)", async () => {
    const { api, state } = setup({ data: null, error: null });
    const res = await api.removeVote(req("DELETE"), ctx(5));
    assert.equal(res.status, 204);
    assert.deepEqual(state.calls[0], [["from", "votes"], ["delete"], ["eq", "idea_id", 5]]);
  });

  test("bad id → 400 for both; unvote database error → mapped", async () => {
    const { api } = setup();
    assert.equal((await api.addVote(req("POST"), ctx("x"))).status, 400);
    assert.equal((await api.removeVote(req("DELETE"), ctx("x"))).status, 400);
    const failing = setup({ data: null, error: { code: "boom" } });
    assert.equal((await failing.api.removeVote(req("DELETE"), ctx(5))).status, 500);
  });
});

test("dbError maps every known code", async () => {
  const cases = { 23505: 409, 23503: 404, 23514: 400, 42501: 403, PGRST301: 401, PGRST303: 401, other: 500 };
  for (const [code, status] of Object.entries(cases)) assert.equal(dbError({ code }).status, status, code);
  assert.equal(dbError(undefined).status, 500);
});
