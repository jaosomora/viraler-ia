// api/transcribeUpload.js
import { transcribeAudio } from './transcribeAudio.js';
import { trackUsage } from './utils/usageTrackerSQLite.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Extrae audio de un archivo de video local usando ffmpeg
 * @param {string} videoPath - Ruta al archivo de video
 * @returns {Promise<Buffer>} - Buffer del audio en mp3
 */
function extractAudioFromFile(videoPath) {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `audio-upload-${Date.now()}.mp3`);
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

    const args = [
      '-i', videoPath,
      '-vn',              // sin video
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-ar', '44100',
      '-y',               // sobrescribir si existe
      outputPath
    ];

    const proc = spawn(ffmpegPath, args);

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFmpeg falló: ${stderr}`));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error('No se pudo extraer el audio del archivo'));
      }

      const buffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath); // limpiar temporal
      resolve(buffer);
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Obtiene la duración de un archivo multimedia con ffprobe
 * @param {string} filePath - Ruta al archivo
 * @returns {Promise<number>} - Duración en segundos
 */
function getMediaDuration(filePath) {
  return new Promise((resolve) => {
    const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ];

    const proc = spawn(ffprobePath, args);
    let output = '';

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve(parseFloat(output.trim()));
      } else {
        resolve(0);
      }
    });
    proc.on('error', () => resolve(0));
  });
}

/**
 * Handler para transcribir archivos de video subidos
 */
export default async function transcribeUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`Procesando archivo subido: ${originalName}`);

    // Obtener duración del video
    const duration = await getMediaDuration(filePath);

    // Extraer audio del archivo
    console.log('Extrayendo audio del archivo...');
    const audioBuffer = await extractAudioFromFile(filePath);

    // Limpiar archivo temporal del upload
    fs.unlinkSync(filePath);

    // Metadatos del archivo
    const metadata = {
      title: path.parse(originalName).name,
      duration,
      channel: 'Archivo local',
      thumbnail: null,
      url: `upload://${originalName}`,
      platform: 'upload',
    };

    // Transcribir
    console.log('Transcribiendo audio...');
    const { text, language, usageInfo } = await transcribeAudio(audioBuffer, metadata);

    metadata.transcript = text;
    metadata.language = language;

    // Registrar uso
    const userId = req.user ? req.user.id : null;
    const usage = trackUsage(audioBuffer, metadata, userId);

    return res.status(200).json({
      success: true,
      url: `upload://${originalName}`,
      transcript: text,
      language,
      title: metadata.title,
      duration,
      channel: metadata.channel,
      thumbnail: null,
      usageInfo: usageInfo || usage || null,
    });
  } catch (error) {
    console.error('Error al procesar archivo subido:', error);

    // Limpiar archivo si quedó
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      error: 'Error al procesar el archivo',
      details: error.message,
    });
  }
}
