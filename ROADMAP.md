# ChordFlow — Roadmap

A running list of what's been built and what's coming next. Items are
checked off as we ship them so we never lose track between sessions.

**Current version:** 0.6.0
**Last updated:** 2026-05-04 · play full arrangement
**Live URL:** http://localhost:5173/Chordflow/ (dev) · published via GitHub Pages

---

## ✅ Done

### Foundation
- [x] Multi-layer audio engine (chords / pads / pluck / bass / drums / audio) playing in sync via Tone.Transport
- [x] Multi-track MIDI export — each layer becomes its own track; drums on GM channel 10
- [x] Tone.Offline-based stem rendering
- [x] Per-layer Tone.Gain + Tone.Meter chain
- [x] Master gain + reverb bus (audio layer bypasses synth reverb)
- [x] Quadratic fader curve with snap-to-silence at the bottom

### Studio UI (ChordFlow Studio design)
- [x] Top transport bar — play / stop / loop / record, BPM stepper, KEY + SCALE chips (clickable), BARS / CMPLX / OCT / INST chips, "Live · 5" pill
- [x] Arrangement strip (Intro / Verse / Chorus / Bridge / Outro) — sections now own their own progression + drum pattern; switching pills swaps what plays
- [x] Section density dots in the arrangement strip — driven by real progression-fill + drum-cell density
- [x] **Section / Song play-mode toggle** — Song mode sequences every non-empty section in order with the right drum pattern per section, then loops; currently-playing section gets a teal indicator on the arrangement pill
- [x] Two-column body: Key detection + Presets (left) · Chord palette + Progression + Layers + Drum grid + Audio (right)
- [x] Horizontal mixer with real-time meters, M / S, faders, master channel
- [x] Bottom keyboard with pink-lit active notes + chord-name readout
- [x] Slide-out collab panel (visual stub — real-time sync deferred)
- [x] Mobile-friendly layout with sticky play bar
- [x] Color tokens + surface / glow / cell CSS utilities matching the design

### Composition tools
- [x] Diatonic chord palette (7 chords, all 8 scales)
- [x] Borrowed chord tab (parallel-mode swap: major ↔ natural minor)
- [x] Modal chord tab (Mixolydian for major keys, Dorian for minor)
- [x] Progression builder with 4 or 8 slots, drag-to-reorder, click-to-swap picker
- [x] 16 progression presets (8 major, 7 minor flavors)
- [x] 6-voice editable drum grid (kick / snare / closed hat / open hat / clap / tom)
- [x] Per-row M / S / volume → MIDI velocity + audio trigger velocity
- [x] 6 drum pattern presets (Boom Bap / Trap / Lo-Fi / Bollywood Dhol / Four-on-Floor / Half-Time)
- [x] Clear / Generate buttons for drum grid
- [x] Bass layer with 4 modes (Root / Root+5th / Walking / Custom) and 3 instruments
- [x] Pluck/arp engine: 5 patterns (Up / Down / Up-Down / Random / Chord) × 2 rates (1/8, 1/16)
- [x] 9 chord instruments, 5 pad instruments, 6 pluck instruments
- [x] Audio layer: drag-and-drop upload OR mic recording, plays in sync, loop toggle
- [x] Audio clip persists to IndexedDB (keyed by project id) — survives refresh and travels with named projects
- [x] Canvas waveform display with teal playhead while the transport runs
- [x] Key detection from uploaded audio (chromagram → top 5 candidates)

### Persistence + export
- [x] Auto-save current sketch to localStorage every 500 ms
- [x] Named projects with save-as-new, rename, delete (last 30)
- [x] Recent-projects dropdown with relative timestamps
- [x] Download `.chordflow.json` for backup / cross-device transfer
- [x] Open `.chordflow.json` from file
- [x] Multi-track MIDI export (channels named per layer)
- [x] Stem export — each enabled layer renders to its own WAV (Tone.Offline)
- [x] Audio clip re-encoded as WAV in the stem export (loops if Loop toggle is on)

