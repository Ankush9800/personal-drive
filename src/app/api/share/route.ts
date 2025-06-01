import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/utils/r2';

interface ShareRequest {
  key: string;
}

export async function POST(request: Request) {
  try {
    // Check if the Content-Type is application/json
    const contentType = request.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }

    let body: ShareRequest;    try {
      body = await request.json() as ShareRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    if (!body.key) {
      return NextResponse.json({ error: 'No file key provided' }, { status: 400 });
    }    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: body.key,
    });

    // Generate a signed URL that expires in 24 hours
    const url = await getSignedUrl(r2Client, command, { expiresIn: 86400 });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
} 