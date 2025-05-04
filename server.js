// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import transcribeVideo from './api/transcribeVideo.js';
import { spawn } from 'child_process';
// Importar las nuevas funciones basadas en SQLite
import { 
  generateUsageReport, 
  resetUsageData, 
  deleteHistoryByDate,
  getTranscriptions
} from './api/utils/usageTrackerSQLite.js';
// Importar la base de datos para asegurar que se inicializa
import './api/database/schema.js';
import clientRoutes from './api/routes/clientRoutes.js';
import scriptRoutes from './api/routes/scriptRoutes.js';
import logRoutes from './api/routes/logRoutes.js';
// Las tablas de logs se crean en schema.js

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Verificar dependencias
const checkDependencies = async () => {
  try {
    // Verificar yt-dlp
    await new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', ['--version']);
      let version = '';
      
      ytdlp.stdout.on('data', (data) => {
        version += data.toString().trim();
      });
      
      ytdlp.on('close', (code) => {
        if (code === 0) {
          console.log(`yt-dlp detectado, versión: ${version}`);
          resolve();
        } else {
          console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: yt-dlp no encontrado. Por favor instálalo para usar la extracción de audio.');
          reject(new Error('yt-dlp no encontrado'));
        }
      });
      
      ytdlp.on('error', () => {
        console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: yt-dlp no encontrado. Por favor instálalo para usar la extracción de audio.');
        reject(new Error('yt-dlp no encontrado'));
      });
    });
    
    // Verificar ffmpeg (usando ffmpeg -version)
    await new Promise((resolve, reject) => {
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const ffmpeg = spawn(ffmpegPath, ['-version']);
      let ffmpegOutput = '';
      
      ffmpeg.stdout.on('data', (data) => {
        ffmpegOutput += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          const version = ffmpegOutput.split('\n')[0];
          console.log(`FFmpeg detectado: ${version}`);
          resolve();
        } else {
          console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: FFmpeg no encontrado. Necesitas instalarlo para la extracción de audio.');
          console.warn('\x1b[33m%s\x1b[0m', 'Puedes instalarlo o especificar su ruta en FFMPEG_PATH en el archivo .env');
          reject(new Error('FFmpeg no encontrado'));
        }
      });
      
      ffmpeg.on('error', () => {
        console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: FFmpeg no encontrado. Necesitas instalarlo para la extracción de audio.');
        console.warn('\x1b[33m%s\x1b[0m', 'Puedes instalarlo o especificar su ruta en FFMPEG_PATH en el archivo .env');
        reject(new Error('FFmpeg no encontrado'));
      });
    });
    
  } catch (error) {
    // No detenemos el servidor, solo mostramos advertencias
    console.warn('\x1b[33m%s\x1b[0m', `Algunas dependencias no están disponibles: ${error.message}`);
    console.warn('\x1b[33m%s\x1b[0m', 'La aplicación puede no funcionar correctamente.');
  }
};

// Ruta de prueba para verificar que el servidor está funcionando
app.use('/api/clients', clientRoutes);
app.use('/api/scripts', scriptRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});
app.use('/api/logs', logRoutes);

// API para obtener datos de uso
app.get('/api/usage-stats', async (req, res) => {
  try {
    const usageReport = await generateUsageReport();
    res.json(usageReport);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas de uso' });
  }
});

// API para reiniciar datos de uso
app.post('/api/usage-stats/reset', (req, res) => {
  try {
    const { keepHistory } = req.body;
    const result = resetUsageData(keepHistory);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al reiniciar datos de uso' });
  }
});

// API para eliminar registro histórico por fecha
app.delete('/api/usage-stats/history/:date', (req, res) => {
  try {
    const { date } = req.params;
    const result = deleteHistoryByDate(date);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(404).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar registro histórico' });
  }
});

// Nuevo endpoint para obtener transcripciones guardadas
app.get('/api/transcriptions', (req, res) => {
  try {
    const transcriptions = getTranscriptions();
    res.json(transcriptions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transcripciones' });
  }
});

// API Endpoint para transcribir videos
app.post('/api/transcribeVideo', transcribeVideo);

// Servir archivos estáticos en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  
  // Verificar API Key
  if (!process.env.OPENAI_API_KEY) {
    console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: API Key de OpenAI no configurada. La transcripción no funcionará correctamente.');
    console.warn('\x1b[33m%s\x1b[0m', 'Por favor, configura OPENAI_API_KEY en el archivo .env');
  }
  
  // Verificar dependencias externas
  await checkDependencies();
});