import React, { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS, TYPE_STYLES, TYPE_LABELS, TYPE_ICONS } from '../constants';
import { NoteType, TaskItem, Book } from '../types';
import { useBitacora } from '../context/BitacoraContext';

interface TopicSummary {
  bookName: string;
  bookId: string;
  type: NoteType;
  summary: string;
  tasks: TaskItem[];
  entities: { name: string; type: string }[];
  isNewBook: boolean;
  entryId: string;
  originalText: string;
  taskActions: Array<{
    action: 'complete' | 'update';
    taskDescription: string;
    completionNotes?: string;
  }>;
  threadId?: string; // Optional thread ID
  createNewThread?: boolean; // Whether to create a new thread
  // Thread relation suggestions from AI
  suggestedThreadId?: string;
  suggestedCreateNewThread?: boolean;
  suggestedThreadTitle?: string | null;
  threadRelationReason?: string;
  relatedEntryIds?: string[];
}

interface MultiTopicSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedTopics: TopicSummary[]) => void;
  isMultiTopic: boolean;
  topics: TopicSummary[];
  overallContext: string;
  completedTasks: number;
  fixedBookId?: string; // When provided, book selection is disabled
}

const MultiTopicSummaryModal: React.FC<MultiTopicSummaryModalProps> = memo(({
  isOpen,
  onClose,
  onConfirm,
  isMultiTopic,
  topics: initialTopics,
  overallContext,
  completedTasks,
  fixedBookId
}) => {
  const { books, threads, createThread } = useBitacora();
  const [editedTopics, setEditedTopics] = useState<TopicSummary[]>(initialTopics);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [editingBook, setEditingBook] = useState<string | null>(null);
  const [threadSelections, setThreadSelections] = useState<Record<string, { type: 'none' | 'existing' | 'new'; threadId?: string; newThreadTitle?: string }>>({});

  // Reset state when topics change
  useEffect(() => {
    setEditedTopics(initialTopics);
    // Auto-expand first topic if only one
    if (initialTopics.length === 1) {
      setExpandedTopics(new Set([initialTopics[0].entryId]));
    }
    
    // Auto-select suggested threads from AI
    const newThreadSelections: Record<string, { type: 'none' | 'existing' | 'new'; threadId?: string; newThreadTitle?: string }> = {};
    initialTopics.forEach(topic => {
      if (topic.suggestedThreadId) {
        // AI suggested an existing thread
        newThreadSelections[topic.entryId] = {
          type: 'existing',
          threadId: topic.suggestedThreadId
        };
      } else if (topic.suggestedCreateNewThread && topic.suggestedThreadTitle) {
        // AI suggested creating a new thread
        newThreadSelections[topic.entryId] = {
          type: 'new',
          newThreadTitle: topic.suggestedThreadTitle
        };
      }
    });
    if (Object.keys(newThreadSelections).length > 0) {
      setThreadSelections(newThreadSelections);
      // Also update editedTopics with suggested thread IDs and update book if thread is in different book
      setEditedTopics(prev => prev.map(topic => {
        if (topic.suggestedThreadId) {
          // Check if suggested thread is in a different book
          const suggestedThread = threads.find(t => t.id === topic.suggestedThreadId);
          if (suggestedThread && suggestedThread.bookId !== topic.bookId) {
            const threadBook = books.find(b => b.id === suggestedThread.bookId);
            if (threadBook) {
              return { 
                ...topic, 
                bookId: threadBook.id,
                bookName: threadBook.name,
                isNewBook: false,
                threadId: topic.suggestedThreadId, 
                createNewThread: false 
              };
            }
          }
          return { ...topic, threadId: topic.suggestedThreadId, createNewThread: false };
        } else if (topic.suggestedCreateNewThread) {
          return { ...topic, createNewThread: true };
        }
        return topic;
      }));
    }
  }, [initialTopics, threads, books]);

  if (!isOpen) return null;

  const newBooksCount = editedTopics.filter(t => t.isNewBook).length;
  const totalTasks = editedTopics.reduce((acc, t) => acc + t.tasks.length, 0);

  const toggleExpand = (entryId: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const handleTaskChange = (topicIdx: number, taskIdx: number, field: keyof TaskItem, value: any) => {
    setEditedTopics(prev => {
      const updated = [...prev];
      const topic = { ...updated[topicIdx] };
      const tasks = [...topic.tasks];
      tasks[taskIdx] = { ...tasks[taskIdx], [field]: value };
      topic.tasks = tasks;
      updated[topicIdx] = topic;
      return updated;
    });
  };

  const handleRemoveTask = (topicIdx: number, taskIdx: number) => {
    setEditedTopics(prev => {
      const updated = [...prev];
      const topic = { ...updated[topicIdx] };
      topic.tasks = topic.tasks.filter((_, idx) => idx !== taskIdx);
      updated[topicIdx] = topic;
      return updated;
    });
  };

  const handleRemoveTopic = (topicIdx: number) => {
    setEditedTopics(prev => prev.filter((_, idx) => idx !== topicIdx));
  };

  const handleSelectBook = (topicIdx: number, book: Book) => {
    setEditedTopics(prev => {
      const updated = [...prev];
      updated[topicIdx] = {
        ...updated[topicIdx],
        bookId: book.id,
        bookName: book.name,
        isNewBook: false
      };
      return updated;
    });
    setEditingBook(null);
  };

  const handleConfirm = async () => {
    if (editedTopics.length === 0) {
      onClose();
      return;
    }
    
    // Create new threads if needed
    const topicsWithThreads = await Promise.all(editedTopics.map(async (topic) => {
      if (topic.createNewThread && threadSelections[topic.entryId]?.newThreadTitle) {
        try {
          const newThread = await createThread(threadSelections[topic.entryId].newThreadTitle!, topic.bookId);
          return { ...topic, threadId: newThread.id, createNewThread: false };
        } catch (error) {
          console.error('Error creating thread:', error);
          return topic;
        }
      }
      return topic;
    }));
    
    onConfirm(topicsWithThreads);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full md:w-full md:max-w-2xl bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] pointer-events-auto"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar - mobile only */}
              <div className="md:hidden flex justify-center py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
                <div className="w-10 h-1 bg-white/40 rounded-full" />
              </div>

              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-4 md:p-6 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="bg-white/20 p-2 md:p-2.5 rounded-xl">
                        {isMultiTopic ? (
                          <ICONS.Grid3x3 size={20} className="md:w-6 md:h-6" />
                        ) : (
                          <ICONS.Sparkles size={20} className="md:w-6 md:h-6" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-base md:text-xl font-bold">
                          {isMultiTopic ? '¡Múltiples temas detectados!' : 'Análisis completado'}
                        </h2>
                        <p className="text-xs md:text-sm text-white/80">
                          Revisa y confirma antes de guardar
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 md:p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <ICONS.X size={20} className="md:w-6 md:h-6" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-2 mt-3 md:mt-4">
                    <div className="bg-white/20 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5">
                      <ICONS.Book size={12} className="md:w-3.5 md:h-3.5" />
                      {editedTopics.length} {editedTopics.length === 1 ? 'entrada' : 'entradas'}
                    </div>
                    {newBooksCount > 0 && (
                      <div className="bg-emerald-400/30 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5">
                        <ICONS.Plus size={12} className="md:w-3.5 md:h-3.5" />
                        {newBooksCount} libreta{newBooksCount > 1 ? 's' : ''} nueva{newBooksCount > 1 ? 's' : ''}
                      </div>
                    )}
                    {totalTasks > 0 && (
                      <div className="bg-amber-400/30 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5">
                        <ICONS.ListTodo size={12} className="md:w-3.5 md:h-3.5" />
                        {totalTasks} tarea{totalTasks > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
                {/* Overall context */}
                {overallContext && (
                  <div className="bg-gray-50 rounded-xl p-3 md:p-4 border border-gray-100">
                    <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 md:mb-2">
                      Contexto general
                    </p>
                    <p className="text-xs md:text-sm text-gray-700 leading-relaxed">
                      {overallContext}
                    </p>
                  </div>
                )}

                {/* Empty state */}
                {editedTopics.length === 0 && (
                  <div className="text-center py-8">
                    <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ICONS.X className="text-gray-400" size={24} />
                    </div>
                    <p className="text-gray-500 font-medium">No hay entradas para guardar</p>
                    <p className="text-xs text-gray-400 mt-1">Has eliminado todas las entradas</p>
                  </div>
                )}

                {/* Topics */}
                <div className="space-y-2 md:space-y-3">
                  {editedTopics.length > 0 && (
                    <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
                      {isMultiTopic ? 'Distribución por libreta' : 'Entrada detectada'}
                    </p>
                  )}
                  
                  {editedTopics.map((topic, topicIdx) => {
                    const isExpanded = expandedTopics.has(topic.entryId);
                    const isEditingThisBook = editingBook === topic.entryId;
                    
                    return (
                      <motion.div
                        key={topic.entryId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: topicIdx * 0.05 }}
                        className="bg-white rounded-xl md:rounded-2xl border border-gray-200 overflow-hidden"
                      >
                        {/* Topic Header */}
                        <div 
                          className="p-3 md:p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleExpand(topic.entryId)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                              <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl flex-shrink-0 ${topic.isNewBook ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
                                <ICONS.Book size={16} className={`md:w-[18px] md:h-[18px] ${topic.isNewBook ? 'text-emerald-600' : 'text-indigo-600'}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-bold text-sm md:text-base text-gray-900 truncate">{topic.bookName}</h3>
                                  {topic.isNewBook && (
                                    <span className="text-[9px] md:text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">
                                      NUEVA
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{topic.summary}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] md:text-xs font-bold border flex items-center gap-1 flex-shrink-0 ${TYPE_STYLES[topic.type]}`}>
                                {TYPE_ICONS[topic.type]}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTopic(topicIdx);
                                }}
                                className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors text-gray-300 hover:text-rose-500"
                                title="Eliminar entrada"
                              >
                                <ICONS.Trash2 size={14} />
                              </button>
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-gray-400"
                              >
                                <ICONS.ChevronRight size={16} />
                              </motion.div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3 md:p-4 space-y-3 md:space-y-4 bg-gray-50/50">
                                {/* Book selector - hidden when fixedBookId is provided */}
                                {!fixedBookId && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-gray-700">Libreta destino</span>
                                      <button
                                        onClick={() => setEditingBook(isEditingThisBook ? null : topic.entryId)}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                      >
                                        <ICONS.Edit size={12} />
                                        Cambiar
                                      </button>
                                    </div>
                                    
                                    {isEditingThisBook ? (
                                      <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {books.map((book) => (
                                          <button
                                            key={book.id}
                                            onClick={() => handleSelectBook(topicIdx, book)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                                              topic.bookId === book.id
                                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                            }`}
                                          >
                                            <ICONS.Book size={12} />
                                            {book.name}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                          topic.isNewBook 
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                            : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                        }`}>
                                          {topic.isNewBook ? '✨ Nueva' : '📚 Existente'}
                                        </span>
                                        <span className="text-sm font-medium text-gray-800">{topic.bookName}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Fixed book display when inside a book */}
                                {fixedBookId && (
                                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                                    <div className="flex items-center gap-2">
                                      <ICONS.Book size={16} className="text-indigo-600" />
                                      <div>
                                        <span className="text-xs font-semibold text-indigo-600">Guardando en:</span>
                                        <span className="text-sm font-bold text-indigo-800 ml-2">{topic.bookName}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Thread Selection */}
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-gray-700">Hilo de conversación</p>
                                    {topic.suggestedThreadId && (
                                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                        <ICONS.Sparkles size={10} />
                                        Sugerido por IA
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* AI Suggestion Alert */}
                                  {topic.suggestedThreadId && topic.threadRelationReason && (
                                    <div className="mb-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                                      <p className="text-[10px] text-purple-700 font-medium mb-1">
                                        💡 La IA detectó una relación:
                                      </p>
                                      <p className="text-[10px] text-purple-600 leading-relaxed">
                                        {topic.threadRelationReason}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`thread-${topic.entryId}`}
                                        checked={!threadSelections[topic.entryId] || threadSelections[topic.entryId].type === 'none'}
                                        onChange={() => {
                                          setThreadSelections(prev => ({
                                            ...prev,
                                            [topic.entryId]: { type: 'none' }
                                          }));
                                          setEditedTopics(prev => {
                                            const updated = [...prev];
                                            updated[topicIdx] = { ...updated[topicIdx], threadId: undefined, createNewThread: false };
                                            return updated;
                                          });
                                        }}
                                        className="text-indigo-600"
                                      />
                                      <span className="text-xs text-gray-700">Entrada independiente</span>
                                    </label>
                                    
                                    {/* Existing Threads Option */}
                                    {(threads.filter(t => t.bookId === topic.bookId).length > 0 || topic.suggestedThreadId) && (
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`thread-${topic.entryId}`}
                                          checked={threadSelections[topic.entryId]?.type === 'existing'}
                                          onChange={() => {
                                            // Get threads from same book, plus the suggested thread if it's in a different book
                                            const bookThreads = threads.filter(t => t.bookId === topic.bookId);
                                            const suggestedThread = topic.suggestedThreadId ? threads.find(t => t.id === topic.suggestedThreadId) : null;
                                            
                                            // Pre-select suggested thread if available (even if in different book)
                                            const defaultThreadId = topic.suggestedThreadId && (bookThreads.some(t => t.id === topic.suggestedThreadId) || suggestedThread)
                                              ? topic.suggestedThreadId
                                              : bookThreads[0]?.id;
                                            if (defaultThreadId) {
                                              setThreadSelections(prev => ({
                                                ...prev,
                                                [topic.entryId]: { type: 'existing', threadId: defaultThreadId }
                                              }));
                                              setEditedTopics(prev => {
                                                const updated = [...prev];
                                                updated[topicIdx] = { ...updated[topicIdx], threadId: defaultThreadId, createNewThread: false };
                                                return updated;
                                              });
                                            }
                                          }}
                                          className="text-indigo-600"
                                        />
                                        <span className="text-xs text-gray-700">Agregar a hilo existente</span>
                                      </label>
                                    )}
                                    
                                    {threadSelections[topic.entryId]?.type === 'existing' && (
                                      <select
                                        value={threadSelections[topic.entryId]?.threadId || topic.suggestedThreadId || ''}
                                        onChange={(e) => {
                                          const threadId = e.target.value;
                                          const selectedThread = threads.find(t => t.id === threadId);
                                          
                                          // If selected thread is in a different book, update the topic's book
                                          if (selectedThread && selectedThread.bookId !== topic.bookId) {
                                            const threadBook = books.find(b => b.id === selectedThread.bookId);
                                            if (threadBook) {
                                              setEditedTopics(prev => {
                                                const updated = [...prev];
                                                updated[topicIdx] = { 
                                                  ...updated[topicIdx], 
                                                  bookId: threadBook.id,
                                                  bookName: threadBook.name,
                                                  isNewBook: false,
                                                  threadId, 
                                                  createNewThread: false 
                                                };
                                                return updated;
                                              });
                                            }
                                          }
                                          
                                          setThreadSelections(prev => ({
                                            ...prev,
                                            [topic.entryId]: { type: 'existing', threadId }
                                          }));
                                          setEditedTopics(prev => {
                                            const updated = [...prev];
                                            updated[topicIdx] = { ...updated[topicIdx], threadId, createNewThread: false };
                                            return updated;
                                          });
                                        }}
                                        className="w-full px-2 py-1.5 rounded border border-gray-200 focus:border-indigo-500 outline-none text-xs mt-1"
                                      >
                                        <option value="">Seleccionar hilo...</option>
                                        {/* Show threads from same book */}
                                        {threads.filter(t => t.bookId === topic.bookId).map(thread => (
                                          <option 
                                            key={thread.id} 
                                            value={thread.id}
                                            className={thread.id === topic.suggestedThreadId ? 'font-bold bg-purple-50' : ''}
                                          >
                                            {thread.title}
                                            {thread.id === topic.suggestedThreadId ? ' ⭐ (Sugerido)' : ''}
                                          </option>
                                        ))}
                                        {/* Show suggested thread if it's in a different book */}
                                        {topic.suggestedThreadId && !threads.some(t => t.id === topic.suggestedThreadId && t.bookId === topic.bookId) && (
                                          (() => {
                                            const suggestedThread = threads.find(t => t.id === topic.suggestedThreadId);
                                            if (suggestedThread) {
                                              const threadBook = books.find(b => b.id === suggestedThread.bookId);
                                              return (
                                                <option 
                                                  key={suggestedThread.id} 
                                                  value={suggestedThread.id}
                                                  className="font-bold bg-purple-50"
                                                >
                                                  {suggestedThread.title} ⭐ (Sugerido - {threadBook?.name || 'Otra libreta'})
                                                </option>
                                              );
                                            }
                                            return null;
                                          })()
                                        )}
                                      </select>
                                    )}
                                    
                                    {/* Create New Thread Option */}
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`thread-${topic.entryId}`}
                                        checked={threadSelections[topic.entryId]?.type === 'new'}
                                        onChange={() => {
                                          const defaultTitle = topic.suggestedThreadTitle || `Hilo: ${topic.bookName}`;
                                          setThreadSelections(prev => ({
                                            ...prev,
                                            [topic.entryId]: { type: 'new', newThreadTitle: defaultTitle }
                                          }));
                                          setEditedTopics(prev => {
                                            const updated = [...prev];
                                            updated[topicIdx] = { ...updated[topicIdx], threadId: undefined, createNewThread: true };
                                            return updated;
                                          });
                                        }}
                                        className="text-indigo-600"
                                      />
                                      <span className="text-xs text-gray-700">
                                        Crear nuevo hilo
                                        {topic.suggestedCreateNewThread && (
                                          <span className="ml-1 text-purple-600 font-semibold">(Sugerido por IA)</span>
                                        )}
                                      </span>
                                    </label>
                                    
                                    {threadSelections[topic.entryId]?.type === 'new' && (
                                      <input
                                        type="text"
                                        value={threadSelections[topic.entryId]?.newThreadTitle || topic.suggestedThreadTitle || `Hilo: ${topic.bookName}`}
                                        onChange={(e) => {
                                          setThreadSelections(prev => ({
                                            ...prev,
                                            [topic.entryId]: { ...prev[topic.entryId], newThreadTitle: e.target.value }
                                          }));
                                        }}
                                        placeholder="Título del hilo"
                                        className="w-full px-2 py-1.5 rounded border border-gray-200 focus:border-indigo-500 outline-none text-xs mt-1"
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Resumen</p>
                                  <p className="text-sm text-gray-600 leading-relaxed">{topic.summary}</p>
                                </div>

                                {/* Tasks */}
                                {topic.tasks.length > 0 && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-semibold text-indigo-600 mb-2">
                                      Tareas ({topic.tasks.length})
                                    </p>
                                    <div className="space-y-2">
                                      {topic.tasks.map((task, taskIdx) => (
                                        <div key={taskIdx} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                                          <div className="flex items-start gap-2">
                                            <div className="flex-1">
                                              <input
                                                type="text"
                                                value={task.description}
                                                onChange={(e) => handleTaskChange(topicIdx, taskIdx, 'description', e.target.value)}
                                                className="w-full px-2 py-1 rounded border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-xs"
                                              />
                                              <div className="grid grid-cols-3 gap-2 mt-2">
                                                <input
                                                  type="text"
                                                  value={task.assignee || ''}
                                                  onChange={(e) => handleTaskChange(topicIdx, taskIdx, 'assignee', e.target.value || undefined)}
                                                  placeholder="@Responsable"
                                                  className="px-2 py-1 rounded border border-gray-200 focus:border-indigo-500 outline-none text-xs"
                                                />
                                                <input
                                                  type="date"
                                                  value={task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString().split('T')[0] : task.dueDate) : ''}
                                                  onChange={(e) => handleTaskChange(topicIdx, taskIdx, 'dueDate', e.target.value || undefined)}
                                                  className="px-2 py-1 rounded border border-gray-200 focus:border-indigo-500 outline-none text-xs"
                                                />
                                                <select
                                                  value={task.priority || 'MEDIUM'}
                                                  onChange={(e) => handleTaskChange(topicIdx, taskIdx, 'priority', e.target.value)}
                                                  className="px-2 py-1 rounded border border-gray-200 focus:border-indigo-500 outline-none text-xs"
                                                >
                                                  <option value="LOW">Baja</option>
                                                  <option value="MEDIUM">Media</option>
                                                  <option value="HIGH">Alta</option>
                                                </select>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleRemoveTask(topicIdx, taskIdx)}
                                              className="p-1 hover:bg-rose-100 rounded text-gray-400 hover:text-rose-500 transition-colors"
                                            >
                                              <ICONS.X size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Task Actions (completing existing tasks) */}
                                {topic.taskActions.filter(a => a.action === 'complete').length > 0 && (
                                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                                    <p className="text-xs font-semibold text-emerald-700 mb-2">
                                      ✅ Tareas que se completarán
                                    </p>
                                    {topic.taskActions.filter(a => a.action === 'complete').map((action, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs text-emerald-700">
                                        <ICONS.CheckCircle2 size={12} />
                                        <span className="line-through">{action.taskDescription}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Entities */}
                                {topic.entities.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {topic.entities.map((entity, idx) => (
                                      <span key={idx} className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                        #{entity.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 md:p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <button
                  onClick={onClose}
                  className="px-4 md:px-5 py-2 md:py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={editedTopics.length === 0}
                  className="px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {editedTopics.length === 0 ? 'Sin entradas' : `Guardar ${editedTopics.length} entrada${editedTopics.length > 1 ? 's' : ''} ✨`}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  // Render modal in portal to avoid stacking context issues
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
});

MultiTopicSummaryModal.displayName = 'MultiTopicSummaryModal';

export default MultiTopicSummaryModal;
