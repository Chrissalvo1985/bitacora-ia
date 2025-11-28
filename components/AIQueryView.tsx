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
      <div className="mb-4 md:mb-8 mt-2 md:mt-4">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <div className="bg-gradient-to-tr from-violet-600 to-purple-600 p-1.5 md:p-2 rounded-xl text-white">
            <ICONS.Sparkles size={20} className="md:w-7 md:h-7" />
          </div>
          Pregúntale a tu Bitácora
        </h2>
        <p className="text-sm md:text-base text-gray-500 ml-1">Haz preguntas en lenguaje natural sobre tu trabajo. Tu IA personal te responde 🧠✨</p>
      </div>

      {/* Query Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl md:rounded-3xl shadow-lg border border-gray-100 p-3 md:p-4 lg:p-6 mb-4 md:mb-6"
      >
        <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="flex-1 relative">
            <ICONS.Sparkles className="absolute left-3 md:left-4 top-3 md:top-4 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ej: ¿Qué cosas pendientes tengo con Romina? 🤔"
              className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all resize-none min-h-[80px] md:min-h-[100px] text-sm md:text-base"
              rows={3}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <button
            onClick={handleQuery}
            disabled={isQuerying || !query.trim()}
            className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl md:rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 md:gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
          >
            {isQuerying ? (
              <>
                <ICONS.Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" />
                Pensando... 🧠
              </>
            ) : (
              <>
                <ICONS.Send className="w-4 h-4 md:w-5 md:h-5" />
                Preguntar
              </>
            )}
          </button>
          <span className="text-xs text-gray-400 self-end sm:self-center">Presiona Enter para enviar</span>
        </div>
      </motion.div>

      {/* Response */}
      <AnimatePresence mode="wait">
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl md:rounded-3xl shadow-lg border border-violet-100 p-4 md:p-6 lg:p-8 mb-4 md:mb-6"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="bg-white p-1.5 md:p-2 rounded-xl">
                <ICONS.Sparkles className="text-violet-600 w-4 h-4 md:w-6 md:h-6" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-gray-900">Respuesta 💡</h3>
            </div>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line">{response}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIQueryView;

