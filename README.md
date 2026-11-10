# 🧳 Family Trip 2026: Ideas Board

A small Reddit/Pinterest-style board for **one family holiday**. Up to 10 relatives post ideas for places to **eat, go and do**, then tap **"I'm in"** on the ones they want. The most-wanted ideas rise to the top.

▶️ **[Watch the 45-second demo](docs/famtrip-demo.webm)**: logging in, posting ideas, voting, filtering, editing, and a second member who can vote but can't edit someone else's idea.

## Product thinking

| | |
|---|---|
| **Audience** | Up to 10 family members (2–3 households) on one trip |
| **Problem** | Ideas like "we must try this laksa stall" get buried in the family WhatsApp group, and nobody knows what the group actually wants to do |
| **Why it exists** | One private place to collect ideas and see, at a glance, which ones have the most support, both before and during the trip |
| **Familiar app it shrinks** | Reddit / Pinterest: a board of posts with upvotes |

## Scope (deliberately small)

- **One main record:** an **Idea**, with title, category (Eat / Go / Do), note, optional link (Maps/TikTok/blog), optional trip day, author and time
- **One shared action:** an **"I'm in"** vote, one per person per idea. Sort by most wanted, by trip day or by newest.
- **One rule:** only logged-in trip members can view the board. Anyone can add ideas and vote. **Only the author can edit or delete their own idea.**
- **Joining:** sign up with name, email, password and the secret invite code, which the organiser shares privately. The database refuses the 11th member.

Out of scope for v1: photos, comments, itinerary scheduling, expense splitting.

## Stack

- **Next.js** (React) for the frontend
- **Supabase** for the Postgres database and email/password login
- The access rule is enforced by **Row Level Security** in the database (see [`supabase/schema.sql`](supabase/schema.sql)), not just hidden buttons in the UI
- **Vercel** for hosting

## Run it

1. Create a Supabase project. Under Authentication → Email, decide on "Confirm email": turning it **on** stops sign-ups with made-up addresses, and turning it off makes joining instant.
2. In the Supabase **SQL Editor**, run `supabase/schema.sql`. If your project already ran the original schema, run `supabase/migrations/001_security_privacy.sql` instead.
3. **Set your invite code** with a separate query that you never commit:
   ```sql
   insert into private.settings (key, value) values ('invite_code', 'YOUR-SECRET-CODE')
   on conflict (key) do update set value = excluded.value;
   ```
   Until this is set, every sign-up is refused.
4. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_KEY=...   # publishable/anon key
   ```
5. Run `npm install`, then `npm run dev`, and open http://localhost:3000
6. Deploy by importing the repo into Vercel and adding the same two environment variables.

## API routes

The board talks to its own API (Next.js route handlers on Vercel), and the API talks to Supabase **as the logged-in user**, so the database rules still apply.

| Method | Route | What it does |
|---|---|---|
| GET | `/api/ideas` | List ideas, with author name and votes |
| POST | `/api/ideas` | Create an idea (validated) → 201 |
| PATCH | `/api/ideas/:id` | Edit your own idea; someone else's → 404 |
| DELETE | `/api/ideas/:id` | Delete your own idea → 204 |
| POST | `/api/ideas/:id/vote` | "I'm in" (voting twice is harmless) |
| DELETE | `/api/ideas/:id/vote` | Take back your vote → 204 |

Every route needs `Authorization: Bearer <access token>`, or it returns 401.

- Route files: `app/api/**/route.js`. These are thin wiring only.
- Logic: `lib/api/handlers.mjs`.
- Validation: `lib/api/validate.mjs`.

### Tests

```
npm test                # run tests
npm run test:coverage   # run with coverage (fails under 80% lines)
```

The tests use Node's built-in test runner and a fake Supabase client (`tests/fakeSupabase.mjs`), so they need no network, database or extra packages.

### Linting and the Claude Code hook

```
npm run lint    # ESLint (Next.js recommended rules + a few bug-catching extras)
npm run check   # lint + tests with the 80% coverage gate
```

`.claude/settings.json` registers a **Claude Code hook**: after Claude edits or writes a JS/MJS file, `.claude/hooks/check.mjs` lints that file. If the file is under `lib/api/` or `tests/`, the hook also runs the tests. Any problem is sent back to Claude, which has to fix it before carrying on. Non-JS files are skipped. To turn the hook off, delete the `PostToolUse` entry from that file.

## Security and privacy

- **Invite code:** stored only in `private.settings`, which the API can't reach. Share it privately and change it with the query above if it leaks.
- **What's stored:** each member's email (used for login only, never shown), the display name they choose, and their ideas and votes. Ideas can reveal where the family will be and when, so only logged-in members can read them.
- **Validation:** the database itself rejects links that aren't `http(s)://`, links over 2,048 characters and notes over 2,000 characters.
- **Leaving:** any member can tap **Leave trip** to permanently delete their account, ideas and votes.
- **After the trip:** delete the Supabase project (Project Settings → General → Delete project) to erase everything.
