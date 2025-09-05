import { clsx } from 'clsx'
export function Card({ children, className='' }: { children: any, className?: string }) {
  return <div className={clsx("rounded-2xl border p-4 shadow-sm bg-white", className)}>{children}</div>
}
export function Button({ children, className='', ...props }: any) {
  return <button className={clsx("rounded-xl border px-4 py-2 hover:shadow text-sm", className)} {...props}>{children}</button>
}
export function Input(props: any) {
  return <input className="border rounded-xl px-3 py-2 w-full" {...props} />
}
export function Select(props: any) {
  return <select className="border rounded-xl px-3 py-2 w-full" {...props} />
}
