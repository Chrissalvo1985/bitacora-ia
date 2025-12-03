import OpenAI from 'openai';
import { Book, NoteType, Attachment, MultiTopicAnalysis, TopicEntry, TaskItem, Entry, Thread } from '../types';

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

import { callOpenAI } from './openaiRateLimiter';

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
  // Validate input - allow empty text if there's an attachment with content
  const hasAttachmentContent = attachment?.extractedText && attachment.extractedText.trim().length > 0;
  
  if ((!text || text.trim().length === 0) && !hasAttachmentContent) {
    throw new Error('El texto no puede estar vacío');
  }
  
  // Limit text length for security and cost control
  // If there's PDF content, allow more text since PDF is the main content
  const maxTextLength = hasAttachmentContent ? 5000 : 10000;
  const sanitizedText = (text || '').trim().slice(0, maxTextLength);
  
  // Build detailed books context with names and descriptions
  const booksContext = existingBooks.map(b => 
    `- "${b.name}"${b.description ? ` (${b.description})` : ''}`
  ).join('\n');
  
  const systemPrompt = `Eres un asistente personal IA extremadamente inteligente y eficiente.
Analiza la siguiente entrada del usuario (nota de voz, pensamiento rápido o resumen de reunión)${attachment ? ' junto con el archivo adjunto' : ''}.

Fecha Actual: ${new Date().toLocaleDateString('es-ES')}

LIBRETAS EXISTENTES:
${booksContext || 'No hay libretas existentes'}

INSTRUCCIONES CRÍTICAS:

1. ASIGNACIÓN DE LIBRETA (MUY IMPORTANTE):
   - Analiza PROFUNDAMENTE el contenido del texto y compáralo con el NOMBRE y DESCRIPCIÓN de cada libreta existente.
   - LEE la descripción de cada libreta para entender de qué trata realmente.
   - NO asignes a múltiples libretas. Toda la información relacionada debe ir a UNA SOLA libreta.
   - Si el texto menciona temas específicos (ej: "Paneles BI", "Panel de Supervisores"), busca la libreta cuyo NOMBRE o DESCRIPCIÓN coincida mejor con ese tema.
   - Si menciona varios elementos del mismo tema/proyecto, TODO debe ir a la misma libreta.
   - Ejemplo: Si el texto habla de "Paneles BI" y hay una libreta "Paneles BI" o una libreta cuya descripción mencione "BI" o "Paneles", asigna TODO ahí.
   - Ejemplo: Si el texto menciona "Panel de Supervisores" y hay una libreta "Panel de Supervisores" o cuya descripción mencione "supervisores", asigna ahí, NO a otra libreta.
   - Si no hay match claro con ninguna libreta existente, sugiere un nombre NUEVO, corto y descriptivo.
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

  // Adjust prompt based on whether there's text or just attachment
  const hasUserText = sanitizedText && sanitizedText.trim().length > 10;
  const hasPDFWithText = attachment?.type === 'document' && attachment.extractedText && attachment.extractedText.trim().length > 0;
  
  const userPrompt = hasUserText 
    ? `Analiza este texto del usuario:

"${sanitizedText}"

INSTRUCCIONES ESPECÍFICAS:
1. Determina si es INFORMACIÓN/ANOTACIÓN (NOTE sin tareas) o contiene TAREAS REALES (TASK con tareas).
2. Asigna a la libreta correcta basándote en el NOMBRE y DESCRIPCIÓN de las libretas existentes.
3. Si es información sobre múltiples elementos del mismo tema, TODO debe ir en UNA SOLA entrada en UNA SOLA libreta.
4. Si es solo información descriptiva (correos, reportes, estados), NO crees tareas.`
    : hasPDFWithText
    ? `El usuario ha subido un documento PDF sin texto adicional. Analiza ÚNICAMENTE el contenido del PDF que se proporcionará a continuación.

INSTRUCCIONES ESPECÍFICAS:
1. Analiza TODO el contenido del PDF como si fuera el texto principal del usuario.
2. Determina si es INFORMACIÓN/ANOTACIÓN (NOTE sin tareas) o contiene TAREAS REALES (TASK con tareas).
3. Asigna a la libreta correcta basándote en el NOMBRE y CONTEXTO de las libretas existentes.
4. Extrae toda la información relevante, tareas, decisiones, ideas o riesgos del PDF.
5. Si es solo información descriptiva (correos, reportes, estados), NO crees tareas.`
    : `Analiza este texto del usuario:

"${sanitizedText || '(Sin texto adicional)'}"

INSTRUCCIONES ESPECÍFICAS:
1. Determina si es INFORMACIÓN/ANOTACIÓN (NOTE sin tareas) o contiene TAREAS REALES (TASK con tareas).
2. Asigna a la libreta correcta basándote en el NOMBRE y DESCRIPCIÓN de las libretas existentes.
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
        const base64Data = attachment.data.includes(',') ? attachment.data.split(',')[1] : attachment.data;
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza también esta imagen adjunta y extrae cualquier texto, información o acciones pendientes que contenga. Usa la información de la imagen junto con el texto del usuario para crear una entrada completa.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${attachment.mimeType};base64,${base64Data}`
              }
            }
          ]
        } as any);
      } else if (attachment.type === 'document' && attachment.mimeType === 'application/pdf') {
        // For PDFs, check if we have extracted text
        if (attachment.extractedText && attachment.extractedText.trim().length > 0) {
          const pdfText = attachment.extractedText.trim();
          // Increase limit to 50000 chars for PDFs (GPT-4o-mini can handle this)
          const textToSend = pdfText.length > 50000 
            ? pdfText.slice(0, 50000) + '\n\n[... contenido truncado - documento muy largo ...]' 
            : pdfText;
          
          messages.push({
            role: 'user',
            content: `📄 DOCUMENTO PDF ADJUNTO: "${attachment.fileName}"

═══════════════════════════════════════════════════════════
CONTENIDO COMPLETO DEL PDF (EXTRAÍDO):
═══════════════════════════════════════════════════════════

${textToSend}

