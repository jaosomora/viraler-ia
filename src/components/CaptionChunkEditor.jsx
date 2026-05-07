import React from 'react';

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

/**
 * Lista de chunks de subtítulos editables. Cada uno se puede:
 *  - editar el texto (override.text)
 *  - ocultar (override.hidden)
 *  - resetear al texto original
 *
 * El estado vive en el draft del padre como `caption_overrides`: [{idx, text, hidden}].
 * Solo guardamos overrides que difieren del original o que ocultan; lo demás se omite.
 */
const CaptionChunkEditor = ({ chunks, overrides, onChange, onSeek }) => {
  const ovMap = new Map((overrides || []).map(o => [o.idx, o]));

  const update = (idx, patch) => {
    const next = new Map(ovMap);
    const cur = next.get(idx) || { idx };
    const merged = { ...cur, ...patch };
    if (merged.text === undefined && !merged.hidden) next.delete(idx);
    else next.set(idx, merged);
    onChange(Array.from(next.values()));
  };

  const reset = (idx) => {
    const next = new Map(ovMap);
    next.delete(idx);
    onChange(Array.from(next.values()));
  };

  if (!chunks || chunks.length === 0) {
    return (
      <div className="text-[11px] text-gray-500 dark:text-gray-400 italic px-3 py-4">
        Aún no hay subtítulos generados para este clip.
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
      {chunks.map(c => {
        const ov = ovMap.get(c.idx);
        const text = ov?.text !== undefined ? ov.text : c.text;
        const isEdited = ov?.text !== undefined && ov.text !== c.original_text;
        const isHidden = !!ov?.hidden;

        return (
          <div
            key={c.idx}
            className={`flex items-center gap-2 group rounded-md px-2 py-1.5 border transition ${
              isHidden
                ? 'opacity-40 bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800'
                : isEdited
                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50'
                  : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <button
              type="button"
              onClick={() => onSeek?.(c.start)}
              title="Ir a este momento del video"
              className="text-[10px] font-mono text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 px-1 py-0.5 shrink-0 tabular-nums"
            >
              {fmt(c.start)}
            </button>
            <input
              type="text"
              value={text}
              onChange={e => update(c.idx, { text: e.target.value })}
              disabled={isHidden}
              className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-gray-900 dark:text-white px-1 disabled:line-through"
            />
            {isEdited && !isHidden && (
              <button
                type="button"
                onClick={() => reset(c.idx)}
                title="Restablecer al texto original"
                className="text-[10px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100"
              >
                ↺
              </button>
            )}
            <button
              type="button"
              onClick={() => update(c.idx, { hidden: !isHidden })}
              title={isHidden ? 'Mostrar este subtítulo' : 'Ocultar este subtítulo'}
              className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                isHidden
                  ? 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  : 'text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
              }`}
            >
              {isHidden ? '👁' : '🚫'}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default CaptionChunkEditor;
