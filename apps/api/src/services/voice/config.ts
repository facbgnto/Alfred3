export type VoiceProfile = {
  id: string;
  name: string;
  language: string;
  region: string;
  gender: 'male' | 'female';
  apparentAge: number;
  tone: string;
  speed: number;
  clarity: 'low' | 'medium' | 'high';
  formality: 'low' | 'medium' | 'high';
  empathy: 'low' | 'medium' | 'high';
  seriousness: number;
  warmth: number;
  smile: number;
  instructions: string;
};

export const alfredVoiceProfile: VoiceProfile = {
  id: 'alfred',
  name: 'Alfred',
  language: 'es',
  region: 'es-CL',
  gender: 'male',
  apparentAge: 38,
  tone: 'grave',
  speed: 0.96,
  clarity: 'high',
  formality: 'medium',
  empathy: 'high',
  seriousness: 0.8,
  warmth: 0.65,
  smile: 0.15,
  instructions:
    'Habla como un asistente inteligente y profesional. Usa una voz masculina adulta, ' +
    'tranquila, segura y cercana. Manten una excelente diccion, pausas naturales y un ' +
    'acento chileno muy sutil. No suenes robotico, exagerado ni teatral.',
};

export type VoiceMode =
  | 'normal'
  | 'conversation'
  | 'programming'
  | 'explanation'
  | 'navigation'
  | 'reminder'
  | 'alarm'
  | 'music'
  | 'error'
  | 'celebration';

export type VoiceModePreset = {
  speed: number;
  minSegmentChars: number;
  maxSegmentChars: number;
  instructions: string;
};

const baseInstructions = alfredVoiceProfile.instructions;

export const voiceModePresets: Record<VoiceMode, VoiceModePreset> = {
  normal: {
    speed: 0.96,
    minSegmentChars: 35,
    maxSegmentChars: 220,
    instructions: baseInstructions,
  },
  conversation: {
    speed: 0.98,
    minSegmentChars: 25,
    maxSegmentChars: 180,
    instructions: `${baseInstructions} Responde de forma fluida y cercana, como en una charla natural.`,
  },
  programming: {
    speed: 1.05,
    minSegmentChars: 40,
    maxSegmentChars: 260,
    instructions: `${baseInstructions} Pronuncia con claridad tecnica comandos, rutas y nombres de codigo, con pausas minimas.`,
  },
  explanation: {
    speed: 0.9,
    minSegmentChars: 45,
    maxSegmentChars: 200,
    instructions: `${baseInstructions} Explica con calma, marcando pausas claras entre ideas, en tono didactico.`,
  },
  navigation: {
    speed: 0.98,
    minSegmentChars: 15,
    maxSegmentChars: 90,
    instructions: `${baseInstructions} Usa frases cortas e instrucciones directas, con volumen estable.`,
  },
  reminder: {
    speed: 0.96,
    minSegmentChars: 25,
    maxSegmentChars: 160,
    instructions: `${baseInstructions} Tono amable, con enfasis claro en hora, fecha y accion a recordar.`,
  },
  alarm: {
    speed: 1.0,
    minSegmentChars: 20,
    maxSegmentChars: 140,
    instructions: `${baseInstructions} Tono firme y con mayor claridad, sin llegar a gritar.`,
  },
  music: {
    speed: 0.98,
    minSegmentChars: 25,
    maxSegmentChars: 180,
    instructions: `${baseInstructions} Tono mas relajado y entretenido.`,
  },
  error: {
    speed: 0.94,
    minSegmentChars: 30,
    maxSegmentChars: 180,
    instructions: `${baseInstructions} Tono calmado, sin culpar al usuario, explicando el problema con brevedad.`,
  },
  celebration: {
    speed: 1.0,
    minSegmentChars: 20,
    maxSegmentChars: 160,
    instructions: `${baseInstructions} Tono positivo, sin caer en la exageracion.`,
  },
};

export const cloudProviderNames = ['openai', 'elevenlabs', 'cartesia', 'kokoro', 'xtts'] as const;
export const localProviderNames = ['piper', 'pyttsx3'] as const;
export type ProviderName = (typeof cloudProviderNames)[number] | (typeof localProviderNames)[number];