═══════════════════════════════════════════════════════════

⚠️ INSTRUCCIONES CRÍTICAS:
1. El contenido del PDF arriba es el CONTEXTO PRINCIPAL. Analízalo completamente.
2. El texto del usuario (si lo hay) es complementario o contexto adicional.
3. Crea la entrada basándote PRINCIPALMENTE en el contenido del PDF.
4. Extrae tareas, decisiones, ideas, riesgos o información relevante del PDF.
5. Si el usuario escribió algo, úsalo como contexto adicional, pero el PDF es la fuente principal.

El documento se guardará como referencia, pero la entrada debe reflejar TODO el contenido relevante del PDF.`
          });
          
          console.log(`📄 Sending PDF content to AI: ${textToSend.length} characters`);
        } else {
          console.warn('⚠️ PDF attachment has no extracted text');
          messages.push({
            role: 'user',
            content: `Hay un archivo PDF adjunto llamado "${attachment.fileName}", pero no se pudo extraer su contenido. Si el usuario mencionó algo sobre este archivo en el texto, tenlo en cuenta. El PDF se guardará como adjunto de referencia.`
          });
        }
      }
    }

    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.5, // Lower temperature for more consistent classification
      max_tokens: 2000,
    }));

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
  } catch (error: any) {
    console.error('OpenAI Analysis Error:', error);
    
    // Check if it's a rate limit/quota error
    const isRateLimit = error?.status === 429 || 
                       error?.code === 'rate_limit_exceeded' ||
                       error?.message?.includes('429') ||
                       error?.message?.toLowerCase().includes('rate limit') ||
                       error?.message?.toLowerCase().includes('quota') ||
                       error?.message?.toLowerCase().includes('exceeded');
    
    if (isRateLimit) {
      throw new Error('Se ha excedido el límite de solicitudes a la API de OpenAI. Por favor, espera unos minutos e intenta de nuevo. Si el problema persiste, verifica tu plan y facturación en OpenAI.');
    }
    
    // Fallback response for other errors
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
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera descripciones concisas y profesionales.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    }));

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
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera resúmenes ejecutivos claros y accionables.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }));

    return response.choices[0]?.message?.content?.trim() || 'No se pudo generar el resumen.';
  } catch (error) {
    console.error('Error generating summary', error);
    return 'Error al generar el resumen.';
  }
};

export const queryBitacora = async (
  query: string,
  context: {
    entries: Array<{ 
      summary: string; 
      type: string; 
      createdAt: number; 
      bookName: string;
      content?: string;
      entities?: string;
      threadTitle?: string;
    }>;
    books: Array<{ name: string; description?: string }>;
    tasks: Array<{ 
      description: string; 
      assignee?: string; 
      dueDate?: string; 
      isDone: boolean; 
      completionNotes?: string;
      entrySummary?: string;
      entryBookName?: string;
      entryType?: string;
    }>;
    threads?: Array<{ title: string; bookName: string; entryCount: number }>;
  }
): Promise<string> => {
  // Use most recent entries (already sorted by context)
  const recentEntries = context.entries.slice(0, 50);
  const entriesText = recentEntries
    .map(e => {
      const date = new Date(e.createdAt).toLocaleDateString('es-ES');
      const entitiesInfo = e.entities ? ` | Menciona: ${e.entities}` : '';
      const threadInfo = e.threadTitle ? ` | Hilo: "${e.threadTitle}"` : '';
      const content = e.content && e.content !== e.summary ? `\n  Contenido: ${e.content}` : '';
      return `- [${e.type}] ${e.summary}${content} (${e.bookName}, ${date})${entitiesInfo}${threadInfo}`;
    })
    .join('\n');

  // Tareas PENDIENTES (NO completadas) - claramente marcadas
  const pendingTasks = context.tasks.filter(t => !t.isDone);
  const pendingTasksText = pendingTasks.length > 0
    ? pendingTasks
        .map(t => {
          const contextInfo = t.entrySummary ? ` | De: "${t.entrySummary}" (${t.entryBookName || ''})` : '';
          return `- [PENDIENTE] ${t.description}${t.assignee ? ` (asignado a: ${t.assignee})` : ''}${t.dueDate ? ` [${t.dueDate}]` : ''}${contextInfo}`;
        })
        .join('\n')
    : 'No hay tareas pendientes';

  // Tareas COMPLETADAS - claramente marcadas como completadas
  const completedTasks = context.tasks.filter(t => t.isDone);
  const completedTasksText = completedTasks.length > 0
    ? completedTasks
        .slice(0, 50) // Mostrar más tareas completadas para contexto
        .map(t => {
          const contextInfo = t.entrySummary ? ` | De: "${t.entrySummary}" (${t.entryBookName || ''})` : '';
          const notes = t.completionNotes ? ` | Observaciones: ${t.completionNotes}` : '';
          return `- [COMPLETADA] ${t.description}${t.assignee ? ` (${t.assignee})` : ''}${t.dueDate ? ` [${t.dueDate}]` : ''}${notes}${contextInfo}`;
        })
        .join('\n')
    : 'No hay tareas completadas';

  const booksText = context.books.map(b => `- ${b.name}${b.description ? `: ${b.description}` : ''}`).join('\n');
  
  // Threads information
  const threadsText = context.threads && context.threads.length > 0
    ? context.threads
        .slice(0, 20)
        .map(t => `- "${t.title}" (${t.bookName}, ${t.entryCount} entrada${t.entryCount !== 1 ? 's' : ''})`)
        .join('\n')
    : '';

  // Detectar si la pregunta es sobre pendientes
  const isAboutPending = /pendiente|tengo que|debo|necesito|falta|por hacer|sin hacer|no he|no he hecho/i.test(query);
  const isAboutPerson = /con\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|pendiente.*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+.*pendiente/i.test(query);

  const prompt = `Eres un asistente inteligente que responde preguntas sobre la Bitácora del usuario.

CONTEXTO DISPONIBLE (INFORMACIÓN ACTUALIZADA):

Libretas:
${booksText}

