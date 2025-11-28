import { neon } from '@neondatabase/serverless';

// Get database URL
function getDatabaseUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env?.VITE_NEON_DATABASE_URL) {
    return process.env.VITE_NEON_DATABASE_URL;
  }
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
const sql = databaseUrl ? neon(databaseUrl) : null;

function requireDb() {
  if (!sql) {
    throw new Error('Database not configured');
  }
  return sql;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLogin?: string;
  isAdmin?: boolean;
  gender?: 'male' | 'female' | 'other';
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: number;
}

// Initialize auth tables
export async function initAuthTables() {
  if (!sql) {
    console.warn('Database not configured. Skipping auth initialization.');
    return false;
  }

  try {
    const db = requireDb();

    // Create users table
    await db`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE
      )
    `;

    // Add is_admin column if it doesn't exist (migration)
    try {
      const columnExists = await db`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_admin'
      `;
      if (columnExists.length === 0) {
        await db`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`;
      }
    } catch (error) {
      console.log('Note: is_admin column check skipped:', error);
    }

    // Add gender column if it doesn't exist (migration)
    try {
      const genderColumnExists = await db`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'gender'
      `;
      if (genderColumnExists.length === 0) {
        await db`ALTER TABLE users ADD COLUMN gender TEXT`;
      }
    } catch (error) {
      console.log('Note: gender column check skipped:', error);
    }

    // Create sessions table
    await db`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes
    await db`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    await db`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`;
    await db`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`;

    return true;
  } catch (error) {
    console.error('Auth tables initialization error:', error);
    return false;
  }
}

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate secure token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// User registration
export async function registerUser(email: string, password: string, name: string): Promise<{ user: User; token: string }> {
  const db = requireDb();

  // Validate and sanitize inputs
  const sanitizedEmail = email.toLowerCase().trim();
  const sanitizedName = name.trim().slice(0, 100); // Limit name length
  const sanitizedPassword = password.trim();

  // Validate email
  if (!sanitizedEmail || !sanitizedEmail.includes('@') || sanitizedEmail.length > 255) {
    throw new Error('Email inválido');
  }

  // Validate password
  if (!sanitizedPassword || sanitizedPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }
  if (sanitizedPassword.length > 128) {
    throw new Error('La contraseña es demasiado larga');
  }

  // Validate name
  if (!sanitizedName || sanitizedName.length < 2) {
    throw new Error('El nombre debe tener al menos 2 caracteres');
  }

  // Check if user exists
  const existing = await db`SELECT id FROM users WHERE email = ${sanitizedEmail} LIMIT 1`;
  if (existing.length > 0) {
    throw new Error('El email ya está registrado');
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Create user
  await db`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${userId}, ${sanitizedEmail}, ${sanitizedName}, ${passwordHash})
  `;

  // Create session
  const sessionId = crypto.randomUUID();
  await db`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (${sessionId}, ${userId}, ${token}, ${expiresAt.toISOString()})
  `;

  // Update last login
  await db`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${userId}`;

  const userResult = await db`SELECT id, email, name, created_at, last_login FROM users WHERE id = ${userId} LIMIT 1`;
  const userData = userResult[0] as any;
  
  const user: User = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    createdAt: userData.created_at ? (userData.created_at instanceof Date ? userData.created_at.toISOString() : String(userData.created_at)) : '',
    lastLogin: userData.last_login ? (userData.last_login instanceof Date ? userData.last_login.toISOString() : String(userData.last_login)) : undefined,
  };

  return { user, token };
}

