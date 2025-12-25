/**
 * Egyptian Clubs Statistics - JavaScript
 */

// Global data storage
let egyptianClubsData = {
    allRecords: [],
    filteredRecords: [],
    appsScriptUrl: '',
    currentSort: { column: null, ascending: true },
    hanSelectedValues: [],
    h2hData: {
        egyptTeams: [],
        opponentTeams: [],
        currentSort: { type: null, column: null, ascending: true }
    }
};

// Virtual Scrolling state
let virtualScrollState = {
    allData: [],
    currentViewData: [],
    startIndex: 0,
    endIndex: 25, // Render first 25 rows initially
    bufferSize: 25, // Buffer rows above and below visible area
    rowHeight: 50, // Estimated row height in pixels
    tableContainer: null,
    scrollHandler: null
};

/**
 * Load Egyptian Clubs data from Google Apps Script
 */
async function loadEgyptianClubsData(forceRefresh = false, skipLoadingState = false) {
    try {
        hideError();
        if (!skipLoadingState) {
            showLoading(true);
        }

        // Get Apps Script URL from server
        const configResponse = await fetch('/api/egyptian-clubs/config');
        const config = await configResponse.json();
        
        if (config.success && config.appsScriptUrl) {
            egyptianClubsData.appsScriptUrl = config.appsScriptUrl;
        } else {
            throw new Error('Apps Script URL not configured. Please set EGYPTIAN_CLUBS_APPS_SCRIPT_URL environment variable.');
        }

        // Fetch data from Google Apps Script
        const response = await fetch(egyptianClubsData.appsScriptUrl);
        const result = await response.json();

        if (result.success && result.data) {
            // Find the main data sheet (first sheet with match data)
            const sheetNames = Object.keys(result.data);
            let mainSheet = null;
            
            // Try to find a sheet with the expected columns
            for (const sheetName of sheetNames) {
                const sheet = result.data[sheetName];
                if (sheet && sheet.length > 0 && sheet[0]['MATCH_ID']) {
                    mainSheet = sheet;
                    break;
                }
            }
            
            if (!mainSheet) {
                // If no sheet with MATCH_ID, use the first sheet
                mainSheet = result.data[sheetNames[0]];
            }
            
            egyptianClubsData.allRecords = mainSheet || [];
            egyptianClubsData.filteredRecords = [...egyptianClubsData.allRecords];
            
            console.log('✅ Data loaded successfully');
            console.log('📊 Total records:', egyptianClubsData.allRecords.length);
            
            // Generate UI
            populateFilters();
            renderTable();
            calculateH2HStats();
            populateFaceToFaceDropdowns();
            
            // Add filter event listeners
            addFilterListeners();
            
            // Setup dynamic table search
            setupDynamicTableSearch();
            
            if (!skipLoadingState) {
                showLoading(false);
            }
        } else {
            throw new Error(result.error || 'No Data Available');
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError('No Data Available');
        if (!skipLoadingState) {
            showLoading(false);
        }
    }
}

/**
 * Populate filter dropdowns
 */
function populateFilters() {
    const filters = {
        'champion-system-filter': 'CHAMPION SYSTEM',
        'year-filter': 'YEAR',
        'champion-filter': 'CHAMPION',
        'season-filter': 'SEASON',
        'round-filter': 'ROUND',
        'place-filter': 'PLACE',
        'egypt-team-filter': 'EGYPT TEAM',
        'opponent-team-filter': 'OPPONENT TEAM',
        'country-team-filter': 'COUNTRY TEAM',
        'result-filter': 'W-L MATCH',
        'clean-sheet-filter': 'CLEAN SHEET',
        'pen-filter': 'PEN'
    };
    
    Object.keys(filters).forEach(filterId => {
        const columnName = filters[filterId];
        const uniqueValues = [...new Set(
            egyptianClubsData.allRecords
                .map(record => record[columnName])
                .filter(val => val !== null && val !== undefined && val !== '')
        )].sort();
        
        const select = document.getElementById(filterId);
        if (select) {
            select.innerHTML = '<option value="">All</option>';
            uniqueValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
        }
    });
    
    // Populate H-A-N checklist
    populateHANChecklist();
    
    // Initialize searchable filters after populating
    initializeSearchableFilters();
}

/**
 * Populate H-A-N checklist
 */
function populateHANChecklist() {
    const uniqueValues = [...new Set(
        egyptianClubsData.allRecords
            .map(record => record['H-A-N'])
            .filter(val => val !== null && val !== undefined && val !== '')
    )].sort();
    
    const checklistDropdown = document.getElementById('han-checklist');
    if (checklistDropdown) {
        checklistDropdown.innerHTML = uniqueValues.map(value => `
            <div class="checklist-option">
                <input type="checkbox" id="han-${value}" value="${value}" onchange="updateHANFilter()">
                <label for="han-${value}">${value}</label>
            </div>
        `).join('');
    }
}

/**
 * Toggle checklist dropdown
 */
window.toggleChecklist = function(checklistId) {
    const dropdown = document.getElementById(checklistId);
    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        // Close all other checklists first
        document.querySelectorAll('.checklist-dropdown').forEach(d => {
            d.style.display = 'none';
        });
        // Toggle current checklist
        dropdown.style.display = isVisible ? 'none' : 'block';
    }
};

/**
 * Update H-A-N filter based on selected checkboxes
 */
window.updateHANFilter = function() {
    const checkboxes = document.querySelectorAll('#han-checklist input[type="checkbox"]:checked');
    const selectedValues = Array.from(checkboxes).map(cb => cb.value);
    
    const displayText = document.getElementById('han-display-text');
    if (displayText) {
        if (selectedValues.length === 0) {
            displayText.textContent = 'All';
        } else if (selectedValues.length === 1) {
            displayText.textContent = selectedValues[0];
        } else {
            displayText.textContent = `${selectedValues.length} selected`;
        }
    }
    
    // Store selected values for filtering
    egyptianClubsData.hanSelectedValues = selectedValues;
    
    // Apply filters
    applyFilters();
};

// Close checklist when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.checklist-container')) {
        document.querySelectorAll('.checklist-dropdown').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }
});

/**
 * Add filter event listeners
 */
