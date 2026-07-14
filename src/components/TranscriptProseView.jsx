import React, { useMemo, useState, useEffect } from 'react';

/**
 * Vista de prosa fluida del transcript del clip (estilo Opus Clip).
 * Cada chunk es un span clickable que salta al timestamp en el video.
 * Las keywords se pintan inline con el color/estilo configurado.
 *
 * No edita el texto (para edición usa el modo Lista). Es una vista de lectura
 * + navegación rápida.
 */
const TranscriptProseView = ({ chunks, draft, onSeek, videoRef }) => {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef?.current;
      if (v) setCurrentTime(v.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  const ovMap = useMemo(() => {
    const m = new Map();
    for (const o of (draft?.caption_overrides || [])) m.set(o.idx, o);
    return m;
  }, [draft?.caption_overrides]);

  const keywords = draft?.keywords || [];
  const kwColor = draft?.keyword_color || '#FDE047';
  const kwBg = draft?.keyword_bg_color
    ? `${draft.keyword_bg_color}${Math.round(((draft.keyword_bg_opacity ?? 100) / 100) * 255).toString(16).padStart(2, '0').toUpperCase()}`
    : null;

  if (!chunks || chunks.length === 0) {
    return (
      <div className="text-[11px] text-ink-400 dark:text-ink-500 italic px-3 py-4">
        Aún no hay subtítulos generados para este clip.
      </div>
    );
  }

  const isKeyword = (token) => {
    const t = token.replace(/[.,!?¿¡]/g, '').toLowerCase();
    return keywords.some(k => k && k.toLowerCase() === t);
  };

  return (
    <div className="text-sm leading-relaxed text-ink-950 dark:text-paper px-1 py-2 max-h-72 overflow-y-auto">
      <p className="text-[10px] text-ink-400 dark:text-ink-500 mb-2">El color de texto se aplica solo en el video; aquí se muestra con contraste para legibilidad.</p>
      {chunks.map(c => {
        const ov = ovMap.get(c.idx);
        const text = ov?.text !== undefined ? ov.text : (c.original_text || c.text);
        const isHidden = !!ov?.hidden;
        const isActive = currentTime >= c.start && currentTime <= c.end + 0.05;

        return (
          <span
            key={c.idx}
            onClick={() => onSeek?.(c.start)}
            title={`Saltar a ${c.start.toFixed(1)}s`}
            className={`cursor-pointer transition rounded px-0.5 ${
              isActive
                ? 'bg-accent-soft dark:bg-accent-deep ring-1 ring-accent/40 dark:ring-accent-bright/40'
                : 'hover:bg-ink-100 dark:hover:bg-ink-800'
            } ${isHidden ? 'line-through opacity-40' : ''}`}
          >
            {text.split(/(\s+)/).map((token, i) => {
              if (!token.trim()) return <span key={i}>{token}</span>;
              if (!isKeyword(token)) return <span key={i}>{token}</span>;
              return (
                <span
                  key={i}
                  style={{
                    color: kwColor,
                    fontWeight: 700,
                    backgroundColor: kwBg || 'transparent',
                    padding: kwBg ? '0 0.15em' : '0',
                    borderRadius: kwBg ? '0.15em' : '0',
                    fontStyle: draft?.keyword_italic ? 'italic' : 'normal',
                    textDecoration: draft?.keyword_underline ? 'underline' : 'none',
                  }}
                >
                  {token}
                </span>
              );
            })}{' '}
          </span>
        );
      })}
    </div>
  );
};

export default TranscriptProseView;
