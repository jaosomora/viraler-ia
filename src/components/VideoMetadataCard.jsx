import React, { useState } from 'react';

// Formatea números grandes a "47.2K", "1.2M", etc.
const formatCount = (n) => {
  if (n === null || n === undefined) return null;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, '')}M`;
};

// yt-dlp da upload_date como "YYYYMMDD". Convertimos a "hace X días/meses".
const formatRelativeDate = (yyyymmdd) => {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const date = new Date(y, m, d);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays < 1) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 30) return `hace ${diffDays} días`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
  return `hace ${Math.floor(diffDays / 365)} años`;
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 1) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Cálculo de engagement rates si hay views.
const computeRates = ({ viewCount, likeCount, commentCount }) => {
  if (!viewCount || viewCount < 1) return null;
  const eng = likeCount ? (likeCount / viewCount) * 100 : null;
  const conv = commentCount ? (commentCount / viewCount) * 100 : null;
  if (eng === null && conv === null) return null;
  const parts = [];
  if (eng !== null) parts.push(`eng. ${eng.toFixed(eng < 1 ? 2 : 1)}%`);
  if (conv !== null) parts.push(`conv. ${conv.toFixed(conv < 1 ? 2 : 1)}%`);
  return parts.join(' · ');
};

const VideoMetadataCard = ({ transcription }) => {
  const [descExpanded, setDescExpanded] = useState(false);
  if (!transcription) return null;

  const {
    thumbnail, title, duration, platform,
    viewCount, likeCount, commentCount, shareCount,
    uploaderHandle, uploaderUrl, uploadDate,
    description, hashtags
  } = transcription;

  // Si no hay ni una sola señal de engagement/contexto, no renderizamos nada.
  const hasAnySignal = [
    viewCount, likeCount, commentCount, shareCount,
    uploaderHandle, uploadDate, description,
    hashtags && hashtags.length > 0
  ].some(Boolean);
  if (!hasAnySignal && !thumbnail) return null;

  const relativeDate = formatRelativeDate(uploadDate);
  const durationStr = formatDuration(duration);
  const rates = computeRates({ viewCount, likeCount, commentCount });

  const platformBadge = {
    instagram: { label: 'IG', class: 'bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600' },
    tiktok: { label: 'TT', class: 'bg-black dark:bg-white dark:text-black' },
    youtube: { label: 'YT', class: 'bg-red-600' },
    'youtube-shorts': { label: 'YT', class: 'bg-red-600' },
    facebook: { label: 'FB', class: 'bg-blue-600' },
  }[platform];

  const descIsLong = description && description.length > 140;
  const visibleDesc = descIsLong && !descExpanded
    ? description.slice(0, 140) + '…'
    : description;

  return (
    <div className="mb-4 p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/60 dark:to-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl">
      <div className="flex gap-4">
        {/* Thumbnail */}
        {thumbnail ? (
          <div className="relative shrink-0">
            <img
              src={thumbnail}
              alt=""
              className="w-24 h-32 object-cover rounded-lg bg-gray-200 dark:bg-gray-700"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {platformBadge && (
              <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white dark:ring-gray-800 ${platformBadge.class}`}>
                {platformBadge.label}
              </div>
            )}
          </div>
        ) : null}

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          {/* Línea autor · fecha · duración */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-300 mb-1">
            {uploaderHandle && (
              uploaderUrl ? (
                <a href={uploaderUrl} target="_blank" rel="noopener noreferrer"
                   className="font-semibold text-gray-900 dark:text-white hover:underline text-sm">
                  @{uploaderHandle}
                </a>
              ) : (
                <span className="font-semibold text-gray-900 dark:text-white text-sm">@{uploaderHandle}</span>
              )
            )}
            {relativeDate && <><span className="text-gray-400 dark:text-gray-500">·</span><span>{relativeDate}</span></>}
            {durationStr && <><span className="text-gray-400 dark:text-gray-500">·</span><span>{durationStr}</span></>}
          </div>

          {/* Título */}
          {title && title !== 'Sin título' && (
            <h3 className="text-sm font-medium text-gray-900 dark:text-white leading-snug mb-2 line-clamp-2">
              {title}
            </h3>
          )}

          {/* Métricas */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
            {viewCount !== null && viewCount !== undefined && (
              <span className="inline-flex items-center gap-1 text-gray-800 dark:text-gray-100">
                <span aria-hidden="true">👁</span>
                <span className="font-semibold tabular-nums">{formatCount(viewCount)}</span>
              </span>
            )}
            {likeCount !== null && likeCount !== undefined && (
              <span className="inline-flex items-center gap-1 text-gray-800 dark:text-gray-100">
                <span aria-hidden="true">❤️</span>
                <span className="font-semibold tabular-nums">{formatCount(likeCount)}</span>
              </span>
            )}
            {commentCount !== null && commentCount !== undefined && (
              <span className="inline-flex items-center gap-1 text-gray-800 dark:text-gray-100">
                <span aria-hidden="true">💬</span>
                <span className="font-semibold tabular-nums">{formatCount(commentCount)}</span>
              </span>
            )}
            {shareCount !== null && shareCount !== undefined && (
              <span className="inline-flex items-center gap-1 text-gray-800 dark:text-gray-100">
                <span aria-hidden="true">🔁</span>
                <span className="font-semibold tabular-nums">{formatCount(shareCount)}</span>
              </span>
            )}
            {rates && (
              <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300 text-xs">
                <span aria-hidden="true">📊</span>
                <span>{rates}</span>
              </span>
            )}
          </div>

          {/* Hashtags */}
          {hashtags && hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {hashtags.slice(0, 8).map((tag, i) => (
                <span key={i} className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
              {hashtags.length > 8 && (
                <span className="text-xs text-gray-600 dark:text-gray-400">+{hashtags.length - 8}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description del creador */}
      {description && (
        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Description del creador
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 italic leading-relaxed whitespace-pre-wrap">
            "{visibleDesc}"
          </p>
          {descIsLong && (
            <button
              onClick={() => setDescExpanded((v) => !v)}
              className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline mt-1"
            >
              {descExpanded ? 'Ver menos' : 'Ver completo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoMetadataCard;
