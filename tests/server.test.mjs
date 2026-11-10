import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { makeApi, MISSING_SETTINGS_ERROR } from "../lib/api/server.mjs";
import { req, ctx } from "./fakeSupabase.mjs";

const realFetch = globalThis.fetch;
const realConsoleError = console.error;
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realConsoleError;
});

describe("makeApi without Supabase settings", () => {
  test("every route returns a clear 500 JSON error instead of crashing", async () => {
    const logged = [];
    console.error = (...args) => logged.push(args.join(" "));
    for (const settings of [{}, { url: "https://x.supabase.co" }, { key: "k" }, undefined]) {
      const api = makeApi(settings);
      const responses = await Promise.all([
        api.listIdeas(req("GET")),
        api.createIdea(req("POST", { body: { title: "x", category: "Eat" } })),
        api.updateIdea(req("PATCH", { body: { note: "x" } }), ctx(1)),
        api.deleteIdea(req("DELETE"), ctx(1)),
        api.addVote(req("POST"), ctx(1)),
        api.removeVote(req("DELETE"), ctx(1)),
      ]);
      for (const res of responses) {
        assert.equal(res.status, 500);
        assert.deepEqual(await res.json(), { error: MISSING_SETTINGS_ERROR });
      }
    }
    // Logged once per misconfigured API, not once per request.
    assert.equal(logged.length, 4);
    assert.match(logged[0], /NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("makeApi with Supabase settings", () => {
  const settings = { url: "https://example.supabase.co", key: "publishable-key" };

  test("no token → 401 without any network call", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("should not be called");
    };
    const res = await makeApi(settings).listIdeas(req("GET", { token: null }));
    assert.equal(res.status, 401);
    assert.equal(calls, 0);
  });

  test("with a token → queries Supabase as that user and returns the data", async () => {
    const seen = [];
    globalThis.fetch = async (url, init = {}) => {
      seen.push({ url: String(url), headers: new Headers(init.headers) });
      return new Response(JSON.stringify([{ id: 1, title: "Laksa" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const res = await makeApi(settings).listIdeas(req("GET", { token: "user-jwt" }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ id: 1, title: "Laksa" }]);
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /^https:\/\/example\.supabase\.co\/rest\/v1\/ideas\?/);
    assert.equal(seen[0].headers.get("authorization"), "Bearer user-jwt");
    assert.equal(seen[0].headers.get("apikey"), "publishable-key");
  });
});