${threadsText ? `Hilos de conversación:\n${threadsText}\n` : ''}

Entradas recientes (ordenadas por fecha, más recientes primero):
${entriesText}

═══════════════════════════════════════════════════════════
TAREAS PENDIENTES (NO COMPLETADAS - ESTAS SON LAS QUE ESTÁN ACTIVAS):
═══════════════════════════════════════════════════════════
${pendingTasksText}

═══════════════════════════════════════════════════════════
TAREAS COMPLETADAS (YA TERMINADAS - NO SON PENDIENTES):
═══════════════════════════════════════════════════════════
${completedTasksText}

INSTRUCCIONES CRÍTICAS Y OBLIGATORIAS:

1. DIFERENCIA ENTRE PENDIENTES Y COMPLETADAS (MUY IMPORTANTE):
   - Las tareas marcadas como [PENDIENTE] están ACTIVAS y sin completar.
   - Las tareas marcadas como [COMPLETADA] ya están TERMINADAS y NO son pendientes.
   - NUNCA menciones una tarea [COMPLETADA] como si fuera pendiente.
   - Si preguntan sobre "pendientes" o "qué tengo que hacer", SOLO menciona tareas [PENDIENTE].
   - Si preguntan sobre "qué se completó" o "qué se hizo", menciona tareas [COMPLETADA].

2. PREGUNTAS SOBRE PENDIENTES CON PERSONAS:
   - Si preguntan "¿qué tengo pendiente con [Persona]?", SOLO menciona tareas [PENDIENTE] que mencionen a esa persona.
   - NO menciones tareas [COMPLETADA] como pendientes, incluso si mencionan a esa persona.
   - Si todas las tareas con esa persona están completadas, di: "No tienes tareas pendientes con [Persona]. Las tareas relacionadas ya están completadas: [lista tareas completadas]".

3. USO DE INFORMACIÓN:
   - Usa SIEMPRE la información más reciente disponible.
   - Las entradas están ordenadas por fecha (más recientes primero).
   - Las observaciones de las tareas completadas contienen información valiosa sobre el resultado o estado final.

4. CONTEXTO ADICIONAL:
   - Si una entrada menciona entidades (personas, proyectos, temas), tenlas en cuenta al responder.
   - Si una entrada pertenece a un hilo de conversación, considera el contexto del hilo completo.
   - Si el contenido de una entrada es diferente del resumen, usa el contenido completo para mayor precisión.

5. PRECISIÓN:
   - Si la pregunta es sobre algo que acaba de suceder o actualizarse, prioriza las entradas más recientes.
   - Si hay información reciente que contradice información antigua, prioriza la información más reciente.

PREGUNTA DEL USUARIO:
"${query}"

Responde de forma clara, directa y útil en ESPAÑOL. Si la información no está disponible, dilo claramente. 
${isAboutPending ? '⚠️ ATENCIÓN: Esta pregunta es sobre PENDIENTES. SOLO menciona tareas marcadas como [PENDIENTE]. NO menciones tareas [COMPLETADA] como si fueran pendientes.' : ''}
${isAboutPerson ? '⚠️ ATENCIÓN: Esta pregunta menciona una persona. Si preguntan sobre pendientes, SOLO menciona tareas [PENDIENTE] relacionadas con esa persona.' : ''}`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que responde preguntas sobre la Bitácora del usuario de forma clara y útil.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }));

    return response.choices[0]?.message?.content?.trim() || 'No se pudo procesar la consulta.';
  } catch (error) {
    console.error('Error querying bitacora', error);
    return 'Error al procesar la consulta.';
  }
};

// ============================================================================
// MULTI-TOPIC ANALYSIS
// ============================================================================

export const analyzeMultiTopicEntry = async (
  text: string,
  existingBooks: Book[],
  existingTasks: TaskItem[],
  attachment?: Attachment
): Promise<MultiTopicAnalysis> => {
  // Validate input
  const hasAttachmentContent = attachment?.extractedText && attachment.extractedText.trim().length > 0;
  
  if ((!text || text.trim().length === 0) && !hasAttachmentContent) {
    throw new Error('El texto no puede estar vacío');
  }
  
  const maxTextLength = hasAttachmentContent ? 5000 : 10000;
  const sanitizedText = (text || '').trim().slice(0, maxTextLength);
  
  // Build detailed books context
  const booksContext = existingBooks.map(b => 
    `- "${b.name}"${b.description ? ` (${b.description})` : ''}`
  ).join('\n');

  // Build pending tasks context
  const pendingTasksContext = existingTasks
    .filter(t => !t.isDone)
    .map(t => `- "${t.description}"${t.assignee ? ` (asignado a: ${t.assignee})` : ''}`)
    .join('\n');

  const systemPrompt = `Eres un asistente personal IA extremadamente inteligente para gestionar notas de trabajo.

Fecha Actual: ${new Date().toLocaleDateString('es-ES')}

LIBRETAS EXISTENTES:
${booksContext || 'No hay libretas existentes'}

TAREAS PENDIENTES ACTUALES:
${pendingTasksContext || 'No hay tareas pendientes'}

═══════════════════════════════════════════════════════════
INSTRUCCIONES CRÍTICAS - ANÁLISIS MULTI-TEMA
═══════════════════════════════════════════════════════════

El usuario puede ingresar una ÚNICA anotación que contenga MÚLTIPLES TEMAS diferentes.
Por ejemplo, en una reunión de equipo puede anotar:
- Una tarea del Proyecto A
- Un acuerdo del Proyecto B  
- Que se completó una tarea del Proyecto C
- Una idea para el Proyecto D

TU TRABAJO:
1. DETECTAR si hay múltiples temas/proyectos distintos en la nota
2. SEPARAR el contenido por tema/proyecto
3. ASOCIAR cada parte a su libreta correspondiente
4. DETECTAR si se menciona que una tarea existente se COMPLETÓ
5. CREAR nuevas tareas donde corresponda

