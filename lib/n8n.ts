import { config } from './config';

/**
 * Call n8n webhook untuk proses generate video.
 * Endpoint belum tersedia, akan diisi nanti.
 */
export async function callN8n(payload: string): Promise<unknown> {
  if (!config.n8n.webhookUrl) {
    console.warn('N8N_WEBHOOK_URL belum dikonfigurasi. Payload tidak dikirim.');
    return { success: false, message: 'N8N_WEBHOOK_URL belum dikonfigurasi' };
  }

  try {
    const response = await fetch(config.n8n.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload }),
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling n8n:', error);
    throw error;
  }
}