function addFilterListeners() {
    // Filters will only be applied when user clicks "Apply Filters" button
    // No automatic event listeners to prevent auto-filtering
    // Users must click "Apply Filters" button to apply changes
}

/**
 * Apply filters to data
 */
function applyFilters() {
    const filters = {
        matchId: document.getElementById('match-id-filter')?.value || '',
        championSystem: document.getElementById('champion-system-filter')?.value || '',
        year: document.getElementById('year-filter')?.value || '',
        champion: document.getElementById('champion-filter')?.value || '',
        season: document.getElementById('season-filter')?.value || '',
        round: document.getElementById('round-filter')?.value || '',
        place: document.getElementById('place-filter')?.value || '',
        hanSelectedValues: egyptianClubsData.hanSelectedValues || [],
        egyptTeam: document.getElementById('egypt-team-filter')?.value || '',
        opponentTeam: document.getElementById('opponent-team-filter')?.value || '',
        countryTeam: document.getElementById('country-team-filter')?.value || '',
        result: document.getElementById('result-filter')?.value || '',
        cleanSheet: document.getElementById('clean-sheet-filter')?.value || '',
        pen: document.getElementById('pen-filter')?.value || '',
        dateFrom: document.getElementById('date-from-filter')?.value || '',
        dateTo: document.getElementById('date-to-filter')?.value || ''
    };
    
    egyptianClubsData.filteredRecords = egyptianClubsData.allRecords.filter(record => {
        // Match ID filter
        if (filters.matchId && !String(record['MATCH_ID'] || '').toLowerCase().includes(filters.matchId.toLowerCase())) {
            return false;
        }
        
        // Select filters
        if (filters.championSystem && record['CHAMPION SYSTEM'] !== filters.championSystem) return false;
        if (filters.year && record['YEAR'] !== filters.year) return false;
        if (filters.champion && record['CHAMPION'] !== filters.champion) return false;
        if (filters.season && record['SEASON'] !== filters.season) return false;
        if (filters.round && record['ROUND'] !== filters.round) return false;
        if (filters.place && record['PLACE'] !== filters.place) return false;
        // H-A-N checklist filter - check if value is in selected array
        if (filters.hanSelectedValues.length > 0 && !filters.hanSelectedValues.includes(record['H-A-N'])) return false;
        if (filters.egyptTeam && record['EGYPT TEAM'] !== filters.egyptTeam) return false;
        if (filters.opponentTeam && record['OPPONENT TEAM'] !== filters.opponentTeam) return false;
        if (filters.countryTeam && record['COUNTRY TEAM'] !== filters.countryTeam) return false;
        if (filters.result && record['W-L MATCH'] !== filters.result) return false;
        if (filters.cleanSheet && record['CLEAN SHEET'] !== filters.cleanSheet) return false;
        if (filters.pen && record['PEN'] !== filters.pen) return false;
        
        // Date range filter
        if (filters.dateFrom || filters.dateTo) {
            const recordDate = new Date(record['DATE']);
            if (filters.dateFrom && recordDate < new Date(filters.dateFrom)) return false;
            if (filters.dateTo && recordDate > new Date(filters.dateTo)) return false;
        }
        
        return true;
    });
    
    // Reset sort to default (by date, newest first)
    egyptianClubsData.currentSort = { column: null, ascending: true };
    
    renderTable();
    calculateH2HStats();
    
    // Clear search input when filters are applied
    const searchInput = document.getElementById('matches-search-input');
    if (searchInput) searchInput.value = '';
    
    // Update Face to Face if teams are selected
    const hasF2FSelection = document.getElementById('f2f-egypt-team')?.value || 
                           document.getElementById('f2f-egypt-all')?.value || 
                           document.getElementById('f2f-opponent-team')?.value || 
                           document.getElementById('f2f-country')?.value;
    if (hasF2FSelection) {
        updateFaceToFace();
    }
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    // Clear select filters
    const selectFilters = document.querySelectorAll('.filter-field select');
    selectFilters.forEach(select => {
        select.value = '';
        // Trigger change event to update searchable input
        const ev = new Event('change', { bubbles: true });
        select.dispatchEvent(ev);
    });
    
    // Clear searchable input filters
    const searchableInputs = document.querySelectorAll('.searchable-select-container input');
    searchableInputs.forEach(input => {
        input.value = '';
    });
    
    // Clear H-A-N checklist
    document.querySelectorAll('#han-checklist input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    egyptianClubsData.hanSelectedValues = [];
    const hanDisplayText = document.getElementById('han-display-text');
    if (hanDisplayText) {
        hanDisplayText.textContent = 'All';
    }
    
    // Clear input filters
    document.getElementById('match-id-filter').value = '';
    document.getElementById('date-from-filter').value = '';
    document.getElementById('date-to-filter').value = '';
    document.getElementById('table-search').value = '';
    
    // Clear table search input
    const searchInput = document.getElementById('matches-search-input');
    if (searchInput) searchInput.value = '';
    
    // Reset filtered records and sort
    egyptianClubsData.filteredRecords = [...egyptianClubsData.allRecords];
    egyptianClubsData.currentSort = { column: null, ascending: true };
    
    // Update UI
    renderTable();
    calculateH2HStats();
    
    // Update Face to Face if teams are selected
    const hasF2FSelection = document.getElementById('f2f-egypt-team')?.value || 
                           document.getElementById('f2f-egypt-all')?.value || 
                           document.getElementById('f2f-opponent-team')?.value || 
                           document.getElementById('f2f-country')?.value;
    if (hasF2FSelection) {
        updateFaceToFace();
    }
}


/**
 * Calculate Double Wins (رايح جاي)
 * Conditions: Same Egypt Team, Same Opponent, Same Season, Same Round, 2 Wins
 */
function calculateDoubleWins(data) {
    // Group matches by Egypt Team, Opponent Team, Season, and Round
    const groups = {};
    
    data.forEach(record => {
        const egyptTeam = record['EGYPT TEAM'];
        const opponentTeam = record['OPPONENT TEAM'];
        const season = record['SEASON'];
        const round = record['ROUND'];
        const result = record['W-L MATCH'];
        
        if (!egyptTeam || !opponentTeam || !season || !round) return;
        
        const key = `${egyptTeam}|${opponentTeam}|${season}|${round}`;
        
        if (!groups[key]) {
            groups[key] = {
                wins: 0,
                matches: 0
            };
        }
        
        groups[key].matches += 1;
        
        if (result === 'W' || result === 'Win') {
            groups[key].wins += 1;
        }
    });
    
    // Count groups where there are exactly 2 wins (or more, but we need at least 2)
    let doubleWinsCount = 0;
    
    Object.values(groups).forEach(group => {
        if (group.wins >= 2) {
            doubleWinsCount += 1;
        }
    });
    
    return doubleWinsCount;
}

/**
 * Calculate Double Losses (خسارة رايح جاي)
 * Conditions: Same Egypt Team, Same Opponent, Same Season, Same Round, 2 Losses
 */
function calculateDoubleLosses(data) {
    // Group matches by Egypt Team, Opponent Team, Season, and Round
    const groups = {};
    
    data.forEach(record => {
        const egyptTeam = record['EGYPT TEAM'];
        const opponentTeam = record['OPPONENT TEAM'];
        const season = record['SEASON'];
        const round = record['ROUND'];
        const result = record['W-L MATCH'];
        
        if (!egyptTeam || !opponentTeam || !season || !round) return;
        
        const key = `${egyptTeam}|${opponentTeam}|${season}|${round}`;
        
        if (!groups[key]) {
            groups[key] = {
                losses: 0,
                matches: 0
            };
        }
        
        groups[key].matches += 1;
        
        if (result === 'L' || result === 'Loss') {
            groups[key].losses += 1;
        }
    });
    
    // Count groups where there are exactly 2 losses (or more, but we need at least 2)
    let doubleLossesCount = 0;
    
    Object.values(groups).forEach(group => {
        if (group.losses >= 2) {
            doubleLossesCount += 1;
        }
    });
    
    return doubleLossesCount;
}

// Helper function to render a single row
function renderTableRow(row, columns) {
    return '<tr>' + columns.map(col => {
        let value = row[col] !== null && row[col] !== undefined ? row[col] : '';
        
        // Format DATE column to show only date without time
        if (col === 'DATE' && value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                // Format as YYYY-MM-DD
                value = date.toISOString().split('T')[0];
            }
        }
        
        return `<td>${escapeHtml(String(value))}</td>`;
    }).join('') + '</tr>';
}

