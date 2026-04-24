import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setCurrentBook, getBooks, saveBook, deleteBook, BookRecord } from '../services/firestoreService';

export type Book = BookRecord;

const DEFAULT_BOOK: Book = { id: 'default', name: 'Main Book', nameAr: 'الدفتر الرئيسي', createdAt: 0 };

interface BookContextType {
  activeBookId: string;
  activeBook: Book;
  books: Book[];
  switchBook: (id: string) => void;
  addBook: (name: string, nameAr?: string) => Promise<Book>;
  renameBook: (id: string, name: string, nameAr?: string) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  refreshBooks: () => Promise<void>;
  loading: boolean;
}

const BookContext = createContext<BookContextType>({
  activeBookId: 'default',
  activeBook: DEFAULT_BOOK,
  books: [DEFAULT_BOOK],
  switchBook: () => {},
  addBook: async () => DEFAULT_BOOK,
  renameBook: async () => {},
  removeBook: async () => {},
  refreshBooks: async () => {},
  loading: false,
});

const STORAGE_KEY = 'amlak_active_book';

export const BookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeBookId, setActiveBookId] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY) || 'default'
  );
  const [books, setBooks] = useState<Book[]>([DEFAULT_BOOK]);
  const [loading, setLoading] = useState(true);

  const loadBooks = useCallback(async () => {
    try {
      const firestoreBooks = await getBooks();
      const allBooks: Book[] = firestoreBooks.length > 0 ? firestoreBooks : [];
      if (!allBooks.some(b => b.id === 'default')) allBooks.unshift(DEFAULT_BOOK);
      setBooks(allBooks);
    } catch {
      setBooks([DEFAULT_BOOK]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadBooks().finally(() => setLoading(false));
  }, [loadBooks]);

  // Keep module-level variable in sync
  useEffect(() => {
    setCurrentBook(activeBookId);
    localStorage.setItem(STORAGE_KEY, activeBookId);
  }, [activeBookId]);

  const switchBook = useCallback((id: string) => {
    setCurrentBook(id);
    setActiveBookId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Navigate to dashboard to avoid stale data
    window.location.hash = '#/';
  }, []);

  const addBook = useCallback(async (name: string, nameAr?: string): Promise<Book> => {
    const book = await saveBook({ name, nameAr, createdAt: Date.now() });
    setBooks(prev => {
      if (prev.some(b => b.id === book.id)) return prev;
      return [...prev, book];
    });
    return book;
  }, []);

  const renameBook = useCallback(async (id: string, name: string, nameAr?: string) => {
    if (id === 'default') {
      setBooks(prev => prev.map(b => b.id === 'default' ? { ...b, name, nameAr } : b));
      return;
    }
    await saveBook({ id, name, nameAr });
    setBooks(prev => prev.map(b => b.id === id ? { ...b, name, nameAr } : b));
  }, []);

  const removeBook = useCallback(async (id: string) => {
    if (id === 'default') throw new Error('Cannot delete the main book');
    await deleteBook(id);
    setBooks(prev => prev.filter(b => b.id !== id));
    if (activeBookId === id) switchBook('default');
  }, [activeBookId, switchBook]);

  const activeBook = books.find(b => b.id === activeBookId) || DEFAULT_BOOK;

  return (
    <BookContext.Provider value={{
      activeBookId, activeBook, books,
      switchBook, addBook, renameBook, removeBook,
      refreshBooks: loadBooks,
      loading,
    }}>
      {children}
    </BookContext.Provider>
  );
};

export const useBook = () => useContext(BookContext);
export default BookContext;
