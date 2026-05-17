// api/services/transcribeService.js
// Versión promisificada del flujo de transcripción que devuelve el row id insertado.
// Necesaria para el MCP tool, que necesita devolver el id al cliente para que pueda
// llamar a get_transcription / analyze_ideas después.
//
// El handler REST original (api/transcribeVideo.js) no lo necesita porque devuelve el
// transcript completo en el mismo response. No tocamos ese handler.

import { extractAudio } from '../extractAudio.js';
import { transcribeAudio } from '../transcribeAudio.js';
import { isValidUrl } from '../utils/platformDetector.js';
import { calculateCost } from '../utils/usageTrackerSQLite.js';
import db from '../database/schema.js';

function detectPlatform(url) {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com/shorts')) return 'youtube-shorts';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  return 'unknown';
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

async function bumpUsageStats(durationInSeconds, estimatedCost) {
  const today = new Date().toISOString().split('T')[0];
  const row = await dbGet('SELECT id FROM usage_stats WHERE date = ?', [today]);
  if (row) {
    await dbRun(
      `UPDATE usage_stats SET transcriptions = transcriptions + 1,
          audio_minutes = audio_minutes + ?, cost = cost + ? WHERE id = ?`,
      [durationInSeconds / 60, estimatedCost, row.id]
    );
  } else {
    await dbRun(
      `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost) VALUES (?, 1, ?, ?)`,
      [today, durationInSeconds / 60, estimatedCost]
    );
  }
}

export async function runTranscription(url, userId) {
  if (!url || !isValidUrl(url)) {
    throw new Error('URL inválida o no compatible. Soportamos YouTube, Instagram Reels, TikTok y Facebook.');
  }

  const { buffer, metadata } = await extractAudio(url);
  metadata.url = url;
  metadata.platform = detectPlatform(url);

  const { text, language } = await transcribeAudio(buffer, metadata);
  metadata.transcript = text;
  metadata.language = language;

  const durationInSeconds = metadata.duration || (buffer.byteLength / 16000);
  const estimatedCost = calculateCost(durationInSeconds);

  const hasMetrics = [
    metadata.viewCount, metadata.likeCount, metadata.commentCount,
    metadata.shareCount, metadata.uploaderHandle, metadata.uploadDate,
    metadata.description, metadata.hashtags
  ].some((v) => v !== null && v !== undefined);
  const metricsCapturedAt = hasMetrics ? new Date().toISOString() : null;
  const hashtagsJson = Array.isArray(metadata.hashtags) && metadata.hashtags.length > 0
    ? JSON.stringify(metadata.hashtags) : null;

  const { lastID } = await dbRun(
    `INSERT INTO transcriptions (
      url, platform, title, transcript, duration, channel, thumbnail, language, user_id,
      view_count, like_count, comment_count, share_count,
      uploader_handle, uploader_url, upload_date, description, hashtags, metrics_captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      metadata.url, metadata.platform, metadata.title || 'Sin título',
      text, metadata.duration || 0, metadata.channel || 'Desconocido',
      metadata.thumbnail || null, language || 'es', userId,
      metadata.viewCount ?? null, metadata.likeCount ?? null,
      metadata.commentCount ?? null, metadata.shareCount ?? null,
      metadata.uploaderHandle ?? null, metadata.uploaderUrl ?? null,
      metadata.uploadDate ?? null, metadata.description ?? null,
      hashtagsJson, metricsCapturedAt,
    ]
  );

  await bumpUsageStats(durationInSeconds, estimatedCost).catch(e =>
    console.error('[transcribeService] usage_stats update failed:', e.message)
  );

  return {
    transcriptionId: lastID,
    url,
    platform: metadata.platform,
    title: metadata.title,
    duration: metadata.duration,
    channel: metadata.channel,
    language,
    transcript: text,
    transcriptLength: text.length,
    estimatedCostUsd: estimatedCost,
    metadata: {
      viewCount: metadata.viewCount ?? null,
      likeCount: metadata.likeCount ?? null,
      commentCount: metadata.commentCount ?? null,
      shareCount: metadata.shareCount ?? null,
      uploaderHandle: metadata.uploaderHandle ?? null,
      uploadDate: metadata.uploadDate ?? null,
      hashtags: metadata.hashtags ?? null,
    },
  };
}
