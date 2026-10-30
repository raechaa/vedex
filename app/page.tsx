'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Import server actions
import { getQuotes } from '@/lib/actions';
import { loginAction, logoutAction, getCurrentUser } from '@/lib/auth-actions';
import type { SessionUser } from '@/lib/auth';

// Import components
import Header from '@/components/layout/Header';
import LoginView from '@/components/views/LoginView';
import QuoteList from '@/components/views/QuoteList';
import Worksheet from '@/components/views/Worksheet';
import UserManagement from '@/components/views/UserManagement';
import Text2ImageView from '@/components/views/Text2ImageView';
import MaintenanceModal from '@/components/modals/MaintenanceModal';
import ProfileModal from '@/components/modals/ProfileModal';

export default function App() {
  // GLOBAL STATE
  const [view, setView] = useState('loading_init');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [userQuotes, setUserQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  // MODAL STATE
  const [isMaintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);

  // --- SESSION INIT (cek cookie session di server) ---
  useEffect(() => {
    let isMounted = true;

    // Safety fallback timeout: jika pengecekan sesi terhambat atau lambat di HP,
    // langsung alihkan ke tampilan login agar layar HP tidak stuck di loading
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setView((prev) => (prev === 'loading_init' ? 'login' : prev));
      }
    }, 1200);

    getCurrentUser()
      .then((user) => {
        if (!isMounted) return;
        clearTimeout(safetyTimeout);
        if (user) {
          setCurrentUser(user);
          loadQuotes();
        } else {
          setView('login');
        }
      })
      .catch((err) => {
        console.warn('Session check error or rejected:', err);
        if (!isMounted) return;
        clearTimeout(safetyTimeout);
        setView('login');
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  // LOAD QUOTES
  const loadQuotes = async () => {
    setIsLoading(true);
    try {
      const quotes = await getQuotes();
      setUserQuotes(quotes);
      setView('quotes');
    } catch (error) {
      console.error('Error loading quotes:', error);
      setUserQuotes([]);
      setView('quotes');
    } finally {
      setIsLoading(false);
    }
  };

  // LOGIC ACTIONS
  // Mengembalikan pesan error (string) bila gagal, atau null bila berhasil
  const handleLogin = async (email: string, password: string): Promise<string | null> => { 
    const result = await loginAction(email, password);
    if (!result.success) return result.error;
    setCurrentUser(result.user);

    setView('loading');
    await loadQuotes();
    return null;
  };

  const handleLogout = async () => {
    await logoutAction();
    setUserQuotes([]);
    setSelectedQuote(null);
    setCurrentUser(null);
    setView('login');
  };

  const handleUpdateQuote = async (updatedData: any) => {
    setSelectedQuote(updatedData);
    
    // Update local state
    setUserQuotes(prev => prev.map((q: any) => 
      q.quote_id === updatedData.quote_id ? updatedData : q
    ));
  };

  const handleDeleteQuote = (deletedQuoteId: any) => {
    setUserQuotes(prev => prev.filter((q: any) => q.quote_id !== deletedQuoteId));
    setSelectedQuote(null);
    setView('quotes');
  };


  // ANIMATION VARIANTS
  const fadeVariants = { 
    hidden: { opacity: 0, y: 20 }, 
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }, 
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } } 
  };
  
  const isCenteredLayout = view === 'login' || view === 'loading' || view === 'loading_init';

  return (
    <div className="min-h-[100dvh] bg-cover bg-center bg-no-repeat text-white flex flex-col relative overflow-hidden font-sans" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1920&auto=format&fit=crop')" }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px] z-0"></div>

      <Header 
        isLoggedIn={view !== 'login' && view !== 'loading' && view !== 'loading_init'}
        onNavigateHome={() => setView('quotes')}
        activeView={view}
        onSelectMenu={(menu) => setView(menu)}
        onMaintenanceClick={() => setMaintenanceModalOpen(true)}
        onProfileClick={() => setProfileModalOpen(true)}
        isAdmin={currentUser?.role === 'admin'}
        onUsersClick={() => setView('users')}
        onLogout={handleLogout}
      />

      <main className={`relative z-10 flex-1 flex flex-col p-4 pt-2 md:p-10 md:pt-4 overflow-y-auto overflow-x-hidden ${isCenteredLayout ? 'items-center justify-center' : 'items-start justify-start'}`}>
        <AnimatePresence mode="wait">
          
          {(view === 'loading' || view === 'loading_init') && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-white/80 text-sm">
              <Loader2 className="animate-spin" size={32} />
              <p>{isLoading ? 'Memuat data quotes...' : 'Memuat Sistem Bengkel...'}</p>
              {view === 'loading_init' && (
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-xs text-white/60 hover:text-white underline transition-colors mt-2"
                >
                  Lanjut ke Login
                </button>
              )}
            </motion.div>
          )}

          {view === 'login' && (
            <LoginView onLogin={handleLogin} fadeVariants={fadeVariants} />
          )}

          {view === 'quotes' && (
            <QuoteList 
              quotes={userQuotes} 
              userName={currentUser?.name || ''}
              onSelectQuote={(quote: any) => { setSelectedQuote(quote); setView('worksheet'); }} 
              fadeVariants={fadeVariants} 
            />
          )}

          {view === 't2i' && (
            <Text2ImageView fadeVariants={fadeVariants} />
          )}

          {view === 'users' && currentUser?.role === 'admin' && (
            <UserManagement currentUserId={currentUser.id} onBack={() => setView('quotes')} fadeVariants={fadeVariants} />
          )}

          {view === 'worksheet' && selectedQuote && (
            <Worksheet 
              quote={selectedQuote} 
              onBack={() => setView('quotes')} 
              onUpdateQuote={handleUpdateQuote} 
              onDeleteQuote={handleDeleteQuote}
            />
          )}

        </AnimatePresence>
      </main>

      {/* MODALS */}
      <MaintenanceModal isOpen={isMaintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} user={currentUser} onUserUpdated={setCurrentUser} />
      
    </div>
  );
}