### Tooling / repo
- [x] Production build clean (~540 kB minified, 150 kB gzip)
- [x] `.claude/settings.json` with git-command auto-allow + destructive-op denylist

---

## 🛠️ Up next

Ordered by impact / effort ratio. Estimated effort in hours next to each.

### Top priority

- [x] **Audio clip persistence (IndexedDB)** — 1.5h ✓
  - Save the audio Blob to IndexedDB on every change, keyed by project ID
  - Restore the blob into Tone.Player on project load
  - Audio Blob lifted into App.jsx and synced via `audio-storage.js`

- [x] **Waveform display for loaded audio** — 1h ✓
  - Canvas waveform with pink playhead, peaks computed from the AudioBuffer
  - Playhead polls `audio.getAudioPlaybackPosition()` via RAF
  - Footer hint shows whether the clip will loop or play once

- [x] **Section-aware arrangement** — 4-6h ✓
  - Each of Intro / Verse / Chorus / Bridge / Outro owns its own progression + drum pattern
  - Picking a section in the arrangement strip switches both immediately; the active section label shows up next to the Chords and Drums headers
  - Density dots in the arrangement strip reflect real content (progression fill + drum cell density)
  - **Still single-section playback** — pressing Play loops the active section only; a "play full arrangement" mode that chains sections is the next step here

### Quality of life

- [ ] **Undo / redo** — 2h
  - Ctrl+Z / Ctrl+Shift+Z for progression edits, drum grid edits, layer toggles
  - Stack of last 30 states is plenty

- [ ] **Keyboard shortcuts** — 30 min
  - Space = play / stop
  - Esc = clear progression / stop
  - 1-7 = add chord by degree (active tab)
  - M = mute focused layer

- [ ] **Drum swing slider** — 1h
  - The design has it in the drum-grid header; not wired up yet
  - Shifts off-beat 16ths late by 0-50%

### Mixing depth

- [ ] **Per-channel reverb / delay sends** — 2h
  - Currently one global reverb on the synth bus
  - Replace with per-channel send knobs feeding a shared reverb + delay return bus

- [ ] **3-band EQ per channel** — 2.5h
  - Low / mid / high knobs on each mixer channel via Tone.EQ3

### Composition aids

- [ ] **Suggest next chord** — 1.5h
  - When a slot is empty, show 2-3 functional-harmony suggestions inline
  - "From V, common moves: I (resolution), vi (deceptive), IV (plagal)"
  - Teaches theory while you sketch

### Full-song export

- [x] **Play full arrangement** — 1.5h ✓
  - Sequence Intro → Verse → Chorus → Bridge → Outro on Play (vs single-section loop)
  - Each section plays its own drum pattern; chord palette + piano keyboard
    follow the playing chord across sections; song loops at the end
  - Multi-section MIDI / stem export still pending — exports stay
    single-section for now

- [ ] **Multi-section MIDI / stems export** — 1h
  - Walk the same buildSongSchedule path used by playback, write each
    section's bars onto the .mid timeline and concatenate stems

- [ ] **Mix-down to single WAV** — 2h
  - Render the whole song mixed down via Tone.Offline
  - One file you can drop into anywhere

- [ ] **Drum-row panning** — 1h
  - Per-row pan knob; encoded as MIDI CC10 in the export

### Bigger features (parked)

- [ ] **Real-time collab backend** — multi-day, needs a server
  - The slide-out UI exists, presence / role assignment / voice chat all mocked
  - Needs WebSocket server + audio peer connections

- [ ] **Multiple audio tracks** — 3h
  - Currently single audio clip per project; multi-take would help vocal layering

- [ ] **Trim handles on the audio clip** — 1.5h
  - Drag the start / end of the waveform to crop without re-recording

---

## How this file is maintained

When a new task is taken on, move the bullet from **Up next** to the
relevant **Done** subsection and tick the checkbox. When a new idea
shows up, add it to **Up next** in roughly the right priority slot.
Keep the version + last-updated date at the top current.
