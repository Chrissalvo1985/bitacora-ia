import React, { useMemo, useCallback, memo, useState } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { useAuth } from '../context/AuthContext';
import EntryCard from './EntryCard';
import { ICONS } from '../constants';
import CaptureInput from './CaptureInput';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  onSelectBook?: (bookId: string) => void;
  onNavigateToEntry?: (bookId: string, entryId: string) => void;
}

const Dashboard = memo<DashboardProps>(({ onSelectBook, onNavigateToEntry }) => {
  const { entries, books } = useBitacora();
  const { user } = useAuth();

  // Estado para controlar expansión de secciones
  const [expandedSections, setExpandedSections] = useState<{
    overdue: boolean;
    highPriority: boolean;
    upcoming: boolean;
  }>({
    overdue: false,
    highPriority: false,
    upcoming: false,
  });

  // Función para toggle expansión
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Memoized stats
  const stats = useMemo(() => {
    const openTasks = entries.reduce((acc, entry) => acc + entry.tasks.filter(t => !t.isDone).length, 0);
    const completedTasks = entries.reduce((acc, entry) => acc + entry.tasks.filter(t => t.isDone).length, 0);
    const totalEntries = entries.length;
    return { openTasks, completedTasks, totalEntries };
  }, [entries]);

  const { openTasks, completedTasks, totalEntries } = stats;
  
  // Most used books (favorites) - sorted by entry count and last activity
  const favoriteBooks = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    return books
      .map(book => {
        const bookEntries = entries.filter(e => e.bookId === book.id);
        const entryCount = bookEntries.length;
        const lastActivity = bookEntries.length > 0 
          ? Math.max(...bookEntries.map(e => e.createdAt))
          : 0;
        const pendingTasks = bookEntries.reduce((acc, e) => acc + e.tasks.filter(t => !t.isDone).length, 0);
        
        return {
          ...book,
          entryCount,
          lastActivity,
          pendingTasks,
          score: entryCount * 2 + (lastActivity > thirtyDaysAgo ? 10 : 0)
        };
      })
      .filter(book => book.entryCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [books, entries]);
  
  // High priority tasks - memoized
  const highPriorityTasks = useMemo(() => {
    return entries.flatMap(e => e.tasks
      .filter(t => !t.isDone && t.priority === 'HIGH')
      .map(t => ({ ...t, entryId: e.id, bookId: e.bookId, bookName: books.find(b => b.id === e.bookId)?.name || 'Desconocido' }))
    );
  }, [entries, books]);

  // Tasks with due dates approaching (next 7 days) - memoized
  const upcomingDeadlines = useMemo(() => {
    const now = Date.now();
    const today = new Date();
    
    return entries
      .flatMap(e => e.tasks
        .filter(t => {
          if (t.isDone || !t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff >= 0 && daysDiff <= 7;
        })
        .map(t => ({ 
          ...t, 
          entryId: e.id, 
          bookId: e.bookId,
          bookName: books.find(b => b.id === e.bookId)?.name || 'Desconocido', 
          daysUntil: Math.ceil((new Date(t.dueDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          entrySummary: e.summary
        }))
      )
      .sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0));
  }, [entries, books]);

  // Overdue tasks - memoized
  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return entries
      .flatMap(e => e.tasks
        .filter(t => {
          if (t.isDone || !t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff < 0; // Past due date
        })
        .map(t => ({ 
          ...t, 
          entryId: e.id, 
          bookId: e.bookId,
          bookName: books.find(b => b.id === e.bookId)?.name || 'Desconocido', 
          daysOverdue: Math.abs(Math.ceil((new Date(t.dueDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
          entrySummary: e.summary
        }))
      )
      .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0)); // Most overdue first
  }, [entries, books]);

  // Dynamic greeting with personality based on gender
  const hour = new Date().getHours();
  const isFemale = user?.gender === 'female';
  
  const greetings = {
    morning: isFemale ? [
      "¡Buenos días, reina! ☀️",
      "¡Arriba, campeona! 🌅",
      "¡Día nuevo, oportunidades nuevas! ✨",
      "¡Buenos días, jefa! 💪",
      "¡Hora de conquistar el día! 🚀"
    ] : [
      "¡Buenos días, crack! ☀️",
      "¡Arriba, campeón! 🌅",
      "¡Día nuevo, oportunidades nuevas! ✨",
      "¡Buenos días, jefe! 💪",
      "¡Hora de conquistar el día! 🚀"
    ],
    afternoon: isFemale ? [
      "¡Buenas tardes! 🚀",
      "¡Sigue así, máquina! ⚡",
      "¡Medio día, medio éxito! 🎯",
      "¡Buenas tardes, reina! 🌤️",
      "¡A full, como siempre! 🔥"
    ] : [
      "¡Buenas tardes! 🚀",
      "¡Sigue así, máquina! ⚡",
      "¡Medio día, medio éxito! 🎯",
      "¡Buenas tardes, crack! 🌤️",
      "¡A full, como siempre! 🔥"
    ],
    night: isFemale ? [
      "¡Buenas noches! 🌙",
      "¡Casi lista, reina! ⭐",
      "¡Última recta del día! 💫",
      "¡Buenas noches, jefa! 🌃",
      "¡A cerrar con broche de oro! 🏆"
    ] : [
      "¡Buenas noches! 🌙",
      "¡Casi listo, crack! ⭐",
      "¡Última recta del día! 💫",
      "¡Buenas noches, jefe! 🌃",
      "¡A cerrar con broche de oro! 🏆"
    ]
  };
  
  let greeting = "¡Buenos días!";
  if (hour < 12) {
    greeting = greetings.morning[Math.floor(Math.random() * greetings.morning.length)];
  } else if (hour < 20) {
    greeting = greetings.afternoon[Math.floor(Math.random() * greetings.afternoon.length)];
  } else {
    greeting = greetings.night[Math.floor(Math.random() * greetings.night.length)];
  }

  return (
    <div className="w-full flex flex-col overflow-hidden">
      {/* Header - Ultra compact */}
      <div className="flex-shrink-0 pt-3 md:pt-4 pb-3 md:pb-4">
        <div className="mb-3 md:mb-4">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-indigo-800 to-gray-900 tracking-tight mb-1 leading-tight">
            {greeting}
          </h1>
          <p className="text-xs md:text-base text-gray-500">
            <span className="font-semibold text-indigo-600">{openTasks} misiones</span> • <span className="font-semibold text-gray-700">{books.length} libretas</span>
          </p>
        </div>
        <div className="w-full">
          <CaptureInput />
        </div>
      </div>

      {/* Main Content - Ultra compact */}
      <div className="flex-1 flex flex-col gap-4 md:gap-5 overflow-hidden">

        {/* Top Section - Stats & Quick Access */}
        <div className="flex-shrink-0 space-y-4 md:space-y-5">

          {/* Stats Cards - Compact */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg md:rounded-xl p-3 md:p-4 border border-indigo-100 shadow-sm">
            <h3 className="text-xs md:text-base lg:text-lg font-bold text-gray-700 mb-3 md:mb-4 flex items-center gap-2">
              <ICONS.BarChart3 size={16} className="md:w-5 md:h-5" />
              Resumen
            </h3>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-white rounded-md md:rounded-lg p-2 md:p-3 text-center shadow-sm hover:shadow transition-shadow">
                <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-800 mb-0.5">{totalEntries}</p>
                <p className="text-xs md:text-sm text-gray-500 font-medium">Entradas</p>
              </div>
              <div className="bg-white rounded-md md:rounded-lg p-2 md:p-3 text-center shadow-sm hover:shadow transition-shadow">
                <p className="text-lg md:text-2xl lg:text-3xl font-bold text-indigo-600 mb-0.5">{openTasks}</p>
                <p className="text-xs md:text-sm text-gray-500 font-medium">Pendientes</p>
              </div>
              <div className="bg-white rounded-md md:rounded-lg p-2 md:p-3 text-center shadow-sm hover:shadow transition-shadow">
                <p className="text-lg md:text-2xl lg:text-3xl font-bold text-emerald-600 mb-0.5">{completedTasks}</p>
                <p className="text-xs md:text-sm text-gray-500 font-medium">Completadas</p>
              </div>
            </div>
          </div>

          {/* Quick Access - Compact, max 3 items */}
          {favoriteBooks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs md:text-base lg:text-lg font-bold text-gray-700 flex items-center gap-2">
                <ICONS.Book size={16} className="md:w-5 md:h-5" />
                Accesos Directos
              </h3>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {favoriteBooks.slice(0, 3).map((book, idx) => (
                  <button
                    key={book.id}
                    onClick={() => onSelectBook?.(book.id)}
                    className="bg-white rounded-md md:rounded-lg shadow-sm border border-gray-200 hover:shadow hover:border-indigo-300 transition-all p-2 md:p-3 text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
                        <div className="bg-indigo-50 p-1 rounded flex-shrink-0">
                          <ICONS.Book size={12} className="md:w-4 md:h-4 text-indigo-600" />
                        </div>
                        <span className="font-bold text-xs md:text-sm text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {book.name}
                        </span>
                      </div>
                      {book.pendingTasks > 0 && (
                        <span className="bg-rose-50 text-rose-600 text-xs md:text-sm font-bold px-1.5 md:px-2 py-0.5 rounded-full flex-shrink-0">
                          {book.pendingTasks}
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 ml-5">{book.entryCount} entr</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tasks Section - Ultra compact, fixed height */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Overdue Tasks - Expandable */}
            {overdueTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs md:text-base lg:text-lg font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-red-600 rounded-full"></span>
                  Atrasadas ({overdueTasks.length})
                </h3>
                <div className="bg-white rounded-lg shadow-sm border border-red-200 space-y-1 p-2">
                  <AnimatePresence>
                    {(expandedSections.overdue ? overdueTasks : overdueTasks.slice(0, 2)).map((task, idx) => (
                      <div
                        key={`${task.entryId}-${task.description}`}
                        className="flex items-start gap-2 p-2 rounded hover:bg-red-50/30 transition-colors overflow-hidden"
                      >
                        <div className="w-3 h-3 border-2 border-red-600 rounded mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-semibold text-gray-800 line-clamp-1 mb-1">{task.description}</p>
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 md:px-2 py-0.5 rounded text-xs md:text-sm font-bold bg-red-100 text-red-700">
                              {task.daysOverdue === 1 ? '1d' : `${task.daysOverdue}d`}
                            </span>
                            <span className="text-xs md:text-sm text-gray-600 bg-gray-100 px-1.5 md:px-2 py-0.5 rounded font-medium">{task.bookName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                  {overdueTasks.length > 2 && (
                    <button
                      onClick={() => toggleSection('overdue')}
                      className="w-full text-center py-1 hover:bg-red-50/50 rounded transition-colors active:scale-95"
                    >
                      <span className="text-xs md:text-sm text-red-600 font-medium hover:text-red-700 flex items-center justify-center gap-1">
                        {expandedSections.overdue ? (
                          <>
                            <ICONS.ChevronUp size={12} className="md:w-4 md:h-4" />
                            Mostrar menos
                          </>
                        ) : (
                          <>
                            <ICONS.ChevronDown size={12} className="md:w-4 md:h-4" />
                            +{overdueTasks.length - 2} más
                          </>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* High Priority Tasks - Expandable */}
            {highPriorityTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs md:text-base lg:text-lg font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                  Prioridad Alta ({highPriorityTasks.length})
                </h3>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 space-y-1 p-2">
                  <AnimatePresence>
                    {(expandedSections.highPriority ? highPriorityTasks : highPriorityTasks.slice(0, 2)).map((task, idx) => (
                      <div
                        key={`${task.entryId}-${task.description}`}
                        className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors overflow-hidden"
                      >
                        <div className="w-3 h-3 border-2 border-rose-500 rounded mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-semibold text-gray-800 line-clamp-1 mb-1">{task.description}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs md:text-sm text-gray-600 bg-gray-100 px-1.5 md:px-2 py-0.5 rounded font-medium">{task.bookName}</span>
                            {task.assignee && <span className="text-xs md:text-sm text-indigo-600 bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded font-medium">@{task.assignee}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                  {highPriorityTasks.length > 2 && (
                    <button
                      onClick={() => toggleSection('highPriority')}
                      className="w-full text-center py-1 hover:bg-gray-50 rounded transition-colors active:scale-95"
                    >
                      <span className="text-xs md:text-sm text-gray-600 font-medium hover:text-gray-700 flex items-center justify-center gap-1">
                        {expandedSections.highPriority ? (
                          <>
                            <ICONS.ChevronUp size={12} className="md:w-4 md:h-4" />
                            Mostrar menos
                          </>
                        ) : (
                          <>
                            <ICONS.ChevronDown size={12} className="md:w-4 md:h-4" />
                            +{highPriorityTasks.length - 2} más
                          </>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Upcoming Deadlines - Expandable */}
            {upcomingDeadlines.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs md:text-base lg:text-lg font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                  Próximos ({upcomingDeadlines.length})
                </h3>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 space-y-1 p-2">
                  <AnimatePresence>
                    {(expandedSections.upcoming ? upcomingDeadlines : upcomingDeadlines.slice(0, 2)).map((task, idx) => (
                      <div
                        key={`${task.entryId}-${task.description}`}
                        className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors overflow-hidden"
                      >
                        <div className="w-3 h-3 border-2 border-orange-500 rounded mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-semibold text-gray-800 line-clamp-1 mb-1">{task.description}</p>
                          <div className="flex items-center gap-1">
                            <span className={`px-1.5 md:px-2 py-0.5 rounded text-xs md:text-sm font-bold ${
                              task.daysUntil === 0 ? 'bg-rose-100 text-rose-700' :
                              task.daysUntil === 1 ? 'bg-orange-100 text-orange-700' :
                              'bg-orange-50 text-orange-600'
                            }`}>
                              {task.daysUntil === 0 ? 'Hoy' : task.daysUntil === 1 ? 'Mañ' : `${task.daysUntil}d`}
                            </span>
                            <span className="text-xs md:text-sm text-gray-600 bg-gray-100 px-1.5 md:px-2 py-0.5 rounded font-medium">{task.bookName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                  {upcomingDeadlines.length > 2 && (
                    <button
                      onClick={() => toggleSection('upcoming')}
                      className="w-full text-center py-1 hover:bg-gray-50 rounded transition-colors active:scale-95"
                    >
                      <span className="text-xs md:text-sm text-gray-600 font-medium hover:text-gray-700 flex items-center justify-center gap-1">
                        {expandedSections.upcoming ? (
                          <>
                            <ICONS.ChevronUp size={12} className="md:w-4 md:h-4" />
                            Mostrar menos
                          </>
                        ) : (
                          <>
                            <ICONS.ChevronDown size={12} className="md:w-4 md:h-4" />
                            +{upcomingDeadlines.length - 2} más
                          </>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {highPriorityTasks.length === 0 && upcomingDeadlines.length === 0 && overdueTasks.length === 0 && favoriteBooks.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-8 md:py-12">
          <div className="text-center py-8 md:py-12 px-4 bg-white rounded-lg md:rounded-xl border border-dashed border-gray-200 max-w-sm mx-auto">
            <div className="bg-gray-50 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <ICONS.StickyNote className="text-gray-300 md:w-6 md:h-6" size={20} />
            </div>
            <p className="text-gray-500 font-medium text-sm md:text-lg mb-1">Tu bitácora está vacía</p>
            <p className="text-xs md:text-base text-gray-400">Escribe tu primera idea arriba 👆</p>
            <p className="text-xs md:text-base text-gray-300 mt-2 italic">¡Es hora de empezar a hacer historia! 📖✨</p>
          </div>
        </div>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;