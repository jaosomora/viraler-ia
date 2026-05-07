import React, { useState } from 'react';
import { useClips } from '../context/ClipsContext';

const scoreClass = (s) => {
  if (s >= 80) return 'bg-purple-500 text-white';
  if (s >= 70) return 'bg-amber-500 text-gray-900';
  return 'bg-gray-500 text-white';
};

const ClipCard = ({ clip, onEdit }) => {
  const { downloadClip } = useClips();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolution, setResolution] = useState('1080');

  const dur = Math.round(clip.end_seconds - clip.start_seconds);
  const durStr = `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}`;

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

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-purple-300 dark:hover:border-purple-700 transition group">
      <div className="aspect-[9/16] relative bg-gradient-to-br from-indigo-900 via-purple-700 to-cyan-700">
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold ${scoreClass(clip.virality_score)}`}>
          {clip.virality_score} / 100
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur rounded-md text-xs text-white">{durStr}</div>
        {clip.output_path && (
          <video
            src={`${import.meta.env.MODE === 'development' ? 'http://localhost:3000' : ''}/api/clips/${clip.id}/download?resolution=${clip.output_resolution || '1080'}&token=preview`}
            className="absolute inset-0 w-full h-full object-cover"
            preload="metadata"
            controls
          />
        )}
        {!clip.output_path && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
            <div className="px-3 py-4 text-center">
              <div className="text-3xl font-bold uppercase leading-tight" style={{ fontFamily: 'Anton, sans-serif' }}>
                {clip.hook}
              </div>
              <div className="text-sm mt-2 font-semibold opacity-90">{clip.caption}</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1 line-clamp-1">{clip.title}</h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 italic">"{clip.hook}"</p>

        {clip.post_caption && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Texto sugerido para el post</span>
              <button onClick={handleCopy} className={`text-[10px] font-medium flex items-center gap-1 transition ${copied ? 'text-green-500' : 'text-purple-600 dark:text-purple-400 hover:text-purple-500'}`}>
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">{clip.post_caption}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="720">720p</option>
            <option value="1080">1080p</option>
            <option value="2k">2K</option>
            <option value="4k">4K</option>
          </select>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
          >
            {downloading ? 'Descargando…' : 'Descargar'}
          </button>
          <button
            onClick={() => onEdit(clip)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-xs"
          >
            Editar
          </button>
        </div>
      </div>
    </article>
  );
};

export default ClipCard;
