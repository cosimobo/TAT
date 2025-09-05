'use client'
import { useEffect, useState } from 'react'
import { Card, Button, Input, Select } from '@/components/ui'
import { Month } from '@/components/Month'
import { generateYearAssignments, Person } from '@/lib/rotation'
import { supabase } from '@/lib/supabase'
import { formatISO } from 'date-fns'

type DutyRow = { date: string, person_id: string }

export default function Home() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [people, setPeople] = useState<Person[]>([
    { id:'p1', name:'John' },
    { id:'p2', name:'Ale' },
    { id:'p3', name:'Paola' },
  ])
  const [entries, setEntries] = useState<DutyRow[]>([])
  const [me, setMe] = useState<string>('p1')

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.from('duties').select('*')
        .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`).order('date')
      if (data) setEntries(data as DutyRow[])
    })()
  },[year])

  async function regenerate() {
    const plan = generateYearAssignments(people, year)
    const payload = plan.map(p=>({ date: p.date, person_id: p.personId }))
    await supabase.from('duties').delete().gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    const { error } = await supabase.from('duties').insert(payload)
    if (error) alert(error.message); else setEntries(payload)
  }

  const today = formatISO(new Date(), { representation:'date' })
  const todayEntry = entries.find(e=>e.date===today)
  const next = entries.slice(0,7)

  return <div className="space-y-4">
    <Card>
      <div className="grid md:grid-cols-2 gap-3 items-end">
        <div>
          <div className="text-xs uppercase opacity-60">Who are you?</div>
          <Select value={me} onChange={e=>setMe(e.target.value)}>
            {people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div>
          <div className="text-xs uppercase opacity-60">Year</div>
          <Input type="number" value={year} onChange={e=>setYear(parseInt(e.target.value||'0')||new Date().getFullYear())} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs uppercase opacity-60 mb-1">People (edit names)</div>
          <div className="grid grid-cols-3 gap-2">
            {people.map((p,idx)=>(
              <Input key={p.id} value={p.name} onChange={e=>{
                const arr=[...people]; arr[idx]={...arr[idx], name:e.target.value}; setPeople(arr)
              }} />
            ))}
          </div>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button onClick={regenerate}>Regenerate Year Plan</Button>
        </div>
      </div>
    </Card>

    <Card>
      <div className="text-sm">Tonight: <b>{todayEntry?.person_id ? people.find(p=>p.id===todayEntry.person_id)?.name : '—'}</b></div>
      <div className="text-xs opacity-60">Next days</div>
      <div className="flex gap-2 text-sm flex-wrap">
        {next.map(e=><div key={e.date} className="px-2 py-1 border rounded">
          {e.date}: <b>{people.find(p=>p.id===e.person_id)?.name}</b>
        </div>)}
      </div>
    </Card>

    <Month
      year={year}
      month={new Date().getMonth()+1}
      people={people}
      entries={entries.map(e=>({ date:e.date, personId:e.person_id }))}
    />
  </div>
}
