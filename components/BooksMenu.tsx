import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Folder } from '../types';

interface BooksMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: string;
  selectedBookId: string | null;
  onSelectBook: (bookId: string) => void;
}

// Component for folder header with rename option
const FolderHeader: React.FC<{
  folder: Folder;
  folderBooksCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (folderId: string, newName: string) => Promise<void>;
}> = ({ folder, folderBooksCount, isExpanded, onToggle, onRename }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = async () => {
    if (newName.trim() && newName.trim() !== folder.name) {
      await onRename(folder.id, newName.trim());
    }
    setIsRenaming(false);
  };

  if (isRenaming) {
    return (
      <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
        <p className="text-xs font-semibold text-purple-500 uppercase mb-2">Renombrar carpeta</p>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleRename()}
          onBlur={handleRename}
          className="w-full px-3 py-2 rounded-lg border border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm mb-2"
        />
        <div className="flex gap-2">
          <button
            onClick={handleRename}
            className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setIsRenaming(false);
              setNewName(folder.name);
            }}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        onClick={onToggle}
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
            {folderBooksCount}
          </span>
        </div>
      </button>
      {/* Rename folder button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setNewName(folder.name);
          setIsRenaming(true);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-purple-200 rounded-lg transition-colors text-purple-400 hover:text-purple-600 opacity-0 group-hover:opacity-100"
        title="Renombrar carpeta"
      >
        <ICONS.PenTool size={14} />
      </button>
    </div>
  );
};

// Component for book options menu (move to folder + rename)
const BookOptionsMenu: React.FC<{ 
  book: Book; 
  folders: Folder[]; 
  onMoveToFolder: (bookId: string, folderId: string | null) => Promise<void>;
  onRename: (bookId: string, newName: string) => Promise<void>;
}> = ({ book, folders, onMoveToFolder, onRename }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(book.name);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsRenaming(false);
        setShowFolderMenu(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleMoveToFolder = async (folderId: string | null) => {
    await onMoveToFolder(book.id, folderId);
    setIsOpen(false);
    setShowFolderMenu(false);
  };

  const handleRename = async () => {
    if (newName.trim() && newName.trim() !== book.name) {
      await onRename(book.id, newName.trim());
    }
    setIsRenaming(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 hover:bg-white/80 rounded-lg transition-colors text-gray-400 hover:text-indigo-600"
        title="Opciones"
      >
        <ICONS.Menu size={14} />
      </button>
      
      {isOpen && !isRenaming && (
        <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[180px]">
          {/* Rename option */}
          <button
            onClick={() => {
              setNewName(book.name);
              setIsRenaming(true);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <ICONS.PenTool size={14} className="text-gray-400" />
            Renombrar
          </button>
          
          {/* Move to folder option */}
          <div className="relative">
            <button
              onClick={() => setShowFolderMenu(!showFolderMenu)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <ICONS.ArrowRight size={14} className="text-gray-400" />
                Mover a carpeta
              </div>
              <ICONS.ChevronRight size={14} className="text-gray-400" />
            </button>
            
            {showFolderMenu && (
              <div className="absolute left-full top-0 ml-1 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[160px]">
                <button
                  onClick={() => handleMoveToFolder(null)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <ICONS.Book size={14} className="text-gray-400" />
                  Sin carpeta
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveToFolder(folder.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: folder.color || '#9333ea' }}
                    />
                    {folder.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename input */}
      {isOpen && isRenaming && (
        <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[220px]">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Renombrar libreta</p>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleRename()}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRename}
              className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setIsRenaming(false);
                setIsOpen(false);
              }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const BooksMenu: React.FC<BooksMenuProps> = ({
  isOpen,
  onClose,
  activeView,
  selectedBookId,
  onSelectBook,
}) => {
  const { books, folders, createBook, createFolder, updateBookFolder, updateBook, updateFolder, isInitializing } = useBitacora();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const filteredBooks = books.filter(book =>
    book.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group books by folder
  const booksByFolder = books.reduce((acc, book) => {
    const folderId = book.folderId || 'no-folder';
    if (!acc[folderId]) {
      acc[folderId] = [];
    }
    acc[folderId].push(book);
    return acc;
  }, {} as Record<string, typeof books>);

  // Check if there are any books or folders to show
  const hasBooksWithoutFolder = booksByFolder['no-folder'] && booksByFolder['no-folder'].length > 0;
  const hasFoldersWithBooks = folders.some(folder => {
    const folderBooks = booksByFolder[folder.id] || [];
    if (searchQuery) {
      const folderMatchesSearch = folder.name.toLowerCase().includes(searchQuery.toLowerCase());
      const hasMatchingBooks = folderBooks.some(book => 
        book.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return folderMatchesSearch || hasMatchingBooks;
    }
    return true; // Always show folders even if empty
  });
  const hasContentToShow = hasBooksWithoutFolder || folders.length > 0;

  const handleCreateBook = async () => {
    if (!newBookName.trim()) return;
    try {
      const book = await createBook(newBookName.trim());
      setNewBookName('');
      setIsCreatingBook(false);
      onSelectBook(book.id);
      onClose();
    } catch (error) {
      console.error('Error creating book:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

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

  const handleSelectBook = (bookId: string) => {
    onSelectBook(bookId);
    onClose();
  };

  const handleRenameBook = async (bookId: string, newName: string) => {
    try {
      await updateBook(bookId, { name: newName });
    } catch (error) {
      console.error('Error renaming book:', error);
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await updateFolder(folderId, { name: newName });
    } catch (error) {
      console.error('Error renaming folder:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
      />

      {/* Menu Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-white shadow-2xl z-[70] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg">
              <ICONS.Book size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Libretas</h2>
              <p className="text-xs text-gray-500 font-medium">{books.length} {books.length === 1 ? 'libreta' : 'libretas'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <ICONS.X size={20} />
          </button>
        </div>

        {/* Search and Create */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative">
            <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar libreta..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
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

          {/* Create Buttons */}
          <div className="flex gap-2">
            {!isCreatingFolder ? (
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-sm text-sm"
              >
                <ICONS.Plus size={16} />
                Carpeta
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-1 bg-gray-50 rounded-xl p-2 border border-gray-200"
              >
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  placeholder="Nombre carpeta..."
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm bg-white mb-2"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateFolder}
                    className="flex-1 px-2 py-1 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}

            {!isCreatingBook ? (
              <button
                onClick={() => setIsCreatingBook(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
              >
                <ICONS.Plus size={16} />
                Libreta
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-1 bg-gray-50 rounded-xl p-2 border border-gray-200"
              >
                <input
                  type="text"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateBook()}
                  placeholder="Nombre libreta..."
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white mb-2"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateBook}
                    className="flex-1 px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingBook(false);
                      setNewBookName('');
                    }}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Books List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ICONS.Loader2 className="animate-spin mb-3" size={24} />
              <p className="text-sm">Cargando libretas...</p>
            </div>
          ) : !hasContentToShow && searchQuery ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <ICONS.Book size={32} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium mb-1">
                No se encontraron libretas
              </p>
              <p className="text-sm text-gray-400">
                Intenta con otros términos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Books without folder */}
              {booksByFolder['no-folder'] && booksByFolder['no-folder'].length > 0 && (
                <div className="space-y-2">
                  {booksByFolder['no-folder']
                    .filter(book => book.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((book) => {
                      const isActive = activeView === 'book' && selectedBookId === book.id;
                      return (
                        <motion.div
                          key={book.id}
                          className="group relative"
                        >
                          <motion.button
                            onClick={() => handleSelectBook(book.id)}
                            whileHover={{ x: -4 }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left ${
                              isActive
                                ? 'bg-indigo-50 border-2 border-indigo-200 shadow-sm'
                                : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl ${
                              isActive
                                ? 'bg-indigo-100'
                                : 'bg-white border border-gray-200'
                            }`}>
                              <ICONS.Book
                                size={20}
                                className={isActive ? 'text-indigo-600' : 'text-gray-500'}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-base mb-1 truncate ${
                                isActive ? 'text-indigo-900' : 'text-gray-800'
                              }`}>
                                {book.name}
                              </p>
                              {book.context && (
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {book.context}
                                </p>
                              )}
                            </div>
                            {isActive && (
                              <div className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                            )}
                          </motion.button>
                          {/* Book options menu */}
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <BookOptionsMenu book={book} folders={folders} onMoveToFolder={updateBookFolder} onRename={handleRenameBook} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
              )}

              {/* Folders with their books */}
              {folders.length > 0 && (
                <>
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                      Carpetas ({folders.length})
                    </h4>
                  </div>
                  {folders.map((folder) => {
                    const folderBooks = booksByFolder[folder.id] || [];
                    const filteredFolderBooks = folderBooks.filter(book =>
                      book.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    
                    // Show folder always when no search, or if it matches search or has books
                    const folderMatchesSearch = folder.name.toLowerCase().includes(searchQuery.toLowerCase());
                    // Only hide folder if there's a search query AND it doesn't match AND has no matching books
                    if (searchQuery && !folderMatchesSearch && filteredFolderBooks.length === 0) return null;
                    
                    // Auto-expand folders that match search or if they have books
                    const shouldAutoExpand = folderMatchesSearch && searchQuery;
                    const isExpanded = expandedFolders.has(folder.id) || shouldAutoExpand;
                
                return (
                  <div key={folder.id} className="space-y-2">
                    <FolderHeader 
                      folder={folder} 
                      folderBooksCount={folderBooks.length}
                      isExpanded={isExpanded}
                      onToggle={() => toggleFolder(folder.id)}
                      onRename={handleRenameFolder}
                    />
                    
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
                          filteredFolderBooks.map((book) => {
                          const isActive = activeView === 'book' && selectedBookId === book.id;
                          return (
                            <motion.div
                              key={book.id}
                              className="group relative"
                            >
                              <motion.button
                                onClick={() => handleSelectBook(book.id)}
                                whileHover={{ x: -4 }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                                  isActive
                                    ? 'bg-indigo-50 border-2 border-indigo-200 shadow-sm'
                                    : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                                }`}
                              >
                                <div className={`p-2 rounded-lg ${
                                  isActive
                                    ? 'bg-indigo-100'
                                    : 'bg-gray-50 border border-gray-200'
                                }`}>
                                  <ICONS.Book
                                    size={18}
                                    className={isActive ? 'text-indigo-600' : 'text-gray-500'}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-semibold text-sm mb-0.5 truncate ${
                                    isActive ? 'text-indigo-900' : 'text-gray-800'
                                  }`}>
                                    {book.name}
                                  </p>
                                  {book.context && (
                                    <p className="text-xs text-gray-500 line-clamp-1">
                                      {book.context}
                                    </p>
                                  )}
                                </div>
                                {isActive && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />
                                )}
                              </motion.button>
                              {/* Book options menu */}
                              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <BookOptionsMenu book={book} folders={folders} onMoveToFolder={updateBookFolder} onRename={handleRenameBook} />
                              </div>
                            </motion.div>
                          );
                        })
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default BooksMenu;

