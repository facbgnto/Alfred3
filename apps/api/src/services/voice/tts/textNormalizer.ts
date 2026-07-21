const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function spellOutChars(value: string, joiner = ' '): string {
  return value.split('').join(joiner);
}

function readDigitsSeparately(value: string): string {
  return value.split('').join(' ');
}

/** Normaliza texto antes de sintetizarlo para que el TTS lo pronuncie de forma entendible. */
export function normalizeForSpeech(input: string): string {
  let text = input;

  // Bloques de codigo: no leer completos, avisar que hay codigo.
  text = text.replace(/```[a-zA-Z]*\n[\s\S]*?```/g, ' bloque de codigo omitido. ');
  text = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    return code.length > 40 ? ' fragmento de codigo. ' : ` ${code} `;
  });

  // JSON / objetos grandes: resumir.
  text = text.replace(/\{[\s\S]{200,}?\}/g, ' un bloque de datos JSON. ');

  // Direcciones IP (antes que numeros decimales, para no confundir el punto).
  text = text.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, (_m, a, b, c, d) => {
    return `${a} punto ${b} punto ${c} punto ${d}`;
  });

  // Correos electronicos.
  text = text.replace(/\b([\w.+-]+)@([\w-]+)\.([\w.-]+)\b/g, (_m, user: string, domain: string, tld: string) => {
    return `${user} arroba ${domain} punto ${tld.replace(/\./g, ' punto ')}`;
  });

  // URLs.
  text = text.replace(/\bhttps?:\/\/[^\s]+/gi, ' un enlace web ');

  // Rutas Windows (C:\repo\alfred).
  text = text.replace(/\b([a-zA-Z]):\\([^\s]*)/g, (_m, drive: string, rest: string) => {
    const spoken = rest.replace(/\\/g, ' , luego ').replace(/\//g, ' , luego ');
    return `unidad ${drive.toUpperCase()}, ${spoken}`;
  });

  // Rutas Linux tipo /usr/local/bin (con al menos 2 segmentos).
  text = text.replace(/(?<=\s|^)(\/[\w.-]+){2,}\/?/g, (match: string) => {
    const parts = match.split('/').filter(Boolean);
    return `ruta ${parts.join(', luego ')}`;
  });

  // Porcentajes.
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s?%/g, (_m, num: string) => `${num.replace('.', ' coma ')} por ciento`);

  // Monedas (CLP, USD, $).
  text = text.replace(/\$\s?(\d[\d.,]*)/g, (_m, amount: string) => `${amount} pesos`);
  text = text.replace(/\b(USD|EUR|CLP)\s?(\d[\d.,]*)/gi, (_m, currency: string, amount: string) => `${amount} ${currency.toUpperCase()}`);

  // RUT chileno (12.345.678-9) tiene prioridad sobre la lectura generica de telefonos,
  // asi que ambos se resuelven en una sola pasada con alternancia.
  text = text.replace(
    /\b(\d{1,2}(?:\.\d{3}){2})-([\dkK])\b|\b(?:\+?\d{1,3}[\s.-]?)?(?:\d[\s.-]?){7,11}\b/g,
    (match: string, rutBody?: string, rutDv?: string) => {
      if (rutBody && rutDv) {
        const digits = rutBody.replace(/\./g, '');
        return `rut ${readDigitsSeparately(digits)} guion ${rutDv.toLowerCase() === 'k' ? 'ka' : rutDv}`;
      }
      const digits = match.replace(/[^\d]/g, '');
      if (digits.length < 8) return match;
      return `numero ${readDigitsSeparately(digits)}`;
    },
  );

  // Horas (14:30, 9:05).
  text = text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_m, hour: string, minute: string) => {
    const h = Number(hour);
    const m = Number(minute);
    if (m === 0) return `las ${h} en punto`;
    return `las ${h} con ${m} minutos`;
  });

  // Fechas (dd/mm/yyyy o dd-mm-yyyy).
  text = text.replace(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g, (_m, day: string, month: string, year: string) => {
    const monthName = MONTHS[Number(month) - 1] ?? month;
    return `${Number(day)} de ${monthName} de ${year}`;
  });

  // Siglas en mayusculas de 2-5 letras: deletrear si no forman una palabra pronunciable.
  text = text.replace(/\b([A-Z]{2,5})\b/g, (match: string) => {
    if (/^(API|CPU|GPU|RAM|SSD|HTTP|HTML|JSON|SQL|URL|WIFI|USB)$/.test(match)) {
      return spellOutChars(match);
    }
    return match;
  });

  return text.replace(/\s+/g, ' ').trim();
}
