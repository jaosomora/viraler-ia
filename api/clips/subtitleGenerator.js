// api/clips/subtitleGenerator.js
// Genera archivos .ass (Advanced SubStation) estilo IG: hook grande con fuente impacto + caption con keywords destacadas.
import { chunkWordsForClip } from './captionsService.js';

// Catálogo de fuentes soportadas (todas Google Fonts, libres, empaquetadas en assets/fonts/).
// `familyName` es el nombre que libass busca en el TTF al hacer burn-in y que el browser
// usa para resolver la fuente cargada vía Google Fonts. `weight` es CSS-style (100..900).
export const FONT_CATALOG = {
  hook: [
    { id: 'Anton', name: 'Anton', familyName: 'Anton', recommended: true },
    { id: 'BebasNeue', name: 'Bebas Neue', familyName: 'Bebas Neue' },
    { id: 'LeagueSpartan', name: 'League Spartan ExtraBold', familyName: 'League Spartan', weight: 800 },
    { id: 'MontserratBlack', name: 'Montserrat Black', familyName: 'Montserrat', weight: 900 },
    { id: 'Oswald', name: 'Oswald Bold', familyName: 'Oswald', weight: 700 },
    { id: 'ArchivoBlack', name: 'Archivo Black', familyName: 'Archivo', weight: 900 },
    { id: 'BowlbyOne', name: 'Bowlby One', familyName: 'Bowlby One' },
    { id: 'PlayfairDisplay', name: 'Playfair Display Bold · serif editorial', familyName: 'Playfair Display', weight: 700 },
    { id: 'PlayfairDisplayItalic', name: 'Playfair Display Italic · serif editorial', familyName: 'Playfair Display', weight: 700, italic: true },
  ],
  caption: [
    // ─── Sans-serif neutras (TED, documental, default seguro) ───
    { id: 'InterSemiBold', name: 'Inter SemiBold · neutra', familyName: 'Inter', weight: 600, recommended: true },
    { id: 'InterRegular', name: 'Inter Regular · neutra', familyName: 'Inter', weight: 400 },
    { id: 'InterMedium', name: 'Inter Medium · neutra', familyName: 'Inter', weight: 500 },
    { id: 'InterBold', name: 'Inter Bold · neutra', familyName: 'Inter', weight: 700 },
    { id: 'RobotoBold', name: 'Roboto Bold · neutra', familyName: 'Roboto', weight: 700 },
    { id: 'RobotoMedium', name: 'Roboto Medium · neutra', familyName: 'Roboto', weight: 500 },
    { id: 'WorkSansSemiBold', name: 'Work Sans SemiBold · neutra', familyName: 'Work Sans', weight: 600 },
    { id: 'WorkSansBold', name: 'Work Sans Bold · neutra', familyName: 'Work Sans', weight: 700 },
    // ─── Sans-serif con personalidad (boutique, editorial moderno) ───
    { id: 'DMSansBold', name: 'DM Sans Bold · moderna', familyName: 'DM Sans', weight: 700 },
    { id: 'PlusJakartaSansBold', name: 'Plus Jakarta Sans Bold · moderna', familyName: 'Plus Jakarta Sans', weight: 700 },
    { id: 'LatoBold', name: 'Lato Bold · cálida', familyName: 'Lato', weight: 700 },
    { id: 'NunitoBold', name: 'Nunito Bold · suave', familyName: 'Nunito', weight: 700 },
    { id: 'MontserratSemiBold', name: 'Montserrat SemiBold · contemporánea', familyName: 'Montserrat', weight: 600 },
    { id: 'MontserratBold', name: 'Montserrat Bold · contemporánea', familyName: 'Montserrat', weight: 700 },
    // ─── Serifs editoriales (revista, libro, elegante) ───
    { id: 'LoraSemiBold', name: 'Lora SemiBold · serif cálida', familyName: 'Lora', weight: 600 },
    { id: 'LoraBold', name: 'Lora Bold · serif cálida', familyName: 'Lora', weight: 700 },
    { id: 'EBGaramondSemiBold', name: 'EB Garamond SemiBold · serif clásica', familyName: 'EB Garamond', weight: 600 },
    { id: 'EBGaramondBold', name: 'EB Garamond Bold · serif clásica', familyName: 'EB Garamond', weight: 700 },
    { id: 'CormorantBold', name: 'Cormorant Garamond Bold · serif refinada', familyName: 'Cormorant Garamond', weight: 700 },
    { id: 'PlayfairDisplay', name: 'Playfair Display Bold · serif editorial', familyName: 'Playfair Display', weight: 700 },
    { id: 'PlayfairDisplayItalic', name: 'Playfair Display Italic · serif editorial', familyName: 'Playfair Display', weight: 700, italic: true },
  ],
  keyword: [
    // ─── Itálicas serif (acentos editoriales con clase) ───
    { id: 'PlayfairDisplayItalic', name: 'Playfair Display Italic · acento editorial', familyName: 'Playfair Display', weight: 700, italic: true, recommended: true },
    { id: 'PlayfairDisplay', name: 'Playfair Display Bold · acento editorial', familyName: 'Playfair Display', weight: 700 },
    { id: 'DMSerifDisplayItalic', name: 'DM Serif Display Italic · acento elegante', familyName: 'DM Serif Display', italic: true },
    { id: 'DMSerifDisplay', name: 'DM Serif Display · acento elegante', familyName: 'DM Serif Display' },
    { id: 'LoraItalic', name: 'Lora Italic Bold · serif suave', familyName: 'Lora', weight: 700, italic: true },
    { id: 'EBGaramondItalic', name: 'EB Garamond Italic Bold · serif clásica', familyName: 'EB Garamond', weight: 700, italic: true },
    { id: 'CormorantItalic', name: 'Cormorant Italic Bold · serif refinada', familyName: 'Cormorant Garamond', weight: 700, italic: true },
    // ─── Sans-serif fuertes (cuando la marca pide más impacto) ───
    { id: 'MontserratBold', name: 'Montserrat Bold · sans fuerte', familyName: 'Montserrat', weight: 700 },
    { id: 'MontserratBlack', name: 'Montserrat Black · sans muy fuerte', familyName: 'Montserrat', weight: 900 },
    { id: 'PoppinsBold', name: 'Poppins Bold · sans fuerte', familyName: 'Poppins', weight: 700 },
    { id: 'Anton', name: 'Anton · condensada impacto', familyName: 'Anton' },
    { id: 'LeagueSpartanBold', name: 'League Spartan Bold · geométrica', familyName: 'League Spartan', weight: 700 },
    { id: 'ArchivoBlack', name: 'Archivo Black · ultra fuerte', familyName: 'Archivo', weight: 900 },
    { id: 'RubikBlack', name: 'Rubik Black · sans fuerte', familyName: 'Rubik', weight: 900 },
    { id: 'RubikBold', name: 'Rubik Bold · sans fuerte', familyName: 'Rubik', weight: 700 },
    // ─── Display (último recurso, cuando la marca lo justifica) ───
    { id: 'BowlbyOne', name: 'Bowlby One · display robusta', familyName: 'Bowlby One' },
    { id: 'LuckiestGuy', name: 'Luckiest Guy · cómic', familyName: 'Luckiest Guy' },
    { id: 'PermanentMarker', name: 'Permanent Marker · marker', familyName: 'Permanent Marker' },
    { id: 'CaveatBold', name: 'Caveat Bold · cursiva manuscrita', familyName: 'Caveat', weight: 700 },
    { id: 'PassionOne', name: 'Passion One Bold · display', familyName: 'Passion One', weight: 700 },
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

// Convierte opacidad 0..100 a alpha ASS hex (00 = opaco, FF = transparente).
function opacityToAssAlpha(opacity) {
  const v = Math.max(0, Math.min(100, opacity ?? 100));
  return Math.round(255 - (v / 100) * 255).toString(16).padStart(2, '0').toUpperCase();
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
  const hookColor = hexToAssColor(clip.hook_color || '#FFFFFF');
  const captionColor = hexToAssColor(clip.caption_color || '#FFFFFF');
  const outlineColor = hexToAssColor(clip.outline_color || '#000000');
  // SecondaryColour del caption: si karaoke activo, color atenuado (palabras no dichas).
  // Si no, valor estándar (no se usa).
  const dim = Math.max(0, Math.min(100, clip.karaoke_dim_opacity ?? 50));
  const dimAlphaHex = Math.round(255 - (dim / 100) * 255).toString(16).padStart(2, '0').toUpperCase();
  const captionColorBgr = (clip.caption_color || '#FFFFFF').replace('#', '');
  const dimColor = `&H${dimAlphaHex}${captionColorBgr.slice(4,6)}${captionColorBgr.slice(2,4)}${captionColorBgr.slice(0,2)}&`.toUpperCase();

  // sub_position 40..90 → MarginV (distancia desde abajo). Más alto = subs MÁS arriba.
  // 40 → MarginV 200 (cerca al borde inferior, zona límite IG)
  // 68 → MarginV ~700 (default, centrado-bajo en zona segura)
  // 90 → MarginV 1100 (a la mitad de la pantalla)
  const sp = Math.max(40, Math.min(90, sub_position));
  const marginV = Math.round(200 + ((sp - 40) / 50) * 900);
  const marginVHook = Math.max(80, marginV + 220);

  // Hook: tamaño fijo 90 por defecto. El usuario puede sobreescribir desde el slider.
  // Antes había sizing adaptativo oculto (90/78/66/58 según largo de texto) que generaba
  // cambios de tamaño inesperados cuando el usuario editaba el hook — rompía la sensación
  // WYSIWYG. Si quieres más grande, mueves el slider y ves el número exacto.
  const hookText = (hook || '').toUpperCase();
  const hookSize = (clip.hook_font_size && clip.hook_font_size > 0) ? clip.hook_font_size : 90;
  const captionSize = clip.caption_font_size && clip.caption_font_size > 0 ? clip.caption_font_size : 58;
  const hookItalic = clip.hook_italic ? 1 : 0;
  const hookUnderline = clip.hook_underline ? 1 : 0;
  const capItalic = clip.caption_italic ? 1 : 0;
  const capUnderline = clip.caption_underline ? 1 : 0;
  const kwItalic = clip.keyword_italic ? 1 : 0;
  const kwUnderline = clip.keyword_underline ? 1 : 0;

  // Highlight de fondo de la keyword (estilo "marker"). En ASS se simula con outline grueso del color
  // de fondo + alpha. Si keyword_bg_color es null → no aplica.
  const kwBgColor = clip.keyword_bg_color || null;
  const kwBgOpacity = clip.keyword_bg_opacity ?? 100;

  // Outline + sombra configurables. outline_thickness 0..10. shadow_opacity 0..100 (alpha invertida).
  const outlineThickness = clip.outline_enabled === 0 ? 0 : Math.max(0, Math.min(10, clip.outline_thickness ?? 5));
  const shadowOpacity = Math.max(0, Math.min(100, clip.shadow_opacity ?? 50));
  // ASS alpha: 00 = opaco, FF = transparente. Convertimos: alpha = 255 - (opacity/100 * 255)
  const shadowAlphaHex = Math.round(255 - (shadowOpacity / 100) * 255).toString(16).padStart(2, '0').toUpperCase();
  const shadowDepth = shadowOpacity > 0 ? 2 : 0;

  // Chunks sincronizados desde captionsService (mismos que ve el frontend en el preview).
  // Aplicamos overrides de DB: si el usuario editó el texto de un chunk o lo ocultó, se respeta.
  const baseChunks = chunkWordsForClip(whisperJson, start_seconds, end_seconds);
  let overrides = [];
  try { overrides = clip.caption_overrides ? JSON.parse(clip.caption_overrides) : []; } catch { overrides = []; }
  const ovMap = new Map(overrides.map(o => [o.idx, o]));

  const captionEvents = [];
  const karaokeEnabled = !!clip.karaoke_enabled;
  if (baseChunks.length > 0) {
    for (const chunk of baseChunks) {
      const ov = ovMap.get(chunk.idx);
      if (ov?.hidden) continue;
      const finalText = ov?.text !== undefined ? ov.text : chunk.text;
      if (!finalText) continue;
      const start = Math.max(0, chunk.start - start_seconds);
      const end = Math.max(start + 0.1, chunk.end - start_seconds);
      // Pop animation: el chunk arranca a 85% de scale + fade-in, crece a 100% en 150ms.
      const popIntro = '{\\fscx85\\fscy85\\t(0,150,\\fscx100\\fscy100)\\fad(80,0)}';

      // Karaoke: cada palabra prefijada con \k<dur_cs>. libass transiciona del SecondaryColour
      // (atenuado, palabra aún no dicha) al PrimaryColour (palabra ya dicha) durante esa duración.
      // Solo se aplica si tenemos words con timestamps Y el chunk no fue editado manualmente
      // (porque las palabras del override podrían no coincidir con las words del transcript).
      let bodyText;
      if (karaokeEnabled && chunk.words?.length && (ov?.text === undefined || ov.text === chunk.original_text || ov.text === chunk.text)) {
        const tokens = finalText.split(/(\s+)/);
        let wordIdx = 0;
        bodyText = tokens.map(tok => {
          if (!tok.trim()) return tok; // espacios pasan tal cual
          const w = chunk.words[wordIdx];
          wordIdx++;
          if (!w) return tok;
          const durCs = Math.max(1, Math.round((w.end - w.start) * 100));
          return `{\\k${durCs}}${tok}`;
        }).join('');
      } else {
        bodyText = finalText;
      }
      let text = popIntro + bodyText;
      // Pintar keywords: fuente + color + italic/underline + (opcional) highlight de fondo via outline grueso.
      for (const kw of keywords) {
        if (!kw) continue;
        const re = new RegExp(`\\b(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
        text = text.replace(re, (m) => {
          const tags = [
            `\\fn${fontKw.name}`,
            `\\b${fontKw.bold}`,
            `\\1c${kwColor}`,
            `\\i${kwItalic}`,
            `\\u${kwUnderline}`,
          ];
          if (kwBgColor) {
            // Outline thick + colored = pseudo-highlight. \3c color, \3a alpha, \bord para padding.
            tags.push(`\\3c${hexToAssColor(kwBgColor)}`);
            tags.push(`\\3a&H${opacityToAssAlpha(kwBgOpacity)}&`);
            tags.push(`\\bord12`);
            tags.push(`\\shad0`);
          }
          // \rCaption restaura los defaults del Style "Caption" sin matar las animaciones (\t, \fad).
          return `{${tags.join('')}}${m}{\\rCaption}`;
        });
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

  // Hook: aparece desde el inicio durante 4 segundos (o todo el clip si es muy corto).
  // Respeta hook_enabled: si es 0, no se quema en el video aunque haya texto.
  const hookEnabled = clip.hook_enabled === undefined ? 1 : clip.hook_enabled;
  const hookDuration = Math.min(4, end_seconds - start_seconds);
  const hookEvent = hook && hookEnabled
    ? `Dialogue: 0,${fmt(0)},${fmt(hookDuration)},Hook,,0,0,0,,${hook.toUpperCase()}`
    : '';

  return `[Script Info]
Title: AS Clips
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,${fontHook.name},${hookSize},${hookColor},&H000000FF,${outlineColor},&H${shadowAlphaHex}000000,${fontHook.bold},${hookItalic},${hookUnderline},0,100,100,0,0,1,${outlineThickness},${shadowDepth},2,86,86,${marginVHook},1
Style: Caption,${fontCap.name},${captionSize},${captionColor},${clip.karaoke_enabled ? dimColor : '&H000000FF'},${outlineColor},&H${shadowAlphaHex}000000,${fontCap.bold},${capItalic},${capUnderline},0,100,100,0,0,1,${Math.max(0, outlineThickness - 1)},${shadowDepth},2,86,86,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${hookEvent}
${captionEvents.join('\n')}
`;
}
