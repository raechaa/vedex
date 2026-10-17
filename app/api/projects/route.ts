import { NextRequest, NextResponse } from 'next/server';
import { getProjects } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}