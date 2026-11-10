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
- **Joining:** sign up with email + password and the invite code. The database refuses the 11th member.

Out of scope for v1: photos, comments, itinerary scheduling, expense splitting.

## Stack

- **Next.js** (React) for the frontend
- **Supabase** for the Postgres database and email/password login
- The access rule is enforced by **Row Level Security** in the database (see [`supabase/schema.sql`](supabase/schema.sql)), not just hidden buttons in the UI
- **Vercel** for hosting

## Run it

1. Create a Supabase project. Under Authentication → Email, turn off "Confirm email".
2. In the Supabase **SQL Editor**, run `supabase/schema.sql`.
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_KEY=...   # publishable/anon key
   ```
4. Run `npm install`, then `npm run dev`, and open http://localhost:3000
5. Deploy by importing the repo into Vercel and adding the same two environment variables.

Invite code: `FAMILY10` (change it in `schema.sql`).
