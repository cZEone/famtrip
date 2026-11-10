"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, TRIP_NAME } from "../lib/supabase";

export default function Home() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <main><p className="muted">Loading…</p></main>;
  return session ? <Board user={session.user} /> : <Auth />;
}

/* ---------- Login / sign up ---------- */
function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    const { email, password, name, code } = form;
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name — it's what the family sees on your ideas.");
      return;
    }
    setBusy(true);
    const res =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name.trim(), invite_code: code.trim().toUpperCase() } },
          });
    setBusy(false);
    if (res.error) {
      const msg = res.error.message;
      setError(/database error/i.test(msg) ? "Couldn't join: check the invite code with the trip organiser (or the trip may already have 10 members)." : msg);
    }
  }

  return (
    <main>
      <h1>🧳 {TRIP_NAME}</h1>
      <p className="muted">Our shared board of places to eat, go and do. Family members only.</p>
      <form className="card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Log in</button>
          <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Join the trip</button>
        </div>
        {mode === "signup" && (
          <>
            <label>Your name</label>
            <input required maxLength={40} value={form.name} onChange={set("name")} placeholder="e.g. Auntie May" />
            <label>Invite code (ask the trip organiser)</label>
            <input required value={form.code} onChange={set("code")} />
          </>
        )}
        <label>Email</label>
        <input required type="email" value={form.email} onChange={set("email")} />
        <label>Password</label>
        <input required type="password" minLength={6} value={form.password} onChange={set("password")} />
        {error && <p className="error">{error}</p>}
        <p><button className="primary" disabled={busy}>{busy ? "…" : mode === "login" ? "Log in" : "Join"}</button></p>
      </form>
    </main>
  );
}

/* ---------- The board ---------- */
const CATS = ["All", "Eat", "Go", "Do"];

// Only http(s) links are shown; display the hostname so people can see where a link goes.
function safeHost(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : null;
  } catch {
    return null;
  }
}
const EMPTY = { title: "", category: "Eat", note: "", link: "", trip_day: "" };

