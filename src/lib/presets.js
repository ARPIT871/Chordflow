import { MINOR_FLAVORS, ROMAN_BASE } from './theory'

export const PRESETS_MINOR = [
  { category: 'Emotional',       romans: ['i',  'VI',  'III', 'VII'] },
  { category: 'Bollywood/Hindi', romans: ['i',  'VII', 'VI',  'V']   },
  { category: 'Lo-fi/Neo-soul',  romans: ['i',  'iv',  'VII', 'III'] },
  { category: 'Cinematic',       romans: ['i',  'iv',  'VI',  'V']   },
  { category: 'Sad',             romans: ['i',  'v',   'VI',  'III'] },
  { category: 'Hopeful',         romans: ['i',  'III', 'VI',  'VII'] },
  { category: 'Pop',             romans: ['vi', 'IV',  'I',   'V']   },
]

export const PRESETS_MAJOR = [
  { category: 'Pop',             romans: ['I',  'V',   'vi',  'IV']  },
  { category: 'Emotional',       romans: ['vi', 'IV',  'I',   'V']   },
  { category: 'Lo-fi/Neo-soul',  romans: ['I',  'iii', 'IV',  'vi']  },
  { category: 'Cinematic',       romans: ['I',  'V',   'vi',  'IV']  },
  { category: 'Bollywood/Hindi', romans: ['I',  'IV',  'V',   'vi']  },
  { category: 'Jazzy',           romans: ['ii', 'V',   'I',   'vi']  },
  { category: 'Sad',             romans: ['vi', 'iii', 'IV',  'I']   },
  { category: 'Hopeful',         romans: ['I',  'IV',  'V',   'IV']  },
]

export function getPresets(scale) {
  return MINOR_FLAVORS.has(scale) ? PRESETS_MINOR : PRESETS_MAJOR
}

export function romanToDegree(roman) {
  const base = roman.replace(/[°+]/g, '')
  const idx = ROMAN_BASE.findIndex(r => r.toLowerCase() === base.toLowerCase())
  return idx >= 0 ? idx : 0
}
