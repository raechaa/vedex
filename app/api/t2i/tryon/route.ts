import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';


function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
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

    const personImage = formData.get('person_image');
    const garmentImage = formData.get('garment_image');

    if (!personImage) {
      return NextResponse.json({ error: 'Foto model (person_image) wajib diunggah.' }, { status: 400 });
    }
    if (!garmentImage) {
      return NextResponse.json({ error: 'Foto pakaian (garment_image) wajib diunggah.' }, { status: 400 });
    }

    // Siapkan FormData yang akan diteruskan ke Kaggle / RunPod
    const targetFormData = new FormData();
    targetFormData.append('person_image', personImage);
    targetFormData.append('garment_image', garmentImage);
    targetFormData.append('category', (formData.get('category') as string) || 'tops');
    targetFormData.append('garment_photo_type', (formData.get('garment_photo_type') as string) || 'model');
    targetFormData.append('seed', (formData.get('seed') as string) || '42');
    targetFormData.append('num_timesteps', (formData.get('num_timesteps') as string) || '20');

    const targetUrl = `${clean}/tryon`;

    const headerName = process.env.t2i_header || process.env.T2I_HEADER || 'X-API-Key';
    const headerValue = process.env.t2i_value || process.env.T2I_VALUE || '';
    const headers: Record<string, string> = {
      'Accept': 'application/json, image/*, */*',
    };
    if (headerName && headerValue) {
      headers[headerName] = headerValue;
    }

    // Buat ReadableStream SSE dengan Keep-Alive Heartbeat untuk Cloudflare
    const encoder = new TextEncoder();
    const abortController = new AbortController();

    // Jika klien membatalkan request browser
    request.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    const stream = new ReadableStream({
      async start(controller) {
        // 1. Kirim byte awal secepatnya agar Cloudflare menerima HTTP 200 dan tidak timeout
        controller.enqueue(encoder.encode(': initial-connect\n\n'));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Koneksi aktif ke server model' })}\n\n`)
        );

        // 2. Kirim byte keep-alive heartbeat setiap 15 detik (jauh di bawah batas 100 detik Cloudflare)
        let elapsed = 0;
        const heartbeatInterval = setInterval(() => {
          elapsed += 15;
          try {
            // Mengirimkan SSE comment ': keep-alive' dan payload data progress
            controller.enqueue(
              encoder.encode(`: keep-alive\n\ndata: ${JSON.stringify({ type: 'progress', elapsed, message: 'Menunggu proses render GPU...' })}\n\n`)
            );
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 15000);

        try {
          // Timeout backend: 15 menit (900.000 ms)
          const timeout = setTimeout(() => abortController.abort(), 900000);

          const backendRes = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: targetFormData,
            signal: abortController.signal,
          });

          clearTimeout(timeout);
          clearInterval(heartbeatInterval);

          if (!backendRes.ok) {
            const errText = await backendRes.text().catch(() => '');
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: `API error (${backendRes.status} ${backendRes.statusText}): ${errText || 'Tidak ada pesan error dari model'}` })}\n\n`)
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
              encoder.encode(`data: ${JSON.stringify({ type: 'completed', image: base64, message: 'Virtual try-on completed' })}\n\n`)
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
                seed: data.seed,
                category: data.category,
                message: data.message || 'Virtual try-on completed',
                raw: {
                  tryonResponse: data,
                  outputUrl,
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
          console.error('Error in streaming Try On:', error);
          const msg = error.name === 'AbortError'
            ? 'Koneksi ke API model Try On timeout setelah 15 menit.'
            : (error.message || 'Gagal memanggil API Try On.');
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
    console.error('Top level Try On API route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
