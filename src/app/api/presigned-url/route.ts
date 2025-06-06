import { NextResponse } from 'next/server';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/utils/r2';

interface PresignedUrlRequest {
  fileName: string;
  fileType?: string;
  operation?: 'upload' | 'download';
}

export async function POST(request: Request) {
  const headers = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  try {
    const { fileName, fileType, operation = 'upload' } = await request.json() as PresignedUrlRequest;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400, headers });
    }

    if (operation === 'upload' && !fileType) {
      return NextResponse.json({ error: 'fileType is required for uploads' }, { status: 400, headers });
    }

    let command;
    let key = fileName;

    if (operation === 'upload') {
      key = `${Date.now()}-${fileName}`;
      // Ensure SVG files are uploaded with correct MIME type
      const contentType = fileName.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : fileType;
      command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });
    } else {
      command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
      });
    }

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600,
    });

    return NextResponse.json({ 
      url: presignedUrl, 
      fileName: key,
      ...(operation === 'upload' && { fileType })
    }, { headers });

  } catch (error: unknown) {
    console.error('Error generating pre-signed URL:', error);
    return NextResponse.json({ 
      error: 'Failed to generate pre-signed URL',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers });
  }
}