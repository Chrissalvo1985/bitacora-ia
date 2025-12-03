import React, { memo, useMemo } from 'react';
import { useBitacora } from '../context/BitacoraContext';
import EntryCard from './EntryCard';
import { ICONS } from '../constants';
import { motion } from 'framer-motion';
import CaptureInput from './CaptureInput';

interface ThreadViewProps {
  threadId: string;
}

const ThreadView: React.FC<ThreadViewProps> = memo(({ threadId }) => {
  const { threads, getEntriesByThreadId, getBookName } = useBitacora();
  const thread = threads.find(t => t.id === threadId);
  const threadEntries = useMemo(() => {
    return getEntriesByThreadId(threadId).sort((a, b) => a.createdAt - b.createdAt);
  }, [threadId, getEntriesByThreadId]);

  if (!thread) {
    return (
      <div className="max-w-4xl mx-auto pb-24 md:pb-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-xl font-bold text-gray-800 mb-2">Hilo no encontrado</p>
          <p className="text-sm text-gray-500">Este hilo parece haberse perdido... 🧵</p>
        </div>
      </div>
    );
  }

  const bookName = getBookName(thread.bookId);

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col pb-28 md:pb-8">
      {/* Header */}
      <div className="mb-6 mt-2">
        <div className="flex items-center gap-2 text-base text-gray-400 mb-3 font-medium">
          <span>Biblioteca</span>
          <ICONS.ChevronRight size={16} />
          <span className="text-indigo-600 truncate max-w-[200px]">{bookName}</span>
          <ICONS.ChevronRight size={16} />
          <span className="text-purple-600 truncate max-w-[200px]">Hilo</span>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200 mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-purple-100 p-3 rounded-xl">
              <ICONS.MessageSquare size={24} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{thread.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <ICONS.Book size={14} />
                  {bookName}
                </span>
                <span className="flex items-center gap-1.5">
                  <ICONS.MessageSquare size={14} />
                  {threadEntries.length} {threadEntries.length === 1 ? 'entrada' : 'entradas'}
                </span>
                <span className="flex items-center gap-1.5">
                  <ICONS.Calendar size={14} />
                  {new Date(thread.createdAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input for adding new entry to thread */}
      <div className="mb-6 md:mb-8 sticky top-0 z-30 pt-1 bg-[#f8fafc]/90 backdrop-blur-sm pb-2">
        <CaptureInput bookId={thread.bookId} />
      </div>

      {/* Thread Entries */}
      <div className="flex-1">
        {threadEntries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="text-6xl mb-4">💭</div>
            <p className="text-gray-400 font-medium text-lg">
              Este hilo está vacío
            </p>
            <p className="text-gray-300 text-sm mt-1">
              Agrega la primera entrada al hilo arriba
            </p>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {threadEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <EntryCard entry={entry} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ThreadView.displayName = 'ThreadView';

export default ThreadView;

