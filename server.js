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
import convertDocument from './api/convertDocument.js';
import { authMiddleware, ownerOnly, registerUser, loginUser } from './api/auth.js';
import {
  generateUsageReport,
  resetUsageData,
  deleteHistoryByDate,
  getTranscriptions,
  deleteTranscription,
  getConversions,
  deleteConversion
} from './api/utils/usageTrackerSQLite.js';
import './api/database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Auth (público) ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const result = await registerUser(name, email, password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// --- Rutas protegidas (requieren login) ---

// Transcripción por URL
app.post('/api/transcribeVideo', authMiddleware, transcribeVideo);

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
app.post('/api/transcribeUpload', authMiddleware, upload.single('video'), transcribeUpload);

// Conversión de documentos a Markdown
const documentUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|docx|pptx|xlsx|epub)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado. Formatos válidos: PDF, DOCX, PPTX, XLSX, EPUB'));
    }
  },
});
app.post('/api/convert', authMiddleware, documentUpload.single('document'), convertDocument);

// Transcripciones del usuario
app.get('/api/transcriptions', authMiddleware, async (req, res) => {
  try {
    const transcriptions = await getTranscriptions(req.user.id);
    res.json(transcriptions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transcripciones' });
  }
});

// Conversiones del usuario
app.get('/api/conversions', authMiddleware, async (req, res) => {
  try {
    const conversions = await getConversions(req.user.id);
    res.json(conversions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener conversiones' });
  }
});

// Eliminar conversión (solo la propia)
app.delete('/api/conversions/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteConversion(req.params.id, req.user.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar conversión' });
  }
});

// Eliminar transcripción (solo la propia)
app.delete('/api/transcriptions/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteTranscription(req.params.id, req.user.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar transcripción' });
  }
});

// --- Rutas de Admin (solo owner) ---

app.get('/api/admin/transcriptions', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const transcriptions = await getTranscriptions();
    res.json(transcriptions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transcripciones' });
  }
});

app.get('/api/admin/conversions', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const conversions = await getConversions();
    res.json(conversions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener conversiones' });
  }
});

app.get('/api/usage-stats', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const usageReport = await generateUsageReport();
    res.json(usageReport);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas de uso' });
  }
});

app.post('/api/usage-stats/reset', authMiddleware, ownerOnly, (req, res) => {
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

app.delete('/api/usage-stats/history/:date', authMiddleware, ownerOnly, (req, res) => {
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

  try {
    await new Promise((resolve, reject) => {
      const p = spawn(process.env.MARKITDOWN_PATH || 'markitdown', ['--help']);
      p.on('close', (code) => code === 0 ? resolve() : reject());
      p.on('error', reject);
    });
    console.log('markitdown detectado');
  } catch { console.warn('\x1b[33m%s\x1b[0m', 'ADVERTENCIA: markitdown no encontrado. Instalar con: pipx install \'markitdown[all]\''); }
});
