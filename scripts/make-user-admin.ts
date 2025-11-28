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

const { neon } = await import('@neondatabase/serverless');

// Get database URL
function getDatabaseUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env?.VITE_NEON_DATABASE_URL) {
    return process.env.VITE_NEON_DATABASE_URL;
  }
  return undefined;
}

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error('❌ VITE_NEON_DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  // Get email from command line argument or use default
  const email = process.argv[2] || process.env.USER_EMAIL;
  
  if (!email) {
    console.error('❌ Debes proporcionar un email como argumento:');
    console.error('   npm run make-admin <email>');
    console.error('   o definir USER_EMAIL en .env.local');
    process.exit(1);
  }
  
  console.log(`🔧 Actualizando usuario ${email} a administrador...`);
  
  try {
    // First, check if user exists
    const userCheck = await sql`
      SELECT id, email, name, is_admin 
      FROM users 
      WHERE email = ${email.toLowerCase()} 
      LIMIT 1
    `;
    
    if (userCheck.length === 0) {
      console.error(`❌ Usuario con email ${email} no encontrado`);
      process.exit(1);
    }
    
    const user = userCheck[0] as any;
    
    if (user.is_admin) {
      console.log(`ℹ️  El usuario ${email} ya es administrador`);
      console.log(`   Nombre: ${user.name}`);
      console.log(`   ID: ${user.id}`);
      return;
    }
    
    // Update user to admin
    await sql`
      UPDATE users 
      SET is_admin = TRUE 
      WHERE email = ${email.toLowerCase()}
    `;
    
    console.log('✅ Usuario actualizado exitosamente!');
    console.log('');
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Nombre: ${user.name}`);
    console.log(`🆔 ID: ${user.id}`);
    console.log(`🔐 Estado: Administrador`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

