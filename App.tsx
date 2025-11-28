import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BookView from './components/BookView';
import TaskView from './components/TaskView';
import SearchView from './components/SearchView';
import SummaryView from './components/SummaryView';
import AIQueryView from './components/AIQueryView';
import UserProfileView from './components/UserProfileView';
import LoginView from './components/LoginView';
import BooksMenu from './components/BooksMenu';
import { ICONS } from './constants';
import { BitacoraProvider, useBitacora } from './context/BitacoraContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

// Bottom Navigation Component for Mobile
const BottomNav = ({ activeView, setActiveView, onBookClick }: any) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
            onClick={() => setActiveView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors p-2 ${activeView === 'dashboard' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Home size={24} strokeWidth={activeView === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Inicio</span>
        </button>
        
        <button 
             onClick={() => setActiveView('tasks')}
            className={`flex flex-col items-center gap-1 transition-colors p-2 ${activeView === 'tasks' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <div className="relative">
                <ICONS.ListTodo size={24} strokeWidth={activeView === 'tasks' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-medium">Misiones</span>
        </button>

        <button 
             onClick={onBookClick}
            className={`flex flex-col items-center gap-1 transition-colors p-2 ${activeView === 'book' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Library size={24} strokeWidth={activeView === 'book' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Libretas</span>
        </button>
    </div>
  );
};

// Simple Book Selector Modal for Mobile
const MobileBookSelector = ({ isOpen, onClose, onSelect }: any) => {
    const { books } = useBitacora();
    const [searchQuery, setSearchQuery] = React.useState('');
    
    if (!isOpen) return null;

    const filteredBooks = books.filter(book => 
        book.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end md:hidden animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 flex-shrink-0" />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Tus Libretas</h3>
                    <span className="text-sm text-gray-400">{books.length}</span>
                </div>
                
                {books.length > 5 && (
                    <div className="relative mb-4">
                        <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar libreta..."
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <ICONS.X size={18} />
                            </button>
                        )}
                    </div>
                )}
                
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                    {filteredBooks.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            No se encontraron libretas
                        </div>
                    ) : (
                        filteredBooks.map(book => (
                            <button 
                                key={book.id}
                                onClick={() => onSelect(book.id)}
                                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-indigo-50 active:scale-[0.98] transition-all"
                            >
                                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                                    <ICONS.Book size={20} className="text-indigo-500" />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <span className="font-bold text-gray-800 block truncate text-base">{book.name}</span>
                                    {book.context && <span className="text-xs text-gray-400 line-clamp-1">{book.context}</span>}
                                </div>
                                <ICONS.ChevronRight className="ml-auto text-gray-300" size={18} />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

const Layout = () => {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const { books } = useBitacora();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);
  const [isBooksMenuOpen, setIsBooksMenuOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <ICONS.Loader2 className="animate-spin mx-auto text-indigo-600 mb-4" size={48} />
          <p className="text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const handleMobileBookSelect = (bookId: string) => {
      setSelectedBookId(bookId);
      setActiveView('book');
      setIsBookSelectorOpen(false);
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    setActiveView('book');
  };

  const handleNavigateToEntry = (bookId: string, entryId: string) => {
    setSelectedBookId(bookId);
    setActiveView('book');
    // Scroll to entry could be added here if needed
  };

  const renderContent = () => {
    const views: Record<string, React.ReactNode> = {
      dashboard: <Dashboard 
        onSelectBook={handleSelectBook}
        onNavigateToEntry={handleNavigateToEntry}
      />,
      book: selectedBookId ? <BookView bookId={selectedBookId} /> : <Dashboard 
        onSelectBook={handleSelectBook}
        onNavigateToEntry={handleNavigateToEntry}
      />,
      tasks: <TaskView />,
      search: <SearchView />,
      summary: <SummaryView />,
      query: <AIQueryView />,
      profile: <UserProfileView />,
    };

    return views[activeView] || <Dashboard 
      onSelectBook={handleSelectBook}
      onNavigateToEntry={handleNavigateToEntry}
    />;
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-700">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        selectedBookId={selectedBookId}
        setSelectedBookId={setSelectedBookId}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative bg-[#f8fafc]">
        {/* Mobile Header - Sticky */}
        <div className="md:hidden bg-white/90 backdrop-blur-md sticky top-0 z-40 px-5 py-3 flex items-center justify-between border-b border-gray-100 safe-top">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-1.5 rounded-lg shadow-sm">
                <ICONS.Book size={18} className="text-white" />
            </div>
            <span className="font-extrabold text-xl text-gray-900 tracking-tight">Bitácora</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBooksMenuOpen(true)}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ICONS.Library size={22} className="text-gray-600" />
              {books.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {books.length > 9 ? '9+' : books.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveView('profile')}
              className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-sm transition-all ${
                activeView === 'profile'
                  ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-500 border-gray-200'
              }`}
            >
              <span className={`text-xs font-bold ${
                activeView === 'profile' ? 'text-indigo-600' : 'text-white'
              }`}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-5 md:px-8 pt-4 md:pt-8 scroll-smooth no-scrollbar pb-safe">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        <BottomNav 
            activeView={activeView} 
            setActiveView={setActiveView} 
            onBookClick={() => setIsBookSelectorOpen(true)}
        />

        <MobileBookSelector 
            isOpen={isBookSelectorOpen} 
            onClose={() => setIsBookSelectorOpen(false)}
            onSelect={handleMobileBookSelect}
        />

        {/* Books Menu for Mobile */}
        <AnimatePresence>
          <BooksMenu
            isOpen={isBooksMenuOpen}
            onClose={() => setIsBooksMenuOpen(false)}
            activeView={activeView}
            selectedBookId={selectedBookId}
            onSelectBook={handleSelectBook}
          />
        </AnimatePresence>

      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <BitacoraProvider>
        <Layout />
      </BitacoraProvider>
    </AuthProvider>
  );
};

export default App;