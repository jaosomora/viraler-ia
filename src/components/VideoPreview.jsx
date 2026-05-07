import React, { useState, useEffect, useRef } from 'react';

const API_BASE = '/api';

// Reproduce un clip MP4 protegido por Bearer token. Hace fetch del blob completo
// (los clips son cortos, ~5-15MB) y crea un Object URL temporal.
const VideoPreview = ({ clipId, resolution = '1080', overlay, autoPlayOnMount = false }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const load = async () => {
    if (loading || src) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/clips/${clipId}/download?resolution=${resolution}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      setSrc(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoPlayOnMount) load();
    return () => { if (src) URL.revokeObjectURL(src); };
  }, [autoPlayOnMount, clipId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (src) {
    return (
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay
        className="absolute inset-0 w-full h-full object-cover bg-black"
        onError={() => setError('No se pudo reproducir el video')}
      />
    );
  }

  return (
    <>
      {overlay}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); load(); }}
        disabled={loading}
        className="absolute inset-0 flex items-center justify-center hover:bg-black/10 transition cursor-pointer"
      >
        {loading ? (
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
            <svg className="w-6 h-6 text-gray-700 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-white/90 text-gray-900 flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition">
            <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        )}
      </button>
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded">
          {error}
        </div>
      )}
    </>
  );
};

export default VideoPreview;
