import { ChevronDown } from 'lucide-react'

export default function Select({ value, onChange, options, label }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-ink-secondary font-medium">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full bg-card hover:bg-[#363654] text-white text-sm font-medium rounded-lg px-3 py-2.5 pr-9 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent-pink/50 transition-colors cursor-pointer"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" />
      </div>
    </label>
  )
}
