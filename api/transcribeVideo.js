// api/transcribeVideo.js
import { extractAudio } from './extractAudio.js';
import { transcribeAudio } from './transcribeAudio.js';
import { isValidUrl } from './utils/platformDetector.js';
// Importar el nuevo tracker basado en SQLite
import { trackUsage } from './utils/usageTrackerSQLite.js';

export default async function transcribeVideo(req, res) {
  try {
    const { url } = req.body;

    // Validar la URL
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ 
        error: 'URL inválida o no compatible. Soportamos YouTube, Instagram Reels y TikTok.'
      });
    }

    console.log(`Procesando URL: ${url}`);

    // Extraer audio del video
    console.log('Extrayendo audio...');
    const { buffer: audioBuffer, metadata } = await extractAudio(url);

    // Añadir URL a los metadatos
    metadata.url = url;
    
    // Detectar plataforma para los metadatos
    metadata.platform = detectPlatform(url);

    // Transcribir el audio
    console.log('Transcribiendo audio...');
    const { text, language, usageInfo } = await transcribeAudio(audioBuffer, metadata);
    
    // Actualizar metadatos con el texto transcrito para guardar en la base de datos
    metadata.transcript = text;
    metadata.language = language;

    // Registrar uso con la nueva implementación en SQLite
    const usage = trackUsage(audioBuffer, metadata);

    // Devolver la transcripción y metadatos
    return res.status(200).json({
      success: true,
      url,
      transcript: text,
      language,
      title: metadata.title,
      duration: metadata.duration,
      channel: metadata.channel,
      thumbnail: metadata.thumbnail,
      usageInfo: usageInfo || usage || null
    });

  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    
    // Manejo de errores específicos
    if (error.message.includes('URL no compatible')) {
      return res.status(400).json({ error: error.message });
    }
    
    // Error general
    return res.status(500).json({ 
      error: 'Error al procesar la solicitud', 
      details: error.message 
    });
  }
}

/**
 * Detecta la plataforma basándose en la URL
 * @param {string} url - URL del video
 * @returns {string} - Plataforma detectada
 */
function detectPlatform(url) {
  if (url.includes('instagram.com')) {
    return 'instagram';
  } else if (url.includes('tiktok.com')) {
    return 'tiktok';
  } else if (url.includes('youtube.com/shorts')) {
    return 'youtube-shorts';
  } else if (url.includes('youtube.com')) {
    return 'youtube';
  } else {
    return 'unknown';
  }
}