// Virtual scrolling render function
function renderVisibleTableRows() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    const { allData, startIndex, endIndex } = virtualScrollState;
    const visibleData = allData.slice(startIndex, endIndex);
    const columns = ['DATE', 'SEASON', 'ROUND', 'H-A-N', 'EGYPT TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-L MATCH'];
    
    // Create spacer row for top (only if startIndex > 0)
    const topSpacer = startIndex > 0 ? `<tr style="height: ${startIndex * virtualScrollState.rowHeight}px;"><td colspan="${columns.length}"></td></tr>` : '';
    // Render visible rows
    const rowsHtml = visibleData.map(row => renderTableRow(row, columns)).join('');
    // Create spacer row for bottom
    const bottomSpacer = `<tr style="height: ${Math.max(0, allData.length - endIndex) * virtualScrollState.rowHeight}px;"><td colspan="${columns.length}"></td></tr>`;
    
    tbody.innerHTML = topSpacer + rowsHtml + bottomSpacer;
}

/**
 * Render table with data
 */
function renderTable() {
    const data = egyptianClubsData.filteredRecords;
    const thead = document.getElementById('table-headers');
    const tbody = document.getElementById('table-body');
    
    if (!thead || !tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="no-data">No data available</td></tr>';
        // Remove scroll handlers if they exist
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }
        return;
    }
    
    // Define specific columns to display in order
    const columns = ['DATE', 'SEASON', 'ROUND', 'H-A-N', 'EGYPT TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-L MATCH'];
    
    // Generate headers
    thead.innerHTML = columns.map(col => 
        `<th onclick="sortTable('${col}')">${col} ⇅</th>`
    ).join('');
    
    // Sort data by DATE (newest first) if no custom sort is applied
    let sortedData = [...data];
    if (!egyptianClubsData.currentSort.column) {
        sortedData.sort((a, b) => {
            const dateA = new Date(a['DATE'] || '');
            const dateB = new Date(b['DATE'] || '');
            return dateB - dateA; // Descending order (newest first)
        });
    }
    
    // For small datasets (< 1000 rows), render everything at once for better compatibility
    if (sortedData.length <= 1000) {
        tbody.innerHTML = sortedData.map(row => renderTableRow(row, columns)).join('');
        // Remove scroll handlers if they exist
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }
        return;
    }
    
    // For large datasets, use virtual scrolling
    virtualScrollState.allData = sortedData;
    virtualScrollState.currentViewData = sortedData;
    
    // Reset scroll state
    virtualScrollState.startIndex = 0;
    virtualScrollState.endIndex = Math.min(25, sortedData.length);
    
    // Reset scroll position
    const container = document.querySelector('.matches-table-container');
    if (container) {
        container.scrollTop = 0;
    }
    
    // Initial render
    renderVisibleTableRows();
    
    // Setup virtual scrolling
    setupVirtualScrolling();
}

function setupVirtualScrolling() {
    // Remove old scroll handler if exists
    if (virtualScrollState.scrollHandler) {
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.removeEventListener('scroll', virtualScrollState.scrollHandler);
        }
    }
    
    // Create new scroll handler
    virtualScrollState.scrollHandler = function handleScroll(e) {
        const container = e.target;
        if (!container) return;
        
        const scrollTop = container.scrollTop || 0;
        const containerHeight = container.clientHeight || 0;
        const { allData, rowHeight, bufferSize } = virtualScrollState;
        
        // Calculate which rows should be visible
        const visibleStart = Math.floor(scrollTop / rowHeight);
        const visibleEnd = Math.ceil((scrollTop + containerHeight) / rowHeight);
        
        // Add buffer
        const bufferStart = Math.max(0, visibleStart - bufferSize);
        const bufferEnd = Math.min(allData.length, visibleEnd + bufferSize);
        
        // Only re-render if the visible range has changed significantly
        if (Math.abs(bufferStart - virtualScrollState.startIndex) > 5 || 
            Math.abs(bufferEnd - virtualScrollState.endIndex) > 5) {
            virtualScrollState.startIndex = bufferStart;
            virtualScrollState.endIndex = bufferEnd;
            renderVisibleTableRows();
        }
    };
    
    // Attach scroll listener to the table container
    const container = document.querySelector('.matches-table-container');
    if (container) {
        container.addEventListener('scroll', virtualScrollState.scrollHandler);
    }
}

