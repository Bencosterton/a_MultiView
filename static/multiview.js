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
    grid.classList.remove('grid-2x2', 'grid-3x3', 'grid-4x4');
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

function initializeStream(streamId, url, name = '') {
    const container = document.getElementById(`${streamId}-container`);
    if (!container) return;

    // Clean up existing player if any
    if (streamPlayers[streamId]) {
        if (streamPlayers[streamId].destroy) {
            streamPlayers[streamId].destroy();
        }
        delete streamPlayers[streamId];
    }

    container.innerHTML = '';
    container.classList.remove('placeholder');

    // Add name overlay if provided
    if (name) {
        const nameOverlay = document.createElement('div');
        nameOverlay.className = 'stream-name-overlay';
        nameOverlay.textContent = name;
        container.appendChild(nameOverlay);
    }

    // Check if it's a YouTube URL
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
        // Create a div for the YouTube player
        const youtubeContainer = document.createElement('div');
        youtubeContainer.id = `youtube-${streamId}`;
        youtubeContainer.style.width = '100%';
        youtubeContainer.style.height = '100%';
        container.appendChild(youtubeContainer);
        
        // Initialize YouTube player
        if (typeof YT !== 'undefined' && YT.Player) {
            createYouTubePlayer(youtubeId, `youtube-${streamId}`, streamId);
        } else {
            // Load YouTube API if not already loaded
            if (!document.getElementById('youtube-api')) {
                const tag = document.createElement('script');
                tag.id = 'youtube-api';
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                
                // Define callback for when API is ready
                window.onYouTubeIframeAPIReady = function() {
                    // Create players for all pending YouTube streams
                    document.querySelectorAll('[id^="youtube-"]').forEach(element => {
                        const elementId = element.id;
                        const streamIdMatch = elementId.match(/youtube-stream(\d+)/);
                        if (streamIdMatch) {
                            const pendingStreamId = `stream${streamIdMatch[1]}`;
                            const pendingYoutubeId = element.getAttribute('data-youtube-id');
                            if (pendingYoutubeId) {
                                createYouTubePlayer(pendingYoutubeId, elementId, pendingStreamId);
                            }
                        }
                    });
                };
            }
            
            // Mark this container as waiting for API
            youtubeContainer.setAttribute('data-youtube-id', youtubeId);
        }
        return;
    }

    // Create video element for HLS
    const video = document.createElement('video');
    video.id = streamId;
    video.controls = true;
    video.autoplay = true;
    video.muted = true; // Mute by default to allow autoplay
    container.appendChild(video);

    // Initialize HLS
    if (Hls.isSupported()) {
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true
        });

        hls.loadSource(url);
        hls.attachMedia(video);
        streamPlayers[streamId] = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play().catch(function(error) {
                console.log("Play prevented by browser, waiting for user interaction");
                // Add play button overlay if autoplay fails
                const playButton = document.createElement('button');
                playButton.className = 'play-overlay-button';
                playButton.innerHTML = '▶';
                playButton.onclick = function() {
                    video.play();
                    playButton.remove();
                };
                container.appendChild(playButton);
            });
        });

        // Add error handling
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        stopStream(streamId);
                        break;
                }
            }
        });
    }
}

// Function to create YouTube player
function createYouTubePlayer(youtubeId, containerId, streamId) {
    const player = new YT.Player(containerId, {
        videoId: youtubeId,
        playerVars: {
            'autoplay': 1,
            'mute': 1,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onError': onPlayerError
        }
    });
    
    streamPlayers[streamId] = player;
    
    function onPlayerReady(event) {
        event.target.playVideo();
    }
    
    function onPlayerError(event) {
        console.error('YouTube player error:', event);
    }
}

function stopStream(streamId) {
    const container = document.getElementById(`${streamId}-container`);
    if (!container) return;

    // Clean up player instance if exists
    if (streamPlayers[streamId]) {
        if (streamPlayers[streamId].destroy) {
            // HLS player
            streamPlayers[streamId].destroy();
        } else if (streamPlayers[streamId].stopVideo) {
            // YouTube player
            streamPlayers[streamId].stopVideo();
        }
        delete streamPlayers[streamId];
    }

    // Reset container to placeholder state
    container.innerHTML = '';
    container.classList.add('placeholder');
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const rows = text.split('\n');
        
        // Clear existing streams
        clearAllStreams();
        
        // Process each line including empty ones
        const maxStreams = getCurrentGridSize() * getCurrentGridSize();
        for (let i = 0; i < maxStreams; i++) {
            const streamId = `stream${i + 1}`;
            
            // Get row data if available (skip header row)
            const row = rows[i + 1] ? rows[i + 1].trim() : '';
            if (row) {
                const [name, url] = row.split(',').map(s => s.trim());
                if (url) {
                    initializeStream(streamId, url, name);
                    continue;
                }
            }
            
            // Stop stream if no valid URL
            stopStream(streamId);
        }
    } catch (error) {
        console.error('Error reading CSV file:', error);
    }
    
    // Reset file input
    event.target.value = '';
}

function getCurrentGridSize() {
    const container = document.getElementById('grid-container');
    if (container.classList.contains('grid-2x2')) return 2;
    if (container.classList.contains('grid-3x3')) return 3;
    if (container.classList.contains('grid-4x4')) return 4;
    return 2; // Default to 2x2
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
        // Add a small delay between starting streams to prevent the browser shitting it's pants
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
    console.log(message); 
}

async function loadPreset(presetName) {
    try {
        const response = await fetch(`/api/preset/${presetName}`);
        if (!response.ok) {
            throw new Error('Failed to load preset');
        }
        
        const data = await response.json();
        if (!data.streams) {
            throw new Error('Invalid preset data');
        }
        
        // Clear existing streams
        clearAllStreams();
        
        // Load new streams
        const maxStreams = getCurrentGridSize() * getCurrentGridSize();
        for (let i = 0; i < maxStreams; i++) {
            const streamId = `stream${i + 1}`;
            const stream = data.streams[i] || { name: '', url: '' };
            
            if (stream.url && stream.url.trim()) {
                initializeStream(streamId, stream.url, stream.name);
            } else {
                stopStream(streamId);
            }
        }
    } catch (error) {
        console.error('Error loading preset:', error);
    }
}

async function saveCurrentAsPreset(presetName) {
    try {
        // Collect current stream configurations
        const streams = [];
        const containers = document.querySelectorAll('.stream-container');
        containers.forEach(container => {
            const streamId = container.id.replace('-container', '');
            const nameOverlay = container.querySelector('.stream-name-overlay');
            const name = nameOverlay ? nameOverlay.textContent : '';
            const player = streamPlayers[streamId];
            const url = player ? player.url : '';
            
            streams.push({ name, url });
        });
        
        // Save to server
        const response = await fetch(`/api/preset/${presetName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ streams })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save preset');
        }
    } catch (error) {
        console.error('Error saving preset:', error);
    }
}

function clearAllStreams() {
    const containers = document.querySelectorAll('.stream-container');
    containers.forEach(container => {
        const streamId = container.id.replace('-container', '');
        stopStream(streamId);
    });
}

// Initialize UI when the page loads
document.addEventListener('DOMContentLoaded', initializeUI);
