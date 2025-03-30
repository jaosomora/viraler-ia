// api/utils/platformDetector.js

/**
 * Detecta la plataforma de la URL del video
 * 
 * @param {string} url - URL del video
 * @returns {string} - Nombre de la plataforma detectada
 */
export function detectPlatform(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (hostname.includes('instagram.com')) {
      return 'instagram';
    } else if (hostname.includes('tiktok.com')) {
      return 'tiktok';
    } else if (hostname.includes('youtube.com')) {
      const pathname = urlObj.pathname;
      if (pathname.includes('/shorts/')) {
        return 'youtube-shorts';
      }
      return 'youtube';
    } else {
      throw new Error('URL no compatible. Soportamos YouTube, Instagram Reels y TikTok.');
    }
  } catch (error) {
    throw new Error('URL inválida o no compatible. Soportamos YouTube, Instagram Reels y TikTok.');
  }
}

/**
 * Valida si la URL es compatible con las plataformas soportadas
 * 
 * @param {string} url - URL a validar
 * @returns {boolean} - True si la URL es válida, false en caso contrario
 */
export function isValidUrl(url) {
  try {
    const supportedPlatforms = [
      { name: 'Instagram', regex: /https:\/\/(www\.)?instagram\.com\/(reel|p)\/[a-zA-Z0-9_-]+\/?/ },
      { name: 'TikTok', regex: /https:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/ },
      { name: 'YouTube', regex: /https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/ },
      { name: 'YouTube Shorts', regex: /https:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/ }
    ];

    return supportedPlatforms.some(platform => platform.regex.test(url));
  } catch (error) {
    return false;
  }
}