REGLAS DE DETECCIÓN MULTI-TEMA:
- Si el texto menciona múltiples proyectos/clientes/temas diferentes → es MULTI-TEMA
- Si el texto habla de UN SOLO proyecto con múltiples aspectos → NO es multi-tema (todo a una libreta)
- Palabras clave que indican cambio de tema: "respecto a", "sobre", "en cuanto a", "por otro lado", "también", nombres de proyectos diferentes

REGLAS DE ASIGNACIÓN A LIBRETAS (MUY IMPORTANTE):
- Compara el contenido con el NOMBRE y DESCRIPCIÓN de cada libreta existente
- Busca coincidencias SEMÁNTICAS, no solo exactas:
  * Si el texto habla de "sueldos", "salarios", "revisión de sueldos" → busca libretas relacionadas con "sueldos", "analistas", "recursos humanos", "personal"
  * Si el texto menciona personas específicas → busca libretas que mencionen esas personas o sus proyectos
  * Si el texto habla de un tema/proyecto → busca libretas con nombres o descripciones relacionadas
- PRIORIZA libretas existentes sobre crear nuevas
- Si hay AMBIGÜEDAD, elige la libreta más relacionada semánticamente
- Si es un tema completamente nuevo → sugiere nombre para nueva libreta
- NO asignes a libretas genéricas si hay una específica que coincide mejor

DETECCIÓN DE TAREAS COMPLETADAS (MUY IMPORTANTE):
- Si el texto indica que algo se "terminó", "completó", "cerró", "finalizó" → marca la tarea como completada
- Busca en las TAREAS PENDIENTES ACTUALES si alguna coincide con lo mencionado
- Extrae observaciones/notas de cierre si las hay

CLASIFICACIÓN DE TIPO POR TEMA:
- NOTE: Información, observaciones, estados actuales
- TASK: Acciones pendientes a realizar
- DECISION: Acuerdos tomados, "acordamos", "se decidió"
- IDEA: Propuestas, sugerencias
- RISK: Problemas, riesgos identificados

═══════════════════════════════════════════════════════════

Responde SIEMPRE en formato JSON con este esquema exacto:
{
  "isMultiTopic": true/false,
  "overallContext": "descripción general de la nota",
  "suggestedPriority": "LOW|MEDIUM|HIGH",
  "topics": [
    {
      "targetBookName": "nombre exacto de libreta existente o nuevo nombre",
      "isNewBook": true/false,
      "type": "NOTE|TASK|DECISION|IDEA|RISK",
      "content": "el contenido original que corresponde a este tema",
      "summary": "resumen del contenido para este tema",
      "tasks": [
        {
          "description": "descripción de nueva tarea",
          "assignee": "responsable si se menciona",
          "dueDate": "YYYY-MM-DD si se menciona",
          "priority": "LOW|MEDIUM|HIGH"
        }
      ],
      "entities": [
        {"name": "nombre", "type": "PERSON|COMPANY|PROJECT|TOPIC"}
      ],
      "taskActions": [
        {
          "action": "complete",
          "taskDescription": "descripción de tarea existente que se completó",
          "completionNotes": "observaciones del cierre"
        }
      ]
    }
  ]
}

EJEMPLOS:

Ejemplo 1 - MULTI-TEMA:
Input: "En la reunión acordamos que el proyecto Alpha avanza bien y se terminó la fase de diseño. Por otro lado, respecto al cliente Beta, hay que enviarles el presupuesto esta semana. También surgió una idea para el producto Gamma: agregar notificaciones push."

Output:
{
  "isMultiTopic": true,
  "overallContext": "Notas de reunión con actualizaciones de múltiples proyectos",
  "suggestedPriority": "MEDIUM",
  "topics": [
    {
      "targetBookName": "Proyecto Alpha",
      "isNewBook": false,
      "type": "DECISION",
      "content": "En la reunión acordamos que el proyecto Alpha avanza bien y se terminó la fase de diseño",
      "summary": "Avance positivo del proyecto. Fase de diseño completada.",
      "tasks": [],
      "entities": [{"name": "Proyecto Alpha", "type": "PROJECT"}],
      "taskActions": [
        {
          "action": "complete",
          "taskDescription": "Fase de diseño",
          "completionNotes": "Completada según reunión"
        }
      ]
    },
    {
      "targetBookName": "Cliente Beta",
      "isNewBook": false,
      "type": "TASK",
      "content": "respecto al cliente Beta, hay que enviarles el presupuesto esta semana",
      "summary": "Pendiente envío de presupuesto",
      "tasks": [
        {
          "description": "Enviar presupuesto a Cliente Beta",
          "priority": "HIGH"
        }
      ],
      "entities": [{"name": "Cliente Beta", "type": "COMPANY"}],
      "taskActions": []
    },
    {
      "targetBookName": "Producto Gamma",
      "isNewBook": false,
      "type": "IDEA",
      "content": "surgió una idea para el producto Gamma: agregar notificaciones push",
      "summary": "Propuesta de agregar notificaciones push al producto",
      "tasks": [],
      "entities": [{"name": "Producto Gamma", "type": "PROJECT"}],
      "taskActions": []
    }
  ]
}

Ejemplo 2 - TEMA ÚNICO:
Input: "Revisé los paneles BI: el de ventas tiene un error en el filtro de fechas, el de supervisores funciona bien, y el de marketing necesita actualizar los KPIs."

Output:
{
  "isMultiTopic": false,
  "overallContext": "Revisión de paneles BI",
  "suggestedPriority": "MEDIUM",
  "topics": [
    {
      "targetBookName": "Paneles BI",
      "isNewBook": false,
      "type": "NOTE",
      "content": "Revisé los paneles BI: el de ventas tiene un error en el filtro de fechas, el de supervisores funciona bien, y el de marketing necesita actualizar los KPIs",
      "summary": "Revisión de paneles BI. Ventas: error en filtro de fechas. Supervisores: funcionando. Marketing: pendiente actualizar KPIs.",
      "tasks": [],
      "entities": [{"name": "Paneles BI", "type": "PROJECT"}],
      "taskActions": []
    }
  ]
}`;

  const userPrompt = `Analiza esta anotación y detecta si contiene múltiples temas que deben ir a diferentes libretas:

