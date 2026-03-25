import { useState, useMemo } from 'react'
import { COUNTRIES } from '../lib/countries'
import type { OriginCountry } from '../types'

interface Props {
  onConfirm: (origin: OriginCountry) => void
}

export default function OriginModal({ onConfirm }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OriginCountry | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q.length < 1
      ? COUNTRIES.slice(0, 80)
      : COUNTRIES.filter(c => c.name.toLowerCase().includes(q))
  }, [query])

  function pick(c: (typeof COUNTRIES)[0]) {
    setSelected({ name: c.name, code: c.code, lat: c.lat, lng: c.lng })
    setQuery(c.name)
    setOpen(false)
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="modal-panel glass-card rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-2xl">
        <div className="text-3xl mb-2 text-center">🌍</div>
        <h2 className="text-2xl font-bold text-white text-center mb-1">Welcome!</h2>
        <p className="text-white/50 text-sm text-center mb-6">
          Where are you from? This sets your origin for the travel map.
        </p>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search country…"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white
                       placeholder-white/30 focus:outline-none focus:border-indigo-400 text-sm"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          {open && filtered.length > 0 && (
            <ul className="absolute top-full mt-1 left-0 right-0 bg-[#12123a] border border-white/10
                           rounded-xl shadow-2xl max-h-52 overflow-y-auto z-10">
              {filtered.map(c => (
                <li
                  key={c.code}
                  className="px-4 py-2.5 text-sm text-white/80 hover:bg-indigo-600/30 cursor-pointer
                             flex items-center gap-2 transition-colors"
                  onMouseDown={() => pick(c)}
                >
                  <span className="font-mono text-xs text-white/30 w-6">{c.code}</span>
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30
                     disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl
                     transition-all text-sm"
        >
          Set as My Origin Country
        </button>

        <p className="text-white/25 text-xs text-center mt-3">
          Saved locally in your browser — never uploaded.
        </p>
      </div>
    </div>
  )
}
