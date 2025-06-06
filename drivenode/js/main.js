document.addEventListener('DOMContentLoaded', () => {
    initializeDropZone();
    initializeFileUpload();
    initializeFolderFiltering();
    loadFiles();
});

const API_BASE_URL = 'http://localhost:3000';

async function loadFiles() {
    const fileGrid = document.querySelector('.file-grid');
    fileGrid.innerHTML = '<div class="loading-indicator">Loading files...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/files`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const files = await response.json();
        displayFiles(files);
    } catch (error) {
        console.error('Error loading files:', error);
        showNotification('Error loading files', 'error');
        fileGrid.innerHTML = '<div class="loading-indicator">Failed to load files</div>';
    }
}

function initializeFolderFiltering() {
    const folderItems = document.querySelectorAll('.folder-item');
    folderItems.forEach(folder => {
        folder.addEventListener('click', () => {
            folderItems.forEach(f => f.classList.remove('active'));
            folder.classList.add('active');
            loadFiles();
        });
    });
}

function initializeDropZone() {
    const dropZone = document.querySelector('.drop-zone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('highlight');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('highlight');
        });
    });

    dropZone.addEventListener('drop', handleDrop);
}

async function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function initializeFileUpload() {
    const uploadBtn = document.querySelector('.upload-btn');
    uploadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = (e) => handleFiles(e.target.files);
        input.click();
    });
}

async function handleFiles(files) {
    const uploadSection = document.querySelector('.upload-section');
    
    for (const file of files) {
        try {
            // Create progress bar container
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            progressContainer.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="progress-text">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
            `;
            uploadSection.appendChild(progressContainer);

            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE_URL}/api/files`, true);

            // Update progress bar
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    const progressBar = progressContainer.querySelector('.progress');
                    const progressText = progressContainer.querySelector('.progress-text');
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = Math.round(percentComplete) + '%';
                }
            };

            // Handle response
            xhr.onload = () => {
                if (xhr.status === 200) {
                    showNotification(`${file.name} uploaded successfully`, 'success');
                    loadFiles(); // Refresh the file list
                    setTimeout(() => progressContainer.remove(), 1000);
                } else {
                    throw new Error(`Upload failed: ${xhr.statusText}`);
                }
            };

            xhr.onerror = () => {
                throw new Error('Upload failed');
            };

            xhr.send(formData);
        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Failed to upload ${file.name}`, 'error');
        }
    }
}

function displayFiles(files) {
    const fileGrid = document.querySelector('.file-grid');
    if (!files || files.length === 0) {
        fileGrid.innerHTML = '<div class="loading-indicator">No files found</div>';
        return;
    }

    fileGrid.innerHTML = '';
    
    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item';
        
        const icon = getFileIcon(file.Key);
        const size = formatFileSize(file.Size);
        const date = new Date(file.LastModified).toLocaleDateString();
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.Key);
        
        fileElement.innerHTML = `
            <div class="file-icon">${isImage ? `<img src="${API_BASE_URL}/api/files?key=${encodeURIComponent(file.Key)}" alt="${getFileName(file.Key)}" class="file-preview">` : icon}</div>
            <div class="file-name">${getFileName(file.Key)}</div>
            <div class="file-info">
                <span class="file-size">${size}</span>
                <span class="file-date">${date}</span>
            </div>
            <div class="file-actions">
                <button onclick="downloadFile('${file.Key}')">Download</button>
                <button onclick="deleteFile('${file.Key}')">Delete</button>
                <button onclick="shareFile('${file.Key}')">Share</button>
                ${isImage ? `<button onclick="previewImage('${file.Key}')">Preview</button>` : ''}
            </div>
        `;
        
        fileGrid.appendChild(fileElement);
    });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: '📄',
        doc: '📝',
        docx: '📝',
        xls: '📊',
        xlsx: '📊',
        jpg: '🖼️',
        jpeg: '🖼️',
        png: '🖼️',
        gif: '🖼️',
        mp3: '🎵',
        mp4: '🎥',
        zip: '📦',
        rar: '📦'
    };
    return icons[ext] || '📄';
}

function getFileName(key) {
    return key.split('-').slice(1).join('-');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function downloadFile(key) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/files?key=${encodeURIComponent(key)}`);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getFileName(key);
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        showNotification('File downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download file', 'error');
    }
}

async function deleteFile(key) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/files?key=${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Delete failed');
        
        showNotification('File deleted successfully', 'success');
        loadFiles(); // Refresh the file list
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete file', 'error');
    }
}

async function shareFile(key) {
    try {
        const shareUrl = `${API_BASE_URL}/api/files?key=${encodeURIComponent(key)}`;
        await navigator.clipboard.writeText(shareUrl);
        showNotification('Share link copied to clipboard', 'success');
    } catch (error) {
        console.error('Share error:', error);
        showNotification('Failed to copy share link', 'error');
    }
}

function previewImage(key) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <img src="${API_BASE_URL}/api/files?key=${encodeURIComponent(key)}" alt="${getFileName(key)}">
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.remove();
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}