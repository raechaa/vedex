import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Pencil, X, Loader2, ArrowLeft } from 'lucide-react';
import { listUsers, addUserAction, updateUserAction } from '@/lib/user-actions';

const inputCls = 'w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-white/50';
const emptyForm = { id: '', email: '', name: '', role: 'user', is_active: true, password: '' };

export default function UserManagement({ currentUserId, onBack, fadeVariants }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = modal tertutup
  const [isEdit, setIsEdit] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await listUsers());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ ...emptyForm }); setIsEdit(false); setError(''); };
  const openEdit = (u) => { setForm({ ...u, password: '' }); setIsEdit(true); setError(''); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setError('');
    const res = isEdit ? await updateUserAction(form) : await addUserAction(form);
    setSaving(false);
    if (res.success) { setForm(null); load(); } else setError(res.error);
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('id-ID') : '-';

  return (
    <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-5xl mx-auto flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg"><ArrowLeft size={16} /></button>
          <h2 className="text-xl md:text-2xl font-bold">Manajemen User</h2>
        </div>
        <button onClick={openAdd} className="px-4 py-2 text-sm bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 rounded-lg flex items-center gap-2"><UserPlus size={16} /> Tambah User</button>
      </div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl overflow-auto max-h-[70dvh]">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-white/60 border-b border-white/20">
              <tr>
                <th className="px-4 py-3">Nama</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3 hidden md:table-cell">Login Terakhir</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>{u.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td className="px-4 py-3 hidden md:table-cell text-white/60">{fmt(u.last_login_at)}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(u)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Edit"><Pencil size={14} /></button></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Belum ada user.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {form && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-white">
              <button onClick={() => setForm(null)} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/20 border border-white/10 rounded-full"><X size={18} /></button>
              <h3 className="text-xl font-bold mb-5">{isEdit ? 'Edit User' : 'Tambah User'}</h3>
              <div className="space-y-3 text-sm">
                <div><label className="block text-white/60 mb-1">Nama Lengkap</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></div>
                <div><label className="block text-white/60 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></div>
                <div>
                  <label className="block text-white/60 mb-1">{isEdit ? 'Password Baru (kosongkan bila tidak diubah)' : 'Password'}</label>
                  <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 karakter" className={inputCls} />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">Role</label>
                  <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
                    <option value="user" className="text-black">user</option>
                    <option value="admin" className="text-black">admin</option>
                  </select>
                </div>
                {isEdit && (
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Akun aktif</label>
                )}
                {error && <p className="text-red-300 text-xs">{error}</p>}
              </div>
              <div className="flex justify-end gap-3 text-sm mt-6">
                <button onClick={() => setForm(null)} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg">Batal</button>
                <button onClick={submit} disabled={saving} className="px-5 py-2 bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 rounded-lg disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
