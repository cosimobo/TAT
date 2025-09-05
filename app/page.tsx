'use client'
import { useEffect, useState, ChangeEvent } from 'react'
import { Card, Button, Input, Select } from '@/components/ui'
import { Month } from '@/components/Month'
import { generateYearAssignments, Person } from '@/lib/rotation'
import { supabase } from '@/lib/supabase'
import { addDays, format, formatISO } from 'date-fns'
import { it } from 'date-fns/locale'

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

// util: mostra YYYY-MM-DD come DD-MM-YYYY
function fmtDateStr(isoDate: string) {
  // forza mezzanotte locale per evitare problemi di timezone
  const d = new Date(`${isoDate}T00:00:00`)
  return format(d, 'dd-MM-yyyy', { locale: it })
}

export default function Home() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [currentMonth] = useState(now.getMonth() + 1) // 1..12
  const [people, setPeople] = useState<Person[]>([
    { id: 'p1', name: 'John' },
    { id: 'p2', name: 'Ale' },
    { id: 'p3', name: 'Paola' },
  ])
  const [entries, setEntries] = useState<DutyRow[]>([])
  const [me, setMe] = useState<string>('p1')
  const [myInbox, setMyInbox] = useState<SwapRow[]>([])
  const [myOutbox, setMyOutbox] = useState<SwapRow[]>([])
  const [showFullYear, setShowFullYear] = useState(false)

  // Carica i turni dell'anno
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('duties')
        .select('*')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date')
      if (data) setEntries(data as DutyRow[])
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

  async function regenerate() {
    const plan = generateYearAssignments(people, year)
    const payload = plan.map((p) => ({ date: p.date, person_id: p.personId }))
    await supabase.from('duties').delete().gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    const { error } = await supabase.from('duties').insert(payload)
    if (error) alert(error.message)
    else setEntries(payload)
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
      to_person_id: null, // OFFERTA APERTA
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
      .eq('status', 'pending') // guard
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
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setMe(e.target.value)}
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
          className="rounded-2xl p-6 md:p-8 h-48 md:h-56 bg-blue-500 text-white flex flex-col items-center justify-center text-center shadow-sm"
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
