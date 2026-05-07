import React, { useState } from 'react';
import { useClips } from '../context/ClipsContext';
import VideoPreview from './VideoPreview';

const scoreClass = (s) => {
  if (s >= 80) return 'bg-purple-500 text-white';
  if (s >= 70) return 'bg-amber-500 text-gray-900';
  return 'bg-gray-500 text-white';
};

const FONT_FAMILY = {
  Anton: "'Anton', sans-serif",
  BebasNeue: "'Bebas Neue', sans-serif",
  LeagueSpartan: "'League Spartan', sans-serif",
  MontserratBlack: "'Montserrat', sans-serif",
  Oswald: "'Oswald', sans-serif",
  InterSemiBold: "'Inter', sans-serif",
  InterBold: "'Inter', sans-serif",
  MontserratSemiBold: "'Montserrat', sans-serif",
  MontserratBold: "'Montserrat', sans-serif",
  PoppinsBold: "'Poppins', sans-serif",
  LeagueSpartanBold: "'League Spartan', sans-serif",
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
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const aspect = clip.aspect_ratio || '9:16';
  const aspectClass = aspect === '1:1' ? 'aspect-square' : aspect === '4:5' ? 'aspect-[4/5]' : 'aspect-[9/16]';

  const dur = Math.round(clip.end_seconds - clip.start_seconds);
  const durStr = `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}`;
  const resolution = clip.output_resolution || '1080';

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadClip(clip, resolution); } catch (e) { alert(e.message); }
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
    <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-purple-300 dark:hover:border-purple-700 transition group">
      <div className={`${aspectClass} relative bg-gradient-to-br from-indigo-900 via-purple-700 to-cyan-700 overflow-hidden`}>
        <div className={`absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md text-xs font-bold ${scoreClass(clip.virality_score)}`}>
          {clip.virality_score} / 100
        </div>
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
          <span className="px-1.5 py-1 bg-black/60 backdrop-blur rounded text-[11px] text-white" title={`Cámara: ${clip.camera_motion || 'static'}`}>{cameraIcon}</span>
          <span className="px-2 py-1 bg-black/60 backdrop-blur rounded-md text-xs text-white">{durStr}</span>
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
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1 line-clamp-1">{clip.title}</h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 italic">"{clip.hook}"</p>

        {clip.post_caption && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Texto sugerido para el post</span>
              <button onClick={handleCopy} className={`text-[10px] font-medium transition ${copied ? 'text-green-500' : 'text-purple-600 dark:text-purple-400 hover:text-purple-500'}`}>
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">{clip.post_caption}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
            {downloading ? 'Descargando…' : `Descargar ${resolution === '720' ? '720p' : resolution === '1080' ? '1080p' : resolution.toUpperCase()}`}
          </button>
          <button onClick={() => onEdit(clip)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-xs">
            Editar
          </button>
        </div>
      </div>
    </article>
  );
};

export default ClipCard;
