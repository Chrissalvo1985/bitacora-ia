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
  thread_id: string | null;
  ai_rewritten_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbThread {
  id: string;
  user_id: string;
  title: string;
  book_id: string;
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

export interface DbEmbedding {
  id: string;
  entry_id: string;
  embedding: string; // JSON array as string
  model: string;
  created_at: string;
}

export interface DbEntryRelation {
  id: string;
  source_id: string;
  target_id: string;
  relation_strength: number;
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

    // Create threads table (conversation threads)
    await db`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create entry_embeddings table
    await db`
      CREATE TABLE IF NOT EXISTS entry_embeddings (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create entry_relations table (graph-lite)
    await db`
      CREATE TABLE IF NOT EXISTS entry_relations (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        relation_strength REAL NOT NULL CHECK (relation_strength >= 0.0 AND relation_strength <= 1.0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_id, target_id)
      )
    `;

    // Create person_summaries table (cache for AI-generated person interaction summaries)
    await db`
      CREATE TABLE IF NOT EXISTS person_summaries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        person_name TEXT NOT NULL,
        summary TEXT NOT NULL,
        entries_hash TEXT NOT NULL,
        last_entry_timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, person_name)
      )
    `;

    // Add thread_id column to entries table if it doesn't exist (migration)
    try {
      const threadIdColumnExists = await db`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'entries' AND column_name = 'thread_id'
      `;
      if (threadIdColumnExists.length === 0) {
        await db`ALTER TABLE entries ADD COLUMN thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL`;
      }
    } catch (error) {
      console.log('Note: thread_id column check skipped:', error);
    }

    // Add ai_rewritten_text column to entries table if it doesn't exist (migration)
    try {
      const aiRewrittenColumnExists = await db`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'entries' AND column_name = 'ai_rewritten_text'
      `;
      if (aiRewrittenColumnExists.length === 0) {
        await db`ALTER TABLE entries ADD COLUMN ai_rewritten_text TEXT`;
      }
    } catch (error) {
      console.log('Note: ai_rewritten_text column check skipped:', error);
    }

    // Remove context column from books table (migration)
    // Note: We can't directly drop columns in PostgreSQL without checking first
    // This is a soft removal - we'll stop using it but won't drop it to avoid data loss
    // The column will remain but won't be used in new code

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
    try {
      await db`CREATE INDEX IF NOT EXISTS idx_entries_thread_id ON entries(thread_id)`;
    } catch (e) {
      console.warn('Could not create thread_id index (may already exist):', e);
    }
    await db`CREATE INDEX IF NOT EXISTS idx_tasks_entry_id ON tasks(entry_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tasks_is_done ON tasks(is_done)`;
    await db`CREATE INDEX IF NOT EXISTS idx_entities_entry_id ON entities(entry_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id)`;
    try {
      await db`CREATE INDEX IF NOT EXISTS idx_threads_book_id ON threads(book_id)`;
    } catch (e) {
      console.warn('Could not create threads book_id index (may already exist):', e);
    }
    await db`CREATE INDEX IF NOT EXISTS idx_entry_embeddings_entry_id ON entry_embeddings(entry_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_entry_relations_source_id ON entry_relations(source_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_entry_relations_target_id ON entry_relations(target_id)`;

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

export async function createBook(id: string, userId: string, name: string, description?: string, folderId?: string): Promise<DbBook> {
  const db = requireDb();
  await db`
    INSERT INTO books (id, user_id, name, description, folder_id)
    VALUES (${id}, ${userId}, ${name}, ${description || null}, ${folderId || null})
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

export async function updateBook(id: string, updates: { name?: string; description?: string; folderId?: string }): Promise<void> {
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

export async function getEntriesByThreadId(threadId: string, userId: string): Promise<DbEntry[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM entries WHERE thread_id = ${threadId} AND user_id = ${userId} ORDER BY created_at ASC`;
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
  status: string = 'COMPLETED',
  threadId?: string | null,
  aiRewrittenText?: string | null
): Promise<DbEntry> {
  const db = requireDb();
  await db`
    INSERT INTO entries (id, user_id, original_text, book_id, type, summary, status, thread_id, ai_rewritten_text)
    VALUES (${id}, ${userId}, ${originalText}, ${bookId}, ${type}, ${summary}, ${status}, ${threadId || null}, ${aiRewrittenText || null})
  `;
  const result = await db`SELECT * FROM entries WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbEntry[];
  return result[0];
}

export async function updateEntry(id: string, updates: { summary?: string; status?: string; type?: string; threadId?: string | null; aiRewrittenText?: string | null }): Promise<void> {
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
  if (updates.threadId !== undefined) {
    await db`UPDATE entries SET thread_id = ${updates.threadId || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
  if (updates.aiRewrittenText !== undefined) {
    await db`UPDATE entries SET ai_rewritten_text = ${updates.aiRewrittenText || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
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

// Batch query for multiple entries (optimized)
export async function getTasksByEntryIds(entryIds: string[]): Promise<DbTask[]> {
  if (entryIds.length === 0) return [];
  const db = requireDb();
  const result = await db`SELECT * FROM tasks WHERE entry_id = ANY(${entryIds}) ORDER BY entry_id, created_at ASC`;
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

// Batch query for multiple entries (optimized)
export async function getEntitiesByEntryIds(entryIds: string[]): Promise<DbEntity[]> {
  if (entryIds.length === 0) return [];
  const db = requireDb();
  const result = await db`SELECT * FROM entities WHERE entry_id = ANY(${entryIds}) ORDER BY entry_id`;
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

// Threads operations (user-scoped)
export async function getAllThreads(userId: string): Promise<DbThread[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM threads WHERE user_id = ${userId} ORDER BY updated_at DESC`;
  return result as DbThread[];
}

export async function getThreadById(id: string, userId: string): Promise<DbThread | null> {
  const db = requireDb();
  const result = await db`SELECT * FROM threads WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbThread[];
  return result[0] || null;
}

export async function getThreadsByBookId(bookId: string, userId: string): Promise<DbThread[]> {
  const db = requireDb();
  const result = await db`SELECT * FROM threads WHERE book_id = ${bookId} AND user_id = ${userId} ORDER BY updated_at DESC`;
  return result as DbThread[];
}

export async function createThread(id: string, userId: string, title: string, bookId: string): Promise<DbThread> {
  const db = requireDb();
  await db`
    INSERT INTO threads (id, user_id, title, book_id)
    VALUES (${id}, ${userId}, ${title}, ${bookId})
  `;
  const result = await db`SELECT * FROM threads WHERE id = ${id} AND user_id = ${userId} LIMIT 1` as DbThread[];
  return result[0];
}

export async function updateThread(id: string, updates: { title?: string }): Promise<void> {
  const db = requireDb();
  if (updates.title !== undefined) {
    await db`UPDATE threads SET title = ${updates.title}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  }
}

export async function deleteThread(id: string, userId: string): Promise<void> {
  const db = requireDb();
  // First, remove thread_id from all entries in this thread
  await db`UPDATE entries SET thread_id = NULL WHERE thread_id = ${id} AND user_id = ${userId}`;
  // Then delete the thread
  await db`DELETE FROM threads WHERE id = ${id} AND user_id = ${userId}`;
}

// Search operations (user-scoped)
export async function searchEntries(query: string, filters?: { userId?: string; bookId?: string; type?: string; dateFrom?: string; dateTo?: string }): Promise<DbEntry[]> {
  const db = requireDb();
  const searchPattern = `%${query}%`;
  const userId = filters?.userId;
  
  if (!userId) {
    throw new Error('User ID is required for search');
  }
  
  // If we have bookId or type filters, use simpler query (no joins needed)
  if (filters?.bookId || filters?.type) {
    // Build query with all conditions explicitly
    if (filters.bookId && filters.type) {
      if (filters.dateFrom && filters.dateTo) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.type = ${filters.type}
            AND e.created_at >= ${filters.dateFrom}
            AND e.created_at <= ${filters.dateTo}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else if (filters.dateFrom) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.type = ${filters.type}
            AND e.created_at >= ${filters.dateFrom}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else if (filters.dateTo) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.type = ${filters.type}
            AND e.created_at <= ${filters.dateTo}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.type = ${filters.type}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      }
    } else if (filters.bookId) {
      if (filters.dateFrom && filters.dateTo) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.created_at >= ${filters.dateFrom}
            AND e.created_at <= ${filters.dateTo}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else if (filters.dateFrom) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.created_at >= ${filters.dateFrom}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else if (filters.dateTo) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
            AND e.created_at <= ${filters.dateTo}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.book_id = ${filters.bookId}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      }
    } else if (filters.type) {
      if (filters.dateFrom && filters.dateTo) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.type = ${filters.type}
            AND e.created_at >= ${filters.dateFrom}
            AND e.created_at <= ${filters.dateTo}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else if (filters.dateFrom) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.type = ${filters.type}
            AND e.created_at >= ${filters.dateFrom}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else if (filters.dateTo) {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.type = ${filters.type}
            AND e.created_at <= ${filters.dateTo}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      } else {
        return await db`
          SELECT DISTINCT e.* FROM entries e
          WHERE (e.original_text ILIKE ${searchPattern} OR e.summary ILIKE ${searchPattern})
            AND e.user_id = ${userId}
            AND e.type = ${filters.type}
          ORDER BY e.created_at DESC
        ` as DbEntry[];
      }
    }
  }
  
  // Full search in entries, tasks, and entities
  if (filters?.dateFrom && filters?.dateTo) {
    return await db`
      SELECT DISTINCT e.* FROM entries e
      LEFT JOIN tasks t ON t.entry_id = e.id
      LEFT JOIN entities ent ON ent.entry_id = e.id
      WHERE e.user_id = ${userId}
        AND (
          e.original_text ILIKE ${searchPattern} 
          OR e.summary ILIKE ${searchPattern}
          OR t.description ILIKE ${searchPattern}
          OR t.assignee ILIKE ${searchPattern}
          OR ent.name ILIKE ${searchPattern}
        )
        AND e.created_at >= ${filters.dateFrom}
        AND e.created_at <= ${filters.dateTo}
      ORDER BY e.created_at DESC
    ` as DbEntry[];
  } else if (filters?.dateFrom) {
    return await db`
      SELECT DISTINCT e.* FROM entries e
      LEFT JOIN tasks t ON t.entry_id = e.id
      LEFT JOIN entities ent ON ent.entry_id = e.id
      WHERE e.user_id = ${userId}
        AND (
          e.original_text ILIKE ${searchPattern} 
          OR e.summary ILIKE ${searchPattern}
          OR t.description ILIKE ${searchPattern}
          OR t.assignee ILIKE ${searchPattern}
          OR ent.name ILIKE ${searchPattern}
        )
        AND e.created_at >= ${filters.dateFrom}
      ORDER BY e.created_at DESC
    ` as DbEntry[];
  } else if (filters?.dateTo) {
    return await db`
      SELECT DISTINCT e.* FROM entries e
      LEFT JOIN tasks t ON t.entry_id = e.id
      LEFT JOIN entities ent ON ent.entry_id = e.id
      WHERE e.user_id = ${userId}
        AND (
          e.original_text ILIKE ${searchPattern} 
          OR e.summary ILIKE ${searchPattern}
          OR t.description ILIKE ${searchPattern}
          OR t.assignee ILIKE ${searchPattern}
          OR ent.name ILIKE ${searchPattern}
        )
        AND e.created_at <= ${filters.dateTo}
      ORDER BY e.created_at DESC
    ` as DbEntry[];
  } else {
    return await db`
      SELECT DISTINCT e.* FROM entries e
      LEFT JOIN tasks t ON t.entry_id = e.id
      LEFT JOIN entities ent ON ent.entry_id = e.id
      WHERE e.user_id = ${userId}
        AND (
          e.original_text ILIKE ${searchPattern} 
          OR e.summary ILIKE ${searchPattern}
          OR t.description ILIKE ${searchPattern}
          OR t.assignee ILIKE ${searchPattern}
          OR ent.name ILIKE ${searchPattern}
        )
      ORDER BY e.created_at DESC
    ` as DbEntry[];
  }
}

// Embeddings operations
export async function createEntryEmbedding(
  id: string,
  entryId: string,
  embedding: number[],
  model: string = 'text-embedding-3-small'
): Promise<DbEmbedding> {
  const db = requireDb();
  const embeddingJson = JSON.stringify(embedding);
  await db`
    INSERT INTO entry_embeddings (id, entry_id, embedding, model)
    VALUES (${id}, ${entryId}, ${embeddingJson}, ${model})
  `;
  const result = await db`SELECT * FROM entry_embeddings WHERE id = ${id} LIMIT 1` as DbEmbedding[];
  return result[0];
}

export async function getEmbeddingByEntryId(entryId: string): Promise<DbEmbedding | null> {
  const db = requireDb();
  const result = await db`SELECT * FROM entry_embeddings WHERE entry_id = ${entryId} LIMIT 1` as DbEmbedding[];
  return result[0] || null;
}

export async function getEmbeddingsByEntryIds(entryIds: string[]): Promise<DbEmbedding[]> {
  if (entryIds.length === 0) return [];
  const db = requireDb();
  const result = await db`SELECT * FROM entry_embeddings WHERE entry_id = ANY(${entryIds})` as DbEmbedding[];
  return result;
}

export async function deleteEmbeddingByEntryId(entryId: string): Promise<void> {
  const db = requireDb();
  await db`DELETE FROM entry_embeddings WHERE entry_id = ${entryId}`;
}

// Entry Relations operations
export async function createEntryRelation(
  id: string,
  sourceId: string,
  targetId: string,
  relationStrength: number
): Promise<DbEntryRelation> {
  const db = requireDb();
  // Use ON CONFLICT to update if relation already exists
  await db`
    INSERT INTO entry_relations (id, source_id, target_id, relation_strength)
    VALUES (${id}, ${sourceId}, ${targetId}, ${relationStrength})
    ON CONFLICT (source_id, target_id) 
    DO UPDATE SET relation_strength = ${relationStrength}, created_at = CURRENT_TIMESTAMP
  `;
  const result = await db`SELECT * FROM entry_relations WHERE id = ${id} LIMIT 1` as DbEntryRelation[];
  return result[0];
}

export async function getRelationsByEntryId(entryId: string): Promise<DbEntryRelation[]> {
  const db = requireDb();
  const result = await db`
    SELECT * FROM entry_relations 
    WHERE source_id = ${entryId} OR target_id = ${entryId}
    ORDER BY relation_strength DESC
  ` as DbEntryRelation[];
  return result;
}

export async function getRelatedEntries(entryId: string, limit: number = 10, minStrength: number = 0.5): Promise<Array<{entry: DbEntry, relation: DbEntryRelation}>> {
  const db = requireDb();
  const relations = await db`
    SELECT * FROM entry_relations 
    WHERE (source_id = ${entryId} OR target_id = ${entryId})
      AND relation_strength >= ${minStrength}
    ORDER BY relation_strength DESC
    LIMIT ${limit}
  ` as DbEntryRelation[];
  
  if (relations.length === 0) return [];
  
  // Get the related entry IDs
  const relatedEntryIds = relations.map(r => 
    r.source_id === entryId ? r.target_id : r.source_id
  );
  
  // Fetch the entries
  const entries = await db`
    SELECT * FROM entries WHERE id = ANY(${relatedEntryIds})
  ` as DbEntry[];
  
  // Map relations to entries
  const entryMap = new Map(entries.map(e => [e.id, e]));
  return relations
    .map(relation => {
      const relatedEntryId = relation.source_id === entryId ? relation.target_id : relation.source_id;
      const entry = entryMap.get(relatedEntryId);
      if (!entry) return null;
      return { entry, relation };
    })
    .filter((item): item is {entry: DbEntry, relation: DbEntryRelation} => item !== null);
}

export async function deleteRelation(id: string): Promise<void> {
  const db = requireDb();
  await db`DELETE FROM entry_relations WHERE id = ${id}`;
}

// Person summaries cache functions
export interface DbPersonSummary {
  id: string;
  user_id: string;
  person_name: string;
  summary: string;
  entries_hash: string;
  last_entry_timestamp: number;
  created_at: string;
  updated_at: string;
}

export async function getPersonSummary(userId: string, personName: string): Promise<DbPersonSummary | null> {
  const db = requireDb();
  const results = await db<DbPersonSummary[]>`
    SELECT * FROM person_summaries 
    WHERE user_id = ${userId} AND person_name = ${personName}
    LIMIT 1
  `;
  return results[0] || null;
}

export async function savePersonSummary(
  userId: string,
  personName: string,
  summary: string,
  entriesHash: string,
  lastEntryTimestamp: number
): Promise<void> {
  const db = requireDb();
  const id = `${userId}_${personName}_${Date.now()}`;
  
  await db`
    INSERT INTO person_summaries (id, user_id, person_name, summary, entries_hash, last_entry_timestamp, updated_at)
    VALUES (${id}, ${userId}, ${personName}, ${summary}, ${entriesHash}, ${lastEntryTimestamp}, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, person_name) 
    DO UPDATE SET 
      summary = ${summary},
      entries_hash = ${entriesHash},
      last_entry_timestamp = ${lastEntryTimestamp},
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function updateRelationStrength(id: string, strength: number): Promise<void> {
  const db = requireDb();
  await db`
    UPDATE entry_relations 
    SET relation_strength = ${strength}
    WHERE id = ${id}
  `;
}

export default sql;

