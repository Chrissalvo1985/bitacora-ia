# Bitácora IA

Una plataforma personal de gestión de trabajo para líderes, donde solo necesitas "descargar" ideas, notas, decisiones, pendientes y reflexiones, y la IA se encarga de clasificar, ordenar, conectar puntos y generar resúmenes accionables.

## 🚀 Características

- **Captura Multi-modal**: Escribe, dicta por voz o adjunta imágenes/documentos
- **Clasificación Automática**: La IA detecta el tema, tipo de nota y extrae pendientes
- **Gestión Inteligente**: Organiza automáticamente en "libros" (categorías/temas)
- **Búsqueda Avanzada**: Encuentra cualquier cosa con filtros por libro, tipo, fecha, responsable
- **Resúmenes Ejecutivos**: Genera resúmenes diarios, semanales o mensuales con IA
- **Consultas en Lenguaje Natural**: Pregunta a tu bitácora en español natural
- **Gestión de Pendientes**: Vista centralizada de todas tus misiones con responsables y fechas
- **UI Fluida y Moderna**: Animaciones suaves, diseño responsivo y microinteracciones

## 📋 Requisitos Previos

- Node.js 18+ 
- Cuenta de OpenAI (para GPT-4o-mini)
- Cuenta de Neon (PostgreSQL serverless)

## 🛠️ Instalación

1. **Clona el repositorio** (o descarga el proyecto)

2. **Instala las dependencias**:
```bash
npm install
```

3. **Configura las variables de entorno**:
   - Copia `.env.example` a `.env.local`
   - Obtén tu API key de OpenAI: https://platform.openai.com/api-keys
   - Crea una base de datos en Neon: https://console.neon.tech
   - Actualiza `.env.local` con tus credenciales:
```env
VITE_OPENAI_API_KEY=sk-...
VITE_NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

4. **Inicializa la base de datos**:
```bash
npm run db:init
```

5. **Si ya tienes datos, migra las tablas**:
```bash
npm run db:migrate
```

6. **Ejecuta la aplicación**:
```bash
npm run dev
```

La app estará disponible en `http://localhost:3000`

**Primera vez**: Crea una cuenta con tu email y contraseña. Tus datos estarán completamente aislados de otros usuarios.

## 🏗️ Estructura del Proyecto

```
bitácora-ia/
├── components/          # Componentes React
│   ├── Dashboard.tsx   # Vista principal
│   ├── BookView.tsx    # Vista de libreta
│   ├── TaskView.tsx    # Vista de pendientes
│   ├── SearchView.tsx  # Búsqueda avanzada
│   ├── SummaryView.tsx # Resúmenes ejecutivos
│   ├── AIQueryView.tsx # Consultas IA
│   └── ...
├── context/            # Context API
│   └── BitacoraContext.tsx
├── services/           # Servicios
│   ├── db.ts          # Operaciones de base de datos
│   ├── dataService.ts # Capa de abstracción de datos
│   └── openaiService.ts # Integración con OpenAI
├── types.ts           # Tipos TypeScript
└── ...
```

## 🎯 Uso

### Primer Acceso

1. Al abrir la app, verás la pantalla de login
2. Crea una cuenta con tu email y contraseña (mínimo 8 caracteres)
3. Una vez autenticado, tendrás acceso a tu bitácora personal

### Agregar una Nota

1. Escribe, dicta o adjunta contenido en el campo de captura
2. La IA automáticamente:
   - Detecta el libro/categoría apropiado
   - Clasifica el tipo (nota, pendiente, decisión, idea, riesgo)
   - Extrae tareas con responsables y fechas
   - Identifica personas y entidades mencionadas
3. **Si cargas un PDF o imagen**: La IA analiza el documento y muestra un modal con:
   - Tareas detectadas que puedes programar
   - Riesgos identificados
   - Conexiones con entradas existentes
   - Duplicados o temas relacionados
   - Incumplimientos de plazos

### Actualización Inteligente

- Si escribes algo como "está listo el modelo BI de Andina", la IA busca tareas relacionadas y te pregunta si quieres marcarlas como completadas
- No siempre crea nuevas entradas: actualiza las existentes cuando corresponde

### Gestionar Libros

- **Crear**: Click en el botón "+" en el sidebar
- **Ver**: Click en cualquier libreta del sidebar
- Las libretas se crean automáticamente cuando la IA detecta un tema nuevo

### Buscar

- Usa la vista "Búsqueda" para encontrar entradas
- Filtra por libro, tipo, fecha o responsable
- Búsqueda por palabras clave en texto y resúmenes

### Resúmenes

- Ve a "Resumen" en el sidebar
- Haz click en "Generar Resumen" (no se genera automáticamente)
- Selecciona el período (día, semana, mes)
- La IA genera un resumen ejecutivo con decisiones clave y pendientes críticos

### Consultas IA

- Ve a "Preguntar IA"
- Haz preguntas en lenguaje natural como:
  - "¿Qué cosas pendientes tengo con Romina?"
  - "¿Qué decisiones tomamos sobre el proyecto X?"
  - "Resúmeme lo más importante de este mes"

## 🔧 Tecnologías

- **React 19** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Estilos
- **Framer Motion** - Animaciones
- **OpenAI GPT-4o-mini** - Procesamiento de lenguaje natural
- **Neon PostgreSQL** - Base de datos serverless
- **Lucide React** - Iconos
- **SHA-256** - Hash de contraseñas (en producción usar bcrypt)

## 🔒 Seguridad

- **Autenticación**: Sistema completo de login/registro
- **Aislamiento de datos**: Cada usuario solo ve sus propios datos
- **Validación**: Sanitización y validación de todos los inputs
- **Protección**: Rate limiting, validación de archivos, escape de HTML
- Ver [SECURITY.md](SECURITY.md) para detalles completos

## 📝 Notas

- La app usa Neon serverless que permite ejecutar queries SQL directamente desde el cliente
- Todas las operaciones de IA usan GPT-4o-mini para optimizar costos
- Los datos se sincronizan automáticamente con la base de datos
- La app es 100% responsiva y funciona en móvil, tablet y desktop

## 🚧 Próximas Mejoras

- [ ] Integración con calendario
- [ ] Exportación de datos
- [ ] Modo offline con sincronización
- [ ] Plantillas de reunión
- [ ] Análisis de patrones y sugerencias proactivas

## 📄 Licencia

MIT
