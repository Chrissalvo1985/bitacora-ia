import React, { useState } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import { ICONS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

const AIQueryView: React.FC = () => {
  const { queryAI } = useBitacora();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const handleQuery = async () => {
    if (!query.trim()) return;

    const currentQuery = query.trim();
    setIsQuerying(true);
    setResponse(null); // Limpiar respuesta anterior mientras se procesa
    
    try {
      const answer = await queryAI(currentQuery);
      setResponse(answer);
    } catch (error) {
      console.error('Query error:', error);
      setResponse('Error al procesar la consulta. Intenta de nuevo.');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8">
      <div className="mb-8 mt-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-tr from-violet-600 to-purple-600 p-2 rounded-xl text-white">
            <ICONS.Sparkles size={28} />
          </div>
          Pregúntale a tu Bitácora
        </h2>
        <p className="text-gray-500 ml-1">Haz preguntas en lenguaje natural sobre tu trabajo.</p>
      </div>

      {/* Query Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 md:p-6 mb-6"
      >
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <ICONS.Sparkles className="absolute left-4 top-4 text-gray-400" size={20} />
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ej: ¿Qué cosas pendientes tengo con Romina?"
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all resize-none min-h-[100px]"
              rows={3}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={handleQuery}
            disabled={isQuerying || !query.trim()}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isQuerying ? (
              <>
                <ICONS.Loader2 className="animate-spin" size={20} />
                Pensando...
              </>
            ) : (
              <>
                <ICONS.Send size={20} />
                Preguntar
              </>
            )}
          </button>
          <span className="text-xs text-gray-400">Presiona Enter para enviar</span>
        </div>
      </motion.div>

      {/* Response */}
      <AnimatePresence mode="wait">
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl shadow-lg border border-violet-100 p-6 md:p-8 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white p-2 rounded-xl">
                <ICONS.Sparkles className="text-violet-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Respuesta</h3>
            </div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{response}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIQueryView;

