import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';

export default function AddProjectModal({ isOpen, onClose, onAdd }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-white">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/20 border border-white/10 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Plus size={20} /> New Project</h2>
            <form onSubmit={onAdd}>
              <div className="space-y-4 text-sm mb-8">
                <div>
                  <label className="block text-white/80 mb-2">Nama Project</label>
                  <input type="text" name="project_name" required placeholder="Masukkan nama project..." className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-400/50 transition-colors" />
                </div>
              </div>
              <div className="flex justify-end gap-3 text-sm">
                <button type="button" onClick={onClose} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-500/60 hover:bg-blue-500/80 border border-blue-400/50 rounded-lg transition-colors shadow-lg backdrop-blur-sm font-medium">Create</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}