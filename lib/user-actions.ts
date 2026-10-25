// lib/user-actions.ts
'use server';

import pool from './db';
import { hashPassword, verifyPassword, createSession, getSession } from './auth';

export type ActionResult = { success: true; message?: string } | { success: false; error: string };

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

const ROLES = ['admin', 'user'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return null;
  return session;
}

// ===== ADMIN: LIST USER =====
export async function listUsers(): Promise<UserRow[]> {
  if (!(await requireAdmin())) return [];
  const result = await pool.query(
    `SELECT id::text AS id, email, name, role, is_active,
            last_login_at::text AS last_login_at, created_at::text AS created_at
     FROM users ORDER BY created_at DESC`
  );
  return result.rows;
}

// ===== ADMIN: ADD USER =====
export async function addUserAction(input: {
  email: string; name: string; password: string; role: string;
}): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: 'Akses ditolak.' };

  const email = (input.email || '').trim().toLowerCase();
  const name = (input.name || '').trim();
  if (!EMAIL_RE.test(email)) return { success: false, error: 'Format email tidak valid.' };
  if (!name) return { success: false, error: 'Nama lengkap wajib diisi.' };
  if (!ROLES.includes(input.role)) return { success: false, error: 'Role tidak valid.' };
  if (!input.password || input.password.length < MIN_PASSWORD) {
    return { success: false, error: `Password minimal ${MIN_PASSWORD} karakter.` };
  }

  try {
    await pool.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
      [email, name, hashPassword(input.password), input.role]
    );
    return { success: true, message: 'User berhasil ditambahkan.' };
  } catch (error: any) {
    if (error?.code === '23505') return { success: false, error: 'Email sudah terdaftar.' };
    console.error('Error add user:', error);
    return { success: false, error: 'Terjadi kesalahan server.' };
  }
}

// ===== ADMIN: EDIT USER =====
export async function updateUserAction(input: {
  id: string; email: string; name: string; role: string; is_active: boolean; password?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Akses ditolak.' };

  const email = (input.email || '').trim().toLowerCase();
  const name = (input.name || '').trim();
  if (!EMAIL_RE.test(email)) return { success: false, error: 'Format email tidak valid.' };
  if (!name) return { success: false, error: 'Nama lengkap wajib diisi.' };
  if (!ROLES.includes(input.role)) return { success: false, error: 'Role tidak valid.' };
  if (input.password && input.password.length < MIN_PASSWORD) {
    return { success: false, error: `Password minimal ${MIN_PASSWORD} karakter.` };
  }
  if (admin.id === input.id && (input.role !== 'admin' || !input.is_active)) {
    return { success: false, error: 'Anda tidak dapat menurunkan role / menonaktifkan akun sendiri.' };
  }

  try {
    const params: any[] = [email, name, input.role, input.is_active, input.id];
    let sql = 'UPDATE users SET email = $1, name = $2, role = $3, is_active = $4';
    if (input.password) {
      params.push(hashPassword(input.password));
      sql += `, password_hash = $${params.length}`;
    }
    sql += ' WHERE id = $5';
    const result = await pool.query(sql, params);
    if (result.rowCount === 0) return { success: false, error: 'User tidak ditemukan.' };

    // Sinkronkan cookie bila admin mengedit akunnya sendiri
    if (admin.id === input.id) {
      await createSession({ id: admin.id, email, name, role: input.role });
    }
    return { success: true, message: 'User berhasil diperbarui.' };
  } catch (error: any) {
    if (error?.code === '23505') return { success: false, error: 'Email sudah terdaftar.' };
    console.error('Error update user:', error);
    return { success: false, error: 'Terjadi kesalahan server.' };
  }
}

// ===== SEMUA ROLE: UBAH NAMA LENGKAP =====
export async function updateProfileNameAction(name: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Sesi berakhir, silakan login ulang.' };

  const clean = (name || '').trim();
  if (!clean) return { success: false, error: 'Nama lengkap wajib diisi.' };
  if (clean.length > 150) return { success: false, error: 'Nama maksimal 150 karakter.' };

  try {
    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [clean, session.id]);
    await createSession({ ...session, name: clean });
    return { success: true, message: 'Nama berhasil diperbarui.' };
  } catch (error) {
    console.error('Error update name:', error);
    return { success: false, error: 'Terjadi kesalahan server.' };
  }
}

// ===== SEMUA ROLE: RESET / GANTI PASSWORD =====
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Sesi berakhir, silakan login ulang.' };

  if (!currentPassword) return { success: false, error: 'Password saat ini wajib diisi.' };
  if (!newPassword || newPassword.length < MIN_PASSWORD) {
    return { success: false, error: `Password baru minimal ${MIN_PASSWORD} karakter.` };
  }

  try {
    const res = await pool.query('SELECT password_hash FROM users WHERE id = $1', [session.id]);
    const row = res.rows[0];
    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      return { success: false, error: 'Password saat ini salah.' };
    }
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      hashPassword(newPassword),
      session.id,
    ]);
    return { success: true, message: 'Password berhasil diubah.' };
  } catch (error) {
    console.error('Error change password:', error);
    return { success: false, error: 'Terjadi kesalahan server.' };
  }
}
