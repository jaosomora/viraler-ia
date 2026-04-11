// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import os from 'os';
import { spawn } from 'child_process';
import transcribeVideo from './api/transcribeVideo.js';
import transcribeUpload from './api/transcribeUpload.js';
import {
  generateUsageReport,
  resetUsageData,
  deleteHistoryByDate,
  getTranscriptions,
  deleteTranscription
} from './api/utils/usageTrackerSQLite.js';
import './api/database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Transcripción por URL
app.post('/api/transcribeVideo', transcribeVideo);

// Transcripción por archivo subido
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv|mp3|wav|m4a|ogg)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado'));
    }
  },
});
app.post('/api/transcribeUpload', upload.single('video'), transcribeUpload);

// Transcripciones guardadas
app.get('/api/transcriptions', async (req, res) => {
  try {
    const transcriptions = await getTranscriptions();
    res.json(transcriptions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transcripciones' });
  }
});

// Eliminar transcripción
app.delete('/api/transcriptions/:id', async (req, res) => {
  try {
    const result = await deleteTranscription(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar transcripción' });
  }
});

// Estadísticas de uso (Admin)
app.get('/api/usage-stats', async (req, res) => {
  try {
    const usageReport = await generateUsageReport();
    res.json(usageReport);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas de uso' });
  }
});

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

// Servir archivos estáticos en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);

  if (!process.env.OPENAI_API_KEY) {
    console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: API Key de OpenAI no configurada.');
  }

  // Verificar yt-dlp y ffmpeg
  try {
    await new Promise((resolve, reject) => {
      const p = spawn('yt-dlp', ['--version']);
      p.on('close', (code) => code === 0 ? resolve() : reject());
      p.on('error', reject);
    });
    console.log('yt-dlp detectado');
  } catch { console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: yt-dlp no encontrado.'); }

  try {
    await new Promise((resolve, reject) => {
      const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-version']);
      p.on('close', (code) => code === 0 ? resolve() : reject());
      p.on('error', reject);
    });
    console.log('FFmpeg detectado');
  } catch { console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: FFmpeg no encontrado.'); }
});
