import { NextResponse } from 'next/server';
import { ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/utils/r2';

// Log R2 configuration (without sensitive data)
console.log('R2 Configuration:', {
  endpoint: process.env.R2_ENDPOINT,
  bucketName: process.env.R2_BUCKET_NAME,
  hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      // Get a specific file (for preview/download)
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      });

      const response = await r2Client.send(command);
      const stream = response.Body as ReadableStream;
      
      // Set correct content type for SVG files
      let contentType = response.ContentType || 'application/octet-stream';
      if (key.toLowerCase().endsWith('.svg')) {
        contentType = 'image/svg+xml';
      }

      return new Response(stream, {
        headers: {
          'Content-Type': contentType,
        },
      });
    } else {
      // List all files (for the main file view)
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
      });

      try {
        console.log('Attempting to list objects from R2...');
        const response = await r2Client.send(command);
        console.log('R2 Response:', JSON.stringify(response, null, 2));

        // Format the response to ensure it's an array
        // Note: ContentType is NOT available in ListObjectsV2Command response
        const files = response.Contents?.map(file => ({
          Key: file.Key || '',
          LastModified: file.LastModified || new Date(),
          Size: file.Size || 0,
          // ContentType cannot be reliably determined from ListObjectsV2Command
        })) || [];

        return NextResponse.json(files);
      } catch (r2Error: unknown) {
        console.error('R2 Error Details:', {
          name: r2Error instanceof Error ? r2Error.name : 'UnknownError',
          message: r2Error instanceof Error ? r2Error.message : String(r2Error),
          code: r2Error && typeof r2Error === 'object' && 'code' in r2Error ? (r2Error as { code: string | undefined }).code : undefined,
        });
        return NextResponse.json({ 
          error: 'Failed to fetch files from R2',
          details: r2Error instanceof Error ? r2Error.message : String(r2Error) 
        }, { status: 500 });
      }
    }
  } catch (error: unknown) {
    console.error('API Error:', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const key = `${Date.now()}-${file.name}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: file.type,
    });

    await r2Client.send(command);

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting file:', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ 
      error: 'Failed to delete file',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}