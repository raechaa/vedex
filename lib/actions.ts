// lib/actions.ts

'use server';

import pool from './db';

// ===== QUOTE ACTIONS =====

// GET ALL QUOTES
export async function getQuotes() {
  const result = await pool.query('SELECT * FROM quote ORDER BY created_at DESC');
  return result.rows;
}

// GET QUOTE BY ID
export async function getQuoteById(quoteId: string) {
  const result = await pool.query('SELECT * FROM quote WHERE quote_id = $1', [quoteId]);
  return result.rows[0] || null;
}

// UPDATE QUOTE
export async function updateQuote(quoteId: string, data: any) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) return null;
  
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const query = `UPDATE quote SET ${setClause} WHERE quote_id = $${fields.length + 1} RETURNING *`;
  
  const result = await pool.query(query, [...values, quoteId]);
  return result.rows[0];
}

// UPDATE QUOTE STATUS
export async function updateQuoteStatus(quoteId: string, status: string) {
  const result = await pool.query(
    'UPDATE quote SET status = $1 WHERE quote_id = $2 RETURNING *',
    [status, quoteId]
  );
  return result.rows[0];
}

// UPDATE QUOTE HASHTAG (RAW DATA FROM AGENT)
export async function updateQuoteHashtag(quoteId: string, rawAgentData: string) {
  const result = await pool.query(
    'UPDATE quote SET hashtag = $1, agent_stat = $2 WHERE quote_id = $3 RETURNING *',
    [rawAgentData, 'suggestion_complete', quoteId]
  );
  return result.rows[0];
}

// UPDATE QUOTE HOOK TEXT (FROM PROMPT ENGINEER AGENT)
export async function updateQuoteHookText(quoteId: string, hookText: string) {
  const result = await pool.query(
    'UPDATE quote SET hook_text = $1, agent_stat = $2 WHERE quote_id = $3 RETURNING *',
    [hookText, 'hook_complete', quoteId]
  );
  return result.rows[0];
}