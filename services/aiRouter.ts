import OpenAI from 'openai';
import { callOpenAI } from './openaiRateLimiter';

// Get OpenAI API key securely
function getOpenAIApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!key || key === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key no configurada. Por favor configura VITE_OPENAI_API_KEY en .env.local');
  }
  return key;
}

const openai = new OpenAI({
  apiKey: getOpenAIApiKey(),
  dangerouslyAllowBrowser: true,
});

export type AnalysisStep = 'preprocess' | 'classify' | 'extract' | 'summarize' | 'analyze';

export interface RouteMetadata {
  length: 'short' | 'long';
  hasAttachment: boolean;
}

/**
 * Routes analysis steps based on entry characteristics
 * Always uses gpt-4o-mini
 * Returns array of steps to execute in order
 */
export async function routeAnalysisSteps(
  text: string,
  metadata: RouteMetadata
): Promise<AnalysisStep[]> {
  // Simple rule-based routing for now
  // Can be enhanced with AI-based routing if needed
  
  const { length, hasAttachment } = metadata;
  
  // For short notes: minimal steps
  if (length === 'short' && !hasAttachment) {
    return ['preprocess', 'classify', 'summarize'];
  }
  
  // For short notes with attachments: add extraction
  if (length === 'short' && hasAttachment) {
    return ['preprocess', 'classify', 'extract', 'summarize'];
  }
  
  // For long notes: full analysis
  if (length === 'long' && !hasAttachment) {
    return ['preprocess', 'classify', 'extract', 'analyze', 'summarize'];
  }
  
  // For long notes with attachments: complete pipeline
  if (length === 'long' && hasAttachment) {
    return ['preprocess', 'classify', 'extract', 'analyze', 'summarize'];
  }
  
  // Default: full pipeline
  return ['preprocess', 'classify', 'extract', 'analyze', 'summarize'];
}

/**
 * AI-based routing (optional, more sophisticated)
 * Uses GPT to determine which steps are needed
 */
export async function routeAnalysisStepsAI(
  text: string,
  metadata: RouteMetadata
): Promise<AnalysisStep[]> {
  const { length, hasAttachment } = metadata;
  
  const prompt = `Analiza este texto y determina qué pasos de análisis necesita:

Texto (${length === 'short' ? 'corto' : 'largo'}):
"${text.slice(0, 500)}"

Tiene adjunto: ${hasAttachment ? 'Sí' : 'No'}

Pasos disponibles:
- preprocess: Limpieza y normalización básica
- classify: Clasificar tipo de nota y asignar libreta
- extract: Extraer tareas, decisiones, entidades
- analyze: Análisis profundo de temas y relaciones
- summarize: Generar resumen

Responde SOLO con un JSON array de los pasos necesarios en orden, por ejemplo:
["preprocess", "classify", "extract", "summarize"]`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un router inteligente que determina qué pasos de análisis necesita un texto. Responde solo con JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      // Fallback to rule-based
      return routeAnalysisSteps(text, metadata);
    }

    const data = JSON.parse(content);
    const steps = data.steps || data;
    
    // Validate steps
    const validSteps: AnalysisStep[] = ['preprocess', 'classify', 'extract', 'analyze', 'summarize'];
    const filteredSteps = (Array.isArray(steps) ? steps : [steps])
      .filter((step: string) => validSteps.includes(step as AnalysisStep)) as AnalysisStep[];
    
    // Always include preprocess and summarize
    if (!filteredSteps.includes('preprocess')) {
      filteredSteps.unshift('preprocess');
    }
    if (!filteredSteps.includes('summarize')) {
      filteredSteps.push('summarize');
    }
    
    return filteredSteps.length > 0 ? filteredSteps : routeAnalysisSteps(text, metadata);
  } catch (error) {
    console.error('Error in AI routing, falling back to rule-based:', error);
    // Fallback to rule-based routing
    return routeAnalysisSteps(text, metadata);
  }
}

