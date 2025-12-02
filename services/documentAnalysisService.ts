import OpenAI from 'openai';
import { Entry, TaskItem, Book } from '../types';
import { callOpenAI } from './openaiRateLimiter';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface DocumentInsight {
  type: 'task' | 'risk' | 'duplicate' | 'deadline' | 'related' | 'update';
  title: string;
  description: string;
  action?: {
    type: 'create_task' | 'update_task' | 'create_entry' | 'update_entry' | 'link_entry';
    data?: any;
  };
  relatedEntries?: Array<{ id: string; summary: string; bookName: string }>;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DocumentAnalysis {
  insights: DocumentInsight[];
  suggestedBook?: string;
  summary: string;
  detectedTasks: Array<{ description: string; assignee?: string; dueDate?: string; priority?: string }>;
  detectedRisks: string[];
  relatedTopics: string[];
}

export const analyzeDocument = async (
  text: string,
  attachment: { type: string; mimeType: string; fileName: string; data: string },
  existingEntries: Entry[],
  existingBooks: Book[],
  existingTasks: TaskItem[]
): Promise<DocumentAnalysis> => {
  const entriesContext = existingEntries
    .slice(0, 30)
    .map(e => `- [${e.type}] ${e.summary} (ID: ${e.id}, Libreta: ${e.bookId})`)
    .join('\n');

  const tasksContext = existingTasks
    .filter(t => !t.isDone)
    .slice(0, 20)
    .map(t => `- ${t.description}${t.assignee ? ` (${t.assignee})` : ''}${t.dueDate ? ` [${t.dueDate}]` : ''}`)
    .join('\n');

  const booksContext = existingBooks.map(b => `- ${b.name}${b.context ? `: ${b.context}` : ''}`).join('\n');

  const systemPrompt = `Eres un analista inteligente de documentos. Analiza el documento/imagen proporcionado y el contexto de la bitácora del usuario.

CONTEXTO DE LA BITÁCORA:
Libretas existentes:
${booksContext}

Entradas recientes:
${entriesContext}

Tareas pendientes:
${tasksContext}

TU MISIÓN:
1. Analiza el documento/imagen profundamente
2. Identifica:
   - Tareas/pendientes que deberían agregarse
   - Riesgos o problemas detectados
   - Temas relacionados con entradas existentes (posibles duplicados o actualizaciones)
   - Incumplimientos de plazos mencionados
   - Información que actualiza tareas o entradas existentes
3. Para cada insight, determina si requiere acción del usuario

Responde en formato JSON con este esquema:
{
  "insights": [
    {
      "type": "task|risk|duplicate|deadline|related|update",
      "title": "Título del insight",
      "description": "Descripción detallada",
      "action": {
        "type": "create_task|update_task|create_entry|update_entry|link_entry",
        "data": {}
      },
      "relatedEntries": [{"id": "...", "summary": "...", "bookName": "..."}],
      "priority": "LOW|MEDIUM|HIGH"
    }
  ],
  "suggestedBook": "nombre de libreta sugerida",
  "summary": "resumen del documento",
  "detectedTasks": [{"description": "...", "assignee": "...", "dueDate": "...", "priority": "..."}],
  "detectedRisks": ["riesgo 1", "riesgo 2"],
  "relatedTopics": ["tema 1", "tema 2"]
}`;

  const userPrompt = `Analiza este ${attachment.type === 'image' ? 'imagen' : 'documento PDF'} llamado "${attachment.fileName}".

${text ? `Texto adicional proporcionado: "${text}"` : ''}

Busca especialmente:
- Tareas que deberían programarse
- Riesgos o problemas
- Conexiones con entradas/tareas existentes
- Información que actualiza algo ya existente (ej: "está listo el modelo BI de Andina" → actualizar tarea relacionada)
- Duplicados o temas similares
- Plazos vencidos o próximos a vencer`;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Add image if it's an image
    if (attachment.type === 'image') {
      const base64Data = attachment.data.split(',')[1];
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Analiza esta imagen en detalle.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:${attachment.mimeType};base64,${base64Data}`
            }
          }
        ]
      } as any);
    }

    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3000,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const data = JSON.parse(content) as DocumentAnalysis;
    return data;
  } catch (error) {
    console.error('Document analysis error:', error);
    return {
      insights: [],
      summary: 'Error al analizar el documento.',
      detectedTasks: [],
      detectedRisks: [],
      relatedTopics: [],
    };
  }
};

