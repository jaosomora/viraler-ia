// api/mcp/tools/_videoMetadataFormat.js
// Helper compartido para renderizar la metadata de video en el text-response del MCP,
// con paridad visual a VideoMetadataCard.jsx (UI web). Misma fórmula de engagement.

// Misma fórmula que src/components/VideoMetadataCard.jsx
function formatEngagement(viewCount, likeCount, commentCount) {
  if (!viewCount || viewCount < 1) return null;
  const eng = likeCount ? (likeCount / viewCount) * 100 : null;
  const conv = commentCount ? (commentCount / viewCount) * 100 : null;
  if (eng === null && conv === null) return null;
  const parts = [];
  if (eng !== null) parts.push(`eng. ${eng.toFixed(eng < 1 ? 2 : 1)}%`);
  if (conv !== null) parts.push(`conv. ${conv.toFixed(conv < 1 ? 2 : 1)}%`);
  return parts.join(' · ');
}

// YYYYMMDD de yt-dlp → "10 noviembre 2014"
function formatUploadDate(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return yyyymmdd || null;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10)] || ''} ${y}`.trim();
}

function formatNumber(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// Acepta tanto el shape de runTranscription (camelCase) como una row de DB (snake_case).
function normalize(meta) {
  return {
    viewCount: meta.viewCount ?? meta.view_count ?? null,
    likeCount: meta.likeCount ?? meta.like_count ?? null,
    commentCount: meta.commentCount ?? meta.comment_count ?? null,
    shareCount: meta.shareCount ?? meta.share_count ?? null,
    uploaderHandle: meta.uploaderHandle ?? meta.uploader_handle ?? null,
    uploaderUrl: meta.uploaderUrl ?? meta.uploader_url ?? null,
    uploadDate: meta.uploadDate ?? meta.upload_date ?? null,
    description: meta.description ?? null,
    hashtags: meta.hashtags ?? null,
  };
}

// Devuelve un array de líneas Markdown listas para concatenar con \n.
// Solo incluye lo que tenga valor. Si no hay nada, devuelve [].
export function formatVideoMetadataLines(rawMeta) {
  const m = normalize(rawMeta);
  const lines = [];

  // Autor solo si NO es un id numérico (TikTok devuelve "6760748400905339909" en uploader_handle,
  // mientras que el canal real ya viene como @azurtejada arriba — evitamos duplicar).
  const handleIsNumericId = m.uploaderHandle && /^\d+$/.test(String(m.uploaderHandle));
  if ((m.uploaderHandle && !handleIsNumericId) || m.uploadDate) {
    const bits = [];
    if (m.uploaderHandle && !handleIsNumericId) bits.push(`Autor: ${m.uploaderHandle}`);
    if (m.uploadDate) bits.push(`Publicado: ${formatUploadDate(m.uploadDate)}`);
    lines.push(bits.join(' · '));
  }
  if (m.uploaderUrl) lines.push(`Perfil: ${m.uploaderUrl}`);

  // Engagement raw + rates calculados con la misma fórmula que la UI.
  const engagementParts = [];
  if (m.viewCount != null) engagementParts.push(`👁 ${formatNumber(m.viewCount)} vistas`);
  if (m.likeCount != null) engagementParts.push(`❤️ ${formatNumber(m.likeCount)}`);
  if (m.commentCount != null) engagementParts.push(`💬 ${formatNumber(m.commentCount)}`);
  if (m.shareCount != null) engagementParts.push(`🔁 ${formatNumber(m.shareCount)}`);
  if (engagementParts.length > 0) lines.push(engagementParts.join(' · '));

  const rates = formatEngagement(m.viewCount, m.likeCount, m.commentCount);
  if (rates) lines.push(rates);

  // Hashtags como chips
  let tagList = m.hashtags;
  if (typeof tagList === 'string') { try { tagList = JSON.parse(tagList); } catch { tagList = null; } }
  if (Array.isArray(tagList) && tagList.length > 0) {
    lines.push(`Hashtags: ${tagList.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}`);
  }

  // Descripción del creador
  if (m.description && m.description.trim()) {
    lines.push('');
    lines.push('— Descripción del creador —');
    lines.push(m.description.trim());
  }

  return lines;
}
