import React, { useState, useEffect, useCallback, memo } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { ICONS, TYPE_STYLES, TYPE_LABELS } from '../constants';
import { NoteType, SearchFilters } from '../types';
import EntryCard from './EntryCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useThrottle } from '../hooks/useThrottle';

const ITEMS_PER_PAGE = 15;
const ITEMS_PER_PAGE_MOBILE = 8;

const SearchView: React.FC = memo(() => {
  const { books, searchEntries } = useBitacora();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  
  // Throttled resize handler for better performance
  const checkSize = useThrottle(() => {
    setIsMobile(window.innerWidth < 768);
  }, 150);

  useEffect(() => {
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [checkSize]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setCurrentPage(1);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await searchEntries({
        query,
        ...filters,
      });
      setResults(searchResults);
      setCurrentPage(1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [query, filters, searchEntries]);

  // Debounced search effect - search after user stops typing for 300ms
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCurrentPage(1);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, filters, handleSearch]);

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  const paginatedResults = results.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedResults.length < results.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8 min-h-screen">
      <div className="mb-4 md:mb-8 mt-2 md:mt-4">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <div className="bg-indigo-100 p-1.5 md:p-2 rounded-xl text-indigo-600">
            <ICONS.Search size={20} className="md:w-7 md:h-7" />
          </div>
          Búsqueda Inteligente
        </h2>
        <p className="text-sm md:text-base lg:text-lg text-gray-500 ml-1">Encuentra cualquier cosa en tu bitácora.</p>
      </div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl md:rounded-3xl shadow-lg border border-gray-100 p-3 md:p-5 lg:p-6 mb-4 md:mb-6"
      >
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="flex-1 relative">
            <ICONS.Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="¿Qué buscas hoy? 🔍"
              className="w-full pl-10 md:pl-14 pr-3 md:pr-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm md:text-base"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 md:px-6 py-2.5 md:py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl md:rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base flex items-center justify-center gap-2"
          >
            {isSearching ? <ICONS.Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" /> : 'Buscar'}
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
          <select
            value={filters.bookId || ''}
            onChange={(e) => setFilters({ ...filters, bookId: e.target.value || undefined })}
            className="px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-sm md:text-base"
          >
            <option value="">Todas las libretas</option>
            {books.map(book => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </select>

          <select
            value={filters.type || ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as NoteType || undefined })}
            className="px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-sm md:text-base"
          >
            <option value="">Todos los tipos</option>
            {Object.values(NoteType).map(type => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>

          <input
            type="text"
            value={filters.assignee || ''}
            onChange={(e) => setFilters({ ...filters, assignee: e.target.value || undefined })}
            placeholder="Filtrar por responsable"
            className="px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-sm md:text-base"
          />
        </div>
      </motion.div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {results.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4 md:space-y-6"
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="text-sm md:text-base text-gray-500">
                {results.length} {results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
              </div>
              {results.length > itemsPerPage && (
                <div className="text-xs text-gray-400">
                  Mostrando {paginatedResults.length} de {results.length}
                </div>
              )}
            </div>
            <div className="space-y-4 md:space-y-6">
              {paginatedResults.map(entry => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <EntryCard entry={entry} />
                </motion.div>
              ))}
            </div>
            
            {hasMore && (
              <div className="mt-4 md:mt-8 flex justify-center">
                <button
                  onClick={loadMore}
                  className="px-4 md:px-6 py-2 md:py-3 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
                >
                  Cargar más ({results.length - paginatedResults.length} restantes) ⬇️
                </button>
              </div>
            )}
            
            {!hasMore && results.length > itemsPerPage && (
              <div className="mt-6 text-center text-sm text-gray-400">
                Todos los resultados mostrados
              </div>
            )}
          </motion.div>
        ) : query && !isSearching ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 md:py-16 bg-white rounded-2xl md:rounded-3xl border border-dashed border-gray-200 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
              <span className="text-8xl">🔍</span>
            </div>
            <ICONS.Search className="mx-auto text-gray-300 mb-3 md:mb-4 w-9 h-9 md:w-12 md:h-12" />
            <p className="text-sm md:text-base text-gray-500 font-medium">Nada por aquí, nada por allá... 🤷‍♂️</p>
            <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2">Intenta con otros términos o palabras clave diferentes</p>
            <p className="text-xs text-gray-300 mt-2 italic">A veces la mejor búsqueda es la que no encuentra nada 😉</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

SearchView.displayName = 'SearchView';

export default SearchView;

