import { useEffect, useRef, useState } from 'react';
import type { MicVAD } from '@ricky0123/vad-web';
import { processVoiceAudio } from '../services/voiceApi';
import type { VoiceState } from '../types/voice';

export type AudioDevice = {
  deviceId: string;
  label: string;
};

type RecorderStatus = 'idle' | 'waiting-speech' | 'recording' | 'processing' | 'error';

// Umbrales normales (Silero VAD, 0-1). El modelo ya distingue voz de ruido de fondo
// bastante mejor que un umbral de energia, asi que estos pueden quedar mas cerca de
// los valores por defecto de la libreria.
const normalPositiveThreshold = 0.5;
const normalNegativeThreshold = 0.35;
// Mientras Alfred habla, la propia voz puede filtrarse por los parlantes hacia el
// microfono pese al echo cancellation del navegador: se exige mucha mas confianza
// del modelo para considerarlo una interrupcion real del usuario.
const bargeInPositiveThreshold = 0.82;
const bargeInNegativeThreshold = 0.6;

type VoiceResult = { text: string; response: string };

type VoiceRecorderOptions = {
  /** Conversacion continua: el microfono se mantiene abierto entre turnos. */
  continuous: boolean;
  /** Estado actual de Alfred, usado para elevar el umbral de voz durante barge-in. */
  alfredState: VoiceState;
  /** Si esta activo, hablar mientras Alfred responde corta su audio e inicia un turno nuevo. */
  bargeInEnabled: boolean;
  onBargeIn: () => void;
};

