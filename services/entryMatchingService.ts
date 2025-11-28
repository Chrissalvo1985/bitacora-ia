import OpenAI from 'openai';
import { Entry, TaskItem } from '../types';

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

  const prompt = `Analiza si el siguiente texto del usuario es una ACTUALIZACIÓN de algo existente o una NUEVA entrada.

TEXTO DEL USUARIO: "${text}"

ENTRADAS EXISTENTES:
${entriesContext || 'No hay entradas'}

TAREAS PENDIENTES:
${tasksContext || 'No hay tareas pendientes'}

INSTRUCCIONES:
1. Si el texto indica que algo está COMPLETADO, LISTO, TERMINADO, HECHO, FINALIZADO, etc., busca la tarea o entrada relacionada.
2. Si el texto menciona algo que ya existe (mismo proyecto, mismo tema, misma persona), podría ser una actualización.
3. Ejemplos de actualizaciones:
   - "está listo el modelo BI de Andina" → actualizar tarea relacionada con "modelo BI" o "Andina"
   - "completé la revisión de KPIs" → actualizar tarea con "revisión KPIs"
   - "ya envié el documento a Juan" → actualizar tarea con "enviar documento"
4. Si no hay match claro (confianza < 70%), es una nueva entrada.
5. IMPORTANTE: Si el texto incluye observaciones, notas o comentarios además de indicar que está completado, extrae esas observaciones. Por ejemplo:
   - "está listo el modelo BI, observación: necesita revisión final" → completionNotes: "necesita revisión final"
   - "completé la tarea, nota: se encontró un bug menor" → completionNotes: "se encontró un bug menor"
   - "listo, pero hay que ajustar el diseño" → completionNotes: "hay que ajustar el diseño"

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que detecta si un texto actualiza contenido existente o es nuevo.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent matching
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { shouldUpdate: false, confidence: 0, reason: 'No se pudo analizar' };
    }

    const data = JSON.parse(content) as MatchResult;
    
    // Only update if confidence is high enough
    if (data.confidence < 70) {
      return { shouldUpdate: false, confidence: data.confidence, reason: data.reason };
    }

    return data;
  } catch (error) {
    console.error('Entry matching error:', error);
    return { shouldUpdate: false, confidence: 0, reason: 'Error al analizar' };
  }
};

