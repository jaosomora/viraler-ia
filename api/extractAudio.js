// api/extractAudio.js
import { spawn } from 'child_process';
import { detectPlatform } from './utils/platformDetector.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Determina la ruta de yt-dlp según el entorno
 * @returns {string} - Ruta al ejecutable yt-dlp
 */
const getYtDlpPath = () => {
  // En entorno Docker, podría estar en una ruta específica
  if (process.env.NODE_ENV === 'production') {
    if (fs.existsSync('/usr/local/bin/yt-dlp')) {
      return '/usr/local/bin/yt-dlp';
    }
  }
  // En desarrollo o fallback, usar el comando normal
  return 'yt-dlp';
};

/**
 * Busca y devuelve los argumentos para usar cookies
 * @returns {string[]} - Argumentos para yt-dlp con cookies
 */
const getCookieArgs = () => {
  // Posibles ubicaciones de archivos de cookies
  const cookiePaths = [
    path.join(__dirname, '../config/instagram_cookies.txt'), // Local sin Docker
    '/app/config/instagram_cookies.txt'                      // Dentro de Docker
  ];
  
  for (const cookiePath of cookiePaths) {
    if (fs.existsSync(cookiePath)) {
      console.log(`Usando cookies desde: ${cookiePath}`);
      return ['--cookies', cookiePath];
    }
  }
  
  console.log('No se encontraron cookies, intentando sin autenticación');
  return [];
};

/**
 * Extrae el audio de una URL de video
 * 
 * @param {string} url - URL del video (YouTube, Instagram, TikTok)
 * @returns {Promise<Object>} - Objeto con la ruta del archivo de audio y metadatos
 */
export async function extractAudio(url) {
  // Resto del código de la función extractAudio...
  return new Promise(async (resolve, reject) => {
    try {
      const platform = detectPlatform(url);
      const tempDir = os.tmpdir();
      const tempFilename = `audio-${Date.now()}.mp3`;
      const tempPath = path.join(tempDir, tempFilename);
      
      console.log(`Extrayendo audio desde ${platform}: ${url}`);
      
      // Obtener la ruta de yt-dlp
      const ytDlpPath = getYtDlpPath();
      console.log(`Usando yt-dlp desde: ${ytDlpPath}`);
      
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
      ];
      
      // Especificar la ubicación de FFmpeg si está definida en las variables de entorno
      if (process.env.FFMPEG_PATH) {
        args.push('--ffmpeg-location', process.env.FFMPEG_PATH);
        console.log(`Usando FFmpeg desde: ${process.env.FFMPEG_PATH}`);
      }
      
      // Agregar cookies si existen (especialmente importante para Instagram)
      if (platform === 'instagram') {
        args.push(...getCookieArgs());
      }
      
      // Agregar User-Agent y headers para plataformas que pueden bloquear
      args.push('--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      if (platform === 'instagram' || platform === 'tiktok') {
        args.push('--add-header', 'Accept-Language: en-US,en;q=0.9,es;q=0.8');
        args.push('--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
        args.push('--add-header', 'Referer: https://www.google.com/');
      }
      
      // Añadir la URL al final de los argumentos
      args.push(url);
      
      // Ejecutar yt-dlp para extraer audio
      const ytdlProcess = spawn(ytDlpPath, args);
      
      let stdoutData = '';
      let stderrData = '';
      
      ytdlProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        console.log(`yt-dlp stdout: ${data.toString()}`);
      });
      
      ytdlProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`yt-dlp stderr: ${data.toString()}`);
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
        const metadataArgs = ['--dump-json', '--no-check-certificate'];
        
        // Agregar cookies para metadatos también
        if (platform === 'instagram') {
          metadataArgs.push(...getCookieArgs());
        }
        
        // Agregar User-Agent
        metadataArgs.push('--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Agregar la ubicación de FFmpeg si está definida
        if (process.env.FFMPEG_PATH) {
          metadataArgs.push('--ffmpeg-location', process.env.FFMPEG_PATH);
        }
        
        // Agregar la URL al final
        metadataArgs.push(url);
        
        const infoProcess = spawn(ytDlpPath, metadataArgs);
        
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