// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// API Endpoint para transcribir videos (simulado por ahora)
app.post('/api/transcribeVideo', async (req, res) => {
  try {
    const { url } = req.body;

    // Validar que existe una URL
    if (!url) {
      return res.status(400).json({ 
        error: 'URL no proporcionada'
      });
    }

    console.log(`Procesando URL: ${url}`);
    
    // Por ahora, devolvemos una transcripción simulada
    return res.status(200).json({
      success: true,
      url,
      transcript: `Esta es una transcripción simulada para el video en: ${url}. Cuando la implementación esté completa, aquí verás la transcripción real del video.`,
      language: 'es',
      title: 'Título del video (simulado)',
      duration: 120,
      channel: 'Canal (simulado)',
      thumbnail: null
    });

  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    return res.status(500).json({ 
      error: 'Error al procesar la solicitud', 
      details: error.message 
    });
  }
});

// Servir archivos estáticos en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});