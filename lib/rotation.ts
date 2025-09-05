import { addDays, startOfWeek, formatISO } from 'date-fns'

export type Person = { id: string; name: string }
export type Assignment = { date: string; personId: string }

export function generateYearAssignments(people: Person[], year: number): Assignment[] {
  if (people.length !== 3) throw new Error('Exactly 3 people required')
  const jan1 = new Date(year, 0, 1)
  let weekStart = startOfWeek(jan1, { weekStartsOn: 1 })
  const end = new Date(year, 11, 31)
  const res: Assignment[] = []
  let order = [people[0].id, people[1].id, people[2].id]
  while (weekStart <= end) {
    const mon = addDays(weekStart, 0)
    const tue = addDays(weekStart, 1)
    const wed = addDays(weekStart, 2)
    const thu = addDays(weekStart, 3)
    const fri = addDays(weekStart, 4)
    const sat = addDays(weekStart, 5)
    const sun = addDays(weekStart, 6)
    const blocks = [
      { days: [mon, tue], pid: order[0] },
      { days: [wed, thu], pid: order[1] },
      { days: [fri, sat, sun], pid: order[2] }
    ]
    for (const b of blocks) {
      for (const d of b.days) {
        if (d.getFullYear() === year) {
          res.push({ date: formatISO(d, { representation: 'date' }), personId: b.pid })
        }
      }
    }
    order = [order[1], order[2], order[0]]
    weekStart = addDays(weekStart, 7)
  }
  return res
}
