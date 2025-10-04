const winston = require('winston');
const path = require('path');
function parseRelativeDate(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const lower = dateStr.toLowerCase();
  const match = lower.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'second':
        return new Date(now.getTime() - value * 1000).toISOString();
      case 'minute':
        return new Date(now.getTime() - value * 60 * 1000).toISOString();
      case 'hour':
        return new Date(now.getTime() - value * 60 * 60 * 1000).toISOString();
      case 'day':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000).toISOString();
      case 'week':
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'year':
        return new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000).toISOString();
    }
  }
  return dateStr;
}
function parseRating(ratingStr) {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/(\d+(\.\d+)?)\s*star/i);
  return match ? parseFloat(match[1]) : 0;
}
function parseLikes(likesStr) {
  if (!likesStr) return 0;
  const match = likesStr.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}
function extractReviewId(element) {
  try {
    return element.getAttribute('data-review-id') || null;
  } catch (error) {
    return null;
  }
}
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
function createLogger(logDir = './logs') {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      })
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, 'scraper.log'),
        maxsize: 5242880,
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5
      })
    ]
  });
  return logger;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function isValidGoogleMapsUrl(url) {
  return url && (url.includes('google.com/maps') || url.includes('goo.gl'));
}
const SORT_OPTIONS = {
  newest: {
    keywords: [
      'Newest', 'החדשות ביותר', 'ใหม่ที่สุด', '最新', 'Más recientes',
      'Mais recentes', 'Neueste', 'Plus récent', 'Più recenti', 'Nyeste',
      'Новые', 'Nieuwste', 'جديد', 'Uusimmat', 'Najnowsze', 'Senaste'
    ]
  },
  highest: {
    keywords: [
      'Highest rating', 'הדירוג הגבוה ביותר', 'คะแนนสูงสุด', '最高評価',
      'Calificación más alta', 'Melhor avaliação', 'Höchste Bewertung',
      'Note la plus élevée', 'Valutazione più alta', 'Høyeste vurdering',
      'Наивысший рейтинг', 'Hoogste waardering', 'أعلى تقييم'
    ]
  },
  lowest: {
    keywords: [
      'Lowest rating', 'הדירוג הנמוך ביותר', 'คะแนนต่ำสุด', '最低評価',
      'Calificación más baja', 'Pior avaliação', 'Niedrigste Bewertung',
      'Note la plus basse', 'Valutazione più bassa', 'Laveste vurdering',
      'Наименьший рейтинг', 'Laagste waardering', 'أقل تقييم'
    ]
  },
  relevance: {
    keywords: [
      'Most relevant', 'רלוונטיות ביותר', 'เกี่ยวข้องมากที่สุด', '関連性',
      'Más relevantes', 'Mais relevantes', 'Relevanteste',
      'Plus pertinents', 'Più pertinenti', 'Mest relevante'
    ]
  }
};
function getSortKeywords(sortBy) {
  return SORT_OPTIONS[sortBy]?.keywords || SORT_OPTIONS.relevance.keywords;
}
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
module.exports = {
  parseRelativeDate,
  parseRating,
  parseLikes,
  extractReviewId,
  sanitizeFilename,
  createLogger,
  sleep,
  isValidGoogleMapsUrl,
  getSortKeywords,
  formatFileSize,
  generateId,
  SORT_OPTIONS
};