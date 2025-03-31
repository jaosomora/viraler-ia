// src/utils/validation.js

/**
 * Valida una URL para comprobar si es compatible con las plataformas soportadas
 * 
 * @param {string} url - URL a validar
 * @returns {Object} - { isValid, message, platform }
 */
export const validateVideoUrl = (url) => {
  if (!url || url.trim() === '') {
    return {
      isValid: false,
      message: 'Por favor ingresa una URL',
      platform: null
    };
  }

  // Plataformas soportadas con sus patrones
  const supportedPlatforms = [
    { 
      name: 'instagram', 
      regex: /https:\/\/(www\.)?instagram\.com\/(reel|p)\/[a-zA-Z0-9_-]+\/?/,
      message: 'URL de Instagram válida'
    },
    { 
      name: 'tiktok', 
      regex: /https:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      message: 'URL de TikTok válida'
    },
    { 
      name: 'youtube', 
      regex: /https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      message: 'URL de YouTube válida'
    },
    { 
      name: 'youtube-shorts', 
      regex: /https:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
      message: 'URL de YouTube Shorts válida'
    }
  ];

  // Verificar si la URL coincide con alguna de las plataformas soportadas
  for (const platform of supportedPlatforms) {
    if (platform.regex.test(url)) {
      return {
        isValid: true,
        message: platform.message,
        platform: platform.name
      };
    }
  }

  // Si no coincide con ninguna plataforma
  return {
    isValid: false,
    message: 'URL no válida. Soportamos Instagram Reels, TikTok, YouTube videos y YouTube Shorts',
    platform: null
  };
};
