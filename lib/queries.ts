import pool from './db';

// ===== PROJECT QUERIES =====
export async function getProjects() {
  const result = await pool.query('SELECT * FROM project ORDER BY project_name');
  return result.rows;
}

export async function getProjectById(projectId: string) {
  const result = await pool.query('SELECT * FROM project WHERE project_id = $1', [projectId]);
  return result.rows[0] || null;
}

// ===== QUOTE QUERIES =====
export async function getQuotesByProjectId(projectId: string) {
  const result = await pool.query(
    'SELECT * FROM quote WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId]
  );
  return result.rows;
}

export async function getQuoteById(quoteId: string) {
  const result = await pool.query('SELECT * FROM quote WHERE quote_id = $1', [quoteId]);
  return result.rows[0] || null;
}

export async function updateQuote(quoteId: string, data: Partial<Quote>) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) return null;
  
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const query = `UPDATE quote SET ${setClause} WHERE quote_id = $${fields.length + 1} RETURNING *`;
  
  const result = await pool.query(query, [...values, quoteId]);
  return result.rows[0] || null;
}

// ===== TYPES =====
export interface Project {
  project_id: string;
  project_name: string;
  created_at?: Date;
}

export interface Quote {
  quote_id: string;
  project_id: string;
  public_figure: string;
  quote_text: string;
  main_topic: string;
  interpretation: string;
  real_life_event: string;
  fun_fact: string;
  status: string;
  url: string;
  agent_stat: string;
  hashtag: string;
  data: any;
  hook_text: string;
  main_text: string;
  cta_text: string;
  created_at?: Date;
}