// User login
export async function loginUser(email: string, password: string): Promise<{ user: User; token: string }> {
  const db = requireDb();

  // Sanitize inputs
  const sanitizedEmail = email.toLowerCase().trim();
  const sanitizedPassword = password.trim();

  // Validate inputs
  if (!sanitizedEmail || !sanitizedEmail.includes('@')) {
    throw new Error('Email inválido');
  }
  if (!sanitizedPassword) {
    throw new Error('Contraseña requerida');
  }

  // Find user
  const userResult = await db`
    SELECT id, email, name, password_hash, created_at, last_login, is_active, is_admin, gender
    FROM users WHERE email = ${sanitizedEmail} LIMIT 1
  `;

  if (userResult.length === 0) {
    throw new Error('Email o contraseña incorrectos');
  }

  const userData = userResult[0] as any;

  if (!userData.is_active) {
    throw new Error('Cuenta desactivada');
  }

  // Verify password
  const isValid = await verifyPassword(password, userData.password_hash);
  if (!isValid) {
    throw new Error('Email o contraseña incorrectos');
  }

  // Generate new session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const sessionId = crypto.randomUUID();

  await db`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (${sessionId}, ${userData.id}, ${token}, ${expiresAt.toISOString()})
  `;

  // Update last login
  await db`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${userData.id}`;

  // Clean old sessions (keep only last 5 per user)
  await db`
    DELETE FROM sessions
    WHERE user_id = ${userData.id}
    AND id NOT IN (
      SELECT id FROM sessions
      WHERE user_id = ${userData.id}
      ORDER BY created_at DESC
      LIMIT 5
    )
  `;

  const user: User = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    createdAt: userData.created_at ? (userData.created_at instanceof Date ? userData.created_at.toISOString() : String(userData.created_at)) : '',
    lastLogin: userData.last_login ? (userData.last_login instanceof Date ? userData.last_login.toISOString() : String(userData.last_login)) : undefined,
    isAdmin: userData.is_admin || false,
    gender: userData.gender || undefined,
  };

  return { user, token };
}

// Verify session token
export async function verifySession(token: string): Promise<User | null> {
  const db = requireDb();

  const sessionResult = await db`
    SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.created_at, u.last_login, u.is_active, u.is_admin, u.gender
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE
    LIMIT 1
  `;

  if (sessionResult.length === 0) {
    return null;
  }

  const data = sessionResult[0] as any;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    createdAt: data.created_at ? (data.created_at instanceof Date ? data.created_at.toISOString() : String(data.created_at)) : '',
    lastLogin: data.last_login ? (data.last_login instanceof Date ? data.last_login.toISOString() : String(data.last_login)) : undefined,
    isAdmin: data.is_admin || false,
    gender: data.gender || undefined,
  };
}

// Logout (delete session)
export async function logoutUser(token: string): Promise<void> {
  const db = requireDb();
  await db`DELETE FROM sessions WHERE token = ${token}`;
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const db = requireDb();
  const result = await db`
    SELECT id, email, name, created_at, last_login, is_admin, gender
    FROM users WHERE id = ${userId} AND is_active = TRUE LIMIT 1
  `;
  if (result.length === 0) return null;
  const data = result[0] as any;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    createdAt: data.created_at ? (data.created_at instanceof Date ? data.created_at.toISOString() : String(data.created_at)) : '',
    lastLogin: data.last_login ? (data.last_login instanceof Date ? data.last_login.toISOString() : String(data.last_login)) : undefined,
    isAdmin: data.is_admin || false,
    gender: data.gender || undefined,
  };
}

// Update user profile
export async function updateUser(userId: string, updates: { name?: string; email?: string; gender?: 'male' | 'female' | 'other' }): Promise<void> {
  const db = requireDb();
  
  if (updates.name) {
    await db`UPDATE users SET name = ${updates.name.trim()} WHERE id = ${userId}`;
  }
  
  if (updates.email) {
    // Check if email is already taken
    const existing = await db`SELECT id FROM users WHERE email = ${updates.email.toLowerCase()} AND id != ${userId} LIMIT 1`;
    if (existing.length > 0) {
      throw new Error('El email ya está en uso');
    }
    await db`UPDATE users SET email = ${updates.email.toLowerCase()} WHERE id = ${userId}`;
  }

  if (updates.gender !== undefined) {
    await db`UPDATE users SET gender = ${updates.gender} WHERE id = ${userId}`;
  }
}

