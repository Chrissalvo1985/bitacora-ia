import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS, TYPE_STYLES, TYPE_ICONS, TYPE_LABELS } from '../constants';
import { NoteType, TaskItem, Book } from '../types';
import { useBitacora } from '../context/BitacoraContext';
import { DocumentInsight } from '../services/documentAnalysisService';

interface AnalysisSummary {
  bookName: string;
  bookId?: string;
  type: NoteType;
  summary: string;
  tasks: TaskItem[];
  entities: Array<{ name: string; type: string }>;
  isNewBook: boolean;
  documentInsights?: DocumentInsight[];
  // Note: Attachments are only used for AI context, not stored or displayed
}

interface AnalysisSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedData: AnalysisSummary) => void;
  analysis: AnalysisSummary;
}

const AnalysisSummaryModal: React.FC<AnalysisSummaryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  analysis,
}) => {
  const { books } = useBitacora();
  
  const [editedTasks, setEditedTasks] = useState<TaskItem[]>(analysis?.tasks || []);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>(analysis?.bookId);
  const [selectedBookName, setSelectedBookName] = useState<string>(analysis?.bookName || '');
  const [isNewBook, setIsNewBook] = useState<boolean>(analysis?.isNewBook || false);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Reset state when analysis changes
  useEffect(() => {
    if (analysis) {
      setEditedTasks(analysis.tasks || []);
      setSelectedBookId(analysis.bookId);
      setSelectedBookName(analysis.bookName);
      setIsNewBook(analysis.isNewBook);
      setShowBookSelector(false);
      setNewBookName('');
      setIsCreatingNew(false);
    }
  }, [analysis]);

  if (!analysis) return null;

  const handleTaskChange = (index: number, field: keyof TaskItem, value: any) => {
    const updated = [...editedTasks];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTasks(updated);
  };

  const handleSelectBook = (book: Book) => {
    setSelectedBookId(book.id);
    setSelectedBookName(book.name);
    setIsNewBook(false);
    setShowBookSelector(false);
    setIsCreatingNew(false);
  };

  const handleCreateNewBook = () => {
    if (!newBookName.trim()) return;
    const newId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setSelectedBookId(newId);
    setSelectedBookName(newBookName.trim());
    setIsNewBook(true);
    setShowBookSelector(false);
    setNewBookName('');
    setIsCreatingNew(false);
  };

  const handleConfirm = () => {
    onConfirm({
      ...analysis,
      tasks: editedTasks,
      bookId: selectedBookId,
      bookName: selectedBookName,
      isNewBook: isNewBook,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
        />

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center md:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg">
                    <ICONS.Sparkles size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-gray-900">Análisis Completado</h2>
                    <p className="text-sm text-gray-500">Revisa y ajusta lo que la IA creó</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/80 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                >
                  <ICONS.X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0">
              {/* Book Assignment - Editable */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ICONS.Book size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-gray-900">Libreta Asignada</h3>
                  </div>
                  <button
                    onClick={() => setShowBookSelector(!showBookSelector)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <ICONS.Edit size={14} />
                    Cambiar
                  </button>
                </div>
                
                {!showBookSelector ? (
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      isNewBook 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    }`}>
                      {isNewBook ? '✨ Nueva' : '📚 Existente'}
                    </span>
                    <span className="text-base font-bold text-gray-800">{selectedBookName}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Existing books */}
                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                      {books.map((book) => (
                        <button
                          key={book.id}
                          onClick={() => handleSelectBook(book)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                            selectedBookId === book.id
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              : 'bg-white hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <ICONS.Book size={14} />
                          {book.name}
                        </button>
                      ))}
                    </div>
                    
                    {/* Create new book */}
                    <div className="border-t border-gray-200 pt-3">
                      {!isCreatingNew ? (
                        <button
                          onClick={() => setIsCreatingNew(true)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-2"
                        >
                          <ICONS.Plus size={14} />
                          Crear nueva libreta
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newBookName}
                            onChange={(e) => setNewBookName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateNewBook()}
                            placeholder="Nombre de la nueva libreta..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleCreateNewBook}
                              disabled={!newBookName.trim()}
                              className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Crear
                            </button>
                            <button
                              onClick={() => {
                                setIsCreatingNew(false);
                                setNewBookName('');
                              }}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Entry Type */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <ICONS.StickyNote size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-gray-900">Tipo de Entrada</h3>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border flex items-center gap-1.5 w-fit ${TYPE_STYLES[analysis.type]}`}>
                  {TYPE_ICONS[analysis.type]}
                  {TYPE_LABELS[analysis.type]}
                </span>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <ICONS.FileText size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-gray-900">Resumen</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Tasks - Editable */}
              {editedTasks.length > 0 && (
                <div className="bg-indigo-50/30 rounded-xl p-4 border border-indigo-200">
                  <div className="flex items-center gap-2 mb-4">
                    <ICONS.ListTodo size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-gray-900">Misiones Creadas ({editedTasks.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {editedTasks.map((task, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Descripción
                          </label>
                          <input
                            type="text"
                            value={task.description}
                            onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              Responsable
                            </label>
                            <input
                              type="text"
                              value={task.assignee || ''}
                              onChange={(e) => handleTaskChange(idx, 'assignee', e.target.value || undefined)}
                              placeholder="Ej: Juan, Yo, Equipo"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              Fecha Límite
                            </label>
                            <input
                              type="date"
                              value={task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString().split('T')[0] : task.dueDate) : ''}
                              onChange={(e) => handleTaskChange(idx, 'dueDate', e.target.value || undefined)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Prioridad
                          </label>
                          <select
                            value={task.priority || 'MEDIUM'}
                            onChange={(e) => handleTaskChange(idx, 'priority', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                          >
                            <option value="LOW">Baja</option>
                            <option value="MEDIUM">Media</option>
                            <option value="HIGH">Alta</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities */}
              {analysis.entities.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ICONS.Sparkles size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-gray-900">Entidades Detectadas ({analysis.entities.length})</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.entities.map((entity, idx) => (
                      <span key={entity.id || idx} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
                        {entity.type}: {entity.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Insights - if any */}
              {analysis.documentInsights && analysis.documentInsights.length > 0 && (
                <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ICONS.FileText size={18} className="text-violet-600" />
                    <h3 className="font-bold text-gray-900">Análisis del Documento ({analysis.documentInsights.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.documentInsights.map((insight, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-violet-100">
                        <div className="flex items-start gap-2">
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            insight.type === 'task' ? 'bg-blue-100 text-blue-700' :
                            insight.type === 'risk' ? 'bg-rose-100 text-rose-700' :
                            insight.type === 'deadline' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {insight.type === 'task' ? 'Tarea' :
                             insight.type === 'risk' ? 'Riesgo' :
                             insight.type === 'deadline' ? 'Fecha' :
                             insight.type === 'duplicate' ? 'Duplicado' :
                             insight.type === 'related' ? 'Relacionado' : 'Info'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{insight.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{insight.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Confirmar y Guardar
              </button>
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
};

export default AnalysisSummaryModal;

