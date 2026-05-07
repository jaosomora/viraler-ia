import React, { useEffect, useState, useMemo } from 'react';

// id → CSS font-family. Cada ID fuerza el family name que coincide con el TTF en assets/fonts/
// (lo que carga libass al hacer burn-in) y lo que entrega Google Fonts en el browser.
export const FONT_FAMILY = {
  // Hook
  Anton: "'Anton', sans-serif",
  BebasNeue: "'Bebas Neue', sans-serif",
  LeagueSpartan: "'League Spartan', sans-serif",
  MontserratBlack: "'Montserrat', sans-serif",
  Oswald: "'Oswald', sans-serif",
  ArchivoBlack: "'Archivo', sans-serif",
  BowlbyOne: "'Bowlby One', sans-serif",
  // Caption · sans-serif neutras
  InterRegular: "'Inter', sans-serif",
  InterMedium: "'Inter', sans-serif",
  InterSemiBold: "'Inter', sans-serif",
  InterBold: "'Inter', sans-serif",
  MontserratSemiBold: "'Montserrat', sans-serif",
  MontserratBold: "'Montserrat', sans-serif",
  RobotoBold: "'Roboto', sans-serif",
  RobotoMedium: "'Roboto', sans-serif",
  LatoBold: "'Lato', sans-serif",
  NunitoBold: "'Nunito', sans-serif",
  WorkSansSemiBold: "'Work Sans', sans-serif",
  WorkSansBold: "'Work Sans', sans-serif",
  DMSansBold: "'DM Sans', sans-serif",
  PlusJakartaSansBold: "'Plus Jakarta Sans', sans-serif",
  // Caption + Keyword · serifs editoriales
  LoraSemiBold: "'Lora', serif",
  LoraBold: "'Lora', serif",
  LoraItalic: "'Lora', serif",
  EBGaramondSemiBold: "'EB Garamond', serif",
  EBGaramondBold: "'EB Garamond', serif",
  EBGaramondItalic: "'EB Garamond', serif",
  CormorantBold: "'Cormorant Garamond', serif",
  CormorantItalic: "'Cormorant Garamond', serif",
  PlayfairDisplay: "'Playfair Display', serif",
  PlayfairDisplayItalic: "'Playfair Display', serif",
  DMSerifDisplay: "'DM Serif Display', serif",
  DMSerifDisplayItalic: "'DM Serif Display', serif",
  // Keyword · sans-serif fuertes y display
  PoppinsBold: "'Poppins', sans-serif",
  LeagueSpartanBold: "'League Spartan', sans-serif",
  RubikBlack: "'Rubik', sans-serif",
  RubikBold: "'Rubik', sans-serif",
  LuckiestGuy: "'Luckiest Guy', cursive",
  PermanentMarker: "'Permanent Marker', cursive",
  CaveatBold: "'Caveat', cursive",
  PassionOne: "'Passion One', sans-serif",
};

// Pesos CSS por ID (importante: variable fonts requieren weight explícito en CSS)
export const FONT_WEIGHT = {
  Anton: 400, BebasNeue: 400, LeagueSpartan: 800, MontserratBlack: 900, Oswald: 700,
  ArchivoBlack: 900, BowlbyOne: 400,
  InterRegular: 400, InterMedium: 500, InterSemiBold: 600, InterBold: 700,
  MontserratSemiBold: 600, MontserratBold: 700,
  RobotoBold: 700, RobotoMedium: 500, LatoBold: 700, NunitoBold: 700,
  WorkSansSemiBold: 600, WorkSansBold: 700, DMSansBold: 700, PlusJakartaSansBold: 700,
  LoraSemiBold: 600, LoraBold: 700, LoraItalic: 700,
  EBGaramondSemiBold: 600, EBGaramondBold: 700, EBGaramondItalic: 700,
  CormorantBold: 700, CormorantItalic: 700,
  PlayfairDisplay: 700, PlayfairDisplayItalic: 700,
  DMSerifDisplay: 400, DMSerifDisplayItalic: 400,
  PoppinsBold: 700, LeagueSpartanBold: 700, RubikBlack: 900, RubikBold: 700,
  LuckiestGuy: 400, PermanentMarker: 400, CaveatBold: 700, PassionOne: 700,
};

