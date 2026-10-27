'use server';

import pool from './db';
import { getSession } from './auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function requireSession() {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized: silakan login terlebih dahulu.');
  return user;
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function getT2IHeaders(): Record<string, string> {
  const headerName = process.env.t2i_header || process.env.T2I_HEADER || 'X-API-Key';
  const headerValue = process.env.t2i_value || process.env.T2I_VALUE || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, image/*, */*',
  };
  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }
  return headers;
}

/**
 * Mengambil base_url terakhir dari tabel text2image
 */
export async function getBaseUrl(): Promise<string> {
  await requireSession();
  try {
    const res = await pool.query('SELECT base_url FROM text2image ORDER BY id DESC LIMIT 1');
    if (res.rows.length > 0 && res.rows[0].base_url) {
      return res.rows[0].base_url;
    }
    return '';
  } catch (error) {
    console.error('Error fetching base_url from text2image:', error);
    return '';
  }
}

/**
 * Menyimpan atau memperbarui base_url di tabel text2image
 */
export async function saveBaseUrl(url: string): Promise<{ success: boolean; baseUrl: string; message?: string }> {
  await requireSession();
  const trimmed = cleanUrl(url || '');
  if (!trimmed) {
    throw new Error('Url Model tidak boleh kosong.');
  }

  try {
    const existing = await pool.query('SELECT id FROM text2image ORDER BY id DESC LIMIT 1');
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE text2image SET base_url = $1, updated_at = NOW() WHERE id = $2',
        [trimmed, existing.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO text2image (base_url) VALUES ($1)',
        [trimmed]
      );
    }
    return { success: true, baseUrl: trimmed, message: 'Url Model berhasil disimpan!' };
  } catch (error) {
    console.error('Error saving base_url:', error);
    throw new Error('Gagal menyimpan Url Model ke database.');
  }
}

/**
 * Server action untuk mengecek health status server model
 * GET base_url/health
 * Header: X-API-Key dari .env
 * Respon sukses: { "status": "ok", "text_to_image": true }
 */
export async function checkModelHealth(baseUrl: string): Promise<boolean> {
  const clean = cleanUrl(baseUrl);
  if (!clean) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 detik timeout

    const headers = getT2IHeaders();
    const res = await fetch(`${clean}/health`, {
      method: 'GET',
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);

    if (!res.ok) return false;

    const data = await res.json();
    return data?.status === 'ok' && data?.text_to_image === true;
  } catch (error) {
    return false;
  }
}

/**
 * Server action untuk memanggil API /generate
 * Format request:
 * {
 *   prompt: string,
 *   negative_prompt: string,
 *   width: number,
 *   height: number,
 *   steps: number,
 *   seed: number
 * }
 * Header: X-API-Key dari .env
 * Respons JSON: { status: "success", filename: "...", seed: 42, message: "Image generated" }
 * Selanjutnya fetch file gambar dari base_url/outputs/<filename>
 */
