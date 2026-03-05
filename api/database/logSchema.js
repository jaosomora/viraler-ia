// api/database/logSchema.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determinar ruta de los logs según el entorno
const getLogsDir = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Ruta para producción en Render
    const prodLogsDir = path.join('/opt/data', 'logs');
    
    // Crear directorio si no existe
    if (!fs.existsSync(prodLogsDir)) {
      try {
        fs.mkdirSync(prodLogsDir, { recursive: true });
        console.log(`Directorio de logs creado en: ${prodLogsDir}`);
      } catch (error) {
        console.error(`Error al crear directorio de logs: ${error.message}`);
        // Intentar usar un directorio temporal como fallback
        return path.join('/tmp', 'logs');
      }
    }
    
    return prodLogsDir;
  } else {
    // Ruta para desarrollo local
    const devLogsDir = path.join(__dirname, '../../data/logs');
    
    // Crear directorio si no existe
    if (!fs.existsSync(devLogsDir)) {
      fs.mkdirSync(devLogsDir, { recursive: true });
    }
    
    return devLogsDir;
  }
};

// Exportar esquema de logs con directorio de almacenamiento
export const logSchema = {
  logsDir: getLogsDir()
};

console.log(`Directorio de logs configurado en: ${logSchema.logsDir}`);