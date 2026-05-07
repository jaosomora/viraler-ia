import React, { useEffect, useState } from 'react';

// Simula la transición fade-in/out en el preview poniendo un overlay negro encima del video
// con opacidad calculada según el currentTime del clip. Solo aplica fades; los zooms ya se
// quemarán en el base.mp4 (preview los muestra al recargar).
const TransitionFader = ({ videoRef, transition }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!transition || transition === 'none' || transition === 'zoom-in' || transition === 'zoom-out' || transition === 'zoom-cross') {
      setOpacity(0);
      return;
    }
    let raf = 0;
    const fadeDur = 0.5;
    const tick = () => {
      const v = videoRef?.current;
      if (v && v.duration) {
        const t = v.currentTime || 0;
        const end = v.duration;
        let o = 0;
        if ((transition === 'fade-in' || transition === 'fade-cross') && t < fadeDur) {
          o = Math.max(o, 1 - (t / fadeDur));
        }
        if ((transition === 'fade-out' || transition === 'fade-cross') && t > end - fadeDur) {
          o = Math.max(o, (t - (end - fadeDur)) / fadeDur);
        }
        setOpacity(Math.min(1, Math.max(0, o)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, transition]);

  if (opacity <= 0) return null;
  return (
    <div
      className="absolute inset-0 bg-black pointer-events-none z-20"
      style={{ opacity }}
    />
  );
};

export default TransitionFader;
