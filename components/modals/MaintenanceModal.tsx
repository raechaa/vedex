import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function MaintenanceModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-10 text-center text-white">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/20 border border-white/10 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-2xl font-bold mb-4">Coming Soon</h2>
            <p className="text-white/80 text-sm">Fitur ini sedang dalam tahap pengembangan.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}