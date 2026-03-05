// api/services/transcriptionService.js
import { extractAudio } from '../extractAudio.js';
import { transcribeAudio } from '../transcribeAudio.js';

/**
 * Transcribe un video a partir de su URL
 */
export async function transcribeVideo(url) {
  try {
    // Extraer audio del video
    console.log('Extrayendo audio...');
    const { buffer: audioBuffer, metadata } = await extractAudio(url);

    // Añadir URL a los metadatos
    metadata.url = url;
    
    // Transcribir el audio
    console.log('Transcribiendo audio...');
    const { text, language, usageInfo } = await transcribeAudio(audioBuffer, metadata);
    
    return {
      transcript: text,
      language,
      title: metadata.title,
      duration: metadata.duration,
      usageInfo
    };
  } catch (error) {
    console.error('Error al transcribir video:', error);
    throw error;
  }
}
