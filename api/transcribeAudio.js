// api/transcribeAudio.js
import { Configuration, OpenAIApi } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Transcribe el audio utilizando la API de OpenAI (Whisper)
 * 
 * @param {Buffer} audioBuffer - Buffer del archivo de audio
 * @returns {Promise<Object>} - Objeto con la transcripción
 */
export async function transcribeAudio(audioBuffer) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('API Key de OpenAI no configurada');
    }
    
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const openai = new OpenAIApi(configuration);
    
    // Guardar el buffer en un archivo temporal
    const tempDir = os.tmpdir();
    const tempFilename = `audio-for-transcription-${Date.now()}.mp3`;
    const tempPath = path.join(tempDir, tempFilename);
    
    fs.writeFileSync(tempPath, audioBuffer);
    
    console.log('Enviando audio a OpenAI para transcripción...');
    
    // Enviar el archivo a la API de OpenAI para transcribir
    const response = await openai.createTranscription(
      fs.createReadStream(tempPath),
      'whisper-1',
      undefined,
      undefined,
      0.2,
      'es' // Puedes hacer este parámetro configurable
    );
    
    // Eliminar el archivo temporal
    fs.unlinkSync(tempPath);
    
    console.log('Transcripción completada con éxito');
    
    return {
      text: response.data.text,
      language: response.data.language || 'es'
    };
  } catch (error) {
    console.error('Error al transcribir audio:', error);
    throw new Error(`Error al transcribir audio: ${error.message}`);
  }
}