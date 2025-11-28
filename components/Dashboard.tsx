import React, { useMemo, useCallback, memo } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { useAuth } from '../context/AuthContext';
import EntryCard from './EntryCard';
import { ICONS } from '../constants';
import CaptureInput from './CaptureInput';
import { motion } from 'framer-motion';

interface DashboardProps {
  onSelectBook?: (bookId: string) => void;
  onNavigateToEntry?: (bookId: string, entryId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectBook, onNavigateToEntry }) => {
  const { entries, books } = useBitacora();
  const { user } = useAuth();

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
      .slice(0, 6);
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
    <div className="max-w-[1600px] mx-auto flex flex-col px-0 md:px-6 lg:px-8">
      
      {/* Header - Compact */}
      <div className="flex-shrink-0 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-indigo-800 to-gray-900 tracking-tight">
              {greeting}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-semibold text-indigo-600">{openTasks} misiones</span> • <span className="font-semibold text-gray-700">{books.length} libretas</span>
            </p>
          </div>
        </div>
        <div className="mt-2">
          <CaptureInput />
        </div>
      </div>

      {/* Main Content - Optimized Layout */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        
        {/* Stats Block - Horizontal Compact */}
        <div className="flex-shrink-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-3 md:p-4 border border-indigo-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <ICONS.BarChart3 size={16} />
            Resumen
          </h3>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="bg-white/90 rounded-lg p-2 md:p-3 text-center shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xl md:text-2xl font-bold text-gray-800">{totalEntries}</p>
              <p className="text-xs text-gray-500 font-medium">Entradas 📝</p>
            </div>
            <div className="bg-white/90 rounded-lg p-2 md:p-3 text-center shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xl md:text-2xl font-bold text-indigo-600">{openTasks}</p>
              <p className="text-xs text-gray-500 font-medium">Pendientes ⏳</p>
            </div>
            <div className="bg-white/90 rounded-lg p-2 md:p-3 text-center shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xl md:text-2xl font-bold text-emerald-600">{completedTasks}</p>
              <p className="text-xs text-gray-500 font-medium">Completadas ✅</p>
            </div>
          </div>
        </div>

        {/* Favorite Books Block - Horizontal Compact */}
        {favoriteBooks.length > 0 && (
          <div className="flex-shrink-0">
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <ICONS.Book size={16} />
              Accesos Directos
            </h3>
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 custom-scrollbar">
              {favoriteBooks.map((book, idx) => {
                const bookEntries = entries.filter(e => e.bookId === book.id);
                const lastEntry = bookEntries.sort((a, b) => b.createdAt - a.createdAt)[0];
                
                return (
                  <motion.button
                    key={book.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onSelectBook?.(book.id)}
                    className="flex-shrink-0 w-40 md:w-48 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-300 transition-all p-2.5 md:p-3 text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="bg-indigo-50 p-1.5 rounded-lg">
                          <ICONS.Book size={16} className="text-indigo-600" />
                        </div>
                        <span className="font-semibold text-sm text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {book.name}
                        </span>
                      </div>
                      {book.pendingTasks > 0 && (
                        <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {book.pendingTasks}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 ml-9">{book.entryCount} entradas</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks Section - Compact with max height */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 pb-4">
          {/* High Priority Tasks */}
          {highPriorityTasks.length > 0 && (
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2 flex-shrink-0">
                <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                Prioridad Alta
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                <div>
                  {highPriorityTasks.slice(0, 8).map((task, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 border-2 border-rose-500 rounded-lg mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 mb-1.5 line-clamp-1">{task.description}</p>
                          <div className="flex flex-wrap gap-1.5 text-xs items-center">
                            <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-medium">{task.bookName}</span>
                            {task.assignee && <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">@{task.assignee}</span>}
                            {onNavigateToEntry && (
                              <button
                                onClick={() => onNavigateToEntry(task.bookId, task.entryId)}
                                className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 hover:underline text-xs"
                              >
                                Ver <ICONS.ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2 flex-shrink-0">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                Próximos Vencimientos
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                {upcomingDeadlines.slice(0, 8).map((task, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 border-2 border-orange-500 rounded-lg mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 mb-1.5 line-clamp-1">{task.description}</p>
                          <div className="flex flex-wrap gap-1.5 text-xs items-center">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              task.daysUntil === 0 ? 'bg-rose-100 text-rose-700' :
                              task.daysUntil === 1 ? 'bg-orange-100 text-orange-700' :
                              'bg-orange-50 text-orange-600'
                            }`}>
                              {task.daysUntil === 0 ? 'Hoy' : task.daysUntil === 1 ? 'Mañana' : `${task.daysUntil}d`}
                            </span>
                            <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-medium">{task.bookName}</span>
                            {task.assignee && <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">@{task.assignee}</span>}
                            {onNavigateToEntry && (
                              <button
                                onClick={() => onNavigateToEntry(task.bookId, task.entryId)}
                                className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 hover:underline text-xs"
                              >
                                Ver <ICONS.ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {highPriorityTasks.length === 0 && upcomingDeadlines.length === 0 && favoriteBooks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200"
          >
            <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <ICONS.StickyNote className="text-gray-300" size={24} />
            </div>
            <p className="text-gray-500 font-medium text-sm">Tu bitácora está vacía.</p>
            <p className="text-xs text-gray-400 mt-1">Escribe tu primera idea arriba 👆</p>
            <p className="text-xs text-gray-300 mt-2 italic">¡Es hora de empezar a hacer historia! 📖✨</p>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;