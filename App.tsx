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
const BottomNav = ({ activeView, setActiveView, onBookClick, onSearchClick, onSummaryClick, onQueryClick }: any) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 px-2 py-2 flex justify-around items-center z-50 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
            onClick={() => setActiveView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors p-2 flex-1 ${activeView === 'dashboard' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Home size={22} strokeWidth={activeView === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Inicio</span>
        </button>
        
        <button 
             onClick={() => setActiveView('tasks')}
            className={`flex flex-col items-center gap-1 transition-colors p-2 flex-1 ${activeView === 'tasks' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.ListTodo size={22} strokeWidth={activeView === 'tasks' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Misiones</span>
        </button>

        <button 
             onClick={onSearchClick}
            className={`flex flex-col items-center gap-1 transition-colors p-2 flex-1 ${activeView === 'search' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Search size={22} strokeWidth={activeView === 'search' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Buscar</span>
        </button>

        <button 
             onClick={onBookClick}
            className={`flex flex-col items-center gap-1 transition-colors p-2 flex-1 ${activeView === 'book' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Library size={22} strokeWidth={activeView === 'book' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Libretas</span>
        </button>

        <button 
             onClick={onSummaryClick}
            className={`flex flex-col items-center gap-1 transition-colors p-2 flex-1 ${activeView === 'summary' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Sparkles size={22} strokeWidth={activeView === 'summary' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Resumen</span>
        </button>

        <button 
             onClick={onQueryClick}
            className={`flex flex-col items-center gap-1 transition-colors p-2 flex-1 ${activeView === 'query' ? 'text-indigo-600' : 'text-gray-400'}`}
        >
            <ICONS.Sparkles size={22} strokeWidth={activeView === 'query' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">IA</span>
        </button>
    </div>
  );
};

// Simple Book Selector Modal for Mobile - Now shows folders too
const MobileBookSelector = ({ isOpen, onClose, onSelect }: any) => {
    const { books, folders } = useBitacora();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
    
    if (!isOpen) return null;

    // Group books by folder
    const booksByFolder = books.reduce((acc, book) => {
        const folderId = book.folderId || 'no-folder';
        if (!acc[folderId]) {
            acc[folderId] = [];
        }
        acc[folderId].push(book);
        return acc;
    }, {} as Record<string, typeof books>);

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    const hasBooksWithoutFolder = booksByFolder['no-folder'] && booksByFolder['no-folder'].length > 0;
    const filteredBooksWithoutFolder = hasBooksWithoutFolder 
        ? booksByFolder['no-folder'].filter(book => 
            book.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end md:hidden animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 flex-shrink-0" />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Tus Libretas</h3>
                    <span className="text-sm text-gray-400">{books.length}</span>
                </div>
                
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
                
                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                    {/* Books without folder */}
                    {filteredBooksWithoutFolder.length > 0 && (
                        <div className="space-y-2">
                            {filteredBooksWithoutFolder.map(book => (
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
                            ))}
                        </div>
                    )}

                    {/* Folders with their books */}
                    {folders.length > 0 && (
                        <>
                            <div className="pt-2 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                                    Carpetas ({folders.length})
                                </h4>
                            </div>
                            {folders.map((folder) => {
                                const folderBooks = booksByFolder[folder.id] || [];
                                const filteredFolderBooks = folderBooks.filter(book =>
                                    book.name.toLowerCase().includes(searchQuery.toLowerCase())
                                );
                                
                                const folderMatchesSearch = folder.name.toLowerCase().includes(searchQuery.toLowerCase());
                                if (searchQuery && !folderMatchesSearch && filteredFolderBooks.length === 0) return null;
                                
                                const isExpanded = expandedFolders.has(folder.id);
                                
                                return (
                                    <div key={folder.id} className="space-y-2">
                                        <button
                                            onClick={() => toggleFolder(folder.id)}
                                            className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <motion.div
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ICONS.ChevronRight size={16} className="text-purple-600" />
                                                </motion.div>
                                                <div 
                                                    className="w-4 h-4 rounded"
                                                    style={{ backgroundColor: folder.color || '#9333ea' }}
                                                />
                                                <span className="font-semibold text-sm text-purple-900">{folder.name}</span>
                                                <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                                                    {folderBooks.length}
                                                </span>
                                            </div>
                                        </button>
                                        
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="pl-4 space-y-2 border-l-2 border-purple-200 ml-2"
                                            >
                                                {filteredFolderBooks.length === 0 ? (
                                                    <p className="text-xs text-gray-400 italic py-2 px-3">Carpeta vacía</p>
                                                ) : (
                                                    filteredFolderBooks.map((book) => (
                                                        <button 
                                                            key={book.id}
                                                            onClick={() => onSelect(book.id)}
                                                            className="w-full flex items-center gap-4 p-3 bg-white rounded-xl hover:bg-indigo-50 active:scale-[0.98] transition-all border border-gray-100"
                                                        >
                                                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                                                                <ICONS.Book size={18} className="text-indigo-500" />
                                                            </div>
                                                            <div className="text-left flex-1 min-w-0">
                                                                <span className="font-semibold text-gray-800 block truncate text-sm">{book.name}</span>
                                                                {book.context && <span className="text-xs text-gray-400 line-clamp-1">{book.context}</span>}
                                                            </div>
                                                            <ICONS.ChevronRight className="ml-auto text-gray-300" size={16} />
                                                        </button>
                                                    ))
                                                )}
                                            </motion.div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {filteredBooksWithoutFolder.length === 0 && folders.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            No se encontraron libretas
                        </div>
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
            onSearchClick={() => setActiveView('search')}
            onSummaryClick={() => setActiveView('summary')}
            onQueryClick={() => setActiveView('query')}
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