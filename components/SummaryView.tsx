import React, { useState, useEffect } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { ICONS } from '../constants';
import { WeeklySummary } from '../types';
import { motion } from 'framer-motion';
import EntryCard from './EntryCard';

const SummaryView: React.FC = () => {
  const { entries, generateWeeklySummary } = useBitacora();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadSummary = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateWeeklySummary(period);
      setSummary(generated);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const periodLabels = {
    day: 'Hoy',
    week: 'Esta Semana',
    month: 'Este Mes',
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8">
      <div className="mb-8 mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl text-white">
              <ICONS.Sparkles size={28} />
            </div>
            Resumen Ejecutivo
          </h2>
          
          <div className="flex gap-2 bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
            {(['day', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  period === p
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-gray-500 ml-1">Genera un resumen inteligente de tu trabajo cuando lo necesites.</p>
      </div>

      {!summary && !isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center"
        >
          <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ICONS.Sparkles className="text-indigo-600" size={40} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Genera tu resumen</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Selecciona el período y haz click en el botón para generar un resumen ejecutivo de tu trabajo.
          </p>
          <button
            onClick={loadSummary}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all transform hover:-translate-y-1 flex items-center gap-3 mx-auto"
          >
            <ICONS.Sparkles size={24} />
            Generar Resumen
          </button>
        </motion.div>
      )}

      {isGenerating ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center"
        >
          <ICONS.Loader2 className="animate-spin mx-auto text-indigo-600 mb-4" size={48} />
          <p className="text-gray-600 font-medium">Generando resumen inteligente...</p>
        </motion.div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Main Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl shadow-lg border border-indigo-100 p-6 md:p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white p-2 rounded-xl">
                <ICONS.Sparkles className="text-indigo-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Resumen de {periodLabels[period]}</h3>
            </div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{summary.summary}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Generado el {new Date(summary.generatedAt).toLocaleString('es-ES')}
              </div>
              <button
                onClick={loadSummary}
                disabled={isGenerating}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-indigo-600 rounded-xl text-sm font-semibold transition-colors border border-indigo-200 disabled:opacity-50"
              >
                {isGenerating ? 'Regenerando...' : '🔄 Regenerar'}
              </button>
            </div>
          </motion.div>

          {/* Top Decisions */}
          {summary.topDecisions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ICONS.Gavel size={20} className="text-emerald-600" />
                Decisiones Clave ({summary.topDecisions.length})
              </h3>
              <div className="space-y-4">
                {summary.topDecisions.map(entry => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Top Tasks */}
          {summary.topTasks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ICONS.ListTodo size={20} className="text-blue-600" />
                Pendientes Críticos ({summary.topTasks.length})
              </h3>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {summary.topTasks.map((task, idx) => (
                  <div key={idx} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-lg mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-gray-800 font-semibold">{task.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          {task.assignee && (
                            <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                              @{task.assignee}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                              📅 {task.dueDate instanceof Date ? task.dueDate.toLocaleDateString('es-ES') : task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default SummaryView;

