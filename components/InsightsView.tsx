import React, { useState, useMemo } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { ICONS, TYPE_LABELS } from '../constants';
import { NoteType, EntityType } from '../types';
import { motion } from 'framer-motion';

type Period = 'day' | 'week' | 'month';

const InsightsView: React.FC = () => {
  const { entries, books } = useBitacora();
  const [period, setPeriod] = useState<Period>('week');

  // Calculate period start
  const periodStart = useMemo(() => {
    const now = Date.now();
    const ms = period === 'day' ? 24 * 60 * 60 * 1000 
             : period === 'week' ? 7 * 24 * 60 * 60 * 1000 
             : 30 * 24 * 60 * 60 * 1000;
    return now - ms;
  }, [period]);

  // Filter entries by period
  const periodEntries = useMemo(() => 
    entries.filter(e => e.createdAt >= periodStart),
    [entries, periodStart]
  );

  // Statistics
  const stats = useMemo(() => {
    const byType = new Map<NoteType, number>();
    const byDay = new Map<string, number>();
    const people = new Map<string, number>();
    const topics = new Map<string, number>();
    const projects = new Map<string, number>();

    periodEntries.forEach(entry => {
      // By type
      byType.set(entry.type, (byType.get(entry.type) || 0) + 1);

      // By day
      const day = new Date(entry.createdAt).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short' 
      });
      byDay.set(day, (byDay.get(day) || 0) + 1);

      // Entities
      entry.entities.forEach(entity => {
        if (entity.type === EntityType.PERSON) {
          people.set(entity.name, (people.get(entity.name) || 0) + 1);
        } else if (entity.type === EntityType.TOPIC) {
          topics.set(entity.name, (topics.get(entity.name) || 0) + 1);
        } else if (entity.type === EntityType.PROJECT) {
          projects.set(entity.name, (projects.get(entity.name) || 0) + 1);
        }
      });
    });

    return {
      byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]),
      byDay: Array.from(byDay.entries()).sort((a, b) => 
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
      ),
      topPeople: Array.from(people.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      topTopics: Array.from(topics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      topProjects: Array.from(projects.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      totalEntries: periodEntries.length,
      totalTasks: periodEntries.reduce((sum, e) => sum + e.tasks.length, 0),
      completedTasks: periodEntries.reduce((sum, e) => 
        sum + e.tasks.filter(t => t.isDone).length, 0
      ),
    };
  }, [periodEntries]);

  const maxDayCount = Math.max(...stats.byDay.map(([, count]) => count), 1);
  const maxTypeCount = Math.max(...stats.byType.map(([, count]) => count), 1);

  return (
    <div className="max-w-6xl mx-auto pb-24 md:pb-8 min-h-screen">
      <div className="mb-6 md:mb-8 mt-4 md:mt-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 flex items-center gap-2 md:gap-3 mb-2">
          <div className="bg-indigo-100 p-1.5 md:p-2 rounded-xl text-indigo-600">
            <ICONS.BarChart3 size={20} className="md:w-7 md:h-7" />
          </div>
          Insights y Tendencias
        </h2>
        <div className="flex items-center gap-4 mt-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-sm"
          >
            <option value="day">Último día</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
          </select>
          <p className="text-sm text-gray-500">
            {stats.totalEntries} notas • {stats.totalTasks} tareas ({stats.completedTasks} completadas)
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <ICONS.StickyNote className="text-indigo-600" size={20} />
            </div>
            <h3 className="font-bold text-gray-900">Notas</h3>
          </div>
          <p className="text-3xl font-extrabold text-indigo-600">{stats.totalEntries}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <ICONS.ListTodo className="text-blue-600" size={20} />
            </div>
            <h3 className="font-bold text-gray-900">Tareas</h3>
          </div>
          <p className="text-3xl font-extrabold text-blue-600">{stats.totalTasks}</p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.completedTasks} completadas ({stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <ICONS.Book className="text-purple-600" size={20} />
            </div>
            <h3 className="font-bold text-gray-900">Libretas</h3>
          </div>
          <p className="text-3xl font-extrabold text-purple-600">{books.length}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entries by Type */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Notas por Tipo</h3>
          <div className="space-y-3">
            {stats.byType.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{TYPE_LABELS[type]}</span>
                    <span className="text-sm text-gray-500">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Entries by Day */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Actividad por Día</h3>
          <div className="space-y-2">
            {stats.byDay.map(([day, count]) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">{day}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${(count / maxDayCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top People */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ICONS.Users size={18} />
            Personas Más Mencionadas
          </h3>
          <div className="space-y-2">
            {stats.topPeople.length === 0 ? (
              <p className="text-sm text-gray-400">No hay personas mencionadas</p>
            ) : (
              stats.topPeople.map(([name, count], index) => (
                <div key={name} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-6">{index + 1}</span>
                    <span className="text-sm text-gray-700">{name}</span>
                  </div>
                  <span className="text-sm font-bold text-indigo-600">{count}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Top Topics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ICONS.Book size={18} />
            Temas Más Frecuentes
          </h3>
          <div className="space-y-2">
            {stats.topTopics.length === 0 ? (
              <p className="text-sm text-gray-400">No hay temas identificados</p>
            ) : (
              stats.topTopics.map(([topic, count], index) => (
                <div key={topic} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-6">{index + 1}</span>
                    <span className="text-sm text-gray-700">{topic}</span>
                  </div>
                  <span className="text-sm font-bold text-purple-600">{count}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InsightsView;

