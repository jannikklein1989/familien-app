import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API (Chrome/Android, Safari). Fällt sonst auf das Diktat der Tastatur zurück.
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean
  start(): void; stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

function ctor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeech(onText: (finalText: string) => void) {
  const supported = typeof window !== 'undefined' && !!ctor()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Rec | null>(null)
  const cb = useRef(onText)
  useEffect(() => { cb.current = onText }, [onText])

  const stop = useCallback(() => { rec.current?.stop() }, [])
  const start = useCallback(() => {
    const C = ctor()
    if (!C) return
    setError(null)
    const r = new C()
    r.lang = 'de-DE'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let fin = ''
      let tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) fin += res[0].transcript
        else tmp += res[0].transcript
      }
      if (fin) cb.current(fin.trim())
      setInterim(tmp)
    }
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Mikrofon nicht erlaubt. Bitte in den Browser-Einstellungen freigeben.' : 'Spracherkennung hat nicht geklappt. Nutze sonst das Mikro der Tastatur.')
    r.onend = () => { setListening(false); setInterim('') }
    rec.current = r
    r.start()
    setListening(true)
  }, [])

  useEffect(() => () => rec.current?.stop(), [])
  return { supported, listening, interim, error, start, stop }
}
