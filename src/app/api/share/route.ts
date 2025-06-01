import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/utils/r2';

export async function POST(request: Request) {
  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: 'No file key provided' }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    // Generate a signed URL that expires in 24 hours
    const url = await getSignedUrl(r2Client, command, { expiresIn: 86400 });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
} 