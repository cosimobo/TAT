# TAT — Tocca A Te
Minimal PWA to schedule family night duty with weekly-rotating blocks (Mon–Tue, Wed–Thu, Fri–Sun).

## Deploy
1) **Supabase**
- Create project → SQL Editor → run `supabase/schema.sql`
- Seed:
```sql
insert into people (id,name) values
('p1','John'),('p2','Ale'),('p3','Paola')
on conflict (id) do update set name=excluded.name;
```

2) **Vercel → Environment Variables**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `NEXT_PUBLIC_TIMEZONE` — `Europe/Rome`
- (optional) `NEXT_PUBLIC_ONESIGNAL_APP_ID` — for web push

3) **Build**
- `npm i`
- `npm run dev` (local) or import repo in Vercel.

Workers already present:
- `public/OneSignalSDKWorker.js`
- `public/OneSignalSDKUpdaterWorker.js`
