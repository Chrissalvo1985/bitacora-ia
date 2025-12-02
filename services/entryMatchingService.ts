import OpenAI from 'openai';
import { Entry, TaskItem } from '../types';
import { callOpenAI } from './openaiRateLimiter';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface MatchResult {
  shouldUpdate: boolean;
  entryToUpdate?: { id: string; summary: string; type: string };
  taskToUpdate?: { entryId: string; taskIndex: number; task: TaskItem };
  confidence: number;
  reason: string;
  completionNotes?: string; // Observaciones extraídas del texto al completar
}

export const findRelatedEntry = async (
  text: string,
  existingEntries: Entry[],
  existingTasks: TaskItem[]
): Promise<MatchResult> => {
  // Limit to recent entries and pending tasks for performance
  const recentEntries = existingEntries.slice(0, 50);
  const pendingTasks = existingTasks.filter(t => !t.isDone).slice(0, 30);

  const entriesContext = recentEntries
    .map(e => `ID: ${e.id} | Tipo: ${e.type} | Resumen: ${e.summary} | Libreta: ${e.bookId}`)
    .join('\n');

  const tasksContext = pendingTasks
    .map((t, idx) => `Índice: ${idx} | Descripción: ${t.description}${t.assignee ? ` | Responsable: ${t.assignee}` : ''}${t.dueDate ? ` | Fecha: ${t.dueDate}` : ''}`)
    .join('\n');

  const prompt = `Analiza si el siguiente texto del usuario es una ACTUALIZACIÓN/COMPLETACIÓN de una tarea existente o una NUEVA entrada.

TEXTO DEL USUARIO: "${text}"

ENTRADAS EXISTENTES:
${entriesContext || 'No hay entradas'}

TAREAS PENDIENTES:
${tasksContext || 'No hay tareas pendientes'}

INSTRUCCIONES CRÍTICAS - SÉ MUY RESTRICTIVO:

1. SOLO marca shouldUpdate=true si el texto contiene EXPLÍCITAMENTE palabras que indican COMPLETACIÓN:
   - "está listo", "está terminado", "está hecho", "está completado", "está finalizado"
   - "ya terminé", "ya completé", "ya hice", "ya envié", "ya mandé", "ya revisé"
   - "listo", "terminado", "hecho", "completado" (al inicio o final de la oración)
   - "done", "finished", "ready"

2. NUNCA marques shouldUpdate=true si el texto es:
   - Una NUEVA información, observación o nota
   - Una NUEVA tarea o pendiente
   - Una actualización de estado que NO indica completación
   - Un comentario general sobre un tema
   - Una pregunta o duda
   - Información descriptiva sin indicadores de completación

3. EJEMPLOS DE NUEVAS ENTRADAS (shouldUpdate=false):
   - "El panel BI tiene un problema" → NUEVA NOTA
   - "Revisar el documento mañana" → NUEVA TAREA
   - "Observación: el dashboard muestra datos incorrectos" → NUEVA NOTA
   - "Nota: Juan comentó sobre el proyecto" → NUEVA NOTA
   - "Comentario sobre la reunión: fue productiva" → NUEVA NOTA
   - "Panel de ventas: observación sobre métricas" → NUEVA NOTA (es información, no completación)

4. EJEMPLOS DE ACTUALIZACIONES (shouldUpdate=true):
   - "Ya terminé el modelo BI de Andina" → ACTUALIZACIÓN
   - "Listo el documento para Juan" → ACTUALIZACIÓN
   - "Completé la revisión de KPIs" → ACTUALIZACIÓN
   - "Ya envié el correo a María" → ACTUALIZACIÓN

5. Si el texto incluye observaciones junto con la completación, extráelas:
   - "Listo el modelo BI, nota: necesita revisión final" → completionNotes: "necesita revisión final"

6. REGLA DE ORO: En caso de duda, shouldUpdate=false. Es mejor crear una nueva entrada que completar una tarea incorrectamente.

Responde en JSON:
{
  "shouldUpdate": true/false,
  "entryToUpdate": {"id": "...", "summary": "...", "type": "..."} o null,
  "taskToUpdate": {"entryId": "...", "taskIndex": número, "task": {...}} o null,
  "confidence": 0-100,
  "reason": "explicación breve",
  "completionNotes": "observaciones extraídas del texto" o null
}`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que detecta si un texto actualiza contenido existente o es nuevo.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent matching
      max_tokens: 500,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { shouldUpdate: false, confidence: 0, reason: 'No se pudo analizar' };
    }

    const data = JSON.parse(content) as MatchResult;
    
    // Only update if confidence is VERY high (more restrictive)
    if (data.confidence < 85) {
      return { shouldUpdate: false, confidence: data.confidence, reason: data.reason };
    }

    return data;
  } catch (error) {
    console.error('Entry matching error:', error);
    return { shouldUpdate: false, confidence: 0, reason: 'Error al analizar' };
  }
};