// IDs cuya fuente es italic-baked. El frontend les aplica font-style: italic además del weight.
export const FONT_ITALIC = new Set([
  'LoraItalic', 'EBGaramondItalic', 'CormorantItalic',
  'PlayfairDisplayItalic', 'DMSerifDisplayItalic',
]);

// Encuentra el chunk activo según el currentTime (relativo al inicio del clip).
function findActiveChunk(chunks, t) {
  for (const c of chunks) {
    if (c.hidden) continue;
    if (t >= c.start && t <= c.end + 0.05) return c;
  }
  return null;
}

/**
 * Capa de subtítulos sincronizada con un <video>. Reemplaza el burn-in de ffmpeg
 * para el preview en el editor: cualquier cambio en draft se ve en tiempo real.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef
 * @param {Array} chunks — [{idx, start, end, text, hidden}], timestamps relativos al clip
 * @param {object} draft — params del editor: hook, font_*, keyword_color, keywords, sub_position, outline_*, shadow_*
 * @param {boolean} hookVisible — si true, muestra el hook arriba del caption durante los primeros 4s
 */
const LiveCaptionOverlay = ({ videoRef, chunks, draft, hookVisible = true }) => {
  const [now, setNow] = useState(0);

  // Polling con rAF: robusto a remounts del <video> (cuando cambian trim/aspect/camera_motion).
  // requestAnimationFrame también da resolución sub-segundo para que el chunk activo
  // cambie con precisión, mejor que el evento timeupdate (que dispara ~4-5 veces/seg).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef?.current;
      if (v && !v.paused && !v.ended) setNow(v.currentTime || 0);
      else if (v) setNow(v.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  const activeChunk = useMemo(() => findActiveChunk(chunks || [], now), [chunks, now]);

  // Hook visible durante los primeros 4s del clip (matching el .ass). Respeta hook_enabled.
  const hookEnabled = draft?.hook_enabled === undefined ? 1 : draft.hook_enabled;
  const showHook = hookVisible && hookEnabled && now < 4 && draft?.hook;

  // sub_position 40..90 → bottom percentage en preview (alineado con backend).
  const sp = Math.max(40, Math.min(90, draft?.sub_position ?? 68));
  const subPositionPercent = ((sp - 40) / 50) * 47 + 10;

  const hookFont = FONT_FAMILY[draft?.font_hook] || FONT_FAMILY.Anton;
  const captionFont = FONT_FAMILY[draft?.font_caption] || FONT_FAMILY.InterSemiBold;
  const keywordFont = FONT_FAMILY[draft?.font_keyword] || FONT_FAMILY.MontserratBold;
  const hookWeight = FONT_WEIGHT[draft?.font_hook] || 700;
  const captionWeight = FONT_WEIGHT[draft?.font_caption] || 600;
  const keywordWeight = FONT_WEIGHT[draft?.font_keyword] || 700;
  // Italic baked-in: aplica además del flag manual italic del clip
  const hookFontItalic = FONT_ITALIC.has(draft?.font_hook);
  const captionFontItalic = FONT_ITALIC.has(draft?.font_caption);
  const keywordFontItalic = FONT_ITALIC.has(draft?.font_keyword);

  const textShadowCSS = useMemo(() => {
    const parts = [];
    const outlineColor = draft?.outline_color || '#000000';
    if (draft?.outline_enabled && draft?.outline_thickness > 0) {
      const t = Math.round(draft.outline_thickness * 0.7);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        parts.push(`${dx * t}px ${dy * t}px 0 ${outlineColor}`);
      }
    }
    if ((draft?.shadow_opacity ?? 0) > 0) {
      const a = (draft.shadow_opacity / 100).toFixed(2);
      parts.push(`0 2px 6px rgba(0,0,0,${a})`);
    }
    return parts.join(', ') || 'none';
  }, [draft?.outline_enabled, draft?.outline_thickness, draft?.shadow_opacity, draft?.outline_color]);

  const kwBg = draft?.keyword_bg_color
    ? `${draft.keyword_bg_color}${Math.round(((draft.keyword_bg_opacity ?? 100) / 100) * 255).toString(16).padStart(2, '0').toUpperCase()}`
    : null;

  // Word-active: dado el currentTime, encuentra la palabra del chunk que se está diciendo ahora.
  const findActiveWord = (chunk, t) => {
    if (!chunk?.words?.length) return null;
    for (const w of chunk.words) {
      if (t >= w.start && t <= w.end + 0.05) return w;
    }
    return null;
  };

  const renderCaptionText = (text, chunk, now) => {
    const keywords = draft?.keywords || [];
    const activeWord = chunk ? findActiveWord(chunk, now) : null;
    const activeText = activeWord?.text?.toLowerCase().replace(/[.,!?¿¡]/g, '') || null;
    let alreadyMatched = false; // pintar solo la primera ocurrencia activa
    return text.split(/(\s+)/).map((token, i) => {
      const trimmed = token.replace(/[.,!?¿¡]/g, '').toLowerCase();
      const isKw = keywords.some(k => k && k.toLowerCase() === trimmed);
      const isActive = !alreadyMatched && trimmed && activeText && trimmed === activeText;
      if (isActive) alreadyMatched = true;
      const activeClass = isActive ? 'as-clips-word-active' : '';
      if (!isKw) return <span key={i} className={activeClass}>{token}</span>;
      return (
        <span
          key={i}
          className={activeClass}
          style={{
            color: draft?.keyword_color || '#FDE047',
            fontWeight: keywordWeight,
            fontFamily: keywordFont,
            fontStyle: (draft?.keyword_italic || keywordFontItalic) ? 'italic' : 'normal',
            textDecoration: draft?.keyword_underline ? 'underline' : 'none',
            backgroundColor: kwBg || 'transparent',
            padding: kwBg ? '0 0.2em' : '0',
            borderRadius: kwBg ? '0.15em' : '0',
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {token}
        </span>
      );
    });
  };

  return (
    <div
      className="absolute left-[8%] right-[8%] text-center text-white pointer-events-none z-10 transition-all duration-150"
      style={{ bottom: `${subPositionPercent}%` }}
    >
      {showHook && (
        <div
          className="font-black uppercase mb-2"
          style={{
            fontFamily: hookFont,
            fontWeight: hookWeight,
            color: draft?.hook_color || '#FFFFFF',
            fontSize: draft?.hook_font_size ? `${draft.hook_font_size * 0.022}rem` : '1.4rem',
            lineHeight: 0.95,
            textShadow: textShadowCSS,
            fontStyle: (draft?.hook_italic || hookFontItalic) ? 'italic' : 'normal',
            textDecoration: draft?.hook_underline ? 'underline' : 'none',
          }}
        >
          {draft.hook}
        </div>
      )}
      {activeChunk && (
        <div
          key={activeChunk.idx}
          className="font-semibold as-clips-chunk-pop"
          style={{
            fontFamily: captionFont,
            fontWeight: captionWeight,
            color: draft?.caption_color || '#FFFFFF',
            fontSize: draft?.caption_font_size ? `${draft.caption_font_size * 0.014}rem` : '0.75rem',
            textShadow: textShadowCSS,
            fontStyle: (draft?.caption_italic || captionFontItalic) ? 'italic' : 'normal',
            textDecoration: draft?.caption_underline ? 'underline' : 'none',
          }}
        >
          {renderCaptionText(activeChunk.text || '', activeChunk, now)}
        </div>
      )}
    </div>
  );
};

export default LiveCaptionOverlay;
