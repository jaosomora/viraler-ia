import React, { useRef, useCallback, useState, useEffect } from 'react';

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

// Trim slider visual con dos handles arrastrables y "ticks" tipo waveform.
// Props: min, max (segundos absolutos del rango disponible), start, end (segundos actuales),
//        onChange({start, end}), tickCount opcional.
const TrimSlider = ({ min, max, start, end, onChange, tickCount = 18 }) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'start' | 'end' | null

  const range = Math.max(0.1, max - min);
  const startPct = ((start - min) / range) * 100;
  const endPct = ((end - min) / range) * 100;

  const onMouseDown = (which) => (e) => {
    e.preventDefault();
    setDragging(which);
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const value = min + (x / rect.width) * range;
    if (dragging === 'start') {
      const newStart = Math.min(value, end - 1); // mínimo 1s entre handles
      onChange({ start: Math.max(min, newStart), end });
    } else {
      const newEnd = Math.max(value, start + 1);
      onChange({ start, end: Math.min(max, newEnd) });
    }
  }, [dragging, min, max, range, start, end, onChange]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  // Pseudo-waveform: alturas pseudo-aleatorias pero deterministas
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const h = 30 + (seed / 233280) * 70; // 30-100% altura
    return h;
  });

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Recortar inicio y fin</span>
        <span className="font-mono tabular-nums text-ink-950 dark:text-paper">{fmtTime(end - start)}</span>
      </div>
      {/* Timeline: superficie de video, siempre oscura (ver docs/DESIGN.md) */}
      <div ref={trackRef}
        className="relative h-14 bg-ink-950 rounded-xl overflow-hidden cursor-pointer">
        {/* "Waveform" ticks */}
        <div className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none">
          {ticks.map((h, i) => (
            <div key={i} className="w-0.5 bg-paper" style={{ height: `${h}%` }} />
          ))}
        </div>
        {/* Selected range overlay */}
        <div
          className="absolute inset-y-0 bg-accent-bright/25 border-x-2 border-accent-bright"
          style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
        />
        {/* Start handle */}
        <div
          onMouseDown={onMouseDown('start')}
          className={`absolute inset-y-0 w-2 -ml-1 bg-accent-bright hover:bg-[#7FABFF] cursor-ew-resize z-10 ${dragging === 'start' ? 'bg-[#7FABFF]' : ''}`}
          style={{ left: `${startPct}%` }}
          title={fmtTime(start)}
        >
          <div className="absolute inset-y-2 -inset-x-1 rounded-sm bg-accent-bright hover:bg-[#7FABFF]" />
        </div>
        {/* End handle */}
        <div
          onMouseDown={onMouseDown('end')}
          className={`absolute inset-y-0 w-2 -ml-1 bg-accent-bright hover:bg-[#7FABFF] cursor-ew-resize z-10 ${dragging === 'end' ? 'bg-[#7FABFF]' : ''}`}
          style={{ left: `${endPct}%` }}
          title={fmtTime(end)}
        >
          <div className="absolute inset-y-2 -inset-x-1 rounded-sm bg-accent-bright hover:bg-[#7FABFF]" />
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-ink-500 dark:text-ink-400 font-mono tabular-nums">
        <span>{fmtTime(start)} <span className="opacity-60">← arrastra</span></span>
        <span>arrastra → {fmtTime(end)}</span>
      </div>
      <p className="text-[10px] text-ink-400 dark:text-ink-500 font-mono tabular-nums">Rango disponible: {fmtTime(min)} – {fmtTime(max)}</p>
    </div>
  );
};

export default TrimSlider;
