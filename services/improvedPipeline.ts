import { Attachment, Book, Entry, NoteType, TaskItem, Entity } from '../types';
import { preprocessEntry } from './preprocessingService';
import { routeAnalysisSteps } from './aiRouter';
import { analyzeEntry, analyzeTopics, extractTasks, extractDecisions, classifyNotebook } from './openaiService';
import { generateEmbedding, storeEmbedding, detectSemanticRelations } from './embeddingService';
import * as dataService from './dataService';

export interface AnalysisContext {
  existingBooks: Book[];
  existingEntries?: Entry[];
  existingTasks?: TaskItem[];
  userId?: string;
}

export interface AnalysisResult {
  targetBookName: string;
  type: NoteType;
  summary: string;
  tasks: Array<{ description: string; assignee?: string; dueDate?: string; priority?: string }>;
  entities: Array<{ name: string; type: string }>;
  suggestedPriority?: 'LOW' | 'MEDIUM' | 'HIGH';
  embedding?: number[];
  relations?: Array<{ targetId: string; strength: number }>;
}

/**
 * Improved pipeline that integrates preprocessing, routing, modular analysis, embeddings, and relations
 */
export async function processEntryImproved(
  text: string,
  attachment?: Attachment,
  context?: AnalysisContext
): Promise<AnalysisResult> {
  const userId = context?.userId;
  const existingBooks = context?.existingBooks || [];
  const existingEntries = context?.existingEntries || [];
  const existingTasks = context?.existingTasks || [];

  try {
    // Step 1: Preprocessing
    const preprocessed = preprocessEntry(text);
    const cleanedText = preprocessed.cleaned;

    // Step 2: Routing - determine which steps to execute
    const steps = await routeAnalysisSteps(cleanedText, {
      length: preprocessed.length,
      hasAttachment: !!attachment,
    });

    // Step 3: Execute analysis steps
    let analysisResult: AnalysisResult = {
      targetBookName: 'Bandeja de Entrada',
      type: NoteType.NOTE,
      summary: cleanedText.slice(0, 200),
      tasks: [],
      entities: [],
      suggestedPriority: 'MEDIUM',
    };

    // Use existing analyzeEntry for comprehensive analysis (it already does everything)
    // But we can enhance it with modular functions if needed
    const fullAnalysis = await analyzeEntry(cleanedText, existingBooks, attachment);
    
    analysisResult = {
      targetBookName: fullAnalysis.targetBookName,
      type: fullAnalysis.type as NoteType,
      summary: fullAnalysis.summary,
      tasks: fullAnalysis.tasks,
      entities: fullAnalysis.entities,
      suggestedPriority: fullAnalysis.suggestedPriority,
    };

    // Step 4: Generate embedding (async, don't block)
    let embedding: number[] | undefined;
    try {
      // Use summary + original text for embedding
      const textForEmbedding = `${analysisResult.summary}\n${cleanedText.slice(0, 1000)}`;
      embedding = await generateEmbedding(textForEmbedding);
      analysisResult.embedding = embedding;
    } catch (error) {
      console.error('Error generating embedding (non-blocking):', error);
      // Continue without embedding
    }

    // Step 5: Detect semantic relations (async, don't block)
    if (embedding && userId && existingEntries.length > 0) {
      try {
        const relations = await detectSemanticRelations(
          '', // entryId will be set after entry is created
          embedding,
          existingEntries,
          0.7 // threshold
        );
        analysisResult.relations = relations;
      } catch (error) {
        console.error('Error detecting semantic relations (non-blocking):', error);
        // Continue without relations
      }
    }

    return analysisResult;
  } catch (error) {
    console.error('Error in improved pipeline:', error);
    // Fallback to basic analysis
    return {
      targetBookName: 'Bandeja de Entrada',
      type: NoteType.NOTE,
      summary: text.slice(0, 200),
      tasks: [],
      entities: [],
      suggestedPriority: 'MEDIUM',
    };
  }
}

/**
 * Post-process entry: generate and store embedding, detect relations
 * This is called after the entry is saved to the database
 */
export async function postProcessEntry(
  entryId: string,
  entry: Entry,
  userId: string,
  allEntries: Entry[]
): Promise<void> {
  try {
    // Generate embedding
    const textForEmbedding = `${entry.summary}\n${entry.originalText.slice(0, 1000)}`;
    const embedding = await generateEmbedding(textForEmbedding);
    
    // Store embedding
    await storeEmbedding(entryId, embedding);
    
    // Detect and save relations
    if (allEntries.length > 0) {
      await detectSemanticRelations(entryId, embedding, allEntries, 0.7);
    }
  } catch (error) {
    console.error('Error in post-processing entry (non-blocking):', error);
    // Don't throw - this is optional processing
  }
}