// Call our own API routes (app/api/...) with the logged-in user's token.
// Returns { data, error } like supabase-js does, so the UI code stays simple.
async function api(path, { method = "GET", body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  return res.ok ? { data: payload, error: null } : { data: null, error: { message: payload?.error ?? `HTTP ${res.status}` } };
}

function Board({ user }) {
  const [ideas, setIdeas] = useState([]);
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("votes");
  const [editing, setEditing] = useState(null); // null | "new" | idea id
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await api("/ideas");
    if (error) setError(error.message);
    else setIdeas(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleVote(idea) {
    const mine = idea.votes.some((v) => v.user_id === user.id);
    const { error } = mine
      ? await api(`/ideas/${idea.id}/vote`, { method: "DELETE" })
      : await api(`/ideas/${idea.id}/vote`, { method: "POST" });
    if (error) setError(error.message);
    load();
  }

  async function leaveTrip() {
    if (!confirm("Leave the trip? This permanently deletes your account, all your ideas and your votes.")) return;
    const { error } = await supabase.rpc("leave_trip");
    if (error) return setError(error.message);
    await supabase.auth.signOut();
  }

  async function remove(idea) {
    if (!confirm(`Delete "${idea.title}"?`)) return;
    const { error } = await api(`/ideas/${idea.id}`, { method: "DELETE" });
    if (error) setError(error.message);
    load();
  }

  let shown = ideas.filter((i) => filter === "All" || i.category === filter);
  shown = [...shown].sort((a, b) =>
    sort === "votes"
      ? b.votes.length - a.votes.length || new Date(b.created_at) - new Date(a.created_at)
      : sort === "day"
      ? (a.trip_day ?? 999) - (b.trip_day ?? 999)
      : new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <main>
      <div className="top">
        <h1>🧳 {TRIP_NAME}</h1>
        <span style={{ flex: "none" }}>
          <button className="link" onClick={() => supabase.auth.signOut()}>Log out</button>
          <button className="link danger" onClick={leaveTrip}>Leave trip</button>
        </span>
      </div>
      <p className="muted">Add ideas, tap “I’m in” on the ones you want. Most-wanted rises to the top.</p>

      {editing === "new" ? (
        <IdeaForm onDone={() => { setEditing(null); load(); }} />
      ) : (
        <button className="primary" onClick={() => setEditing("new")}>+ Add an idea</button>
      )}

      <div className="tabs">
        {CATS.map((c) => (
          <button key={c} className={filter === c ? "on" : ""} onClick={() => setFilter(c)}>{c}</button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: "auto" }}>
          <option value="votes">Most wanted</option>
          <option value="day">By trip day</option>
          <option value="new">Newest</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {shown.length === 0 && <p className="muted">No ideas yet — add the first one!</p>}

      {shown.map((idea) => {
        const mine = idea.author_id === user.id;
        const voted = idea.votes.some((v) => v.user_id === user.id);
        if (editing === idea.id)
          return <IdeaForm key={idea.id} idea={idea} onDone={() => { setEditing(null); load(); }} />;
        return (
          <article key={idea.id} className="card idea">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ flex: "none" }}>
                <span className={`tag ${idea.category}`}>{idea.category}</span>
                {idea.trip_day && <span className="muted"> · Day {idea.trip_day}</span>}
              </span>
              <button style={{ flex: "none" }} className={`vote ${voted ? "on" : ""}`} onClick={() => toggleVote(idea)}>
                {voted ? "✓ I’m in" : "I’m in"} · {idea.votes.length}
              </button>
            </div>
            <h3>{idea.title}</h3>
            {idea.note && <p>{idea.note}</p>}
            {safeHost(idea.link) && (
              <p>
                <a href={idea.link} target="_blank" rel="noopener noreferrer" title={idea.link}>
                  🔗 {safeHost(idea.link)}
                </a>
              </p>
            )}
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">by {idea.author?.display_name ?? "someone"}</span>
              {mine && (
                <span style={{ flex: "none" }}>
                  <button className="link" onClick={() => setEditing(idea.id)}>Edit</button>
                  <button className="link danger" onClick={() => remove(idea)}>Delete</button>
                </span>
              )}
            </div>
          </article>
        );
      })}
    </main>
  );
}

function IdeaForm({ idea, onDone }) {
  const [f, setF] = useState(idea ? { ...EMPTY, ...idea, trip_day: idea.trip_day ?? "", note: idea.note ?? "", link: idea.link ?? "" } : EMPTY);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const row = {
      title: f.title.trim(),
      category: f.category,
      note: f.note.trim() || null,
      link: f.link.trim() || null,
      trip_day: f.trip_day === "" ? null : Number(f.trip_day),
    };
    const { error } = idea
      ? await api(`/ideas/${idea.id}`, { method: "PATCH", body: row })
      : await api("/ideas", { method: "POST", body: row });
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <form className="card" onSubmit={save}>
      <label>What’s the idea?</label>
      <input required maxLength={120} value={f.title} onChange={set("title")} placeholder="e.g. Char kway teow at Lorong Selamat" />
      <div className="row">
        <div>
          <label>Type</label>
          <select value={f.category} onChange={set("category")}>
            <option>Eat</option><option>Go</option><option>Do</option>
          </select>
        </div>
        <div>
          <label>Trip day (optional)</label>
          <input type="number" min={1} max={60} value={f.trip_day} onChange={set("trip_day")} />
        </div>
      </div>
      <label>Note (optional)</label>
      <textarea maxLength={2000} value={f.note} onChange={set("note")} placeholder="Why go? Opening hours? Must-order?" />
      <label>Link (optional — Maps, TikTok, blog)</label>
      <input type="url" maxLength={2048} pattern="https?://.+" title="Must start with http:// or https://" value={f.link} onChange={set("link")} placeholder="https://" />
      {error && <p className="error">{error}</p>}
      <p className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" style={{ flex: "none" }} onClick={onDone}>Cancel</button>
        <button className="primary" style={{ flex: "none" }}>{idea ? "Save" : "Post idea"}</button>
      </p>
    </form>
  );
}
