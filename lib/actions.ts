// lib/actions.ts

'use server';

import pool from './db';

// ===== QUOTE ACTIONS =====

// GET ALL QUOTES
export async function getQuotes() {
  try {
    const result = await pool.query('SELECT * FROM quote ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching quotes:', error);
    throw new Error('Gagal mengambil data quotes dari database.');
  }
}

// GET QUOTE BY ID
export async function getQuoteById(quoteId: string) {
  try {
    const result = await pool.query('SELECT * FROM quote WHERE quote_id = $1', [quoteId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching quote by ID:', error);
    throw new Error('Gagal mengambil data quote.');
  }
}

// UPDATE QUOTE
export async function updateQuote(quoteId: string, data: any) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) return null;
  
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const query = `UPDATE quote SET ${setClause} WHERE quote_id = $${fields.length + 1} RETURNING *`;
  
  try {
    const result = await pool.query(query, [...values, quoteId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating quote:', error);
    throw new Error('Gagal mengupdate quote.');
  }
}

// UPDATE QUOTE STATUS
export async function updateQuoteStatus(quoteId: string, status: string) {
  try {
    const result = await pool.query(
      'UPDATE quote SET status = $1 WHERE quote_id = $2 RETURNING *',
      [status, quoteId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating quote status:', error);
    throw new Error('Gagal mengupdate status quote.');
  }
}

// UPDATE QUOTE HASHTAG (RAW DATA FROM AGENT) + agent_stat = "Hashtag - DONE"
export async function updateQuoteHashtag(quoteId: string, rawAgentData: string) {
  try {
    const result = await pool.query(
      'UPDATE quote SET hashtag = $1, agent_stat = $2 WHERE quote_id = $3 RETURNING *',
      [rawAgentData, 'Hashtag - DONE', quoteId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating quote hashtag:', error);
    throw new Error('Gagal mengupdate hashtag quote.');
  }
}

// UPDATE QUOTE HOOK TEXT (FROM PROMPT ENGINEER AGENT) + agent_stat = "Hook - DONE"
export async function updateQuoteHookText(quoteId: string, hookText: string) {
  try {
    const result = await pool.query(
      'UPDATE quote SET hook_text = $1, agent_stat = $2 WHERE quote_id = $3 RETURNING *',
      [hookText, 'Hook - DONE', quoteId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating quote hook text:', error);
    throw new Error('Gagal mengupdate hook text quote.');
  }
}

// UPDATE QUOTE MAIN TEXT (POINT VIDEO) + agent_stat = "Main Video - DONE"
export async function updateQuoteMainText(quoteId: string, mainText: string) {
  try {
    const result = await pool.query(
      'UPDATE quote SET main_text = $1, agent_stat = $2 WHERE quote_id = $3 RETURNING *',
      [mainText, 'Main Video - DONE', quoteId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating quote main text:', error);
    throw new Error('Gagal mengupdate main text quote.');
  }
}

// DELETE QUOTE
export async function deleteQuote(quoteId: string) {
  try {
    const result = await pool.query('DELETE FROM quote WHERE quote_id = $1 RETURNING *', [quoteId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting quote:', error);
    throw new Error('Gagal menghapus quote.');
  }
}

// GET QUOTE STATISTICS
export async function getQuoteStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'Draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'Published') as published_count,
        COUNT(DISTINCT public_figure) as total_figures,
        COUNT(DISTINCT main_topic) as total_topics
      FROM quote
    `);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching quote stats:', error);
    throw new Error('Gagal mengambil statistik quotes.');
  }
}