// Setup dynamic table search
function setupDynamicTableSearch() {
    const searchInput = document.getElementById('matches-search-input');
    if (!searchInput) return;

    // Remove previous listeners by cloning the input
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('keyup', () => {
        const searchTerm = newSearchInput.value.toLowerCase().trim();
        
        // Get current filtered records
        const currentData = egyptianClubsData.filteredRecords;
        const columns = ['DATE', 'SEASON', 'ROUND', 'H-A-N', 'EGYPT TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-L MATCH'];
        
        // Sort data by DATE (newest first) if no custom sort is applied
        let sortedData = [...currentData];
        if (!egyptianClubsData.currentSort.column) {
            sortedData.sort((a, b) => {
                const dateA = new Date(a['DATE'] || '');
                const dateB = new Date(b['DATE'] || '');
                return dateB - dateA;
            });
        }
        
        // If dataset is small, use regular filtering without virtual scroll
        if (sortedData.length <= 1000) {
            if (!searchTerm) {
                // No search term, restore full data
                renderTable();
                return;
            } else {
                // Filter data based on search
                const tbody = document.getElementById('table-body');
                if (!tbody) return;
                
                const filtered = sortedData.filter((row) => {
                    const rowText = columns.map(c => String(row[c] || '')).join(' ').toLowerCase();
                    return rowText.includes(searchTerm);
                });
                
                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="100%" class="no-data">No data available</td></tr>';
                } else {
                    tbody.innerHTML = filtered.map(row => renderTableRow(row, columns)).join('');
                }
                return;
            }
        }
        
        // For large datasets with virtual scrolling
        if (!searchTerm) {
            // No search term, restore full data
            virtualScrollState.allData = sortedData;
            virtualScrollState.currentViewData = sortedData;
        } else {
            // Filter data based on search from current filtered records
            const filtered = sortedData.filter((row) => {
                const rowText = columns.map(c => String(row[c] || '')).join(' ').toLowerCase();
                return rowText.includes(searchTerm);
            });
            virtualScrollState.allData = filtered;
            // Keep currentViewData as the original (before search) for when user clears search
            virtualScrollState.currentViewData = sortedData;
        }
        
        // Reset scroll position
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.scrollTop = 0;
        }
        
        // Reset scroll and re-render
        virtualScrollState.startIndex = 0;
        virtualScrollState.endIndex = Math.min(25, virtualScrollState.allData.length);
        renderVisibleTableRows();
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sort table by column
 */
function sortTable(column) {
    const isAscending = egyptianClubsData.currentSort.column === column ? 
        !egyptianClubsData.currentSort.ascending : true;
    
    egyptianClubsData.filteredRecords.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        // Handle dates specially
        if (column === 'DATE') {
            valA = new Date(valA || '');
            valB = new Date(valB || '');
        }
        // Handle numbers
        else if (!isNaN(valA) && !isNaN(valB)) {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }
        
        if (valA < valB) return isAscending ? -1 : 1;
        if (valA > valB) return isAscending ? 1 : -1;
        return 0;
    });
    
    egyptianClubsData.currentSort = { column, ascending: isAscending };
    renderTable();
}

/**
 * Search in table (legacy function - kept for compatibility, but now uses setupDynamicTableSearch)
 */
function searchMainTable(searchValue) {
    // This function is kept for backward compatibility
    // The new search is handled by setupDynamicTableSearch
    const searchInput = document.getElementById('matches-search-input');
    if (searchInput) {
        searchInput.value = searchValue;
        // Trigger the keyup event to use the new search
        const event = new Event('keyup');
        searchInput.dispatchEvent(event);
    }
}

/**
 * Sync data manually
 */
async function syncData() {
    const syncBtn = document.getElementById('sync-data-btn');
    const syncIcon = document.getElementById('sync-icon');
    const syncText = document.getElementById('sync-btn-text');
    
    if (!syncBtn || !syncIcon || !syncText) return;
    
    syncBtn.disabled = true;
    syncIcon.classList.add('spinning');
    syncText.textContent = 'Syncing...';
    
    try {
        await loadEgyptianClubsData(true, true); // true = force refresh, true = skip loading state
        syncText.textContent = 'Synced!';
        setTimeout(() => {
            syncText.textContent = 'Sync Data';
            syncIcon.classList.remove('spinning');
            syncBtn.disabled = false;
        }, 2000);
    } catch (error) {
        syncText.textContent = 'Sync Failed';
        setTimeout(() => {
            syncText.textContent = 'Sync Data';
            syncIcon.classList.remove('spinning');
            syncBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
    const loadingContainer = document.getElementById('loading-container');
    const contentContainer = document.getElementById('main-content');
    
    if (loadingContainer) {
        loadingContainer.style.display = show ? 'flex' : 'none';
    }
    
    if (contentContainer) {
        contentContainer.style.display = show ? 'none' : 'block';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
        errorContainer.style.display = 'block';
    }
}

/**
 * Hide error message
 */
function hideError() {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

/**
 * Show stats tab
 */
function showStatsTab(event, tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.stats-tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.stats-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked tab
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

/**
 * Initialize searchable filters for all select dropdowns
 */
function initializeSearchableFilters() {
    const selects = document.querySelectorAll('.filter-field select');
    selects.forEach(select => {
        makeSelectSearchable(select);
    });
}

/**
 * Make a select dropdown searchable
 */
function makeSelectSearchable(select) {
    if (!select || select.dataset.searchable === 'true') return;
    
    select.style.display = 'none';
    select.dataset.searchable = 'true';
    
    const container = document.createElement('div');
    container.className = 'searchable-select-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = select.options[0]?.text || 'Search...';
    input.value = '';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-options';
    dropdown.style.display = 'none';
    
    select.parentElement.insertBefore(container, select);
    container.appendChild(input);
    container.appendChild(dropdown);
    container.appendChild(select);
    
    function renderOptions(filterText = '') {
        dropdown.innerHTML = '';
        const text = filterText.toLowerCase();
        Array.from(select.options).forEach((opt, idx) => {
            if (idx === 0) return; // skip placeholder "All"
            const label = String(opt.text || '').trim();
            const value = String(opt.value || '').trim();
            if (!text || label.toLowerCase().includes(text) || value.toLowerCase().includes(text)) {
                const div = document.createElement('div');
                div.textContent = label;
                div.dataset.value = value;
                div.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    select.value = value;
                    input.value = label;
                    dropdown.style.display = 'none';
                    // Trigger change for filter logic
                    const ev = new Event('change', { bubbles: true });
                    select.dispatchEvent(ev);
                });
                dropdown.appendChild(div);
            }
        });
        dropdown.style.display = dropdown.children.length ? 'block' : 'none';
    }
    
    input.addEventListener('focus', () => renderOptions(input.value));
    input.addEventListener('input', () => renderOptions(input.value));
    input.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 200);
    });
    
    // Update input when select changes programmatically
    select.addEventListener('change', function() {
        if (select.value === '') {
            input.value = '';
        } else {
            const selectedOption = Array.from(select.options).find(opt => opt.value === select.value);
            if (selectedOption) {
                input.value = selectedOption.text;
            }
        }
    });
}

