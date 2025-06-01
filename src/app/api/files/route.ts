import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Log R2 configuration (without sensitive data)
console.log('R2 Configuration:', {
  endpoint: process.env.R2_ENDPOINT,
  bucketName: process.env.R2_BUCKET_NAME,
  hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
});

const s3Client = new S3Client({
  region: 'us-east-1', // Required for R2
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for R2
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

      const response = await s3Client.send(command);
      const stream = response.Body as ReadableStream;
      const contentType = response.ContentType || 'application/octet-stream'; // Get ContentType, default to octet-stream

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
        const response = await s3Client.send(command);
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
      } catch (r2Error: any) {
        console.error('R2 Error Details:', {
          name: r2Error.name,
          message: r2Error.message,
          code: r2Error.code,
          requestId: r2Error.$metadata?.requestId,
          cfId: r2Error.$metadata?.cfId,
          extendedRequestId: r2Error.$metadata?.extendedRequestId,
        });
        return NextResponse.json({ 
          error: 'Failed to fetch files from R2',
          details: r2Error.message 
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('API Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error.message 
    }, { status: 500 });
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

    await s3Client.send(command);
    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting file:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({ 
      error: 'Failed to delete file',
      details: error.message 
    }, { status: 500 });
  }
} 