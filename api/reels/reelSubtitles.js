// api/reels/reelSubtitles.js
// Subs estilo IG para Reels Cleaner. Reusa chunkWordsForClip de Clips (mismo agrupamiento)
// y el catálogo de fuentes de subtitleGenerator. Aplica overrides per-chunk (texto editado / oculto).
import { chunkWordsForClip } from '../clips/captionsService.js';
import { FONT_CATALOG } from '../clips/subtitleGenerator.js';

function fmt(s) {
  const cs = Math.floor((s % 1) * 100).toString().padStart(2, '0');
  const t = Math.floor(s);
  const ss = (t % 60).toString().padStart(2, '0');
  const mm = (Math.floor(t / 60) % 60).toString().padStart(2, '0');
  const hh = Math.floor(t / 3600).toString().padStart(1, '0');
  return `${hh}:${mm}:${ss}.${cs}`;
}

function hexToAssColor(hex) {
  const h = (hex || '#FFFFFF').replace('#', '');
  const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

function fontIdToAss(id) {
  const all = [...FONT_CATALOG.caption, ...FONT_CATALOG.hook, ...FONT_CATALOG.keyword];
  const f = all.find(x => x.id === id);
  if (!f) return { name: 'Inter', bold: 1 };
  return { name: f.familyName || f.name, bold: (f.weight || 0) >= 600 ? 1 : 0 };
}

/**
 * Calcula los chunks editables (para mostrar/editar en el frontend).
 * Aplica overrides per-idx: texto editado o hidden.
 *
 * @param {Array} remappedWords — words en la timeline FINAL
 * @param {number} finalDuration
 * @param {Array} overrides — [{idx, text, hidden}]
 * @returns {Array} chunks listos para frontend
 */
export function buildChunks(remappedWords, finalDuration, overrides = []) {
  const baseChunks = chunkWordsForClip({ words: remappedWords }, 0, finalDuration + 0.5);
  const ovMap = new Map((overrides || []).map(o => [o.idx, o]));
  return baseChunks.map(c => {
    const ov = ovMap.get(c.idx);
    return {
      idx: c.idx,
      start: c.start,
      end: c.end,
      original_text: c.text,
      text: ov?.text !== undefined ? ov.text : c.text,
      hidden: !!ov?.hidden,
      edited: ov?.text !== undefined && ov.text !== c.text,
    };
  });
}

/**
 * Construye el .ass con estilo configurable + overrides aplicados.
 */
export function buildReelAss(remappedWords, finalDuration, style = {}, overrides = []) {
  const {
    fontCaption = 'InterSemiBold',
    captionColor = '#FFFFFF',
    outlineColor = '#000000',
    captionFontSize = 62,
    subPosition = 50, // 40..90 (40 = cerca del borde inferior, 90 = mitad pantalla)
    outlineThickness = 4, // 0..10 (0 = sin borde)
  } = style;

  const font = fontIdToAss(fontCaption);
  const colorPrimary = hexToAssColor(captionColor);
  const colorOutline = hexToAssColor(outlineColor);

  const sp = Math.max(40, Math.min(90, subPosition));
  const marginV = Math.round(200 + ((sp - 40) / 50) * 900);

  const chunks = buildChunks(remappedWords, finalDuration, overrides);
  const events = [];
  for (const ch of chunks) {
    if (ch.hidden) continue;
    if (!ch.text) continue;
    const start = Math.max(0, ch.start);
    const end = Math.max(start + 0.1, ch.end);
    const pop = '{\\fscx88\\fscy88\\t(0,140,\\fscx100\\fscy100)\\fad(70,0)}';
    events.push(`Dialogue: 0,${fmt(start)},${fmt(end)},Caption,,0,0,0,,${pop}${ch.text}`);
  }

  return `[Script Info]
Title: AS Reels Cleaner
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${font.name},${captionFontSize},${colorPrimary},&H000000FF,${colorOutline},&H80000000,${font.bold},0,0,0,100,100,0,0,1,${Math.max(0, Math.min(10, outlineThickness))},2,2,86,86,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

/**
 * Catálogo simplificado de fuentes para el selector del frontend.
 * Reusamos FONT_CATALOG.caption. Incluimos familyName + weight + italic para que
 * el overlay HTML (live preview) renderice idéntico a libass.
 */
export const REEL_FONT_OPTIONS = FONT_CATALOG.caption.map(f => ({
  id: f.id,
  name: f.name,
  familyName: f.familyName || f.name,
  weight: f.weight || 400,
  italic: !!f.italic,
  recommended: !!f.recommended,
}));