/**
 * Calculate H2H statistics for teams
 */
function calculateH2HStats() {
    const data = egyptianClubsData.filteredRecords;
    
    // Calculate stats for Egypt teams
    const egyptTeamsStats = {};
    
    data.forEach(record => {
        const team = record['EGYPT TEAM'];
        if (!team) return;
        
        if (!egyptTeamsStats[team]) {
            egyptTeamsStats[team] = {
                team: team,
                P: 0,
                W: 0,
                D: 0,
                L: 0,
                GF: 0,
                GA: 0,
                GD: 0,
                CF: 0,
                CA: 0
            };
        }
        
        const stats = egyptTeamsStats[team];
        stats.P += 1;
        
        const result = record['W-L MATCH'];
        if (result === 'W' || result === 'Win') stats.W += 1;
        else if (result === 'D' || result === 'D.' || result === 'Draw') stats.D += 1;
        else if (result === 'L' || result === 'Loss') stats.L += 1;
        
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        
        stats.GF += gf;
        stats.GA += ga;
        
        if (ga === 0) stats.CF += 1; // Clean sheet for (didn't concede)
        if (gf === 0) stats.CA += 1; // Clean sheet against (didn't score)
    });
    
    // Calculate goal difference
    Object.values(egyptTeamsStats).forEach(stats => {
        stats.GD = stats.GF - stats.GA;
    });
    
    egyptianClubsData.h2hData.egyptTeams = Object.values(egyptTeamsStats);
    
    // Calculate stats for Opponent teams
    const opponentTeamsStats = {};
    
    data.forEach(record => {
        const team = record['OPPONENT TEAM'];
        if (!team) return;
        
        if (!opponentTeamsStats[team]) {
            opponentTeamsStats[team] = {
                team: team,
                P: 0,
                W: 0,
                D: 0,
                L: 0,
                GF: 0,
                GA: 0,
                GD: 0,
                CF: 0,
                CA: 0
            };
        }
        
        const stats = opponentTeamsStats[team];
        stats.P += 1;
        
        const result = record['W-L MATCH'];
        // For opponent, reverse the result
        if (result === 'L' || result === 'Loss') stats.W += 1;
        else if (result === 'D' || result === 'D.' || result === 'Draw') stats.D += 1;
        else if (result === 'W' || result === 'Win') stats.L += 1;
        
        const gf = parseInt(record['GA']) || 0; // Opponent's GF is Egypt's GA
        const ga = parseInt(record['GF']) || 0; // Opponent's GA is Egypt's GF
        
        stats.GF += gf;
        stats.GA += ga;
        
        if (ga === 0) stats.CF += 1; // Clean sheet for opponent
        if (gf === 0) stats.CA += 1; // Clean sheet against opponent
    });
    
    // Calculate goal difference
    Object.values(opponentTeamsStats).forEach(stats => {
        stats.GD = stats.GF - stats.GA;
    });
    
    egyptianClubsData.h2hData.opponentTeams = Object.values(opponentTeamsStats);
    
    // Render H2H tables
    renderH2HTables();
}

/**
 * Render H2H tables
 */
function renderH2HTables() {
    renderH2HTable('egypt');
    renderH2HTable('opponent');
}

/**
 * Render specific H2H table
 */
function renderH2HTable(type) {
    const data = type === 'egypt' ? egyptianClubsData.h2hData.egyptTeams : egyptianClubsData.h2hData.opponentTeams;
    const tbody = document.getElementById(type === 'egypt' ? 'egypt-teams-body' : 'opponent-teams-body');
    const tfoot = document.getElementById(type === 'egypt' ? 'egypt-teams-footer' : 'opponent-teams-footer');
    
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">No data available</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }
    
    // Sort by matches played (descending) by default if no custom sort
    let sortedData = [...data];
    if (!egyptianClubsData.h2hData.currentSort.column || egyptianClubsData.h2hData.currentSort.type !== type) {
        sortedData.sort((a, b) => b.P - a.P);
    }
    
    tbody.innerHTML = sortedData.map(team => `
        <tr>
            <td>${team.team}</td>
            <td>${team.P}</td>
            <td>${team.W}</td>
            <td>${team.D}</td>
            <td>${team.L}</td>
            <td>${team.GF}</td>
            <td>${team.GA}</td>
            <td>${team.GD >= 0 ? '+' : ''}${team.GD}</td>
            <td>${team.CF}</td>
            <td>${team.CA}</td>
        </tr>
    `).join('');
    
    // Calculate and render totals
    if (tfoot) {
        const totals = {
            P: 0,
            W: 0,
            D: 0,
            L: 0,
            GF: 0,
            GA: 0,
            GD: 0,
            CF: 0,
            CA: 0
        };
        
        sortedData.forEach(team => {
            totals.P += team.P;
            totals.W += team.W;
            totals.D += team.D;
            totals.L += team.L;
            totals.GF += team.GF;
            totals.GA += team.GA;
            totals.CF += team.CF;
            totals.CA += team.CA;
        });
        
        totals.GD = totals.GF - totals.GA;
        
        tfoot.innerHTML = `
            <tr>
                <td style="text-align: center;"><strong>Total</strong></td>
                <td>${totals.P}</td>
                <td>${totals.W}</td>
                <td>${totals.D}</td>
                <td>${totals.L}</td>
                <td>${totals.GF}</td>
                <td>${totals.GA}</td>
                <td>${totals.GD >= 0 ? '+' : ''}${totals.GD}</td>
                <td>${totals.CF}</td>
                <td>${totals.CA}</td>
            </tr>
        `;
    }
}

