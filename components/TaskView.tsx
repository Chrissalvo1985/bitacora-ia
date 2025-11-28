import React, { useState, useEffect, useMemo } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { ICONS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

const ITEMS_PER_PAGE = 20;
const ITEMS_PER_PAGE_MOBILE = 10;

const TaskView: React.FC = () => {
  const { entries, getBookName, toggleTask, updateTaskFields } = useBitacora();
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'book'>('date');
  const [editingTask, setEditingTask] = useState<{ entryId: string; taskIndex: number; field: 'assignee' | 'dueDate' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  const toggleTaskExpand = (taskKey: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskKey)) {
        newSet.delete(taskKey);
      } else {
        newSet.add(taskKey);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Flatten entries to tasks
  const allTasks = useMemo(() => {
    const tasks = entries.flatMap(entry => 
      entry.tasks.map((task, idx) => ({
        ...task,
        entryId: entry.id,
        taskIndex: idx,
        bookName: getBookName(entry.bookId),
        entrySummary: entry.summary,
        entryCreatedAt: entry.createdAt
      }))
    ).filter(t => !t.isDone); // Only show pending

    // Sort tasks
    return tasks.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (priorityOrder[b.priority || 'LOW'] || 0) - (priorityOrder[a.priority || 'LOW'] || 0);
      }
      if (sortBy === 'book') {
        return a.bookName.localeCompare(b.bookName);
      }
      return (b.entryCreatedAt || 0) - (a.entryCreatedAt || 0);
    });
  }, [entries, getBookName, sortBy]);

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  const paginatedTasks = allTasks.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedTasks.length < allTasks.length;

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleStartEdit = (entryId: string, taskIndex: number, field: 'assignee' | 'dueDate', currentValue?: string) => {
    setEditingTask({ entryId, taskIndex, field });
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    
    const updates: any = {};
    if (editingTask.field === 'assignee') {
      updates.assignee = editValue.trim() || undefined;
    } else if (editingTask.field === 'dueDate') {
      // Convert date string to ISO format if provided
      updates.dueDate = editValue ? editValue : undefined;
    }
    
    await updateTaskFields(editingTask.entryId, editingTask.taskIndex, updates);
    setEditingTask(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditValue('');
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8">
      <div className="mb-6 mt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                    <ICONS.ListTodo size={28} />
                </div>
                Central de Misiones
              </h2>
              <p className="text-gray-500 mt-2 ml-1">Todo lo que tienes pendiente para conquistar el mundo.</p>
            </div>
            {allTasks.length > 5 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as 'date' | 'priority' | 'book');
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-sm bg-white"
                >
                  <option value="date">Más recientes</option>
                  <option value="priority">Prioridad</option>
                  <option value="book">Por libreta</option>
                </select>
              </div>
            )}
          </div>
          
          {allTasks.length > 0 && (
            <div className="text-sm text-gray-500 mb-4 px-1">
              {allTasks.length} {allTasks.length === 1 ? 'misión pendiente' : 'misiones pendientes'}
            </div>
          )}
      </div>

      {allTasks.length === 0 ? (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-10 text-center border border-emerald-100">
          <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-emerald-500">
              <ICONS.CheckCircle2 size={32} />
          </div>
          <p className="font-bold text-xl text-emerald-800 mb-1">¡Estás al día!</p>
          <p className="text-emerald-600 opacity-80">No hay misiones pendientes. Tómate un café. ☕️</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:space-y-4">
            {paginatedTasks.map((task, i) => {
              // Group by priority for visual separation
              const prevTask = i > 0 ? paginatedTasks[i - 1] : null;
              const showPriorityHeader = sortBy === 'priority' && prevTask && prevTask.priority !== task.priority;
              
              return (
                <React.Fragment key={`${task.entryId}-${task.taskIndex}`}>
                  {showPriorityHeader && (
                    <div className="sticky top-16 z-10 bg-[#f8fafc] py-2 -mt-1 mb-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg border ${
                          task.priority === 'HIGH' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          task.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {task.priority === 'HIGH' ? '🔴 Alta' : task.priority === 'MEDIUM' ? '🟡 Media' : '⚪ Baja'}
                        </span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>
                    </div>
                  )}
                  
                  {(() => {
                    const taskKey = `${task.entryId}-${task.taskIndex}`;
                    const isExpanded = expandedTasks.has(taskKey);
                    
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.01 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-hidden"
                      >
                        {/* Compact Header */}
                        <div 
                          className="p-5 md:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleTaskExpand(taskKey)}
                        >
                          <div className="flex items-start gap-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTask(task.entryId, task.taskIndex);
                              }}
                              className="mt-1 text-gray-300 hover:text-indigo-500 transition-all hover:scale-110 flex-shrink-0"
                            >
                              <div className="w-6 h-6 border-2 border-current rounded-lg" />
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <p className={`text-base md:text-lg text-gray-800 font-semibold leading-relaxed flex-1 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                  {task.description}
                                </p>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {task.priority === 'HIGH' && (
                                    <span className="text-xs uppercase font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                                      Alta
                                    </span>
                                  )}
                                  {task.priority === 'MEDIUM' && (
                                    <span className="text-xs uppercase font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                      Media
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTaskExpand(taskKey);
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
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                <span className="text-sm uppercase font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center gap-2">
                                  <ICONS.Book size={14} />
                                  {task.bookName}
                                </span>
                                
                                {/* Editable Assignee */}
                                {editingTask?.entryId === task.entryId && editingTask?.taskIndex === task.taskIndex && editingTask.field === 'assignee' ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleSaveEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit();
                                        if (e.key === 'Escape') handleCancelEdit();
                                      }}
                                      placeholder="Responsable..."
                                      className="text-sm font-semibold bg-white text-indigo-600 px-3 py-1.5 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none min-w-[120px]"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(task.entryId, task.taskIndex, 'assignee', task.assignee);
                                    }}
                                    className="flex items-center gap-1.5 text-sm font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
                                  >
                                    <span className="text-indigo-500">@</span>
                                    {task.assignee || 'Asignar'}
                                  </button>
                                )}
                                
                                {/* Editable Due Date */}
                                {editingTask?.entryId === task.entryId && editingTask?.taskIndex === task.taskIndex && editingTask.field === 'dueDate' ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="date"
                                      value={editValue || ''}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleSaveEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit();
                                        if (e.key === 'Escape') handleCancelEdit();
                                      }}
                                      className="text-sm font-semibold bg-white text-orange-600 px-3 py-1.5 rounded-lg border-2 border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      let currentDate = '';
                                      if (task.dueDate) {
                                        if (task.dueDate instanceof Date) {
                                          currentDate = task.dueDate.toISOString().split('T')[0];
                                        } else if (typeof task.dueDate === 'string') {
                                          try {
                                            const date = new Date(task.dueDate);
                                            if (!isNaN(date.getTime())) {
                                              currentDate = date.toISOString().split('T')[0];
                                            } else {
                                              currentDate = task.dueDate;
                                            }
                                          } catch {
                                            currentDate = task.dueDate;
                                          }
                                        }
                                      }
                                      handleStartEdit(task.entryId, task.taskIndex, 'dueDate', currentDate);
                                    }}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 hover:bg-orange-100 hover:border-orange-200 transition-colors"
                                  >
                                    📅 {task.dueDate 
                                      ? (task.dueDate instanceof Date 
                                          ? task.dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                          : typeof task.dueDate === 'string'
                                          ? (() => {
                                              try {
                                                const date = new Date(task.dueDate);
                                                return !isNaN(date.getTime()) 
                                                  ? date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                                  : task.dueDate;
                                              } catch {
                                                return task.dueDate;
                                              }
                                            })()
                                          : task.dueDate)
                                      : 'Sin fecha'}
                                  </button>
                                )}
                              </div>
                              
                              {!isExpanded && (
                                <p className="text-sm text-gray-400 line-clamp-1 italic pl-3 border-l-3 border-gray-200">
                                  "{task.entrySummary}"
                                </p>
                              )}
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
                              className="overflow-hidden border-t border-gray-50"
                            >
                              <div className="px-5 md:px-6 pb-5 md:pb-6 pt-4 space-y-4">
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Contexto</p>
                                  <p className="text-base text-gray-700 leading-relaxed">
                                    {task.entrySummary}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <ICONS.Calendar size={16} />
                                  <span>
                                    Creada: {new Date(task.entryCreatedAt || 0).toLocaleDateString('es-ES', { 
                                      day: 'numeric', 
                                      month: 'long', 
                                      year: 'numeric' 
                                    })}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </div>
          
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
              >
                Cargar más ({allTasks.length - paginatedTasks.length} restantes)
              </button>
            </div>
          )}
          
          {!hasMore && allTasks.length > itemsPerPage && (
            <div className="mt-6 text-center text-sm text-gray-400">
              Mostrando todas las {allTasks.length} {allTasks.length === 1 ? 'misión' : 'misiones'}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaskView;