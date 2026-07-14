import React, { useState } from 'react';
import { useClips } from '../context/ClipsContext';
import VideoPreview from './VideoPreview';
import { FONT_FAMILY } from './LiveCaptionOverlay';
import { useToast } from './ui/feedback';

const scoreChipClass = (s) => {
  if (s >= 80) return 'chip chip-accent';
  if (s >= 70) return 'chip chip-warn';
  return 'chip chip-neutral';
};

const renderCaptionWithKeywords = (caption, keywords, color) => {
  if (!caption) return null;
  if (!keywords?.length) return caption;
  // Crea regex que busque cualquiera de las keywords (case-insensitive, palabra completa)
  const escaped = keywords.filter(Boolean).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!escaped) return caption;
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = caption.split(re);
  return parts.map((p, i) => {
    const match = keywords.some(k => k && k.toLowerCase() === p.toLowerCase());
    return match
      ? <span key={i} style={{ color, fontWeight: 800, fontFamily: "'Montserrat', sans-serif" }}>{p}</span>
      : <span key={i}>{p}</span>;
  });
};

const ClipCard = ({ clip, onEdit }) => {
  const { downloadClip } = useClips();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const aspect = clip.aspect_ratio || '9:16';
  const aspectClass = aspect === '1:1' ? 'aspect-square' : aspect === '4:5' ? 'aspect-[4/5]' : 'aspect-[9/16]';

  const dur = Math.round(clip.end_seconds - clip.start_seconds);
  const durStr = `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}`;
  const resolution = clip.output_resolution || '1080';

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadClip(clip, resolution); } catch (e) { toast(e.message, { type: 'danger' }); }
    setDownloading(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clip.post_caption || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const hookFont = FONT_FAMILY[clip.font_hook] || FONT_FAMILY.Anton;

  // Misma lógica que el editor: bottom % en función de sub_position, y text-shadow combinando outline + shadow
  const subPositionPercent = ((Math.max(40, Math.min(90, clip.sub_position ?? 68)) - 40) / 50) * 47 + 10;
  const textShadowCSS = (() => {
    const parts = [];
    const outlineEnabled = clip.outline_enabled === undefined ? 1 : clip.outline_enabled;
    const thickness = clip.outline_thickness ?? 5;
    const shadowOpacity = clip.shadow_opacity ?? 50;
    if (outlineEnabled && thickness > 0) {
      const t = Math.round(thickness * 0.7);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        parts.push(`${dx * t}px ${dy * t}px 0 #000`);
      }
    }
    if (shadowOpacity > 0) parts.push(`0 2px 6px rgba(0,0,0,${(shadowOpacity / 100).toFixed(2)})`);
    return parts.join(', ') || 'none';
  })();
  const cameraIcon = clip.camera_motion === 'zoom-in' ? '🔍' : clip.camera_motion === 'zoom-out' ? '🔎' : '⏸';

  return (
    <article className="card overflow-hidden hover:border-accent/50 dark:hover:border-accent-bright/50 transition-colors group">
      <div className={`${aspectClass} relative bg-ink-950 overflow-hidden`}>
        <div className={`absolute top-3 left-3 z-20 font-mono tabular-nums ${scoreChipClass(clip.virality_score)}`}>
          {clip.virality_score} / 100
        </div>
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
          <span className="px-1.5 py-1 bg-ink-950/70 backdrop-blur rounded-full text-[11px] text-paper" title={`Cámara: ${clip.camera_motion || 'static'}`}>{cameraIcon}</span>
          <span className="px-2 py-1 bg-ink-950/70 backdrop-blur rounded-full text-xs font-mono tabular-nums text-paper">{durStr}</span>
        </div>
        <VideoPreview
          clipId={clip.id}
          resolution={clip.output_resolution || '1080'}
          overlay={
            <div className="absolute left-[8%] right-[8%] text-center text-white pointer-events-none z-10"
                 style={{ bottom: `${subPositionPercent}%` }}>
              <div className="font-black uppercase mb-2" style={{ fontFamily: hookFont, fontSize: '1.5rem', lineHeight: 0.95, textShadow: textShadowCSS }}>
                {clip.hook}
              </div>
              <div className="text-sm font-semibold" style={{ textShadow: textShadowCSS, fontFamily: "'Inter', sans-serif" }}>
                {renderCaptionWithKeywords(clip.caption, clip.keywords, clip.keyword_color || '#FDE047')}
              </div>
            </div>
          }
        />
      </div>

      <div className="p-4">
        <h4 className="font-semibold text-sm mb-1 line-clamp-1">{clip.title}</h4>
        <p className="text-xs text-ink-500 dark:text-ink-400 line-clamp-2 italic">"{clip.hook}"</p>

        {clip.post_caption && (
          <div className="mt-3 bg-ink-100/60 dark:bg-ink-900/60 border hairline rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Texto sugerido para el post</span>
              <button onClick={handleCopy} className={`text-[10px] font-semibold transition-colors ${copied ? 'text-ok dark:text-ok-bright' : 'text-accent dark:text-accent-bright hover:underline'}`}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 leading-relaxed line-clamp-3">{clip.post_caption}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="btn btn-accent btn-sm flex-1">
            {downloading ? 'Descargando…' : `Descargar ${resolution === '720' ? '720p' : resolution === '1080' ? '1080p' : resolution.toUpperCase()}`}
          </button>
          <button onClick={() => onEdit(clip)}
            className="btn btn-ghost btn-sm">
            Editar
          </button>
        </div>
      </div>
    </article>
  );
};

export default ClipCard;
