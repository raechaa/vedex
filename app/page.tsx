'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// --- IMPORTS DATA & COMPONENTS ---
import { DUMMY_PROJECTS, DUMMY_QUOTES } from '@/lib/dummy-data';
import Header from '@/components/layout/Header';
import LoginView from '@/components/views/LoginView';
import ProjectList from '@/components/views/ProjectList';
import ProjectDetail from '@/components/views/ProjectDetail';
import Worksheet from '@/components/views/Worksheet';
import MaintenanceModal from '@/components/modals/MaintenanceModal';
import AddProjectModal from '@/components/modals/AddProjectModal';
import ProfileModal from '@/components/modals/ProfileModal';

export default function App() {
  // GLOBAL STATE
  const [view, setView] = useState('loading_init'); // Default ke loading untuk cek LocalStorage dulu
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDraft, setSelectedDraft] = useState(null); 
  const [userProjects, setUserProjects] = useState([]);
  const [userQuotes, setUserQuotes] = useState([]);

  // MODAL STATE
  const [isMaintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isAddProjectModalOpen, setAddProjectModalOpen] = useState(false);

  // --- LOCAL STORAGE INIT (Auto Login) ---
  useEffect(() => {
    const sessionActive = localStorage.getItem('bengkel_session');
    const savedProjects = localStorage.getItem('bengkel_projects');
    const savedQuotes = localStorage.getItem('bengkel_quotes');

    if (sessionActive === 'true' && savedProjects && savedQuotes) {
      // Jika sudah pernah login dan ada data, langsung load
      setUserProjects(JSON.parse(savedProjects));
      setUserQuotes(JSON.parse(savedQuotes));
      setView('projects');
    } else {
      // Jika belum, tampilkan halaman login
      setView('login');
    }
  }, []);

  // LOGIC ACTIONS
  const handleLogin = (e) => { 
    e.preventDefault(); 
    setView('loading');
    
    setTimeout(() => {
      // Cek apakah sebelumnya sudah ada data di local storage (sebelum logout)
      const savedProjects = localStorage.getItem('bengkel_projects');
      const savedQuotes = localStorage.getItem('bengkel_quotes');

      if (savedProjects && savedQuotes) {
        setUserProjects(JSON.parse(savedProjects));
        setUserQuotes(JSON.parse(savedQuotes));
      } else {
        // Jika benar-benar kosong, pakai Dummy Data
        setUserProjects(DUMMY_PROJECTS);
        setUserQuotes(DUMMY_QUOTES);
        localStorage.setItem('bengkel_projects', JSON.stringify(DUMMY_PROJECTS));
        localStorage.setItem('bengkel_quotes', JSON.stringify(DUMMY_QUOTES));
      }
      
      // Set Session Login
      localStorage.setItem('bengkel_session', 'true');
      setView('projects');
    }, 1000);
  };

  const handleLogout = () => {
    // Hapus sesi login, TAPI biarkan data project & quotes tetap aman di memori
    localStorage.removeItem('bengkel_session');
    setView('login');
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newProject = { 
      project_id: `proj-00${userProjects.length + 1}`, 
      project_name: formData.get('project_name') 
    };
    
    const updatedProjects = [...userProjects, newProject];
    setUserProjects(updatedProjects);
    
    // Simpan perubahan ke LocalStorage
    localStorage.setItem('bengkel_projects', JSON.stringify(updatedProjects));
    setAddProjectModalOpen(false);
  };

  const handleUpdateQuote = (updatedData) => {
    setSelectedDraft(updatedData);
    
    const updatedQuotes = userQuotes.map(q => q.quote_id === updatedData.quote_id ? updatedData : q);
    setUserQuotes(updatedQuotes);
    
    // Simpan perubahan ke LocalStorage
    localStorage.setItem('bengkel_quotes', JSON.stringify(updatedQuotes));
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
        onNavigateHome={() => setView('projects')}
        onMaintenanceClick={() => setMaintenanceModalOpen(true)}
        onProfileClick={() => setProfileModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className={`relative z-10 flex-1 flex flex-col p-4 pt-2 md:p-10 md:pt-4 overflow-hidden ${isCenteredLayout ? 'items-center justify-center' : 'items-start justify-start'}`}>
        <AnimatePresence mode="wait">
          
          {(view === 'loading' || view === 'loading_init') && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-white/80 text-sm">
              <Loader2 className="animate-spin" size={32} />
              <p>Memuat Sistem Bengkel...</p>
            </motion.div>
          )}

          {view === 'login' && (
            <LoginView onLogin={handleLogin} fadeVariants={fadeVariants} />
          )}

          {view === 'projects' && (
            <ProjectList 
              projects={userProjects} 
              onAddProjectClick={() => setAddProjectModalOpen(true)} 
              onSelectProject={(proj) => { setSelectedProject(proj); setView('project-detail'); }} 
              fadeVariants={fadeVariants} 
            />
          )}

          {view === 'project-detail' && selectedProject && (
            <ProjectDetail 
              project={selectedProject} 
              quotes={userQuotes.filter(q => q.project_id === selectedProject.project_id)} 
              onBack={() => setView('projects')} 
              onDraftClick={(item) => { setSelectedDraft(item); setView('worksheet'); }} 
            />
          )}

          {view === 'worksheet' && selectedDraft && (
            <Worksheet 
              project={selectedProject} 
              draft={selectedDraft} 
              onBack={() => setView('project-detail')} 
              onUpdateQuote={handleUpdateQuote} 
            />
          )}

        </AnimatePresence>
      </main>

      {/* MODALS */}
      <AddProjectModal isOpen={isAddProjectModalOpen} onClose={() => setAddProjectModalOpen(false)} onAdd={handleAddProject} />
      <MaintenanceModal isOpen={isMaintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
      
    </div>
  );
}
