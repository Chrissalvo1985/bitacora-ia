// PDF Text Extraction Service using pdf.js
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

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
    
    // Load the PDF
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const totalPages = pdf.numPages;
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    // Clean up the text
    const cleanedText = fullText
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n')  // Remove excessive newlines
      .trim();
    
    console.log(`Extracted ${cleanedText.length} characters from ${totalPages} pages`);
    
    return cleanedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('No se pudo extraer el texto del PDF. El archivo podría estar protegido o dañado.');
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

