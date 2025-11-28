// PDF Text Extraction Service using pdf.js
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker - try multiple strategies, fallback to no worker
let workerConfigured = false;

if (typeof window !== 'undefined') {
  // Strategy 1: Try to use worker from npm package (works in Vite)
  try {
    // @ts-ignore - import.meta.url is available in Vite
    if (import.meta?.url) {
      const workerUrl = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      workerConfigured = true;
    }
  } catch (e) {
    // Continue to next strategy
  }
  
  // Strategy 2: If Strategy 1 failed, try jsdelivr CDN (more reliable than cdnjs)
  if (!workerConfigured) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;
      workerConfigured = true;
    } catch (e) {
      // Continue to fallback
    }
  }
  
  // Strategy 3: Fallback - disable worker (uses main thread, slower but always works)
  if (!workerConfigured) {
    console.warn('PDF.js worker setup failed, using main thread mode (slower but reliable)');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
}

/**
 * Extract text from a PDF file
 * @param base64Data - Base64 encoded PDF data (with or without data URL prefix)
 * @returns Extracted text from all pages
 */
export async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data;
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Load the PDF with error handling
    let pdf;
    try {
      const loadingTask = pdfjsLib.getDocument({ 
        data: bytes,
        // Disable worker if there are issues
        useWorkerFetch: false,
        isEvalSupported: false,
      });
      pdf = await loadingTask.promise;
    } catch (workerError) {
      // If worker fails, try without worker
      console.warn('PDF worker failed, retrying without worker:', workerError);
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      const loadingTask = pdfjsLib.getDocument({ 
        data: bytes,
        useWorkerFetch: false,
        isEvalSupported: false,
      });
      pdf = await loadingTask.promise;
    }
    
    let fullText = '';
    const totalPages = pdf.numPages;
    
    // Limit to first 50 pages to avoid performance issues
    const maxPages = Math.min(totalPages, 50);
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items into a single string
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n\n';
      } catch (pageError) {
        console.warn(`Error extracting text from page ${pageNum}:`, pageError);
        // Continue with next page
      }
    }
    
    if (totalPages > maxPages) {
      fullText += `\n\n[Documento truncado: ${totalPages - maxPages} páginas adicionales no procesadas]`;
    }
    
    // Clean up the text
    const cleanedText = fullText
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n')  // Remove excessive newlines
      .trim();
    
    console.log(`Extracted ${cleanedText.length} characters from ${maxPages}/${totalPages} pages`);
    
    return cleanedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('No se pudo extraer el texto del PDF. El archivo podría estar protegido, dañado o ser demasiado complejo.');
  }
}

/**
 * Check if a PDF can be processed (not too large, etc.)
 * @param base64Data - Base64 encoded PDF data
 * @returns Object with canProcess flag and reason if not
 */
export function checkPDFProcessable(base64Data: string): { canProcess: boolean; reason?: string } {
  // Estimate file size from base64 (base64 is ~33% larger than original)
  const estimatedSize = (base64Data.length * 3) / 4;
  const maxSize = 50 * 1024 * 1024; // 50MB max
  
  if (estimatedSize > maxSize) {
    return {
      canProcess: false,
      reason: `El PDF es muy grande (${Math.round(estimatedSize / 1024 / 1024)}MB). Máximo permitido: 50MB.`
    };
  }
  
  return { canProcess: true };
}