/**
 * Sort H2H table
 */
function sortH2HTable(type, column) {
    const data = type === 'egypt' ? egyptianClubsData.h2hData.egyptTeams : egyptianClubsData.h2hData.opponentTeams;
    
    const isAscending = egyptianClubsData.h2hData.currentSort.type === type && 
                        egyptianClubsData.h2hData.currentSort.column === column ? 
                        !egyptianClubsData.h2hData.currentSort.ascending : true;
    
    data.sort((a, b) => {
        let valA = column === 'team' ? a.team : a[column];
        let valB = column === 'team' ? b.team : b[column];
        
        if (column === 'team') {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        } else {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        }
        
        if (valA < valB) return isAscending ? -1 : 1;
        if (valA > valB) return isAscending ? 1 : -1;
        return 0;
    });
    
    egyptianClubsData.h2hData.currentSort = { type, column, ascending: isAscending };
    renderH2HTable(type);
}

/**
 * Show H2H sub tab
 */
function showH2HSubTab(event, tabId) {
    // Hide all sub tab contents
    const subContents = document.querySelectorAll('.h2h-sub-content');
    subContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all sub tabs
    const subTabs = document.querySelectorAll('.h2h-sub-tab');
    subTabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected sub tab content
    const selectedContent = document.getElementById(tabId);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Add active class to clicked sub tab
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

/**
 * Search in H2H table
 */
function searchH2HTable(type, searchValue) {
    const tbody = document.getElementById(type === 'egypt' ? 'egypt-teams-body' : 'opponent-teams-body');
    const tfoot = document.getElementById(type === 'egypt' ? 'egypt-teams-footer' : 'opponent-teams-footer');
    
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    const searchTerm = searchValue.toLowerCase().trim();
    
    // Filter rows
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
    
    // Recalculate totals based on visible rows
    if (tfoot) {
        const totals = {
            P: 0,
            W: 0,
            D: 0,
            L: 0,
            GF: 0,
            GA: 0,
            GD: 0,
            CF: 0,
            CA: 0
        };
        
        rows.forEach(row => {
            if (row.style.display !== 'none') {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 10) {
                    totals.P += parseInt(cells[1].textContent) || 0;
                    totals.W += parseInt(cells[2].textContent) || 0;
                    totals.D += parseInt(cells[3].textContent) || 0;
                    totals.L += parseInt(cells[4].textContent) || 0;
                    totals.GF += parseInt(cells[5].textContent) || 0;
                    totals.GA += parseInt(cells[6].textContent) || 0;
                    totals.CF += parseInt(cells[8].textContent) || 0;
                    totals.CA += parseInt(cells[9].textContent) || 0;
                }
            }
        });
        
        totals.GD = totals.GF - totals.GA;
        
        tfoot.innerHTML = `
            <tr>
                <td style="text-align: center;"><strong>Total</strong></td>
                <td>${totals.P}</td>
                <td>${totals.W}</td>
                <td>${totals.D}</td>
                <td>${totals.L}</td>
                <td>${totals.GF}</td>
                <td>${totals.GA}</td>
                <td>${totals.GD >= 0 ? '+' : ''}${totals.GD}</td>
                <td>${totals.CF}</td>
                <td>${totals.CA}</td>
            </tr>
        `;
    }
}

/**
 * Populate Face to Face dropdowns
 */
function populateFaceToFaceDropdowns() {
    // Use all records for dropdown options (not filtered)
    const data = egyptianClubsData.allRecords;
    
    // Get unique Egypt teams
    const egyptTeams = [...new Set(data.map(r => r['EGYPT TEAM']).filter(t => t))].sort();
    const egyptTeamSelect = document.getElementById('f2f-egypt-team');
    if (egyptTeamSelect) {
        const currentValue = egyptTeamSelect.value;
        egyptTeamSelect.innerHTML = '<option value="">Select Team</option>' +
            egyptTeams.map(team => `<option value="${team}">${team}</option>`).join('');
        egyptTeamSelect.value = currentValue;
    }
    
    // Get unique Opponent teams
    const opponentTeams = [...new Set(data.map(r => r['OPPONENT TEAM']).filter(t => t))].sort();
    const opponentTeamSelect = document.getElementById('f2f-opponent-team');
    if (opponentTeamSelect) {
        const currentValue = opponentTeamSelect.value;
        opponentTeamSelect.innerHTML = '<option value="">Select Team</option>' +
            opponentTeams.map(team => `<option value="${team}">${team}</option>`).join('');
        opponentTeamSelect.value = currentValue;
    }
    
    // Get unique Countries
    const countries = [...new Set(data.map(r => r['COUNTRY TEAM']).filter(c => c))].sort();
    const countrySelect = document.getElementById('f2f-country');
    if (countrySelect) {
        const currentValue = countrySelect.value;
        countrySelect.innerHTML = '<option value="">Individual Team</option>' +
            '<option value="ALL_OPPONENTS">All Opponent Teams</option>' +
            countries.map(country => `<option value="${country}">${country}</option>`).join('');
        countrySelect.value = currentValue;
    }
}

/**
 * Update Face to Face comparison
 */
