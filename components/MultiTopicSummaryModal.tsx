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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[85vh] bg-white rounded-3xl shadow-2xl z-[100] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2.5 rounded-xl">
                      {isMultiTopic ? (
                        <ICONS.Grid3x3 size={24} />
                      ) : (
                        <ICONS.CheckCircle2 size={24} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {isMultiTopic ? '¡Múltiples temas detectados!' : '✅ Entrada procesada'}
                      </h2>
                      <p className="text-sm text-white/80">
                        {isMultiTopic 
                          ? `Distribuido en ${topics.length} libretas` 
                          : `Guardado en ${topics[0]?.bookName || 'tu libreta'}`
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <ICONS.X size={24} />
                  </button>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                    <ICONS.Book size={14} />
                    {topics.length} {topics.length === 1 ? 'libreta' : 'libretas'}
                  </div>
                  {newBooksCount > 0 && (
                    <div className="bg-emerald-400/30 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                      <ICONS.Plus size={14} />
                      {newBooksCount} {newBooksCount === 1 ? 'nueva' : 'nuevas'}
                    </div>
                  )}
                  {totalTasks > 0 && (
                    <div className="bg-amber-400/30 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                      <ICONS.ListTodo size={14} />
                      {totalTasks} {totalTasks === 1 ? 'tarea' : 'tareas'}
                    </div>
                  )}
                  {completedTasks > 0 && (
                    <div className="bg-green-400/30 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                      <ICONS.CheckCircle size={14} />
                      {completedTasks} completadas
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Overall context */}
              {overallContext && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Contexto general
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {overallContext}
                  </p>
                </div>
              )}

              {/* Topics */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
                  Distribución por libreta
                </p>
                
                {topics.map((topic, idx) => (
                  <motion.div
                    key={topic.entryId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Topic Header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${topic.isNewBook ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
                            <ICONS.Book size={18} className={topic.isNewBook ? 'text-emerald-600' : 'text-indigo-600'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900">{topic.bookName}</h3>
                              {topic.isNewBook && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                  NUEVA
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${TYPE_STYLES[topic.type]}`}>
                          {TYPE_ICONS[topic.type]}
                          {TYPE_LABELS[topic.type]}
                        </span>
                      </div>
                    </div>

                    {/* Topic Content */}
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {topic.summary}
                      </p>

                      {/* Tasks */}
                      {topic.tasks.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                            Tareas creadas:
                          </p>
                          {topic.tasks.map((task, taskIdx) => (
                            <div key={taskIdx} className="flex items-start gap-2 text-sm">
                              <div className="w-4 h-4 border-2 border-gray-300 rounded mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">{task.description}</span>
                              {task.priority === 'HIGH' && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  Alta
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Completed tasks */}
                      {topic.taskActions.filter(a => a.action === 'complete').length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                            Tareas completadas:
                          </p>
                          {topic.taskActions.filter(a => a.action === 'complete').map((action, actionIdx) => (
                            <div key={actionIdx} className="flex items-start gap-2 text-sm">
                              <ICONS.CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-emerald-700 line-through">{action.taskDescription}</span>
                                {action.completionNotes && (
                                  <p className="text-xs text-gray-500 mt-0.5 italic">
                                    "{action.completionNotes}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Entities */}
                      {topic.entities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {topic.entities.map((entity, entityIdx) => (
                            <span key={entityIdx} className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              #{entity.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
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

