import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { DUMMY_PROFILE } from '@/lib/dummy-data';

export default function ProfileModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-white">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/20 border border-white/10 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20} /> Profile Settings</h2>
            
            <div className="space-y-4 text-sm mb-6">
              <div><label className="block text-white/60 mb-1">Username</label><input type="text" readOnly defaultValue={DUMMY_PROFILE.username} className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white/80 outline-none cursor-not-allowed" /></div>
              <div><label className="block text-white/60 mb-1">Nama Lengkap</label><input type="text" readOnly defaultValue={DUMMY_PROFILE.fullName} className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white/80 outline-none cursor-not-allowed" /></div>
              <div><label className="block text-white/60 mb-1">Email Address</label><input type="email" readOnly defaultValue={DUMMY_PROFILE.email} className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white/80 outline-none cursor-not-allowed" /></div>
            </div>
            
            <div className="flex justify-end gap-3 text-sm">
              <button onClick={onClose} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg transition-colors">Tutup</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}