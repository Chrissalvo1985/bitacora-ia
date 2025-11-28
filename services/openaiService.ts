import OpenAI from 'openai';
import { Book, NoteType, Attachment } from '../types';

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
  dangerouslyAllowBrowser: true, // For client-side usage (required for this architecture)
});

export interface OpenAIResponse {
  targetBookName: string;
  type: NoteType;
  summary: string;
  tasks: { description: string; assignee?: string; dueDate?: string; priority?: string }[];
  entities: { name: string; type: string }[];
  suggestedPriority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const analyzeEntry = async (
  text: string,
  existingBooks: Book[],
  attachment?: Attachment
): Promise<OpenAIResponse> => {
  // Validate and sanitize input
  if (!text || text.trim().length === 0) {
    throw new Error('El texto no puede estar vacío');
  }
  
  // Limit text length for security and cost control
  const sanitizedText = text.trim().slice(0, 10000);
  
  // Build detailed books context with names and descriptions
  const booksContext = existingBooks.map(b => 
    `- "${b.name}"${b.context ? ` (Contexto: ${b.context})` : ''}`
  ).join('\n');
  
  const systemPrompt = `Eres un asistente personal IA extremadamente inteligente y eficiente.
Analiza la siguiente entrada del usuario (nota de voz, pensamiento rápido o resumen de reunión)${attachment ? ' junto con el archivo adjunto' : ''}.

Fecha Actual: ${new Date().toLocaleDateString('es-ES')}

LIBRETAS EXISTENTES (con su contexto):
${booksContext || 'No hay libretas existentes'}

INSTRUCCIONES CRÍTICAS:

1. ASIGNACIÓN DE LIBRETA (MUY IMPORTANTE):
   - Analiza PROFUNDAMENTE el contenido del texto y compáralo con el NOMBRE y CONTEXTO de cada libreta existente.
   - LEE el contexto de cada libreta para entender de qué trata realmente.
   - NO asignes a múltiples libretas. Toda la información relacionada debe ir a UNA SOLA libreta.
   - Si el texto menciona temas específicos (ej: "Paneles BI", "Panel de Supervisores"), busca la libreta cuyo CONTEXTO o NOMBRE coincida mejor con ese tema.
   - Si menciona varios elementos del mismo tema/proyecto, TODO debe ir a la misma libreta.
   - Ejemplo: Si el texto habla de "Paneles BI" y hay una libreta "Paneles BI" o una libreta cuyo contexto mencione "BI" o "Paneles", asigna TODO ahí.
   - Ejemplo: Si el texto menciona "Panel de Supervisores" y hay una libreta "Panel de Supervisores" o cuyo contexto mencione "supervisores", asigna ahí, NO a otra libreta.
   - Si no hay match claro con el CONTEXTO de ninguna libreta existente, sugiere un nombre NUEVO, corto y descriptivo.
   - IMPORTANTE: Si el texto contiene información sobre múltiples elementos del mismo tema (ej: varios paneles con sus observaciones), es UNA SOLA entrada en UNA SOLA libreta, NO múltiples entradas.
   - El nombre de la libreta debe ser EXACTAMENTE igual al nombre de una libreta existente (comparando sin distinguir mayúsculas/minúsculas) o un nombre nuevo.

2. DISTINCIÓN CRÍTICA: INFORMACIÓN vs TAREAS:
   
   INFORMACIÓN/ANOTACIONES (NO crear tareas):
   - Descripciones de estado actual: "Panel X tiene Y observación", "El dashboard muestra Z"
   - Información para referencia: "Panel BI de Ventas: observación sobre métricas"
   - Datos, hechos, estados: "Panel de Supervisores está funcionando con X problema"
   - Correos informativos, reportes, estados de proyectos
   - Listas de elementos con sus características/observaciones
   - Cuando el usuario solo está documentando información para tenerla disponible
   
   TAREAS REALES (SÍ crear tareas):
   - Acciones explícitas a realizar: "Hay que revisar el Panel BI", "Necesito ajustar el dashboard"
   - Solicitudes directas: "Revisar Panel X", "Ajustar métricas de Y"
   - Compromisos: "Debo enviar el reporte", "Tengo que coordinar con Z"
   - Palabras clave de acción: "revisar", "ajustar", "enviar", "coordinar", "implementar", "corregir", "mejorar" cuando indican algo PENDIENTE
   
   REGLA DE ORO: Si el texto solo describe ESTADO ACTUAL o INFORMACIÓN para referencia, es NOTE sin tareas. Si menciona algo que DEBE HACERSE, es TASK con tareas.

3. CLASIFICACIÓN DE TIPO:
   - NOTE: Información, observaciones, estados actuales, datos para referencia. NO tiene tareas pendientes.
   - TASK: Solo si hay acciones PENDIENTES explícitas que deben realizarse.
   - DECISION: Acuerdos, decisiones tomadas, "acordamos", "definimos", "se decidió".
   - IDEA: Propuestas, sugerencias, "podríamos", "sería interesante", "me gustaría".
   - RISK: Problemas, riesgos, bloqueos, "hay un problema", "riesgo", "bloqueo".

4. DETECCIÓN DE MISIONES (SOLO si son tareas reales):
   - SOLO crea tareas si el texto menciona acciones PENDIENTES que deben realizarse.
   - NO crees tareas para información descriptiva o estados actuales.
   - Palabras clave que indican misiones REALES: "hay que [hacer algo]", "tengo que [hacer algo]", "debo [hacer algo]", "pendiente [hacer algo]", "necesito [hacer algo]".
   - Extrae responsable si se menciona (nombres de personas, "yo", "tú", "equipo X").
   - Extrae fechas si se mencionan (mañana, lunes, próxima semana, fecha específica).

5. RESUMEN:
   - Crea un resumen limpio, directo y bien redactado en ESPAÑOL.
   - ${attachment ? 'Si hay una imagen/archivo, describe brevemente qué contiene si es relevante.' : ''}
   - Si es información/anotación, resume el contenido de forma clara.
   - Si hay tareas reales, destácalas en el resumen.

6. ENTIDADES:
   - Extrae personas, empresas, proyectos mencionados con su tipo (PERSON, COMPANY, PROJECT, TOPIC).

7. PRIORIDAD:
   - HIGH: Urgente, con fecha cercana, crítico.
   - MEDIUM: Importante pero no urgente.
   - LOW: Nice to have, sin urgencia.

EJEMPLOS CLAROS:

INFORMACIÓN (NOTE, sin tareas):
- "Panel BI de Ventas: observación sobre métricas de conversión" → NOTE, sin tareas, libreta: "Paneles BI"
- "Panel de Supervisores muestra problema con actualización de datos" → NOTE, sin tareas, libreta: "Panel de Supervisores"
- "Correo sobre paneles: Panel X tiene Y, Panel Z tiene W" → NOTE, sin tareas, TODO en la misma libreta "Paneles BI"
- "Estado de paneles: Panel A funcionando, Panel B con observación X" → NOTE, sin tareas, libreta: "Paneles BI"
- "Paneles BI: Panel de Ventas - observación sobre métricas. Panel de Supervisores - problema con datos" → NOTE, sin tareas, UNA entrada en libreta "Paneles BI"
- Cuerpo de correo que lista paneles con sus observaciones → NOTE, sin tareas, TODO en UNA libreta relacionada

TAREAS REALES (TASK, con tareas):
- "Hay que revisar el Panel BI de Ventas" → TASK, tarea: "Revisar Panel BI de Ventas"
- "Necesito ajustar las métricas del dashboard" → TASK, tarea: "Ajustar métricas del dashboard"
- "Pendiente coordinar con el equipo sobre los paneles" → TASK, tarea: "Coordinar con equipo sobre paneles"
- "Debo corregir el Panel de Supervisores" → TASK, tarea: "Corregir Panel de Supervisores"

REGLA CRÍTICA: Si el texto es un correo, reporte o lista que solo describe ESTADO ACTUAL o INFORMACIÓN (ej: "Panel X tiene observación Y"), es NOTE sin tareas. Solo crea tareas si hay una acción EXPLÍCITA pendiente (ej: "Hay que revisar Panel X").

Responde SIEMPRE en formato JSON válido con este esquema exacto:
{
  "targetBookName": "nombre de libreta (debe ser EXACTAMENTE igual a una libreta existente o un nombre nuevo)",
  "type": "NOTE|TASK|DECISION|IDEA|RISK",
  "summary": "resumen en español que capture toda la información relevante",
  "tasks": [
    {
      "description": "descripción de la tarea (SOLO si es una acción pendiente real)",
      "assignee": "responsable si se menciona",
      "dueDate": "YYYY-MM-DD si se menciona fecha",
      "priority": "LOW|MEDIUM|HIGH"
    }
  ],
  "entities": [
    {"name": "nombre", "type": "PERSON|COMPANY|PROJECT|TOPIC"}
  ],
  "suggestedPriority": "LOW|MEDIUM|HIGH"
}

IMPORTANTE FINAL:
- Si el texto es solo información/anotación, "tasks" debe ser un array vacío [].
- Si el texto contiene múltiples elementos del mismo tema, TODO debe ir en UNA SOLA entrada en UNA SOLA libreta.
- El "targetBookName" debe coincidir EXACTAMENTE con el nombre de una libreta existente (comparando sin distinguir mayúsculas/minúsculas) o ser un nombre nuevo.`;

  const userPrompt = `Analiza este texto del usuario:

"${sanitizedText}"

INSTRUCCIONES ESPECÍFICAS:
1. Determina si es INFORMACIÓN/ANOTACIÓN (NOTE sin tareas) o contiene TAREAS REALES (TASK con tareas).
2. Asigna a la libreta correcta basándote en el NOMBRE y CONTEXTO de las libretas existentes.
3. Si es información sobre múltiples elementos del mismo tema, TODO debe ir en UNA SOLA entrada en UNA SOLA libreta.
4. Si es solo información descriptiva (correos, reportes, estados), NO crees tareas.`;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // If there's an attachment, add it to the message
    if (attachment) {
      if (attachment.type === 'image') {
        const base64Data = attachment.data.split(',')[1];
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza también esta imagen adjunta y extrae cualquier texto, información o acciones pendientes que contenga.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${attachment.mimeType};base64,${base64Data}`
              }
            }
          ]
        } as any);
      } else if (attachment.type === 'document' && attachment.mimeType === 'application/pdf') {
        // For PDFs, we can't extract text directly in the browser easily
        // But we can tell the AI to analyze it if we had OCR
        // For now, just mention it in the prompt
        messages.push({
          role: 'user',
          content: 'Hay un archivo PDF adjunto llamado "' + attachment.fileName + '". Si el usuario mencionó algo sobre este archivo en el texto, tenlo en cuenta. Si no, simplemente menciona que hay un PDF adjunto en el resumen.'
        });
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.5, // Lower temperature for more consistent classification
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const data = JSON.parse(content) as OpenAIResponse;
    
    // Ensure all required fields are present and sanitized
    return {
      targetBookName: (data.targetBookName || 'Bandeja de Entrada').slice(0, 100),
      type: data.type || NoteType.NOTE,
      summary: (data.summary || sanitizedText).slice(0, 2000),
      tasks: (data.tasks || []).slice(0, 20).map(t => ({
        description: t.description?.slice(0, 500) || '',
        assignee: t.assignee?.slice(0, 100),
        dueDate: t.dueDate?.slice(0, 10),
        priority: t.priority || 'MEDIUM',
      })),
      entities: (data.entities || []).slice(0, 50).map(e => ({
        name: e.name?.slice(0, 100) || '',
        type: e.type || 'TOPIC',
      })),
      suggestedPriority: data.suggestedPriority || 'MEDIUM',
    };
  } catch (error) {
    console.error('OpenAI Analysis Error:', error);
    // Fallback response
    return {
      targetBookName: 'Bandeja de Entrada',
      type: NoteType.NOTE,
      summary: sanitizedText || 'Archivo adjunto sin texto',
      tasks: [],
      entities: [],
      suggestedPriority: 'MEDIUM',
    };
  }
};

export const updateBookContext = async (
  bookName: string,
  currentContext: string | undefined,
  newEntrySummary: string
): Promise<string> => {
  const prompt = `Actúa como un "Gestor de Conocimiento" inteligente y silencioso.
Tienes una libreta llamada "${bookName}".

Contexto/Descripción actual de la libreta: "${currentContext || 'Sin descripción aún.'}"

El usuario acaba de agregar esta nueva nota: "${newEntrySummary}"

TU TAREA:
Redacta una NUEVA descripción corta (máximo 2 frases) para esta libreta que integre el contexto anterior con la nueva información.
El objetivo es mantener actualizada la definición de qué trata este proyecto o temática.

REGLAS ESTRICTAS:
1. Devuelve SOLAMENTE el texto de la descripción actualizada.
2. NO incluyas introducciones como "Aquí tienes", "Claro", "Descripción actualizada:", etc.
3. NO uses comillas al principio ni al final.
4. Estilo: Jovial, profesional, directo. En Español.

Ejemplo de salida CORRECTA:
Seguimiento del Proyecto Alpha, enfocado actualmente en la fase de presupuestos y contratación.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera descripciones concisas y profesionales.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || currentContext || '';
  } catch (error) {
    console.error('Error updating book context', error);
    return currentContext || '';
  }
};

export const generateSummary = async (
  entries: Array<{ summary: string; type: string; createdAt: number }>,
  period: 'day' | 'week' | 'month' = 'week'
): Promise<string> => {
  const periodLabel = period === 'day' ? 'día' : period === 'week' ? 'semana' : 'mes';
  
  const entriesText = entries
    .map(e => `- [${e.type}] ${e.summary} (${new Date(e.createdAt).toLocaleDateString('es-ES')})`)
    .join('\n');

  const prompt = `Eres un asistente que genera resúmenes ejecutivos inteligentes.

El usuario quiere un resumen de su ${periodLabel} de trabajo. Aquí están las entradas:

${entriesText}

Genera un resumen ejecutivo en ESPAÑOL que:
1. Destaca lo más importante que pasó.
2. Identifica decisiones clave tomadas.
3. Lista pendientes críticos.
4. Señala patrones o temas recurrentes si los hay.
5. Es conciso pero completo (máximo 300 palabras).

Formato: Texto fluido y profesional, sin bullets excesivos.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera resúmenes ejecutivos claros y accionables.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || 'No se pudo generar el resumen.';
  } catch (error) {
    console.error('Error generating summary', error);
    return 'Error al generar el resumen.';
  }
};

export const queryBitacora = async (
  query: string,
  context: {
    entries: Array<{ summary: string; type: string; createdAt: number; bookName: string }>;
    books: Array<{ name: string; context?: string }>;
    tasks: Array<{ description: string; assignee?: string; dueDate?: string; isDone: boolean; completionNotes?: string }>;
  }
): Promise<string> => {
  const entriesText = context.entries
    .slice(0, 50) // Limit to recent 50 entries
    .map(e => `- [${e.type}] ${e.summary} (${e.bookName}, ${new Date(e.createdAt).toLocaleDateString('es-ES')})`)
    .join('\n');

  // Tareas pendientes
  const pendingTasksText = context.tasks
    .filter(t => !t.isDone)
    .map(t => `- ${t.description}${t.assignee ? ` (${t.assignee})` : ''}${t.dueDate ? ` [${t.dueDate}]` : ''}`)
    .join('\n');

  // Tareas completadas con observaciones (últimas 30)
  const completedTasksText = context.tasks
    .filter(t => t.isDone && t.completionNotes)
    .slice(0, 30)
    .map(t => `- ${t.description}${t.assignee ? ` (${t.assignee})` : ''}${t.dueDate ? ` [${t.dueDate}]` : ''} | Observaciones: ${t.completionNotes}`)
    .join('\n');

  const booksText = context.books.map(b => `- ${b.name}${b.context ? `: ${b.context}` : ''}`).join('\n');

  const prompt = `Eres un asistente inteligente que responde preguntas sobre la Bitácora del usuario.

CONTEXTO DISPONIBLE:

Libretas:
${booksText}

Entradas recientes:
${entriesText}

Pendientes activos:
${pendingTasksText || 'No hay pendientes activos'}

Tareas completadas recientes (con observaciones):
${completedTasksText || 'No hay tareas completadas con observaciones'}

IMPORTANTE: Las observaciones de las tareas completadas contienen información valiosa sobre el resultado o estado final de esas tareas. Úsalas para responder preguntas sobre qué se implementó, qué se encontró, o cualquier detalle relevante mencionado en las observaciones.

PREGUNTA DEL USUARIO:
"${query}"

Responde de forma clara, directa y útil en ESPAÑOL. Si la información no está disponible, dilo claramente.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que responde preguntas sobre la Bitácora del usuario de forma clara y útil.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content?.trim() || 'No se pudo procesar la consulta.';
  } catch (error) {
    console.error('Error querying bitacora', error);
    return 'Error al procesar la consulta.';
  }
};

