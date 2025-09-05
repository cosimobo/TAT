// Supabase Edge Function (Deno) — sends web push via OneSignal REST API
// Schedule daily at 17:00 Europe/Rome
// Set env: ONESIGNAL_APP_ID, ONESIGNAL_API_KEY
import "https://deno.land/x/dotenv/load.ts";

type Row = { date: string, person_id: string }

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE')!
    const onesignalApp = Deno.env.get('ONESIGNAL_APP_ID')!
    const onesignalKey = Deno.env.get('ONESIGNAL_API_KEY')!

    const r = await fetch(`${url}/rest/v1/v_upcoming?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    })
    const data = await r.json() as Row[]

    for (const row of data) {
      await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${onesignalKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: onesignalApp,
          included_segments: ['Subscribed Users'],
          headings: { en: 'Night duty reminder' },
          contents: { en: `Duty: ${row.person_id} on ${row.date}` }
        })
      })
    }

    return new Response(JSON.stringify({ ok: true, count: data.length }), { headers: { "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 })
  }
})
