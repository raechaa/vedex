// app/api/gemini-image/route.ts
// POST: generate gambar via Gemini lalu simpan ke S3 (key: quote-<quote_id>-<index>.png, ditimpa jika diulang)
// GET : baca gambar dari S3 (proxy, supaya bucket bisa tetap private)

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSession } from '@/lib/auth';



const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
});

const BUCKET = () => process.env.S3_BUCKET || '';
const objectKey = (quoteId: string | number, index: string | number) => `quote-${quoteId}-${index}.png`;

function validParams(quoteId: unknown, index: unknown) {
  return /^\d+$/.test(String(quoteId)) && /^\d+$/.test(String(index));
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = request.headers.get('content-type') || '';

    // 1. MANUAL FILE UPLOAD (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const quote_id = formData.get('quote_id');
      const index = formData.get('index');
      const media_type = (formData.get('media_type') as string) || 'image';
      const file = formData.get('file') as File | null;

      if (!file || !validParams(quote_id, index)) {
        return NextResponse.json({ error: 'quote_id, index, dan file wajib diisi' }, { status: 400 });
      }
      if (!BUCKET()) throw new Error('S3_BUCKET belum diset');

      const arrayBuffer = await file.arrayBuffer();

      // Audio Upload (narasi Transition Prompts)
      if (media_type === 'audio') {
        const rawExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
        const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'mp3';
        const key = `quote-${quote_id}-${index}.${ext}`;

        // Hapus file audio lama jika ekstensi sebelumnya berbeda (agar menimpa bersih)
        try {
          const listRes = await s3.send(
            new ListObjectsV2Command({
              Bucket: BUCKET(),
              Prefix: `quote-${quote_id}-${index}.`,
            })
          );
          const existingAudio = (listRes.Contents || []).filter(
            (item) => item.Key && !item.Key.endsWith('.png') && item.Key !== key
          );
          for (const item of existingAudio) {
            if (item.Key) {
              await s3.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: item.Key }));
            }
          }
        } catch (err) {
          console.warn('Gagal membersihkan audio lama:', err);
        }

        const audioContentType =
          file.type ||
          (ext === 'wav'
            ? 'audio/wav'
            : ext === 'm4a'
            ? 'audio/mp4'
            : ext === 'ogg'
            ? 'audio/ogg'
            : ext === 'aac'
            ? 'audio/aac'
            : 'audio/mpeg');

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET(),
            Key: key,
            Body: Buffer.from(arrayBuffer),
            ContentType: audioContentType,
          })
        );

        return NextResponse.json({
          key,
          url: `${process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id'}/${BUCKET()}/${key}`,
          media_type: 'audio',
        });
      }

      // Image Upload (Picture Prompts)
      const key = objectKey(quote_id as string, index as string);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET(),
          Key: key,
          Body: Buffer.from(arrayBuffer),
          ContentType: file.type || 'image/png',
        })
      );

      return NextResponse.json({
        key,
        url: `${process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id'}/${BUCKET()}/${key}`,
        media_type: 'image',
      });
    }

    // 2. GEMINI GENERATION (application/json)
    const { quote_id, index, prompt } = await request.json();
    if (!prompt || !validParams(quote_id, index)) {
      return NextResponse.json({ error: 'quote_id, index, dan prompt wajib diisi' }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY belum diset');
    if (!BUCKET()) throw new Error('S3_BUCKET belum diset');

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: String(prompt) }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }
    );
    if (!geminiRes.ok) {
      console.error('Gemini error:', await geminiRes.text());
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;
    if (!inline?.data) throw new Error('Gemini tidak mengembalikan gambar');

    const key = objectKey(quote_id, index);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET(),
        Key: key,
        Body: Buffer.from(inline.data, 'base64'),
        ContentType: inline.mimeType || inline.mime_type || 'image/png',
      })
    );

    return NextResponse.json({
      key,
      url: `${process.env.S3_ENDPOINT || 'https://s3.codeplay.web.id'}/${BUCKET()}/${key}`,
    });
  } catch (error) {
    console.error('Gemini image route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const quoteId = request.nextUrl.searchParams.get('quote_id');
  const action = request.nextUrl.searchParams.get('action');

  // LIST ASSETS: ambil nomor index gambar & audio yang sudah tersimpan di S3
  if (action === 'list') {
    if (!quoteId || !/^\d+$/.test(quoteId)) {
      return NextResponse.json({ images: [], audios: [] });
    }
    try {
      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET(),
          Prefix: `quote-${quoteId}-`,
        })
      );
      const images: number[] = [];
      const audios: number[] = [];

      (listRes.Contents || []).forEach((item) => {
        if (!item.Key) return;
        const match = item.Key.match(/^quote-\d+-(\d+)\.([a-zA-Z0-9]+)$/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const ext = match[2].toLowerCase();
          if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
            images.push(idx);
          } else {
            audios.push(idx);
          }
        }
      });

      return NextResponse.json({ images, audios });
    } catch (err) {
      console.error('Error listing assets:', err);
      return NextResponse.json({ images: [], audios: [] });
    }
  }

  const index = request.nextUrl.searchParams.get('index');
  const mediaType = request.nextUrl.searchParams.get('media_type') || 'image';
  if (!validParams(quoteId, index)) return new NextResponse('Bad request', { status: 400 });

  // STREAM AUDIO
  if (mediaType === 'audio') {
    try {
      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET(),
          Prefix: `quote-${quoteId}-${index}.`,
        })
      );
      const audioObj = (listRes.Contents || []).find(
        (item) => item.Key && !item.Key.endsWith('.png')
      );
      if (!audioObj?.Key) return new NextResponse('Not found', { status: 404 });

      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET(), Key: audioObj.Key }));
      const bytes = await obj.Body!.transformToByteArray();
      const ext = audioObj.Key.split('.').pop()?.toLowerCase();
      const defaultMime =
        ext === 'wav'
          ? 'audio/wav'
          : ext === 'm4a'
          ? 'audio/mp4'
          : ext === 'ogg'
          ? 'audio/ogg'
          : ext === 'aac'
          ? 'audio/aac'
          : 'audio/mpeg';

      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': obj.ContentType || defaultMime,
          'Content-Length': String(bytes.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return new NextResponse('Not found', { status: 404 });
    }
  }

  // STREAM IMAGE
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET(), Key: objectKey(quoteId!, index!) }));
    const bytes = await obj.Body!.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': obj.ContentType || 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
