import { describe, expect, it } from 'vitest';
import { normalizeForSpeech } from './textNormalizer.js';

describe('normalizeForSpeech', () => {
  it('reads IP addresses digit by digit with "punto"', () => {
    expect(normalizeForSpeech('La IP es 192.168.1.10')).toBe('La IP es 192 punto 168 punto 1 punto 10');
  });

  it('reads emails with "arroba" and "punto"', () => {
    expect(normalizeForSpeech('felipe@deportivox.cl')).toBe('felipe arroba deportivox punto cl');
  });

  it('replaces URLs with a spoken placeholder', () => {
    expect(normalizeForSpeech('Mira https://example.com/docs')).toBe('Mira un enlace web');
  });

  it('reads Windows paths as a sequence of segments', () => {
    expect(normalizeForSpeech('C:\\repositorio\\alfred')).toBe('unidad C, repositorio , luego alfred');
  });

  it('reads Linux paths as a sequence of segments', () => {
    expect(normalizeForSpeech('revisa /usr/local/bin')).toBe('revisa ruta usr, luego local, luego bin');
  });

  it('reads Chilean RUT with "guion" and spelled digits', () => {
    expect(normalizeForSpeech('RUT 12.345.678-9')).toBe('RUT rut 1 2 3 4 5 6 7 8 guion 9');
  });

  it('reads percentages naturally', () => {
    expect(normalizeForSpeech('subio 12.5%')).toBe('subio 12 coma 5 por ciento');
  });

  it('reads hours with "en punto" or "con minutos"', () => {
    expect(normalizeForSpeech('Nos vemos a las 14:30')).toBe('Nos vemos a las las 14 con 30 minutos');
  });

  it('reads dates with month names', () => {
    expect(normalizeForSpeech('El 20/07/2026 es la fecha')).toBe('El 20 de julio de 2026 es la fecha');
  });

  it('spells out common technical acronyms', () => {
    expect(normalizeForSpeech('Revisa la API')).toBe('Revisa la A P I');
  });

  it('summarizes large code blocks instead of reading them fully', () => {
    const withCode = 'Aqui esta:\n```js\nconst a = 1;\nconst b = 2;\n```\nListo.';
    expect(normalizeForSpeech(withCode)).toBe('Aqui esta: bloque de codigo omitido. Listo.');
  });

  it('leaves plain conversational text untouched', () => {
    expect(normalizeForSpeech('Hola Felipe, como estas hoy')).toBe('Hola Felipe, como estas hoy');
  });
});
