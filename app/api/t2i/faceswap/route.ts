import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Helper untuk menyimpan gambar ke MinIO S3 dan mengembalikan URL share publik.
 * Format URL sama persis dengan saat menyimpan hasil gambar (/vedex/{filename}).
 */
async function uploadToMinioS3(fileOrString: any, prefix: string): Promise<string> {
  // Jika sudah berupa URL publik HTTP/HTTPS, gunakan langsung
  if (typeof fileOrString === 'string' && (fileOrString.startsWith('http://') || fileOrString.startsWith('https://'))) {
    return fileOrString;
  }

  const bucket = process.env.S3_BUCKET || 'vedex';
  const endpoint = (process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id').replace(/\/+$/, '');

  let buffer: Buffer;
  let contentType = 'image/png';
  let ext = 'png';

  if (typeof fileOrString === 'string') {
    const match = fileOrString.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
      if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
      else if (contentType.includes('webp')) ext = 'webp';
    } else {
      buffer = Buffer.from(fileOrString, 'base64');
    }
  } else if (fileOrString && typeof fileOrString.arrayBuffer === 'function') {
    buffer = Buffer.from(await fileOrString.arrayBuffer());
    contentType = fileOrString.type || 'image/png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else if (contentType.includes('webp')) ext = 'webp';
  } else {
    throw new Error('Data gambar tidak valid untuk diunggah ke S3.');
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ddmmyyyy = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const hhmmss = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const filename = `${prefix}_${ddmmyyyy}_${hhmmss}_${randomSuffix}.${ext}`;
  const s3Key = `t2i/${filename}`;

  const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${endpoint}/${bucket}/${s3Key}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: silakan login terlebih dahulu.' }, { status: 401 });
    }

    const formData = await request.formData();
    const baseUrl = (formData.get('base_url') as string) || '';
    const clean = cleanUrl(baseUrl);

    if (!clean) {
      return NextResponse.json({ error: 'Base URL Model belum ditentukan.' }, { status: 400 });
    }

    const sourceImage = formData.get('source_image');
    const targetImage = formData.get('target_image');

    if (!sourceImage) {
      return NextResponse.json({ error: 'Foto Referensi (source_image) wajib diunggah.' }, { status: 400 });
    }
    if (!targetImage) {
      return NextResponse.json({ error: 'Face Referensi (target_image) wajib diunggah.' }, { status: 400 });
    }

    const faceRestoreRaw = formData.get('face_restore');
    const faceRestore = faceRestoreRaw === 'true' || faceRestoreRaw === '1';

    const restoreVisibilityRaw = formData.get('restore_visibility');
    const restoreVisibility = restoreVisibilityRaw !== null && restoreVisibilityRaw !== undefined
      ? Number(restoreVisibilityRaw)
      : 0.6;

    // Unggah Foto Referensi (pose) dan Face Referensi (donor) ke S3 MinIO
    // Menggunakan format URL yang sama persis dengan saat save gambar setelah generate
    const [faceS3Url, poseS3Url] = await Promise.all([
      uploadToMinioS3(targetImage, 'faceswap_face'), // targetImage dari form = Face Referensi (wajah donor)
      uploadToMinioS3(sourceImage, 'faceswap_ref'),  // sourceImage dari form = Foto Referensi (pose target)
    ]);

    // Di model InsightFace InSwapper:
    // 'source_image' adalah Wajah Donor (Face Referensi dari kolom kanan)
    // 'target_image' adalah Foto Pose Target (Foto Referensi dari kolom kiri)
    const backendPayload = {
      source_image: faceS3Url,
      target_image: poseS3Url,
      face_restore: faceRestore,
      restore_visibility: restoreVisibility,
    };

    const targetUrl = `${clean}/faceswap`;

    const headerName = process.env.t2i_header || process.env.T2I_HEADER || 'X-API-Key';
    const headerValue = process.env.t2i_value || process.env.T2I_VALUE || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, image/*, */*',
      'ngrok-skip-browser-warning': 'true',
    };
    if (headerName && headerValue) {
      headers[headerName] = headerValue;
    }

    // Buat ReadableStream SSE dengan Keep-Alive Heartbeat untuk Cloudflare / ngrok
    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(': initial-connect\n\n'));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            message: 'Koneksi aktif ke server model',
            payload: backendPayload,
          })}\n\n`)
        );

        let elapsed = 0;
        const heartbeatInterval = setInterval(() => {
          elapsed += 15;
          try {
            controller.enqueue(
              encoder.encode(`: keep-alive\n\ndata: ${JSON.stringify({ type: 'progress', elapsed, message: 'Menunggu proses render GPU Face Swap...' })}\n\n`)
            );
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 15000);

        try {
          // Timeout backend: 15 menit
          const timeout = setTimeout(() => abortController.abort(), 900000);

          const backendRes = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(backendPayload),
            signal: abortController.signal,
          });

          clearTimeout(timeout);
          clearInterval(heartbeatInterval);

          if (!backendRes.ok) {
            const errText = await backendRes.text().catch(() => '');
            let message = `API ${backendRes.status} ERROR`;
            if (backendRes.statusText) {
              message += ` (${backendRes.statusText})`;
            }
            if (errText && !errText.includes('<!DOCTYPE') && !errText.includes('<html')) {
              try {
                const j = JSON.parse(errText);
                let rawDetail = j.detail ?? j.message ?? j.error;
                if (typeof rawDetail === 'string') {
                  // Format pesan error InsightFace agar informatif bagi user
                  if (rawDetail.includes('Tidak ada wajah yang terdeteksi pada source_image')) {
                    rawDetail = 'Tidak ada wajah yang terdeteksi pada Face Referensi (wajah donor). Pastikan foto memiliki wajah yang menghadap ke depan dan jelas.';
                  } else if (rawDetail.includes('Tidak ada wajah yang terdeteksi pada target_image')) {
                    rawDetail = 'Tidak ada wajah yang terdeteksi pada Foto Referensi (pose). Pastikan foto pose memiliki wajah yang terlihat untuk diganti.';
                  } else if (rawDetail.includes('Face swap processing failed:')) {
                    rawDetail = rawDetail.replace(/Face swap processing failed:\s*[A-Za-z]+ - /, '');
                  }
                  message += `: ${rawDetail}`;
                } else if (Array.isArray(rawDetail)) {
                  const items = rawDetail.map((item: any) => {
                    if (typeof item === 'string') return item;
                    const field = Array.isArray(item.loc) ? item.loc.filter((p: string) => p !== 'body').join('.') : '';
                    const msg = item.msg || item.message || JSON.stringify(item);
                    return field ? `${field}: ${msg}` : msg;
                  });
                  message += `: ${items.join(', ')}`;
                } else if (typeof rawDetail === 'object' && rawDetail !== null) {
                  message += `: ${rawDetail.msg || rawDetail.message || JSON.stringify(rawDetail)}`;
                }
              } catch {
                message += `: ${errText.slice(0, 150).trim()}`;
              }
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
            );
            controller.close();
            return;
          }

          const contentType = backendRes.headers.get('content-type') || '';

          // A. Jika respons berupa binary image langsung
          if (contentType.startsWith('image/')) {
            const arrayBuffer = await backendRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'completed', image: base64, message: 'Face swap completed' })}\n\n`)
            );
            controller.close();
            return;
          }

          // B. Jika respons JSON
          const data = await backendRes.json();
          const outputFilename = data.filename || (data.image_path ? data.image_path.split('/').pop() : '');

          if (outputFilename) {
            const outputUrl = data.image_path?.startsWith('http')
              ? data.image_path
              : data.image_path?.startsWith('/')
              ? `${clean}${data.image_path}`
              : `${clean}/outputs/${outputFilename}`;

            const fileHeaders: Record<string, string> = {
              'Accept': 'image/*, */*',
              'ngrok-skip-browser-warning': 'true',
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
            }

            if (!fileRes.ok) {
              const errText = await fileRes.text().catch(() => '');
              throw new Error(`Gagal mengambil gambar dari ${outputUrl} (${fileRes.status} ${fileRes.statusText}): ${errText || 'Tidak ada pesan error'}`);
            }

            const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
            const fileContentType = fileRes.headers.get('content-type') || 'image/png';
            const base64 = `data:${fileContentType};base64,${fileBuffer.toString('base64')}`;

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'completed',
                image: base64,
                filename: outputFilename,
                face_restore: faceRestore,
                restore_visibility: restoreVisibility,
                message: data.message || 'Face swap completed',
                raw: {
                  faceSwapResponse: data,
                  outputUrl,
                  payload: backendPayload,
                },
              })}\n\n`)
            );
            controller.close();
            return;
          }

          // C. Fallback respons format lain
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
          }

          if (resultImg) {
            if (!resultImg.startsWith('http://') && !resultImg.startsWith('https://') && !resultImg.startsWith('data:image/')) {
              resultImg = `data:image/png;base64,${resultImg}`;
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'completed', image: resultImg, raw: data })}\n\n`)
            );
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: data.message || 'Format gambar respons model tidak terdeteksi.', raw: data })}\n\n`)
            );
          }
          controller.close();
        } catch (error: any) {
          clearInterval(heartbeatInterval);
          console.error('Error in streaming Face Swap:', error);
          const msg = error.name === 'AbortError'
            ? 'Koneksi ke API model Face Swap timeout setelah 15 menit.'
            : (error.message || 'Gagal memanggil API Face Swap.');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
          );
          controller.close();
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    console.error('Top level Face Swap API route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
