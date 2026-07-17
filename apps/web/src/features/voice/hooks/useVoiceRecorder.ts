import { useEffect, useRef, useState } from 'react';
import { processVoiceAudio } from '../services/voiceApi';

export type AudioDevice = {
  deviceId: string;
  label: string;
};

type RecorderStatus = 'idle' | 'waiting-speech' | 'recording' | 'processing' | 'error';

const speechThreshold = 0.035;
const silenceMs = 900;
const maxRecordingMs = 30000;
const noSpeechTimeoutMs = 12000;

export function useVoiceRecorder(onResult: (result: { text: string; response: string }) => void) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(16000);
  const speechStartedRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const stoppingRef = useRef(false);

  useEffect(() => {
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
      if (!selectedDeviceId && microphones[0]) setSelectedDeviceId(microphones[0].deviceId);
    }

    void loadDevices();
  }, [selectedDeviceId]);

  function cleanupAudio() {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setAudioLevel(0);
  }

  function stop() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    void finishRecording();
  }

  function encodeWav(chunks: Float32Array[], sampleRate: number) {
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    let offset = 0;

    const writeString = (value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
      offset += value.length;
    };

    writeString('RIFF');
    view.setUint32(offset, 36 + length * 2, true); offset += 4;
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
    view.setUint32(offset, length * 2, true); offset += 4;

    for (const chunk of chunks) {
      for (const sample of chunk) {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function finishRecording() {
    const hadSpeech = speechStartedRef.current;
    const blob = encodeWav(pcmChunksRef.current, sampleRateRef.current);
    recorderRef.current = null;
    cleanupAudio();
    setRecording(false);

    if (!hadSpeech || blob.size <= 44) {
      setStatus('idle');
      stoppingRef.current = false;
      return;
    }

    setProcessing(true);
    setStatus('processing');
    try {
      onResult(await processVoiceAudio(blob));
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude procesar el audio.');
      setStatus('error');
    } finally {
      setProcessing(false);
      stoppingRef.current = false;
    }
  }

  function monitorLevel(analyser: AnalyserNode) {
    const samples = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();
      setAudioLevel(Math.min(1, rms * 6));

      if (rms >= speechThreshold) {
        speechStartedRef.current = true;
        lastSpeechAtRef.current = now;
        setStatus('recording');
      }

      const elapsed = now - startedAtRef.current;
      const silenceElapsed = now - lastSpeechAtRef.current;
      const shouldStopForSilence = speechStartedRef.current && silenceElapsed >= silenceMs;
      const shouldStopForMax = elapsed >= maxRecordingMs;
      const shouldStopNoSpeech = !speechStartedRef.current && elapsed >= noSpeechTimeoutMs;

      if (shouldStopForSilence || shouldStopForMax || shouldStopNoSpeech) {
        stop();
        return;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
  }

  async function start() {
    if (recording || processing || recorderRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('El navegador no permite acceder al microfono.');
      setStatus('error');
      return;
    }

    setError('');
    setStatus('waiting-speech');
    speechStartedRef.current = false;
    stoppingRef.current = false;
    startedAtRef.current = performance.now();
    lastSpeechAtRef.current = startedAtRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      const AudioContextClass = window.AudioContext || (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext no esta disponible en este navegador.');
      }
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      pcmChunksRef.current = [];
      sampleRateRef.current = audioContext.sampleRate;
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      if (audioContext.audioWorklet && 'AudioWorkletNode' in window) {
        await audioContext.audioWorklet.addModule('/audio-recorder-worklet.js');
        const worklet = new AudioWorkletNode(audioContext, 'alfred-recorder-processor');
        worklet.port.onmessage = event => {
          if (stoppingRef.current) return;
          pcmChunksRef.current.push(new Float32Array(event.data as Float32Array));
        };
        source.connect(worklet);
        worklet.connect(silentGain);
        processorRef.current = worklet;
      } else {
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = event => {
          if (stoppingRef.current) return;
          const input = event.inputBuffer.getChannelData(0);
          pcmChunksRef.current.push(new Float32Array(input));
        };
        source.connect(processor);
        processor.connect(silentGain);
        processorRef.current = processor;
      }

      silentGain.connect(audioContext.destination);
      recorderRef.current = {} as MediaRecorder;
      setRecording(true);
      monitorLevel(analyser);
    } catch (err) {
      cleanupAudio();
      setRecording(false);
      setProcessing(false);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'No pude abrir el microfono.');
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
