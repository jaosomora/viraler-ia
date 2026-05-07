// api/clips/whisperService.js
// Transcribe con Whisper-1 devolviendo timestamps por palabra (necesarios para subs IG sincronizados).
import fs from 'fs';

const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_PRICE_PER_MINUTE = 0.006;

export async function transcribeWithTimestamps(audioPath, language = 'es') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const form = new FormData();
  const blob = new Blob([fs.readFileSync(audioPath)], { type: 'audio/mpeg' });
  form.append('file', blob, 'audio.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  form.append('language', language);

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const minutes = (data.duration || 0) / 60;
  const cost = +(minutes * WHISPER_PRICE_PER_MINUTE).toFixed(6);
  return { transcript: data, costUsd: cost };
}
