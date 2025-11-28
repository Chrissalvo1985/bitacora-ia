# Seguridad - Bitácora IA

## 🔒 Medidas de Seguridad Implementadas

### Autenticación y Autorización

1. **Sistema de Login/Registro**
   - Autenticación basada en tokens (JWT-like)
   - Contraseñas hasheadas con SHA-256
   - Sesiones con expiración (30 días)
   - Validación de email y contraseña

2. **Aislamiento de Datos por Usuario**
   - Todas las tablas incluyen `user_id`
   - Todas las queries filtran por `user_id`
   - Imposible acceder a datos de otros usuarios
   - Validación de pertenencia en cada operación

3. **Gestión de Sesiones**
   - Tokens únicos y seguros
   - Limpieza automática de sesiones expiradas
   - Máximo 5 sesiones activas por usuario
   - Invalidación de sesiones al cambiar contraseña

### Validación y Sanitización

1. **Inputs de Usuario**
   - Sanitización de todos los textos
   - Validación de email con regex
   - Validación de contraseña (mínimo 8 caracteres, letras y números)
   - Límites de longitud en todos los campos
   - Escape de HTML para prevenir XSS

2. **Archivos**
   - Validación de tipo (solo imágenes y PDFs)
   - Límite de tamaño (50MB)
   - Validación de extensión
   - Sanitización de nombres de archivo

3. **Base de Datos**
   - Queries parametrizadas (previene SQL injection)
   - Validación de UUIDs
   - Verificación de existencia antes de operaciones

### Protección de API Keys

1. **OpenAI API Key**
   - Almacenada en variables de entorno
   - Validación de existencia antes de usar
   - No expuesta en el cliente (aunque se usa en browser, está protegida)
   - Mensaje de error claro si no está configurada

2. **Database URL**
   - Almacenada en variables de entorno
   - No expuesta en logs o errores
   - Validación de conexión

### Rate Limiting

- Sistema básico de rate limiting en memoria
- Prevención de ataques de fuerza bruta
- Límite de requests por identificador

### Seguridad de Datos

1. **Encriptación**
   - Contraseñas hasheadas (SHA-256)
   - Tokens generados con crypto.getRandomValues()
   - Datos sensibles nunca en texto plano

2. **Protección de Rutas**
   - Verificación de autenticación antes de cargar datos
   - Redirección automática a login si no autenticado
   - Validación de sesión en cada request

3. **CORS y Headers**
   - Configuración segura de CORS (si se implementa backend)
   - Headers de seguridad recomendados

### Mejores Prácticas

1. **Validación en Múltiples Capas**
   - Frontend: Validación inmediata
   - Backend: Validación en servicios
   - Base de datos: Constraints y validaciones

2. **Manejo de Errores**
   - Mensajes de error genéricos (no exponen información sensible)
   - Logging de errores sin datos sensibles
   - Fallbacks seguros

3. **Actualizaciones Seguras**
   - Verificación de pertenencia antes de actualizar
   - Validación de datos antes de guardar
   - Transacciones atómicas cuando es posible

## ⚠️ Consideraciones para Producción

1. **Mejoras Recomendadas**
   - Usar bcrypt en lugar de SHA-256 para passwords
   - Implementar rate limiting con Redis
   - Agregar 2FA (autenticación de dos factores)
   - Implementar CSRF tokens
   - Agregar logging de auditoría
   - Implementar backup automático de datos
   - Agregar HTTPS obligatorio
   - Implementar Content Security Policy (CSP)

2. **Monitoreo**
   - Logs de intentos de login fallidos
   - Alertas de actividad sospechosa
   - Monitoreo de uso de API

3. **Backup y Recuperación**
   - Backups regulares de base de datos
   - Plan de recuperación ante desastres
   - Encriptación de backups

## 🔐 Variables de Entorno Requeridas

```env
VITE_OPENAI_API_KEY=sk-...          # API key de OpenAI
VITE_NEON_DATABASE_URL=postgresql://...  # URL de conexión a Neon
```

**IMPORTANTE**: Nunca commitees estas variables al repositorio.