function updateFaceToFace() {
    const egyptTeam = document.getElementById('f2f-egypt-team')?.value || '';
    const egyptAll = document.getElementById('f2f-egypt-all')?.value || '';
    const opponentTeam = document.getElementById('f2f-opponent-team')?.value || '';
    const country = document.getElementById('f2f-country')?.value || '';
    
    // Clear opposite selections
    if (egyptAll === 'ALL') {
        document.getElementById('f2f-egypt-team').value = '';
    }
    if (egyptTeam) {
        document.getElementById('f2f-egypt-all').value = '';
    }
    if (country) {
        document.getElementById('f2f-opponent-team').value = '';
    }
    if (opponentTeam) {
        document.getElementById('f2f-country').value = '';
    }
    
    // Check if we have valid selection
    const hasEgyptSide = egyptTeam || egyptAll === 'ALL';
    const hasOpponentSide = opponentTeam || country;
    
    if (!hasEgyptSide || !hasOpponentSide) {
        document.getElementById('f2f-table-body').innerHTML = 
            '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: #999;">Please select teams to compare</td></tr>';
        document.getElementById('f2f-team1-header').textContent = 'Egypt Side';
        document.getElementById('f2f-team2-header').textContent = 'Opponent Side';
        document.getElementById('f2f-title').textContent = 'Select teams to compare';
        return;
    }
    
    // Start with filtered data (affected by top filters)
    let egyptData = egyptianClubsData.filteredRecords;
    
    // Filter data for Egypt side
    if (egyptTeam) {
        egyptData = egyptData.filter(r => r['EGYPT TEAM'] === egyptTeam);
    }
    // If egyptAll === 'ALL', no filtering needed
    
    // Further filter for opponent side
    if (opponentTeam) {
        egyptData = egyptData.filter(r => r['OPPONENT TEAM'] === opponentTeam);
    } else if (country) {
        if (country === 'ALL_OPPONENTS') {
            // No filtering needed - show all opponent teams
        } else {
            egyptData = egyptData.filter(r => r['COUNTRY TEAM'] === country);
        }
    }
    
    // Calculate opponent stats (reverse perspective)
    const opponentData = calculateOpponentStats(egyptData);
    
    // Calculate Egypt stats
    const egyptStats = calculateSideStats(egyptData, true);
    
    // Update headers
    const egyptSideName = egyptAll === 'ALL' ? 'All Egypt Teams' : (egyptTeam || 'Egypt Side');
    const opponentSideName = country === 'ALL_OPPONENTS' ? 'All Opponent Teams' : (country || opponentTeam || 'Opponent Side');
    
    document.getElementById('f2f-team1-header').textContent = egyptSideName;
    document.getElementById('f2f-team2-header').textContent = opponentSideName;
    
    // Update title
    document.getElementById('f2f-title').textContent = `${egyptSideName} vs ${opponentSideName} Matches`;
    
    // Render comparison table
    renderFaceToFaceTable(egyptStats, opponentData);
}

/**
 * Calculate stats for Egypt side
 */
function calculateSideStats(data, isEgypt = true) {
    // Calculate unique seasons
    const uniqueSeasons = new Set(data.map(r => r['SEASON']).filter(s => s));
    
    const stats = {
        totalSeasons: uniqueSeasons.size,
        totalMatches: data.length,
        wins: data.filter(r => r['W-L MATCH'] === 'W' || r['W-L MATCH'] === 'Win').length,
        winsAway: data.filter(r => (r['W-L MATCH'] === 'W' || r['W-L MATCH'] === 'Win') && r['H-A-N'] === 'A').length,
        draws: data.filter(r => r['W-L MATCH'] === 'D' || r['W-L MATCH'] === 'D.' || r['W-L MATCH'] === 'Draw').length,
        losses: data.filter(r => r['W-L MATCH'] === 'L' || r['W-L MATCH'] === 'Loss').length,
        goalsFor: data.reduce((sum, r) => sum + (parseInt(r['GF']) || 0), 0),
        cleanSheetFor: data.filter(r => parseInt(r['GA']) === 0).length,
        doubleWins: calculateDoubleWins(data),
        doubleLosses: calculateDoubleLosses(data),
        knockoutWins: data.filter(r => String(r['W-L Q & F'] || '').includes('QEGY')).length,
        finalsWins: data.filter(r => String(r['W-L Q & F'] || '').includes('FEGY')).length,
        biggestWin: calculateBiggestWin(data, true)
    };
    return stats;
}

/**
 * Calculate biggest win
 */
function calculateBiggestWin(data, isEgypt = true) {
    // Filter only wins
    const wins = data.filter(r => r['W-L MATCH'] === 'W' || r['W-L MATCH'] === 'Win');
    
    if (wins.length === 0) {
        return { score: '-', date: '', team: '', opponent: '', allWins: [] };
    }
    
    let maxDiff = -1;
    let biggestWins = [];
    
    // Find the maximum goal difference
    wins.forEach(record => {
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        const diff = gf - ga;
        
        if (diff > maxDiff) {
            maxDiff = diff;
        }
    });
    
    // Collect all wins with the maximum goal difference
    wins.forEach(record => {
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        const diff = gf - ga;
        
        if (diff === maxDiff) {
            biggestWins.push({
                score: `${gf}-${ga}`,
                date: record['DATE'] ? new Date(record['DATE']).toISOString().split('T')[0] : '',
                team: record['EGYPT TEAM'] || '',
                opponent: record['OPPONENT TEAM'] || ''
            });
        }
    });
    
    // Sort by date (newest first)
    biggestWins.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
        score: biggestWins[0]?.score || '-',
        date: biggestWins[0]?.date || '',
        team: biggestWins[0]?.team || '',
        opponent: biggestWins[0]?.opponent || '',
        allWins: biggestWins
    };
}

/**
 * Calculate opponent stats (reverse perspective)
 */
function calculateOpponentStats(data) {
    // Calculate unique seasons
    const uniqueSeasons = new Set(data.map(r => r['SEASON']).filter(s => s));
    
    const stats = {
        totalSeasons: uniqueSeasons.size,
        totalMatches: data.length,
        wins: data.filter(r => r['W-L MATCH'] === 'L' || r['W-L MATCH'] === 'Loss').length,
        winsAway: data.filter(r => (r['W-L MATCH'] === 'L' || r['W-L MATCH'] === 'Loss') && r['H-A-N'] === 'H').length,
        draws: data.filter(r => r['W-L MATCH'] === 'D' || r['W-L MATCH'] === 'D.' || r['W-L MATCH'] === 'Draw').length,
        losses: data.filter(r => r['W-L MATCH'] === 'W' || r['W-L MATCH'] === 'Win').length,
        goalsFor: data.reduce((sum, r) => sum + (parseInt(r['GA']) || 0), 0),
        cleanSheetFor: data.filter(r => parseInt(r['GF']) === 0).length,
        doubleWins: 0, // Not applicable for opponent
        doubleLosses: 0, // Not applicable for opponent
        knockoutWins: data.filter(r => String(r['W-L Q & F'] || '').includes('QOPP')).length,
        finalsWins: data.filter(r => String(r['W-L Q & F'] || '').includes('FOPP')).length,
        biggestWin: calculateBiggestWinOpponent(data)
    };
    return stats;
}

