/**
 * Speech recognition with two engines behind one interface.
 *
 * - **browser** — the Web Speech API. Fast and accurate, needs no download,
 *   but the audio is sent to Apple or Google to be transcribed.
 * - **local** — Whisper running in this tab through transformers.js. The audio
 *   never leaves the machine; the price is a one-off model download and
 *   slower, less accurate recognition.
 *
 * "Local" means the *audio* stays here. The model weights are still fetched
 * once from the Hugging Face CDN and then cached by the browser.
 */
export type SpeechEngine = 'browser' | 'local'
export type SpeechLanguage = 'en' | 'sl'

/**
 * Multilingual, and the smallest that handles Slovenian at all. The
 * English-only variants are better per megabyte but cannot do the other half
 * of what this needs.
 */
const WHISPER_MODEL = 'onnx-community/whisper-base'

const BROWSER_LANG: Record<SpeechLanguage, string> = { en: 'en-US', sl: 'sl-SI' }

export interface SpeechCallbacks {
  onInterim?: (text: string) => void
  onResult: (text: string) => void
  onError: (message: string) => void
  onStateChange?: (listening: boolean) => void
  onProgress?: (percent: number, label: string) => void
}

export function useLocalSpeech() {
  function browserSupported() {
    if (typeof window === 'undefined') return false
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  }

  // ---- Browser engine -----------------------------------------------------

  let recognition: any = null

  function startBrowser(language: SpeechLanguage, callbacks: SpeechCallbacks) {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) {
      callbacks.onError('This browser has no speech recognition.')
      return
    }

    recognition = new Ctor()
    recognition.lang = BROWSER_LANG[language]
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let final = ''
      let pending = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) final += result[0].transcript
        else pending += result[0].transcript
      }
      if (pending) callbacks.onInterim?.(pending)
      if (final) callbacks.onResult(final.trim())
    }

    recognition.onerror = (event: any) => {
      callbacks.onStateChange?.(false)
      callbacks.onError(
        event.error === 'not-allowed'
          ? 'Microphone access was refused. Allow it in the browser and try again.'
          : event.error === 'language-not-supported'
            ? 'This browser cannot recognise that language. Try the local engine.'
            : `Recognition stopped: ${event.error}.`
      )
    }

    recognition.onend = () => callbacks.onStateChange?.(false)

    callbacks.onStateChange?.(true)
    try {
      recognition.start()
    } catch {
      callbacks.onStateChange?.(false)
    }
  }

  function stopBrowser() {
    recognition?.stop()
    recognition = null
  }

  // ---- Local engine -------------------------------------------------------

  let transcriber: any = null
  let mediaRecorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let stream: MediaStream | null = null

  /** Loaded once per tab; the weights themselves are cached by the browser. */
  async function loadModel(onProgress?: SpeechCallbacks['onProgress']) {
    if (transcriber) {
      return transcriber
    }

    /*
     * Guarded so the server build drops this branch entirely. Without the
     * guard Nitro traces the import, ships transformers.js and onnxruntime
     * into the serverless function, and the bundle goes from 18 MB to over
     * 220 MB — within sight of Vercel's 250 MB limit, for code that only ever
     * runs in a browser tab.
     */
    if (!import.meta.client) {
      throw new Error('The local recogniser only runs in the browser.')
    }

    const { pipeline } = await import('@huggingface/transformers')

    transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      dtype: 'q8',
      progress_callback: (item: any) => {
        if (item.status === 'progress' && typeof item.progress === 'number') {
          onProgress?.(Math.round(item.progress), `Downloading ${item.file || 'model'}`)
        } else if (item.status === 'ready') {
          onProgress?.(100, 'Model ready')
        }
      }
    })

    return transcriber
  }

  /** Whisper wants 16 kHz mono float samples, not a compressed blob. */
  async function toMonoPcm(blob: Blob) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    const context = new Ctx({ sampleRate: 16000 })

    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer())
      if (decoded.numberOfChannels === 1) {
        return decoded.getChannelData(0)
      }

      const left = decoded.getChannelData(0)
      const right = decoded.getChannelData(1)
      const merged = new Float32Array(left.length)
      for (let index = 0; index < left.length; index += 1) {
        merged[index] = (left[index]! + right[index]!) / 2
      }
      return merged
    } finally {
      await context.close()
    }
  }

  async function startLocal(language: SpeechLanguage, callbacks: SpeechCallbacks) {
    try {
      callbacks.onProgress?.(0, 'Loading the recogniser')
      await loadModel(callbacks.onProgress)

      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      mediaRecorder = new MediaRecorder(stream)

      mediaRecorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        stream?.getTracks().forEach(track => track.stop())
        stream = null
        callbacks.onStateChange?.(false)

        if (!chunks.length) {
          callbacks.onError('No audio was captured.')
          return
        }

        try {
          callbacks.onProgress?.(0, 'Transcribing')
          const samples = await toMonoPcm(new Blob(chunks, { type: chunks[0]!.type }))
          const output = await transcriber(samples, { language, task: 'transcribe' })
          const text = String(output?.text || '').trim()

          if (text) callbacks.onResult(text)
          else callbacks.onError('Nothing recognisable was said.')
        } catch (error) {
          callbacks.onError(
            error instanceof Error ? `Could not transcribe: ${error.message}` : 'Could not transcribe.'
          )
        } finally {
          callbacks.onProgress?.(100, '')
        }
      }

      mediaRecorder.start()
      callbacks.onStateChange?.(true)
    } catch (error) {
      callbacks.onStateChange?.(false)
      callbacks.onError(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in the browser and try again.'
          : error instanceof Error
            ? `Could not start: ${error.message}`
            : 'Could not start the local recogniser.'
      )
    }
  }

  function stopLocal() {
    if (mediaRecorder?.state === 'recording') {
      // Transcription happens in onstop, once the whole clip is in hand.
      mediaRecorder.stop()
    }
    mediaRecorder = null
  }

  return {
    browserSupported,
    start(engine: SpeechEngine, language: SpeechLanguage, callbacks: SpeechCallbacks) {
      return engine === 'local' ? startLocal(language, callbacks) : startBrowser(language, callbacks)
    },
    stop(engine: SpeechEngine) {
      if (engine === 'local') stopLocal()
      else stopBrowser()
    }
  }
}
