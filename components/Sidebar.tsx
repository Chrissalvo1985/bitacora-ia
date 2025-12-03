import React, { useState, useCallback, memo } from 'react';
import { ICONS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import BooksMenu from './BooksMenu';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedBookId: string | null;
  setSelectedBookId: (id: string | null) => void;
}

const Sidebar: React.FC<SidebarProps> = memo(({ 
  activeView, 
  setActiveView, 
  selectedBookId, 
  setSelectedBookId,
}) => {
  const { books } = useBitacora();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isBooksMenuOpen, setIsBooksMenuOpen] = useState(false);

  const handleNav = useCallback((view: string, bookId: string | null = null) => {
    setActiveView(view);
    setSelectedBookId(bookId);
  }, [setActiveView, setSelectedBookId]);

  const handleSelectBook = useCallback((bookId: string) => {
    setActiveView('book');
    setSelectedBookId(bookId);
  }, [setActiveView, setSelectedBookId]);

  return (
    <div className="hidden md:flex flex-col w-72 bg-white border-r border-gray-100 h-full p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <ICONS.Book size={24} className="text-white" />
            </div>
            <div>
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Bitácora</h1>
                <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">IA Edition</span>
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
          <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Principal</p>
          <button
            onClick={() => handleNav('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'dashboard' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.Home size={20} />
            Tu Espacio
          </button>

          <button
            onClick={() => handleNav('tasks')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'tasks' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.ListTodo size={20} />
            Mis Misiones
          </button>

          <button
            onClick={() => handleNav('search')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'search' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.Search size={20} />
            Búsqueda
          </button>

          <button
            onClick={() => handleNav('summary')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'summary' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.Sparkles size={20} />
            Resumen
          </button>

          <button
            onClick={() => handleNav('query')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'query' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.Sparkles size={20} />
            Preguntar IA
          </button>
          
          <button
            onClick={() => handleNav('people')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'people' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.Users size={20} />
            Personas
          </button>

          <button
            onClick={() => handleNav('insights')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'insights' 
              ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ICONS.BarChart3 size={20} />
            Insights
          </button>

          {/* Books Menu Button */}
          <button
            onClick={() => setIsBooksMenuOpen(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 mt-8 ${
              activeView === 'book'
                ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-2 border-transparent'
            }`}
          >
            <ICONS.Library size={20} />
            <span className="flex-1 text-left">Libretas</span>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
              {books.length}
            </span>
          </button>
        </nav>

        <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
           <button
             onClick={() => handleNav('profile')}
             className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
               activeView === 'profile'
                 ? 'bg-indigo-50 border-2 border-indigo-200'
                 : 'hover:bg-gray-50 border-2 border-transparent'
             }`}
           >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-gray-800 truncate">{user?.name || 'Usuario'}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
              </div>
              <ICONS.Edit 
                size={16} 
                className={`flex-shrink-0 ${
                  activeView === 'profile' ? 'text-indigo-600' : 'text-gray-400'
                }`}
              />
           </button>
           
           <button
             onClick={() => setShowLogoutConfirm(true)}
             className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
           >
             <ICONS.X size={18} />
             Cerrar Sesión
           </button>
        </div>

        {/* Books Menu */}
        <AnimatePresence>
          <BooksMenu
            isOpen={isBooksMenuOpen}
            onClose={() => setIsBooksMenuOpen(false)}
            activeView={activeView}
            selectedBookId={selectedBookId}
            onSelectBook={handleSelectBook}
          />
        </AnimatePresence>

        {/* Logout Confirmation */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLogoutConfirm(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">¿Cerrar sesión?</h3>
                  <p className="text-sm text-gray-600 mb-6">Se cerrará tu sesión actual</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        await logout();
                        setShowLogoutConfirm(false);
                      }}
                      className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-colors"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;