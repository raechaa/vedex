import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, LogOut, Info, Wrench, AlertTriangle } from 'lucide-react';

export default function Header({ isLoggedIn, onNavigateHome, onMaintenanceClick, onProfileClick, onLogout }) {
  const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const handleLogoutClick = () => {
    setProfileDropdownOpen(false);
    setLogoutConfirmOpen(true);
  };

  return (
    <>
      <header className="relative z-40 flex items-center justify-between px-4 py-3 md:px-10 md:py-6">
        <h1 className="text-xl md:text-3xl font-bold tracking-wider cursor-pointer text-white flex items-center gap-2" onClick={onNavigateHome}>
          <span className="bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1 rounded-lg text-white shadow-lg">
            Vedex
          </span>
        </h1>
        <nav className="flex gap-2 md:gap-4 text-xs md:text-sm font-medium items-center text-white">
          <button onClick={onMaintenanceClick} className="px-3 py-1.5 md:px-5 md:py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors shadow-lg backdrop-blur-sm flex items-center gap-1.5">
            <Info size={14} /> About
          </button>
          <button onClick={onMaintenanceClick} className="px-3 py-1.5 md:px-5 md:py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors shadow-lg backdrop-blur-sm flex items-center gap-1.5">
            <Wrench size={14} /> Services
          </button>
          
          {isLoggedIn && (
            <div className="relative ml-1 md:ml-2">
              <button 
                onClick={() => setProfileDropdownOpen(!isProfileDropdownOpen)} 
                className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-colors shadow-lg backdrop-blur-sm flex items-center justify-center"
              >
                <User size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-3 w-48 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                    <button onClick={() => { onProfileClick(); setProfileDropdownOpen(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/20 transition-colors text-left text-sm"><Settings size={16} /> Profile Settings</button>
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
                <button 
                  onClick={() => setLogoutConfirmOpen(false)} 
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={() => { setLogoutConfirmOpen(false); onLogout(); }} 
                  className="px-5 py-2.5 bg-red-500/60 hover:bg-red-500/80 border border-red-400/50 rounded-lg transition-colors text-sm font-medium"
                >
                  Ya, Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}