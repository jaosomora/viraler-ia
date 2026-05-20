// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';

// Uploads grandes (videos) van al disco persistente en prod para no llenar tmpfs (/tmp en Render es RAM).
// Si el archivo se trunca a mitad de upload, ffmpeg falla con "moov atom not found".
const UPLOADS_TMP = process.env.NODE_ENV === 'production' ? '/opt/data/uploads-tmp' : os.tmpdir();
if (process.env.NODE_ENV === 'production') {
  try { fs.mkdirSync(UPLOADS_TMP, { recursive: true }); } catch {}
}
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
  captionsHandler as clipsCaptions,
  baseVideoHandler as clipsBaseVideo,
  exportClipHandler as clipsExport,
  disableAllHooksHandler as clipsDisableHooks,
  applyStyleToAllHandler as clipsApplyStyleAll,
  listTemplatesHandler as clipsListTemplates,
  createTemplateHandler as clipsCreateTemplate,
  deleteTemplateHandler as clipsDeleteTemplate,
  submitRangesHandler as clipsSubmitRanges,
  getTranscriptHandler as clipsGetTranscript,
  reopenForSelectionHandler as clipsReopen,
  getSourceVideoHandler as clipsGetSourceVideo,
} from './api/clips/routes.js';
import { recoverZombieJobs } from './api/clips/clipsService.js';
import {
  uploadHandler as reelsUpload,
  listJobsHandler as reelsList,
  adminListJobsHandler as reelsAdminList,
  getJobHandler as reelsGet,
  applyCutsHandler as reelsApplyCuts,
  updateStyleHandler as reelsUpdateStyle,
  updateTitleHandler as reelsUpdateTitle,
  renderPreviewHandler as reelsRenderPreview,
  finalizeHandler as reelsFinalize,
  reopenSilencesHandler as reelsReopenSilences,
  continueToMusicHandler as reelsContinueToMusic,
  reopenStyleHandler as reelsReopenStyle,
  updateMusicHandler as reelsUpdateMusic,
  mixMusicHandler as reelsMixMusic,
  suggestMusicHandler as reelsSuggestMusic,
  voiceSampleHandler as reelsVoiceSample,
  outputWithMusicHandler as reelsOutputWithMusic,
  sourceVideoHandler as reelsSourceVideo,
  baseVideoHandler as reelsBaseVideo,
  outputVideoHandler as reelsOutputVideo,
  downloadHandler as reelsDownload,
  deleteJobHandler as reelsDelete,
} from './api/reels/routes.js';
import {
  uploadHandler as musicUpload,
  listHandler as musicList,
  getHandler as musicGet,
  deleteHandler as musicDelete,
  updateHandler as musicUpdate,
  tagsHandler as musicTags,
  streamHandler as musicStream,
  curateHandler as musicCurate,
  providersHandler as musicProviders,
} from './api/reels/musicRoutes.js';
import { recoverZombieReels } from './api/reels/reelsService.js';
import { authMiddleware, authMiddlewareMedia, ownerOnly, registerUser, loginUser, listUsers, adminResetPassword, generateTempPassword, requestMagicLink, verifyMagicLink, setUserAccessExpiry } from './api/auth.js';
import {
  generateUsageReport,
  resetUsageData,
  deleteHistoryByDate,
  getTranscriptions,
  deleteTranscription,
  getTranscriptionById,
  saveTranscriptionAnalysis,
  trackAnalysis,
  getConversions,
  deleteConversion
} from './api/utils/usageTrackerSQLite.js';
import { analyzeTranscription } from './api/services/analysisService.js';
import {
  createHandler as ideaMapsCreate,
  respondHandler as ideaMapsRespond,
  getHandler as ideaMapsGet,
  listHandler as ideaMapsList,
  deleteHandler as ideaMapsDelete,
  adminListHandler as ideaMapsAdminList,
} from './api/ideaMaps.js';
import { protectedResourceMetadata, authorizationServerMetadata } from './api/oauth/metadata.js';
import { registerClient } from './api/oauth/register.js';
import { tokenEndpoint } from './api/oauth/token.js';
import { authorizeGet, authorizeLogin, authorizeDecision } from './api/oauth/authorize.js';
import { mcpAuthMiddleware } from './api/oauth/validator.js';
import { mcpPost, mcpMethodNotAllowed } from './api/mcp/routes.js';
import {
  overview as mcpAdminOverview,
  listClients as mcpAdminListClients,
  deleteClient as mcpAdminDeleteClient,
  listTokens as mcpAdminListTokens,
  revokeToken as mcpAdminRevokeToken,
  listAudit as mcpAdminListAudit,
  getSettings as mcpAdminGetSettings,
  updateSettings as mcpAdminUpdateSettings,
  listQuotas as mcpAdminListQuotas,
  updateUserQuota as mcpAdminUpdateUserQuota,
} from './api/mcp/adminRoutes.js';
import './api/database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Fuentes locales para AS Clips: el preview HTML las consume vía @font-face para
// que browser y libass usen literalmente el mismo TTF (mismas métricas → wrap y
// espaciado idénticos entre preview y export). Sin esto, browser pide a Google
// Fonts que sirve WOFF2 cuya versión puede no coincidir con assets/fonts/.
app.use('/assets/fonts', express.static(path.join(__dirname, 'assets/fonts'), {
  maxAge: '30d',
  immutable: true,
}));

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

