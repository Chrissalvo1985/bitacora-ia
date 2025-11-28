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

// Now import db and auth services
const { initDatabase } = await import('../services/db');
const { initAuthTables } = await import('../services/authService');

async function main() {
  console.log('🚀 Inicializando base de datos...');
  
  try {
    const dbResult = await initDatabase();
    const authResult = await initAuthTables();
    
    if (dbResult && authResult) {
      console.log('✅ Base de datos inicializada correctamente');
      console.log('📚 Tablas creadas:');
      console.log('   - users (autenticación)');
      console.log('   - sessions (sesiones)');
      console.log('   - books (libretas)');
      console.log('   - entries (entradas)');
      console.log('   - tasks (tareas)');
      console.log('   - entities (entidades)');
      console.log('🔒 Sistema de autenticación configurado');
    } else {
      console.warn('⚠️  Base de datos no configurada. Verifica VITE_NEON_DATABASE_URL en .env.local');
      console.log('💡 La app requiere base de datos para funcionar');
    }
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    process.exit(1);
  }
}

main();

