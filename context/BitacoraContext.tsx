import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Book, Entry, EntryStatus, NoteType, TaskItem, Attachment, SearchFilters, WeeklySummary, Folder, MultiTopicAnalysis, TopicEntry, Entity } from '../types';
import { analyzeEntry, updateBookContext, generateSummary, queryBitacora, analyzeMultiTopicEntry } from '../services/openaiService';
import { analyzeDocument, DocumentInsight } from '../services/documentAnalysisService';
import { findRelatedEntry } from '../services/entryMatchingService';
import * as dataService from '../services/dataService';
import { initDatabase } from '../services/db';
import { AuthContext } from './AuthContext';
import { CacheService, CACHE_KEYS } from '../services/cacheService';

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Result type for multi-topic analysis
interface MultiTopicResult {
  isMultiTopic: boolean;
  topics: Array<{
    bookName: string;
    bookId: string;
    type: NoteType;
    summary: string;
    tasks: TaskItem[];
    entities: { name: string; type: string }[];
    isNewBook: boolean;
    entryId: string;
    originalText: string;
    taskActions: Array<{
      action: 'complete' | 'update';
      taskDescription: string;
      completionNotes?: string;
    }>;
  }>;
  overallContext: string;
  completedTasks: number;
}

interface BitacoraContextType {
  books: Book[];
  folders: Folder[];
  entries: Entry[];
  isLoading: boolean;
  isInitializing: boolean;
  addEntry: (text: string, attachment?: Attachment, skipSummaryModal?: boolean, targetBookId?: string) => Promise<{ 
    shouldShowModal?: boolean; 
    insights?: DocumentInsight[];
    multiTopicResult?: MultiTopicResult;
    analysisSummary?: {
      bookName: string;
      bookId?: string;
      type: NoteType;
      summary: string;
      tasks: TaskItem[];
      entities: { name: string; type: string }[];
      isNewBook: boolean;
    };
  } | void>;
  toggleTask: (entryId: string, taskIndex: number) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getBookName: (id: string) => string;
  searchEntries: (filters: SearchFilters) => Promise<Entry[]>;
  generateWeeklySummary: (period: 'day' | 'week' | 'month') => Promise<WeeklySummary>;
  queryAI: (query: string) => Promise<string>;
  createBook: (name: string, description?: string, folderId?: string) => Promise<Book>;
  updateBook: (id: string, updates: { name?: string; description?: string; folderId?: string }) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  createFolder: (name: string, color?: string) => Promise<Folder>;
  updateFolder: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  updateBookFolder: (bookId: string, folderId: string | null) => Promise<void>;
  refreshData: () => Promise<void>;
  updateTaskStatus: (entryId: string, taskIndex: number, isDone: boolean) => Promise<void>;
  updateTaskFields: (entryId: string, taskIndex: number, updates: { assignee?: string; dueDate?: string; priority?: string; description?: string }) => Promise<void>;
  deleteTask: (entryId: string, taskIndex: number) => Promise<void>;
  updateEntrySummary: (entryId: string, newSummary: string) => Promise<void>;
  confirmEntryWithEdits: (tempEntryId: string, editedAnalysis: {
    bookName: string;
    bookId?: string;
    type: NoteType;
    summary: string;
    tasks: TaskItem[];
    entities: { name: string; type: string }[];
    isNewBook: boolean;
  }) => Promise<void>;
  confirmMultiTopicEntries: (pendingTopics: Array<{
    bookName: string;
    bookId: string;
    type: NoteType;
    summary: string;
    tasks: TaskItem[];
    entities: { name: string; type: string }[];
    isNewBook: boolean;
    entryId: string;
    originalText: string;
    taskActions: Array<{
      action: 'complete' | 'update';
      taskDescription: string;
      completionNotes?: string;
    }>;
  }>) => Promise<void>;
}

const BitacoraContext = createContext<BitacoraContextType | undefined>(undefined);