"${sanitizedText}"

INSTRUCCIONES:
1. Detecta si hay múltiples proyectos/temas/clientes diferentes
2. Si los hay, separa el contenido por tema
3. Asigna cada parte a su libreta correspondiente
4. Detecta si alguna tarea existente debe marcarse como completada
5. Crea nuevas tareas solo donde sea necesario`;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Add attachment if present
    if (attachment) {
      if (attachment.type === 'image') {
        const base64Data = attachment.data.includes(',') ? attachment.data.split(',')[1] : attachment.data;
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza también esta imagen adjunta. Puede contener información de múltiples temas.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${attachment.mimeType};base64,${base64Data}`
              }
            }
          ]
        } as any);
      } else if (attachment.type === 'document' && attachment.extractedText) {
        const pdfText = attachment.extractedText.trim();
        const textToSend = pdfText.length > 50000 
          ? pdfText.slice(0, 50000) + '\n\n[... contenido truncado ...]' 
          : pdfText;
        
        messages.push({
          role: 'user',
          content: `📄 DOCUMENTO PDF ADJUNTO: "${attachment.fileName}"\n\nCONTENIDO:\n${textToSend}\n\nAnaliza este documento buscando múltiples temas que deban ir a diferentes libretas.`
        });
      }
    }

    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 3000,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const data = JSON.parse(content) as MultiTopicAnalysis;
    
    // Sanitize and validate response
    return {
      isMultiTopic: data.isMultiTopic || false,
      overallContext: (data.overallContext || 'Nota procesada').slice(0, 500),
      suggestedPriority: data.suggestedPriority || 'MEDIUM',
      topics: (data.topics || []).map(topic => ({
        targetBookName: (topic.targetBookName || 'Bandeja de Entrada').slice(0, 100),
        isNewBook: topic.isNewBook || false,
        type: topic.type || NoteType.NOTE,
        content: (topic.content || '').slice(0, 2000),
        summary: (topic.summary || '').slice(0, 1000),
        tasks: (topic.tasks || []).slice(0, 10).map(t => ({
          description: t.description?.slice(0, 500) || '',
          assignee: t.assignee?.slice(0, 100),
          dueDate: t.dueDate?.slice(0, 10),
          priority: t.priority || 'MEDIUM',
        })),
        entities: (topic.entities || []).slice(0, 20).map(e => ({
          name: e.name?.slice(0, 100) || '',
          type: e.type || 'TOPIC',
        })),
        taskActions: (topic.taskActions || []).slice(0, 10).map(ta => ({
          action: ta.action || 'complete',
          taskDescription: ta.taskDescription?.slice(0, 500) || '',
          completionNotes: ta.completionNotes?.slice(0, 500),
        })),
      })),
    };
  } catch (error: any) {
    console.error('Multi-topic Analysis Error:', error);
    
    // Check if it's a rate limit/quota error
    const isRateLimit = error?.status === 429 || 
                       error?.code === 'rate_limit_exceeded' ||
                       error?.message?.includes('429') ||
                       error?.message?.toLowerCase().includes('rate limit') ||
                       error?.message?.toLowerCase().includes('quota') ||
                       error?.message?.toLowerCase().includes('exceeded');
    
    if (isRateLimit) {
      throw new Error('Se ha excedido el límite de solicitudes a la API de OpenAI. Por favor, espera unos minutos e intenta de nuevo. Si el problema persiste, verifica tu plan y facturación en OpenAI.');
    }
    
    // Fallback to single topic for other errors
    return {
      isMultiTopic: false,
      overallContext: sanitizedText,
      suggestedPriority: 'MEDIUM',
      topics: [{
        targetBookName: 'Bandeja de Entrada',
        isNewBook: true,
        type: NoteType.NOTE,
        content: sanitizedText,
        summary: sanitizedText.slice(0, 200),
        tasks: [],
        entities: [],
        taskActions: [],
      }],
    };
  }
};

// ============================================================================
// THREAD RELATION DETECTION
// ============================================================================

export interface ThreadRelationResult {
  hasRelation: boolean;
  relatedThreadId?: string | null;
  relatedEntryIds: string[];
  confidence: number;
  suggestedThreadTitle?: string | null;
  reason: string;
}

