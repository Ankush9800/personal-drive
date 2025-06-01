import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  checksumValidation: false,
});

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
    const { fileName, fileType } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400, headers });
    }

    const uniqueFileName = `${Date.now()}-${fileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    const signedUrlOptions = {
      expiresIn: 3600,
      signingRegion: 'auto',
      signingService: 's3',
      signingEscapePath: false,
    };

    const presignedUrl = await getSignedUrl(s3Client, putCommand, signedUrlOptions);

    return NextResponse.json({ url: presignedUrl, fileName: uniqueFileName, fileType }, { headers });

  } catch (error: unknown) {
    console.error('Error generating pre-signed URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ 
      error: 'Failed to generate pre-signed URL',
      details: errorMessage
    }, { status: 500, headers });
  }
} 