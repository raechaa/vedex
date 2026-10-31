import { NextRequest, NextResponse } from 'next/server';
import { checkModelHealth, getBaseUrl } from '@/lib/t2i-actions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url') || await getBaseUrl();
    if (!targetUrl) {
      return NextResponse.json({ online: false, message: 'URL belum ditentukan' });
    }
    const online = await checkModelHealth(targetUrl);
    return NextResponse.json({ online, url: targetUrl });
  } catch (err: any) {
    return NextResponse.json({ online: false, error: err.message }, { status: 500 });
  }
}

