'use client'
import { useEffect, useState, ChangeEvent } from 'react'
import { Card, Button, Input, Select } from '@/components/ui'
import { Month } from '@/components/Month'
import { generateYearAssignments, Person } from '@/lib/rotation'
import { supabase } from '@/lib/supabase'
import { addDays, format, formatISO } from 'date-fns'
import { it } from 'date-fns/locale'

declare global {
  interface Window { OneSignal: any; ensureTATPush?: () => Promise<void> }
}

type DutyRow = { date: string; person_id: string }
type SwapRow = {
  id: string
  from_person_id: string
  to_person_id: string | null
  date: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at: string
}

const ALL_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

// utili data e cookie
function fmtDateStr(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`)
  return format(d, 'dd-MM-yyyy', { locale: it })
}
function setCookie(name: string, value: string, days = 400) {
  try {
    const d = new Date()
    d.setTime(d.getTime() + days*24*60*60*1000)
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`
  } catch {}
}
function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export default function Home() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [currentMonth] = useState(now.getMonth() + 1) // 1..12
  const [people] = useState<Person[]>([
    { id: 'p1', name: 'John' },
    { id: 'p2', name: 'Ale' },
    { id: 'p3', name: 'Paola' },
  ])
  const [entries, setEntries] = useState<DutyRow[]>([])

  // inizializza "me" leggendo PRIMA cookie, poi localStorage
  const [me, setMe] = useState<string>(() => {
    if (typeof window === 'undefined') return 'p1'
    try {
      return getCookie('tat_me') || localStorage.getItem('tat_me') || 'p1'
    } catch {
      return 'p1'
    }
  })

  const [myInbox, setMyInbox] = useState<SwapRow[]>([])
  const [myOutbox, setMyOutbox] = useState<SwapRow[]>([])
  const [showFullYear, setShowFullYear] = useState(false)

  // Carica i turni dell'anno
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('duties')
        .select('*')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date')
      if (error) {
        alert(`Errore caricamento turni: ${error.message}`)
      } else if (data) {
        setEntries(data as DutyRow[])
      }
    })()
  }, [year])

  // Carica richieste (aperte degli altri + le mie)
  async function refreshSwaps() {
    const [inbox, outbox] = await Promise.all([
      supabase
        .from('swaps')
        .select('*')
        .eq('status', 'pending')
        .neq('from_person_id', me)
        .order('created_at', { ascending: false }),
      supabase
        .from('swaps')
        .select('*')
        .eq('from_person_id', me)
        .order('created_at', { ascending: false })
    ])
    if (!inbox.error && inbox.data) setMyInbox(inbox.data as SwapRow[])
    if (!outbox.error && outbox.data) setMyOutbox(outbox.data as SwapRow[])
  }
  useEffect(() => { refreshSwaps() }, [me, year])

  // ✅ Rigenera piano annuale con UPSERT su 'date' (niente più duplicate key)
  async function regenerate() {
    try {
      const plan = generateYearAssignments(people, year)

      // dedup sicura
      const map = new Map<string, { date: string; person_id: string }>()
      for (const p of plan) map.set(p.date, { date: p.date, person_id: p.personId })
      const payload = Array.from(map.values())

      // upsert per aggiornare/creare righe per quell'anno
      const { error: upErr } = await supabase
        .from('duties')
        .upsert(payload, { onConflict: 'date' })

      if (upErr) {
        alert(`Errore upsert: ${upErr.message}`)
        return
      }

      // ricarica l'anno dal DB
      const { data, error: loadErr } = await supabase
        .from('duties')
        .select('*')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date')

      if (loadErr) {
        alert(`Errore ricarico: ${loadErr.message}`)
      } else if (data) {
        setEntries(data as DutyRow[])
        alert('Piano annuale aggiornato.')
      }
    } catch (e: any) {
      alert(`Errore imprevisto: ${e?.message || String(e)}`)
    }
  }

  // Crea richiesta di cambio turno (offerta aperta)
  async function requestSwap(date: string) {
    const current = entries.find((e) => e.date === date)
    if (!current) return
    if (current.person_id !== me) {
      alert('Puoi chiedere lo scambio solo per i giorni assegnati a te.')
      return
    }
    const { error } = await supabase.from('swaps').insert({
      from_person_id: me,
      to_person_id: null,
      date,
      status: 'pending'
    })
    if (error) alert(error.message)
    else {
      alert('Richiesta di scambio creata. Il primo che accetta se lo prende.')
      refreshSwaps()
    }
  }

  // Accetta (first-come-first-served)
  async function acceptSwap(s: SwapRow) {
    const duty = entries.find(d => d.date === s.date)
    if (duty?.person_id === me) return alert('Hai già questo giorno.')
    if (s.from_person_id === me) return alert('Non puoi accettare una tua richiesta.')

    const upd = await supabase
      .from('swaps')
      .update({ status: 'accepted', to_person_id: me })
      .eq('id', s.id)
      .eq('status', 'pending')
      .select('id')

    if (upd.error) return alert(`Impossibile accettare: ${upd.error.message}`)
    if (!upd.data || upd.data.length === 0) {
      alert('Troppo tardi — qualcun altro ha già accettato.')
      return refreshSwaps()
    }

    const t1 = await supabase.from('duties').update({ person_id: me }).eq('date', s.date)
    if (t1.error) return alert(`Segnato accettato ma fallito aggiornamento turno: ${t1.error.message}`)

    alert('Scambio accettato. Turno aggiornato.')
    setEntries(prev => prev.map(d => d.date === s.date ? { ...d, person_id: me } : d))
    refreshSwaps()
  }

  async function declineSwap(s: SwapRow) {
    const { error } = await supabase.from('swaps').update({ status: 'declined' }).eq('id', s.id)
    if (error) alert(error.message); else { alert('Scambio rifiutato.'); refreshSwaps() }
  }

  // Stasera / Domani
  const today = formatISO(now, { representation: 'date' })
  const tomorrowISO = formatISO(addDays(now, 1), { representation: 'date' })
  const todayEntry = entries.find((e) => e.date === today)
  const tomorrowEntry = entries.find((e) => e.date === tomorrowISO)
  const nameOf = (id?: string) => people.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      {/* Controlli */}
      <Card>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-xs uppercase opacity-60">Chi sei?</div>
            <Select
              value={me}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const v = e.target.value
                setMe(v)
                try { localStorage.setItem('tat_me', v) } catch {}
                setCookie('tat_me', v)
                if (typeof window !== 'undefined' && window.OneSignal) {
                  const OS = window.OneSignal
                  if (OS.sendTag) OS.sendTag('person', v)
                  if (OS.User?.addTag) OS.User.addTag('person', v)
                }
              }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <div className="text-xs uppercase opacity-60">Anno</div>
            <Input
              type="number"
              value={year}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setYear(parseInt(e.target.value || '0') || new Date().getFullYear())
              }
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={regenerate}>Rigenera piano annuale</Button>
            <Button onClick={() => setShowFullYear(s => !s)}>
              {showFullYear ? 'Nascondi anno intero' : 'Mostra anno intero'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Box notifiche: prompt/stato/diagnostica */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">Notifiche push</div>
            <div className="text-xs opacity-70">
              Se non vedi il prompt, premi “Abilita notifiche”.
              Se il permesso è <b>denied</b>, sbloccalo dalle impostazioni del sito (icona lucchetto).
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={async () => {
              if (typeof window === 'undefined') return
              if (window.ensureTATPush) {
                await window.ensureTATPush()
              } else if (window.OneSignal) {
                const OS = window.OneSignal
                if (OS.Slidedown?.promptPush) await OS.Slidedown.promptPush()
                else if (OS.Notifications?.requestPermission) await OS.Notifications.requestPermission()
                if (OS.User?.PushSubscription?.optIn) await OS.User.PushSubscription.optIn()
              }
            }}>
              Abilita notifiche
            </Button>
            <Button onClick={async () => {
              if (typeof window === 'undefined' || !window.OneSignal) return
              const OS = window.OneSignal
              const supported = await OS.Notifications?.isPushSupported?.()
              const perm = await OS.Notifications?.permission?.()
              const opted = await OS.User?.PushSubscription?.optedIn
              alert(`Supporto push: ${supported ? 'sì' : 'no'}\nPermesso: ${perm ?? 'sconosciuto'}\nOpt-in: ${opted ? 'sì' : 'no'}`)
            }}>
              Stato permessi
            </Button>
          </div>
        </div>
      </Card>

      {/* TILE STASERA / DOMANI */}
      <div className="grid md:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-6 md:p-8 h-48 md:h-56 bg-green-500 text-white flex flex-col items-center justify-center text-center shadow-sm"
          title="Stasera"
        >
          <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Stasera</div>
          <div className="text-2xl md:text-3xl font-extrabold mt-1">{nameOf(todayEntry?.person_id)}</div>
          <div className="text-xs md:text-sm mt-1 opacity-90">{fmtDateStr(today)}</div>
        </div>
        <div
          className="rounded-2xl p-6 md:p-8 h-48 md:h-56 bg-blue-500 text-white flex flex-col items-center justify-center text-center shadowsm"
          title="Domani"
        >
          <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Domani</div>
          <div className="text-2xl md:text-3xl font-extrabold mt-1">{nameOf(tomorrowEntry?.person_id)}</div>
          <div className="text-xs md:text-sm mt-1 opacity-90">{fmtDateStr(tomorrowISO)}</div>
        </div>
      </div>

      {/* RICHIESTE prima del calendario */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-semibold mb-2">Richieste aperte (dagli altri)</div>
          <div className="space-y-2">
            {myInbox.length === 0 && <div className="text-xs opacity-60">Nessuna richiesta aperta.</div>}
            {myInbox.map((s) => (
              <div key={s.id} className="border rounded-lg p-2 flex items-center justify-between">
                <div className="text-sm">
                  <b>{fmtDateStr(s.date)}</b> — richiesta da <b>{nameOf(s.from_person_id)}</b>{' '}
                  <span className="text-xs opacity-60">({s.status})</span>
                </div>
                <div className="flex gap-2">
                  {s.status === 'pending' && (
                    <>
                      <Button onClick={() => acceptSwap(s)}>Accetta (prendi questo turno)</Button>
                      <Button onClick={() => declineSwap(s)}>Rifiuta</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-2">Le mie richieste</div>
          <div className="space-y-2">
            {myOutbox.length === 0 && <div className="text-xs opacity-60">Nessuna richiesta creata.</div>}
            {myOutbox.map((s) => (
              <div key={s.id} className="border rounded-lg p-2 flex items-center justify-between">
                <div className="text-sm">
                  <b>{fmtDateStr(s.date)}</b> — in attesa che qualcuno accetti{' '}
                  <span className="text-xs opacity-60">
                    ({s.status}{s.to_person_id ? ` → ${nameOf(s.to_person_id)}` : ''})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Mese corrente in evidenza */}
      <Month
        year={year}
        month={currentMonth}
        people={people}
        entries={entries.map((e) => ({ date: e.date, personId: e.person_id }))}
        onDayClick={requestSwap}
      />

      {/* Anno intero (toggle) */}
      {showFullYear && (
        <div className="grid md:grid-cols-2 gap-4">
          {ALL_MONTHS.filter(m => m !== currentMonth).map((m) => (
            <Month
              key={m}
              year={year}
              month={m}
              people={people}
              entries={entries.map((e) => ({ date: e.date, personId: e.person_id }))}
              onDayClick={requestSwap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
