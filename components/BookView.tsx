import React, { useState, useMemo, useEffect } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import EntryCard from './EntryCard';
import { ICONS, TYPE_STYLES, TYPE_ICONS, TYPE_LABELS } from '../constants';
import CaptureInput from './CaptureInput';
import { motion, AnimatePresence } from 'framer-motion';

interface BookViewProps {
  bookId: string;
}

const ITEMS_PER_PAGE = 20;
const ITEMS_PER_PAGE_MOBILE = 10;

const BookView: React.FC<BookViewProps> = ({ bookId }) => {
  const { books, entries } = useBitacora();
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
      setIsMobile(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);
  
  const book = books.find(b => b.id === bookId);
  
  if (!book) return <div>Libreta no encontrada</div>;

  // Order priority: TASK > RISK > DECISION > IDEA > NOTE
  const typeOrder: Record<string, number> = {
    TASK: 1,
    RISK: 2,
    DECISION: 3,
    IDEA: 4,
    NOTE: 5,
  };

  const allBookEntries = useMemo(() => {
    return entries
      .filter(e => e.bookId === bookId)
      .sort((a, b) => {
        // First sort by type priority
        const typeDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        if (typeDiff !== 0) return typeDiff;
        // Then by date (newest first)
        return b.createdAt - a.createdAt;
      });
  }, [entries, bookId]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return allBookEntries;
    const query = searchQuery.toLowerCase();
    return allBookEntries.filter(entry => 
      entry.summary.toLowerCase().includes(query) ||
      entry.entities.some(e => e.name.toLowerCase().includes(query)) ||
      entry.tasks.some(t => t.description.toLowerCase().includes(query))
    );
  }, [allBookEntries, searchQuery]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const pendingTasks = allBookEntries.reduce((acc, e) => acc + e.tasks.filter(t => !t.isDone).length, 0);

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  const paginatedEntries = filteredEntries.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedEntries.length < filteredEntries.length;

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col pb-28 md:pb-8">
      <div className="mb-6 mt-2">
        <div className="flex items-center gap-2 text-base text-gray-400 mb-3 font-medium">
            <span>Biblioteca</span>
            <ICONS.ChevronRight size={16} />
            <span className="text-indigo-600 truncate max-w-[200px]">{book.name}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{book.name}</h1>
            <div className="flex items-center gap-3">
                <span className="px-4 py-2.5 bg-indigo-50 text-indigo-700 text-base rounded-xl font-bold border border-indigo-100 flex items-center gap-2 shadow-sm">
                    <ICONS.ListTodo size={18} />
                    {pendingTasks} {pendingTasks === 1 ? 'Misión' : 'Misiones'}
                </span>
                {filteredEntries.length > 5 && (
                  <div className="hidden md:flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <ICONS.List size={16} />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <ICONS.Grid3x3 size={16} />
                    </button>
                  </div>
                )}
            </div>
        </div>

        {/* Search Bar */}
        {allBookEntries.length > 5 && (
          <div className="mb-6">
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
            {searchQuery && (
              <p className="text-sm text-gray-500 mt-2 px-1">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'resultado' : 'resultados'}
              </p>
            )}
          </div>
        )}

        {/* AI Context Card */}
        {book.context && (
          <div className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 p-5 rounded-2xl border border-violet-100 mb-6 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
              <ICONS.Sparkles size={40} className="text-violet-600" />
            </div>
            <div className="flex gap-4">
              <div className="mt-1 min-w-[28px]">
                 <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                    <ICONS.Sparkles size={14} className="text-violet-600" />
                 </div>
              </div>
              <div>
                <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mb-2">Contexto IA</p>
                <p className="text-base text-gray-700 leading-relaxed font-medium">
                  {book.context}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 md:mb-8 sticky top-0 z-30 pt-1 bg-[#f8fafc]/90 backdrop-blur-sm pb-2">
        <CaptureInput />
      </div>

      <div className="flex-1">
         {filteredEntries.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 mx-1">
                 <ICONS.Book className="mx-auto text-gray-300 mb-2" size={48} />
                 <p className="text-gray-400 font-medium text-lg">
                   {searchQuery ? 'No se encontraron resultados' : 'Esta libreta está virgen.'}
                 </p>
                 <p className="text-gray-300 text-sm">
                   {searchQuery ? 'Intenta con otros términos' : 'Empieza a llenarla de ideas.'}
                 </p>
             </div>
         ) : (
           <>
             {viewMode === 'grid' && isLargeScreen ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                 {paginatedEntries.map(entry => (
                   <motion.div
                     key={entry.id}
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
                   {paginatedEntries.map((entry, index) => {
                     // Check if we need a section header (type changed)
                     const prevEntry = index > 0 ? paginatedEntries[index - 1] : null;
                     const showSectionHeader = !prevEntry || prevEntry.type !== entry.type;
                     
                     return (
                       <React.Fragment key={entry.id}>
                         {showSectionHeader && (
                           <motion.div
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
                                 {paginatedEntries.filter(e => e.type === entry.type).length} {paginatedEntries.filter(e => e.type === entry.type).length === 1 ? 'entrada' : 'entradas'}
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
                 </AnimatePresence>
               </div>
             )}
             
             {hasMore && (
               <div className="mt-8 flex justify-center">
                 <button
                   onClick={loadMore}
                   className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-base font-semibold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
                 >
                   Cargar más ({filteredEntries.length - paginatedEntries.length} restantes)
                 </button>
               </div>
             )}
             
             {!hasMore && filteredEntries.length > itemsPerPage && (
               <div className="mt-6 text-center text-base text-gray-400">
                 Mostrando todas las {filteredEntries.length} {filteredEntries.length === 1 ? 'entrada' : 'entradas'}
               </div>
             )}
           </>
         )}
      </div>
    </div>
  );
};

export default BookView;