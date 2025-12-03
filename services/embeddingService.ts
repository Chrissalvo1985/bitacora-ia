import OpenAI from 'openai';
import { Entry, EntryRelation } from '../types';
import * as db from './db';
import * as dataService from './dataService';

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

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536; // Default for text-embedding-3-small

/**
 * Generates an embedding for the given text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  try {
    // Truncate text if too long (max tokens for embedding model)
    const maxChars = 8000; // Safe limit for text-embedding-3-small
    const truncatedText = text.length > maxChars ? text.slice(0, maxChars) : text;

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from OpenAI');
    }

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Stores an embedding in the database
 */
export async function storeEmbedding(entryId: string, embedding: number[]): Promise<void> {
  try {
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await db.createEntryEmbedding(id, entryId, embedding, EMBEDDING_MODEL);
  } catch (error) {
    console.error('Error storing embedding:', error);
    throw error;
  }
}

/**
 * Calculates cosine similarity between two embeddings
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Finds similar entries based on embedding similarity
 */
export async function findSimilarEntries(
  embedding: number[],
  limit: number = 10,
  threshold: number = 0.7,
  userId?: string
): Promise<Array<{ entry: Entry; similarity: number }>> {
  try {
    // Get all embeddings for the user's entries
    // First, get all entries for the user
    if (!userId) {
      return [];
    }

    const allEntries = await db.getAllEntries(userId);
    if (allEntries.length === 0) {
      return [];
    }

    const entryIds = allEntries.map(e => e.id);
    const allEmbeddings = await db.getEmbeddingsByEntryIds(entryIds);

    // Calculate similarities
    const similarities: Array<{ entry: Entry; similarity: number }> = [];

    // Load all entries with their tasks and entities
    const fullEntries = await dataService.loadAllEntries(userId);
    const entryMap = new Map(fullEntries.map(e => [e.id, e]));

    for (const dbEmbedding of allEmbeddings) {
      try {
        const storedEmbedding = JSON.parse(dbEmbedding.embedding) as number[];
        const similarity = calculateCosineSimilarity(embedding, storedEmbedding);

        if (similarity >= threshold) {
          const entry = entryMap.get(dbEmbedding.entry_id);
          if (entry) {
            similarities.push({
              entry,
              similarity,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing embedding for entry ${dbEmbedding.entry_id}:`, error);
        continue;
      }
    }

    // Sort by similarity (descending) and limit
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    console.error('Error finding similar entries:', error);
    return [];
  }
}

/**
 * Generates embeddings for multiple texts in batch
 */
export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    // OpenAI supports batch embeddings, but we'll process in chunks to avoid rate limits
    const chunkSize = 100; // OpenAI allows up to 2048 inputs per request
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      
      // Truncate each text
      const truncatedChunk = chunk.map(text => {
        const maxChars = 8000;
        return text.length > maxChars ? text.slice(0, maxChars) : text;
      });

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedChunk,
      });

      const chunkResults = response.data.map(item => item.embedding);
      results.push(...chunkResults);

      // Small delay to avoid rate limits
      if (i + chunkSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  } catch (error: any) {
    console.error('Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Detects semantic relations between an entry and other entries
 * Uses embeddings to calculate similarity and saves relations
 */
export async function detectSemanticRelations(
  entryId: string,
  embedding: number[],
  allEntries: Entry[],
  threshold: number = 0.7
): Promise<Array<{ targetId: string; strength: number }>> {
  try {
    // Get all embeddings for other entries
    const otherEntryIds = allEntries
      .filter(e => e.id !== entryId)
      .map(e => e.id);
    
    if (otherEntryIds.length === 0) {
      return [];
    }

    const allEmbeddings = await db.getEmbeddingsByEntryIds(otherEntryIds);
    
    const relations: Array<{ targetId: string; strength: number }> = [];

    for (const dbEmbedding of allEmbeddings) {
      try {
        const storedEmbedding = JSON.parse(dbEmbedding.embedding) as number[];
        const similarity = calculateCosineSimilarity(embedding, storedEmbedding);

        if (similarity >= threshold) {
          relations.push({
            targetId: dbEmbedding.entry_id,
            strength: similarity,
          });
        }
      } catch (error) {
        console.error(`Error processing embedding for entry ${dbEmbedding.entry_id}:`, error);
        continue;
      }
    }

    // Sort by strength (descending)
    relations.sort((a, b) => b.strength - a.strength);

    // Save relations to database
    for (const relation of relations) {
      try {
        const relationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await db.createEntryRelation(relationId, entryId, relation.targetId, relation.strength);
      } catch (error) {
        // Relation might already exist (unique constraint), that's okay
        console.log(`Relation already exists or error saving: ${entryId} -> ${relation.targetId}`);
      }
    }

    return relations;
  } catch (error) {
    console.error('Error detecting semantic relations:', error);
    return [];
  }
}