// --- MCP / OAuth 2.1 (público — discovery + flujo) ---
// Discovery: RFC 9728 (Protected Resource) + RFC 8414 (Authorization Server).
app.get('/.well-known/oauth-protected-resource', protectedResourceMetadata);
app.get('/.well-known/oauth-authorization-server', authorizationServerMetadata);
// Dynamic Client Registration (RFC 7591): Claude.ai se auto-registra acá.
app.post('/oauth/register', registerClient);
// Token endpoint: acepta x-www-form-urlencoded (estándar OAuth) y JSON.
app.post('/oauth/token', express.urlencoded({ extended: false }), tokenEndpoint);
// Authorize: render HTML server-rendered con login y consent.
app.get('/oauth/authorize', authorizeGet);
app.post('/oauth/login', express.urlencoded({ extended: false }), authorizeLogin);
app.post('/oauth/decision', express.urlencoded({ extended: false }), authorizeDecision);

// --- MCP endpoint (Streamable HTTP, stateless) ---
// Bearer token requerido. 401 incluye WWW-Authenticate apuntando al resource metadata.
app.post('/mcp', mcpAuthMiddleware, mcpPost);
app.get('/mcp', mcpMethodNotAllowed);
app.delete('/mcp', mcpMethodNotAllowed);

// --- Rutas protegidas (requieren login) ---

// Transcripción por URL
app.post('/api/transcribeVideo', authMiddleware, transcribeVideo);

