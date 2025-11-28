import * as db from './db';
import { Book, Entry, TaskItem, Entity, EntryStatus, NoteType, EntityType, Folder } from '../types';

// Convert DB types to app types
export function dbFolderToFolder(dbFolder: db.DbFolder): Folder {
  return {
    id: dbFolder.id,
    name: dbFolder.name,
    color: dbFolder.color || undefined,
    createdAt: new Date(dbFolder.created_at).getTime(),
    updatedAt: new Date(dbFolder.updated_at).getTime(),
  };
}

export function dbBookToBook(dbBook: db.DbBook): Book {
  return {
    id: dbBook.id,
    name: dbBook.name.slice(0, 200), // Sanitize length
    description: dbBook.description ? dbBook.description.slice(0, 500) : undefined,
    context: dbBook.context ? dbBook.context.slice(0, 1000) : undefined,
    folderId: dbBook.folder_id || undefined,
    createdAt: new Date(dbBook.created_at).getTime(),
    updatedAt: new Date(dbBook.updated_at).getTime(),
  };
}

export function dbEntryToEntry(
  dbEntry: db.DbEntry,
  tasks: TaskItem[],
  entities: Entity[]
): Entry {
  return {
    id: dbEntry.id,
    originalText: dbEntry.original_text,
    createdAt: new Date(dbEntry.created_at).getTime(),
    bookId: dbEntry.book_id,
    type: dbEntry.type as NoteType,
    summary: dbEntry.summary,
    tasks,
    entities,
    status: dbEntry.status as EntryStatus,
  };
}

export function dbTaskToTaskItem(dbTask: db.DbTask): TaskItem {
  // Ensure dueDate is always a string, not a Date object
  let dueDate: string | undefined = undefined;
  if (dbTask.due_date) {
    if (dbTask.due_date instanceof Date) {
      dueDate = dbTask.due_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    } else if (typeof dbTask.due_date === 'string') {
      dueDate = dbTask.due_date;
    }
  }
  
  return {
    id: dbTask.id,
    description: dbTask.description,
    assignee: dbTask.assignee || undefined,
    dueDate,
    isDone: dbTask.is_done,
    priority: (dbTask.priority as any) || undefined,
    completionNotes: dbTask.completion_notes || undefined,
  };
}

export function dbEntityToEntity(dbEntity: db.DbEntity): Entity {
  return {
    id: dbEntity.id,
    name: dbEntity.name,
    type: dbEntity.type as EntityType,
  };
}

// Load all data (user-scoped)
export async function loadAllBooks(userId: string): Promise<Book[]> {
  try {
    const dbBooks = await db.getAllBooks(userId);
    
    // If no books, create default inbox
    if (dbBooks.length === 0) {
      const inboxBook = await db.createBook('inbox', userId, 'Bandeja de Entrada', 'Notas sin clasificar y pensamientos rápidos.', 'Notas sin clasificar y pensamientos rápidos.');
      return [dbBookToBook(inboxBook)];
    }
    
    return dbBooks.map(dbBookToBook);
  } catch (error) {
    console.error('Error loading books:', error);
    return [{ id: 'inbox', name: 'Bandeja de Entrada', createdAt: Date.now(), context: 'Notas sin clasificar y pensamientos rápidos.' }];
  }
}

export async function loadAllEntries(userId: string): Promise<Entry[]> {
  try {
    const dbEntries = await db.getAllEntries(userId);
    const entries: Entry[] = [];
    
    for (const dbEntry of dbEntries) {
      const tasks = await db.getTasksByEntryId(dbEntry.id);
      const entities = await db.getEntitiesByEntryId(dbEntry.id);
      
      entries.push(dbEntryToEntry(
        dbEntry,
        tasks.map(dbTaskToTaskItem),
        entities.map(dbEntityToEntity)
      ));
    }
    
    return entries;
  } catch (error) {
    console.error('Error loading entries:', error);
    return [];
  }
}

