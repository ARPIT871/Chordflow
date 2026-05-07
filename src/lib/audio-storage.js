/**
 * IndexedDB-backed storage for audio blobs (uploaded clips + mic recordings).
 * We could in theory put audio in localStorage as base64, but localStorage
 * caps around 5 MB per origin which is too small for even a 30-second
 * recording. IndexedDB has tens-of-MB to hundreds-of-MB of room.
 *
 * One blob per project id. Re-saving overwrites. Deleting a project also
 * deletes its blob (App.jsx is responsible for calling deleteAudio).
 */

const DB_NAME = 'chordflow'
const DB_VERSION = 1
const STORE = 'audio-clips'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  return dbPromise
}

async function withStore(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const req = fn(store)
    tx.oncomplete = () => resolve(req?.result)
    tx.onerror    = () => reject(tx.error)
    tx.onabort    = () => reject(tx.error)
  })
}

export async function saveAudio(projectId, blob) {
  if (!projectId || !blob) return
  await withStore('readwrite', store => store.put(blob, projectId))
}

export async function loadAudio(projectId) {
  if (!projectId) return null
  return new Promise((resolve, reject) => {
    openDB().then(db => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(projectId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror   = () => reject(req.error)
    })
  })
}

export async function deleteAudio(projectId) {
  if (!projectId) return
  await withStore('readwrite', store => store.delete(projectId))
}
