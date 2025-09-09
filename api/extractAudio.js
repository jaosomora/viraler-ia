// api/extractAudio.js
import { spawn } from 'child_process';
import { detectPlatform } from './utils/platformDetector.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Busca y devuelve los argumentos para usar cookies
 */
const getCookieArgs = () => {
  // Primero verificar si hay un archivo de cookies especificado por variable de entorno
  if (process.env.INSTAGRAM_COOKIES_FILE && fs.existsSync(process.env.INSTAGRAM_COOKIES_FILE)) {
    console.log(`Usando cookies desde: ${process.env.INSTAGRAM_COOKIES_FILE}`);
    return ['--cookies', process.env.INSTAGRAM_COOKIES_FILE];
  }
  
  // Buscar en ubicaciones predefinidas
  const cookiePaths = [
    path.join(__dirname, '../config/instagram_cookies.txt'),
    '/app/config/instagram_cookies.txt',
    path.join(process.cwd(), 'config/instagram_cookies.txt')
  ];
  
  for (const cookiePath of cookiePaths) {
    if (fs.existsSync(cookiePath)) {
      console.log(`Usando cookies desde: ${cookiePath}`);
      return ['--cookies', cookiePath];
    }
  }
  
  console.log('No se encontraron cookies de Instagram');
  return [];
};

/**
 * Extrae el audio de una URL de video
 */
export async function extractAudio(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const platform = detectPlatform(url);
      const tempDir = os.tmpdir();
      const tempFilename = `audio-${Date.now()}.mp3`;
      const tempPath = path.join(tempDir, tempFilename);
      
      console.log(`Extrayendo audio desde ${platform}: ${url}`);
      
      const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
      console.log(`Usando yt-dlp desde: ${ytDlpPath}`);
      
      // Configuración para extraer audio
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--output', tempPath,
        '--no-warnings',
        '--no-call-home',
        '--no-check-certificate',
        '--prefer-free-formats',
        '--no-playlist'
      ];
      
      // FFmpeg location
      if (process.env.FFMPEG_PATH) {
        args.push('--ffmpeg-location', process.env.FFMPEG_PATH);
        console.log(`Usando FFmpeg desde: ${process.env.FFMPEG_PATH}`);
      }
      
      // Agregar cookies para Instagram
      if (platform === 'instagram') {
        const cookieArgs = getCookieArgs();
        if (cookieArgs.length > 0) {
          args.push(...cookieArgs);
        } else {
          console.warn('⚠️ No hay cookies de Instagram configuradas. Esto puede causar errores.');
        }
      }
      
      // User-Agent y headers
      args.push(
        '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );
      
      if (platform === 'instagram' || platform === 'tiktok') {
        args.push(
          '--add-header', 'Accept-Language:es-ES,es;q=0.9,en;q=0.8',
          '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        );
      }
      
      // Añadir la URL
      args.push(url);
      
      // Ejecutar yt-dlp
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
          
          // Mensajes de error más claros
          if (stderrData.includes('rate-limit')) {
            return reject(new Error('Instagram ha aplicado un límite de tasa. Por favor, espera unos minutos e intenta de nuevo.'));
          } else if (stderrData.includes('login required')) {
            return reject(new Error('Se requiere autenticación. Asegúrate de que el archivo de cookies esté configurado correctamente.'));
          }
          
          return reject(new Error(`Error al extraer audio: ${stderrData}`));
        }
        
        // Verificar que el archivo existe
        if (!fs.existsSync(tempPath)) {
          return reject(new Error('No se pudo extraer el audio del video'));
        }
        
        // Obtener metadatos
        const metadata = await getVideoMetadata(url, platform);
        
        // Leer el archivo como buffer
        try {
          const audioBuffer = fs.readFileSync(tempPath);
          fs.unlinkSync(tempPath);
          
          resolve({
            buffer: audioBuffer,
            metadata
          });
        } catch (error) {
          reject(new Error(`Error al leer el archivo de audio: ${error.message}`));
        }
      });
      
      ytdlProcess.on('error', (error) => {
        reject(new Error(`Error al ejecutar yt-dlp: ${error.message}`));
      });
    } catch (error) {
      reject(new Error(`Error al procesar audio: ${error.message}`));
    }
  });
}

/**
 * Obtiene metadatos del video
 */
async function getVideoMetadata(url, platform) {
  return new Promise(async (resolve) => {
    const metadata = {
      title: 'Sin título',
      duration: 0,
      channel: 'Desconocido',
      thumbnail: null
    };
    
    try {
      const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
      const args = ['--dump-json', '--no-check-certificate'];
      
      // Agregar cookies para Instagram
      if (platform === 'instagram') {
        const cookieArgs = getCookieArgs();
        if (cookieArgs.length > 0) {
          args.push(...cookieArgs);
        }
      }
      
      args.push(
        '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        url
      );
      
      const infoProcess = spawn(ytDlpPath, args);
      
      let infoData = '';
      
      infoProcess.stdout.on('data', (data) => {
        infoData += data.toString();
      });
      
      infoProcess.on('close', (code) => {
        if (code === 0 && infoData) {
          try {
            const info = JSON.parse(infoData);
            metadata.title = info.title || metadata.title;
            metadata.duration = info.duration || metadata.duration;
            metadata.channel = info.uploader || info.channel || metadata.channel;
            metadata.thumbnail = info.thumbnail || metadata.thumbnail;
          } catch (error) {
            console.warn('Error al parsear metadatos:', error);
          }
        }
        resolve(metadata);
      });
      
      infoProcess.on('error', () => {
        resolve(metadata);
      });
    } catch (error) {
      console.warn('Error obteniendo metadatos:', error);
      resolve(metadata);
    }
  });
}