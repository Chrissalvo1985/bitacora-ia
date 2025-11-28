import React, { useState, memo, useCallback } from 'react';
import { Entry, EntryStatus, NoteType } from '../types';
import { ICONS, TYPE_STYLES, TYPE_ICONS, TYPE_LABELS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { motion, AnimatePresence } from 'framer-motion';

const EntryCard: React.FC<{ entry: Entry; compact?: boolean }> = memo(({ entry, compact = false }) => {
  const { toggleTask, deleteEntry, getBookName } = useBitacora();
  const bookName = getBookName(entry.bookId);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Auto-expand if it has tasks or attachment
  const hasDetails = entry.tasks.length > 0 || entry.attachment || entry.entities.length > 0;

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

  return (
    <motion.div 
      className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-hidden"
      layout
    >
      {/* Compact Header - Always Visible */}
      <div 
        className={`p-5 md:p-6 cursor-pointer ${hasDetails ? 'hover:bg-gray-50' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
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
            
            <p className={`text-base md:text-lg text-gray-800 leading-relaxed ${!isExpanded ? 'line-clamp-2' : 'line-clamp-3'}`}>
              {summaryPreview}
            </p>
            
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
            {hasDetails && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ICONS.ChevronRight size={20} />
                </motion.div>
              </button>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                deleteEntry(entry.id);
              }}
              className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <ICONS.X size={18} />
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
            <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-gray-50 space-y-4 pt-5">
              {/* Full Summary - Only show if summary is longer than preview */}
              {entry.summary.length > 120 && (
                <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                  {entry.summary}
                </p>
              )}

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
                                toggleTask(entry.id, idx);
                              }}
                              className={`mt-0.5 flex-shrink-0 transition-all duration-200 ${task.isDone ? 'text-emerald-600' : 'text-gray-300 hover:text-indigo-500 hover:scale-110'}`}
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