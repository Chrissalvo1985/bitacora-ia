import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
const envPath = join(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  console.warn('⚠️  No se pudo cargar .env.local');
}

// Import db
const { neon } = await import('@neondatabase/serverless');

function getDatabaseUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env?.VITE_NEON_DATABASE_URL) {
    return process.env.VITE_NEON_DATABASE_URL;
  }
  return undefined;
}

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error('❌ VITE_NEON_DATABASE_URL no configurada');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrate() {
  console.log('🔄 Migrando base de datos para agregar user_id...');
  
  try {
    // Check if user_id column exists in books
    const booksCheck = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'books' AND column_name = 'user_id'
    `;
    
    if (booksCheck.length === 0) {
      console.log('📝 Agregando user_id a tabla books...');
      await sql`ALTER TABLE books ADD COLUMN user_id TEXT`;
      // Set a default user_id for existing records (temporary, users should migrate their data)
      await sql`UPDATE books SET user_id = 'legacy' WHERE user_id IS NULL`;
      await sql`ALTER TABLE books ALTER COLUMN user_id SET NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id)`;
    } else {
      console.log('✅ Columna user_id ya existe en books');
    }

    // Check if user_id column exists in entries
    const entriesCheck = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'entries' AND column_name = 'user_id'
    `;
    
    if (entriesCheck.length === 0) {
      console.log('📝 Agregando user_id a tabla entries...');
      await sql`ALTER TABLE entries ADD COLUMN user_id TEXT`;
      // Set a default user_id for existing records
      await sql`UPDATE entries SET user_id = 'legacy' WHERE user_id IS NULL`;
      await sql`ALTER TABLE entries ALTER COLUMN user_id SET NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id)`;
    } else {
      console.log('✅ Columna user_id ya existe en entries');
    }

    console.log('✅ Migración completada');
    console.log('⚠️  Nota: Los registros existentes tienen user_id = "legacy"');
    console.log('💡 Los usuarios nuevos tendrán su propio user_id');
    
  } catch (error: any) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  }
}

migrate();

