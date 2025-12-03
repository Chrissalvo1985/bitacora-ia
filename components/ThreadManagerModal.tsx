import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '../constants';
import { Thread } from '../types';
import { useBitacora } from '../context/BitacoraContext';

interface ThreadManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: string;
  currentThreadId?: string;
  bookId: string;
}

const ThreadManagerModal: React.FC<ThreadManagerModalProps> = ({
  isOpen,
  onClose,
  entryId,
  currentThreadId,
  bookId
}) => {
  const { threads, entries, updateEntryThread, createThread } = useBitacora();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(currentThreadId || null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');

  // Filter threads for this book that have at least one entry
  // Always include current thread even if it has no entries (user might be adding first entry)
  const bookThreads = threads.filter(t => {
    if (t.bookId !== bookId) return false;
    // Include if it has entries OR if it's the current thread
    const hasEntries = entries.some(e => e.threadId === t.id);
    return hasEntries || t.id === currentThreadId;
  });
  const currentThread = currentThreadId ? threads.find(t => t.id === currentThreadId) : undefined;

  const handleSave = async () => {
    if (isCreatingNew && newThreadTitle.trim()) {
      // Create new thread and assign entry to it
      try {
        const newThread = await createThread(newThreadTitle.trim(), bookId);
        await updateEntryThread(entryId, newThread.id);
        onClose();
      } catch (error) {
        console.error('Error creating thread:', error);
      }
    } else if (selectedThreadId !== (currentThreadId || null)) {
      // Update thread assignment
      await updateEntryThread(entryId, selectedThreadId);
      onClose();
    } else {
      // No change
      onClose();
    }
  };

  const handleRemoveFromThread = async () => {
    await updateEntryThread(entryId, null);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                      <ICONS.MessageSquare size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Gestionar Hilo</h2>
                      <p className="text-xs text-white/80">Cambiar o remover de hilo de conversación</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <ICONS.X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Current Thread Info */}
                {currentThread && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Hilo actual:</p>
                    <p className="text-sm font-medium text-purple-900">{currentThread.title}</p>
                  </div>
                )}

                {/* Options */}
                <div className="space-y-3">
                  {/* Remove from thread */}
                  {currentThreadId && (
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        name="thread-action"
                        checked={!isCreatingNew && selectedThreadId === null}
                        onChange={() => {
                          setIsCreatingNew(false);
                          setSelectedThreadId(null);
                        }}
                        className="text-purple-600"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">Entrada independiente</span>
                        <p className="text-xs text-gray-500">Remover de cualquier hilo</p>
                      </div>
                    </label>
                  )}

                  {/* Existing threads */}
                  {bookThreads.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Hilos existentes</p>
                      {bookThreads.map(thread => (
                        <label
                          key={thread.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            !isCreatingNew && selectedThreadId === thread.id
                              ? 'bg-purple-50 border-purple-300'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="thread-action"
                            checked={!isCreatingNew && selectedThreadId === thread.id}
                            onChange={() => {
                              setIsCreatingNew(false);
                              setSelectedThreadId(thread.id);
                            }}
                            className="text-purple-600"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{thread.title}</span>
                            {thread.id === currentThreadId && (
                              <span className="ml-2 text-xs text-purple-600 font-semibold">(Actual)</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Create new thread */}
                  <div className="space-y-2">
                    <label
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isCreatingNew
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="thread-action"
                        checked={isCreatingNew}
                        onChange={() => {
                          setIsCreatingNew(true);
                          setSelectedThreadId(null);
                        }}
                        className="text-purple-600"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">Crear nuevo hilo</span>
                        <p className="text-xs text-gray-500">Iniciar una nueva conversación</p>
                      </div>
                    </label>
                    {isCreatingNew && (
                      <input
                        type="text"
                        value={newThreadTitle}
                        onChange={(e) => setNewThreadTitle(e.target.value)}
                        placeholder="Título del nuevo hilo..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                {currentThreadId && (
                  <button
                    onClick={handleRemoveFromThread}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isCreatingNew && !newThreadTitle.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ThreadManagerModal;

