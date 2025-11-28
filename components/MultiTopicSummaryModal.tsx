import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS, TYPE_STYLES, TYPE_LABELS, TYPE_ICONS } from '../constants';
import { NoteType, TaskItem } from '../types';

interface TopicSummary {
  bookName: string;
  bookId: string;
  type: NoteType;
  summary: string;
  tasks: TaskItem[];
  entities: { name: string; type: string }[];
  isNewBook: boolean;
  entryId: string;
  taskActions: Array<{
    action: 'complete' | 'update';
    taskDescription: string;
    completionNotes?: string;
  }>;
}

interface MultiTopicSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMultiTopic: boolean;
  topics: TopicSummary[];
  overallContext: string;
  completedTasks: number;
}

const MultiTopicSummaryModal: React.FC<MultiTopicSummaryModalProps> = memo(({
  isOpen,
  onClose,
  isMultiTopic,
  topics,
  overallContext,
  completedTasks
}) => {
  if (!isOpen) return null;

  const newBooksCount = topics.filter(t => t.isNewBook).length;
  const totalTasks = topics.reduce((acc, t) => acc + t.tasks.length, 0);

  return (
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

          {/* Modal - Bottom sheet on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-white rounded-t-3xl md:rounded-3xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
                        <ICONS.CheckCircle2 size={20} className="md:w-6 md:h-6" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-base md:text-xl font-bold">
                        {isMultiTopic ? '¡Múltiples temas detectados!' : '✅ Entrada procesada'}
                      </h2>
                      <p className="text-xs md:text-sm text-white/80">
                        {isMultiTopic 
                          ? `Distribuido en ${topics.length} libretas` 
                          : `Guardado en ${topics[0]?.bookName || 'tu libreta'}`
                        }
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
                    {topics.length} {topics.length === 1 ? 'libreta' : 'libretas'}
                  </div>
                  {newBooksCount > 0 && (
                    <div className="bg-emerald-400/30 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5">
                      <ICONS.Plus size={12} className="md:w-3.5 md:h-3.5" />
                      {newBooksCount} nueva{newBooksCount > 1 ? 's' : ''}
                    </div>
                  )}
                  {totalTasks > 0 && (
                    <div className="bg-amber-400/30 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5">
                      <ICONS.ListTodo size={12} className="md:w-3.5 md:h-3.5" />
                      {totalTasks} tarea{totalTasks > 1 ? 's' : ''}
                    </div>
                  )}
                  {completedTasks > 0 && (
                    <div className="bg-green-400/30 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5">
                      <ICONS.CheckCircle size={12} className="md:w-3.5 md:h-3.5" />
                      {completedTasks} completada{completedTasks > 1 ? 's' : ''}
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

              {/* Topics */}
              <div className="space-y-2 md:space-y-3">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
                  Distribución por libreta
                </p>
                
                {topics.map((topic, idx) => (
                  <motion.div
                    key={topic.entryId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-xl md:rounded-2xl border border-gray-200 overflow-hidden"
                  >
                    {/* Topic Header */}
                    <div className="p-3 md:p-4 border-b border-gray-100">
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
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg text-[10px] md:text-xs font-bold border flex items-center gap-1 flex-shrink-0 ${TYPE_STYLES[topic.type]}`}>
                          {TYPE_ICONS[topic.type]}
                          <span className="hidden sm:inline">{TYPE_LABELS[topic.type]}</span>
                        </span>
                      </div>
                    </div>

                    {/* Topic Content */}
                    <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                      <p className="text-xs md:text-sm text-gray-700 leading-relaxed line-clamp-3 md:line-clamp-none">
                        {topic.summary}
                      </p>

                      {/* Tasks */}
                      {topic.tasks.length > 0 && (
                        <div className="space-y-1.5 md:space-y-2">
                          <p className="text-[10px] md:text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                            Tareas creadas:
                          </p>
                          {topic.tasks.slice(0, 3).map((task, taskIdx) => (
                            <div key={taskIdx} className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm">
                              <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-gray-300 rounded mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700 line-clamp-1">{task.description}</span>
                              {task.priority === 'HIGH' && (
                                <span className="text-[9px] md:text-[10px] font-bold text-rose-600 bg-rose-50 px-1 md:px-1.5 py-0.5 rounded flex-shrink-0">
                                  Alta
                                </span>
                              )}
                            </div>
                          ))}
                          {topic.tasks.length > 3 && (
                            <p className="text-[10px] text-gray-400 pl-5">+{topic.tasks.length - 3} más</p>
                          )}
                        </div>
                      )}

                      {/* Completed tasks */}
                      {topic.taskActions.filter(a => a.action === 'complete').length > 0 && (
                        <div className="space-y-1.5 md:space-y-2">
                          <p className="text-[10px] md:text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                            Tareas completadas:
                          </p>
                          {topic.taskActions.filter(a => a.action === 'complete').slice(0, 2).map((action, actionIdx) => (
                            <div key={actionIdx} className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm">
                              <ICONS.CheckCircle2 size={14} className="md:w-4 md:h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-emerald-700 line-through line-clamp-1">{action.taskDescription}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Entities */}
                      {topic.entities.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 md:pt-2">
                          {topic.entities.slice(0, 3).map((entity, entityIdx) => (
                            <span key={entityIdx} className="text-[10px] md:text-xs font-medium text-slate-500 bg-slate-100 px-1.5 md:px-2 py-0.5 rounded">
                              #{entity.name}
                            </span>
                          ))}
                          {topic.entities.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{topic.entities.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 md:p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={onClose}
                className="w-full py-2.5 md:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm md:text-base hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg active:scale-[0.98]"
              >
                ¡Entendido! 🚀
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

MultiTopicSummaryModal.displayName = 'MultiTopicSummaryModal';

export default MultiTopicSummaryModal;

