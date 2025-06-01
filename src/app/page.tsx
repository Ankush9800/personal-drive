'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatFileSize } from '@/lib/utils';

// Import icons from react-icons
import { 
  FaFileAlt, FaFileArchive, FaFileAudio, FaFileImage, FaFilePdf, FaFileVideo, FaFileWord, FaFileExcel, FaFolder, FaFile
} from 'react-icons/fa'; // Using Font Awesome for example
import * as React from 'react'; // Import React with namespace to ensure JSX is available

// Define the type for a FileObject (assuming this structure from R2/API)
interface FileObject {
  Key: string;
  Size: number | null;
  LastModified: string | null;
  // ContentType is optional based on previous issues where it was missing
  // It is only reliably available when fetching a single object, not from the list API
  ContentType?: string | null;
}

interface StorageStats {
  totalSize: number;
  fileCount: number;
}

export default function Home() {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState<StorageStats>({ totalSize: 0, fileCount: 0 });
  const [selectedFile, setSelectedFile] = useState<FileObject | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [xhrInstance, setXhrInstance] = useState<XMLHttpRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (!response.ok) {
        const errorData: { error?: string, details?: string } = await response.json(); // Explicitly type errorData
        throw new Error(`Failed to fetch files: ${errorData.error || response.statusText}`);
      }
      // Explicitly type the data as an array of FileObject
      // Note: ContentType is NOT available in this list response
      const data: FileObject[] = await response.json();
      setFiles(data);

      // Calculate stats
      const totalSize = data.reduce((sum, file) => sum + (file.Size || 0), 0);
      const fileCount = data.length;
      setStats({ totalSize, fileCount });

    } catch (error: any) {
      console.error('Error fetching files:', error);
      toast.error(error.message || 'Failed to fetch files from R2.');
      setFiles([]); // Set files to empty array on error
      setStats({ totalSize: 0, fileCount: 0 }); // Reset stats on error
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    // Use the deployed Cloudflare Worker for direct upload
    const workerUrl = 'https://r2-worker.ankushbhanja1.workers.dev'; // Replace with your actual Worker URL if different
    const targetUrl = `${workerUrl}/${encodeURIComponent(file.name)}`;

    const xhr = new XMLHttpRequest();
    setXhrInstance(xhr);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setUploadProgress(Math.round(progress));
      }
    };

    xhr.onload = async () => {
      setXhrInstance(null);
      if (xhr.status >= 200 && xhr.status < 300) { // Check for success status codes
        await fetchFiles();
        setUploadProgress(100);
        toast.success('File uploaded successfully via Worker');
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 1000);
      } else {
        const errorText = xhr.responseText || `Status: ${xhr.status}`;
        console.error('Upload failed via Worker:', xhr.status, errorText);
        toast.error(`Upload failed: ${errorText}`);
        setUploading(false);
      }
    };

    xhr.onerror = (error) => {
      setXhrInstance(null);
      console.error('Upload error via Worker:', error);
      toast.error('Upload failed: Network error connecting to Worker');
      setUploading(false);
    };

    xhr.onabort = () => {
      setXhrInstance(null);
      setUploading(false);
      setUploadProgress(0);
      toast.info('Upload cancelled');
    };

    // Set up the upload to the Worker
    xhr.open('PUT', targetUrl);
    // Include the authorization header
    xhr.setRequestHeader('X-Custom-Auth-Key', 'Ankush9564@'); // <<< REPLACE WITH YOUR SECRET KEY
    xhr.setRequestHeader('Content-Type', file.type); // Set content type

    // Log the upload attempt
    console.log('Starting upload to Worker for:', file.name);
    console.log('Target URL:', targetUrl);

    xhr.send(file);
  };

  const handleCancelUpload = () => {
    if (xhrInstance) {
      xhrInstance.abort();
    }
  };

  const handleDelete = async (file: FileObject) => {
    try {
      const response = await fetch(`/api/files?key=${encodeURIComponent(file.Key)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchFiles();
        setSelectedFile(null);
        setShowDeleteConfirm(false);
        toast.success('File deleted successfully');
      } else {
        console.error('Delete failed');
        toast.error('Failed to delete file');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = async (file: FileObject) => {
    try {
      const response = await fetch(`/api/files?key=${encodeURIComponent(file.Key)}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.Key;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleShare = async (file: FileObject) => {
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: file.Key }),
      });
      
      if (response.ok) {
        const data: { url: string } = await response.json(); // Explicitly type data for share response
        setShareUrl(data.url);
        setShowShareModal(true);
      } else {
         const errorData: { error?: string } = await response.json(); // Explicitly type errorData for share error
         console.error('Share failed:', errorData);
         toast.error(errorData.error || 'Failed to generate share link.');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to generate share link.');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy link');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const getFileIcon = (file: FileObject): JSX.Element => {
    const extension = file.Key.split('.').pop()?.toLowerCase();
    // ContentType is not available in the list API response, so use extension for icons in the grid.
    // In the modal (where selectedFile has ContentType), we could use ContentType for more accuracy, but extension is usually sufficient.

    // Prioritize folder icon if it's clearly a folder key
    if (file.Key.endsWith('/') || (!file.Key.includes('.') && !file.Size)) { 
      return <FaFolder />; // Folder icon
    }

    // Determine icon based on extension
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '')) {
      return <FaFileImage />;
    } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension || '')) {
      return <FaFileVideo />;
    } else if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(extension || '')) {
      return <FaFileAudio />;
    } else if (extension === 'pdf') {
      return <FaFilePdf />;
    } else if (['txt', 'log', 'md'].includes(extension || '')) {
      return <FaFileAlt />;
    } else if (['doc', 'docx'].includes(extension || '')) {
      return <FaFileWord />;
    } else if (['xls', 'xlsx'].includes(extension || '')) {
      return <FaFileExcel />;
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
      return <FaFileArchive />;
    } else {
      return <FaFile />; // Default file icon
    }
  };

  const getFilePreview = (file: FileObject) => {
    // For grid view, infer image type from extension as ContentType is not available in list API
    const extension = file.Key.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '');

    if (isImage) {
      return (
        <div className="relative w-full h-40 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          <Image
            src={`/api/files?key=${encodeURIComponent(file.Key)}`}
            alt={file.Key}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            style={{ objectFit: 'cover' }}
            priority={false}
          />
        </div>
      );
    }
    // Return null for non-image types in the grid view
    return null;
  };

  // Helper function to determine file category based on extension
  const getFileCategory = (file: FileObject): string => {
    const extension = file.Key.split('.').pop()?.toLowerCase();

    if (file.Key.endsWith('/') || (!file.Key.includes('.') && !file.Size)) { // Simple check for potential folders
      return 'Others'; // Or a dedicated 'Folders' category if implemented
    }

    if (['doc', 'docx', 'pdf', 'txt', 'log', 'md'].includes(extension || '')) {
      return 'Documents';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '')) {
      return 'Photos';
    } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension || '')) {
      return 'Videos';
    } else if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(extension || '')) {
      return 'Audio';
    } else {
      return 'Others';
    }
  };

  // Filter files based on search term AND selected category
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.Key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || getFileCategory(file) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Storage Stats */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Storage Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-2xl font-bold text-gray-800">{formatFileSize(stats.totalSize)}</p>
                <p className="text-sm text-gray-500">Used of ∞</p> {/* Display infinity symbol */}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 text-right">{stats.fileCount}</p>
                <p className="text-sm text-gray-500">Total Files</p>
              </div>
            </div>
            {/* Progress Bar - visual representation */} 
            <Progress value={0} className="h-2" /> {/* Value is 0 as limit is infinite */}
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
           {/* Header and Upload Button */}
           <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Personal Drive
              </h1>
               <div className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="file-upload"
        />
                 <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  <svg className="w-5 h-5 mr-2 -ml-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V8m0 0 1.5 1.5M8 8l-1.5 1.5m4-3h.01M12 15h.01M16 15h.01M15 11h.01M12 11h.01M8 15h.01M8 11h.01M12 8h.01"/></svg>
                  Upload File
                </label>

                {uploading && (
                  <div className="fixed bottom-4 right-4 z-50 w-64 bg-white rounded-lg shadow-lg p-3 flex flex-col gap-2 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Uploading... {uploadProgress}%</span>
                      <Button size="sm" variant="outline" onClick={handleCancelUpload} className="px-2 py-1">
                        Cancel
                      </Button>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <Input 
                    type="text"
                    placeholder="Search files..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {/* Categories/Filters */}
            <div className="mb-6">
                 <h2 className="text-lg font-semibold text-gray-800 mb-3">All files</h2>{/* Label for the main file grid */}
                <div className="flex overflow-x-auto space-x-2 mb-4 pb-2">{/* Adjusted space-x and added pb-2 */}
                    {/* Category buttons/tags */}
                    <Button 
                      variant={selectedCategory === 'All' ? 'default' : 'outline'} // Highlight selected
                      size="sm" 
                      className="flex-shrink-0 rounded-full"
                      onClick={() => setSelectedCategory('All')}
                    >All</Button>{/* Rounded buttons */}
                    <Button 
                      variant={selectedCategory === 'Documents' ? 'default' : 'outline'}
                      size="sm" 
                      className="flex-shrink-0 rounded-full"
                      onClick={() => setSelectedCategory('Documents')}
                    >Documents</Button>
                    <Button 
                      variant={selectedCategory === 'Photos' ? 'default' : 'outline'}
                      size="sm" 
                      className="flex-shrink-0 rounded-full"
                      onClick={() => setSelectedCategory('Photos')}
                    >Photos</Button>
                    <Button 
                      variant={selectedCategory === 'Videos' ? 'default' : 'outline'}
                      size="sm" 
                      className="flex-shrink-0 rounded-full"
                      onClick={() => setSelectedCategory('Videos')}
                    >Videos</Button>
                    <Button 
                      variant={selectedCategory === 'Audio' ? 'default' : 'outline'}
                      size="sm" 
                      className="flex-shrink-0 rounded-full"
                      onClick={() => setSelectedCategory('Audio')}
                    >Audio</Button>
                     <Button 
                      variant={selectedCategory === 'Others' ? 'default' : 'outline'}
                      size="sm" 
                      className="flex-shrink-0 rounded-full"
                      onClick={() => setSelectedCategory('Others')}
                    >Others</Button>
                    {/* Add more category buttons as needed */}
                </div>
            </div>

            {/* File Grid */}
              {filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 text-gray-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No files yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by uploading a file.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.Key}
                      className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm hover:bg-gray-100 cursor-pointer transition-colors aspect-square justify-center"
                      onClick={() => {
                        setSelectedFile(file);
                        // Force a re-render to ensure modal appears
                        setShowShareModal(false);
                        setShowDeleteConfirm(false);
                      }}
                    >
                      {getFilePreview(file) || (
                        <div className="w-12 h-12 flex items-center justify-center text-3xl mb-2">
                          {getFileIcon(file)}
                        </div>
                      )}
                      <span className="text-xs text-center font-medium text-gray-800 mt-2 truncate w-full block">
                        {file.Key}
                      </span>
                      {file.Size !== null && file.Size !== undefined && (
                        <span className="text-[10px] text-gray-500">{formatFileSize(file.Size)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
        </div>

        {/* File Preview Modal */}
        {selectedFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm md:max-w-2xl p-4 md:p-6">
              <div className="flex justify-between items-start mb-4">
                {/* Wrapper for file name to control flex behavior */}
                <div className="flex-grow mr-4 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 break-words">{selectedFile.Key}</h3>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-500 flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
                {selectedFile.ContentType?.includes('image') ? (
          <Image
                    src={`/api/files?key=${encodeURIComponent(selectedFile.Key)}`}
                    alt={selectedFile.Key}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : selectedFile.ContentType?.includes('video') ? (
                  <video controls className="w-full h-full object-contain">
                    <source src={`/api/files?key=${encodeURIComponent(selectedFile.Key)}`} type={selectedFile.ContentType} />
                    Your browser does not support the video tag.
                  </video>
                 ) : selectedFile.ContentType?.includes('audio') ? (
                  <audio controls className="w-full h-full flex items-center justify-center">
                    <source src={`/api/files?key=${encodeURIComponent(selectedFile.Key)}`} type={selectedFile.ContentType} />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <div className="flex items-center justify-center h-full text-6xl">
                    {getFileIcon(selectedFile)}
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Size</p>
                  <p className="font-medium">{formatFileSize(selectedFile.Size)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Last Modified</p>
                  <p className="font-medium">{formatDate(selectedFile.LastModified)}</p>
                </div>
                {selectedFile.ContentType && (
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-medium">{selectedFile.ContentType}</p>
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleDownload(selectedFile)}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => handleShare(selectedFile)}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm md:max-w-md p-4 md:p-6">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Delete File</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete "{selectedFile.Key}"? This action cannot be undone.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(selectedFile)}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm md:max-w-md p-4 md:p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Share File</h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Share this link with others:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(shareUrl)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
