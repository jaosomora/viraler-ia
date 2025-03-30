// api/extractAudio.js
import { spawn } from 'child_process';
import { detectPlatform } from './utils/platformDetector.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Extrae el audio de una URL de video
 * 
 * @param {string} url - URL del video (YouTube, Instagram, TikTok)
 * @returns {Promise<Object>} - Objeto con la ruta del archivo de audio y metadatos
 */
export async function extractAudio(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const platform = detectPlatform(url);
      const tempDir = os.tmpdir();
      const tempFilename = `audio-${Date.now()}.mp3`;
      const tempPath = path.join(tempDir, tempFilename);
      
      console.log(`Extrayendo audio desde ${platform}: ${url}`);
      
      // Configuración para extraer audio usando yt-dlp
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--output', tempPath,
        '--no-warnings',
        '--no-call-home',
        '--no-check-certificate',
        '--prefer-free-formats',
        '--no-playlist',
        url
      ];
      
      // Si estamos en Instagram o TikTok, agregar headers para evitar bloqueos
      if (platform === 'instagram' || platform === 'tiktok') {
        args.push('--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        args.push('--add-header', 'Accept-Language: en-US,en;q=0.9');
        args.push('--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
      }
      
      // Ejecutar yt-dlp para extraer audio
      const ytdlProcess = spawn('yt-dlp', args);
      
      let stdoutData = '';
      let stderrData = '';
      
      ytdlProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ytdlProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      ytdlProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error(`Error al extraer audio: ${stderrData}`);
          return reject(new Error(`Error al extraer audio: ${stderrData}`));
        }
        
        // Verificar que el archivo existe
        if (!fs.existsSync(tempPath)) {
          return reject(new Error('No se pudo extraer el audio del video'));
        }
        
        // Ejecutar yt-dlp nuevamente para obtener metadatos
        const infoProcess = spawn('yt-dlp', ['--dump-json', '--no-check-certificate', url]);
        
        let infoData = '';
        
        infoProcess.stdout.on('data', (data) => {
          infoData += data.toString();
        });
        
        infoProcess.on('close', async (infoCode) => {
          let metadata = {};
          
          try {
            if (infoCode === 0 && infoData) {
              const info = JSON.parse(infoData);
              metadata = {
                title: info.title || 'Sin título',
                duration: info.duration,
                channel: info.uploader || info.channel || 'Desconocido',
                thumbnail: info.thumbnail || null
              };
            } else {
              metadata = {
                title: 'Sin título',
                duration: 0,
                channel: 'Desconocido',
                thumbnail: null
              };
            }
          } catch (error) {
            console.warn('Error al obtener metadatos:', error);
            metadata = {
              title: 'Sin título',
              duration: 0,
              channel: 'Desconocido',
              thumbnail: null
            };
          }
          
          // Leer el archivo como buffer
          try {
            const audioBuffer = fs.readFileSync(tempPath);
            
            // Limpiar el archivo temporal
            fs.unlinkSync(tempPath);
            
            resolve({
              buffer: audioBuffer,
              metadata
            });
          } catch (error) {
            reject(new Error(`Error al leer el archivo de audio: ${error.message}`));
          }
        });
      });
    } catch (error) {
      reject(new Error(`Error al procesar audio: ${error.message}`));
    }
  });
}