/**
 * Calculate biggest win for opponent (reverse perspective)
 */
function calculateBiggestWinOpponent(data) {
    // Filter only opponent wins (Egypt losses)
    const wins = data.filter(r => r['W-L MATCH'] === 'L' || r['W-L MATCH'] === 'Loss');
    
    if (wins.length === 0) {
        return { score: '-', date: '', team: '', opponent: '', allWins: [] };
    }
    
    let maxDiff = -1;
    let biggestWins = [];
    
    // Find the maximum goal difference
    wins.forEach(record => {
        const gf = parseInt(record['GA']) || 0; // Opponent's GF is Egypt's GA
        const ga = parseInt(record['GF']) || 0; // Opponent's GA is Egypt's GF
        const diff = gf - ga;
        
        if (diff > maxDiff) {
            maxDiff = diff;
        }
    });
    
    // Collect all wins with the maximum goal difference
    wins.forEach(record => {
        const gf = parseInt(record['GA']) || 0; // Opponent's GF is Egypt's GA
        const ga = parseInt(record['GF']) || 0; // Opponent's GA is Egypt's GF
        const diff = gf - ga;
        
        if (diff === maxDiff) {
            biggestWins.push({
                score: `${gf}-${ga}`,
                date: record['DATE'] ? new Date(record['DATE']).toISOString().split('T')[0] : '',
                team: record['OPPONENT TEAM'] || '',
                opponent: record['EGYPT TEAM'] || ''
            });
        }
    });
    
    // Sort by date (newest first)
    biggestWins.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
        score: biggestWins[0]?.score || '-',
        date: biggestWins[0]?.date || '',
        team: biggestWins[0]?.team || '',
        opponent: biggestWins[0]?.opponent || '',
        allWins: biggestWins
    };
}

/**
 * Render Face to Face comparison table
 */
function renderFaceToFaceTable(egyptStats, opponentStats) {
    const tbody = document.getElementById('f2f-table-body');
    
    const statsRows = [
        ['Total Seasons', egyptStats.totalSeasons, opponentStats.totalSeasons],
        ['Total Matches', egyptStats.totalMatches, opponentStats.totalMatches],
        ['Wins', egyptStats.wins, opponentStats.wins],
        ['Wins Away', egyptStats.winsAway, opponentStats.winsAway],
        ['Double Wins', egyptStats.doubleWins, opponentStats.doubleWins],
        ['Draws', egyptStats.draws, opponentStats.draws],
        ['Losses', egyptStats.losses, opponentStats.losses],
        ['Goals', egyptStats.goalsFor, opponentStats.goalsFor],
        ['Clean Sheet', egyptStats.cleanSheetFor, opponentStats.cleanSheetFor],
        ['Knockout Wins', egyptStats.knockoutWins, opponentStats.knockoutWins],
        ['Finals Wins', egyptStats.finalsWins, opponentStats.finalsWins],
        ['Biggest Win', egyptStats.biggestWin, opponentStats.biggestWin, true] // true = special formatting
    ];
    
    tbody.innerHTML = statsRows.map(([stat, val1, val2, isSpecial]) => {
        let val1Html = val1;
        let val2Html = val2;
        
        // Special formatting for Biggest Win
        if (isSpecial && typeof val1 === 'object' && typeof val2 === 'object') {
            val1Html = val1.score !== '-' 
                ? `${val1.allWins && val1.allWins.length > 1 ? 
                    val1.allWins.map(win => `<div style="font-size: 0.9rem; font-weight: 600; color: #333; margin-top: 4px;">${win.score}</div><div style="font-size: 0.8rem; color: #666; margin-top: 2px;">${win.date} - ${win.team} vs ${win.opponent}</div>`).join('') : 
                    `<div style="font-size: 0.8rem; color: #666;">${val1.date}</div><div style="font-size: 0.85rem; color: #888;">${val1.team}</div><div style="font-size: 0.8rem; color: #e74c3c; margin-top: 2px;">${val1.opponent || ''}</div>`}`
                : '-';
            val2Html = val2.score !== '-' 
                ? `${val2.allWins && val2.allWins.length > 1 ? 
                    val2.allWins.map(win => `<div style="font-size: 0.9rem; font-weight: 600; color: #333; margin-top: 4px;">${win.score}</div><div style="font-size: 0.8rem; color: #666; margin-top: 2px;">${win.date} - ${win.team} vs ${win.opponent}</div>`).join('') : 
                    `<div style="font-size: 0.8rem; color: #666;">${val2.date}</div><div style="font-size: 0.85rem; color: #888;">${val2.team}</div><div style="font-size: 0.8rem; color: #e74c3c; margin-top: 2px;">${val2.opponent || ''}</div>`}`
                : '-';
        } else {
            // Determine which value is higher (only if both are numbers and greater than 0)
            const num1 = parseFloat(val1);
            const num2 = parseFloat(val2);
            
            if (!isNaN(num1) && !isNaN(num2)) {
                if (num1 > num2 && num1 > 0) {
                    val1Html = `<span class="f2f-highlight">${val1}</span>`;
                } else if (num2 > num1 && num2 > 0) {
                    val2Html = `<span class="f2f-highlight">${val2}</span>`;
                }
            }
        }
        
        return `
            <tr>
                <td style="text-align: center;">${val1Html}</td>
                <td style="text-align: center;">${stat}</td>
                <td style="text-align: center;">${val2Html}</td>
            </tr>
        `;
    }).join('');
}

// Export functions to window
window.loadEgyptianClubsData = loadEgyptianClubsData;
window.syncData = syncData;
window.sortTable = sortTable;
window.searchMainTable = searchMainTable;
window.clearAllFilters = clearAllFilters;
window.applyFilters = applyFilters;
window.showStatsTab = showStatsTab;
window.sortH2HTable = sortH2HTable;
window.showH2HSubTab = showH2HSubTab;
window.searchH2HTable = searchH2HTable;
window.updateFaceToFace = updateFaceToFace;