// Transcripción por archivo subido
const upload = multer({
  dest: UPLOADS_TMP,
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
  dest: UPLOADS_TMP,
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
app.get('/api/clips/jobs/:id/transcript', authMiddleware, clipsGetTranscript);
app.get('/api/clips/jobs/:id/source-video', authMiddlewareMedia, clipsGetSourceVideo);
app.post('/api/clips/jobs/:id/submit-ranges', authMiddleware, clipsSubmitRanges);
app.post('/api/clips/jobs/:id/reopen-for-selection', authMiddleware, clipsReopen);
app.patch('/api/clips/:id', authMiddleware, clipsUpdateClip);
app.get('/api/clips/:id/download', authMiddleware, clipsDownload);
app.get('/api/clips/:id/captions', authMiddleware, clipsCaptions);
app.get('/api/clips/:id/base-video', authMiddleware, clipsBaseVideo);
app.post('/api/clips/:id/export', authMiddleware, clipsExport);
app.post('/api/clips/:id/regenerate-caption', authMiddleware, clipsRegenCaption);
app.post('/api/clips/:id/redetect-keywords', authMiddleware, clipsRedetectKeywords);
app.post('/api/clips/jobs/:id/apply-fonts', authMiddleware, clipsApplyFontsAll);
app.post('/api/clips/jobs/:id/apply-style', authMiddleware, clipsApplyStyleAll);
app.get('/api/clips/templates', authMiddleware, clipsListTemplates);
app.post('/api/clips/templates', authMiddleware, clipsCreateTemplate);
app.delete('/api/clips/templates/:id', authMiddleware, clipsDeleteTemplate);
app.post('/api/clips/jobs/:id/disable-hooks', authMiddleware, clipsDisableHooks);
app.get('/api/admin/clips', authMiddleware, ownerOnly, clipsAdminList);
app.get('/api/admin/reels', authMiddleware, ownerOnly, reelsAdminList);

// --- AS Reels Cleaner ---
const reelsUploadMulter = multer({
  dest: UPLOADS_TMP,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB (reels son cortos)
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no soportado. Usa MP4, MOV, MKV, WEBM, M4V.'));
  },
});
app.post('/api/reels/upload', authMiddleware, reelsUploadMulter.single('video'), reelsUpload);
app.get('/api/reels/jobs', authMiddleware, reelsList);
app.get('/api/reels/jobs/:id', authMiddleware, reelsGet);
app.post('/api/reels/jobs/:id/apply-cuts', authMiddleware, reelsApplyCuts);
app.patch('/api/reels/jobs/:id/style', authMiddleware, reelsUpdateStyle);
app.patch('/api/reels/jobs/:id/title', authMiddleware, reelsUpdateTitle);
app.post('/api/reels/jobs/:id/render-preview', authMiddleware, reelsRenderPreview);
app.post('/api/reels/jobs/:id/finalize', authMiddleware, reelsFinalize);
app.post('/api/reels/jobs/:id/reopen-silences', authMiddleware, reelsReopenSilences);
app.post('/api/reels/jobs/:id/continue-to-music', authMiddleware, reelsContinueToMusic);
app.post('/api/reels/jobs/:id/reopen-style', authMiddleware, reelsReopenStyle);
app.patch('/api/reels/jobs/:id/music', authMiddleware, reelsUpdateMusic);
app.post('/api/reels/jobs/:id/mix-music', authMiddleware, reelsMixMusic);
app.post('/api/reels/jobs/:id/suggest-music', authMiddleware, reelsSuggestMusic);
app.post('/api/reels/jobs/:id/voice-sample', authMiddleware, reelsVoiceSample);
app.get('/api/reels/jobs/:id/output-with-music', authMiddlewareMedia, reelsOutputWithMusic);
app.get('/api/reels/jobs/:id/source-video', authMiddlewareMedia, reelsSourceVideo);
app.get('/api/reels/jobs/:id/base-video', authMiddlewareMedia, reelsBaseVideo);
app.get('/api/reels/jobs/:id/output', authMiddlewareMedia, reelsOutputVideo);

// --- Catálogo de música ---
const musicUploadMulter = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB por track
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no soportado. Usa MP3, WAV, M4A, OGG, AAC, FLAC.'));
  },
});
app.get('/api/music/tags', authMiddleware, musicTags);
app.get('/api/music/providers', authMiddleware, musicProviders);
app.post('/api/music/curate', authMiddleware, ownerOnly, musicCurate);
app.get('/api/music/tracks', authMiddleware, musicList);
app.post('/api/music/tracks', authMiddleware, musicUploadMulter.single('audio'), musicUpload);
app.get('/api/music/tracks/:id', authMiddleware, musicGet);
app.patch('/api/music/tracks/:id', authMiddleware, musicUpdate);
app.delete('/api/music/tracks/:id', authMiddleware, musicDelete);
app.get('/api/music/tracks/:id/stream', authMiddlewareMedia, musicStream);
app.get('/api/reels/jobs/:id/download', authMiddlewareMedia, reelsDownload);
app.delete('/api/reels/jobs/:id', authMiddleware, reelsDelete);

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

