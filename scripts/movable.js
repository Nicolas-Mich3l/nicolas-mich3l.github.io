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

// Initialize the window manager
const windowManager = new WindowManager();
