import React, { useState, memo, useCallback } from 'react';
import { Entry, EntryStatus, NoteType } from '../types';
import { ICONS, TYPE_STYLES, TYPE_ICONS, TYPE_LABELS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';

const EntryCard: React.FC<{ entry: Entry; compact?: boolean }> = memo(({ entry, compact = false }) => {
  const { toggleTask, deleteEntry, getBookName } = useBitacora();
  const bookName = getBookName(entry.bookId);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Confirm dialogs state
  const [confirmTask, setConfirmTask] = useState<{ isOpen: boolean; taskIndex: number; description: string }>({
    isOpen: false, taskIndex: -1, description: ''
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleConfirmTaskComplete = useCallback(() => {
    if (confirmTask.taskIndex >= 0) {
      toggleTask(entry.id, confirmTask.taskIndex);
    }
    setConfirmTask({ isOpen: false, taskIndex: -1, description: '' });
  }, [confirmTask, toggleTask, entry.id]);

  const handleConfirmDelete = useCallback(() => {
    deleteEntry(entry.id);
    setConfirmDelete(false);
  }, [deleteEntry, entry.id]);
  
  // Always allow expansion - all entries can be expanded to see details
  const hasDetails = entry.tasks.length > 0 || entry.entities.length > 0 || entry.originalText || entry.summary.length > 120;

  if (entry.status === EntryStatus.PROCESSING) {
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
        <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <ICONS.Sparkles size={16} className="text-indigo-400" />
            </div>
            <div className="h-4 bg-gray-100 rounded-full w-1/3"></div>
        </div>
        <div className="space-y-3">
            <div className="h-3 bg-gray-100 rounded-full w-full"></div>
            <div className="h-3 bg-gray-100 rounded-full w-5/6"></div>
        </div>
        <div className="mt-4 text-xs text-indigo-500 font-bold uppercase tracking-wider">Ordenando tus ideas...</div>
      </div>
    );
  }

  // Summary preview (first 120 chars) - always show preview in header
  const summaryPreview = entry.summary.length > 120 
    ? entry.summary.substring(0, 120) + '...' 
    : entry.summary;

  // Special styling for NOTE and DECISION types
  const isNoteOrDecision = entry.type === NoteType.NOTE || entry.type === NoteType.DECISION;
  const cardBorderColor = isNoteOrDecision 
    ? (entry.type === NoteType.DECISION ? 'border-emerald-200' : 'border-gray-200')
    : 'border-gray-100';
  const cardHoverBorder = isNoteOrDecision
    ? (entry.type === NoteType.DECISION ? 'hover:border-emerald-300' : 'hover:border-gray-300')
    : 'hover:border-indigo-200';

  return (
    <motion.div 
      className={`group bg-white rounded-2xl shadow-sm border ${cardBorderColor} hover:shadow-md ${cardHoverBorder} transition-all duration-200 overflow-hidden`}
      layout
    >
      {/* Compact Header - Always Visible */}
      <div 
        className="p-5 md:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${TYPE_STYLES[entry.type]}`}>
                {TYPE_ICONS[entry.type]}
                {TYPE_LABELS[entry.type]}
              </span>
              <span className="text-xs md:text-sm text-gray-400 font-medium">
                {new Date(entry.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
              {entry.tasks.length > 0 && (
                <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  {entry.tasks.filter(t => !t.isDone).length} {entry.tasks.filter(t => !t.isDone).length === 1 ? 'misión' : 'misiones'}
                </span>
              )}
            </div>
            
            {/* Always show preview in header, never full summary */}
            <p className={`text-base md:text-lg text-gray-800 leading-relaxed ${!isExpanded ? 'line-clamp-2' : 'line-clamp-2'}`}>
              {summaryPreview}
            </p>
            
            {/* Book name - always visible */}
            <div className="mt-2 flex items-center gap-2">
              <ICONS.Book size={14} className="text-gray-400" />
              <span className="text-xs md:text-sm text-gray-500 font-medium">{bookName}</span>
            </div>
            
            {/* Quick info in collapsed state */}
            {!isExpanded && entry.entities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.entities.slice(0, 3).map((entity, idx) => (
                  <span key={entity.id || idx} className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md">
                    #{entity.name}
                  </span>
                ))}
                {entry.entities.length > 3 && (
                  <span className="text-xs text-slate-400">+{entry.entities.length - 3}</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              title={isExpanded ? "Contraer" : "Ver detalles"}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ICONS.ChevronRight size={20} />
              </motion.div>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              title="Eliminar entrada"
            >
              <ICONS.Trash2 size={18} />
            </button>
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
            <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-gray-50 space-y-5 pt-5">
              {/* Special formatting for DECISION type */}
              {entry.type === NoteType.DECISION && (
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-5 border-2 border-emerald-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-emerald-500 p-2 rounded-lg">
                      <ICONS.Gavel size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wide">
                        Acuerdo Tomado
                      </h4>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {new Date(entry.createdAt).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-base text-emerald-900 leading-relaxed font-medium">
                    {entry.summary}
                  </p>
                  {entry.originalText && entry.originalText.trim() !== entry.summary.trim() && (
                    <div className="mt-4 pt-4 border-t border-emerald-200">
                      <p className="text-sm text-emerald-700 leading-relaxed">
                        <span className="font-semibold">Contexto:</span> {entry.originalText}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Special formatting for NOTE type - Enhanced view */}
              {entry.type === NoteType.NOTE && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-gray-500 p-2 rounded-lg">
                      <ICONS.StickyNote size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                        Nota
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(entry.createdAt).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-base text-gray-900 leading-relaxed font-medium">
                    {entry.summary}
                  </p>
                  {entry.originalText && entry.originalText.trim() !== entry.summary.trim() && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        <span className="font-semibold">Texto original:</span> {entry.originalText}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Full Summary - Only show for other types (TASK, IDEA, RISK) */}
              {entry.type !== NoteType.DECISION && entry.type !== NoteType.NOTE && (
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ICONS.Sparkles size={16} className="text-indigo-500" />
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      Resumen
                    </h4>
                  </div>
                  <p className="text-base md:text-lg text-gray-800 leading-relaxed">
                    {entry.summary}
                  </p>
                </div>
              )}

              {/* Original Text - Show if available and different from summary (only for non-DECISION/NOTE types) */}
              {entry.type !== NoteType.DECISION && entry.type !== NoteType.NOTE && entry.originalText && entry.originalText.trim() !== entry.summary.trim() && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ICONS.FileText size={16} className="text-gray-500" />
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Texto Original
                    </h4>
                  </div>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {entry.originalText}
                  </p>
                </div>
              )}

              {/* Metadata Section */}
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-600">
                  <ICONS.Calendar size={14} className="text-gray-400" />
                  <span className="text-xs">
                    {new Date(entry.createdAt).toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <ICONS.Book size={14} className="text-gray-400" />
                  <span className="text-xs font-medium">{bookName}</span>
                </div>
              </div>

              {/* Tasks */}
              {entry.tasks.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100/50">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <ICONS.ListTodo size={14} />
                      Acciones ({entry.tasks.filter(t => !t.isDone).length} pendientes)
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {entry.tasks.map((task, idx) => (
                      <div key={idx} className={`group/task transition-colors ${task.isDone ? 'bg-emerald-50/30' : 'bg-white hover:bg-gray-50'}`}>
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!task.isDone) {
                                  const desc = task.description.length > 50 
                                    ? task.description.substring(0, 50) + '...' 
                                    : task.description;
                                  setConfirmTask({ isOpen: true, taskIndex: idx, description: desc });
                                } else {
                                  // Allow un-completing without confirmation
                                  toggleTask(entry.id, idx);
                                }
                              }}
                              className={`mt-0.5 flex-shrink-0 transition-all duration-200 ${task.isDone ? 'text-emerald-600' : 'text-gray-300 hover:text-indigo-500 hover:scale-110'}`}
                              title={task.isDone ? 'Desmarcar tarea' : 'Completar tarea'}
                            >
                              {task.isDone ? (
                                <div className="relative">
                                  <ICONS.CheckCircle2 size={22} className="fill-emerald-500 text-white" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <ICONS.Check size={14} className="text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-5 h-5 border-2 border-current rounded-lg transition-colors" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className={`text-base font-medium leading-relaxed ${task.isDone ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>
                                  {task.description}
                                </p>
                                {task.isDone && (
                                  <span className="flex-shrink-0 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                                    ✓
                                  </span>
                                )}
                              </div>
                              
                              {(task.assignee || task.dueDate) && !task.isDone && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {task.assignee && (
                                    <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 text-sm font-medium">
                                      <span className="text-indigo-500">@</span>
                                      {task.assignee}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200 text-sm font-medium">
                                      📅 {task.dueDate instanceof Date ? task.dueDate.toLocaleDateString('es-ES') : task.dueDate}
                                    </span>
                                  )}
                                </div>
                              )}

                              {task.isDone && task.completionNotes && (
                                <div className="mt-3 p-3 bg-white rounded-lg border-l-4 border-emerald-500">
                                  <p className="text-xs font-bold text-emerald-700 mb-1.5 uppercase tracking-wide">
                                    Observaciones
                                  </p>
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {task.completionNotes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities */}
              {entry.entities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entry.entities.map((entity, idx) => (
                    <span key={entity.id || idx} className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-md">
                      #{entity.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog - Complete Task */}
      <ConfirmDialog
        isOpen={confirmTask.isOpen}
        onClose={() => setConfirmTask({ isOpen: false, taskIndex: -1, description: '' })}
        onConfirm={handleConfirmTaskComplete}
        title="¿Completar tarea?"
        message={`¿Marcar como completada: "${confirmTask.description}"?`}
        confirmText="✓ Completar"
        cancelText="No, cancelar"
        variant="success"
      />

      {/* Confirm Dialog - Delete Entry */}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar entrada?"
        message="Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar esta entrada?"
        confirmText="Sí, eliminar"
        cancelText="No, conservar"
        variant="danger"
      />
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if entry data actually changed
  return prevProps.entry.id === nextProps.entry.id 
    && prevProps.entry.status === nextProps.entry.status
    && prevProps.entry.summary === nextProps.entry.summary
    && prevProps.entry.tasks.length === nextProps.entry.tasks.length
    && prevProps.entry.tasks.every((t, i) => t.isDone === nextProps.entry.tasks[i]?.isDone)
    && prevProps.compact === nextProps.compact;
});

export default EntryCard;