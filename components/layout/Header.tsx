import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, LogOut } from 'lucide-react';

export default function Header({ isLoggedIn, onNavigateHome, onMaintenanceClick, onProfileClick, onLogout }) {
  const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    // Padding dikecilkan untuk HP (px-4 py-3), kembali besar saat di Desktop (md:px-10 md:py-6)
    <header className="relative z-40 flex items-center justify-between px-4 py-3 md:px-10 md:py-6">
      <h1 className="text-xl md:text-3xl font-bold tracking-wider cursor-pointer text-white" onClick={onNavigateHome}>
        Logo
      </h1>
      <nav className="flex gap-2 md:gap-4 text-xs md:text-sm font-medium items-center text-white">
        <button onClick={onMaintenanceClick} className="px-3 py-1.5 md:px-5 md:py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors shadow-lg backdrop-blur-sm">
          About
        </button>
        <button onClick={onMaintenanceClick} className="px-3 py-1.5 md:px-5 md:py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors shadow-lg backdrop-blur-sm">
          Services
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
                  <button onClick={() => { onLogout(); setProfileDropdownOpen(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/30 text-red-100 transition-colors text-left text-sm"><LogOut size={16} /> Logout</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>
    </header>
  );
}