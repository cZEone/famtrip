// A tiny stand-in for the Supabase client, so API tests run without a network
// or database. It records every call in the chain and resolves to whatever
// result the test sets up.

export function fakeSupabase(result = { data: [], error: null }) {
  const state = { tokens: [], calls: [] };

  function getClient(token) {
    state.tokens.push(token);
    return {
      from(table) {
        const chain = [["from", table]];
        state.calls.push(chain);
        const builder = {
          then(resolve, reject) {
            return Promise.resolve(typeof result === "function" ? result(chain) : result).then(resolve, reject);
          },
        };
        for (const m of ["select", "insert", "update", "delete", "eq", "order", "single", "match"]) {
          builder[m] = (...args) => {
            chain.push([m, ...args]);
            return builder;
          };
        }
        return builder;
      },
    };
  }

  return { getClient, state };
}

/** Build a Request like Next.js would pass to a route handler. */
export function req(method, { token = "tok", body, rawBody } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined || rawBody !== undefined) headers["content-type"] = "application/json";
  return new Request("http://localhost/api/test", {
    method,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
}

/** Next 15 route context: params is a Promise. */
export const ctx = (id) => ({ params: Promise.resolve({ id: String(id) }) });
