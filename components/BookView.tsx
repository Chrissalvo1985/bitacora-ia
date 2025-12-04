import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import EntryCard from './EntryCard';
import { ICONS, TYPE_STYLES, TYPE_ICONS, TYPE_LABELS } from '../constants';
import CaptureInput from './CaptureInput';
import { motion, AnimatePresence } from 'framer-motion';
import { useThrottle } from '../hooks/useThrottle';

interface BookViewProps {
  bookId: string;
}

const ITEMS_PER_PAGE = 20;
const ITEMS_PER_PAGE_MOBILE = 10;

const BookView: React.FC<BookViewProps> = memo(({ bookId }) => {
  const { books, entries, threads, getThreadById, getEntriesByThreadId } = useBitacora();
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'priority'>('date');
  const [filterType, setFilterType] = useState<string>('all');
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Throttled resize handler for better performance
  const checkSize = useThrottle(() => {
    setIsLargeScreen(window.innerWidth >= 1024);
    setIsMobile(window.innerWidth < 768);
  }, 150);

  useEffect(() => {
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [checkSize]);
  
  const book = books.find(b => b.id === bookId);
  
  if (!book) return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-6xl mb-4">📚</div>
        <p className="text-xl font-bold text-gray-800 mb-2">Libreta no encontrada</p>
        <p className="text-sm text-gray-500">Parece que esta libreta se fue de paseo... 🚶‍♂️</p>
      </div>
    </div>
  );

  // Order priority: TASK > RISK > DECISION > IDEA > NOTE
  const typeOrder: Record<string, number> = {
    TASK: 1,
    RISK: 2,
    DECISION: 3,
    IDEA: 4,
    NOTE: 5,
  };

  const allBookEntries = useMemo(() => {
    let filtered = entries.filter(e => e.bookId === bookId);
    
    // Filter by type if selected
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }
    
    // Sort based on sortBy
    return filtered.sort((a, b) => {
      if (sortBy === 'type') {
        const typeDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        if (typeDiff !== 0) return typeDiff;
        return b.createdAt - a.createdAt;
      }
      if (sortBy === 'priority') {
        // Sort by tasks priority (entries with high priority tasks first)
        const aPriority = a.tasks.some(t => t.priority === 'HIGH') ? 3 : 
                         a.tasks.some(t => t.priority === 'MEDIUM') ? 2 : 1;
        const bPriority = b.tasks.some(t => t.priority === 'HIGH') ? 3 : 
                         b.tasks.some(t => t.priority === 'MEDIUM') ? 2 : 1;
        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.createdAt - a.createdAt;
      }
      // Default: date (newest first)
      return b.createdAt - a.createdAt;
    });
  }, [entries, bookId, sortBy, filterType]);

  // Group entries by thread
  const entriesByThread = useMemo(() => {
    const grouped: Record<string, typeof allBookEntries> = {};
    const unthreaded: typeof allBookEntries = [];
    
    allBookEntries.forEach(entry => {
      if (entry.threadId) {
        if (!grouped[entry.threadId]) {
          grouped[entry.threadId] = [];
        }
        grouped[entry.threadId].push(entry);
      } else {
        unthreaded.push(entry);
      }
    });
    
    return { grouped, unthreaded };
  }, [allBookEntries]);

  const bookThreads = useMemo(() => {
    return threads.filter(t => t.bookId === bookId);
  }, [threads, bookId]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return allBookEntries;
    const query = searchQuery.toLowerCase();
    return allBookEntries.filter(entry => 
      entry.summary.toLowerCase().includes(query) ||
      entry.entities.some(e => e.name.toLowerCase().includes(query)) ||
      entry.tasks.some(t => t.description.toLowerCase().includes(query))
    );
  }, [allBookEntries, searchQuery]);

  // Filter threads and unthreaded entries by search and type filter
  const filteredThreads = useMemo(() => {
    // First, only include threads that have at least one entry
    let threads = bookThreads.filter(thread => {
      const threadEntries = entriesByThread.grouped[thread.id] || [];
      return threadEntries.length > 0;
    });
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      threads = threads.filter(thread => {
        const threadEntries = entriesByThread.grouped[thread.id] || [];
        return thread.title.toLowerCase().includes(query) ||
          threadEntries.some(e => 
            e.summary.toLowerCase().includes(query) ||
            e.entities.some(ent => ent.name.toLowerCase().includes(query))
          );
      });
    }
    // Filter by type if needed
    if (filterType !== 'all') {
      threads = threads.filter(thread => {
        const threadEntries = entriesByThread.grouped[thread.id] || [];
        return threadEntries.some(e => e.type === filterType);
      });
    }
    return threads;
  }, [bookThreads, searchQuery, entriesByThread.grouped, filterType]);

  const filteredUnthreaded = useMemo(() => {
    let unthreaded = entriesByThread.unthreaded;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      unthreaded = unthreaded.filter(entry => 
        entry.summary.toLowerCase().includes(query) ||
        entry.entities.some(e => e.name.toLowerCase().includes(query)) ||
        entry.tasks.some(t => t.description.toLowerCase().includes(query))
      );
    }
    // Filter by type is already applied in allBookEntries
    return unthreaded;
  }, [entriesByThread.unthreaded, searchQuery]);

  // Reset page when search, sort, or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterType]);

  const pendingTasks = allBookEntries.reduce((acc, e) => acc + e.tasks.filter(t => !t.isDone).length, 0);

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  
  // Calculate pagination for unthreaded entries
  const validCurrentPage = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUnthreaded.length / itemsPerPage));
    return Math.min(Math.max(1, currentPage), totalPages);
  }, [currentPage, filteredUnthreaded.length, itemsPerPage]);
  
  // Paginate unthreaded entries (threads are always shown if they have visible entries)
  const paginatedUnthreaded = useMemo(() => {
    const startIdx = (validCurrentPage - 1) * itemsPerPage;
    return filteredUnthreaded.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredUnthreaded, validCurrentPage, itemsPerPage]);
  
  // Calculate total pages based on unthreaded entries only
  // (Threads are always shown, so we don't count them in pagination)
  const totalPagesUnthreaded = Math.max(1, Math.ceil(filteredUnthreaded.length / itemsPerPage));
  
  const startIndex = useMemo(() => {
    return (validCurrentPage - 1) * itemsPerPage;
  }, [validCurrentPage, itemsPerPage]);
  
  const endIndex = useMemo(() => {
    return Math.min(startIndex + itemsPerPage, filteredUnthreaded.length);
  }, [startIndex, itemsPerPage, filteredUnthreaded.length]);
  
  // Reset page if out of bounds
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUnthreaded.length / itemsPerPage));
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, filteredUnthreaded.length, itemsPerPage]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const goToPage = useCallback((page: number) => {
    const totalPages = Math.max(1, Math.ceil(filteredUnthreaded.length / itemsPerPage));
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [filteredUnthreaded.length, itemsPerPage]);

  const goToNextPage = useCallback(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUnthreaded.length / itemsPerPage));
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, filteredUnthreaded.length, itemsPerPage, goToPage]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col pb-28 md:pb-8">
      <div className="mb-6 mt-2">
        <div className="flex items-center gap-2 text-base text-gray-400 mb-3 font-medium">
            <span>Biblioteca</span>
            <ICONS.ChevronRight size={16} />
            <span className="text-indigo-600 truncate max-w-[200px]">{book.name}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight truncate">{book.name}</h1>
          {allBookEntries.length > 0 && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs md:text-sm text-gray-500 font-medium">
                {allBookEntries.length} {allBookEntries.length === 1 ? 'entrada' : 'entradas'}
              </span>
              {bookThreads.length > 0 && (
                <span className="text-xs md:text-sm text-purple-600 font-medium flex items-center gap-1">
                  <ICONS.MessageSquare size={12} />
                  {bookThreads.length} {bookThreads.length === 1 ? 'hilo' : 'hilos'}
                </span>
              )}
              {pendingTasks > 0 && (
                <span className="text-xs md:text-sm text-indigo-600 font-medium flex items-center gap-1">
                  <ICONS.ListTodo size={12} />
                  {pendingTasks} {pendingTasks === 1 ? 'misión' : 'misiones'}
                </span>
              )}
              {allBookEntries.length > 20 && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <ICONS.AlertCircle size={12} />
                  Usa filtros para organizar
                </span>
              )}
            </div>
          )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                {pendingTasks > 0 && (
                  <span className="px-3 md:px-4 py-2 md:py-2.5 bg-indigo-50 text-indigo-700 text-sm md:text-base rounded-xl font-bold border border-indigo-100 flex items-center gap-2 shadow-sm">
                      <ICONS.ListTodo size={16} className="md:w-[18px] md:h-[18px]" />
                      <span className="hidden sm:inline">{pendingTasks} {pendingTasks === 1 ? 'Misión' : 'Misiones'}</span>
                      <span className="sm:hidden">{pendingTasks}</span>
                  </span>
                )}
                {filteredEntries.length > 5 && (
                  <div className="hidden md:flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title="Vista lista"
                    >
                      <ICONS.List size={16} />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title="Vista cuadrícula"
                    >
                      <ICONS.Grid3x3 size={16} />
                    </button>
                  </div>
                )}
            </div>
        </div>

        {/* Search and Filters Bar */}
        {allBookEntries.length > 0 && (
          <div className="mb-6 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar en esta libreta..."
                className="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all bg-white text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <ICONS.X size={20} />
                </button>
              )}
            </div>
            
            {/* Filters - Mobile optimized */}
            <div className="flex flex-col md:flex-row gap-2">
              {/* Sort and Filter Toggle - Mobile */}
              {isMobile && allBookEntries.length > 5 && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ICONS.Filter size={16} />
                  Filtros
                  {(filterType !== 'all' || sortBy !== 'date') && (
                    <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {(filterType !== 'all' ? 1 : 0) + (sortBy !== 'date' ? 1 : 0)}
                    </span>
                  )}
                </button>
              )}
              
              {/* Filters - Desktop or Expanded Mobile */}
              {(!isMobile || showFilters) && (
                <div className="flex flex-col md:flex-row gap-2 flex-1">
                  {/* Sort By */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as 'date' | 'type' | 'priority');
                      setCurrentPage(1);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white text-sm font-medium"
                  >
                    <option value="date">📅 Más recientes</option>
                    <option value="type">🏷️ Por tipo</option>
                    <option value="priority">⭐ Por prioridad</option>
                  </select>
                  
                  {/* Filter By Type */}
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white text-sm font-medium"
                  >
                    <option value="all">Todos los tipos</option>
                    {Object.entries(TYPE_LABELS).map(([type, label]) => {
                      // Use emoji instead of SVG icons for option elements
                      const typeEmoji: Record<string, string> = {
                        NOTE: '📝',
                        TASK: '✅',
                        DECISION: '⚖️',
                        IDEA: '💡',
                        RISK: '⚠️',
                      };
                      return (
                        <option key={type} value={type}>{typeEmoji[type] || ''} {label}</option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
            
            {/* Results count and active filters */}
            {(searchQuery || filterType !== 'all' || sortBy !== 'date') && (
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>
                  {filteredEntries.length} {filteredEntries.length === 1 ? 'entrada' : 'entradas'}
                  {searchQuery && ` para "${searchQuery}"`}
                </span>
                {(filterType !== 'all' || sortBy !== 'date') && (
                  <button
                    onClick={() => {
                      setFilterType('all');
                      setSortBy('date');
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <ICONS.X size={12} />
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      <div className="mb-4 md:mb-6 sticky top-0 z-30 pt-1 bg-[#f8fafc]/90 backdrop-blur-sm pb-2">
        <CaptureInput bookId={bookId} />
        {allBookEntries.length > 10 && (
          <div className="mt-2 text-xs text-gray-500 px-1 flex items-center gap-1.5">
            <ICONS.Info size={12} />
            <span>Con {allBookEntries.length} entradas, usa los filtros arriba para encontrar lo que buscas rápidamente</span>
          </div>
        )}
      </div>

      <div className="flex-1">
         {filteredEntries.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 mx-1 relative overflow-hidden">
                 <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                   <span className="text-8xl">📝</span>
                 </div>
                 <ICONS.Book className="mx-auto text-gray-300 mb-2" size={48} />
                 <p className="text-gray-400 font-medium text-lg">
                   {searchQuery ? 'Nada por aquí... 🤷‍♂️' : 'Esta libreta está virgen, crack! 📖✨'}
                 </p>
                 <p className="text-gray-300 text-sm mt-1">
                   {searchQuery ? 'Intenta con otros términos o palabras clave' : 'Empieza a llenarla de ideas y conquista el mundo! 🚀'}
                 </p>
             </div>
         ) : (
           <>
             {viewMode === 'grid' && isLargeScreen ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                 {/* Show threads first in grid view */}
                 {filteredThreads.map(thread => {
                   const threadEntries = (entriesByThread.grouped[thread.id] || []).sort((a, b) => a.createdAt - b.createdAt);
                   return threadEntries.map(entry => (
                     <motion.div
                       key={`thread-${thread.id}-${entry.id}`}
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <EntryCard entry={entry} compact={true} />
                     </motion.div>
                   ));
                 })}
                 {/* Then show paginated unthreaded entries */}
                 {paginatedUnthreaded.map(entry => (
                   <motion.div
                     key={`unthreaded-${entry.id}`}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.2 }}
                   >
                     <EntryCard entry={entry} compact={true} />
                   </motion.div>
                 ))}
               </div>
             ) : (
               <div className="space-y-4 md:space-y-5">
                 <AnimatePresence>
                   {/* Threads Section */}
                   {filteredThreads.length > 0 && (
                     <motion.div
                       key="threads-section"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="space-y-3 mb-6"
                     >
                       <div className="sticky top-16 z-20 bg-[#f8fafc] py-3 mb-3 -mt-1">
                         <div className="flex items-center gap-3 px-1">
                           <ICONS.MessageSquare size={16} className="text-purple-600" />
                           <span className="text-sm font-bold text-purple-600 uppercase tracking-wide">
                             Hilos de conversación ({filteredThreads.length})
                           </span>
                           <div className="flex-1 h-px bg-gray-200"></div>
                         </div>
                       </div>
                       {filteredThreads.map(thread => {
                         const threadEntries = (entriesByThread.grouped[thread.id] || []).sort((a, b) => a.createdAt - b.createdAt);
                         const isExpanded = expandedThreads.has(thread.id);
                         
                         return (
                           <motion.div
                             key={thread.id}
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="bg-white rounded-xl border-2 border-purple-200 overflow-hidden"
                           >
                             <button
                               onClick={() => toggleThread(thread.id)}
                               className="w-full p-4 flex items-center justify-between hover:bg-purple-50 transition-colors"
                             >
                               <div className="flex items-center gap-3">
                                 <ICONS.MessageSquare size={18} className="text-purple-600" />
                                 <div className="text-left">
                                   <h3 className="font-bold text-gray-900">{thread.title}</h3>
                                   <p className="text-xs text-gray-500">{threadEntries.length} {threadEntries.length === 1 ? 'entrada' : 'entradas'}</p>
                                 </div>
                               </div>
                               <motion.div
                                 animate={{ rotate: isExpanded ? 90 : 0 }}
                                 transition={{ duration: 0.2 }}
                               >
                                 <ICONS.ChevronRight size={20} className="text-gray-400" />
                               </motion.div>
                             </button>
                             <AnimatePresence>
                               {isExpanded && (
                                 <motion.div
                                   initial={{ height: 0, opacity: 0 }}
                                   animate={{ height: 'auto', opacity: 1 }}
                                   exit={{ height: 0, opacity: 0 }}
                                   className="overflow-hidden border-t border-purple-100"
                                 >
                                   <div className="p-4 space-y-3 bg-purple-50/30">
                                     {threadEntries.map(entry => (
                                       <EntryCard key={`thread-entry-${thread.id}-${entry.id}`} entry={entry} />
                                     ))}
                                   </div>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                           </motion.div>
                         );
                       })}
                     </motion.div>
                   )}

                   {/* Unthreaded Entries */}
                   {paginatedUnthreaded.length > 0 && (
                     <motion.div
                       key="unthreaded-section"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="space-y-4 md:space-y-5"
                     >
                       {paginatedUnthreaded.map((entry, index) => {
                         // Check if we need a section header (type changed)
                         const prevEntry = index > 0 ? paginatedUnthreaded[index - 1] : null;
                         const globalIndex = startIndex + index;
                         const prevGlobalEntry = globalIndex > 0 ? filteredUnthreaded[globalIndex - 1] : null;
                         const showSectionHeader = !prevGlobalEntry || prevGlobalEntry.type !== entry.type;
                     
                     return (
                       <React.Fragment key={entry.id}>
                         {showSectionHeader && (
                           <motion.div
                             key={`section-header-${entry.type}-${globalIndex}`}
                             initial={{ opacity: 0, y: -10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="sticky top-16 z-20 bg-[#f8fafc] py-3 mb-3 -mt-1"
                           >
                             <div className="flex items-center gap-3 px-1">
                               <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${TYPE_STYLES[entry.type]}`}>
                                 {TYPE_ICONS[entry.type]}
                                 {TYPE_LABELS[entry.type]}
                               </span>
                               <span className="text-sm text-gray-400 font-medium">
                                 {filteredUnthreaded.filter(e => e.type === entry.type).length} {filteredUnthreaded.filter(e => e.type === entry.type).length === 1 ? 'entrada' : 'entradas'}
                               </span>
                               <div className="flex-1 h-px bg-gray-200"></div>
                             </div>
                           </motion.div>
                         )}
                         <motion.div
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -10 }}
                           transition={{ duration: 0.15 }}
                         >
                           <EntryCard entry={entry} />
                         </motion.div>
                       </React.Fragment>
                     );
                   })}
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
             )}
             
             {/* Pagination */}
             {totalPagesUnthreaded > 1 && (
               <div className="mt-6 md:mt-8 flex flex-col items-center gap-4">
                 {/* Page info */}
                 <div className="text-xs md:text-sm text-gray-500 text-center">
                   {filteredThreads.length > 0 && (
                     <span className="block mb-1">
                       {filteredThreads.length} {filteredThreads.length === 1 ? 'hilo' : 'hilos'} mostrados
                       {filteredUnthreaded.length > 0 && ' • '}
                     </span>
                   )}
                   {filteredUnthreaded.length > 0 && (
                     <span>
                       Entradas: {startIndex + 1}-{endIndex} de {filteredUnthreaded.length}
                     </span>
                   )}
                 </div>
                 
                 <div className="flex items-center gap-2">
                   {/* Previous button */}
                   <button
                     onClick={goToPrevPage}
                     disabled={currentPage === 1}
                     className="px-3 md:px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700"
                   >
                     <ICONS.ChevronLeft size={16} />
                   </button>

                   {/* Page numbers */}
                   <div className="flex items-center gap-1">
                     {Array.from({ length: Math.min(5, totalPagesUnthreaded) }, (_, i) => {
                       let pageNum: number;
                       
                       if (totalPagesUnthreaded <= 5) {
                         pageNum = i + 1;
                       } else if (currentPage <= 3) {
                         pageNum = i + 1;
                       } else if (currentPage >= totalPagesUnthreaded - 2) {
                         pageNum = totalPagesUnthreaded - 4 + i;
                       } else {
                         pageNum = currentPage - 2 + i;
                       }

                       return (
                         <button
                           key={pageNum}
                           onClick={() => goToPage(pageNum)}
                           className={`px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                             currentPage === pageNum
                               ? 'bg-indigo-600 text-white shadow-md'
                               : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600'
                           }`}
                         >
                           {pageNum}
                         </button>
                       );
                     })}
                   </div>

                   {/* Next button */}
                   <button
                     onClick={goToNextPage}
                     disabled={currentPage === totalPagesUnthreaded}
                     className="px-3 md:px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700"
                   >
                     <ICONS.ChevronRight size={16} />
                   </button>
                 </div>
                 
                 {/* Quick jump for mobile */}
                 {isMobile && totalPagesUnthreaded > 5 && (
                   <div className="flex items-center gap-2 text-xs text-gray-500">
                     <span>Ir a página:</span>
                     <input
                       type="number"
                       min={1}
                       max={totalPagesUnthreaded}
                       value={currentPage}
                       onChange={(e) => {
                         const page = parseInt(e.target.value);
                         if (page >= 1 && page <= totalPagesUnthreaded) {
                           goToPage(page);
                         }
                       }}
                       className="w-16 px-2 py-1 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-center"
                     />
                     <span>de {totalPagesUnthreaded}</span>
                   </div>
                 )}
               </div>
             )}
             
             {totalPagesUnthreaded === 1 && filteredUnthreaded.length === 0 && filteredThreads.length > 0 && (
               <div className="mt-6 text-center text-sm text-gray-400">
                 {filteredThreads.length} {filteredThreads.length === 1 ? 'hilo' : 'hilos'} en esta libreta 📚✨
               </div>
             )}
             
             {totalPagesUnthreaded === 1 && filteredUnthreaded.length > 0 && filteredThreads.length === 0 && (
               <div className="mt-6 text-center text-sm text-gray-400">
                 {filteredUnthreaded.length} {filteredUnthreaded.length === 1 ? 'entrada' : 'entradas'} en esta libreta 📚✨
               </div>
             )}
           </>
         )}
      </div>
    </div>
  );
});

BookView.displayName = 'BookView';

export default BookView;