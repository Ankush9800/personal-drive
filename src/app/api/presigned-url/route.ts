import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/utils/r2';

interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
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
    const { fileName, fileType } = await request.json() as PresignedUrlRequest;

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400, headers });
    }

    const uniqueFileName = `${Date.now()}-${fileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(r2Client, putCommand, {
      expiresIn: 3600,
    });

    return NextResponse.json({ url: presignedUrl, fileName: uniqueFileName, fileType }, { headers });

  } catch (error: unknown) {
    console.error('Error generating pre-signed URL:', error);
    return NextResponse.json({ 
      error: 'Failed to generate pre-signed URL',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers });
  }
}