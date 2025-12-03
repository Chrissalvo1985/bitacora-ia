import React, { useState, memo, useCallback, useEffect } from 'react';
import { Entry, EntryStatus, NoteType } from '../types';
import { ICONS, TYPE_STYLES, TYPE_ICONS, TYPE_LABELS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';
import ThreadManagerModal from './ThreadManagerModal';
import { AuthContext } from '../context/AuthContext';

const EntryCard: React.FC<{ entry: Entry; compact?: boolean }> = memo(({ entry, compact = false }) => {
  const { toggleTask, deleteEntry, getBookName, getThreadById, threads } = useBitacora();
  const authContext = React.useContext(AuthContext);
  const user = authContext?.user;
  const bookName = getBookName(entry.bookId);
  const thread = entry.threadId ? getThreadById(entry.threadId) : undefined;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOriginalText, setShowOriginalText] = useState(false);
  
  // Confirm dialogs state
  const [confirmTask, setConfirmTask] = useState<{ isOpen: boolean; taskIndex: number; description: string }>({
    isOpen: false, taskIndex: -1, description: ''
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showThreadManager, setShowThreadManager] = useState(false);

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

  // Use AI rewritten text if available, otherwise use summary
  const displayText = entry.aiRewrittenText || entry.summary;
  const hasOriginalText = entry.originalText && entry.originalText.trim() !== displayText.trim();
  const pendingTasks = entry.tasks.filter(t => !t.isDone);
  const completedTasks = entry.tasks.filter(t => t.isDone);

  // Type-specific styling
  const typeConfig = {
    [NoteType.NOTE]: {
      accent: 'indigo',
      bgGradient: 'from-indigo-50/50 to-indigo-100/30',
      border: 'border-indigo-200/50',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    [NoteType.TASK]: {
      accent: 'blue',
      bgGradient: 'from-blue-50/50 to-blue-100/30',
      border: 'border-blue-200/50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    [NoteType.DECISION]: {
      accent: 'emerald',
      bgGradient: 'from-emerald-50/50 to-emerald-100/30',
      border: 'border-emerald-200/50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    [NoteType.IDEA]: {
      accent: 'amber',
      bgGradient: 'from-amber-50/50 to-amber-100/30',
      border: 'border-amber-200/50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    [NoteType.RISK]: {
      accent: 'rose',
      bgGradient: 'from-rose-50/50 to-rose-100/30',
      border: 'border-rose-200/50',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
    },
  };

  const config = typeConfig[entry.type] || typeConfig[NoteType.NOTE];

  return (
    <motion.div
      id={`entry-${entry.id}`} 
      className={`group bg-white rounded-2xl shadow-sm border ${config.border} hover:shadow-lg transition-all duration-300 overflow-hidden`}
      layout
    >
      {/* Header - Always Visible */}
      <div className={`bg-gradient-to-br ${config.bgGradient} p-5 md:p-6 border-b ${config.border}`}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`${config.iconBg} p-2.5 rounded-xl flex-shrink-0`}>
              {TYPE_ICONS[entry.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${TYPE_STYLES[entry.type]}`}>
                  {TYPE_LABELS[entry.type]}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(entry.createdAt).toLocaleDateString('es-ES', { 
                    day: 'numeric', 
                    month: 'short',
                    year: entry.createdAt > Date.now() - 365 * 24 * 60 * 60 * 1000 ? undefined : 'numeric'
                  })}
                </span>
                {thread && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowThreadManager(true);
                    }}
                    className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1 hover:bg-purple-100 transition-colors group"
                    title="Gestionar hilo"
                  >
                    <ICONS.MessageSquare size={10} />
                    {thread.title}
                    <ICONS.Edit size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ICONS.Book size={12} />
                <span className="truncate">{bookName}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {pendingTasks.length > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                {pendingTasks.length}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1.5 hover:bg-white/60 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
              title={isExpanded ? "Contraer" : "Expandir"}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ICONS.ChevronDown size={18} />
              </motion.div>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-white/60 rounded-lg transition-colors"
              title="Eliminar"
            >
              <ICONS.Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Main Content - Always visible, clean and readable */}
        <div className="space-y-3">
          <p className={`text-base md:text-lg text-gray-900 leading-relaxed font-medium ${!isExpanded && displayText.length > 150 ? 'line-clamp-3' : ''}`}>
            {displayText}
          </p>

          {/* Quick Actions Bar - Only show if there are tasks or entities */}
          {(entry.tasks.length > 0 || entry.entities.length > 0) && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/50">
              {pendingTasks.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600">
                  <ICONS.ListTodo size={14} />
                  <span className="font-semibold">{pendingTasks.length} pendiente{pendingTasks.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {completedTasks.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <ICONS.CheckCircle2 size={14} />
                  <span>{completedTasks.length} completada{completedTasks.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {entry.entities.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {entry.entities.slice(0, 3).map((entity, idx) => (
                    <span key={entity.id || idx} className="text-[10px] font-medium text-slate-600 bg-white/60 px-2 py-0.5 rounded-md">
                      {entity.name}
                    </span>
                  ))}
                  {entry.entities.length > 3 && (
                    <span className="text-[10px] text-slate-400">+{entry.entities.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden bg-gray-50/30"
          >
            <div className="p-5 md:p-6 space-y-4">
              {/* Tasks Section - Prominent if there are tasks */}
              {entry.tasks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-indigo-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                        <ICONS.ListTodo size={14} />
                        Acciones
                      </h4>
                      <span className="text-xs text-indigo-600 font-semibold">
                        {pendingTasks.length} / {entry.tasks.length}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {entry.tasks.map((task, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 transition-colors ${
                          task.isDone 
                            ? 'bg-emerald-50/30' 
                            : 'bg-white hover:bg-indigo-50/30'
                        }`}
                      >
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
                                toggleTask(entry.id, idx);
                              }
                            }}
                            className={`mt-0.5 flex-shrink-0 transition-all duration-200 ${
                              task.isDone 
                                ? 'text-emerald-600' 
                                : 'text-gray-300 hover:text-indigo-600 hover:scale-110'
                            }`}
                            title={task.isDone ? 'Desmarcar' : 'Completar'}
                          >
                            {task.isDone ? (
                              <ICONS.CheckCircle2 size={22} className="fill-emerald-500 text-white" />
                            ) : (
                              <div className="w-5 h-5 border-2 border-current rounded-lg" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm md:text-base font-medium leading-relaxed mb-2 ${
                              task.isDone 
                                ? 'text-emerald-700 line-through' 
                                : 'text-gray-900'
                            }`}>
                              {task.description}
                            </p>
                            
                            {/* Task metadata */}
                            {(task.assignee || task.dueDate || task.priority) && !task.isDone && (
                              <div className="flex flex-wrap items-center gap-2">
                                {task.assignee && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                                    <span>@</span>
                                    {task.assignee}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-md">
                                    <ICONS.Calendar size={12} />
                                    {task.dueDate instanceof Date 
                                      ? task.dueDate.toLocaleDateString('es-ES') 
                                      : task.dueDate}
                                  </span>
                                )}
                                {task.priority && task.priority !== 'MEDIUM' && (
                                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                    task.priority === 'HIGH' 
                                      ? 'bg-rose-100 text-rose-700' 
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {task.priority === 'HIGH' ? 'Alta' : 'Baja'}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Completion notes */}
                            {task.isDone && task.completionNotes && (
                              <div className="mt-3 p-3 bg-white rounded-lg border-l-3 border-emerald-500">
                                <p className="text-xs font-semibold text-emerald-700 mb-1">Observaciones</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{task.completionNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities Section */}
              {entry.entities.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ICONS.Users size={14} />
                    Entidades
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {entry.entities.map((entity, idx) => (
                      <span 
                        key={entity.id || idx} 
                        className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
                      >
                        {entity.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Original Text - Collapsible */}
              {hasOriginalText && (
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOriginalText(!showOriginalText);
                    }}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors w-full"
                  >
                    {showOriginalText ? (
                      <>
                        <ICONS.ChevronUp size={16} />
                        Ocultar texto original
                      </>
                    ) : (
                      <>
                        <ICONS.ChevronDown size={16} />
                        Ver texto original
                      </>
                    )}
                  </button>
                  <AnimatePresence>
                    {showOriginalText && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap italic">
                            {entry.originalText}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Thread Management Section */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700">Hilo de conversación</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowThreadManager(true);
                    }}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1.5 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <ICONS.Edit size={12} />
                    {entry.threadId ? 'Cambiar' : 'Agregar a hilo'}
                  </button>
                </div>
                {thread ? (
                  <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                    <ICONS.MessageSquare size={14} />
                    <span className="font-medium">{thread.title}</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Esta entrada no está en ningún hilo</p>
                )}
              </div>

              {/* Metadata Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <ICONS.Calendar size={12} />
                    {new Date(entry.createdAt).toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {hasOriginalText && (
                  <span className="text-gray-400 text-[10px]">Texto procesado por IA</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={confirmTask.isOpen}
        onClose={() => setConfirmTask({ isOpen: false, taskIndex: -1, description: '' })}
        onConfirm={handleConfirmTaskComplete}
        title="¿Completar tarea?"
        message={`¿Marcar como completada: "${confirmTask.description}"?`}
        confirmText="✓ Completar"
        cancelText="Cancelar"
        variant="success"
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar entrada?"
        message="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Thread Manager Modal */}
      <ThreadManagerModal
        isOpen={showThreadManager}
        onClose={() => setShowThreadManager(false)}
        entryId={entry.id}
        currentThreadId={entry.threadId}
        bookId={entry.bookId}
      />
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.entry.id === nextProps.entry.id 
    && prevProps.entry.status === nextProps.entry.status
    && prevProps.entry.summary === nextProps.entry.summary
    && prevProps.entry.tasks.length === nextProps.entry.tasks.length
    && prevProps.entry.tasks.every((t, i) => t.isDone === nextProps.entry.tasks[i]?.isDone)
    && prevProps.compact === nextProps.compact;
});

export default EntryCard;
