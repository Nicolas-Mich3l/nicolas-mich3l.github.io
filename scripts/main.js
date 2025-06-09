// Window Manager - handles all window operations
class WindowManager {
    constructor() {
        this.windows = new Map();
        this.highestZIndex = 2;
        this.minimizedWindows = new Set();
        this.tiledWindows = new Map(); 
        this.snapZones = {
            top: { x: 0, y: '32.5px', width: '100%', height: 'calc(50vh - 35px)' },
            bottom: { x: 0, y: '50vh', width: '100%', height: 'calc(50vh - 75px)' },
            left: { x: 0, y: '32.5px', width: '50%', height: 'calc(100vh - 105px)' },
            right: { x: '50%', y: '32.5px', width: '50%', height: 'calc(100vh - 105px)' }
        };
        this.quarterZones = {
            'top-left': { x: 0, y: '32.5px', width: '50%', height: 'calc(50vh - 35px)' },
            'top-right': { x: '50%', y: '32.5px', width: '50%', height: 'calc(50vh - 35px)' },
            'bottom-left': { x: 0, y: '50vh', width: '50%', height: 'calc(50vh - 60px)' },
            'bottom-right': { x: '50%', y: '50vh', width: '50%', height: 'calc(50vh - 60px)' },
            'left-top': { x: 0, y: '32.5px', width: '50%', height: 'calc(50vh - 35px)' },
            'left-bottom': { x: 0, y: '50vh', width: '50%', height: 'calc(50vh - 75px)' },
            'right-top': { x: '50%', y: '32.5px', width: '50%', height: 'calc(50vh - 35px)' },
            'right-bottom': { x: '50%', y: '50vh', width: '50%', height: 'calc(50vh - 75px)' }
        };

        this.snapDistance = 30;
        this.currentSnapZone = null;
        this.initialize();
    }
    
    initialize() {
        // Find all windows and register them
        document.querySelectorAll('.window').forEach(windowEl => {
            const windowId = windowEl.getAttribute('data-window-id');
            this.registerWindow(windowEl, windowId);
        });

        // Create snap preview overlay
        this.createSnapPreview();

        // Set up global event listeners
        document.addEventListener('mouseup', () => {
            this.stopDragging();
        });
        document.addEventListener('mousemove', (e) => {
            this.handleDrag(e);
        });
    }