export const BitacoraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use AuthContext directly to avoid error during HMR
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const [books, setBooks] = useState<Book[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize database and load data when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsInitializing(false);
      return;
    }

    const initialize = async () => {
      try {
        setIsInitializing(true);
        // Initialize database schema
        await initDatabase();
        // Load initial data for this user
        await refreshData();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    initialize();
  }, [isAuthenticated, user?.id]);

  const refreshData = useCallback(async (useCache = true) => {
    if (!user?.id) return;
    
    try {
      // Optimistic loading: Load from cache first for instant UI
      if (useCache) {
        const cachedBooks = CacheService.get<Book[]>(`${CACHE_KEYS.BOOKS}_${user.id}`);
        const cachedEntries = CacheService.get<Entry[]>(`${CACHE_KEYS.ENTRIES}_${user.id}`);
        const cachedFolders = CacheService.get<Folder[]>(`${CACHE_KEYS.FOLDERS}_${user.id}`);
        
        if (cachedBooks) setBooks(cachedBooks);
        if (cachedEntries) setEntries(cachedEntries);
        if (cachedFolders) setFolders(cachedFolders);
      }
      
      // Then fetch fresh data in background
      const [loadedBooks, loadedEntries, loadedFolders] = await Promise.all([
        dataService.loadAllBooks(user.id),
        dataService.loadAllEntries(user.id),
        dataService.loadAllFolders(user.id),
      ]);
      
      // Update state with fresh data
      setBooks(loadedBooks);
      setEntries(loadedEntries);
      setFolders(loadedFolders);
      
      // Update cache
      CacheService.set(`${CACHE_KEYS.BOOKS}_${user.id}`, loadedBooks);
      CacheService.set(`${CACHE_KEYS.ENTRIES}_${user.id}`, loadedEntries);
      CacheService.set(`${CACHE_KEYS.FOLDERS}_${user.id}`, loadedFolders);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [user?.id]);

  const getBookName = useCallback((id: string) => books.find(b => b.id === id)?.name || 'Desconocido', [books]);

  const addEntry = async (
    text: string, 
    attachment?: Attachment,
    skipSummaryModal?: boolean,
    targetBookId?: string
  ): Promise<{ 
    shouldShowModal?: boolean; 
    insights?: DocumentInsight[];
    multiTopicResult?: MultiTopicResult;
    analysisSummary?: {
      bookName: string;
      bookId?: string;
      type: NoteType;
      summary: string;
      tasks: TaskItem[];
      entities: Entity[];
      isNewBook: boolean;
    };
  } | void> => {
    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    setIsLoading(true);
    
    try {
      // Log attachment info for debugging
      if (attachment) {
        console.log('📎 Attachment info:', {
          type: attachment.type,
          fileName: attachment.fileName,
          hasExtractedText: !!attachment.extractedText,
          extractedTextLength: attachment.extractedText?.length || 0,
        });
      }

      // Get all existing tasks for context
      const allExistingTasks = entries.flatMap(e => e.tasks.map((t, idx) => ({ 
        ...t, 
        entryId: e.id, 
        taskIndex: idx 
      })));

      // If targetBookId is provided, use single-entry analysis (no multi-topic)
      if (targetBookId) {
        const targetBook = books.find(b => b.id === targetBookId);
        if (!targetBook) {
          throw new Error('Libreta no encontrada');
        }

        console.log('📚 Analyzing for specific book:', targetBook.name);
        const analysis = await analyzeEntry(text, books, attachment);
        
        const entryId = generateId();
        const processedTopic: MultiTopicResult['topics'][0] = {
          bookName: targetBook.name,
          bookId: targetBookId,
          type: analysis.type as NoteType,
          summary: analysis.summary,
          tasks: analysis.tasks.map(t => ({
            description: t.description,
            assignee: t.assignee,
            dueDate: t.dueDate,
            priority: (t.priority as any) || 'MEDIUM',
            isDone: false
          })),
          entities: analysis.entities.map(e => ({
            name: e.name,
            type: e.type as any
          })),
          isNewBook: false,
          entryId,
          originalText: text,
          taskActions: []
        };

        const multiTopicResult: MultiTopicResult = {
          isMultiTopic: false,
          topics: [processedTopic],
          overallContext: analysis.summary,
          completedTasks: 0
        };

        setIsLoading(false);
        return {
          shouldShowModal: true,
          multiTopicResult
        };
      }

      // ============================================
      // USE MULTI-TOPIC ANALYSIS (default flow)
      // ============================================
      console.log('🔍 Analyzing with multi-topic detection...');
      const multiTopicAnalysis = await analyzeMultiTopicEntry(
        text, 
        books, 
        allExistingTasks,
        attachment
      );

      console.log('📊 Multi-topic analysis result:', {
        isMultiTopic: multiTopicAnalysis.isMultiTopic,
        topicsCount: multiTopicAnalysis.topics.length,
        topics: multiTopicAnalysis.topics.map(t => t.targetBookName)
      });

      // Process each topic and create entries
      const processedTopics: MultiTopicResult['topics'] = [];
      const newEntries: Entry[] = [];
      const newBooks: Book[] = [];
      let completedTasksCount = 0;

      for (const topic of multiTopicAnalysis.topics) {
        const entryId = generateId();
        
        // Find or create book for this topic
        let targetBook = books.find(b => 
          b.name.toLowerCase().trim() === topic.targetBookName.toLowerCase().trim()
        );
        
        // Try fuzzy match if exact match fails
        if (!targetBook) {
          const topicLower = topic.targetBookName.toLowerCase();
          const topicKeywords = topicLower.split(/\s+/).filter(w => w.length > 2);
          
          targetBook = books.find(b => {
            const bookNameLower = b.name.toLowerCase();
            const bookContextLower = (b.context || '').toLowerCase();
            const nameMatch = topicKeywords.some(kw => bookNameLower.includes(kw));
            const contextMatch = topicKeywords.some(kw => bookContextLower.includes(kw));
            const containsMatch = bookNameLower.includes(topicLower) || topicLower.includes(bookNameLower);
            return nameMatch || contextMatch || containsMatch;
          });
        }
        
        let targetBookId = targetBook?.id;
        let isNewBook = false;
        
        if (!targetBook) {
          // Create new book
          targetBookId = generateId();
          targetBook = {
            id: targetBookId,
            name: topic.targetBookName,
            createdAt: Date.now(),
            context: `Tema detectado desde: "${multiTopicAnalysis.overallContext.slice(0, 100)}..."`
          };
          newBooks.push(targetBook);
          isNewBook = true;
        }

        // Create entry for this topic
        const entry: Entry = {
          id: entryId,
          originalText: topic.content,
          createdAt: Date.now(),
          bookId: targetBookId!,
          type: topic.type as NoteType,
          summary: topic.summary,
          tasks: topic.tasks.map(t => ({
            description: t.description,
            assignee: t.assignee,
            dueDate: t.dueDate,
            priority: (t.priority as any) || 'MEDIUM',
            isDone: false
          })),
          entities: topic.entities.map(e => ({
            name: e.name,
            type: e.type as any
          })),
          status: EntryStatus.COMPLETED
        };

        newEntries.push(entry);

        // Process task actions (complete existing tasks)
        for (const action of topic.taskActions || []) {
          if (action.action === 'complete') {
            // Find matching task to complete
            const matchingTask = allExistingTasks.find(t => 
              t.description.toLowerCase().includes(action.taskDescription.toLowerCase()) ||
              action.taskDescription.toLowerCase().includes(t.description.toLowerCase())
            );
            
            if (matchingTask && !matchingTask.isDone) {
              console.log(`✅ Completing task: "${matchingTask.description}"`);
              
              // Update in memory
              setEntries(prev => prev.map(e => {
                if (e.id === matchingTask.entryId) {
                  const updatedTasks = [...e.tasks];
                  updatedTasks[matchingTask.taskIndex] = {
                    ...updatedTasks[matchingTask.taskIndex],
                    isDone: true,
                    completionNotes: action.completionNotes || 'Completado según nota de actualización'
                  };
                  return { ...e, tasks: updatedTasks };
                }
                return e;
              }));
              
              // Update in DB
              if (matchingTask.id) {
                await dataService.updateTaskStatus(
                  matchingTask.id,
                  true,
                  action.completionNotes
                );
              }
              
              completedTasksCount++;
            }
          }
        }

        processedTopics.push({
          bookName: targetBook.name,
          bookId: targetBookId!,
          type: topic.type as NoteType,
          summary: topic.summary,
          tasks: entry.tasks,
          entities: topic.entities,
          isNewBook,
          entryId,
          originalText: topic.content,
          taskActions: topic.taskActions || []
        });
      }

      // DON'T save anything yet - just return the pending data for user confirmation
      // The actual saving happens in confirmMultiTopicEntries when user confirms

      // Build result with pending data (including originalText for each topic)
      const multiTopicResult: MultiTopicResult = {
        isMultiTopic: multiTopicAnalysis.isMultiTopic,
        topics: processedTopics,
        overallContext: multiTopicAnalysis.overallContext,
        completedTasks: 0 // Will be counted when confirmed
      };

      console.log('📋 Multi-topic analysis ready for confirmation:', {
        topicsCount: processedTopics.length,
        pendingBooks: newBooks.length
      });

      setIsLoading(false);
      
      // Return pending data - nothing saved yet, user must confirm
      return {
        shouldShowModal: true,
        multiTopicResult
      };

    } catch (error) {
      console.error('Error in addEntry:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const confirmEntryWithEdits = async (
    tempEntryId: string,
    editedAnalysis: {
      bookName: string;
      bookId?: string;
      type: NoteType;
      summary: string;
      tasks: TaskItem[];
      entities: Entity[];
      isNewBook: boolean;
    }
  ): Promise<void> => {
    if (!user?.id) return;

    try {
      const tempEntry = entries.find(e => e.id === tempEntryId);
      if (!tempEntry) return;

      // Ensure book exists
      let targetBook = books.find(b => b.id === editedAnalysis.bookId);
      if (!targetBook && editedAnalysis.bookId) {
        targetBook = {
          id: editedAnalysis.bookId,
          name: editedAnalysis.bookName,
          createdAt: Date.now(),
          context: 'Nuevo tema detectado.'
        };
        setBooks(prev => [...prev, targetBook!]);
        await dataService.createBook(editedAnalysis.bookId, user.id, editedAnalysis.bookName, undefined, 'Nuevo tema detectado.');
      }

      const finalEntry: Entry = {
        ...tempEntry,
        bookId: editedAnalysis.bookId || 'inbox',
        type: editedAnalysis.type,
        summary: editedAnalysis.summary,
        tasks: editedAnalysis.tasks,
        entities: editedAnalysis.entities,
        status: EntryStatus.COMPLETED
      };

      const analysis = {
        targetBookName: editedAnalysis.bookName,
        type: editedAnalysis.type,
        summary: editedAnalysis.summary,
        tasks: editedAnalysis.tasks,
        entities: editedAnalysis.entities,
        suggestedPriority: 'MEDIUM' as any
      };

      // Save entry (attachment was only used for AI context, not stored)
      await dataService.saveEntry(finalEntry, user.id, analysis);
      
      // Update local state immediately with complete entry
      setEntries(prev => prev.map(e => e.id === tempEntryId ? finalEntry : e));

      // Refresh data from DB to ensure tasks have proper IDs
      await refreshData();

      if (targetBook) {
        updateBookContext(targetBook.name, targetBook.context, editedAnalysis.summary).then(newContext => {
          setBooks(prevBooks => prevBooks.map(b => 
            b.id === editedAnalysis.bookId ? { ...b, context: newContext } : b
          ));
        });
      }
    } catch (error) {
      console.error('Error confirming entry:', error);
      setEntries(prev => prev.map(e => {
        if (e.id === tempEntryId) {
          return {
            ...e,
            status: EntryStatus.ERROR,
            summary: 'Error al guardar. Intenta de nuevo.',
          };
        }
        return e;
      }));
    }
  };

  const confirmMultiTopicEntries = async (pendingTopics: Array<{
    bookName: string;
    bookId: string;
    type: NoteType;
    summary: string;
    tasks: TaskItem[];
    entities: { name: string; type: string }[];
    isNewBook: boolean;
    entryId: string;
    originalText: string;
    taskActions: Array<{
      action: 'complete' | 'update';
      taskDescription: string;
      completionNotes?: string;
    }>;
  }>): Promise<void> => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Get all existing tasks for completing taskActions
      const allExistingTasks = entries.flatMap(e => e.tasks.map((t, idx) => ({ 
        ...t, 
        entryId: e.id, 
        taskIndex: idx 
      })));

      const newBooks: Book[] = [];
      const newEntries: Entry[] = [];
      let completedTasksCount = 0;

      for (const topic of pendingTopics) {
        // Create new book if needed
        if (topic.isNewBook) {
          const newBook: Book = {
            id: topic.bookId,
            name: topic.bookName,
            createdAt: Date.now(),
            context: `Tema detectado automáticamente.`
          };
          newBooks.push(newBook);
          
          try {
            await dataService.createBook(newBook.id, user.id, newBook.name, undefined, newBook.context);
          } catch (error) {
            console.error('Error creating book:', error);
          }
        }

        // Create entry
        const entry: Entry = {
          id: topic.entryId,
          originalText: topic.originalText,
          createdAt: Date.now(),
          bookId: topic.bookId,
          type: topic.type,
          summary: topic.summary,
          tasks: topic.tasks.map(t => ({
            description: t.description,
            assignee: t.assignee,
            dueDate: t.dueDate,
            priority: t.priority || 'MEDIUM',
            isDone: false
          })),
          entities: topic.entities.map(e => ({
            name: e.name,
            type: e.type as any
          })),
          status: EntryStatus.COMPLETED
        };

        newEntries.push(entry);

        // Save entry to DB
        try {
          const analysis = {
            targetBookName: topic.bookName,
            type: topic.type,
            summary: topic.summary,
            tasks: topic.tasks,
            entities: topic.entities,
            suggestedPriority: 'MEDIUM' as any
          };
          await dataService.saveEntry(entry, user.id, analysis);
        } catch (error) {
          console.error('Error saving entry:', error);
        }

        // Process task actions (complete existing tasks)
        for (const action of topic.taskActions || []) {
          if (action.action === 'complete') {
            const matchingTask = allExistingTasks.find(t => 
              t.description.toLowerCase().includes(action.taskDescription.toLowerCase()) ||
              action.taskDescription.toLowerCase().includes(t.description.toLowerCase())
            );
            
            if (matchingTask && !matchingTask.isDone) {
              console.log(`✅ Completing task: "${matchingTask.description}"`);
              
              if (matchingTask.id) {
                await dataService.updateTaskStatus(
                  matchingTask.id,
                  true,
                  action.completionNotes
                );
              }
              completedTasksCount++;
            }
          }
        }
      }

      // Update state
      if (newBooks.length > 0) {
        setBooks(prev => [...prev, ...newBooks]);
      }
      setEntries(prev => [...newEntries, ...prev]);

      // Refresh to get proper task IDs
      await refreshData();

      // Update book contexts in background
      for (const topic of pendingTopics) {
        const book = [...books, ...newBooks].find(b => b.id === topic.bookId);
        if (book) {
          updateBookContext(book.name, book.context, topic.summary).then(newContext => {
            setBooks(prevBooks => prevBooks.map(b => 
              b.id === topic.bookId ? { ...b, context: newContext } : b
            ));
          });
        }
      }

      console.log('✅ Multi-topic entries saved:', {
        entriesCreated: newEntries.length,
        booksCreated: newBooks.length,
        tasksCompleted: completedTasksCount
      });

    } catch (error) {
      console.error('Error confirming multi-topic entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (entryId: string, taskIndex: number, isDone: boolean): Promise<void> => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || !entry.tasks[taskIndex]) return;

    const newTasks = [...entry.tasks];
    newTasks[taskIndex] = { ...newTasks[taskIndex], isDone };

    setEntries(prev => prev.map(e => 
      e.id === entryId ? { ...e, tasks: newTasks } : e
    ));

    if (newTasks[taskIndex].id) {
      try {
        await dataService.updateTaskStatus(newTasks[taskIndex].id!, isDone);
      } catch (error) {
        console.error('Error updating task in DB:', error);
      }
    }
  };

  const updateTaskFields = async (
    entryId: string, 
    taskIndex: number, 
    updates: { assignee?: string; dueDate?: string; priority?: string; description?: string }
  ): Promise<void> => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || !entry.tasks[taskIndex]) return;

    const newTasks = [...entry.tasks];
    newTasks[taskIndex] = { ...newTasks[taskIndex], ...updates };

    // Optimistic update
    setEntries(prev => prev.map(e => 
      e.id === entryId ? { ...e, tasks: newTasks } : e
    ));

    // Update in DB
    if (newTasks[taskIndex].id) {
      try {
        await dataService.updateTaskFields(newTasks[taskIndex].id!, updates);
      } catch (error) {
        console.error('Error updating task fields in DB:', error);
        // Revert optimistic update
        setEntries(prev => prev.map(e => 
          e.id === entryId ? { ...e, tasks: entry.tasks } : e
        ));
      }
    }
  };

  const deleteTask = async (entryId: string, taskIndex: number): Promise<void> => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || !entry.tasks[taskIndex]) return;

    const taskToDelete = entry.tasks[taskIndex];
    const newTasks = entry.tasks.filter((_, idx) => idx !== taskIndex);

    // Optimistic update
    setEntries(prev => prev.map(e => 
      e.id === entryId ? { ...e, tasks: newTasks } : e
    ));

    // Delete from DB
    if (taskToDelete.id) {
      try {
        await dataService.deleteTaskFromDb(taskToDelete.id);
      } catch (error) {
        console.error('Error deleting task from DB:', error);
        // Revert optimistic update
        setEntries(prev => prev.map(e => 
          e.id === entryId ? { ...e, tasks: entry.tasks } : e
        ));
      }
    }
  };

  const updateEntrySummary = async (entryId: string, newSummary: string): Promise<void> => {
    setEntries(prev => prev.map(e => 
      e.id === entryId ? { ...e, summary: newSummary } : e
    ));

    try {
      // Update in DB would go here
    } catch (error) {
      console.error('Error updating entry summary in DB:', error);
    }
  };

  const toggleTask = async (entryId: string, taskIndex: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || !entry.tasks[taskIndex]) return;

    const task = entry.tasks[taskIndex];
    const newIsDone = !task.isDone;

    // Optimistic update
    setEntries(prev => prev.map(e => {
      if (e.id === entryId) {
        const newTasks = [...e.tasks];
        newTasks[taskIndex] = { ...newTasks[taskIndex], isDone: newIsDone };
        return { ...e, tasks: newTasks };
      }
      return e;
    }));

    // Update in DB if task has ID
    if (task.id) {
      try {
        await dataService.updateTaskStatus(task.id, newIsDone);
      } catch (error) {
        console.error('Error updating task in DB:', error);
        // Revert optimistic update
        setEntries(prev => prev.map(e => {
          if (e.id === entryId) {
            const newTasks = [...e.tasks];
            newTasks[taskIndex] = { ...newTasks[taskIndex], isDone: !newIsDone };
            return { ...e, tasks: newTasks };
          }
          return e;
        }));
      }
    }
  };

  const deleteEntry = async (id: string) => {
    if (!user?.id) return;
    
    // Optimistic update
    setEntries(prev => prev.filter(e => e.id !== id));
    
    // Delete from DB
    try {
      await dataService.deleteEntryFromDb(id, user.id);
    } catch (error) {
      console.error('Error deleting entry from DB:', error);
      // Reload to revert
      await refreshData();
    }
  };

  const searchEntries = async (filters: SearchFilters): Promise<Entry[]> => {
    if (!user?.id) return [];
    
    try {
      return await dataService.searchEntriesInDb(user.id, filters);
    } catch (error) {
      console.error('Error searching entries:', error);
      return [];
    }
  };

  const generateWeeklySummary = async (period: 'day' | 'week' | 'month'): Promise<WeeklySummary> => {
    const now = Date.now();
    const periodMs = period === 'day' ? 24 * 60 * 60 * 1000 : period === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const periodStart = now - periodMs;

    const periodEntries = entries
      .filter(e => e.createdAt >= periodStart)
      .map(e => ({
        summary: e.summary,
        type: e.type,
        createdAt: e.createdAt,
        bookName: getBookName(e.bookId),
      }));

    const summaryText = await generateSummary(periodEntries, period);

    const topDecisions = entries
      .filter(e => e.type === NoteType.DECISION && e.createdAt >= periodStart)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    const allTasks = entries.flatMap(e => e.tasks);
    const topTasks = allTasks
      .filter(t => !t.isDone)
      .slice(0, 10);

    return {
      period,
      summary: summaryText,
      topDecisions,
      topTasks,
      generatedAt: now,
    };
  };

  const queryAI = async (query: string): Promise<string> => {
    const context = {
      entries: entries.map(e => ({
        summary: e.summary,
        type: e.type,
        createdAt: e.createdAt,
        bookName: getBookName(e.bookId),
      })),
      books: books.map(b => ({
        name: b.name,
        context: b.context,
      })),
      tasks: entries.flatMap(e => e.tasks),
    };

    return await queryBitacora(query, context);
  };

  const createBook = async (name: string, description?: string, folderId?: string): Promise<Book> => {
    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    const id = generateId();
    const newBook: Book = {
      id,
      name,
      description,
      folderId,
      createdAt: Date.now(),
    };

    setBooks(prev => [...prev, newBook]);

    try {
      const created = await dataService.createBook(id, user.id, name, description, undefined, folderId);
      return created;
    } catch (error) {
      console.error('Error creating book in DB:', error);
      return newBook;
    }
  };

  const createFolder = async (name: string, color?: string): Promise<Folder> => {
    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    const id = generateId();
    const newFolder: Folder = {
      id,
      name,
      color,
      createdAt: Date.now(),
    };

    setFolders(prev => [...prev, newFolder]);

    try {
      const created = await dataService.createFolder(id, user.id, name, color);
      return created;
    } catch (error) {
      console.error('Error creating folder in DB:', error);
      return newFolder;
    }
  };

  const updateFolder = async (id: string, updates: { name?: string; color?: string }): Promise<void> => {
    setFolders(prev => prev.map(f => 
      f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
    ));

    try {
      await dataService.updateFolder(id, updates);
    } catch (error) {
      console.error('Error updating folder in DB:', error);
    }
  };

  const deleteFolder = async (id: string): Promise<void> => {
    setFolders(prev => prev.filter(f => f.id !== id));
    // Remove folder from books
    setBooks(prev => prev.map(b => b.folderId === id ? { ...b, folderId: undefined } : b));
    
    try {
      await dataService.deleteFolder(id, user!.id);
    } catch (error) {
      console.error('Error deleting folder from DB:', error);
    }
  };

  const updateBookFolder = async (bookId: string, folderId: string | null): Promise<void> => {
    setBooks(prev => prev.map(b => 
      b.id === bookId ? { ...b, folderId: folderId || undefined, updatedAt: Date.now() } : b
    ));

    try {
      await dataService.updateBookFolder(bookId, folderId);
    } catch (error) {
      console.error('Error updating book folder in DB:', error);
    }
  };

  const updateBook = async (id: string, updates: { name?: string; description?: string; folderId?: string }): Promise<void> => {
    setBooks(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
    ));

    try {
      if (updates.folderId !== undefined) {
        await dataService.updateBookFolder(id, updates.folderId || null);
      }
      // Other updates would go here
    } catch (error) {
      console.error('Error updating book in DB:', error);
    }
  };

  const deleteBook = async (id: string): Promise<void> => {
    setBooks(prev => prev.filter(b => b.id !== id));
    try {
      // Delete from DB would go here
    } catch (error) {
      console.error('Error deleting book from DB:', error);
    }
  };

  return (
    <BitacoraContext.Provider value={{
      books,
      folders,
      entries,
      isLoading,
      isInitializing,
      addEntry,
      toggleTask,
      deleteEntry,
      getBookName,
      searchEntries,
      generateWeeklySummary,
      queryAI,
      createBook,
      updateBook,
      deleteBook,
      createFolder,
      updateFolder,
      deleteFolder,
      updateBookFolder,
      refreshData,
      updateTaskStatus,
      updateTaskFields,
      deleteTask,
      updateEntrySummary,
      confirmEntryWithEdits,
      confirmMultiTopicEntries,
    }}>
      {children}
    </BitacoraContext.Provider>
  );
};

export const useBitacora = () => {
  const context = useContext(BitacoraContext);
  if (!context) {
    throw new Error('useBitacora must be used within a BitacoraProvider');
  }
  return context;
};
