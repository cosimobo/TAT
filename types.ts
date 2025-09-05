export type Person = { id: string; name: string }
export type Duty = { date: string; person_id: string }
export type Swap = {
  id: string
  from_person_id: string
  to_person_id: string
  date: string
  status: 'pending'|'accepted'|'declined'|'cancelled'
  created_at: string
}
