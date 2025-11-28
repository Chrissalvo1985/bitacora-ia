import React, { memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '../constants';
import { DocumentInsight } from '../services/documentAnalysisService';

interface DocumentInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  insights: DocumentInsight[];
  onAction: (insight: DocumentInsight) => void;
  fileName: string;
}

const DocumentInsightsModal: React.FC<DocumentInsightsModalProps> = memo(({
  isOpen,
  onClose,
  insights,
  onAction,
  fileName,
}) => {
  const getInsightIcon = useCallback((type: string) => {
    switch (type) {
      case 'task':
        return <ICONS.ListTodo size={20} className="text-blue-600" />;
      case 'risk':
        return <ICONS.AlertOctagon size={20} className="text-rose-600" />;
      case 'duplicate':
        return <ICONS.X size={20} className="text-amber-600" />;
      case 'deadline':
        return <ICONS.AlertOctagon size={20} className="text-orange-600" />;
      case 'related':
        return <ICONS.Sparkles size={20} className="text-indigo-600" />;
      case 'update':
        return <ICONS.CheckCircle2 size={20} className="text-emerald-600" />;
      default:
        return <ICONS.StickyNote size={20} className="text-gray-600" />;
    }
  }, []);

  const getInsightColor = useCallback((type: string) => {
    switch (type) {
      case 'task':
        return 'bg-blue-50 border-blue-200';
      case 'risk':
        return 'bg-rose-50 border-rose-200';
      case 'duplicate':
        return 'bg-amber-50 border-amber-200';
      case 'deadline':
        return 'bg-orange-50 border-orange-200';
      case 'related':
        return 'bg-indigo-50 border-indigo-200';
      case 'update':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  }, []);

  const getActionLabel = useCallback((insight: DocumentInsight) => {
    if (!insight.action) return null;
    
    switch (insight.action.type) {
      case 'create_task':
        return 'Crear tarea';
      case 'update_task':
        return 'Actualizar tarea';
      case 'create_entry':
        return 'Crear entrada';
      case 'update_entry':
        return 'Actualizar entrada';
      case 'link_entry':
        return 'Vincular entrada';
      default:
        return 'Aplicar';
    }
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl">
                    <ICONS.Sparkles className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Análisis del Documento</h3>
                    <p className="text-sm text-gray-500">{fileName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <ICONS.X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {insights.length === 0 ? (
                  <div className="text-center py-12">
                    <ICONS.CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={48} />
                    <p className="text-gray-600 font-medium">No se encontraron acciones pendientes</p>
                    <p className="text-sm text-gray-400 mt-2">El documento se guardará como referencia</p>
                  </div>
                ) : (
                  insights.map((insight, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`p-4 rounded-2xl border-2 ${getInsightColor(insight.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getInsightIcon(insight.type)}</div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">{insight.title}</h4>
                          <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
                          
                          {insight.relatedEntries && insight.relatedEntries.length > 0 && (
                            <div className="mb-3 p-2 bg-white/50 rounded-lg">
                              <p className="text-xs font-semibold text-gray-600 mb-1">Relacionado con:</p>
                              {insight.relatedEntries.map((entry, eIdx) => (
                                <p key={eIdx} className="text-xs text-gray-600">
                                  • {entry.summary} ({entry.bookName})
                                </p>
                              ))}
                            </div>
                          )}

                          {insight.action && (
                            <button
                              onClick={() => onAction(insight)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
                            >
                              {getActionLabel(insight)}
                            </button>
                          )}
                        </div>
                        {insight.priority && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            insight.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                            insight.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {insight.priority}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

DocumentInsightsModal.displayName = 'DocumentInsightsModal';

export default DocumentInsightsModal;

