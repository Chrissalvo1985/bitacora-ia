import React, { useState, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LoginView from './components/LoginView';
import BooksMenu from './components/BooksMenu';
import NotificationManager from './components/NotificationManager';
import { ICONS } from './constants';
import { BitacoraProvider, useBitacora } from './context/BitacoraContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load heavy components for better initial load performance
const BookView = lazy(() => import('./components/BookView'));
const TaskView = lazy(() => import('./components/TaskView'));
const SearchView = lazy(() => import('./components/SearchView'));
const SummaryView = lazy(() => import('./components/SummaryView'));
const AIQueryView = lazy(() => import('./components/AIQueryView'));
const UserProfileView = lazy(() => import('./components/UserProfileView'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <ICONS.Loader2 className="animate-spin text-indigo-600" size={32} />
  </div>
);

// Bottom Navigation Component for Mobile
const BottomNav = ({ activeView, setActiveView, onSearchClick, onSummaryClick, onQueryClick }: any) => {
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

const Layout = () => {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const { books } = useBitacora();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
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
      book: selectedBookId ? (
        <Suspense fallback={<LoadingFallback />}>
          <BookView bookId={selectedBookId} />
        </Suspense>
      ) : (
        <Dashboard 
          onSelectBook={handleSelectBook}
          onNavigateToEntry={handleNavigateToEntry}
        />
      ),
      tasks: (
        <Suspense fallback={<LoadingFallback />}>
          <TaskView />
        </Suspense>
      ),
      search: (
        <Suspense fallback={<LoadingFallback />}>
          <SearchView />
        </Suspense>
      ),
      summary: (
        <Suspense fallback={<LoadingFallback />}>
          <SummaryView />
        </Suspense>
      ),
      query: (
        <Suspense fallback={<LoadingFallback />}>
          <AIQueryView />
        </Suspense>
      ),
      profile: (
        <Suspense fallback={<LoadingFallback />}>
          <UserProfileView />
        </Suspense>
      ),
    };

    return views[activeView] || <Dashboard 
      onSelectBook={handleSelectBook}
      onNavigateToEntry={handleNavigateToEntry}
    />;
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-700">
      {/* Smart Notification Manager */}
      <NotificationManager />
      
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        selectedBookId={selectedBookId}
        setSelectedBookId={setSelectedBookId}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative bg-[#f8fafc]">
        {/* Mobile Header - Sticky with safe area */}
        <header className="md:hidden sticky top-0 bg-white/95 backdrop-blur-xl flex-shrink-0 z-40 px-4 py-3 flex items-center justify-between border-b border-gray-100/80 shadow-sm" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-1.5 rounded-lg shadow-sm">
                <ICONS.Book size={18} className="text-white" />
            </div>
            <span className="font-extrabold text-xl text-gray-900 tracking-tight">Bitácora</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsBooksMenuOpen(true)}
              className="relative p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
            >
              <ICONS.Library size={22} className="text-gray-600" />
              {books.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {books.length > 9 ? '9+' : books.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveView('profile')}
              className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-sm transition-all active:scale-95 ${
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
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-none w-full max-w-5xl mx-auto px-4 md:px-8 pt-4 md:pt-8 scroll-smooth no-scrollbar pb-24 md:pb-8">
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
            onSearchClick={() => setActiveView('search')}
            onSummaryClick={() => setActiveView('summary')}
            onQueryClick={() => setActiveView('query')}
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