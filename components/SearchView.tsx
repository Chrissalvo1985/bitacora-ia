import React, { useState, useEffect } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { ICONS, TYPE_STYLES, TYPE_LABELS } from '../constants';
import { NoteType, SearchFilters } from '../types';
import EntryCard from './EntryCard';
import { motion, AnimatePresence } from 'framer-motion';

const ITEMS_PER_PAGE = 15;
const ITEMS_PER_PAGE_MOBILE = 8;

const SearchView: React.FC = () => {
  const { books, searchEntries } = useBitacora();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleSearch = async () => {
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
  };

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  const paginatedResults = results.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedResults.length < results.length;

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8 min-h-screen">
      <div className="mb-8 mt-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 flex items-center gap-3 mb-2">
          <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
            <ICONS.Search size={28} />
          </div>
          Búsqueda Inteligente
        </h2>
        <p className="text-base md:text-lg text-gray-500 ml-1">Encuentra cualquier cosa en tu bitácora.</p>
      </div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 md:p-6 mb-6"
      >
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Buscar por palabra clave, persona, proyecto..."
              className="w-full pl-14 pr-4 py-3.5 rounded-2xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-base"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isSearching ? <ICONS.Loader2 className="animate-spin" size={22} /> : 'Buscar'}
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filters.bookId || ''}
            onChange={(e) => setFilters({ ...filters, bookId: e.target.value || undefined })}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-base"
          >
            <option value="">Todas las libretas</option>
            {books.map(book => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </select>

          <select
            value={filters.type || ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as NoteType || undefined })}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-base"
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
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-base"
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
            <div className="flex items-center justify-between mb-4">
              <div className="text-base text-gray-500">
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
              <div className="mt-8 flex justify-center">
                <button
                  onClick={loadMore}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
                >
                  Cargar más ({results.length - paginatedResults.length} restantes)
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
            className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200"
          >
            <ICONS.Search className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">No se encontraron resultados</p>
            <p className="text-sm text-gray-400 mt-2">Intenta con otros términos de búsqueda</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SearchView;

