'use client'
import { useEffect, useState, ChangeEvent } from 'react'
import { Card, Button, Input, Select } from '@/components/ui'
import { Month } from '@/components/Month'
import { generateYearAssignments, Person } from '@/lib/rotation'
import { supabase } from '@/lib/supabase'
import { addDays, formatISO } from 'date-fns'

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

  // Load duties for the year
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

  // Load swaps (open requests by others + my own)
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

  // Open swap request (no target) — first accept wins
  async function requestSwap(date: string) {
    const current = entries.find((e) => e.date === date)
    if (!current) return
    if (current.person_id !== me) {
      alert('You can only request a swap for a day that is assigned to you.')
      return
    }
    const { error } = await supabase.from('swaps').insert({
      from_person_id: me,
      to_person_id: null, // OPEN OFFER
      date,
      status: 'pending'
    })
    if (error) alert(error.message)
    else {
      alert('Open swap created. The first to accept gets it.')
      refreshSwaps()
    }
  }

  // First-come acceptance
  async function acceptSwap(s: SwapRow) {
    const duty = entries.find(d => d.date === s.date)
    if (duty?.person_id === me) return alert('You already have this day.')
    if (s.from_person_id === me) return alert('You cannot accept your own request.')

    const upd = await supabase
      .from('swaps')
      .update({ status: 'accepted', to_person_id: me })
      .eq('id', s.id)
      .eq('status', 'pending') // guard
      .select('id')

    if (upd.error) return alert(`Failed to accept: ${upd.error.message}`)
    if (!upd.data || upd.data.length === 0) {
      alert('Too late — someone else accepted first.')
      return refreshSwaps()
    }

    const t1 = await supabase.from('duties').update({ person_id: me }).eq('date', s.date)
    if (t1.error) return alert(`Marked accepted but failed to update duty: ${t1.error.message}`)

    alert('Swap accepted. Duty updated.')
    setEntries(prev => prev.map(d => d.date === s.date ? { ...d, person_id: me } : d))
    refreshSwaps()
  }

  async function declineSwap(s: SwapRow) {
    const { error } = await supabase.from('swaps').update({ status: 'declined' }).eq('id', s.id)
    if (error) alert(error.message); else { alert('Swap declined.'); refreshSwaps() }
  }

  // Tonight & Tomorrow
  const today = formatISO(now, { representation: 'date' })
  const tomorrow = formatISO(addDays(now, 1), { representation: 'date' })
  const todayEntry = entries.find((e) => e.date === today)
  const tomorrowEntry = entries.find((e) => e.date === tomorrow)
  const nameOf = (id?: string) => people.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-xs uppercase opacity-60">Who are you?</div>
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
            <div className="text-xs uppercase opacity-60">Year</div>
            <Input
              type="number"
              value={year}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setYear(parseInt(e.target.value || '0') || new Date().getFullYear())
              }
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={regenerate}>Regenerate Year Plan</Button>
            <Button onClick={() => setShowFullYear(s => !s)}>
              {showFullYear ? 'Hide full year' : 'Show full year'}
            </Button>
          </div>
        </div>
      </Card>

      {/* TONIGHT / TOMORROW tiles */}
      <div className="grid md:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-6 md:p-8 h-48 md:h-56 bg-green-500 text-white flex flex-col items-center justify-center text-center shadow-sm"
          title="Tonight"
        >
          <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Tonight</div>
          <div className="text-2xl md:text-3xl font-extrabold mt-1">{nameOf(todayEntry?.person_id)}</div>
          <div className="text-xs md:text-sm mt-1 opacity-90">{today}</div>
        </div>
        <div
          className="rounded-2xl p-6 md:p-8 h-48 md:h-56 bg-blue-500 text-white flex flex-col items-center justify-center text-center shadow-sm"
          title="Tomorrow"
        >
          <div className="uppercase tracking-wide text-xs md:text-sm opacity-90">Tomorrow</div>
          <div className="text-2xl md:text-3xl font-extrabold mt-1">{nameOf(tomorrowEntry?.person_id)}</div>
          <div className="text-xs md:text-sm mt-1 opacity-90">{tomorrow}</div>
        </div>
      </div>

      {/* Swaps BEFORE calendar */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-semibold mb-2">Open requests (from others)</div>
          <div className="space-y-2">
            {myInbox.length === 0 && <div className="text-xs opacity-60">No open requests.</div>}
            {myInbox.map((s) => (
              <div key={s.id} className="border rounded-lg p-2 flex items-center justify-between">
                <div className="text-sm">
                  <b>{s.date}</b> — asked by <b>{nameOf(s.from_person_id)}</b>{' '}
                  <span className="text-xs opacity-60">({s.status})</span>
                </div>
                <div className="flex gap-2">
                  {s.status === 'pending' && (
                    <>
                      <Button onClick={() => acceptSwap(s)}>Accept (take this day)</Button>
                      <Button onClick={() => declineSwap(s)}>Decline</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-2">My requests</div>
          <div className="space-y-2">
            {myOutbox.length === 0 && <div className="text-xs opacity-60">No requests created.</div>}
            {myOutbox.map((s) => (
              <div key={s.id} className="border rounded-lg p-2 flex items-center justify-between">
                <div className="text-sm">
                  <b>{s.date}</b> — waiting for someone to accept{' '}
                  <span className="text-xs opacity-60">
                    ({s.status}{s.to_person_id ? ` → ${nameOf(s.to_person_id)}` : ''})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Current month in plain sight */}
      <Month
        year={year}
        month={currentMonth}
        people={people}
        entries={entries.map((e) => ({ date: e.date, personId: e.person_id }))}
        onDayClick={requestSwap}
      />

      {/* Full year (toggle) */}
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
