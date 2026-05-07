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
import downloadVideo from './api/downloadVideo.js';
import convertDocument from './api/convertDocument.js';
import {
  createSecret,
  listSecrets,
  revealSecret,
  deleteSecret
} from './api/secrets.js';
import {
  generateHandler as clipsGenerate,
  getJobHandler as clipsGetJob,
  listJobsHandler as clipsListJobs,
  updateClipHandler as clipsUpdateClip,
  downloadClipHandler as clipsDownload,
  regenerateCaptionHandler as clipsRegenCaption,
  deleteJobHandler as clipsDeleteJob,
  adminListJobsHandler as clipsAdminList,
  fontsHandler as clipsFonts,
  stagesHandler as clipsStages,
  applyFontsToAllHandler as clipsApplyFontsAll,
  redetectKeywordsHandler as clipsRedetectKeywords,
} from './api/clips/routes.js';
import { authMiddleware, ownerOnly, registerUser, loginUser, listUsers, adminResetPassword, generateTempPassword, requestMagicLink, verifyMagicLink, setUserAccessExpiry } from './api/auth.js';
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

// Magic link: solicitar
const magicAttempts = new Map();
app.post('/api/auth/magic-link/request', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requerido' });
    }
    // Rate limit por IP
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const e = magicAttempts.get(ip) || { count: 0, resetAt: now + 60_000 };
    if (now > e.resetAt) { e.count = 0; e.resetAt = now + 60_000; }
    e.count += 1;
    magicAttempts.set(ip, e);
    if (e.count > 5) return res.status(429).json({ error: 'Demasiados intentos, espera un minuto' });

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    await requestMagicLink(email.trim().toLowerCase(), baseUrl);
    // Respuesta genérica intencional (no revelar si el email existe)
    res.json({ sent: true });
  } catch {
    res.json({ sent: true });
  }
});

// Magic link: verificar
app.post('/api/auth/magic-link/verify', async (req, res) => {
  try {
    const { token } = req.body || {};
    const result = await verifyMagicLink(token);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
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
    const allowed = /\.(mp4|mov|avi|mkv|webm|m4v|flv|wmv|mp3|wav|m4a|ogg|opus)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado'));
    }
  },
});
app.post('/api/transcribeUpload', authMiddleware, upload.single('video'), transcribeUpload);

// Descargar video desde URL (máx 30 min)
app.post('/api/download-video', authMiddleware, downloadVideo);

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

// --- AS Clips ---
const clipsUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no soportado para clips. Usa MP4, MOV, MKV, WEBM.'));
  },
});
app.get('/api/clips/fonts', authMiddleware, clipsFonts);
app.get('/api/clips/stages', authMiddleware, clipsStages);
app.post('/api/clips/generate', authMiddleware, clipsUpload.single('video'), clipsGenerate);
app.get('/api/clips/jobs', authMiddleware, clipsListJobs);
app.get('/api/clips/jobs/:id', authMiddleware, clipsGetJob);
app.delete('/api/clips/jobs/:id', authMiddleware, clipsDeleteJob);
app.patch('/api/clips/:id', authMiddleware, clipsUpdateClip);
app.get('/api/clips/:id/download', authMiddleware, clipsDownload);
app.post('/api/clips/:id/regenerate-caption', authMiddleware, clipsRegenCaption);
app.post('/api/clips/:id/redetect-keywords', authMiddleware, clipsRedetectKeywords);
app.post('/api/clips/jobs/:id/apply-fonts', authMiddleware, clipsApplyFontsAll);
app.get('/api/admin/clips', authMiddleware, ownerOnly, clipsAdminList);

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

app.get('/api/admin/users', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Asignar fecha de expiración de acceso. Body: { expiresAt: ISOString | null }
// null = sin límite (uso interno).
app.patch('/api/admin/users/:id/access', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { expiresAt } = req.body || {};
    const result = await setUserAccessExpiry(userId, expiresAt ?? null);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/users/:id/reset-password', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { password } = req.body || {};
    const newPassword = (password && password.length >= 6) ? password : generateTempPassword();
    await adminResetPassword(userId, newPassword);
    res.json({ success: true, tempPassword: newPassword });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

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

// --- Secretos ---
// Crear: cualquier usuario autenticado. Listar/leer/borrar: solo owner.
app.post('/api/secrets', authMiddleware, createSecret);
app.get('/api/secrets', authMiddleware, ownerOnly, listSecrets);
app.get('/api/secrets/:token', authMiddleware, ownerOnly, revealSecret);
app.delete('/api/secrets/:id', authMiddleware, ownerOnly, deleteSecret);

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

  // Estado de servicios opcionales — útil al diagnosticar prod
  const cfg = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    SECRETS_ENCRYPTION_KEY: !!process.env.SECRETS_ENCRYPTION_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    MAGIC_LINK_FROM_EMAIL: process.env.MAGIC_LINK_FROM_EMAIL || '(no set)',
    APP_BASE_URL: process.env.APP_BASE_URL || '(inferido del request)'
  };
  console.log(`[config] ${JSON.stringify(cfg)}`);

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
