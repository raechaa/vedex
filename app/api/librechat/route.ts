// app/api/librechat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { callLibreChat, callPromptEngineer } from '@/lib/librechat';

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

    // Jika type = 'prompt_engineer', panggil PromptEngineer agent
    if (type === 'prompt_engineer') {
      const hookText = await callPromptEngineer(payload);
      return NextResponse.json({ hook_text: hookText });
    }

    // Jika type = 'point_video', panggil agent untuk point video
    if (type === 'point_video') {
      const pointText = await callPromptEngineer(payload);
      return NextResponse.json({ point_text: pointText });
    }

    // Jika type = 'cta', panggil agent untuk CTA
    if (type === 'cta') {
      const ctaResult = await callPromptEngineer(payload);
      return NextResponse.json({ cta_text: ctaResult });
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