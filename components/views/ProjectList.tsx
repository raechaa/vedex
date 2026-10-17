'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Folder, FolderOpen } from 'lucide-react';
import { getProjects } from '@/lib/actions';

export default function ProjectList({ projects, onAddProjectClick, onSelectProject, fadeVariants }) {
  const [projects, setProjects] = useState([]);
  
  useEffect(() => {
    // Langsung panggil server action
    getProjects().then(setProjects);
  }, [])
  
  return (
    <motion.div 
      layoutId="main-container" 
      key="projects" 
      variants={fadeVariants} 
      initial="hidden" 
      animate="visible" 
      exit="exit" 
      className="w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 text-white"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Pilih Project</h2>
        <button 
          onClick={onAddProjectClick} 
          className="flex items-center gap-2 bg-blue-500/50 hover:bg-blue-500/70 border border-blue-400/50 px-4 py-2 rounded-lg transition-colors shadow-lg backdrop-blur-sm text-sm"
        >
          <Plus size={16} /> Add Project
        </button>
      </div>
      
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen size={48} className="text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white/80 mb-2">Data Not Found</h3>
          <p className="text-sm text-white/50 max-w-md">Belum ada project yang tersedia. Silakan tambahkan project baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <button 
              key={proj.project_id} 
              onClick={() => onSelectProject(proj)} 
              className="flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/15 hover:border-white/30 hover:scale-[1.03] transition-all shadow-lg backdrop-blur-sm"
            >
              <Folder size={28} className="text-blue-300" />
              <span className="font-medium text-sm">{proj.project_name}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}