// api/extractAudio.js
import { exec } from 'youtube-dl-exec';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { detectPlatform } from './utils/platformDetector';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

/**
 * Extrae el audio de una URL de video
 * 
 * @param {string} url - URL del video (YouTube, Instagram, TikTok)
 * @returns {Promise<Object>} - Objeto con la ruta del archivo de audio y metadatos
 */
export async function extractAudio(url) {
  try {
    const platform = detectPlatform(url);
    const tempDir = os.tmpdir();
    const tempFilename = `audio-${Date.now()}.mp3`;
    const tempPath = path.join(tempDir, tempFilename);
    
    console.log(`Extrayendo audio desde ${platform}: ${url}`);
    
    // Opciones para youtube-dl basadas en la plataforma
    const options = {
      extractAudio: true,
      audioFormat: 'mp3',
      output: tempPath,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    };
    
    // Configuración específica para ciertas plataformas
    if (platform === 'instagram' || platform === 'tiktok') {
      options.addHeader = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language: en-US,en;q=0.9',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      ];
    }
    
    // Ejecutar youtube-dl para extraer el audio
    const result = await exec(url, options);
    
    // Obtener metadatos del video
    const infoOptions = {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    };
    
    const info = await exec(url, infoOptions);
    const metadata = JSON.parse(info.stdout);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(tempPath)) {
      throw new Error('No se pudo extraer el audio del video');
    }
    
    // Leer el archivo como buffer
    const audioBuffer = await readFile(tempPath);
    
    // Limpiar el archivo temporal
    await unlink(tempPath);
    
    return {
      buffer: audioBuffer,
      metadata: {
        title: metadata.title || 'Sin título',
        duration: metadata.duration,
        channel: metadata.uploader || metadata.channel || 'Desconocido',
        thumbnail: metadata.thumbnail || null
      }
    };
  } catch (error) {
    console.error('Error al extraer audio:', error);
    throw new Error(`Error al extraer audio: ${error.message}`);
  }
}