function encodeWav16k(samples: Float32Array): Blob {
  const sampleRate = 16000;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    offset += value.length;
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + samples.length * 2, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * 2, true); offset += 4;
  view.setUint16(offset, 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, samples.length * 2, true); offset += 4;

  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function useVoiceRecorder(onResult: (result: VoiceResult) => void, options: VoiceRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState('');

  const vadRef = useRef<MicVAD | null>(null);
  const creatingRef = useRef<Promise<MicVAD> | null>(null);
  const bargeInFiredRef = useRef(false);

  const selectedDeviceIdRef = useRef(selectedDeviceId);
  selectedDeviceIdRef.current = selectedDeviceId;
  const continuousRef = useRef(options.continuous);
  continuousRef.current = options.continuous;
  const alfredStateRef = useRef(options.alfredState);
  alfredStateRef.current = options.alfredState;
  const bargeInEnabledRef = useRef(options.bargeInEnabled);
  bargeInEnabledRef.current = options.bargeInEnabled;
  const onBargeInRef = useRef(options.onBargeIn);
  onBargeInRef.current = options.onBargeIn;

  async function loadDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const items = await navigator.mediaDevices.enumerateDevices();
    const microphones = items
      .filter(item => item.kind === 'audioinput')
      .map((item, index) => ({
        deviceId: item.deviceId,
        label: item.label || `Microfono ${index + 1}`,
      }));
    setDevices(microphones);
    const stillPresent = microphones.some(device => device.deviceId === selectedDeviceIdRef.current);
    if ((!selectedDeviceIdRef.current || !stillPresent) && microphones[0]) {
      setSelectedDeviceId(microphones[0].deviceId);
    }
  }

  useEffect(() => {
    void loadDevices();
    if (!navigator.mediaDevices?.addEventListener) return;
    const handleChange = () => void loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', handleChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleChange);
  }, []);

  async function getMicStream(): Promise<MediaStream> {
    void loadDevices();
    const deviceId = selectedDeviceIdRef.current;

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      // El dispositivo elegido (guardado de una sesion anterior, o enumerado antes de
      // dar permiso de microfono) puede ya no existir: se desconecto, cambio de
      // nombre, o el id capturado pre-permiso era un placeholder invalido. Reintenta
      // una vez sin fijar deviceId, dejando que el navegador use el default.
      const isDeviceError = err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError');
      if (!deviceId || !isDeviceError) throw err;

      setSelectedDeviceId('');
      return navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    }
  }

  async function handleSpeechEnd(audio: Float32Array) {
    setProcessing(true);
    setStatus('processing');
    try {
      onResult(await processVoiceAudio(encodeWav16k(audio)));
      setStatus(continuousRef.current ? 'waiting-speech' : 'idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude procesar el audio.');
      setStatus('error');
    } finally {
      setProcessing(false);
      if (!continuousRef.current) {
        await vadRef.current?.pause().catch(() => undefined);
        setRecording(false);
      }
    }
  }

  function ensureVad(): Promise<MicVAD> {
    if (vadRef.current) return Promise.resolve(vadRef.current);
    if (creatingRef.current) return creatingRef.current;

    const creation = (async () => {
      // Import dinamico: ~430kB de onnxruntime-web + vad-web solo se descargan cuando
      // el usuario realmente activa la escucha, no en la carga inicial de la pagina.
      const { MicVAD } = await import('@ricky0123/vad-web');
      const instance = await MicVAD.new({
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/ort/',
        model: 'legacy',
        ortConfig: ort => {
          // Sin esto, onnxruntime-web intenta usar hilos via SharedArrayBuffer, que
          // requiere headers COOP/COEP que el dev server no manda por defecto.
          ort.env.wasm.numThreads = 1;
          // Sin esto, onnxruntime-web ejecuta el modelo en un Web Worker que hace un
          // import() dinamico de su propio script wasm; Vite bloquea ese import()
          // cuando el archivo vive en public/ (solo se puede referenciar como URL
          // estatica, no importar como modulo). Con proxy:false corre en el hilo
          // principal y carga el .wasm por fetch en vez de import().
          ort.env.wasm.proxy = false;
          ort.env.logLevel = 'error';
        },
        getStream: getMicStream,
        resumeStream: getMicStream,
        submitUserSpeechOnPause: true,
        positiveSpeechThreshold: normalPositiveThreshold,
        negativeSpeechThreshold: normalNegativeThreshold,
        minSpeechMs: 250,
        preSpeechPadMs: 300,
        redemptionMs: 700,
        startOnLoad: true,
        onFrameProcessed: probs => setAudioLevel(probs.isSpeech),
        onSpeechStart: () => {
          setStatus('recording');
          if (alfredStateRef.current === 'speaking' && bargeInEnabledRef.current && !bargeInFiredRef.current) {
            bargeInFiredRef.current = true;
            onBargeInRef.current();
          }
        },
        onSpeechEnd: audio => void handleSpeechEnd(audio),
        onVADMisfire: () => setStatus(continuousRef.current ? 'waiting-speech' : 'idle'),
      });
      vadRef.current = instance;
      return instance;
    })();

    creatingRef.current = creation;
    return creation.finally(() => {
      creatingRef.current = null;
    });
  }

  // Mientras Alfred habla, sube el umbral de deteccion de voz (barge-in real);
  // al dejar de hablar, vuelve al umbral normal y rearma el guard de disparo unico.
  useEffect(() => {
    const vad = vadRef.current;
    if (!vad) return;
    if (options.alfredState === 'speaking' && options.bargeInEnabled) {
      vad.setOptions({ positiveSpeechThreshold: bargeInPositiveThreshold, negativeSpeechThreshold: bargeInNegativeThreshold });
    } else {
      bargeInFiredRef.current = false;
      vad.setOptions({ positiveSpeechThreshold: normalPositiveThreshold, negativeSpeechThreshold: normalNegativeThreshold });
    }
  }, [options.alfredState, options.bargeInEnabled]);

  useEffect(() => {
    if (!options.continuous && vadRef.current) {
      void vadRef.current.pause().then(() => setRecording(false)).catch(() => undefined);
      setStatus('idle');
    }
    // Solo reacciona al cambio del flag de continuidad, no a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.continuous]);

  useEffect(() => {
    return () => {
      void vadRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  async function start() {
    if (recording || processing) return;
    setError('');
    setStatus('waiting-speech');
    try {
      const vad = await ensureVad();
      await vad.start();
      setRecording(true);
      setStatus('waiting-speech');
    } catch (err) {
      setRecording(false);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'No pude iniciar la deteccion de voz.');
    }
  }

  /** Corta la escucha ahora: si habia un turno en curso, se envia igual (submitUserSpeechOnPause). */
  async function stop() {
    const vad = vadRef.current;
    if (!vad) return;
    await vad.pause().catch(() => undefined);
    if (continuousRef.current) {
      await vad.start().catch(() => undefined);
    } else {
      setRecording(false);
      setStatus('idle');
    }
  }

  return {
    recording,
    processing,
    status,
    audioLevel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    error,
    start,
    stop,
  };
}
