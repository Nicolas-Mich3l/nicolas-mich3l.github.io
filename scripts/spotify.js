class SpotifyGenreTracker {
    constructor(netlifyFunctionUrl) {
        this.functionUrl = netlifyFunctionUrl; 
        this.lastFetch = null;
        this.cacheKey = 'spotify-genres-cache';

        this.cacheExpiry = 20 * 60 * 1000; // 20 minutes 
    }

    // Non-professional looking music genres I feel shame for 
    // Yes I know obfuscation =/= security
    getBlacklist() {
        return [
            'sexy drill',
            'rage rap',
        ].map(genre => genre.toLowerCase());
    }

    // Filter genres based on blacklist
    filterGenres(genres) {
        const blacklist = this.getBlacklist();
        return genres.filter(item => 
            !blacklist.includes(item.genre.toLowerCase())
        );
    }

    // Check if we should fetch new data
    shouldFetchNewData() {
        const cached = this.getCachedData();
        if (!cached) return true;
        
        const now = new Date().getTime();
        const cacheTime = new Date(cached.timestamp).getTime();
        return (now - cacheTime) > this.cacheExpiry;
    }

    // Get cached data from localStorage
    getCachedData() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    }

    // Save data to localStorage
    setCachedData(data) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }

    // Fetch data from Netlify function
    async fetchGenreData() {
        try {
            console.log('Fetching fresh Spotify data...');
            
            const response = await fetch(this.functionUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Cache the fresh data
            this.setCachedData(data);
            
            return data;
        } catch (error) {
            console.error('Error fetching genre data:', error);
            
            // Return cached data if available
            const cached = this.getCachedData();
            if (cached) {
                console.log('Using cached data due to fetch error');
                return cached;
            }
            
            throw error;
        }
    }

    // Main method to get genre data
    async getGenres() {
        // Check if we should use cached data
        if (!this.shouldFetchNewData()) {
            console.log('Using cached data');
            return this.getCachedData();
        }

        // Fetch fresh data
        return await this.fetchGenreData();
    }

    // Display genres in the UI
    displayGenres(data, containerId = 'genre-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID '${containerId}' not found`);
            return;
        }

        // Filter out blacklisted genres
        const filteredGenres = this.filterGenres(data.genres);
        const blacklistCount = data.genres.length - filteredGenres.length;

        container.innerHTML = `
            <div class="genre-summary">
                <h2>Whats Nic listening to?</h2>
                <p>Based on ${data.totalTracks} recently played tracks</p>
                <p>Last updated: ${data.lastUpdated}</p>
                <p>Data is fetched from the spotify API by a serverless function: <a target="_blank" rel="noopener noreferrer" href="https://github.com/Nicolas-Mich3l/spotify_functions/tree/main">Github</a><p>
            </div>
            
            <div class="controls">
                <button onclick="refreshGenreData()" class="btn btn-secondary">Refresh Data</button>
            </div>
            
            <div class="genre-list">
                ${filteredGenres.slice(0, 10).map((item, index) => `
                    <div class="genre-item">
                        <div class="genre-left">
                            <span class="genre-rank">#${index + 1}</span>
                            <span class="genre-name">${item.genre}</span>
                        </div>
                        <span class="genre-count">${item.count} tracks</span>
                    </div>
                `).join('')}
            </div>
            
            ${filteredGenres.length > 10 ? `
                <button class="show-more-btn" onclick="toggleAllGenres(this)">
                    Show All ${filteredGenres.length} Genres
                </button>
                <div class="all-genres" style="display: none;">
                    ${filteredGenres.slice(10).map((item, index) => `
                        <div class="genre-item">
                            <div class="genre-left">
                                <span class="genre-rank">#${index + 11}</span>
                                <span class="genre-name">${item.genre}</span>
                            </div>
                            <span class="genre-count">${item.count} tracks</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }
}

// Global variables
let tracker;

// Initialize on music "app" launch
window.addEventListener('music_open', async () => {
    tracker = new SpotifyGenreTracker('https://spt-functions.netlify.app/.netlify/functions/spt-genres');
    
    await loadGenreData();
});

// Load genre data
async function loadGenreData() {
    try {
        const genreData = await tracker.getGenres();
        tracker.displayGenres(genreData);
    } catch (error) {
        console.error('Failed to load genre data:', error);
        document.getElementById('genre-container').innerHTML = `
            <div class="error-message">
                <h3>Unable to load genre data</h3>
                <p>Please try again later.</p>
                <button onclick="loadGenreData()" class="btn" style="margin-top: 12px;">Retry</button>
            </div>
        `;
    }
}

// Refresh data
function refreshGenreData() {
    localStorage.removeItem('spotify-genres-cache');
    document.getElementById('genre-container').innerHTML = '<div class="loading">Refreshing music genres...</div>';
    loadGenreData();
}

// Toggle show all genres
function toggleAllGenres(button) {
    const allGenres = button.nextElementSibling;
    if (allGenres.style.display === 'none') {
        allGenres.style.display = 'block';
        button.textContent = 'Show Less';
    } else {
        allGenres.style.display = 'none';
        button.textContent = `Show All ${button.textContent.match(/\d+/)[0]} Genres`;
    }
}