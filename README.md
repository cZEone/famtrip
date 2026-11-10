# 🧳 Family Trip 2026: Ideas Board

A small Reddit/Pinterest-style board for **one family holiday**. Up to 10 relatives post ideas for places to **eat, go and do**, then tap **"I'm in"** on the ones they want. The most-wanted ideas rise to the top.

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

## Security and privacy

- **Invite code:** stored only in `private.settings`, which the API can't reach. Share it privately and change it with the query above if it leaks.
- **What's stored:** each member's email (used for login only, never shown), the display name they choose, and their ideas and votes. Ideas can reveal where the family will be and when, so only logged-in members can read them.
- **Validation:** the database itself rejects links that aren't `http(s)://`, links over 2,048 characters and notes over 2,000 characters.
- **Leaving:** any member can tap **Leave trip** to permanently delete their account, ideas and votes.
- **After the trip:** delete the Supabase project (Project Settings → General → Delete project) to erase everything.
