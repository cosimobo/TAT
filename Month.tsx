'use client'
import { addDays, endOfMonth, format, formatISO, getDay, startOfMonth } from 'date-fns'
import { Card } from './ui'
import { Person } from '@/types'

type Entry = { date: string, personId: string }
export function Month({ year, month, people, entries, onDayClick } : {
  year: number, month: number, people: Person[], entries: Entry[], onDayClick?: (date: string)=>void
}) {
  const first = startOfMonth(new Date(year, month-1, 1))
  const last = endOfMonth(first)
  const offset = (getDay(first) + 6) % 7 // Mon=0
  const days = []
  for (let i=0;i<offset;i++) days.push(null)
  let d = first
  while (d<=last) { days.push(new Date(d)); d = addDays(d,1) }

  const personName = (id?: string)=> people.find(p=>p.id===id)?.name ?? ''

  const map = new Map(entries.map(e=>[e.date, e.personId]))
  return <Card>
    <div className="grid grid-cols-7 gap-2 text-xs">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=><div key={w} className="text-center font-medium">{w}</div>)}
      {days.map((day,idx)=>{
        if (!day) return <div key={idx} />
        const key = formatISO(day, { representation:'date' })
        const pid = map.get(key)
        return <div key={idx} onClick={()=>onDayClick?.(key)} className="border rounded-lg p-2 hover:shadow cursor-pointer">
          <div className="text-[10px] opacity-60">{format(day,'d LLL')}</div>
          <div className="font-semibold">{personName(pid)}</div>
        </div>
      })}
    </div>
  </Card>
}
