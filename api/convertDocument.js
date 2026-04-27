// api/convertDocument.js
import { trackConversion } from './utils/usageTrackerSQLite.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_SCRIPT = path.resolve(__dirname, '..', 'scripts', 'pdf_to_md.py');
const PIPX_PYTHON = path.join(
  process.env.HOME || '',
  '.local/pipx/venvs/markitdown/bin/python'
);

function resolvePythonPath() {
  if (process.env.PDF_PYTHON_PATH) return process.env.PDF_PYTHON_PATH;
  if (PIPX_PYTHON && fs.existsSync(PIPX_PYTHON)) return PIPX_PYTHON;
  return 'python3';
}

function runProcess(cmd, args, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`${label} falló (código ${code}): ${stderr}`));
      }
      if (!stdout.trim()) {
        return reject(new Error(`${label} no generó contenido. El documento puede estar vacío o no ser compatible.`));
      }
      resolve(stdout);
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar ${label}: ${err.message}`));
    });
  });
}

/**
 * Convierte un PDF a Markdown estructurado usando pymupdf4llm
 * (detecta headings por tamaño de fuente, conserva listas y tablas).
 */
function convertPdfToMarkdown(filePath) {
  const pythonPath = resolvePythonPath();
  return runProcess(pythonPath, [PDF_SCRIPT, filePath], 'pymupdf4llm');
}

/**
 * Convierte un documento a Markdown usando markitdown CLI
 */
function convertWithMarkitdown(filePath) {
  const markitdownPath = process.env.MARKITDOWN_PATH || 'markitdown';
  return runProcess(markitdownPath, [filePath], 'markitdown');
}

function convertToMarkdown(filePath, ext) {
  if (ext === 'pdf') {
    return convertPdfToMarkdown(filePath);
  }
  return convertWithMarkitdown(filePath);
}

/**
 * Handler para convertir documentos subidos a Markdown
 */
export default async function convertDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const ext = path.extname(originalName).toLowerCase().replace('.', '');

    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
    console.log(`Convirtiendo documento: ${originalName} (${ext}, ${fileSizeMB} MB)`);

    // Convertir a Markdown
    const startTime = Date.now();
    const markdown = await convertToMarkdown(filePath, ext);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const charCount = markdown.length.toLocaleString();
    console.log(`Conversion completada en ${elapsed}s — ${charCount} caracteres generados (${originalName})`);

    // Limpiar archivo temporal
    fs.unlinkSync(filePath);

    // Registrar en DB y trackear uso
    const userId = req.user ? req.user.id : null;
    const metadata = {
      filename: originalName,
      originalFormat: ext,
      markdown,
      fileSize,
    };

    const conversionId = await trackConversion(metadata, userId);

    return res.status(200).json({
      success: true,
      id: conversionId,
      filename: originalName,
      originalFormat: ext,
      markdown,
      fileSize,
    });
  } catch (error) {
    console.error('Error al convertir documento:', error);

    // Limpiar archivo si quedó
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      error: 'Error al convertir el documento',
      details: error.message,
    });
  }
}
