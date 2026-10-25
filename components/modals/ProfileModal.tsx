import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Save, KeyRound } from 'lucide-react';
import { updateProfileNameAction, changePasswordAction } from '@/lib/user-actions';

const inputCls = 'w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-white/50';
const readonlyCls = 'w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white/60 outline-none cursor-not-allowed';

export default function ProfileModal({ isOpen, onClose, user, onUserUpdated }) {
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameMsg, setNameMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name || '');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setNameMsg(null); setPwMsg(null);
    }
  }, [isOpen, user]);

  const saveName = async () => {
    setBusy(true); setNameMsg(null);
    const res = await updateProfileNameAction(name);
    setBusy(false);
    if (res.success) {
      setNameMsg({ ok: true, text: res.message });
      onUserUpdated({ ...user, name: name.trim() });
    } else setNameMsg({ ok: false, text: res.error });
  };

  const savePassword = async () => {
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: 'Konfirmasi password tidak sama.' });
      return;
    }
    setBusy(true);
    const res = await changePasswordAction(currentPassword, newPassword);
    setBusy(false);
    if (res.success) {
      setPwMsg({ ok: true, text: res.message });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } else setPwMsg({ ok: false, text: res.error });
  };

  const Msg = ({ m }) => m ? <p className={`text-xs mt-2 ${m.ok ? 'text-green-300' : 'text-red-300'}`}>{m.text}</p> : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-white">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/20 border border-white/10 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20} /> Profile Settings</h2>

            <div className="space-y-4 text-sm mb-6">
              <div><label className="block text-white/60 mb-1">Email</label><input type="email" readOnly value={user?.email || ''} className={readonlyCls} /></div>
              <div><label className="block text-white/60 mb-1">Role</label><input type="text" readOnly value={user?.role || ''} className={readonlyCls} /></div>
              <div>
                <label className="block text-white/60 mb-1">Nama Lengkap</label>
                <div className="flex gap-2">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                  <button onClick={saveName} disabled={busy} className="px-3 bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 rounded-lg disabled:opacity-50" title="Simpan nama"><Save size={16} /></button>
                </div>
                <Msg m={nameMsg} />
              </div>
            </div>

            <div className="border-t border-white/20 pt-5 space-y-3 text-sm">
              <h3 className="font-semibold flex items-center gap-2"><KeyRound size={16} /> Reset Password</h3>
              <input type="password" placeholder="Password saat ini" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} />
              <input type="password" placeholder="Password baru (min. 8 karakter)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
              <input type="password" placeholder="Konfirmasi password baru" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
              <Msg m={pwMsg} />
              <button onClick={savePassword} disabled={busy || !currentPassword || !newPassword} className="w-full py-2 bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 rounded-lg transition-colors disabled:opacity-50">Ubah Password</button>
            </div>

            <div className="flex justify-end gap-3 text-sm mt-6">
              <button onClick={onClose} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg transition-colors">Tutup</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}