import React from 'react';
import { motion } from 'framer-motion';

export default function LoginView({ onLogin, fadeVariants }) {
  return (
    <motion.div 
      key="login" 
      variants={fadeVariants} 
      initial="hidden" 
      animate="visible" 
      exit="exit" 
      // Tambahkan w-full dan mx-auto agar fleksibel di layar kecil
      className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-6 md:p-8 text-white"
    >
      <h2 className="text-2xl md:text-3xl font-semibold text-center mb-6 md:mb-8">Login</h2>
      <form onSubmit={onLogin} className="flex flex-col gap-5 md:gap-6 text-sm">
        <div className="relative border-b border-white/40 pb-2">
          <input type="email" placeholder="Email" required defaultValue="admin@demo.com" className="w-full bg-transparent outline-none placeholder-white/70" />
        </div>
        <div className="relative border-b border-white/40 pb-2">
          <input type="password" placeholder="Password" required defaultValue="admin123" className="w-full bg-transparent outline-none placeholder-white/70" />
        </div>
        <button type="submit" className="mt-2 md:mt-4 w-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors py-3 rounded-lg font-medium shadow-lg backdrop-blur-sm text-sm">
          Login
        </button>
      </form>
    </motion.div>
  );
}