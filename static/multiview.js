// Initialize stream boxes and inputs
let currentGridSize = 4; // Default to 4x4
const streamPlayers = {};
let currentStreamId = null;

function initializeUI() {
    setGridLayout(currentGridSize);
}

function setGridLayout(size) {
    currentGridSize = size;
    const NUM_STREAMS = size * size;
    const grid = document.querySelector('.grid-container');
    
    // Update grid class
    grid.classList.remove('grid-2x2', 'grid-4x4');
    grid.classList.add(`grid-${size}x${size}`);
    
    // Update button states
    document.querySelectorAll('.layout-button').forEach(button => {
        button.classList.remove('active');
        if (button.textContent === `${size}x${size}`) {
            button.classList.add('active');
        }
    });
    
    // Clear existing content
    grid.innerHTML = '';
    
    // Stop all existing streams
    Object.keys(streamPlayers).forEach(playerId => {
        stopStream(playerId);
    });
    
    // Generate stream boxes
    for (let i = 1; i <= NUM_STREAMS; i++) {
        const streamBox = document.createElement('div');
        streamBox.className = 'stream-box';
        streamBox.innerHTML = `
            <div class="stream-content">
                <div id="stream${i}-container" class="video-container placeholder"></div>
            </div>
        `;
        
        // Add click handler to show dialog
        streamBox.addEventListener('click', (e) => {
            e.preventDefault();
            showStreamDialog(i);
        });
        grid.appendChild(streamBox);
    }

    // Set up dialog handlers
    setupDialogHandlers();
}

function setupDialogHandlers() {
    const dialog = document.getElementById('streamDialog');
    const cancelButton = document.getElementById('cancelStreamButton');
    const form = dialog.querySelector('form');

    // Handle dialog submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('streamUrlInput').value.trim();
        const name = document.getElementById('streamNameInput').value.trim();
        if (url && currentStreamId) {
            initializeStream(`stream${currentStreamId}`, url, name);
            dialog.close();
        }
    });

    // Handle dialog cancellation
    cancelButton.addEventListener('click', () => {
        dialog.close();
    });

    // Clear input when dialog closes
    dialog.addEventListener('close', () => {
        document.getElementById('streamUrlInput').value = '';
        document.getElementById('streamNameInput').value = '';
        currentStreamId = null;
    });
}

function showStreamDialog(streamId) {
    const dialog = document.getElementById('streamDialog');
    if (!dialog) {
        console.error('Dialog element not found!');
        return;
    }
    
    currentStreamId = streamId;
    dialog.querySelector('h3').textContent = 'Configure Stream';
    
    try {
        dialog.showModal();
    } catch (err) {
        console.error('Error showing dialog:', err);
    }
}

function extractYouTubeId(url) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^/?]+)/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([^/?]+)/i,
        /(?:https?:\/\/)?youtu\.be\/([^/?]+)/i
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

function initializeStream(streamId, url, streamName) {
    const container = document.getElementById(`${streamId}-container`);
    
    // Remove placeholder class if it exists
    container.classList.remove('placeholder');
    
    // Clear container
    container.innerHTML = '';
    
    // Add stream name overlay if provided
    if (streamName) {
        const nameOverlay = document.createElement('div');
        nameOverlay.className = 'stream-name-overlay';
        nameOverlay.textContent = streamName;
        container.appendChild(nameOverlay);
    }

    try {
        // Check if it's a YouTube URL
        const youtubeId = extractYouTubeId(url);
        
        if (youtubeId) {
            // Create YouTube iframe
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1`;
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = '0';
            container.appendChild(iframe);
        } else if (Hls.isSupported()) {
            // Handle HLS streams
            if (streamPlayers[streamId]) {
                streamPlayers[streamId].destroy();
            }

            const hls = new Hls();
            streamPlayers[streamId] = hls;

            // Create video element
            const video = document.createElement('video');
            video.controls = true;
            container.appendChild(video);

            // Load stream
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.error('Error playing video:', e));
            });

            // Error handling
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
            });
        } else {
            console.error('HLS not supported and not a YouTube URL');
        }
    } catch (error) {
        console.error('Error initializing stream:', error);
    }
}

function stopStream(streamId) {
    const container = document.getElementById(`${streamId}-container`);
    
    // Clean up HLS instance if exists
    if (streamPlayers[streamId]) {
        streamPlayers[streamId].destroy();
        delete streamPlayers[streamId];
    }
    
    // Clear container and reset to placeholder
    container.innerHTML = '';
    container.classList.add('placeholder');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const streams = parseCSV(text);
                loadStreamsConfig(streams);
                showNotification('Configuration loaded successfully');
            } catch (error) {
                showNotification('Error loading configuration file', true);
            }
        };
        reader.readAsText(file);
    }
}

function parseCSV(text) {
    const lines = text.split('\n');
    const streams = [];
    let streamIndex = 1;
    
    // Skip empty lines and comments
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }
        
        // Skip the header line
        if (trimmedLine.toLowerCase().startsWith('name,') || 
            trimmedLine.toLowerCase().includes('link')) {
            continue;
        }
        
        // Parse the line
        const [name, url] = trimmedLine.split(',').map(item => item.trim());
        if (url && streamIndex <= currentGridSize * currentGridSize) {
            streams.push({ 
                index: `stream${streamIndex}`, 
                url: url,
                name: name // Store the name for future use if needed
            });
            streamIndex++;
        }
    }
    
    return streams;
}

function loadStreamsConfig(streams) {
    // Stop all existing streams first
    for (let i = 1; i <= currentGridSize * currentGridSize; i++) {
        stopStream(`stream${i}`);
    }
    
    // Load new configuration
    for (const stream of streams) {
        // Add a small delay between starting streams to prevent overwhelming the browser
        setTimeout(() => {
            initializeStream(stream.index, stream.url, stream.name);
        }, streams.indexOf(stream) * 500);
    }
    
    showNotification(`Loaded ${streams.length} stream(s)`);
}

function downloadConfig() {
    let config = '';
    for (let i = 1; i <= currentGridSize * currentGridSize; i++) {
        const urlInput = document.getElementById(`stream${i}-url`);
        if (urlInput && urlInput.value.trim()) {
            config += `${i},${urlInput.value.trim()}\n`;
        }
    }
    
    if (!config) {
        showNotification('No streams configured to save', true);
        return;
    }
    
    const blob = new Blob([config], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multiview_config.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Configuration saved successfully');
}

function showNotification(message, isError = false) {
    console.log(message); // For now, just log to console
    // You can implement a proper notification UI if needed
}

// Initialize UI when the page loads
document.addEventListener('DOMContentLoaded', initializeUI);
