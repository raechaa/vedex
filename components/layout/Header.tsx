import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, LogOut, Info, Wrench, AlertTriangle, Users, Sparkles, Quote } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';

interface HeaderProps {
  isLoggedIn: boolean;
  onNavigateHome: () => void;
  onMaintenanceClick: () => void;
  onProfileClick: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  onUsersClick: () => void;
  activeView?: string;
  onSelectMenu?: (menu: 'quotes' | 't2i') => void;
}

export default function Header({ 
  isLoggedIn, 
  onNavigateHome, 
  onMaintenanceClick, 
  onProfileClick, 
  onLogout, 
  isAdmin, 
  onUsersClick,
  activeView = 'quotes',
  onSelectMenu,
}: HeaderProps) {
  const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const handleLogoutClick = () => {
    setProfileDropdownOpen(false);
    setLogoutConfirmOpen(true);
  };

  return (
    <>
      <header className="relative z-40 flex items-center justify-between px-4 py-3 md:px-10 md:py-6">
        <div className="flex items-center gap-3 md:gap-5">
          <h1 className="text-xl md:text-3xl font-bold tracking-wider cursor-pointer text-white flex items-center gap-2" onClick={onNavigateHome}>
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1 rounded-lg text-white shadow-lg">
              Vedex
            </span>
          </h1>

          {/* Menu di samping logo VEDEX: 1. T-2-I, 2. Quote */}
          {isLoggedIn && onSelectMenu && (
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl border border-white/20 backdrop-blur-md shadow-lg">
              <GlassButton
                type="button"
                onClick={() => onSelectMenu('t2i')}
                variant={activeView === 't2i' ? 'active' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <Sparkles size={14} className={activeView === 't2i' ? 'text-yellow-300' : 'text-white/60'} />
                <span>T-2-I</span>
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() => onSelectMenu('quotes')}
                variant={activeView === 'quotes' || activeView === 'worksheet' ? 'active' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <Quote size={14} className={activeView === 'quotes' || activeView === 'worksheet' ? 'text-yellow-300' : 'text-white/60'} />
                <span>Quote</span>
              </GlassButton>
            </div>
          )}
        </div>
        <nav className="flex gap-1.5 md:gap-3 text-xs md:text-sm font-medium items-center text-white">
          <GlassButton onClick={onMaintenanceClick} variant="subtle" size="sm" title="About">
            <Info size={14} /> <span className="hidden sm:inline">About</span>
          </GlassButton>
          <GlassButton onClick={onMaintenanceClick} variant="subtle" size="sm" title="Services">
            <Wrench size={14} /> <span className="hidden sm:inline">Services</span>
          </GlassButton>
          
          {isLoggedIn && (
            <div className="relative ml-1 md:ml-2">
              <GlassButton 
                onClick={() => setProfileDropdownOpen(!isProfileDropdownOpen)} 
                variant="default"
                size="icon"
                className="rounded-full h-9 w-9"
              >
                <User size={16} />
              </GlassButton>
              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-3 w-48 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                    <button onClick={() => { onProfileClick(); setProfileDropdownOpen(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/20 transition-colors text-left text-sm"><Settings size={16} /> Profile Settings</button>
                    {isAdmin && (
                      <button onClick={() => { onUsersClick(); setProfileDropdownOpen(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/20 transition-colors text-left text-sm"><Users size={16} /> Manajemen User</button>
                    )}
                    <div className="h-px bg-white/20 w-full"></div>
                    <button onClick={handleLogoutClick} className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/30 text-red-100 transition-colors text-left text-sm"><LogOut size={16} /> Logout</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>
      </header>

      {/* Konfirmasi Logout Modal */}
      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              className="relative w-full max-w-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-center text-white"
            >
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-full">
                  <AlertTriangle size={32} className="text-red-300" />
                </div>
              </div>
              <h2 className="text-xl font-bold mb-2">Konfirmasi Logout</h2>
              <p className="text-white/70 text-sm mb-6">Apakah Anda yakin ingin keluar dari sistem?</p>
              <div className="flex justify-center gap-3">
                <GlassButton 
                  onClick={() => setLogoutConfirmOpen(false)} 
                  variant="default"
                  size="default"
                >
                  Batal
                </GlassButton>
                <GlassButton 
                  onClick={() => { setLogoutConfirmOpen(false); onLogout(); }} 
                  variant="danger"
                  size="default"
                >
                  Ya, Logout
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}