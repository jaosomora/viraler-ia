// api/database/schema.js
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getDataDir = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const prodDataDir = '/opt/data';
    if (!fs.existsSync(prodDataDir)) {
      try {
        fs.mkdirSync(prodDataDir, { recursive: true });
      } catch (error) {
        console.error(`Error al crear directorio de datos: ${error.message}`);
        return '/tmp';
      }
    }
    return prodDataDir;
  } else {
    const devDataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(devDataDir)) {
      fs.mkdirSync(devDataDir, { recursive: true });
    }
    return devDataDir;
  }
};

const dataDir = getDataDir();
const dbPath = path.join(dataDir, 'as-transcribe.db');

console.log(`Inicializando base de datos SQLite en: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
    return;
  }
  console.log('Conexión a la base de datos SQLite establecida.');
});

db.serialize(() => {
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: agregar user_id si la tabla ya existe sin ella
  db.run(`ALTER TABLE transcriptions ADD COLUMN user_id INTEGER REFERENCES users(id)`, (err) => {
    // Ignora si la columna ya existe
    if (err && !err.message.includes('duplicate column')) {
      // Column already exists or other expected error
    }
  });

  // Migration: acceso temporal a la herramienta (NULL = sin límite, ej. owner/internos)
  db.run(`ALTER TABLE users ADD COLUMN access_expires_at TIMESTAMP`, () => {});

  // Migration: metadata extendida del video (snapshot al momento de transcribir).
  // Capturada del JSON de yt-dlp. Todos opcionales — IG/FB sin cookies devuelven null.
  db.run(`ALTER TABLE transcriptions ADD COLUMN view_count INTEGER`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN like_count INTEGER`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN comment_count INTEGER`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN share_count INTEGER`, () => {}); // TikTok repost_count
  db.run(`ALTER TABLE transcriptions ADD COLUMN uploader_handle TEXT`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN uploader_url TEXT`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN upload_date TEXT`, () => {}); // YYYYMMDD que da yt-dlp
  db.run(`ALTER TABLE transcriptions ADD COLUMN description TEXT`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN hashtags TEXT`, () => {}); // JSON array
  db.run(`ALTER TABLE transcriptions ADD COLUMN metrics_captured_at TIMESTAMP`, () => {});
  // Análisis on-demand: markdown generado por LLM cuando el usuario pulsa "Analizar ideas".
  db.run(`ALTER TABLE transcriptions ADD COLUMN analysis TEXT`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN analysis_at TIMESTAMP`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN analysis_model TEXT`, () => {});
  db.run(`ALTER TABLE transcriptions ADD COLUMN analysis_cost_usd REAL`, () => {});

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

  // Tabla de conversiones (documentos a Markdown)
  db.run(`
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_format TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: agregar columna conversions a usage_stats si no existe
  db.run(`ALTER TABLE usage_stats ADD COLUMN conversions INTEGER DEFAULT 0`, (err) => {
    // Ignora si la columna ya existe
  });
  // Reels Cleaner: contador + minutos finales + costo total agregado por día.
  db.run(`ALTER TABLE usage_stats ADD COLUMN reels INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE usage_stats ADD COLUMN reels_minutes REAL DEFAULT 0`, () => {});
  db.run(`ALTER TABLE usage_stats ADD COLUMN reels_cost REAL DEFAULT 0`, () => {});
  // Análisis de ideas on-demand sobre transcripciones (gpt-4o-mini).
  db.run(`ALTER TABLE usage_stats ADD COLUMN analyses INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE usage_stats ADD COLUMN analyses_cost REAL DEFAULT 0`, () => {});
  // Mapas de ideas: cada "mapa exitoso" cuenta como 1; los rechazos no cuentan
  // (puede haber varios intentos por mapa). idea_maps_cost agrega validate+generate.
  db.run(`ALTER TABLE usage_stats ADD COLUMN idea_maps INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE usage_stats ADD COLUMN idea_maps_cost REAL DEFAULT 0`, () => {});

  // Tabla de configuración
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Secretos: cualquier usuario logueado crea uno con texto libre cifrado.
  // Solo el owner los puede leer. Caducan a 30 días.
  db.run(`
    CREATE TABLE IF NOT EXISTS secrets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      title TEXT,
      content_encrypted TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      read_at TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);
  // Cleanup tablas previas (si existían del MVP anterior)
  db.run(`DROP TABLE IF EXISTS secret_items`);
  db.run(`DROP TABLE IF EXISTS secret_deliveries`);

  // AS Clips — jobs de generación de clips verticales (9:16) con subs IG-style.
  // Un job = una URL/upload procesado. Genera N clips con highlights detectados por LLM.
  db.run(`
    CREATE TABLE IF NOT EXISTS clip_jobs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      source_url TEXT,
      source_filename TEXT,
      title TEXT,
      duration_seconds INTEGER,
      thumbnail TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      stage_index INTEGER DEFAULT 0,
      error_message TEXT,
      total_clips INTEGER DEFAULT 0,
      whisper_cost_usd REAL DEFAULT 0,
      llm_cost_usd REAL DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      whisper_json_path TEXT,
      source_video_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP
    )
  `);

  // Migrations: preferencias job-level que se eligen en el form al generar.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN requested_clip_count INTEGER`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN default_resolution TEXT DEFAULT '1080'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN aspect_ratio TEXT DEFAULT '9:16'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_preset_mode TEXT DEFAULT 'auto'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_hook_default TEXT DEFAULT 'Anton'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_caption_default TEXT DEFAULT 'InterSemiBold'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN font_keyword_default TEXT DEFAULT 'MontserratBold'`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN source_width INTEGER`, () => {});
  db.run(`ALTER TABLE clip_jobs ADD COLUMN source_height INTEGER`, () => {});
  // Modo de selección de clips:
  //   'auto'   — IA segmenta capítulos + elige highlights (comportamiento por defecto, idéntico al anterior).
  //   'manual' — tras transcribir, el job pausa en status='awaiting_selection' esperando que el usuario
  //              envíe los rangos vía POST /api/clips/jobs/:id/submit-ranges.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN mode TEXT DEFAULT 'auto'`, () => {});
  // Rangos elegidos por el usuario en modo manual (JSON: [{start,end}]). Guardados para auditoría / debug.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN manual_ranges TEXT`, () => {});
  // Si en modo manual el usuario quiere que la IA genere hook + caption + post_captions (gpt-4o-mini) por clip.
  // 1 = sí (default), 0 = no (clip queda con strings vacíos, el usuario los rellena en el editor).
  db.run(`ALTER TABLE clip_jobs ADD COLUMN hook_auto_enabled INTEGER DEFAULT 1`, () => {});
  // Cleanup automático: 1 = archivos físicos del job (video fuente, base.mp4, final.mp4)
  // fueron purgados del disco. La fila se conserva en DB pero el clip no es re-exportable.
  db.run(`ALTER TABLE clip_jobs ADD COLUMN files_purged INTEGER DEFAULT 0`, () => {});

  // CREATE TABLE clips DEBE ir ANTES de los ALTER TABLE clips siguientes, sino en una DB fresca
  // las migraciones fallan silenciosamente y la tabla nace incompleta. Bug latente histórico:
  // este orden parecía funcionar en la DB de producción porque clips ya existía con todas las
  // columnas; pero en cualquier máquina nueva (clone limpio, nuevo worktree, CI) la tabla salía
  // sin post_captions_cache, render_mode, hook_color, etc. y los INSERTs explotaban.
  db.run(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES clip_jobs(id) ON DELETE CASCADE,
      clip_index INTEGER NOT NULL,
      title TEXT,
      hook TEXT,
      caption TEXT,
      keywords TEXT,
      post_caption TEXT,
      post_caption_tone TEXT DEFAULT 'pregunta',
      start_seconds REAL NOT NULL,
      end_seconds REAL NOT NULL,
      virality_score INTEGER,
      reasoning TEXT,
      font_hook TEXT DEFAULT 'Anton',
      font_caption TEXT DEFAULT 'Inter SemiBold',
      font_keyword TEXT DEFAULT 'Montserrat Bold',
      keyword_color TEXT DEFAULT '#FDE047',
      camera_motion TEXT DEFAULT 'zoom-in',
      sub_position INTEGER DEFAULT 68,
      output_path TEXT,
      output_resolution TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrations: aspect_ratio per-clip (override del job-level si el editor lo cambia)
  db.run(`ALTER TABLE clips ADD COLUMN aspect_ratio TEXT DEFAULT '9:16'`, () => {});
  // Cache de las 3 versiones del post_caption por tono (JSON: {pregunta, storytelling, insight})
  db.run(`ALTER TABLE clips ADD COLUMN post_captions_cache TEXT`, () => {});
  // Estilo de borde y sombra de subtítulos
  db.run(`ALTER TABLE clips ADD COLUMN outline_enabled INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN outline_thickness INTEGER DEFAULT 5`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN shadow_opacity INTEGER DEFAULT 50`, () => {});
  // Modelo Opus: el render pesado se separa en (1) base.mp4 sin subs y (2) export con subs on-demand.
  // 'overlay' = preview en HTML/CSS sobre base.mp4, export quema subs solo al pedir.
  // 'burned-legacy' = clips antiguos: el output_path ya tiene subs quemados, no editable en preview.
  db.run(`ALTER TABLE clips ADD COLUMN render_mode TEXT DEFAULT 'overlay'`, () => {
    // Marcar clips ya existentes con output_path como legacy (no se les puede editar el preview).
    db.run(`UPDATE clips SET render_mode='burned-legacy' WHERE output_path IS NOT NULL AND render_mode IS NULL`, () => {});
  });
  db.run(`ALTER TABLE clips ADD COLUMN base_video_path TEXT`, () => {});
  // Hash de params que afectan al base.mp4 (start/end/aspect/camera_motion). Si cambian, regeneramos base.
  db.run(`ALTER TABLE clips ADD COLUMN base_params_hash TEXT`, () => {});
  // Overrides de chunks de subtítulos: JSON [{idx, text, hidden}]
  db.run(`ALTER TABLE clips ADD COLUMN caption_overrides TEXT`, () => {});
  // Tipografía granular (paridad con editores tipo Opus): tamaño, italic, underline, fondo de keyword.
  db.run(`ALTER TABLE clips ADD COLUMN hook_font_size INTEGER`, () => {}); // null = adaptativo (legacy)
  db.run(`ALTER TABLE clips ADD COLUMN caption_font_size INTEGER DEFAULT 58`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN hook_italic INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN hook_underline INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN caption_italic INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN caption_underline INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN keyword_italic INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN keyword_underline INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN keyword_bg_color TEXT`, () => {}); // null = sin fondo
  db.run(`ALTER TABLE clips ADD COLUMN keyword_bg_opacity INTEGER DEFAULT 100`, () => {});
  // Transición de entrada/salida del clip. Valores: 'none', 'fade-in', 'fade-out', 'fade-cross',
  // 'zoom-in' (entry), 'zoom-out' (exit), 'zoom-cross' (ambos). Default 'none'.
  db.run(`ALTER TABLE clips ADD COLUMN transition TEXT DEFAULT 'none'`, () => {});
  // Gancho visible en el video. 0 oculta el hook; texto sigue editable pero no se quema.
  db.run(`ALTER TABLE clips ADD COLUMN hook_enabled INTEGER DEFAULT 1`, () => {});
  // Colores del texto base (sin keywords). Default blanco para mantener compatibilidad.
  db.run(`ALTER TABLE clips ADD COLUMN hook_color TEXT DEFAULT '#FFFFFF'`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN caption_color TEXT DEFAULT '#FFFFFF'`, () => {});
  // Color del outline (borde) del texto. Default negro. Cuando el texto es oscuro conviene cambiar a blanco.
  db.run(`ALTER TABLE clips ADD COLUMN outline_color TEXT DEFAULT '#000000'`, () => {});
  // Karaoke style: la palabra se "ilumina" mientras se dice. Atenúa las palabras aún no dichas.
  db.run(`ALTER TABLE clips ADD COLUMN karaoke_enabled INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE clips ADD COLUMN karaoke_dim_opacity INTEGER DEFAULT 50`, () => {});

  // Plantillas de estilo guardadas por el usuario. Cada plantilla = snapshot de ~25 params del editor.
  db.run(`
    CREATE TABLE IF NOT EXISTS clip_templates (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      params TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AS Reels Cleaner — toma cruda corta (≤5 min) que se limpia de silencios y se exporta
  // como reel vertical con subs IG. Distinto de clip_jobs: aquí NO se selecciona un highlight,
  // se procesa el video completo aplicando los cortes que el usuario validó.
  db.run(`
    CREATE TABLE IF NOT EXISTS reel_jobs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      source_filename TEXT,
      title TEXT,
      duration_seconds REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      stage_index INTEGER DEFAULT 0,
      error_message TEXT,
      whisper_json_path TEXT,
      source_video_path TEXT,
      output_path TEXT,
      output_duration_seconds REAL,
      threshold_ms INTEGER DEFAULT 500,
      cuts_json TEXT,
      whisper_cost_usd REAL DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      files_purged INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP
    )
  `);

  // Reels Cleaner — paso 2 de revisión (estilo de subtítulos + texto editado).
  // base_video_path: video con cortes aplicados pero SIN subs quemados (modelo Clips).
  // El final con subs se genera en burnFinal() reusando ese base, mucho más rápido que re-cortar.
  db.run(`ALTER TABLE reel_jobs ADD COLUMN base_video_path TEXT`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN remapped_words_json TEXT`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN caption_overrides TEXT`, () => {}); // JSON [{idx, text, hidden}]
  db.run(`ALTER TABLE reel_jobs ADD COLUMN font_caption TEXT DEFAULT 'InterSemiBold'`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN caption_color TEXT DEFAULT '#FFFFFF'`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN outline_color TEXT DEFAULT '#000000'`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN caption_font_size INTEGER DEFAULT 62`, () => {});
  // 40..90 (mismo rango que Clips). Default 68 = subs centrados a ~700px del borde
  // inferior en frame 1080x1920 → DEBAJO del bloque de UI de TikTok (~540px) y de IG (~400px).
  // Cualquier valor <60 invade la zona del action bar de TikTok.
  db.run(`ALTER TABLE reel_jobs ADD COLUMN sub_position INTEGER DEFAULT 68`, () => {
    // Migración suave: jobs viejos quedaron con default=50 (invade UI TikTok). Subimos a 68
    // SOLO si el job todavía no llegó a 'done' (no queremos cambiar render ya entregados).
    // El frontend marcará preview_dirty=1 al volver a entrar, así se re-renderiza.
    db.run(`UPDATE reel_jobs SET sub_position=68, preview_dirty=1
            WHERE sub_position=50 AND status != 'done'`, () => {});
  });
  db.run(`ALTER TABLE reel_jobs ADD COLUMN preview_dirty INTEGER DEFAULT 1`, () => {}); // 1 = output_path no refleja los ajustes actuales
  // Grosor del borde de subs (0..10). 0 = sin borde. Default 4 ≈ el que se quema actualmente.
  db.run(`ALTER TABLE reel_jobs ADD COLUMN outline_thickness INTEGER DEFAULT 4`, () => {});
  // Costo acumulado de las llamadas LLM de sugerencia musical en este reel (puede llamarse varias veces).
  db.run(`ALTER TABLE reel_jobs ADD COLUMN llm_cost_suggest_usd REAL DEFAULT 0`, () => {});

  // Reels Cleaner — paso 3 música de fondo (opcional).
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_track_id TEXT`, () => {}); // null = sin música
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_volume_db INTEGER DEFAULT -16`, () => {}); // -30 a 0
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_ducking INTEGER DEFAULT 1`, () => {}); // 1 = auto-bajar bajo voz
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_fade_in REAL DEFAULT 1.0`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_fade_out REAL DEFAULT 1.5`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_start_offset REAL DEFAULT 0`, () => {}); // seg que se saltan del inicio del track
  db.run(`ALTER TABLE reel_jobs ADD COLUMN music_skipped INTEGER DEFAULT 0`, () => {}); // 1 = usuario saltó el paso, exportar sin música

  // Reels Cleaner — procesamiento de voz (paso 2). Para fuentes con audio desnivelado.
  // voice_autolevel = 1: aplica loudnorm EBU R128 a -16 LUFS (estándar IG/TikTok) antes del burn-in.
  // voice_gain_db: ajuste fino sobre el resultado (volume=XdB). Rango -6..+12 dB.
  db.run(`ALTER TABLE reel_jobs ADD COLUMN voice_autolevel INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE reel_jobs ADD COLUMN voice_gain_db INTEGER DEFAULT 0`, () => {});

  // Catálogo de música: tracks subidos por el owner para usar en reels.
  // tags se guarda como JSON array de strings (slugs del catálogo predefinido en api/reels/musicTags.js).
  db.run(`
    CREATE TABLE IF NOT EXISTS music_tracks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT,
      tags TEXT,
      bpm INTEGER,
      duration_seconds REAL,
      file_path TEXT NOT NULL,
      source TEXT,
      license TEXT,
      uploaded_by_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tracks remotos (Jamendo, etc): el archivo NO está en disco hasta que se use por primera
  // vez. file_path arranca vacío; lazy download al primer mix. external_id permite dedupe
  // entre múltiples curaciones del mismo provider.
  db.run(`ALTER TABLE music_tracks ADD COLUMN external_provider TEXT`, () => {}); // 'jamendo', null para locales
  db.run(`ALTER TABLE music_tracks ADD COLUMN external_id TEXT`, () => {});
  db.run(`ALTER TABLE music_tracks ADD COLUMN external_audio_url TEXT`, () => {});
  db.run(`ALTER TABLE music_tracks ADD COLUMN external_preview_url TEXT`, () => {});
  db.run(`ALTER TABLE music_tracks ADD COLUMN thumbnail_url TEXT`, () => {});
  db.run(`ALTER TABLE music_tracks ADD COLUMN license_url TEXT`, () => {});
  // file_path se vuelve nullable para tracks remotos no descargados aún.
  // SQLite no permite ALTER COLUMN, pero el INSERT de tracks remotos puede pasar '' o NULL.
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_music_external ON music_tracks(external_provider, external_id) WHERE external_provider IS NOT NULL`, () => {});

  // ─────────────────────────────────────────────────────────────────────────
  // Generador de ideas (build_idea_map): el usuario entrega dos columnas crudas
  // (vida que NO quiero / vida que SÍ quiero) y la herramienta extrae territorios,
  // valida (Fallo 1, 2, 3) y solo si el insumo pasa, genera 4-5 ideas con torsión.
  // Multi-turno: cada repregunta es un turno; máx 2 por filtro, 5 totales.
  //
  // status:
  //   'awaiting_correction' — la compuerta rechazó, espera respuesta del usuario al repregunta
  //   'success' — generó ideas, terminado
  //   'exhausted' — agotó turnos sin pasar, terminado (no se desbloquea solo)
  // ─────────────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS idea_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      vida_no_quiero TEXT NOT NULL,
      vida_si_quiero TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_correction',
      turn INTEGER NOT NULL DEFAULT 1,
      attempts_per_filter TEXT DEFAULT '{}',
      history TEXT DEFAULT '[]',
      failed_filter TEXT,
      diagnostic TEXT,
      repregunta TEXT,
      axis_mode TEXT,
      structure TEXT,
      ideas TEXT,
      cost_usd REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_idea_maps_user_created ON idea_maps(user_id, created_at DESC)`, () => {});
  // Tema sobre el que se sacan ideas (ej: "mi negocio de café", "ser papá", "mi vida").
  // Permite que la herramienta sirva para cualquier dominio, no solo "vida".
  // Mapas antiguos creados antes de esta columna quedan con NULL — el service usa fallback.
  db.run(`ALTER TABLE idea_maps ADD COLUMN tema TEXT`, () => {});

  // Magic link tokens — login sin contraseña por email (15 min, un solo uso).
  // Se guarda el hash SHA-256 del token, nunca el token en claro.
  db.run(`
    CREATE TABLE IF NOT EXISTS magic_link_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // OAuth 2.1 server (para MCP remoto — Claude.ai conecta vía Custom Connector)
  // Spec: RFC 7591 (DCR), RFC 9728 (Protected Resource Metadata), RFC 8414 (AS Metadata).
  // Tokens guardados como SHA-256 hash, nunca en claro.
  // ─────────────────────────────────────────────────────────────────────────

  // Clientes OAuth registrados dinámicamente (Claude.ai se registra solo vía DCR).
  // redirect_uris: JSON array. client_secret_hash: NULL para clientes públicos (PKCE-only).
  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_secret_hash TEXT,
      client_name TEXT,
      redirect_uris TEXT NOT NULL,
      token_endpoint_auth_method TEXT DEFAULT 'none',
      grant_types TEXT DEFAULT '["authorization_code","refresh_token"]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP
    )
  `);

  // Authorization codes (vida ≤10 min, single-use). PKCE obligatorio (S256).
  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_auth_codes (
      code_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL DEFAULT 'S256',
      scope TEXT,
      resource TEXT,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Access tokens (TTL 1h). Hash SHA-256, nunca el token raw.
  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_access_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      scope TEXT,
      resource TEXT,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP
    )
  `);

  // Refresh tokens (TTL 30d). Rotación: cada refresh emite nuevo y revoca el anterior.
  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      scope TEXT,
      resource TEXT,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      replaced_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // MCP audit log: cada tool call queda registrado. Permite ver al admin qué hizo
  // cada usuario via MCP, costo agregado, errores. args_summary es un JSON truncado
  // (max 500 chars) — no guardamos urls completas ni transcripts por privacidad.
  db.run(`
    CREATE TABLE IF NOT EXISTS mcp_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      client_id TEXT,
      tool_name TEXT NOT NULL,
      args_summary TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      duration_ms INTEGER,
      cost_usd REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_created ON mcp_audit_log(user_id, created_at DESC)`, () => {});

  // Cuotas por usuario para uso del MCP. NULL = sin límite (default para owner).
  // Si un usuario excede su cuota diaria, el tool MCP devuelve error claro.
  // Se aplican solo a tools que cuestan dinero (transcribe_video_url).
  db.run(`ALTER TABLE users ADD COLUMN mcp_quota_transcriptions_per_day INTEGER`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN mcp_disabled INTEGER DEFAULT 0`, () => {});

  console.log('Esquema de base de datos inicializado correctamente.');
});

export default db;
