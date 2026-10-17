import { NextRequest, NextResponse } from 'next/server';
import { callN8n } from '@/lib/n8n';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payload } = body;

    if (!payload) {
      return NextResponse.json(
        { error: 'Payload is required' },
        { status: 400 }
      );
    }

    const result = await callN8n(payload);

    return NextResponse.json(result);
  } catch (error) {
    console.error('n8n API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}