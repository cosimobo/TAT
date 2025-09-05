# TAT — PWA
A super-simple installable web app (PWA) to manage night-duty for grandparents.
- Fixed rotation blocks: **Mon–Tue**, **Wed–Thu**, **Fri–Sun** with **weekly role rotation** across 3 people.
- Shared month view.
- One-tap swap requests.
- Daily reminders via web push (optional).

## Stack
- **Next.js 14** + **TailwindCSS**
- **Supabase** (database + auth [optional]) — free tier is enough
- **OneSignal** (web push) — optional

## Quick Start
1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill values.
3. In Supabase, SQL editor → run `supabase/schema.sql`.
4. (Optional) Set up OneSignal for web push and put `NEXT_PUBLIC_ONESIGNAL_APP_ID`.
5. `npm i`, then `npm run dev`.

Deploy on Vercel. On iPhone/Android, open URL and **Add to Home Screen**. You now have a standalone app.

## Database Schema
- `people(id text primary key, name text)` — optional; names can be local, duties store person IDs.
- `duties(date date primary key, person_id text references people(id))`
- `swaps(id uuid pk, from_person_id text, to_person_id text, date date, status text, created_at timestamptz)`

## Reminders
We include stubs for a **daily reminder cron** (17:00 Europe/Rome) using a Supabase Edge Function that sends push notifications via OneSignal to the person on duty for `today` and `tomorrow`.

You must configure:
- a Supabase scheduled cron to hit the edge function
- OneSignal Web Push app + site origin
- import `public/OneSignalSDKWorker.js` (created on postinstall)

## Fairness
Each week, roles rotate A→B→C. Over the year, weekends are evenly distributed.

