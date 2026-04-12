// api/convertDocument.js
import { trackConversion } from './utils/usageTrackerSQLite.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Convierte un documento a Markdown usando markitdown CLI
 * @param {string} filePath - Ruta al archivo del documento
 * @returns {Promise<string>} - Contenido Markdown resultante
 */
function convertToMarkdown(filePath) {
  return new Promise((resolve, reject) => {
    const markitdownPath = process.env.MARKITDOWN_PATH || 'markitdown';
    const proc = spawn(markitdownPath, [filePath]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`markitdown falló (código ${code}): ${stderr}`));
      }
      if (!stdout.trim()) {
        return reject(new Error('markitdown no generó contenido. El documento puede estar vacío o no ser compatible.'));
      }
      resolve(stdout);
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar markitdown: ${err.message}. Verifica que esté instalado (pipx install 'markitdown[all]')`));
    });
  });
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
    const markdown = await convertToMarkdown(filePath);
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
