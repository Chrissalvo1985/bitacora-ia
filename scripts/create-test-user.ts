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

const { registerUser } = await import('../services/authService');

async function main() {
  console.log('👤 Creando usuario de prueba...');
  
  try {
    const { user, token } = await registerUser(
      'admin@bitacora.local',
      'admin123',
      'Usuario Admin'
    );
    
    console.log('✅ Usuario creado exitosamente!');
    console.log('');
    console.log('📧 Email: admin@bitacora.local');
    console.log('🔑 Contraseña: admin123');
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia esta contraseña después del primer login');
    
  } catch (error: any) {
    if (error.message.includes('ya está registrado')) {
      console.log('ℹ️  El usuario de prueba ya existe');
      console.log('📧 Email: admin@bitacora.local');
      console.log('🔑 Contraseña: admin123');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

main();
