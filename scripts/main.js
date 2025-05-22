// Window Manager - handles all window operations
class WindowManager {
    constructor() {
        this.windows = new Map();
        this.highestZIndex = 2;
        this.minimizedWindows = new Set();
        this.initialize();
    }
    
    initialize() {
        // Find all windows and register them
        document.querySelectorAll('.window').forEach(windowEl => {
            const windowId = windowEl.getAttribute('data-window-id');
            this.registerWindow(windowEl, windowId);
        });
        // Set up global event listeners
        document.addEventListener('mouseup', () => {
            this.stopDragging();
        });
        document.addEventListener('mousemove', (e) => {
            this.handleDrag(e);
        });
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
            height = null
        } = options;
        
        // Create window elements
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.style.left = `${x}px`;
        windowEl.style.top = `${y}px`;
        
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
    
    // Start dragging a window
    startDragging(windowId, e) {
        const windowData = this.windows.get(windowId);
        if (!windowData || windowData.isMaximized) return;
        
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
        for (const [windowId, windowData] of this.windows.entries()) {
            if (windowData.isDragging) {
                const x = e.clientX - windowData.offset.x;
                const y = e.clientY - windowData.offset.y;
                
                windowData.element.style.left = `${x}px`;
                windowData.element.style.top = `${y}px`;
                break; // Only one window can be dragged at a time
            }
        }
    }
    
    // Stop dragging
    stopDragging() {
        for (const windowData of this.windows.values()) {
            windowData.isDragging = false;
        }
    }
    
    // Close a window
    closeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        windowData.element.remove();
        this.windows.delete(windowId);
        this.minimizedWindows.delete(windowId);
    }
    
    // Minimize a window
    minimizeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;
        
        // Here you would typically animate the window to a taskbar or dock
        // For now, we'll just hide it and track it as minimized
        windowData.element.style.display = 'none';
        this.minimizedWindows.add(windowId);
        
        // You could trigger a custom event here for a taskbar to react
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
            windowData.element.style.height = 'calc(100% - 40px)';
            windowData.element.style.left = '20px';
            windowData.element.style.top = '30px';
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
                
                // Create a new window for this app
                const windowId = windowManager.createWindow({
                    title: appName.charAt(0).toUpperCase() + appName.slice(1),
                    content: content,
                    x: 100 + Math.random() * 50,
                    y: 100 + Math.random() * 50,
                    width: 600,
                    height: 400
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
