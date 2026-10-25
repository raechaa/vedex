// app/api/librechat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { callLibreChat, callImageGenerator } from '@/lib/librechat';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payload, type } = body;

    if (!payload) {
      return NextResponse.json(
        { error: 'Payload is required' },
        { status: 400 }
      );
    }

    // Jika type = 'image_generator_model', panggil ImageGenerator agent
    if (type === 'image_generator_model') {
      const charDesc = await callImageGenerator(payload);
      return NextResponse.json({ char_desc: charDesc });
    }

    // Default: panggil suggestion agent (hook & hashtag)
    const result = await callLibreChat(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('LibreChat API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}