export async function callGenerateImage(
  baseUrl: string,
  payload: {
    prompt: string;
    negative_prompt?: string;
    width: number;
    height: number;
    steps?: number;
    seed?: number;
    num_inference_steps?: number;
  }
) {
  await requireSession();
  const clean = cleanUrl(baseUrl);
  if (!clean) throw new Error('Base URL Model belum ditentukan.');
  if (!payload.prompt?.trim()) throw new Error('Prompt tidak boleh kosong.');

  const targetUrl = `${clean}/generate`;
  const headers = getT2IHeaders();

  const requestBody = {
    prompt: payload.prompt.trim(),
    negative_prompt: payload.negative_prompt ?? '',
    width: Number(payload.width) || 720,
    height: Number(payload.height) || 1280,
    steps: Number(payload.steps ?? payload.num_inference_steps ?? 30),
    seed: typeof payload.seed === 'number' ? payload.seed : 42,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000); // 3 menit timeout

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`API error (${response.status} ${response.statusText}): ${errText || 'Tidak ada pesan error dari model'}`);
    }

    const contentType = response.headers.get('content-type') || '';
    
    // 1. Jika respons adalah binary image langsung
    if (contentType.startsWith('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      return { success: true, image: base64, images: [base64], raw: { type: 'binary_image' } };
    }

    // 2. Jika respons JSON
    const data = await response.json();

    // 2a. Spesifikasi baru: jika respons memiliki filename, fetch dari base_url/outputs/<filename>
    if (data.filename) {
      const outputUrl = `${clean}/outputs/${data.filename}`;
      const fileHeaders: Record<string, string> = {
        'Accept': 'image/*, */*',
      };
      const headerName = process.env.t2i_header || process.env.T2I_HEADER || 'X-API-Key';
      const headerValue = process.env.t2i_value || process.env.T2I_VALUE || '';
      if (headerName && headerValue) {
        fileHeaders[headerName] = headerValue;
      }

      const fileRes = await fetch(outputUrl, {
        method: 'GET',
        headers: fileHeaders,
      });

      if (!fileRes.ok) {
        const errText = await fileRes.text().catch(() => '');
        throw new Error(`Gagal mengambil gambar dari ${outputUrl} (${fileRes.status} ${fileRes.statusText}): ${errText || 'Tidak ada pesan error'}`);
      }

      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const fileContentType = fileRes.headers.get('content-type') || 'image/png';
      const base64 = `data:${fileContentType};base64,${fileBuffer.toString('base64')}`;

      return {
        success: true,
        image: base64,
        images: [base64],
        filename: data.filename,
        seed: data.seed ?? requestBody.seed,
        message: data.message || 'Image generated',
        raw: {
          generateResponse: data,
          outputUrl,
        },
      };
    }

    // 2b. Fallback parsing jika model mengembalikan format lain
    let images: string[] = [];

    if (Array.isArray(data)) {
      images = data;
    } else if (Array.isArray(data.images)) {
      images = data.images;
    } else if (data.image) {
      images = [data.image];
    } else if (data.output && Array.isArray(data.output)) {
      images = data.output;
    } else if (data.output && typeof data.output === 'string') {
      images = [data.output];
    } else if (data.url) {
      images = [data.url];
    } else if (data.image_url) {
      images = [data.image_url];
    } else {
      // Coba cari field yang mengandung base64 atau url
      for (const key of Object.keys(data)) {
        if (typeof data[key] === 'string' && (data[key].startsWith('http') || data[key].startsWith('data:image') || data[key].length > 1000)) {
          images.push(data[key]);
        }
      }
    }

    // Normalisasi base64 string jika belum memiliki data URI prefix
    images = images.map((img) => {
      if (typeof img === 'string') {
        if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/')) {
          return img;
        }
        // Jika plain base64
        return `data:image/png;base64,${img}`;
      }
      return String(img);
    });

    if (images.length === 0) {
      return {
        success: true,
        image: '',
        images: [],
        raw: data,
        message: 'API merespons berhasil, tetapi format gambar tidak terdeteksi otomatis.',
      };
    }

    return { success: true, image: images[0], images, raw: data };
  } catch (error: any) {
    console.error('Error generating image:', error);
    if (error.name === 'AbortError') {
      throw new Error('Koneksi ke API model timeout setelah 3 menit.');
    }
    throw new Error(error.message || 'Gagal memanggil API generate image.');
  }
}

/**
 * Server action untuk menyimpan file gambar ke S3
 * Format nama: t2i_ddmmyyy_hhmmdd.png (e.g. t2i_27102026_154530.png)
 */
export async function saveImageToS3(imageDataUrl: string, customFilename?: string): Promise<{
  success: boolean;
  filename: string;
  url: string;
  message: string;
}> {
  await requireSession();
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET belum diset di environment variable.');

  // Format nama file: t2i_ddmmyyy_hhmmdd.png
  let filename = customFilename?.trim();
  if (!filename) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dd = pad(now.getDate());
    const mm = pad(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    filename = `t2i_${dd}${mm}${yyyy}_${hh}${min}${ss}.png`;
  } else if (!filename.endsWith('.png')) {
    filename = `${filename}.png`;
  }

  let buffer: Buffer;
  let contentType = 'image/png';

  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    contentType = match[1];
    buffer = Buffer.from(match[2], 'base64');
  } else if (imageDataUrl.startsWith('http://') || imageDataUrl.startsWith('https://')) {
    const res = await fetch(imageDataUrl);
    if (!res.ok) throw new Error(`Gagal mengunduh gambar untuk S3: ${res.statusText}`);
    buffer = Buffer.from(await res.arrayBuffer());
    contentType = res.headers.get('content-type') || 'image/png';
  } else {
    buffer = Buffer.from(imageDataUrl, 'base64');
  }

  const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const endpoint = (process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id').replace(/\/+$/, '');
  const fileUrl = `${endpoint}/${bucket}/${filename}`;

  return {
    success: true,
    filename,
    url: fileUrl,
    message: `Gambar berhasil disimpan ke S3 dengan nama ${filename}`,
  };
}

/**
 * Server action untuk memanggil API /tryon
 * Payload dikirim sebagai FormData:
 * - person_image (File / Blob)
 * - garment_image (File / Blob)
 * - category ("tops" | "bottoms" | "one-pieces")
 * - garment_photo_type ("model" | "flat-lay")
 * - seed (number, default 42)
 * - num_timesteps (number, default 20)
 *
 * Header: X-API-Key dari .env
 * Respons JSON:
 * {
 *   "status": "success",
 *   "filename": "...",
 *   "image_path": "/outputs/...",
 *   "category": "...",
 *   "seed": 42,
 *   "gpu": 1,
 *   "message": "Virtual try-on completed"
 * }
 * Selanjutnya fetch file gambar dari base_url/outputs/<filename>
 */
