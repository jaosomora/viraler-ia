// api/transcribeAudio.js
import OpenAI from 'openai';

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
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Crear un objeto Blob a partir del buffer
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    
    // Crear un objeto File para enviar a la API
    const file = new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' });
    
    console.log('Enviando audio a OpenAI para transcripción...');
    
    // Enviar el archivo a la API de OpenAI para transcribir
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'es', // Puedes hacer este parámetro configurable
      response_format: 'json'
    });
    
    console.log('Transcripción completada con éxito');
    
    return {
      text: transcription.text,
      language: transcription.language || 'es'
    };
  } catch (error) {
    console.error('Error al transcribir audio:', error);
    throw new Error(`Error al transcribir audio: ${error.message}`);
  }
}