export const detectThreadRelations = async (
  text: string,
  existingEntries: Entry[],
  existingThreads: Thread[],
  targetBookId?: string
): Promise<ThreadRelationResult> => {
  // Limit to recent entries for performance, but prioritize entries from the same book
  const recentEntries = existingEntries.slice(0, 100);
  
  // Group entries by thread for better context
  const entriesByThread = new Map<string, Entry[]>();
  recentEntries.forEach(e => {
    if (e.threadId) {
      if (!entriesByThread.has(e.threadId)) {
        entriesByThread.set(e.threadId, []);
      }
      entriesByThread.get(e.threadId)!.push(e);
    }
  });

  // Build rich context for threads with their entries
  const threadsContext = existingThreads.map(t => {
    const threadEntries = entriesByThread.get(t.id) || [];
    const entriesSummary = threadEntries
      .slice(0, 5)
      .map(e => `  - ${e.summary}`)
      .join('\n');
    return `ID: ${t.id} | Título: "${t.title}" | Libreta: ${t.bookId}${entriesSummary ? `\n  Entradas en este hilo:\n${entriesSummary}` : ''}`;
  }).join('\n\n');

  // Build entries context, prioritizing same book
  const sameBookEntries = targetBookId 
    ? recentEntries.filter(e => e.bookId === targetBookId)
    : recentEntries;
  const otherEntries = targetBookId
    ? recentEntries.filter(e => e.bookId !== targetBookId).slice(0, 30)
    : [];

  const entriesContext = [
    ...sameBookEntries.slice(0, 30).map(e => 
      `ID: ${e.id} | Tipo: ${e.type} | Resumen: "${e.summary}" | Libreta: ${e.bookId}${e.threadId ? ` | Hilo: ${e.threadId}` : ''}`
    ),
    ...otherEntries.map(e => 
      `ID: ${e.id} | Tipo: ${e.type} | Resumen: "${e.summary}" | Libreta: ${e.bookId}${e.threadId ? ` | Hilo: ${e.threadId}` : ''}`
    )
  ].join('\n');

  const prompt = `Eres un asistente experto que detecta relaciones semánticas entre entradas de una bitácora.

Analiza si el nuevo texto está relacionado con entradas existentes o hilos de conversación.

HILOS EXISTENTES (con sus entradas):
${threadsContext || 'No hay hilos existentes'}

ENTRADAS EXISTENTES:
${entriesContext || 'No hay entradas existentes'}

TEXTO NUEVO:
"${text}"

INSTRUCCIONES CRÍTICAS:
1. Analiza PROFUNDAMENTE si el texto nuevo está relacionado con algún hilo o entrada existente
2. Considera relaciones por:
   - Mismo tema/proyecto (ej: "sueldos de analistas", "revisión de sueldos", "ajuste salarial" = mismo tema)
   - Mismas personas mencionadas (ej: "Claudia", "Caro" = mismas personas)
   - Mismo contexto de trabajo (ej: "revisión", "ajuste", "evaluación" = contexto relacionado)
   - Continuación de conversación o actualización de tema existente
3. PRIORIZA hilos existentes sobre entradas individuales
4. Si encuentras un hilo cuyo título o contenido coincide con el tema del texto nuevo, DEBES sugerirlo
5. Si hay múltiples entradas relacionadas pero NO hay hilo, sugiere crear uno nuevo
6. Si no hay relación clara, retorna hasRelation: false

EJEMPLOS DE RELACIONES VÁLIDAS:
- Texto: "Claudia revisará el sueldo de Caro" + Hilo: "Revisión de sueldos de analistas" → RELACIONADO (mismo tema: sueldos)
- Texto: "Ajuste salarial para Caro" + Entrada: "Revisar sueldos de analistas" → RELACIONADO (mismo tema)
- Texto: "Reunión con Claudia sobre sueldos" + Hilo: "Revisión de sueldos" → RELACIONADO (mismo tema y persona)

REGLAS DE CONFIANZA:
- Confianza > 80%: Relación muy clara (mismo tema exacto, mismas personas)
- Confianza 70-80%: Relación probable (tema similar, contexto relacionado)
- Confianza < 70%: No hay relación clara

IMPORTANTE: Si el texto menciona temas que ya están en un hilo existente (aunque con palabras ligeramente diferentes), DEBES detectarlo como relacionado.

Responde en JSON:
{
  "hasRelation": true/false,
  "relatedThreadId": "id del hilo" o null,
  "relatedEntryIds": ["id1", "id2"] o [],
  "confidence": 0-100,
  "suggestedThreadTitle": "título sugerido" o null,
  "reason": "explicación breve de por qué está relacionado"
}`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que detecta relaciones semánticas entre entradas de una bitácora.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent matching
      max_tokens: 500,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { hasRelation: false, relatedEntryIds: [], confidence: 0, reason: 'No se pudo analizar' };
    }

    const data = JSON.parse(content) as ThreadRelationResult;
    
    // Only consider relation if confidence is high enough
    if (data.confidence < 70) {
      return { hasRelation: false, relatedEntryIds: data.relatedEntryIds, confidence: data.confidence, reason: data.reason };
    }

    return data;
  } catch (error) {
    console.error('Thread relation detection error:', error);
    return { hasRelation: false, relatedEntryIds: [], confidence: 0, reason: 'Error al analizar' };
  }
};

// ============================================================================
// TEXT REWRITING
// ============================================================================

export const rewriteTextWithAI = async (text: string): Promise<string> => {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Limit text length
  const maxTextLength = 5000;
  const sanitizedText = text.trim().slice(0, maxTextLength);

  const prompt = `Reescribe el siguiente texto de forma más ordenada, clara y estructurada, manteniendo toda la información importante.

TEXTO ORIGINAL:
"${sanitizedText}"

INSTRUCCIONES:
1. Organiza la información de forma lógica
2. Mejora la redacción sin cambiar el significado
3. Estructura con párrafos claros
4. Mantén todos los detalles importantes
5. Usa un tono profesional pero natural
6. Si el texto ya está bien estructurado, haz mejoras menores

Responde SOLO con el texto reescrito, sin explicaciones adicionales, sin comillas, sin prefijos como "Texto reescrito:" o similares.`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que reescribe textos de forma clara y estructurada.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }));

    const rewrittenText = response.choices[0]?.message?.content?.trim() || sanitizedText;
    
    // Remove any quotes or prefixes that might have been added
    return rewrittenText.replace(/^["']|["']$/g, '').replace(/^(Texto reescrito:|Resumen:|Texto:)\s*/i, '').trim() || sanitizedText;
  } catch (error) {
    console.error('Text rewriting error:', error);
    // Return original text on error
    return sanitizedText;
  }
};

// ============================================================================
// REORGANIZED PIPELINE FUNCTIONS
// ============================================================================

/**
 * Analyzes topics in the text
 */
export async function analyzeTopics(
  text: string,
  context: { existingBooks: Book[]; existingEntries?: Entry[] }
): Promise<string[]> {
  const booksContext = context.existingBooks.map(b => 
    `- "${b.name}"${b.description ? ` (${b.description})` : ''}`
  ).join('\n');

  const prompt = `Extrae los temas principales de este texto:

"${text.slice(0, 2000)}"

Libretas existentes:
${booksContext}

Responde con un JSON array de temas principales, máximo 5 temas.`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que extrae temas principales de textos.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 300,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const data = JSON.parse(content);
    return Array.isArray(data.topics) ? data.topics : [];
  } catch (error) {
    console.error('Error analyzing topics:', error);
    return [];
  }
}

/**
 * Extracts tasks from text
 */
