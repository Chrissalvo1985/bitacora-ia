import { neon } from '@neondatabase/serverless';

// Initialize Neon client
// Get from process.env (Node.js) or import.meta.env (Vite/browser)
function getDatabaseUrl(): string | undefined {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env?.VITE_NEON_DATABASE_URL) {
    return process.env.VITE_NEON_DATABASE_URL;
  }
  // Vite/browser environment
  try {
    // @ts-ignore - import.meta is available in Vite
    if (import.meta?.env?.VITE_NEON_DATABASE_URL) {
      // @ts-ignore
      return import.meta.env.VITE_NEON_DATABASE_URL;
    }
  } catch (e) {
    // Ignore
  }
  return undefined;
}

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  console.warn('VITE_NEON_DATABASE_URL not found. Database operations will fail.');
}

const sql = databaseUrl ? neon(databaseUrl) : null;

// Helper to check if database is available
function requireDb() {
  if (!sql) {
    throw new Error('Database not configured. Please set VITE_NEON_DATABASE_URL');
  }
  return sql;
}

export interface DbFolder {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBook {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  context: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEntry {
  id: string;
  user_id: string;
  original_text: string;
  book_id: string;
  type: string;
  summary: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbTask {
  id: string;
  entry_id: string;
  description: string;
  assignee: string | null;
  due_date: string | null;
  is_done: boolean;
  priority: string | null;
  completion_notes: string | null;
  created_at: string;
}

export interface DbEntity {
  id: string;
  entry_id: string;
  name: string;
  type: string;
  created_at: string;
}

// Initialize database schema
export async function initDatabase() {
  if (!sql) {
    console.warn('Database not configured. Skipping initialization.');
    return false;
  }
  
  try {
    const db = requireDb();
    // Create folders table (with user_id for multi-user support)
    await db`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create books table (with user_id for multi-user support)
    await db`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        context TEXT,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create entries table (with user_id for multi-user support)
    await db`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        original_text TEXT NOT NULL,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create tasks table
    await db`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        assignee TEXT,
        due_date DATE,
        is_done BOOLEAN DEFAULT FALSE,
        priority TEXT DEFAULT 'MEDIUM',
        completion_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Add completion_notes column if it doesn't exist (for existing databases)
    // PostgreSQL/Neon doesn't support IF NOT EXISTS in ALTER TABLE, so we check first
    try {
      const columnExists = await db`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'completion_notes'
      `;
      if (columnExists.length === 0) {
        await db`ALTER TABLE tasks ADD COLUMN completion_notes TEXT`;
      }
    } catch (error) {
      // Column might already exist or table doesn't exist yet, ignore
      console.log('Note: completion_notes column check skipped:', error);
    }

    // Create entities table (people, companies, etc.)
    await db`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add folder_id column to books table if it doesn't exist (migration)
    try {
      await db`
        ALTER TABLE books 
        ADD COLUMN IF NOT EXISTS folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL
      `;
    } catch (error) {
      // If column already exists or table doesn't support IF NOT EXISTS, try without it
      try {
        const checkColumn = await db`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'books' AND column_name = 'folder_id'
        `;
        if (checkColumn.length === 0) {
          await db`ALTER TABLE books ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`;
        }
      } catch (e) {
        console.warn('Could not add folder_id column (may already exist):', e);
      }
    }

    // Create indexes
    await db`CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id)`;
    try {
      await db`CREATE INDEX IF NOT EXISTS idx_books_folder_id ON books(folder_id)`;
    } catch (e) {
      console.warn('Could not create folder_id index (may already exist):', e);
    }
    await db`CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_entries_book_id ON entries(book_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tasks_entry_id ON tasks(entry_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tasks_is_done ON tasks(is_done)`;
    await db`CREATE INDEX IF NOT EXISTS idx_entities_entry_id ON entities(entry_id)`;

    // Note: Default inbox book will be created per user when they first use the app

    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't throw - allow app to work with localStorage fallback
    return false;
  }
}

// Books operations (now user-scoped)
export async function getAllBooks(userId: string): Promise<DbBook[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM books WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return result as DbBook[];
}

export async function getBookById(id: string, userId: string): Promise<DbBook | null> {
  const db = requireDb();
  const result = await db`SELECT * FROM books WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbBook[];
  return result[0] || null;
}

export async function createBook(id: string, userId: string, name: string, description?: string, context?: string, folderId?: string): Promise<DbBook> {
  const db = requireDb();
  await db`
    INSERT INTO books (id, user_id, name, description, context, folder_id)
    VALUES (${id}, ${userId}, ${name}, ${description || null}, ${context || null}, ${folderId || null})
  `;
  const result = await db`SELECT * FROM books WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbBook[];
  return result[0];
}

// Folders operations (user-scoped)
export async function getAllFolders(userId: string): Promise<DbFolder[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM folders WHERE user_id = ${userId} ORDER BY name ASC`;
  return result as DbFolder[];
}

export async function getFolderById(id: string, userId: string): Promise<DbFolder | null> {
  const db = requireDb();
  const result = await db`SELECT * FROM folders WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbFolder[];
  return result[0] || null;
}

export async function createFolder(id: string, userId: string, name: string, color?: string): Promise<DbFolder> {
  const db = requireDb();
  await db`
    INSERT INTO folders (id, user_id, name, color)
    VALUES (${id}, ${userId}, ${name}, ${color || null})
  `;
  const result = await db`SELECT * FROM folders WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbFolder[];
  return result[0];
}

export async function updateFolder(id: string, updates: { name?: string; color?: string }): Promise<void> {
  const db = requireDb();
  if (updates.name !== undefined) {
    await db`UPDATE folders SET name = ${updates.name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.color !== undefined) {
    await db`UPDATE folders SET color = ${updates.color}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
}

export async function deleteFolder(id: string, userId: string): Promise<void> {
  const db = requireDb();
  // First, remove folder_id from all books in this folder
  await db`UPDATE books SET folder_id = NULL WHERE folder_id = ${id} AND user_id = ${userId}`;
  // Then delete the folder
  await db`DELETE FROM folders WHERE id = ${id} AND user_id = ${userId}`;
}

export async function updateBook(id: string, updates: { name?: string; description?: string; context?: string; folderId?: string }): Promise<void> {
  const db = requireDb();
  if (updates.name !== undefined) {
    await db`UPDATE books SET name = ${updates.name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.folderId !== undefined) {
    await db`UPDATE books SET folder_id = ${updates.folderId || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.description !== undefined) {
    await db`UPDATE books SET description = ${updates.description}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.context !== undefined) {
    await db`UPDATE books SET context = ${updates.context}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
}

export async function deleteBook(id: string, userId: string): Promise<void> {
  const db = requireDb();
  await db`DELETE FROM books WHERE id = ${id} AND user_id = ${userId}`;
}

// Entries operations (now user-scoped)
export async function getAllEntries(userId: string, limit?: number): Promise<DbEntry[]> {
  const db = requireDb();
  if (limit) {
    const result = await db`SELECT * FROM entries WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
    return result as DbEntry[];
  }
  const result = await db`SELECT * FROM entries WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return result as DbEntry[];
}

export async function getEntriesByBookId(bookId: string, userId: string): Promise<DbEntry[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM entries WHERE book_id = ${bookId} AND user_id = ${userId} ORDER BY created_at DESC`;
  return result as DbEntry[];
}

export async function getEntryById(id: string, userId: string): Promise<DbEntry | null> {
  const db = requireDb();
  const result = await db`SELECT * FROM entries WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbEntry[];
  return result[0] || null;
}

export async function createEntry(
  id: string,
  userId: string,
  originalText: string,
  bookId: string,
  type: string,
  summary: string,
  status: string = 'COMPLETED'
): Promise<DbEntry> {
  const db = requireDb();
  await db`
    INSERT INTO entries (id, user_id, original_text, book_id, type, summary, status)
    VALUES (${id}, ${userId}, ${originalText}, ${bookId}, ${type}, ${summary}, ${status})
  `;
  const result = await db`SELECT * FROM entries WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbEntry[];
  return result[0];
}

export async function updateEntry(id: string, updates: { summary?: string; status?: string; type?: string }): Promise<void> {
  const db = requireDb();
  if (updates.summary !== undefined) {
    await db`UPDATE entries SET summary = ${updates.summary}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.status !== undefined) {
    await db`UPDATE entries SET status = ${updates.status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.type !== undefined) {
    await db`UPDATE entries SET type = ${updates.type}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
}

export async function deleteEntry(id: string, userId: string): Promise<void> {
  const db = requireDb();
  await db`DELETE FROM entries WHERE id = ${id} AND user_id = ${userId}`;
}

// Tasks operations
export async function getTasksByEntryId(entryId: string): Promise<DbTask[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM tasks WHERE entry_id = ${entryId} ORDER BY created_at ASC`;
  return result as DbTask[];
}

export async function getAllTasks(filters?: { isDone?: boolean; bookId?: string }): Promise<DbTask[]> {
  const db = requireDb();
  if (filters?.isDone !== undefined && filters?.bookId) {
    const result = await db`
      SELECT t.* FROM tasks t
      JOIN entries e ON t.entry_id = e.id
      WHERE t.is_done = ${filters.isDone} AND e.book_id = ${filters.bookId}
      ORDER BY t.created_at DESC
    `;
    return result as DbTask[];
  }
  if (filters?.isDone !== undefined) {
    const result = await db`SELECT * FROM tasks WHERE is_done = ${filters.isDone} ORDER BY created_at DESC`;
    return result as DbTask[];
  }
  if (filters?.bookId) {
    const result = await db`
      SELECT t.* FROM tasks t
      JOIN entries e ON t.entry_id = e.id
      WHERE e.book_id = ${filters.bookId}
      ORDER BY t.created_at DESC
    `;
    return result as DbTask[];
  }
  const result = await db`SELECT * FROM tasks ORDER BY created_at DESC`;
  return result as DbTask[];
}

export async function createTask(
  id: string,
  entryId: string,
  description: string,
  assignee?: string,
  dueDate?: string,
  priority: string = 'MEDIUM'
): Promise<DbTask> {
  const db = requireDb();
  await db`
    INSERT INTO tasks (id, entry_id, description, assignee, due_date, priority)
    VALUES (${id}, ${entryId}, ${description}, ${assignee || null}, ${dueDate || null}, ${priority})
  `;
  const result = await db`SELECT * FROM tasks WHERE id = ${id} LIMIT 1` as DbTask[];
  return result[0];
}

export async function updateTask(id: string, updates: { isDone?: boolean; description?: string; assignee?: string; dueDate?: string; priority?: string; completionNotes?: string }): Promise<void> {
  const db = requireDb();
  if (updates.isDone !== undefined) {
    await db`UPDATE tasks SET is_done = ${updates.isDone} WHERE id = ${id}`;
  }
  if (updates.description !== undefined) {
    await db`UPDATE tasks SET description = ${updates.description} WHERE id = ${id}`;
  }
  if (updates.assignee !== undefined) {
    await db`UPDATE tasks SET assignee = ${updates.assignee} WHERE id = ${id}`;
  }
  if (updates.dueDate !== undefined) {
    await db`UPDATE tasks SET due_date = ${updates.dueDate} WHERE id = ${id}`;
  }
  if (updates.priority !== undefined) {
    await db`UPDATE tasks SET priority = ${updates.priority} WHERE id = ${id}`;
  }
  if (updates.completionNotes !== undefined) {
    await db`UPDATE tasks SET completion_notes = ${updates.completionNotes} WHERE id = ${id}`;
  }
}

export async function deleteTask(id: string): Promise<void> {
  const db = requireDb();
  await db`DELETE FROM tasks WHERE id = ${id}`;
}

// Entities operations
export async function getEntitiesByEntryId(entryId: string): Promise<DbEntity[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM entities WHERE entry_id = ${entryId}`;
  return result as DbEntity[];
}

export async function createEntity(id: string, entryId: string, name: string, type: string): Promise<DbEntity> {
  const db = requireDb();
  await db`
    INSERT INTO entities (id, entry_id, name, type)
    VALUES (${id}, ${entryId}, ${name}, ${type})
  `;
  const result = await db`SELECT * FROM entities WHERE id = ${id} LIMIT 1` as DbEntity[];
  return result[0];
}

// Search operations (user-scoped)
export async function searchEntries(query: string, filters?: { userId?: string; bookId?: string; type?: string; dateFrom?: string; dateTo?: string }): Promise<DbEntry[]> {
  const db = requireDb();
  const searchPattern = `%${query}%`;
  const userId = filters?.userId;
  
  if (!userId) {
    throw new Error('User ID is required for search');
  }
  
  if (filters?.bookId && filters?.type) {
    const result = await db`
      SELECT DISTINCT e.* FROM entries e
      WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
        AND e.user_id = ${userId}
        AND e.book_id = ${filters.bookId}
        AND e.type = ${filters.type}
        ${filters.dateFrom ? db`AND e.created_at >= ${filters.dateFrom}` : db``}
        ${filters.dateTo ? db`AND e.created_at <= ${filters.dateTo}` : db``}
      ORDER BY e.created_at DESC
    `;
    return result as DbEntry[];
  }
  
  if (filters?.bookId) {
    const result = await db`
      SELECT DISTINCT e.* FROM entries e
      WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
        AND e.user_id = ${userId}
        AND e.book_id = ${filters.bookId}
        ${filters.dateFrom ? db`AND e.created_at >= ${filters.dateFrom}` : db``}
        ${filters.dateTo ? db`AND e.created_at <= ${filters.dateTo}` : db``}
      ORDER BY e.created_at DESC
    `;
    return result as DbEntry[];
  }
  
  if (filters?.type) {
    const result = await db`
      SELECT DISTINCT e.* FROM entries e
      WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
        AND e.user_id = ${userId}
        AND e.type = ${filters.type}
        ${filters.dateFrom ? db`AND e.created_at >= ${filters.dateFrom}` : db``}
        ${filters.dateTo ? db`AND e.created_at <= ${filters.dateTo}` : db``}
      ORDER BY e.created_at DESC
    `;
    return result as DbEntry[];
  }
  
  const result = await db`
    SELECT DISTINCT e.* FROM entries e
    WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
      AND e.user_id = ${userId}
      ${filters?.dateFrom ? db`AND e.created_at >= ${filters.dateFrom}` : db``}
      ${filters?.dateTo ? db`AND e.created_at <= ${filters.dateTo}` : db``}
    ORDER BY e.created_at DESC
  `;
  return result as DbEntry[];
}

export default sql;

