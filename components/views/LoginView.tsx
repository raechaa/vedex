import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginView({ onLogin, fadeVariants }) {
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validasi sederhana
    if (!email.trim() || !password.trim()) {
      setError('Email dan password wajib diisi.');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format email tidak valid.');
      return;
    }
    
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    
    setError('');
    onLogin(e);
  };

  return (
    <motion.div 
      key="login" 
      variants={fadeVariants} 
      initial="hidden" 
      animate="visible" 
      exit="exit" 
      className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-6 md:p-8 text-white"
    >
      <h2 className="text-2xl md:text-3xl font-semibold text-center mb-6 md:mb-8">Login</h2>
      
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 text-red-200 text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 md:gap-6 text-sm">
        <div className="relative border-b border-white/40 pb-2">
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent outline-none placeholder-white/70" 
          />
        </div>
        <div className="relative border-b border-white/40 pb-2">
          <input 
            type={showPassword ? 'text' : 'password'} 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent outline-none placeholder-white/70 pr-8" 
          />
          <button 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button type="submit" className="mt-2 md:mt-4 w-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors py-3 rounded-lg font-medium shadow-lg backdrop-blur-sm text-sm">
          Login
        </button>
      </form>
    </motion.div>
  );
}