export async function extractTasks(
  text: string,
  context: { existingTasks?: TaskItem[] }
): Promise<Array<{ description: string; assignee?: string; dueDate?: string; priority?: string }>> {
  const prompt = `Extrae las tareas pendientes de este texto:

"${text.slice(0, 2000)}"

Responde con un JSON object con un array "tasks" de tareas. Cada tarea debe tener:
- description: descripción de la tarea
- assignee: responsable si se menciona
- dueDate: fecha en formato YYYY-MM-DD si se menciona
- priority: LOW, MEDIUM o HIGH`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que extrae tareas pendientes de textos.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 500,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const data = JSON.parse(content);
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch (error) {
    console.error('Error extracting tasks:', error);
    return [];
  }
}

/**
 * Extracts decisions from text
 */
export async function extractDecisions(
  text: string,
  context: Record<string, any> = {}
): Promise<string[]> {
  const prompt = `Extrae las decisiones tomadas o acuerdos de este texto:

"${text.slice(0, 2000)}"

Responde con un JSON object con un array "decisions" de decisiones.`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que extrae decisiones y acuerdos de textos.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 500,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const data = JSON.parse(content);
    return Array.isArray(data.decisions) ? data.decisions : [];
  } catch (error) {
    console.error('Error extracting decisions:', error);
    return [];
  }
}

/**
 * Classifies notebook assignment
 */
export async function classifyNotebook(
  text: string,
  existingBooks: Book[]
): Promise<{ targetBookName: string; isNewBook: boolean }> {
  const booksContext = existingBooks.map(b => 
    `- "${b.name}"${b.description ? ` (${b.description})` : ''}`
  ).join('\n');

  const prompt = `Asigna este texto a la libreta correcta:

"${text.slice(0, 2000)}"

Libretas existentes:
${booksContext || 'No hay libretas existentes'}

Responde con JSON:
{
  "targetBookName": "nombre exacto de libreta existente o nuevo nombre",
  "isNewBook": true/false
}`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que asigna textos a libretas correctas.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { targetBookName: 'Bandeja de Entrada', isNewBook: false };
    }

    const data = JSON.parse(content);
    return {
      targetBookName: data.targetBookName || 'Bandeja de Entrada',
      isNewBook: data.isNewBook || false,
    };
  } catch (error) {
    console.error('Error classifying notebook:', error);
    return { targetBookName: 'Bandeja de Entrada', isNewBook: false };
  }
}

// ============================================================================
// EMBEDDING-ENHANCED FUNCTIONS
// ============================================================================

/**
 * Updates book context using embeddings to find related notes
 */
export async function updateBookContextWithEmbeddings(
  bookName: string,
  currentContext: string | undefined,
  newEntrySummary: string,
  userId?: string
): Promise<string> {
  // Import here to avoid circular dependencies
  const embeddingService = await import('./embeddingService');
  const dataService = await import('./dataService');
  
  try {
    // Generate embedding for new entry
    const newEmbedding = await embeddingService.generateEmbedding(newEntrySummary);
    
    // Find similar entries if userId is provided
    let similarContext = '';
    if (userId) {
      const similarEntries = await embeddingService.findSimilarEntries(newEmbedding, 5, 0.6, userId);
      similarContext = similarEntries
        .slice(0, 3)
        .map(se => `- ${se.entry.summary} (similitud: ${(se.similarity * 100).toFixed(0)}%)`)
        .join('\n');
    }
    
    const prompt = `Actualiza la descripción de esta libreta considerando:
    
Contexto actual: "${currentContext || 'Sin descripción aún.'}"

Nueva entrada: "${newEntrySummary}"

${similarContext ? `Notas relacionadas (por similitud semántica):\n${similarContext}` : ''}

Genera una descripción actualizada (máximo 2 frases) que integre el contexto anterior con la nueva información${similarContext ? ' y las notas relacionadas' : ''}.`;

    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera descripciones concisas y profesionales.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    }));

    return response.choices[0]?.message?.content?.trim() || currentContext || '';
  } catch (error) {
    console.error('Error updating book context with embeddings:', error);
    // Fallback to original function
    return updateBookContext(bookName, currentContext, newEntrySummary);
  }
}

/**
 * Queries bitácora with semantic search
 */
export async function queryBitacoraWithSemantic(
  query: string,
  context: {
    entries: Array<{ summary: string; type: string; createdAt: number; bookName: string }>;
    books: Array<{ name: string; description?: string }>;
    tasks: Array<{ description: string; assignee?: string; dueDate?: string; isDone: boolean; completionNotes?: string }>;
    userId?: string;
  }
): Promise<string> {
  // Import here to avoid circular dependencies
  const { generateEmbedding, findSimilarEntries } = await import('./embeddingService');
  
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    
    // Find semantically similar entries
    const similarEntries = context.userId 
      ? await findSimilarEntries(queryEmbedding, 10, 0.6, context.userId)
      : [];
    
    // Combine semantic results with text-based context
    const semanticContext = similarEntries
      .slice(0, 5)
      .map(se => `- [${se.entry.type}] ${se.entry.summary} (${se.entry.bookName}, similitud: ${(se.similarity * 100).toFixed(0)}%)`)
      .join('\n');
    
    // Use existing queryBitacora but enhance with semantic results
    const enhancedContext = {
      ...context,
      entries: [
        ...context.entries,
        ...similarEntries.map(se => ({
          summary: se.entry.summary,
          type: se.entry.type,
          createdAt: se.entry.createdAt,
          bookName: se.entry.bookId, // Will be resolved by getBookName
        })),
      ],
    };
    
    // Call original function with enhanced context
    const textBasedAnswer = await queryBitacora(query, context);
    
    // If we have semantic results, combine them
    if (semanticContext) {
      const combinedPrompt = `Pregunta: "${query}"

Respuesta basada en búsqueda de texto:
${textBasedAnswer}

Notas relacionadas semánticamente:
${semanticContext}

Mejora la respuesta incorporando información de las notas relacionadas semánticamente si es relevante.`;

      const response = await callOpenAI(() => openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un asistente que combina información de búsqueda de texto y búsqueda semántica.' },
          { role: 'user', content: combinedPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }));

      return response.choices[0]?.message?.content?.trim() || textBasedAnswer;
    }
    
    return textBasedAnswer;
  } catch (error) {
    console.error('Error in semantic query, falling back to text-based:', error);
    return queryBitacora(query, context);
  }
}

