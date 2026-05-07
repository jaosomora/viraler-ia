// api/clips/subtitleGenerator.js
// Genera archivos .ass (Advanced SubStation) estilo IG: hook grande con fuente impacto + caption con keywords destacadas.

// Catálogo de fuentes soportadas (todas Google Fonts, libres, empaquetadas en assets/fonts/)
export const FONT_CATALOG = {
  hook: [
    { id: 'Anton', name: 'Anton', recommended: true },
    { id: 'BebasNeue', name: 'Bebas Neue', familyName: 'Bebas Neue' },
    { id: 'LeagueSpartan', name: 'League Spartan ExtraBold', familyName: 'League Spartan', weight: 800 },
    { id: 'MontserratBlack', name: 'Montserrat Black', familyName: 'Montserrat', weight: 900 },
    { id: 'Oswald', name: 'Oswald Bold', familyName: 'Oswald', weight: 700 },
  ],
  caption: [
    { id: 'InterSemiBold', name: 'Inter SemiBold', familyName: 'Inter', weight: 600, recommended: true },
    { id: 'InterBold', name: 'Inter Bold', familyName: 'Inter', weight: 700 },
    { id: 'MontserratSemiBold', name: 'Montserrat SemiBold', familyName: 'Montserrat', weight: 600 },
  ],
  keyword: [
    { id: 'MontserratBold', name: 'Montserrat Bold', familyName: 'Montserrat', weight: 700, recommended: true },
    { id: 'PoppinsBold', name: 'Poppins Bold', familyName: 'Poppins', weight: 700 },
    { id: 'Anton', name: 'Anton', familyName: 'Anton' },
    { id: 'LeagueSpartanBold', name: 'League Spartan Bold', familyName: 'League Spartan', weight: 700 },
  ],
};

// id → ASS Fontname (con weight inline). En .ass el bold se expresa con \b1.
function fontIdToAss(id, role) {
  const all = [...FONT_CATALOG.hook, ...FONT_CATALOG.caption, ...FONT_CATALOG.keyword];
  const f = all.find(x => x.id === id);
  if (!f) return { name: 'Arial', bold: 1 };
  const family = f.familyName || f.name;
  const bold = (f.weight || 0) >= 600 ? 1 : 0;
  return { name: family, bold };
}

function fmt(s) {
  const cs = Math.floor((s % 1) * 100).toString().padStart(2, '0');
  const t = Math.floor(s);
  const ss = (t % 60).toString().padStart(2, '0');
  const mm = (Math.floor(t / 60) % 60).toString().padStart(2, '0');
  const hh = Math.floor(t / 3600).toString().padStart(1, '0');
  return `${hh}:${mm}:${ss}.${cs}`;
}

// #FDE047 → &H0047E0FD& (BGR + alpha)
function hexToAssColor(hex) {
  const h = hex.replace('#', '');
  const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

/**
 * Genera ASS para un clip.
 * - Línea hook (1 línea, fuente impacto, posición central-superior del bloque)
 * - Línea caption (debajo, más pequeño, con keywords pintadas en color)
 * Las palabras del caption con timestamp dentro del clip aparecen sincronizadas.
 *
 * @param {object} clip — objeto con start_seconds, end_seconds, hook, caption, keywords, fonts, keyword_color, sub_position
 * @param {object} whisperJson — transcript completo con words array
 * @returns {string} ass file content
 */
export function buildAssForClip(clip, whisperJson) {
  const { start_seconds, end_seconds, hook = '', caption = '', keywords = [], sub_position = 68 } = clip;
  const fontHook = fontIdToAss(clip.font_hook || 'Anton', 'hook');
  const fontCap = fontIdToAss(clip.font_caption || 'InterSemiBold', 'caption');
  const fontKw = fontIdToAss(clip.font_keyword || 'MontserratBold', 'keyword');
  const kwColor = hexToAssColor(clip.keyword_color || '#FDE047');

  // sub_position 0..100 → MarginV en ASS (PlayResY=1920)
  // Default 68 = MarginV ~620 (centrado en zona segura ~y=1300)
  // Range válido: 40 (cerca al fondo, riesgo IG) ... 90 (mitad superior)
  const marginV = Math.round(2000 - (sub_position / 100) * 2000 + 200);
  const marginVHook = Math.max(80, marginV + 180); // hook va arriba del caption

  // Word chunks del caption con timestamps relativos al clip
  const words = (whisperJson.words || []).filter(
    w => w.start >= start_seconds - 0.05 && w.end <= end_seconds + 0.05
  );

  // Si tenemos palabras, generamos caption sincronizado por chunks de 2-3 palabras.
  // Si no, mostramos caption estático durante todo el clip.
  const captionEvents = [];
  if (words.length > 0 && caption) {
    // Buscar las palabras reales del caption dentro del transcript
    // Aproximación: usar las palabras del transcript en el rango de tiempo y agrupar
    const chunks = [];
    let buf = [], chars = 0;
    for (const w of words) {
      const wlen = w.word.trim().length;
      if (buf.length >= 3 || chars + wlen + 1 > 22) {
        if (buf.length) chunks.push(buf);
        buf = []; chars = 0;
      }
      buf.push(w);
      chars += wlen + 1;
    }
    if (buf.length) chunks.push(buf);

    let lastEndedSentence = true;
    for (const chunk of chunks) {
      const start = Math.max(0, chunk[0].start - start_seconds);
      const end = Math.max(start + 0.1, chunk[chunk.length - 1].end - start_seconds);
      let text = chunk.map(c => c.word.trim()).join(' ');
      if (lastEndedSentence) text = text.charAt(0).toUpperCase() + text.slice(1);
      else text = text.charAt(0).toLowerCase() + text.slice(1);
      lastEndedSentence = /[.!?]\s*$/.test(text);
      // Pintar keywords con override de fuente y color
      for (const kw of keywords) {
        if (!kw) continue;
        const re = new RegExp(`\\b(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
        text = text.replace(re, (m) => `{\\fn${fontKw.name}\\b${fontKw.bold}\\1c${kwColor}}${m}{\\r}`);
      }
      captionEvents.push(
        `Dialogue: 0,${fmt(start)},${fmt(end)},Caption,,0,0,0,,${text}`
      );
    }
  } else if (caption) {
    captionEvents.push(
      `Dialogue: 0,${fmt(0)},${fmt(end_seconds - start_seconds)},Caption,,0,0,0,,${caption}`
    );
  }

  // Hook: aparece desde el inicio durante 4 segundos (o todo el clip si es muy corto)
  const hookDuration = Math.min(4, end_seconds - start_seconds);
  const hookEvent = hook
    ? `Dialogue: 0,${fmt(0)},${fmt(hookDuration)},Hook,,0,0,0,,${hook.toUpperCase()}`
    : '';

  return `[Script Info]
Title: AS Clips
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,${fontHook.name},96,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,${fontHook.bold},0,0,0,100,100,0,0,1,6,3,2,80,80,${marginVHook},1
Style: Caption,${fontCap.name},66,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,${fontCap.bold},0,0,0,100,100,0,0,1,5,2,2,80,80,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${hookEvent}
${captionEvents.join('\n')}
`;
}
