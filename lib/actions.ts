// lib/actions.ts

'use server';

import pool from './db';
import { getSession } from './auth';
import { callQuoteResearcher } from './librechat';

async function requireSession() {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized: silakan login terlebih dahulu.');
  return user;
}

// ===== QUOTE ACTIONS =====

// GET ALL QUOTES
export async function getQuotes() {
  await requireSession();
  try {
    const result = await pool.query('SELECT * FROM quote ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching quotes:', error);
    throw new Error('Gagal mengambil data quotes dari database.');
  }
}

// RUN QUOTE RESEARCH: panggil agent QuoteReseacher, simpan tiap finding sebagai 1 baris
export async function runQuoteQuery(queryText: string) {
  await requireSession();
  const q = (queryText || '').trim();
  if (!q) throw new Error('Query tidak boleh kosong.');

  const result = await callQuoteResearcher(q);
  const toText = (v: unknown) =>
    Array.isArray(v) ? v.map(String).join('\n') : v == null ? null : String(v);

  let count = 0;
  for (const f of result.findings) {
    try {
      await pool.query(
        `INSERT INTO quote (public_figure, quote_text, main_topic, interpretation, real_life_event, fun_fact, related_event, url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft')`,
        [
          toText(f.public_figure),
          toText(f.quote_text),
          toText(f.main_topic),
          toText(f.interpretation),
          toText(f.real_life_event),
          toText(f.fun_fact),
          toText(f.related_event),
          toText(f.url),
        ]
      );
      count++;
    } catch (error) {
      console.error('Error inserting finding:', error);
      throw new Error(`Gagal menyimpan finding ke database (tersimpan ${count}).`);
    }
  }
  return { count };
}

// UPDATE QUOTE
export async function updateQuote(quoteId: string, data: any) {
  await requireSession();
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

// UPDATE QUOTE HASHTAG (RAW DATA FROM AGENT) + agent_stat = "Hashtag - DONE"
export async function updateQuoteHashtag(quoteId: string, rawAgentData: string) {
  await requireSession();
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

// UPDATE QUOTE HOOK TEXT (FROM IMAGE GENERATOR AGENT) + agent_stat = "Hook - DONE"
export async function updateQuoteHookText(quoteId: string, hookText: string) {
  await requireSession();
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

// DELETE QUOTE
export async function deleteQuote(quoteId: string | number) {
  await requireSession();
  try {
    const result = await pool.query('DELETE FROM quote WHERE quote_id = $1 RETURNING quote_id', [quoteId]);
    if (result.rowCount === 0) {
      throw new Error('Quote tidak ditemukan di database.');
    }

    // Bersihkan file S3 terkait jika ada
    if (process.env.S3_ACCESS_KEY && process.env.S3_BUCKET) {
      try {
        const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
          region: process.env.S3_REGION || 'us-east-1',
          endpoint: process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id',
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || '',
            secretAccessKey: process.env.S3_SECRET_KEY || '',
          },
        });
        const listRes = await s3.send(
          new ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET,
            Prefix: `quote-${quoteId}-`,
          })
        );
        if (listRes.Contents && listRes.Contents.length > 0) {
          const toDelete = listRes.Contents.filter((c) => c.Key).map((c) => ({ Key: c.Key! }));
          if (toDelete.length > 0) {
            await s3.send(
              new DeleteObjectsCommand({
                Bucket: process.env.S3_BUCKET,
                Delete: { Objects: toDelete },
              })
            );
          }
        }
      } catch (s3Error) {
        console.warn('Gagal membersihkan aset S3 untuk quote:', quoteId, s3Error);
      }
    }

    return { success: true, quote_id: quoteId };
  } catch (error) {
    console.error('Error deleting quote:', error);
    throw new Error(error instanceof Error ? error.message : 'Gagal menghapus quote dari database.');
  }
}

