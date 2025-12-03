import React, { useState, useMemo, useEffect } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { useAuth } from '../context/AuthContext';
import { ICONS, TYPE_STYLES, TYPE_LABELS } from '../constants';
import { EntityType, NoteType, Entry } from '../types';
import EntryCard from './EntryCard';
import { motion, AnimatePresence } from 'framer-motion';
import { generatePersonInteractionSummary } from '../services/openaiService';

const PeopleView: React.FC = () => {
  const { entries, books, getBookName } = useBitacora();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [selectedType, setSelectedType] = useState<NoteType | ''>('');
  const [selectedPerson, setSelectedPerson] = useState<{
    name: string;
    entries: Array<{ entry: Entry; entity: { name: string; type: EntityType } }>;
  } | null>(null);
  const [interactionSummary, setInteractionSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Extract all people from entries
  const peopleMap = useMemo(() => {
    const map = new Map<string, {
      name: string;
      entries: Array<{ entry: Entry; entity: { name: string; type: EntityType } }>;
      lastInteraction: number;
    }>();

    entries.forEach(entry => {
      entry.entities
        .filter(e => e.type === EntityType.PERSON)
        .forEach(entity => {
          const personName = entity.name;
          if (!map.has(personName)) {
            map.set(personName, {
              name: personName,
              entries: [],
              lastInteraction: 0,
            });
          }
          const person = map.get(personName)!;
          person.entries.push({ entry, entity });
          if (entry.createdAt > person.lastInteraction) {
            person.lastInteraction = entry.createdAt;
          }
        });
    });

    return map;
  }, [entries]);

  // Filter people
  const filteredPeople = useMemo(() => {
    let people = Array.from(peopleMap.values());

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      people = people.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.entries.some(e => 
          e.entry.summary.toLowerCase().includes(query) ||
          e.entry.originalText.toLowerCase().includes(query)
        )
      );
    }

    // Book filter
    if (selectedBook) {
      people = people.map(p => ({
        ...p,
        entries: p.entries.filter(e => e.entry.bookId === selectedBook),
      })).filter(p => p.entries.length > 0);
    }

    // Type filter
    if (selectedType) {
      people = people.map(p => ({
        ...p,
        entries: p.entries.filter(e => e.entry.type === selectedType),
      })).filter(p => p.entries.length > 0);
    }

    // Sort by last interaction
    return people.sort((a, b) => b.lastInteraction - a.lastInteraction);
  }, [peopleMap, searchQuery, selectedBook, selectedType]);

  // Pagination
  const totalPages = Math.ceil(filteredPeople.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPeople = filteredPeople.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBook, selectedType]);

  const totalPeople = peopleMap.size;
  const totalMentions = entries.reduce((sum, e) => 
    sum + e.entities.filter(ent => ent.type === EntityType.PERSON).length, 0
  );

  const handlePersonClick = async (person: {
    name: string;
    entries: Array<{ entry: Entry; entity: { name: string; type: EntityType } }>;
  }) => {
    setSelectedPerson(person);
    setIsLoadingSummary(true);
    setInteractionSummary('');

    try {
      const entriesData = person.entries.map(({ entry }) => ({
        id: entry.id,
        summary: entry.summary,
        type: entry.type,
        createdAt: entry.createdAt,
        originalText: entry.originalText,
        tasks: entry.tasks || [],
      }));

      const summary = await generatePersonInteractionSummary(
        person.name, 
        entriesData,
        user?.id
      );
      setInteractionSummary(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      setInteractionSummary(`Resumen de interacciones con ${person.name}: ${person.entries.length} nota${person.entries.length !== 1 ? 's' : ''} registrada${person.entries.length !== 1 ? 's' : ''}.`);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 md:pb-8 min-h-screen">
      <div className="mb-6 md:mb-8 mt-4 md:mt-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 flex items-center gap-2 md:gap-3 mb-2">
          <div className="bg-indigo-100 p-1.5 md:p-2 rounded-xl text-indigo-600">
            <ICONS.Users size={20} className="md:w-7 md:h-7" />
          </div>
          Personas
        </h2>
        <p className="text-sm md:text-base text-gray-500 ml-1">
          {totalPeople} personas mencionadas en {totalMentions} notas
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar persona..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm md:text-base"
            />
          </div>

          <select
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-sm md:text-base"
          >
            <option value="">Todas las libretas</option>
            {books.map(book => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as NoteType | '')}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-sm md:text-base"
          >
            <option value="">Todos los tipos</option>
            {Object.values(NoteType).map(type => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* People List */}
      {filteredPeople.length === 0 ? (
        <div className="text-center py-12">
          <ICONS.Users className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">No se encontraron personas.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {paginatedPeople.map((person, index) => (
              <motion.button
                key={person.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handlePersonClick(person)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
                    {getInitials(person.name)}
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">{person.name}</h3>
                    <p className="text-xs text-gray-500">
                      {person.entries.length} interacción{person.entries.length !== 1 ? 'es' : ''}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredPeople.length)} de {filteredPeople.length} personas
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <ICONS.ChevronLeft size={16} />
                  Anterior
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-xl font-medium transition-colors min-w-[40px] ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  Siguiente
                  <ICONS.ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Person Interactions Modal */}
      <AnimatePresence>
        {selectedPerson && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPerson(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {getInitials(selectedPerson.name)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedPerson.name}</h2>
                      <p className="text-indigo-100 text-sm">
                        {selectedPerson.entries.length} interacción{selectedPerson.entries.length !== 1 ? 'es' : ''} registrada{selectedPerson.entries.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPerson(null)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <ICONS.X size={24} className="text-white" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* AI Summary */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-3">
                      <ICONS.Sparkles size={20} className="text-indigo-600" />
                      <h3 className="font-bold text-gray-900">Resumen de Interacciones</h3>
                    </div>
                    {isLoadingSummary ? (
                      <div className="flex items-center gap-3 text-gray-600">
                        <ICONS.Loader2 className="animate-spin text-indigo-600" size={20} />
                        <span>Generando resumen...</span>
                      </div>
                    ) : (
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {interactionSummary || 'Cargando resumen...'}
                      </p>
                    )}
                  </div>

                  {/* Entries List */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <ICONS.Book size={18} className="text-indigo-600" />
                      Entradas Relacionadas
                    </h3>
                    <div className="space-y-4">
                      {selectedPerson.entries.map(({ entry }) => (
                        <EntryCard key={entry.id} entry={entry} compact />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PeopleView;