    createSnapPreview() {
        this.snapPreview = document.createElement('div');
        this.snapPreview.className = 'snap-preview';
        this.snapPreview.style.cssText = `
            position: fixed;
            background: rgba(74, 144, 226, 0.3);
            border: 2px solid #4a90e2;
            pointer-events: none;
            z-index: 9999;
            display: none;
            box-sizing: border-box;
        `;
        document.body.appendChild(this.snapPreview);
    }

    
    registerWindow(windowEl, windowId) {
        if (!windowId) {
            windowId = 'window_' + Math.random().toString(36).substr(2, 9);
            windowEl.setAttribute('data-window-id', windowId);
        }
        const topBar = windowEl.querySelector('.window-top-bar');
        const closeBtn = windowEl.querySelector('.window-close');
        const minimizeBtn = windowEl.querySelector('.window-minimize');
        const maximizeBtn = windowEl.querySelector('.window-maximize');

        // Store window data
        this.windows.set(windowId, {
            element: windowEl,
            isDragging: false,
            offset: { x: 0, y: 0 },
            isMaximized: false,
            isTiled: false,
            tiledPosition: null,
            pretiledSize: null,
            originalSize: null
        });
        
        // Set up window event listeners
        topBar.addEventListener('mousedown', (e) => {
            // Ignore if clicking on control buttons
            if (e.target === closeBtn || e.target === minimizeBtn || e.target === maximizeBtn) {
                return;
            }
            this.startDragging(windowId, e);
        });
        
        // Window activation on click
        windowEl.addEventListener('mousedown', () => {
            this.activateWindow(windowId);
        });
        
        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeWindow(windowId);
            });
        }
        
        // Minimize button
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.minimizeWindow(windowId);
            });
        }
        
        // Maximize button
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
                this.toggleMaximize(windowId);
            });
        }
        
        return windowId;
    }

    // Create a new window dynamically
    createWindow(options = {}) {
        const {
            title = 'New Window',
            content = '',
            x = 50,
            y = 50,
            width = 400,
            height = null,
            id = ''
        } = options;
        
        // Create window elements
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.style.left = `${x}px`;
        windowEl.style.top = `${y}px`;
        windowEl.id = id
        if (width) windowEl.style.width = `${width}px`;
        if (height) windowEl.style.height = `${height}px`;
        
        // Create window structure
        windowEl.innerHTML = `
            <div class="window-top-bar">
                <div class="window-controls">
                    <div class="window-close"></div>
                    <div class="window-minimize"></div>
                    <div class="window-maximize"></div>
                </div>
                <div class="window-title">${title}</div>
            </div>
            <div class="window-content">
                ${content}
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(windowEl);
        
        // Register window
        const windowId = this.registerWindow(windowEl);
        this.activateWindow(windowId);
        
        return windowId;
    }

    // Detect which edge the mouse is near
    detectSnapZone(x, y) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Check edges
        if (x <= this.snapDistance) return 'left';
        if (x >= windowWidth - this.snapDistance) return 'right';
        if (y <= 30 + this.snapDistance) return 'top';
        if (y >= windowHeight - 75 - this.snapDistance) return 'bottom';
        
        return null;
    }

    
    // Show snap preview
    showSnapPreview(zone, windowId) {
        if (!zone) {
            this.snapPreview.style.display = 'none';
            this.currentSnapZone = null;
            return;
        }
        
        this.currentSnapZone = zone;
        
        // Check if there's already a tiled window in this zone
        const existingWindow = this.tiledWindows.get(zone);
        let snapZone;
        
        if (existingWindow && existingWindow !== windowId) {
            // Create quarters
            if (zone === 'top' || zone === 'bottom') {
                // For top/bottom, split left/right
                snapZone = this.quarterZones[`${zone}-right`];
            } else {
                // For left/right, split top/bottom  
                snapZone = this.quarterZones[`${zone}-bottom`];
            }
        } else {
            snapZone = this.snapZones[zone];
        }
        
        // Position the preview
        this.snapPreview.style.display = 'block';
        this.snapPreview.style.left = snapZone.x;
        this.snapPreview.style.top = snapZone.y;
        this.snapPreview.style.width = snapZone.width;
        this.snapPreview.style.height = snapZone.height;
    }

    // Apply tiling to a window
    tileWindow(windowId, zone) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        // If not already tiled store current size before tiling
        if (!windowData.isTiled) {
            windowData.pretiledSize = {
                width: windowData.element.style.width,
                height: windowData.element.style.height,
                left: windowData.element.style.left,
                top: windowData.element.style.top
            };
        }
        
        // Check if there's already a window tiled to this zone
        const existingWindow = this.tiledWindows.get(zone);
        let targetZone;
        let quarterPosition;
        
        if (existingWindow && existingWindow !== windowId) {
            // Create quarters
            if (zone === 'top' || zone === 'bottom') {
                // Move existing window to left quarter, new window to right quarter
                quarterPosition = `${zone}-right`;
                this.applyWindowPosition(existingWindow, this.quarterZones[`${zone}-left`]);
                this.windows.get(existingWindow).tiledPosition = `${zone}-left`;
                targetZone = this.quarterZones[quarterPosition];
            } else {
                // Move existing window to top quarter, new window to bottom quarter
                quarterPosition = `${zone}-bottom`;
                this.applyWindowPosition(existingWindow, this.quarterZones[`${zone}-top`]);
                this.windows.get(existingWindow).tiledPosition = `${zone}-top`;
                targetZone = this.quarterZones[quarterPosition];
            }
        } else {
            targetZone = this.snapZones[zone];
            quarterPosition = zone;
        }
        
        // Apply position to the dragged window
        this.applyWindowPosition(windowId, targetZone);
        
        // Update window state
        windowData.isTiled = true;
        windowData.tiledPosition = quarterPosition;
        this.tiledWindows.set(zone, windowId);
        
        // If we created quarters, we need to track both
        if (existingWindow && existingWindow !== windowId) {
            if (zone === 'top' || zone === 'bottom') {
                this.tiledWindows.set(`${zone}-left`, existingWindow);
                this.tiledWindows.set(`${zone}-right`, windowId);
            } else {
                this.tiledWindows.set(`${zone}-top`, existingWindow);
                this.tiledWindows.set(`${zone}-bottom`, windowId);
            }
        }
    }
    
    // Apply position and size to window
    applyWindowPosition(windowId, zone) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        const el = windowData.element;
        el.style.left = zone.x;
        el.style.top = zone.y;
        el.style.width = zone.width;
        el.style.height = zone.height;
    }
    
    // Untile a window (restore to pre-tiled state)
    untileWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData || !windowData.isTiled) return;
        
        // Remove from tiled windows tracking
        const position = windowData.tiledPosition;
        this.tiledWindows.delete(position);
        
        // If this was a quarter tile, we need to expand the remaining window
        const basePosition = position.split('-')[0]; // 'top', 'bottom', 'left', 'right'
        const remainingQuarter = position.includes('-left') ? `${basePosition}-right` : 
                                position.includes('-right') ? `${basePosition}-left` :
                                position.includes('-top') ? `${basePosition}-bottom` : 
                                position.includes('-bottom') ? `${basePosition}-top` : null;
        
        if (remainingQuarter && this.tiledWindows.has(remainingQuarter)) {
            const remainingWindowId = this.tiledWindows.get(remainingQuarter);
            this.tiledWindows.delete(remainingQuarter);
            this.tiledWindows.set(basePosition, remainingWindowId);
            
            // Expand remaining window to full half
            this.applyWindowPosition(remainingWindowId, this.snapZones[basePosition]);
            this.windows.get(remainingWindowId).tiledPosition = basePosition;
        }
        
        // Restore original size
        if (windowData.pretiledSize) {
            const { width, height, left, top } = windowData.pretiledSize;
            windowData.element.style.width = width;
            windowData.element.style.height = height;
            windowData.element.style.left = left;
            windowData.element.style.top = top;
        }
        
        // Reset tiling state
        windowData.isTiled = false;
        windowData.tiledPosition = null;
        windowData.pretiledSize = null;
    }

    // Start dragging a window
    startDragging(windowId, e) {
        const windowData = this.windows.get(windowId);
        if (!windowData || windowData.isMaximized) return;

        // If window is tiled, untile it first
        if (windowData.isTiled) {
            // todo implement untile
            this.untileWindow(windowId);
        }

        windowData.isDragging = true;

        
        const rect = windowData.element.getBoundingClientRect();
        windowData.offset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        this.activateWindow(windowId);
    }
    
    // Handle dragging movement
    handleDrag(e) {
        let draggingWindowId = null;
        for (const [windowId, windowData] of this.windows.entries()) {
            if (windowData.isDragging) {
                draggingWindowId = windowId;
                const x = e.clientX - windowData.offset.x;
                const y = e.clientY - windowData.offset.y;
                
                windowData.element.style.left = `${x}px`;
                windowData.element.style.top = `${y}px`;
                break; 
            }
        }
        // Show snap preview if dragging
        if (draggingWindowId) {
            const snapZone = this.detectSnapZone(e.clientX, e.clientY);
            this.showSnapPreview(snapZone, draggingWindowId);
        }
    }
    
    // Stop dragging
    stopDragging() {
        let draggedWindowId = null;

        // Find dragged window and apply tiling if in snap zone
        for (const [windowId, windowData] of this.windows.entries()) {
            if (windowData.isDragging) {
                draggedWindowId = windowId;
                windowData.isDragging = false;
                break;
            }
        }
        
        // Apply tiling if there's a current snap zone
        if (this.currentSnapZone && draggedWindowId) {
            // Check if the zone is available or can be shared
            const existingWindow = this.tiledWindows.get(this.currentSnapZone);
            if (!existingWindow || existingWindow === draggedWindowId) {
                this.tileWindow(draggedWindowId, this.currentSnapZone);
            } else {
                // Try to create quarters
                this.tileWindow(draggedWindowId, this.currentSnapZone);
            }
        }
        
        // Hide snap preview
        this.showSnapPreview(null);
    }
    
    // Close a window
    closeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        // Remove from tiling if tiled
        if (windowData.isTiled) {
            this.untileWindow(windowId);
        }
        
        windowData.element.remove();
        this.windows.delete(windowId);
        this.minimizedWindows.delete(windowId);
    }
    
    // Minimize a window
    minimizeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        windowData.element.style.display = 'none';
        this.minimizedWindows.add(windowId);
        
        const event = new CustomEvent('window-minimized', { 
            detail: { windowId, title: windowData.element.querySelector('.window-title').textContent }
        });
        document.dispatchEvent(event);
    }
    
    // Restore a minimized window
    restoreWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        windowData.element.style.display = 'block';
        this.minimizedWindows.delete(windowId);
        this.activateWindow(windowId);
    }
    
    // Toggle maximize/restore
    toggleMaximize(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        if (windowData.isMaximized) {
            // Restore window
            if (windowData.originalSize) {
                const { width, height, left, top } = windowData.originalSize;
                windowData.element.style.width = width;
                windowData.element.style.height = height;
                windowData.element.style.left = left;
                windowData.element.style.top = top;
            }
            windowData.isMaximized = false;
        } else {
            // Untile if tiled before maximizing
            if (windowData.isTiled) {
                this.untileWindow(windowId);
            }
            // Maximize window
            // Store original size for restoration
            windowData.originalSize = {
                width: windowData.element.style.width,
                height: windowData.element.style.height,
                left: windowData.element.style.left,
                top: windowData.element.style.top
            };
            
            // Set maximized position and size
            windowData.element.style.width = 'calc(100% - 40px)';
            windowData.element.style.height = 'calc(100% - 125px)';
            windowData.element.style.left = '20px';
            windowData.element.style.top = '40px';
            windowData.isMaximized = true;
        }
    }
    
    // Bring window to front
    activateWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        // Remove active class from all windows
        for (const data of this.windows.values()) {
            data.element.classList.remove('active');
        }
        
        // Add active class to current window
        windowData.element.classList.add('active');
        
        // Update z-index
        this.highestZIndex++;
        windowData.element.style.zIndex = this.highestZIndex;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the window manager
    const windowManager = new WindowManager();
    // Track active windows
    const activeWindows = new Map();
            
    // Get all the dock icons
    const dockIcons = document.querySelectorAll('.dock-icon');
    

    const appContent = {};


    // Function to load app content from separate HTML files
    async function loadAppContent(appName) {
        if (appContent[appName]) {
            return appContent[appName]; // Return cached content if available
        }
        
        try {
            const response = await fetch(`../app-content/${appName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load content for ${appName}`);
            }
            const content = await response.text();
            appContent[appName] = content; // Cache the content
            return content;
        } catch (error) {
            console.error('Error loading app content:', error);
            // Return fallback content if loading fails
            return `
                <div class="app-placeholder">
                    <img src="/api/placeholder/80/80" alt="${appName} Icon">
                    <h3>${appName.charAt(0).toUpperCase() + appName.slice(1)} App</h3>
                    <p>Content could not be loaded.</p>
                </div>
            `;
        }
    }


    function setupFileListeners() {
        document.querySelectorAll('.file-item[data-url]').forEach(item => {
            item.addEventListener('click', function() {
                window.open(this.dataset.url, '_blank');
            });
        });
        document.querySelectorAll('.file-item[data-action]').forEach(item => {
            item.addEventListener('click', function() {
                const action = this.dataset.action;
                console.log(action)
                openWindow(action);
            });
        });
    }

    async function openWindow(appName) {
        if (activeWindows.has(appName)) {
                const windowId = activeWindows.get(appName);
                
                // Check if window is in minimized set
                if (windowManager.minimizedWindows.has(windowId)) {
                    windowManager.restoreWindow(windowId);
                } else {
                    // If window is already active, minimize it
                    windowManager.minimizeWindow(windowId);
                }
        } else {
            // Load content for this app
            const content = await loadAppContent(appName);
            
            // Create a new window for this app
            const windowId = windowManager.createWindow({
                title: appName.charAt(0).toUpperCase() + appName.slice(1),
                content: content,
                x: 100 + Math.random() * 50,
                y: 100 + Math.random() * 50,
                width: 600,
                height: 400,
                id: appName
            });
            
            // Store the window id for this app
            activeWindows.set(appName, windowId);
            
            
            // Listen for window close to update active windows and icon state
            const windowEl = document.querySelector(`[data-window-id="${windowId}"]`);
            const closeBtn = windowEl.querySelector('.window-close');
            
            closeBtn.addEventListener('click', () => {
                activeWindows.delete(appName);
            });
        }
    }

    dockIcons.forEach(icon => {
        icon.addEventListener('click', async function() {
            const appName = this.getAttribute('data-app');
            
            // If window exists and is minimized, restore it
            if (activeWindows.has(appName)) {
                const windowId = activeWindows.get(appName);
                
                // Check if window is in minimized set
                if (windowManager.minimizedWindows.has(windowId)) {
                    windowManager.restoreWindow(windowId);
                    this.classList.add('active');
                } else {
                    // If window is already active, minimize it
                    windowManager.minimizeWindow(windowId);
                    this.classList.remove('active');
                }
            } else {
                // Load content for this app
                const content = await loadAppContent(appName);
                if(appName == "music"){
                    const event = new Event("music_open")
                    window.dispatchEvent(event)
                }
                if(appName == 'files') {
                setTimeout(() => {
                    setupFileListeners();
                }, 0);
                }
                // Create a new window for this app
                const windowId = windowManager.createWindow({
                    title: appName.charAt(0).toUpperCase() + appName.slice(1),
                    content: content,
                    x: 100 + Math.random() * 50,
                    y: 100 + Math.random() * 50,
                    width: 600,
                    height: 400,
                    id: appName
                });
                
                // Store the window id for this app
                activeWindows.set(appName, windowId);
                
                // Add active class to the icon
                this.classList.add('active');
                
                // Listen for window close to update active windows and icon state
                const windowEl = document.querySelector(`[data-window-id="${windowId}"]`);
                const closeBtn = windowEl.querySelector('.window-close');
                
                closeBtn.addEventListener('click', () => {
                    activeWindows.delete(appName);
                    this.classList.remove('active');
                });
            }
        });
    });

    
    // Listen for window-minimized events
    document.addEventListener('window-minimized', function(e) {
        const { windowId } = e.detail;
        
        // Find the app associated with this window
        for (const [appName, activeWindowId] of activeWindows.entries()) {
            if (activeWindowId === windowId) {
                // Remove active class from icon
                const icon = document.querySelector(`.dock-icon[data-app="${appName}"]`);
                if (icon) {
                    icon.classList.remove('active');
                }
                break;
            }
        }
    });
});
