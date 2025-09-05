'use client'
import { useEffect, useState, ChangeEvent } from 'react'
import { Card, Button, Input, Select } from '@/components/ui'
import { Month } from '@/components/Month'
import { generateYearAssignments, Person } from '@/lib/rotation'
import { supabase } from '@/lib/supabase'
import { formatISO } from 'date-fns'

type DutyRow = { date: string; person_id: string }
type SwapRow = {
  id: string
  from_person_id: string
  to_person_id: string | null
  date: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at: string
}

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

export default function Home() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [people, setPeople] = useState<Person[]>([
    { id: 'p1', name: 'John' },
    { id: 'p2', name: 'Ale' },
    { id: 'p3', name: 'Paola' },
  ])
  const [entries, setEntries] = useState<DutyRow[]>([])
  const [me, setMe] = useState<string>('p1')
  const [myInbox, setMyInbox] = useState<SwapRow[]>([])
  const [myOutbox, setMyOutbox] = useState<SwapRow[]>([])

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

  // Load swaps (inbox = open requests from others; outbox = my own)
  async function refreshSwaps() {
    const [inbox, outbox] = await Promise.all([
      supabase
        .from('swaps')
        .select('*')
        .eq('status', 'pending')
        .neq('from_person_id', me) // requests created by others
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

  // Open swap request (no target). First accept wins.
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

  // First-come acceptance:
  // 1) Try to mark the swap accepted & assign yourself as to_person_id — ONLY if it's still pending.
  // 2) If that succeeds (rowcount==1), update the duty to you.
  async function acceptSwap(s: SwapRow) {
    // Prevent accepting your own request; and prevent accepting if you already hold that date.
    const duty = entries.find(d => d.date === s.date)
    if (duty?.person_id === me) return alert('You already have this day.')
    if (s.from_person_id === me) return alert('You cannot accept your own request.')

    const upd = await supabase
      .from('swaps')
      .update({ status: 'accepted', to_person_id: me })
      .eq('id', s.id)
      .eq('status', 'pending') // FIRST-COME GUARD
      .select('id')            // to check affected rows
    if (upd.error) {
      alert(`Failed to accept: ${upd.error.message}`)
      return
    }
    if (!upd.data || upd.data.length === 0) {
      alert('Too late — someone else accepted first.')
      refreshSwaps()
      return
    }

    // Now actually switch the duty to me
    const t1 = await supabase.from('duties').update({ person_id: me }).eq('date', s.date)
    if (t1.error) {
      alert(`Marked accepted but failed to update duty: ${t1.error.message}`)
      return
    }

    alert('Swap accepted. Duty updated.')
    setEntries(prev => prev.map(d => d.date === s.date ? { ...d, person_id: me } : d))
    refreshSwaps()
  }

  async function declineSwap(s: SwapRow) {
    // In open-offer model, decline is optional; keep it for feedback.
    const { error } = await supabase.from('swaps').update({ status: 'declined' }).eq('id', s.id)
    if (error) alert(error.message)
    else {
      alert('Swap declined.')
      refreshSwaps()
    }
  }

  const today = formatISO(new Date(), { representation: 'date' })
  const todayEntry = entries.find((e) => e.date === today)
  const next = entries.slice(0, 7)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-xs uppercase opacity-60">Who are you?</div>
            <Select value={me} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMe(e.target.value)}>
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
            <Button onClick={refreshSwaps}>Refresh</Button>
          </div>
        </div>
      </Card>

      {/* Today & next days */}
      <Card>
        <div className="text-sm">
          Tonight:{' '}
          <b>{todayEntry?.person_id ? people.find((p) => p.id === todayEntry.person_id)?.name : '—'}</b>
        </div>
        <div className="text-xs opacity-60">Next days</div>
        <div className="flex gap-2 text-sm flex-wrap">
          {next.map((e) => (
            <div key={e.date} className="px-2 py-1 border rounded">
              {e.date}: <b>{people.find((p) => p.id === e.person_id)?.name}</b>
            </div>
          ))}
        </div>
      </Card>

      {/* Full year */}
      <div className="grid md:grid-cols-2 gap-4">
        {MONTHS.map((m) => (
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

      {/* Swaps */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-semibold mb-2">Open requests (from others)</div>
          <div className="space-y-2">
            {myInbox.length === 0 && <div className="text-xs opacity-60">No open requests.</div>}
            {myInbox.map((s) => (
              <div key={s.id} className="border rounded-lg p-2 flex items-center justify-between">
                <div className="text-sm">
                  <b>{s.date}</b> — asked by <b>{people.find(p => p.id === s.from_person_id)?.name}</b>{' '}
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
                  <span className="text-xs opacity-60">({s.status}{s.to_person_id ? ` → ${people.find(p => p.id === s.to_person_id)?.name}` : ''})</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
