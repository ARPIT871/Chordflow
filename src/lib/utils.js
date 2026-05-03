export function classNames(...arr) {
  return arr.filter(Boolean).join(' ')
}

export function qualityChip(quality) {
  const map = {
    M: { label: 'maj', bg: 'bg-pink-500/20',   text: 'text-pink-300'   },
    m: { label: 'min', bg: 'bg-teal-500/20',   text: 'text-teal-300'   },
    d: { label: 'dim', bg: 'bg-amber-500/20',  text: 'text-amber-300'  },
    A: { label: 'aug', bg: 'bg-purple-500/20', text: 'text-purple-300' },
  }
  return map[quality] || map.M
}
