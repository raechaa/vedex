// lib/auth-actions.ts

'use server';

import pool from './db';
import { verifyPassword, createSession, destroySession, getSession, SessionUser } from './auth';

export type LoginResult = { success: true; user: SessionUser } | { success: false; error: string };

// LOGIN
export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Email dan password wajib diisi.' };
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
      [cleanEmail]
    );
    const row = result.rows[0];

    if (!row || !verifyPassword(password, row.password_hash)) {
      return { success: false, error: 'Email atau password salah.' };
    }
    if (!row.is_active) {
      return { success: false, error: 'Akun dinonaktifkan. Hubungi administrator.' };
    }

    const user: SessionUser = { id: String(row.id), email: row.email, name: row.name, role: row.role };
    await createSession(user);
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [row.id]);

    return { success: true, user };
  } catch (error) {
    console.error('Error login:', error);
    return { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' };
  }
}

// LOGOUT
export async function logoutAction() {
  await destroySession();
}

// CEK SESSION AKTIF
export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSession();
}