export async function callTryOn(
  baseUrl: string,
  formData: FormData
) {
  await requireSession();
  const clean = cleanUrl(baseUrl);
  if (!clean) throw new Error('Base URL Model belum ditentukan.');

  const personImage = formData.get('person_image');
  const garmentImage = formData.get('garment_image');

  if (!personImage) throw new Error('Foto model (person_image) wajib diunggah.');
  if (!garmentImage) throw new Error('Foto pakaian (garment_image) wajib diunggah.');

  const targetUrl = `${clean}/tryon`;

  const headerName = process.env.t2i_header || process.env.T2I_HEADER || 'X-API-Key';
  const headerValue = process.env.t2i_value || process.env.T2I_VALUE || '';
  const headers: Record<string, string> = {
    'Accept': 'application/json, image/*, */*',
  };
  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900000); // 15 menit timeout untuk Try On (karena proses 6-10 menit)

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`API error (${response.status} ${response.statusText}): ${errText || 'Tidak ada pesan error dari model'}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // 1. Jika respons adalah binary image langsung
    if (contentType.startsWith('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      return { success: true, image: base64, raw: { type: 'binary_image' } };
    }

    // 2. Jika respons JSON
    const data = await response.json();

    const outputFilename = data.filename || (data.image_path ? data.image_path.split('/').pop() : '');
    if (outputFilename) {
      const outputUrl = data.image_path?.startsWith('http')
        ? data.image_path
        : data.image_path?.startsWith('/')
        ? `${clean}${data.image_path}`
        : `${clean}/outputs/${outputFilename}`;

      const fileHeaders: Record<string, string> = {
        'Accept': 'image/*, */*',
      };
      if (headerName && headerValue) {
        fileHeaders[headerName] = headerValue;
      }

      let fileRes = await fetch(outputUrl, {
        method: 'GET',
        headers: fileHeaders,
      });

      if (!fileRes.ok) {
        const fallbackUrl = `${clean}/outputs/${outputFilename}`;
        fileRes = await fetch(fallbackUrl, {
          method: 'GET',
          headers: fileHeaders,
        });

        if (!fileRes.ok) {
          const errText = await fileRes.text().catch(() => '');
          throw new Error(`Gagal mengambil gambar hasil Try On dari ${outputUrl} (${fileRes.status}): ${errText || 'Tidak ada pesan error'}`);
        }
      }

      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const fileContentType = fileRes.headers.get('content-type') || 'image/png';
      const base64 = `data:${fileContentType};base64,${fileBuffer.toString('base64')}`;

      return {
        success: true,
        image: base64,
        filename: outputFilename,
        seed: data.seed,
        category: data.category,
        message: data.message || 'Virtual try-on completed',
        raw: {
          tryonResponse: data,
          outputUrl,
        },
      };
    }

    // Fallback jika format lama
    let resultImg = '';
    if (typeof data === 'string') {
      resultImg = data;
    } else if (data.image) {
      resultImg = data.image;
    } else if (Array.isArray(data.images) && data.images[0]) {
      resultImg = data.images[0];
    } else if (Array.isArray(data) && data[0]) {
      resultImg = data[0];
    } else if (data.output) {
      resultImg = Array.isArray(data.output) ? data.output[0] : data.output;
    } else if (data.url || data.image_url) {
      resultImg = data.url || data.image_url;
    } else {
      for (const key of Object.keys(data)) {
        if (typeof data[key] === 'string' && (data[key].startsWith('http') || data[key].startsWith('data:image') || data[key].length > 1000)) {
          resultImg = data[key];
          break;
        }
      }
    }

    if (resultImg) {
      if (!resultImg.startsWith('http://') && !resultImg.startsWith('https://') && !resultImg.startsWith('data:image/')) {
        resultImg = `data:image/png;base64,${resultImg}`;
      }
      return { success: true, image: resultImg, raw: data };
    }

    return {
      success: true,
      image: '',
      raw: data,
      message: 'API merespons berhasil, tetapi gambar hasil try-on tidak ditemukan secara otomatis pada format respons.',
    };
  } catch (error: any) {
    console.error('Error in Try On:', error);
    if (error.name === 'AbortError') {
      throw new Error('Koneksi ke API model Try On timeout setelah 15 menit.');
    }
    throw new Error(error.message || 'Gagal memanggil API Try On.');
  }
}

// Alias untuk kompatibilitas
export const callSwapFace = callTryOn;
