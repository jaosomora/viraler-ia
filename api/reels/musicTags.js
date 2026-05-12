// api/reels/musicTags.js
// Catálogo predefinido de tags para tracks de música. Agrupado por categoría para que
// el UI los muestre ordenados (mood/energía/género) en vez de una lista plana caótica.
// El frontend usa esto para autocompletar al subir y para los chips de filtro.

export const MUSIC_TAGS = {
  mood: [
    { id: 'editorial_calmo', label: 'Editorial calmo', emoji: '🌅' },
    { id: 'energetico', label: 'Energético', emoji: '⚡' },
    { id: 'cinematico', label: 'Cinemático', emoji: '🎬' },
    { id: 'minimalista', label: 'Minimalista', emoji: '🪶' },
    { id: 'narrativo', label: 'Narrativo', emoji: '📖' },
    { id: 'uplifting', label: 'Uplifting', emoji: '🎉' },
    { id: 'reflexivo', label: 'Reflexivo', emoji: '💭' },
    { id: 'motivacional', label: 'Motivacional', emoji: '💪' },
    { id: 'emocional', label: 'Emocional', emoji: '❤️' },
    { id: 'misterioso', label: 'Misterioso', emoji: '🌙' },
    { id: 'epico', label: 'Épico', emoji: '🏔' },
    { id: 'romantico', label: 'Romántico', emoji: '🌸' },
    { id: 'melancolico', label: 'Melancólico', emoji: '🌧' },
    { id: 'alegre', label: 'Alegre', emoji: '☀️' },
    { id: 'dramatico', label: 'Dramático', emoji: '🎭' },
    { id: 'intimo', label: 'Íntimo', emoji: '🕯' },
    { id: 'meditativo', label: 'Meditativo', emoji: '🧘' },
  ],
  energy: [
    { id: 'energia_baja', label: 'Energía baja', emoji: '·' },
    { id: 'energia_media', label: 'Energía media', emoji: '· ·' },
    { id: 'energia_alta', label: 'Energía alta', emoji: '· · ·' },
    { id: 'energia_intensa', label: 'Energía intensa', emoji: '· · · ·' },
  ],
  genre: [
    { id: 'acustico', label: 'Acústico', emoji: '🎸' },
    { id: 'lofi', label: 'Lo-fi / chill', emoji: '🏖' },
    { id: 'ambient', label: 'Ambient', emoji: '🌊' },
    { id: 'electronico', label: 'Electrónico', emoji: '🎛' },
    { id: 'jazz', label: 'Jazz suave', emoji: '🎷' },
    { id: 'indie', label: 'Indie', emoji: '🪕' },
    { id: 'piano', label: 'Piano', emoji: '🎹' },
    { id: 'orquestal', label: 'Orquestal', emoji: '🎻' },
    { id: 'hiphop', label: 'Hip-hop instrumental', emoji: '🥁' },
    { id: 'synthwave', label: 'Synthwave / retro', emoji: '🌃' },
    { id: 'folk', label: 'Folk', emoji: '🌾' },
    { id: 'world', label: 'World / étnico', emoji: '🌍' },
    { id: 'corporativo', label: 'Corporativo', emoji: '💼' },
    { id: 'educacional', label: 'Educacional', emoji: '📚' },
    { id: 'comico', label: 'Cómico / playful', emoji: '😂' },
  ],
};

// Aplanada: todos los tags como un solo array (para validar inputs).
export const ALL_TAG_IDS = new Set(
  Object.values(MUSIC_TAGS).flatMap(g => g.map(t => t.id))
);

// Para LLM suggestion: lista para enviar a Claude/GPT con labels legibles.
export function tagsCatalogForLLM() {
  return Object.entries(MUSIC_TAGS).flatMap(([cat, items]) =>
    items.map(t => `${t.id} (${cat}: ${t.label})`)
  ).join(', ');
}

export function validateTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(t => typeof t === 'string' && ALL_TAG_IDS.has(t));
}
