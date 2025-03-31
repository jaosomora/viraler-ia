// api/transcribeAudio.js
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Calcula el costo basado en la duración del audio
 * @param {number} durationInSeconds - Duración en segundos
 * @returns {number} - Costo estimado
 */
export const calculateCost = (durationInSeconds) => {
  // Whisper cobra $0.006 por minuto
  const durationInMinutes = durationInSeconds / 60;
  return durationInMinutes * 0.006;
};

/**
 * Transcribe el audio utilizando la API de OpenAI (Whisper)
 * 
 * @param {Buffer} audioBuffer - Buffer del archivo de audio
 * @param {Object} metadata - Metadatos del audio/video
 * @returns {Promise<Object>} - Objeto con la transcripción
 */
export async function transcribeAudio(audioBuffer, metadata = {}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('API Key de OpenAI no configurada');
    }
    
    // Inicializar cliente de OpenAI v4
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Guardar el buffer en un archivo temporal
    const tempDir = os.tmpdir();
    const tempFilename = `audio-for-transcription-${Date.now()}.mp3`;
    const tempPath = path.join(tempDir, tempFilename);
    
    fs.writeFileSync(tempPath, audioBuffer);
    
    console.log('Enviando audio a OpenAI para transcripción...');
    
    // Crear un objeto File a partir del archivo temporal
    const file = fs.createReadStream(tempPath);
    
    // Enviar el archivo a la API de OpenAI para transcribir
    // La API v4 usa el método createTranscription directamente en el objeto openai
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "es",
      response_format: "json",
    });
    
    // Eliminar el archivo temporal
    fs.unlinkSync(tempPath);
    
    console.log('Transcripción completada con éxito');
    
    // Calcular información de uso
    const durationInSeconds = metadata.duration || (audioBuffer.byteLength / 16000);
    const estimatedCost = calculateCost(durationInSeconds);
    
    const usageInfo = {
      durationInSeconds,
      estimatedCost
    };
    
    console.log(`Duración estimada: ${Math.round(usageInfo.durationInSeconds)} segundos`);
    console.log(`Costo estimado: $${usageInfo.estimatedCost.toFixed(4)}`);
    
    return {
      text: response.text,
      language: response.language || 'es',
      usageInfo
    };
  } catch (error) {
    console.error('Error al transcribir audio:', error);
    throw new Error(`Error al transcribir audio: ${error.message}`);
  }
}