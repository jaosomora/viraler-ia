// api/reels/musicMixer.js
// Mezcla música de fondo sobre un reel ya renderizado (video con subs quemados + voz).
// Estrategia ffmpeg:
//   1) Tomar el audio del reel (voz) y la pista de música.
//   2) Recortar/loopear música a la duración del reel + offset inicial + fades.
//   3) Sidechain compress: la voz dispara compresión sobre la música → la música baja
//      automáticamente cuando se está hablando y sube en los silencios.
//   4) Mezclar voz + música ducked y reemplazar el audio del video sin recodificar el video.

import { spawn } from 'child_process';
import fs from 'fs';

/**
 * Mezcla música sobre un reel.
 *
 * @param {object} opts
 * @param {string} opts.reelVideo       — path al video con voz (output del paso 2, subs ya quemados)
 * @param {string} opts.musicPath       — path al track de música
 * @param {number} opts.reelDuration    — duración del reel en segundos
 * @param {number} opts.volumeDb        — volumen base de la música (-30 a 0)
 * @param {boolean} opts.ducking        — si true, sidechaincompress
 * @param {number} opts.fadeIn          — fade-in en segundos
 * @param {number} opts.fadeOut         — fade-out en segundos
 * @param {number} opts.startOffset     — segundos del inicio del track a saltar
 * @param {string} opts.outputPath      — destino del .mp4 final con música
 */
export function mixMusicOntoReel({
  reelVideo, musicPath, reelDuration,
  volumeDb = -16, ducking = true,
  fadeIn = 1.0, fadeOut = 1.5, startOffset = 0,
  outputPath,
}) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    if (!fs.existsSync(reelVideo)) return reject(new Error('Reel video no existe'));
    if (!fs.existsSync(musicPath)) return reject(new Error('Track de música no existe'));

    // Construir cadena de filtros de música:
    //   - aloop infinito (para no quedarnos cortos si el track es más corto que el reel)
    //   - atrim al rango [offset, offset+reelDuration]
    //   - asetpts para normalizar timestamps
    //   - aformat para que ambas ramas tengan mismo sample rate / canales
    //   - volume base
    //   - fade in/out en bordes del reel
    const fadeOutSt = Math.max(0, reelDuration - fadeOut).toFixed(3);
    const trimEnd = (startOffset + reelDuration).toFixed(3);

    const musicChain = [
      `aloop=loop=-1:size=2e9`,
      `atrim=start=${startOffset.toFixed(3)}:end=${trimEnd}`,
      `asetpts=PTS-STARTPTS`,
      `aformat=sample_rates=44100:channel_layouts=stereo`,
      `volume=${volumeDb.toFixed(1)}dB`,
      `afade=t=in:st=0:d=${fadeIn.toFixed(2)}`,
      `afade=t=out:st=${fadeOutSt}:d=${fadeOut.toFixed(2)}`,
    ].join(',');

    // Voz: solo normalizar formato.
    const voiceChain = `aformat=sample_rates=44100:channel_layouts=stereo`;

    let filter;
    if (ducking) {
      // Sidechain: el primer input es lo que se comprime (música), el segundo es el trigger (voz).
      // threshold bajo + ratio alto = la música baja bastante cuando hay voz.
      filter = [
        `[1:a]${musicChain}[bg]`,
        `[0:a]${voiceChain}[voice]`,
        `[bg][voice]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400:level_sc=1[bgDucked]`,
        `[voice][bgDucked]amix=inputs=2:duration=first:dropout_transition=0,volume=1.4[mixed]`,
      ].join(';');
    } else {
      filter = [
        `[1:a]${musicChain}[bg]`,
        `[0:a]${voiceChain}[voice]`,
        `[voice][bg]amix=inputs=2:duration=first:dropout_transition=0,volume=1.2[mixed]`,
      ].join(';');
    }

    const args = [
      '-y',
      '-i', reelVideo,
      '-i', musicPath,
      '-filter_complex', filter,
      '-map', '0:v',           // video del reel sin tocar
      '-map', '[mixed]',
      '-c:v', 'copy',          // no re-encodear video — todo es sobre audio
      '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      '-movflags', '+faststart',
      outputPath,
    ];

    const p = spawn(ffmpeg, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`ffmpeg music mix exit ${code}: ${stderr.slice(-1500)}`));
    });
    p.on('error', reject);
  });
}