// Save entry with tasks and entities (user-scoped)
// Note: Attachments are NOT saved - they're only used as context for AI analysis
export async function saveEntry(
  entry: Entry,
  userId: string,
  analysis: {
    targetBookName: string;
    type: NoteType;
    summary: string;
    tasks: { description: string; assignee?: string; dueDate?: string; priority?: string }[];
    entities: { name: string; type: string }[];
  }
): Promise<void> {
  try {
    // Find or create book
    let targetBook = await db.getBookById(entry.bookId, userId);
    
    if (!targetBook) {
      // Try to find by name
      const allBooks = await db.getAllBooks(userId);
      const foundBook = allBooks.find(b => b.name.toLowerCase() === analysis.targetBookName.toLowerCase());
      
      if (foundBook) {
        targetBook = foundBook;
        entry.bookId = foundBook.id;
      } else {
        // Create new book
        await db.createBook(entry.bookId, userId, analysis.targetBookName, undefined, 'Nuevo tema detectado.', undefined);
        targetBook = await db.getBookById(entry.bookId, userId);
      }
    }

    // Save entry (without attachment - attachments are only used for AI context)
    await db.createEntry(
      entry.id,
      userId,
      entry.originalText,
      entry.bookId,
      entry.type,
      entry.summary,
      entry.status
    );

    // Save tasks
    for (const task of analysis.tasks) {
      const taskId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await db.createTask(
        taskId,
        entry.id,
        task.description,
        task.assignee,
        task.dueDate,
        task.priority || 'MEDIUM'
      );
    }

    // Save entities
    for (const entity of analysis.entities) {
      const entityId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await db.createEntity(entityId, entry.id, entity.name, entity.type);
    }
  } catch (error) {
    console.error('Error saving entry:', error);
    throw error;
  }
}

// Update task
export async function updateTaskStatus(taskId: string, isDone: boolean, completionNotes?: string): Promise<void> {
  try {
    await db.updateTask(taskId, { isDone, completionNotes });
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

// Update task fields (assignee, dueDate, priority, description)
export async function updateTaskFields(
  taskId: string, 
  updates: { assignee?: string; dueDate?: string; priority?: string; description?: string }
): Promise<void> {
  try {
    await db.updateTask(taskId, updates);
  } catch (error) {
    console.error('Error updating task fields:', error);
    throw error;
  }
}

// Delete entry (user-scoped)
export async function deleteEntryFromDb(entryId: string, userId: string): Promise<void> {
  try {
    await db.deleteEntry(entryId, userId);
  } catch (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
}

// Search entries (user-scoped)
export async function searchEntriesInDb(userId: string, filters: {
  query?: string;
  bookId?: string;
  type?: NoteType;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Entry[]> {
  try {
    const dbEntries = await db.searchEntries(
      filters.query || '',
      {
        userId,
        bookId: filters.bookId,
        type: filters.type,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }
    );

    const entries: Entry[] = [];
    
    for (const dbEntry of dbEntries) {
      const tasks = await db.getTasksByEntryId(dbEntry.id);
      const entities = await db.getEntitiesByEntryId(dbEntry.id);
      
      entries.push(dbEntryToEntry(
        dbEntry,
        tasks.map(dbTaskToTaskItem),
        entities.map(dbEntityToEntity)
      ));
    }
    
    return entries;
  } catch (error) {
    console.error('Error searching entries:', error);
    return [];
  }
}

// Get all tasks
export async function getAllTasksFromDb(filters?: { isDone?: boolean; bookId?: string }): Promise<TaskItem[]> {
  try {
    const dbTasks = await db.getAllTasks(filters);
    return dbTasks.map(dbTaskToTaskItem);
  } catch (error) {
    console.error('Error loading tasks:', error);
    return [];
  }
}

// Create book (user-scoped)
export async function createBook(id: string, userId: string, name: string, description?: string, context?: string, folderId?: string): Promise<Book> {
  try {
    await db.createBook(id, userId, name, description, context, folderId);
    const dbBook = await db.getBookById(id, userId);
    if (!dbBook) throw new Error('Book not created');
    return dbBookToBook(dbBook);
  } catch (error) {
    console.error('Error creating book:', error);
    throw error;
  }
}

// Folders operations (user-scoped)
export async function loadAllFolders(userId: string): Promise<Folder[]> {
  try {
    const dbFolders = await db.getAllFolders(userId);
    return dbFolders.map(dbFolderToFolder);
  } catch (error) {
    console.error('Error loading folders:', error);
    return [];
  }
}

export async function createFolder(id: string, userId: string, name: string, color?: string): Promise<Folder> {
  try {
    await db.createFolder(id, userId, name, color);
    const dbFolder = await db.getFolderById(id, userId);
    if (!dbFolder) throw new Error('Folder not created');
    return dbFolderToFolder(dbFolder);
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

export async function updateFolder(id: string, updates: { name?: string; color?: string }): Promise<void> {
  try {
    await db.updateFolder(id, updates);
  } catch (error) {
    console.error('Error updating folder:', error);
    throw error;
  }
}

export async function deleteFolder(id: string, userId: string): Promise<void> {
  try {
    await db.deleteFolder(id, userId);
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
}

export async function updateBookFolder(bookId: string, folderId: string | null): Promise<void> {
  try {
    await db.updateBook(bookId, { folderId: folderId || undefined });
  } catch (error) {
    console.error('Error updating book folder:', error);
    throw error;
  }
}