// Analizar transcripción (on-demand). Idempotente: si ya hay análisis y no se pasa
// ?force=true, devuelve el guardado sin re-llamar al LLM (evita doble cobro accidental).
app.post('/api/transcriptions/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

    const row = await getTranscriptionById(id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Transcripción no encontrada' });

    const force = req.query.force === 'true' || req.query.force === '1';
    if (row.analysis && !force) {
      return res.json({
        analysis: row.analysis,
        model: row.analysis_model,
        analysisAt: row.analysis_at,
        cached: true,
      });
    }

    const { analysis, model, costUsd } = await analyzeTranscription(row);
    await saveTranscriptionAnalysis(id, { analysis, model, costUsd });
    await trackAnalysis({ costUsd });

    res.json({
      analysis,
      model,
      analysisAt: new Date().toISOString(),
      costUsd,
      cached: false,
    });
  } catch (error) {
    console.error('Error al analizar transcripción:', error);
    res.status(500).json({ error: error.message || 'Error al analizar transcripción' });
  }
});

// --- Generador de Ideas (build_idea_map) ---
app.post('/api/idea-maps', authMiddleware, ideaMapsCreate);
app.post('/api/idea-maps/:id/respond', authMiddleware, ideaMapsRespond);
app.get('/api/idea-maps', authMiddleware, ideaMapsList);
app.get('/api/idea-maps/:id', authMiddleware, ideaMapsGet);
app.delete('/api/idea-maps/:id', authMiddleware, ideaMapsDelete);
app.get('/api/admin/idea-maps', authMiddleware, ownerOnly, ideaMapsAdminList);

// --- Rutas de Admin MCP (solo owner) ---
app.get('/api/admin/mcp/overview',         authMiddleware, ownerOnly, mcpAdminOverview);
app.get('/api/admin/mcp/clients',          authMiddleware, ownerOnly, mcpAdminListClients);
app.delete('/api/admin/mcp/clients/:id',   authMiddleware, ownerOnly, mcpAdminDeleteClient);
app.get('/api/admin/mcp/tokens',           authMiddleware, ownerOnly, mcpAdminListTokens);
app.delete('/api/admin/mcp/tokens/:hash',  authMiddleware, ownerOnly, mcpAdminRevokeToken);
app.get('/api/admin/mcp/audit',            authMiddleware, ownerOnly, mcpAdminListAudit);
app.get('/api/admin/mcp/settings',         authMiddleware, ownerOnly, mcpAdminGetSettings);
app.patch('/api/admin/mcp/settings',       authMiddleware, ownerOnly, mcpAdminUpdateSettings);
app.get('/api/admin/mcp/quotas',           authMiddleware, ownerOnly, mcpAdminListQuotas);
app.patch('/api/admin/mcp/users/:id/quota', authMiddleware, ownerOnly, mcpAdminUpdateUserQuota);

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

  // Recuperar jobs de clips que quedaron zombie por reinicio del servidor.
  try {
    const n = await recoverZombieJobs();
    if (n > 0) console.log(`[clips] ${n} job(s) marcados como error tras reinicio (zombies recuperados).`);
  } catch (e) { console.warn('[clips] zombie recovery falló:', e.message); }

  try {
    const n = await recoverZombieReels();
    if (n > 0) console.log(`[reels] ${n} job(s) marcados como error tras reinicio.`);
  } catch (e) { console.warn('[reels] zombie recovery falló:', e.message); }

  // Cleanup automático de archivos de clips viejos (evita llenar /opt/data).
  try {
    const { startCleanupScheduler } = await import('./api/clips/cleanupService.js');
    const dbMod = await import('./api/database/schema.js');
    startCleanupScheduler(dbMod.default);
  } catch (e) { console.warn('[cleanup] scheduler no se pudo iniciar:', e.message); }

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
