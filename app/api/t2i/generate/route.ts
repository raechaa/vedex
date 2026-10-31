import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getBaseUrl } from '@/lib/t2i-actions';

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: silakan login terlebih dahulu.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let baseUrl = body.base_url || body.baseUrl;
    if (!baseUrl) {
      baseUrl = await getBaseUrl();
    }
    const clean = cleanUrl(baseUrl || '');
    if (!clean) {
      return NextResponse.json({ error: 'Base URL Model belum ditentukan.' }, { status: 400 });
    }

    const prompt = (body.prompt || '').trim();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt deskripsi gambar tidak boleh kosong.' }, { status: 400 });
    }

    const width = Number(body.width) || 1024;
    const height = Number(body.height) || 1024;
    const steps = Number(body.steps) || 25;
    const seed = typeof body.seed === 'number' ? body.seed : 42;
    const cfg = typeof body.cfg === 'number' ? body.cfg : 1.0;
    const negativePrompt = body.negative_prompt ?? (body.negativePrompt ?? '');

    const backendBody: Record<string, any> = {
      prompt,
      width,
      height,
      steps,
      seed,
      cfg,
    };
    if (negativePrompt) {
      backendBody.negative_prompt = negativePrompt;
    }

    const targetUrl = `${clean}/generate`;

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

    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(': initial-connect\n\n'));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Koneksi aktif ke server model' })}\n\n`)
        );

        let elapsed = 0;
        const heartbeatInterval = setInterval(() => {
          elapsed += 15;
          try {
            controller.enqueue(
              encoder.encode(`: keep-alive\n\ndata: ${JSON.stringify({ type: 'progress', elapsed, message: 'Menunggu proses render GPU...' })}\n\n`)
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
            body: JSON.stringify(backendBody),
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
            if (errText && !errText.includes('<!DOCTYPE') && !errText.includes('<html') && errText.length < 150) {
              try {
                const j = JSON.parse(errText);
                if (j.detail || j.message || j.error) {
                  message += `: ${j.detail || j.message || j.error}`;
                }
              } catch {
                message += `: ${errText.trim()}`;
              }
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
            );
            controller.close();
            return;
          }

          const contentType = backendRes.headers.get('content-type') || '';

          // 1. Jika respons berupa binary image langsung
          if (contentType.startsWith('image/')) {
            const arrayBuffer = await backendRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'completed', image: base64, message: 'Image generated' })}\n\n`)
            );
            controller.close();
            return;
          }

          // 2. Jika respons JSON
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
                seed: data.seed ?? seed,
                message: data.message || 'Image generated',
                raw: {
                  generateResponse: data,
                  outputUrl,
                },
              })}\n\n`)
            );
            controller.close();
            return;
          }

          // 3. Fallback jika respons format lain
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
          console.error('Error in streaming Generate Image:', error);
          const msg = error.name === 'AbortError'
            ? 'Koneksi ke API model generate timeout setelah 15 menit.'
            : (error.message || 'Gagal memanggil API generate image.');
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
    console.error('Top level Generate API route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

