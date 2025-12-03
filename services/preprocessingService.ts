/**
 * Preprocessing Service
 * Handles text cleaning, normalization, and note length detection
 */

const NOTE_LENGTH_THRESHOLD = 500; // Characters

/**
 * Cleans text by removing special characters and normalizing spaces
 */
export function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim()
    // Remove special control characters but keep newlines for structure
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normalizes text: lowercase, optional accent removal, normalization
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    // Normalize unicode characters (NFD to NFC)
    .normalize('NFC')
    .trim();
}

/**
 * Detects if a note is short or long based on length and complexity
 */
export function detectNoteLength(text: string): 'short' | 'long' {
  if (!text) return 'short';
  
  const cleaned = cleanText(text);
  const length = cleaned.length;
  
  // Simple threshold-based detection
  // Can be enhanced with complexity metrics (sentence count, word count, etc.)
  if (length < NOTE_LENGTH_THRESHOLD) {
    return 'short';
  }
  
  // Additional complexity check: count sentences
  const sentenceCount = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const wordCount = cleaned.split(/\s+/).filter(w => w.length > 0).length;
  
  // If it's over threshold OR has many sentences/words, it's long
  if (length >= NOTE_LENGTH_THRESHOLD || sentenceCount > 5 || wordCount > 100) {
    return 'long';
  }
  
  return 'short';
}

/**
 * Preprocesses an entry: returns cleaned, normalized text and length detection
 */
export function preprocessEntry(text: string): { 
  cleaned: string; 
  normalized: string; 
  length: 'short' | 'long' 
} {
  const cleaned = cleanText(text);
  const normalized = normalizeText(cleaned);
  const length = detectNoteLength(cleaned);
  
  return {
    cleaned,
    normalized,
    length,
  };
}