// Change password
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
  const db = requireDb();

  if (!newPassword || newPassword.length < 8) {
    throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
  }

  // Get current password hash
  const userResult = await db`SELECT password_hash FROM users WHERE id = ${userId} LIMIT 1`;
  if (userResult.length === 0) {
    throw new Error('Usuario no encontrado');
  }

  const currentHash = (userResult[0] as any).password_hash;

  // Verify old password
  const isValid = await verifyPassword(oldPassword, currentHash);
  if (!isValid) {
    throw new Error('Contraseña actual incorrecta');
  }

  // Update password
  const newHash = await hashPassword(newPassword);
  await db`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;

  // Invalidate all sessions (force re-login)
  await db`DELETE FROM sessions WHERE user_id = ${userId}`;
}

// Create user (admin only)
export async function createUserAsAdmin(adminUserId: string, email: string, password: string, name: string, isAdmin: boolean = false): Promise<User> {
  const db = requireDb();

  // Verify admin
  const adminResult = await db`
    SELECT is_admin FROM users WHERE id = ${adminUserId} AND is_active = TRUE LIMIT 1
  `;
  if (adminResult.length === 0 || !adminResult[0].is_admin) {
    throw new Error('No tienes permisos de administrador');
  }

  // Use same validation as registerUser
  const sanitizedEmail = email.toLowerCase().trim();
  const sanitizedName = name.trim().slice(0, 100);
  const sanitizedPassword = password.trim();

  if (!sanitizedEmail || !sanitizedEmail.includes('@') || sanitizedEmail.length > 255) {
    throw new Error('Email inválido');
  }

  if (!sanitizedPassword || sanitizedPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  if (!sanitizedName || sanitizedName.length < 2) {
    throw new Error('El nombre debe tener al menos 2 caracteres');
  }

  // Check if user exists
  const existing = await db`SELECT id FROM users WHERE email = ${sanitizedEmail} LIMIT 1`;
  if (existing.length > 0) {
    throw new Error('El email ya está registrado');
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  // Create user
  await db`
    INSERT INTO users (id, email, name, password_hash, is_admin)
    VALUES (${userId}, ${sanitizedEmail}, ${sanitizedName}, ${passwordHash}, ${isAdmin})
  `;

  const userResult = await db`SELECT id, email, name, created_at, last_login, is_admin FROM users WHERE id = ${userId} LIMIT 1`;
  const userData = userResult[0] as any;
  
  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    createdAt: userData.created_at ? (userData.created_at instanceof Date ? userData.created_at.toISOString() : String(userData.created_at)) : '',
    lastLogin: userData.last_login ? (userData.last_login instanceof Date ? userData.last_login.toISOString() : String(userData.last_login)) : undefined,
    isAdmin: userData.is_admin || false,
  };
}

// Get all users (admin only)
export async function getAllUsers(adminUserId: string): Promise<User[]> {
  const db = requireDb();

  // Verify admin
  const adminResult = await db`
    SELECT is_admin FROM users WHERE id = ${adminUserId} AND is_active = TRUE LIMIT 1
  `;
  if (adminResult.length === 0 || !adminResult[0].is_admin) {
    throw new Error('No tienes permisos de administrador');
  }

  const result = await db`
    SELECT id, email, name, created_at, last_login, is_admin, is_active
    FROM users
    ORDER BY created_at DESC
  `;

  return result.map((data: any) => ({
    id: data.id,
    email: data.email,
    name: data.name,
    createdAt: data.created_at ? (data.created_at instanceof Date ? data.created_at.toISOString() : String(data.created_at)) : '',
    lastLogin: data.last_login ? (data.last_login instanceof Date ? data.last_login.toISOString() : String(data.last_login)) : undefined,
    isAdmin: data.is_admin || false,
  }));
}