/**
 * Generates a hash from entries to detect changes
 * Includes IDs, timestamps, summaries, and task completion status to detect any changes
 */
function generateEntriesHash(entries: Array<{ 
  id?: string; 
  createdAt: number; 
  summary?: string;
  tasks?: Array<{ description: string; isDone: boolean; completionNotes?: string }>;
}>): string {
  // Create a hash from entry IDs, timestamps, summaries, and task states
  // This ensures we detect both new entries and updates to existing ones
  const sorted = [...entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(e => {
      const taskHash = e.tasks 
        ? e.tasks.map(t => `${t.description}_${t.isDone}_${t.completionNotes || ''}`).join('|')
        : '';
      return `${e.id || ''}_${e.createdAt}_${e.summary || ''}_${taskHash}`;
    })
    .join('||');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates a summary of interactions with a specific person (with caching)
 */
export async function generatePersonInteractionSummary(
  personName: string,
  entries: Array<{
    id?: string;
    summary: string;
    type: string;
    createdAt: number;
    originalText?: string;
    tasks?: Array<{ description: string; isDone: boolean; completionNotes?: string }>;
  }>,
  userId?: string
): Promise<string> {
  if (entries.length === 0) {
    return `No hay interacciones registradas con ${personName}.`;
  }

  // Check cache if userId is provided
  if (userId) {
    const { getPersonSummary, savePersonSummary } = await import('./db');
    const entriesHash = generateEntriesHash(entries);
    const lastEntryTimestamp = Math.max(...entries.map(e => e.createdAt));
    
    const cached = await getPersonSummary(userId, personName);
    
    // Check if we need to regenerate:
    // 1. No cache exists
    // 2. Hash doesn't match (content changed)
    // 3. Last entry timestamp is newer than cached (new entry added)
    const needsRegeneration = !cached || 
      cached.entries_hash !== entriesHash || 
      lastEntryTimestamp > cached.last_entry_timestamp;
    
    if (!needsRegeneration && cached) {
      // Cache is valid, return it
      return cached.summary;
    }
    
    // Generate new summary
    const summary = await generatePersonInteractionSummaryInternal(personName, entries);
    
    // Save to cache
    try {
      await savePersonSummary(userId, personName, summary, entriesHash, lastEntryTimestamp);
    } catch (error) {
      console.error('Error saving person summary to cache:', error);
    }
    
    return summary;
  }
  
  // No cache, generate directly
  return generatePersonInteractionSummaryInternal(personName, entries);
}

/**
 * Internal function that actually generates the summary
 */
async function generatePersonInteractionSummaryInternal(
  personName: string,
  entries: Array<{
    summary: string;
    type: string;
    createdAt: number;
    originalText?: string;
    tasks?: Array<{ description: string; isDone: boolean; completionNotes?: string }>;
  }>
): Promise<string> {

  // Sort entries by date (most recent first)
  const sortedEntries = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  
  // Extract completed tasks related to this person
  const completedTasks = entries
    .flatMap(e => (e.tasks || [])
      .filter(t => t.isDone && t.completionNotes)
      .map(t => ({
        description: t.description,
        completionNotes: t.completionNotes,
        date: e.createdAt
      }))
    )
    .sort((a, b) => b.date - a.date);

  const entriesText = sortedEntries
    .slice(0, 30) // Limit to recent 30 entries
    .map(e => {
      const date = new Date(e.createdAt).toLocaleDateString('es-ES');
      const tasksInfo = e.tasks && e.tasks.length > 0
        ? ` | Tareas: ${e.tasks.filter(t => t.isDone).length} completadas, ${e.tasks.filter(t => !t.isDone).length} pendientes`
        : '';
      return `- [${e.type}] ${e.summary} (${date})${tasksInfo}`;
    })
    .join('\n');

  const completedTasksText = completedTasks
    .slice(0, 10)
    .map(t => `- ${t.description} | ${t.completionNotes} (${new Date(t.date).toLocaleDateString('es-ES')})`)
    .join('\n');

  const prompt = `Eres un asistente que genera resúmenes cortos y concisos de interacciones con personas.

PERSONA: ${personName}

INTERACCIONES REGISTRADAS:
${entriesText}

${completedTasksText ? `TAREAS COMPLETADAS RECIENTES:\n${completedTasksText}` : ''}

Genera UNA SOLA FRASE CORTA en ESPAÑOL que resuma las interacciones con ${personName}. Debe incluir:
- Contexto principal de las interacciones
- Último tema cerrado o completado (si hay tareas completadas)
- Estado actual o tema más reciente

Formato: Una sola frase, máximo 30 palabras. Directo y conciso.
Ejemplos:
- "${personName}: Último tema cerrado fue el sueldo de los analistas. Trabajamos principalmente en revisión de sueldos y ajustes salariales."
- "${personName}: Colaboración en paneles BI. Último tema completado: corrección del panel de supervisores."
- "${personName}: ${entries.length} interacciones sobre [tema principal]. Estado actual: [breve estado]."

IMPORTANTE: Solo una frase, sin puntos adicionales, sin viñetas, sin párrafos.`;

  try {
    const response = await callOpenAI(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que genera resúmenes ejecutivos de interacciones con personas de forma clara y útil.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150,
    }));

    return response.choices[0]?.message?.content?.trim() || `Resumen de interacciones con ${personName}: ${entries.length} nota${entries.length !== 1 ? 's' : ''} registrada${entries.length !== 1 ? 's' : ''}.`;
  } catch (error) {
    console.error('Error generating person interaction summary:', error);
    return `Resumen de interacciones con ${personName}: ${entries.length} nota${entries.length !== 1 ? 's' : ''} registrada${entries.length !== 1 ? 's' : ''}. Última interacción: ${new Date(sortedEntries[0]?.createdAt || 0).toLocaleDateString('es-ES')}.`;
  }
}

