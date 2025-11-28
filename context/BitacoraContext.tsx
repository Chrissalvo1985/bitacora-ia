import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, Entry, EntryStatus, NoteType, TaskItem, Attachment, SearchFilters, WeeklySummary, Folder } from '../types';
import { analyzeEntry, updateBookContext, generateSummary, queryBitacora } from '../services/openaiService';
import { analyzeDocument, DocumentInsight } from '../services/documentAnalysisService';
import { findRelatedEntry } from '../services/entryMatchingService';
import * as dataService from '../services/dataService';
import { initDatabase } from '../services/db';
import { AuthContext } from './AuthContext';

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface BitacoraContextType {
  books: Book[];
  folders: Folder[];
  entries: Entry[];
  isLoading: boolean;
  isInitializing: boolean;
  addEntry: (text: string, attachment?: Attachment, skipSummaryModal?: boolean) => Promise<{ 
    shouldShowModal?: boolean; 
    insights?: DocumentInsight[];
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

  const refreshData = async () => {
    if (!user?.id) return;
    
    try {
      const [loadedBooks, loadedEntries, loadedFolders] = await Promise.all([
        dataService.loadAllBooks(user.id),
        dataService.loadAllEntries(user.id),
        dataService.loadAllFolders(user.id),
      ]);
      setBooks(loadedBooks);
      setEntries(loadedEntries);
      setFolders(loadedFolders);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const getBookName = (id: string) => books.find(b => b.id === id)?.name || 'Desconocido';

  const addEntry = async (
    text: string, 
    attachment?: Attachment,
    skipSummaryModal?: boolean
  ): Promise<{ 
    shouldShowModal?: boolean; 
    insights?: DocumentInsight[];
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
    const tempId = generateId(); // Define outside try for error handling
    
    try {
      // 1. Check if this is an update to existing content (only if no attachment)
      if (!attachment && text.trim()) {
        const allTasks = entries.flatMap(e => e.tasks.map((t, idx) => ({ ...t, entryId: e.id, taskIndex: idx })));
        const match = await findRelatedEntry(text, entries, allTasks);
        
        if (match.shouldUpdate && match.taskToUpdate) {
          // Update existing task
          const entry = entries.find(e => e.id === match.taskToUpdate!.entryId);
          if (entry) {
            const updatedTasks = [...entry.tasks];
            updatedTasks[match.taskToUpdate.taskIndex] = {
              ...updatedTasks[match.taskToUpdate.taskIndex],
              isDone: true,
              completionNotes: match.completionNotes || undefined
            };
            
            // Update in UI
            setEntries(prev => prev.map(e => 
              e.id === entry.id ? { ...e, tasks: updatedTasks } : e
            ));
            
            // Update in DB
            if (updatedTasks[match.taskToUpdate.taskIndex].id) {
              await dataService.updateTaskStatus(
                updatedTasks[match.taskToUpdate.taskIndex].id!,
                true,
                match.completionNotes
              );
            }
            
            // Refresh to ensure sync
            await refreshData();
            
            setIsLoading(false);
            return; // Don't create new entry
          }
        }
      }

      // 2. If there's an attachment, analyze it deeply
      let documentInsights: DocumentInsight[] = [];
      if (attachment) {
        const allTasks = entries.flatMap(e => e.tasks.map((t, idx) => ({ ...t, entryId: e.id, taskIndex: idx })));
        const docAnalysis = await analyzeDocument(
          text,
          attachment,
          entries,
          books,
          allTasks
        );
        documentInsights = docAnalysis.insights;
      }

      // 3. Create a temporary processing entry
      const tempEntry: Entry = {
        id: tempId,
        originalText: text,
        createdAt: Date.now(),
        bookId: 'processing',
        type: NoteType.NOTE,
        summary: 'La IA está pensando...',
        tasks: [],
        entities: [],
        attachment: attachment,
        status: EntryStatus.PROCESSING
      };

      setEntries(prev => [tempEntry, ...prev]);

      // 4. Call OpenAI Analysis
      const analysis = await analyzeEntry(text, books, attachment);

      // 3. Find or Create Book - Improved matching
      // First try exact match (case insensitive)
      let targetBook = books.find(b => b.name.toLowerCase().trim() === analysis.targetBookName.toLowerCase().trim());
      
      // If no exact match, try fuzzy matching based on context and keywords
      if (!targetBook) {
        const analysisLower = analysis.targetBookName.toLowerCase();
        const analysisKeywords = analysisLower.split(/\s+/).filter(w => w.length > 2);
        
        // Try to find by keywords in name or context
        targetBook = books.find(b => {
          const bookNameLower = b.name.toLowerCase();
          const bookContextLower = (b.context || '').toLowerCase();
          
          // Check if keywords match book name or context
          const nameMatch = analysisKeywords.some(kw => bookNameLower.includes(kw));
          const contextMatch = analysisKeywords.some(kw => bookContextLower.includes(kw));
          
          // Also check if book name is contained in analysis or vice versa
          const containsMatch = bookNameLower.includes(analysisLower) || analysisLower.includes(bookNameLower);
          
          return nameMatch || contextMatch || containsMatch;
        });
      }
      
      let targetBookId = targetBook?.id;
      
      if (!targetBook) {
        // Create new book
        targetBookId = generateId();
        targetBook = {
          id: targetBookId,
          name: analysis.targetBookName,
          createdAt: Date.now(),
          context: 'Nuevo tema detectado.'
        };
        setBooks(prev => [...prev, targetBook!]);
        
        // Save to DB
        try {
          await dataService.createBook(targetBookId, user.id, analysis.targetBookName, undefined, 'Nuevo tema detectado.');
        } catch (error) {
          console.error('Error creating book in DB:', error);
        }
      } else {
        targetBookId = targetBook.id;
      }

      // 4. Prepare analysis summary
      const analysisSummary = {
        bookName: analysis.targetBookName,
        bookId: targetBookId,
        type: analysis.type,
        summary: analysis.summary,
        tasks: analysis.tasks.map(t => ({ 
          ...t, 
          isDone: false,
          priority: (t.priority as any) || 'MEDIUM' as any
        })),
        entities: analysis.entities.map(e => ({ name: e.name, type: e.type as any })),
        isNewBook: !targetBook,
        tempEntryId: tempId
      };

      // 5. If skipSummaryModal, save directly. Otherwise, show modal first
      if (skipSummaryModal) {
        const finalEntry: Entry = {
          ...tempEntry,
          bookId: targetBookId!,
          type: analysis.type,
          summary: analysis.summary,
          tasks: analysisSummary.tasks,
          entities: analysisSummary.entities,
          status: EntryStatus.COMPLETED
        };

        await dataService.saveEntry(finalEntry, user.id, analysis);
        setEntries(prev => prev.map(e => e.id === tempId ? finalEntry : e));
        
        // Refresh to get proper task IDs from DB
        await refreshData();

        updateBookContext(targetBook.name, targetBook.context, analysis.summary).then(newContext => {
          setBooks(prevBooks => prevBooks.map(b => 
            b.id === targetBookId ? { ...b, context: newContext } : b
          ));
        });

        if (documentInsights.length > 0) {
          setIsLoading(false);
          return { shouldShowModal: true, insights: documentInsights };
        }
      } else {
        // Show summary modal first
        setIsLoading(false);
        return { 
          analysisSummary: {
            ...analysisSummary,
            tempEntryId: tempId
          },
          shouldShowModal: documentInsights.length > 0,
          insights: documentInsights
        };
      }

    } catch (error) {
      console.error(error);
      setEntries(prev => prev.map(e => {
        if (e.id === tempId) {
          return {
            ...e,
            status: EntryStatus.ERROR,
            summary: 'Ups, algo falló al procesar. Guardado en crudo.',
            bookId: 'inbox'
          };
        }
        return e;
      }));
    } finally {
      setIsLoading(false);
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
      updateEntrySummary,
      confirmEntryWithEdits,
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
