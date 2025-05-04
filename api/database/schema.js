// api/database/schema.js
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determinar ruta de la base de datos según el entorno
const getDataDir = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Ruta para producción en Render
    const prodDataDir = '/opt/data';
    
    // Crear directorio si no existe
    if (!fs.existsSync(prodDataDir)) {
      try {
        fs.mkdirSync(prodDataDir, { recursive: true });
        console.log(`Directorio de datos creado en: ${prodDataDir}`);
      } catch (error) {
        console.error(`Error al crear directorio de datos: ${error.message}`);
        // Intentar usar un directorio temporal como fallback
        return '/tmp';
      }
    }
    
    return prodDataDir;
  } else {
    // Ruta para desarrollo local
    const devDataDir = path.join(__dirname, '../../data');
    
    // Crear directorio si no existe
    if (!fs.existsSync(devDataDir)) {
      fs.mkdirSync(devDataDir, { recursive: true });
    }
    
    return devDataDir;
  }
};

// Obtener directorio de datos
const dataDir = getDataDir();

// Ruta a la base de datos SQLite
const dbPath = path.join(dataDir, 'viraler.db');

console.log(`Inicializando base de datos SQLite en: ${dbPath}`);

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
    return;
  }
  console.log('Conexión a la base de datos SQLite establecida.');
});

// Crear tablas si no existen
db.serialize(() => {
  // Tabla de transcripciones
  db.run(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      platform TEXT,
      title TEXT,
      transcript TEXT NOT NULL,
      duration INTEGER,
      channel TEXT,
      thumbnail TEXT,
      language TEXT DEFAULT 'es',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de registro de uso
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      transcriptions INTEGER DEFAULT 1,
      audio_minutes REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de configuración
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);      
// Tabla de clientes
db.run(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de documentos
db.run(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    filename TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )
`);

// Tabla de vectores de documentos para el sistema RAG
db.run(`
  CREATE TABLE IF NOT EXISTS document_vectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    vector BLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  )
`);

// Tabla de guiones generados
db.run(`
  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    inspiration_url TEXT,
    inspiration_transcript TEXT,
    cta TEXT,
    duration_seconds INTEGER,
    awareness_level INTEGER,
    additional_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )
`);

// Tabla de conversaciones para ajustes de guiones
db.run(`
  CREATE TABLE IF NOT EXISTS script_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    messages TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
  )
`);

// Tabla de clientes
db.run(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de documentos
db.run(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    filename TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )
`);

// Tabla de vectores de documentos para el sistema RAG
db.run(`
  CREATE TABLE IF NOT EXISTS document_vectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    vector BLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  )
`);

// Tabla de guiones generados
db.run(`
  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    inspiration_url TEXT,
    inspiration_transcript TEXT,
    cta TEXT,
    duration_seconds INTEGER,
    awareness_level INTEGER,
    additional_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )
`);

// Tabla de conversaciones para ajustes de guiones
db.run(`
  CREATE TABLE IF NOT EXISTS script_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    messages TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
  )
`);

// Tabla de logs de API
db.run(`
  CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    script_id INTEGER,
    request_type TEXT NOT NULL,
    model_used TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_estimate REAL,
    duration_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    log_file_path TEXT,
    status TEXT DEFAULT 'success'
  )
`);

// Tabla de estadísticas RAG
db.run(`
  CREATE TABLE IF NOT EXISTS rag_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_log_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    num_chunks_retrieved INTEGER,
    top_similarity_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_log_id) REFERENCES api_logs(id) ON DELETE CASCADE
  )
`);

// Tabla de documentos usados en RAG
db.run(`
  CREATE TABLE IF NOT EXISTS rag_documents_used (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rag_stat_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER,
    similarity_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rag_stat_id) REFERENCES rag_stats(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  )
`);

  console.log('Esquema de base de datos inicializado correctamente.');
});

// Exportar la conexión de la base de datos
export default db;