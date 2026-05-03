export default function Toast({ message }) {
  if (!message) return null
  return (
    <div className="toast-anim fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-white/10 px-4 py-2.5 rounded-lg shadow-2xl text-sm text-white">
      {message}
    </div>
  )
}
