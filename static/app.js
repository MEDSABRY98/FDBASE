// ============================================================================
// FOOTBALL DATA ENTRY APPLICATION - MAIN JAVASCRIPT FILE
// ============================================================================

// ----------------------------------------------------------------------------
// Lightweight persistent cache for Data Entry dropdowns (players/teams/etc.)
// Persists to localStorage with 6h TTL and shares data across Match/Lineup tabs
// Namespace isolated from other pages: prefix "de:"
// ----------------------------------------------------------------------------
(function initDataEntryCache() {
	const SIX_HOURS = 6 * 60 * 60 * 1000;
	const NS = 'de:';
	const VERSION = 'v1';
	const mem = new Map(); // key -> { data, ts, ttl }

	function buildKey(key) { return `${NS}${VERSION}:${key}`; }

	function setCached(key, data, ttl = SIX_HOURS) {
		const ts = Date.now();
		mem.set(key, { data, ts, ttl });
		try {
			const payload = { meta: { key, ts, ttl, v: VERSION }, data };
			localStorage.setItem(buildKey(key), JSON.stringify(payload));
		} catch (e) {
			// If quota exceeded, evict oldest de:* entry and retry once
			try {
				let oldest = { k: null, t: Infinity };
				for (let i = 0; i < localStorage.length; i++) {
					const k = localStorage.key(i);
					if (!k || !k.startsWith(NS)) continue;
					try {
						const obj = JSON.parse(localStorage.getItem(k));
						const t = obj && obj.meta ? obj.meta.ts : null;
						if (t && t < oldest.t) oldest = { k, t };
					} catch(_){}
				}
				if (oldest.k) localStorage.removeItem(oldest.k);
				localStorage.setItem(buildKey(key), JSON.stringify({ meta: { key, ts, ttl, v: VERSION }, data }));
			} catch(_){}
		}
	}

	function getCached(key, ttl = SIX_HOURS) {
		const inMem = mem.get(key);
		const now = Date.now();
		if (inMem && (now - inMem.ts) < Math.min(inMem.ttl || ttl, ttl)) {
			return inMem.data;
		}
		try {
			const raw = localStorage.getItem(buildKey(key));
			if (!raw) return null;
			const payload = JSON.parse(raw);
			const ts = payload && payload.meta ? payload.meta.ts : 0;
			const storedTtl = payload && payload.meta ? payload.meta.ttl : ttl;
			if (!ts || (now - ts) >= Math.min(storedTtl || ttl, ttl)) {
				localStorage.removeItem(buildKey(key));
				return null;
			}
			mem.set(key, { data: payload.data, ts, ttl: storedTtl });
			return payload.data;
		} catch(_) {
			try { localStorage.removeItem(buildKey(key)); } catch(_){}
			return null;
		}
	}

	async function getOrFetch(key, fetcher, ttl = SIX_HOURS) {
		const cached = getCached(key, ttl);
		if (cached !== null && cached !== undefined) return cached;
		const data = await fetcher();
		setCached(key, data, ttl);
		return data;
	}

	function clearDataEntryCache() {
		mem.clear();
		try {
			const toRemove = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k && k.startsWith(NS)) toRemove.push(k);
			}
			toRemove.forEach(k => localStorage.removeItem(k));
		} catch(_){}
	}

	// expose helpers
	window.__deCache = { getCached, setCached, getOrFetch, clear: clearDataEntryCache, SIX_HOURS };
})();

// ============================================================================
// SECTION 1: GENERAL FUNCTIONS (SHARED ACROSS ALL TABS)
// ============================================================================

// Tab switching functionality
function switchTab(element, tabId) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab
    element.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// Form management functions
function saveCurrentForm() {
    // Find the form in the current page
    const form = document.querySelector('form');
    if (form) {
        const dataType = form.querySelector('input[name="data_type"]').value;
        
        // Show loading spinner
        showSaveSpinner();
        
        // For AHLY PKs, use API call
        if (dataType === 'ahly_pks') {
            savePKSData();
        } else {
            // For other forms, submit normally
            form.submit();
        }
    }
}

function showSaveSpinner() {
    const saveBtn = document.getElementById('save-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    
    if (saveBtn && saveBtnText) {
        // Disable button
        saveBtn.disabled = true;
        
        // Create spinner
        const spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        spinner.id = 'save-spinner';
        
        // Insert spinner before text
        saveBtn.insertBefore(spinner, saveBtnText);
        
        // Update text
        saveBtnText.textContent = 'جاري الحفظ...';
    }
}

function hideSaveSpinner() {
    const saveBtn = document.getElementById('save-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const spinner = document.getElementById('save-spinner');
    
    if (saveBtn && saveBtnText) {
        // Enable button
        saveBtn.disabled = false;
        
        // Remove spinner
        if (spinner) {
            spinner.remove();
        }
        
        // Reset text
        saveBtnText.textContent = 'Save to Google Sheets';
    }
}

async function savePKSData() {
    const form = document.querySelector('form');
    if (!form) {
        showFlashMessage('No form found', 'error');
        hideSaveSpinner();
        return;
    }
    
    const formData = new FormData(form);
    const data = {};
    
    // Convert FormData to object
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    try {
        const response = await fetch('/api/save_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        // Hide spinner
        hideSaveSpinner();
        
        if (result.success) {
            showFlashMessage(result.message || 'تم الحفظ بنجاح', 'success');
        } else {
            showFlashMessage(result.message || 'حدث خطأ في الحفظ', 'error');
        }
    } catch (error) {
        console.error('Error saving data:', error);
        hideSaveSpinner();
        showFlashMessage('خطأ في الاتصال: ' + error.message, 'error');
    }
}

function resetCurrentForm() {
    const form = document.querySelector('form');
    if (form) {
        form.reset();
        showFlashMessage('تم إعادة تعيين النموذج بنجاح', 'success');
    }
}

function exportCurrentData() {
    // Find the form in the current page
    const form = document.querySelector('form');
    if (form) {
        const dataType = form.querySelector('input[name="data_type"]').value;
        
        // For lineup forms, collect all player data
        if (dataType === 'ahly_lineup' || dataType === 'egypt_lineup') {
            exportLineupData(dataType);
        } else if (dataType === 'ahly_pks') {
            createPKSExcelFromData();
        } else if (dataType === 'ahly_match' || dataType === 'egypt_match') {
            // For AHLY MATCH and EGYPT MATCH, submit form data to export_form route
            form.action = `/export_form/${dataType}`;
            form.method = 'POST';
            form.submit();
        } else {
            // For other forms, use the simple export method
            window.location.href = `/export/${dataType}`;
        }
    } else {
        console.error('No form found on current page');
    }
}

function exportFormData(dataType) {
    const form = document.querySelector('form');
    const formData = new FormData(form);
    
    // Collect all form data
    const formObject = {};
    for (let [key, value] of formData.entries()) {
        formObject[key] = value;
    }
    
    // Create Excel file with current form data
    createExcelFromFormData(dataType, formObject);
}

function exportLineupData(dataType) {
    const form = document.querySelector('form');
    const formData = new FormData(form);
    
    // Get basic match info
    const matchDate = formData.get('match_date') || '';
    const matchId = formData.get('match_id') || '';
    
    // Collect all player data
    const players = [];
    const playerRows = document.querySelectorAll('.player-row');
    
    playerRows.forEach(row => {
        const playerData = {};
        const inputs = row.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            if (input.name && input.name !== '') {
                playerData[input.name] = input.value;
            }
        });
        
        if (Object.keys(playerData).length > 0) {
            players.push(playerData);
        }
    });
    
    // Create Excel file with player data
    createExcelFromData(dataType, players, matchDate, matchId);
}

// ============================================================================
// SECTION 2: MIN TOTAL CALCULATION (SHARED FOR LINEUP TABS)
// ============================================================================

function calculateMinTotalForRow(row) {
    try {
        const minMatInput = row.querySelector('input[name*="_minmat"]');
        const minOutInput = row.querySelector('input[name*="_minout"]');
        const minTotalInput = row.querySelector('input[name*="_mintotal"]');
        
        if (!minMatInput || !minOutInput || !minTotalInput) {
            return;
        }
        
        // Handle 45+1, 90+3 etc. by taking only the base number
        // Special case: if it's 90+ (without number after +), use 1
        const minMatValue = minMatInput.value.toString();
        const minOutValue = minOutInput.value.toString();
        
        let minMat = 0;
        let minOut = 0;
        
        // Process minMat - for starter players: use base number (90+5 = 90)
        if (minMatValue.includes('+')) {
            const parts = minMatValue.split('+');
            const baseNum = parseInt(parts[0]) || 0;
            minMat = baseNum; // 90+5 = 90, 45+3 = 45
        } else {
            // Case: 90 (normal number without +)
            minMat = parseInt(minMatValue) || 0;
        }
        
        // Process minOut - will be calculated differently based on player status
        if (minOutValue.includes('+')) {
            const parts = minOutValue.split('+');
            const baseNum = parseInt(parts[0]) || 0;
            const extraTime = parseInt(parts[1]) || 0;
            minOut = { baseNum, extraTime }; // Store both values for later use
        } else {
            // Case: 90 (normal number without +)
            minOut = { baseNum: parseInt(minOutValue) || 0, extraTime: 0 };
        }
        
        const statusSelect = row.querySelector('select[name*="_status"]');
        const playerOutInput = row.querySelector('input[name*="_playerout"]');
        
        if (!statusSelect || !playerOutInput) {
            return;
        }
        
        const status = statusSelect.value;
        const playerOut = playerOutInput.value.trim();
        const playerName = row.querySelector('input[name*="_name"]').value.trim();
    
        let total = 0;
        
        if (status === 'اساسي') {
            // للاعب الأساسي: إذا كان له Player Out في أي مكان، احسب من Min Out
            const allPlayerOuts = document.querySelectorAll('input[name*="_playerout"]');
            let playerOutMin = 0;
            
            // البحث عن اسم اللاعب في أي Player Out
            allPlayerOuts.forEach(input => {
                if (input.value && input.value.trim() !== '' && input.value.trim() === playerName) {
                    // العثور على Min Out في نفس الصف
                    const playerOutRow = input.closest('.player-row');
                    const minOutInRow = playerOutRow.querySelector('input[name*="_minout"]');
                    if (minOutInRow && minOutInRow.value) {
                        const minOutValue = minOutInRow.value.toString();
                        if (minOutValue.includes('+')) {
                            const parts = minOutValue.split('+');
                            const baseNum = parseInt(parts[0]) || 0;
                            // للاعب الأساسي: خذ الرقم الأساسي فقط (90+5 = 90)
                            playerOutMin = baseNum;
                        } else {
                            playerOutMin = parseInt(minOutValue) || 0; // 90 = 90
                        }
                    }
                }
            });
            
            if (playerOutMin > 0) {
                // إذا ذكر اسمه في Player Out، خذ Min Out من نفس الصف
                total = playerOutMin;
            } else {
                // إذا لم يذكر اسمه في أي Player Out، خذ Min Mat
                total = minMat;
            }
        } else if (status === 'احتياطي') {
            // أولاً: شوف لو اسم اللاعب الاحتياطي موجود في Player Out (يعني نزل ولعب وخرج بعد كده)
            const allPlayerOuts = document.querySelectorAll('input[name*="_playerout"]');
            let playerExitMin = 0;
            
            allPlayerOuts.forEach(input => {
                const playerOutValue = input.value ? input.value.trim() : '';
                
                if (playerOutValue !== '' && playerOutValue === playerName) {
                    // اللاعب الاحتياطي اسمه موجود في Player Out (خرج)
                    const playerOutRow = input.closest('.player-row');
                    const minOutInRow = playerOutRow.querySelector('input[name*="_minout"]');
                    if (minOutInRow && minOutInRow.value) {
                        const minOutValue = minOutInRow.value.toString();
                        if (minOutValue.includes('+')) {
                            const parts = minOutValue.split('+');
                            playerExitMin = parseInt(parts[0]) || 0; // خذ الرقم الأساسي فقط
                        } else {
                            playerExitMin = parseInt(minOutValue) || 0;
                        }
                    }
                }
            });
            
            if (playerExitMin > 0) {
                // اللاعب الاحتياطي خرج → احسب: دقيقة_الخروج - دقيقة_النزول
                const entryMin = minOut.baseNum; // دقيقة النزول من Min Out الخاص به
                total = playerExitMin - entryMin;
                
                // التأكد من أن النتيجة لا تكون سالبة
                if (total < 0) {
                    total = 0;
                }
            } else {
                // اللاعب الاحتياطي لعب للنهاية (مش خارج)
                // Min Total = MinMat - MinOut
                if (minOutValue.includes('+')) {
                    const parts = minOutValue.split('+');
                    const baseNum = parseInt(parts[0]) || 0;
                    const extraTime = parseInt(parts[1]) || 0;
                    if (baseNum === 90) {
                        if (minMat === 90) {
                            total = 1; // 90+5 = 1 (فقط إذا كان MinMat = 90)
                        } else {
                            // إذا كان MinMat ≠ 90، احسب MinMat - 90
                            total = minMat - 90; // 120 - 90 = 30
                            
                            // التأكد من أن النتيجة لا تكون سالبة
                            if (total < 0) {
                                total = 0;
                            }
                        }
                    } else if (baseNum === 45) {
                        // استثناء للرقم 45: احسب MinMat - 45
                        total = minMat - 45; // 90 - 45 = 45
                        
                        // التأكد من أن النتيجة لا تكون سالبة
                        if (total < 0) {
                            total = 0;
                        }
                    } else {
                        total = extraTime; // 60+3 = 3
                    }
                } else {
                    // إذا لم يكن هناك +، احسب MinMat - MinOut
                    const minOutNum = parseInt(minOutValue) || 0;
                    total = minMat - minOutNum; // 90 - 55 = 35
                    
                    // التأكد من أن النتيجة لا تكون سالبة
                    if (total < 0) {
                        total = 0;
                    }
                }
            }
        }
        
        minTotalInput.value = total;
        const actualMinOutValue = status === 'احتياطي' ? 
            (minOutValue.includes('+') ? parseInt(minOutValue.split('+')[1]) || 0 : parseInt(minOutValue) || 0) :
            (minOutValue.includes('+') ? parseInt(minOutValue.split('+')[0]) || 0 : parseInt(minOutValue) || 0);
        console.log(`Player: ${playerName}, Status: ${status}, MinMat: ${minMat}, MinOut: ${actualMinOutValue}, MinTotal: ${total}`);
    } catch (error) {
        console.error('Error in calculateMinTotalForRow:', error);
    }
}

function updateAllMinTotals() {
    // Update all Ahly players
    const allAhlyRows = document.querySelectorAll('#players-container .player-row');
    allAhlyRows.forEach(row => {
        calculateMinTotalForRow(row);
    });
    
    // Update all Egypt players
    const allEgyptRows = document.querySelectorAll('#egypt-players-container .player-row');
    allEgyptRows.forEach(row => {
        calculateMinTotalForRow(row);
    });
}

// ============================================================================
// SECTION 3: AHLY LINEUP FUNCTIONS
// ============================================================================

let playerCount = 0;
let playersList = []; // Store players list from API

function addPlayerRow() {
    if (playerCount >= 16) {
        // Maximum 16 players allowed
        return;
    }

    const container = document.getElementById('players-container');
    if (!container) {
        return;
    }
    
    const playerRow = document.createElement('div');
    playerRow.className = 'player-row';
    playerRow.innerHTML = `
        <div>
            <input type="text" name="player_${playerCount}_minmat" id="player_${playerCount}_minmat" placeholder="MINMAT (e.g. 45+1)" class="minmat-input" data-player-index="${playerCount}">
        </div>
        <div>
            <div class="searchable-select-container">
                <input type="text" name="player_${playerCount}_name" id="player_${playerCount}_name" class="player-name-input" placeholder="Search player..." autocomplete="off" data-player-index="${playerCount}">
                <div class="dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div>
            <select name="player_${playerCount}_status" id="player_${playerCount}_status" class="status-select" data-player-index="${playerCount}">
                <option value="">Status</option>
                <option value="اساسي" ${playerCount < 11 ? 'selected' : ''}>اساسي</option>
                <option value="احتياطي" ${playerCount >= 11 ? 'selected' : ''}>احتياطي</option>
            </select>
        </div>
        <div>
            <div class="searchable-select-container">
                <input type="text" name="player_${playerCount}_playerout" id="player_${playerCount}_playerout" placeholder="Player Out" class="playerout-input" autocomplete="off" data-player-index="${playerCount}">
                <div class="playerout-dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div>
            <input type="text" name="player_${playerCount}_minout" id="player_${playerCount}_minout" placeholder="MINOUT (e.g. 45+1)" class="minout-input" data-player-index="${playerCount}">
        </div>
        <div>
            <input type="text" name="player_${playerCount}_mintotal" id="player_${playerCount}_mintotal" placeholder="MINTOTAL" class="mintotal-input" readonly data-player-index="${playerCount}">
        </div>
        <div>
            <button type="button" class="remove-player-btn" onclick="removePlayerRow(${playerCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(playerRow);
    playerCount++;
    
    // Add event listeners to the new row
    addEventListenersToRow(playerRow);
    
    // Setup player search functionality
    const playerInput = playerRow.querySelector('.player-name-input');
    const playerDropdown = playerRow.querySelector('.dropdown-options');
    
    if (playerInput && playerDropdown) {
        setupPlayerSearch(playerInput, playerDropdown);
    }
    
    // Setup Player Out dropdown
    const playerOutInput = playerRow.querySelector('.playerout-input');
    const playerOutDropdown = playerRow.querySelector('.playerout-dropdown-options');
    
    if (playerOutInput && playerOutDropdown) {
        setupPlayerOutDropdown(playerOutInput, playerOutDropdown);
    }
}

function removePlayerRow(index) {
    const row = document.querySelector(`[data-player-index="${index}"]`).closest('.player-row');
    if (row) {
        row.remove();
    }
}

function addEventListenersToRow(row) {
    const minMatInput = row.querySelector('.minmat-input');
    const minOutInput = row.querySelector('.minout-input');
    const statusSelect = row.querySelector('.status-select');
    const playerOutInput = row.querySelector('.playerout-input');
    const playerNameInput = row.querySelector('.player-name-input');
    const minTotalInput = row.querySelector('.mintotal-input');
    
    // Add event listeners for automatic calculation
    [minMatInput, statusSelect].forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                calculateMinTotalForRow(row);
            });
        }
    });
    
    // Special listener for Min Out - updates all rows (affects other players)
    if (minOutInput) {
        minOutInput.addEventListener('input', () => {
            // Update all rows because Min Out change affects:
            // 1. Current substitute player
            // 2. Starter player who was substituted
            updateAllPlayerTotals();
        });
    }
    
    // Special listener for Player Out - updates all rows
    if (playerOutInput) {
        playerOutInput.addEventListener('input', () => {
            // Update all rows (to handle substitutions)
            updateAllPlayerTotals();
        });
    }
    
    // When player name is entered, auto-fill Min Total with Min Mat value
    if (playerNameInput && minTotalInput && minMatInput) {
        playerNameInput.addEventListener('input', () => {
            const playerName = playerNameInput.value.trim();
            const minMatValue = minMatInput.value.trim();
            
            // If player name is entered and Min Mat has a value, copy it to Min Total
            if (playerName && minMatValue) {
                minTotalInput.value = minMatValue;
            }
            
            // Update all rows in case this player is mentioned in any Player Out field
            updateAllPlayerTotals();
        });
    }
    
    // Add special listener for MIN MAT to copy to all rows and update Min Total
    if (minMatInput) {
        minMatInput.addEventListener('input', (e) => {
            const value = e.target.value;
            // Copy the value to all MIN MAT fields in all rows
            const allMinMatInputs = document.querySelectorAll('#players-container .minmat-input');
            allMinMatInputs.forEach(input => {
                if (input !== e.target) { // Don't update the current input
                    input.value = value;
                }
            });
            
            // If player name is entered in current row, also update Min Total
            const playerName = playerNameInput.value.trim();
            if (playerName && value) {
                minTotalInput.value = value;
            }
        });
    }
}

// Helper function to update all Ahly player totals
function updateAllPlayerTotals() {
    const allRows = document.querySelectorAll('#players-container .player-row');
    allRows.forEach(row => {
        calculateMinTotalForRow(row);
    });
}

// Get first 11 starter players names
function getStarterPlayersNames() {
    const starterNames = [];
    const allRows = document.querySelectorAll('#players-container .player-row');
    
    // Get first 11 rows (starters)
    for (let i = 0; i < Math.min(11, allRows.length); i++) {
        const row = allRows[i];
        const playerNameInput = row.querySelector('.player-name-input');
        if (playerNameInput && playerNameInput.value.trim()) {
            starterNames.push(playerNameInput.value.trim());
        }
    }
    
    return starterNames;
}

// Setup Player Out dropdown with starter players
function setupPlayerOutDropdown(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const starterPlayers = getStarterPlayersNames();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter starter players based on search term
        const filteredPlayers = starterPlayers.filter(player => 
            player.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredPlayers.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered players to dropdown
        filteredPlayers.forEach(player => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = player;
            option.addEventListener('click', function() {
                input.value = player;
                dropdown.style.display = 'none';
                
                // Trigger update for all players
                updateAllPlayerTotals();
            });
            dropdown.appendChild(option);
        });
    });
    
    // Show all starter players on focus
    input.addEventListener('focus', function() {
        const starterPlayers = getStarterPlayersNames();
        
        if (starterPlayers.length === 0) {
            return;
        }
        
        dropdown.innerHTML = '';
        dropdown.style.display = 'block';
        
        starterPlayers.forEach(player => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = player;
            option.addEventListener('click', function() {
                input.value = player;
                dropdown.style.display = 'none';
                
                // Trigger update for all players
                updateAllPlayerTotals();
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function clearAllPlayers() {
    // Clear all form data but keep the 16 rows
    for (let i = 0; i < playerCount; i++) {
        const minmatInput = document.getElementById(`player_${i}_minmat`);
        const nameInput = document.getElementById(`player_${i}_name`);
        const statusSelect = document.getElementById(`player_${i}_status`);
        const playeroutInput = document.getElementById(`player_${i}_playerout`);
        const minoutInput = document.getElementById(`player_${i}_minout`);
        const mintotalInput = document.getElementById(`player_${i}_mintotal`);
        
        if (minmatInput) minmatInput.value = '';
        if (nameInput) nameInput.value = '';
        if (statusSelect) statusSelect.value = '';
        if (playeroutInput) playeroutInput.value = '';
        if (minoutInput) minoutInput.value = '';
        if (mintotalInput) mintotalInput.value = '';
    }
}

async function loadPlayersList() {
    try {
        const data = await window.__deCache.getOrFetch('players', async () => {
            const resp = await fetch('/api/players');
            return await resp.json();
        }, window.__deCache.SIX_HOURS);
        if (data.players && Array.isArray(data.players)) {
            playersList = data.players;
            console.log('Loaded players (cached):', playersList.length);
        } else {
            console.error('Failed to load players:', data.error);
        }
    } catch (error) {
        console.error('Error loading players:', error);
    }
}


function initializePlayers() {
    // Reset player count
    playerCount = 0;
    
    // Clear existing rows
    const container = document.getElementById('players-container');
    if (container) {
        container.innerHTML = '';
        
        // Add 16 empty player rows
        for (let i = 0; i < 16; i++) {
            addPlayerRow();
        }
        
        // Setup search functionality for all player inputs
        setTimeout(() => {
            const playerInputs = container.querySelectorAll('.player-name-input');
            playerInputs.forEach(input => {
                const dropdown = input.parentElement.querySelector('.dropdown-options');
                if (dropdown) {
                    setupPlayerSearch(input, dropdown);
                }
            });
            
            // Load players list
            loadPlayersList();
        }, 100);
    }
}

// ============================================================================
// SECTION 4: EGYPT LINEUP FUNCTIONS
// ============================================================================

let egyptPlayerCount = 0;
let egyptPlayersList = []; // Store players list from API for Egypt

function addEgyptPlayerRow() {
    if (egyptPlayerCount >= 16) {
        // Maximum 16 players allowed
        return;
    }

    const container = document.getElementById('egypt-players-container');
    const playerRow = document.createElement('div');
    playerRow.className = 'player-row';
    playerRow.innerHTML = `
        <div class="form-group">
            <input type="text" name="player_${egyptPlayerCount}_minmat" id="egypt_player_${egyptPlayerCount}_minmat" placeholder="Min (e.g. 45+1)" data-player-index="${egyptPlayerCount}">
        </div>
        <div class="form-group">
            <div class="searchable-select-container">
                <input type="text" name="player_${egyptPlayerCount}_name" id="egypt_player_${egyptPlayerCount}_name" class="egypt-player-name-input" placeholder="Search player..." autocomplete="off" data-player-index="${egyptPlayerCount}">
                <div class="dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div class="form-group">
            <select name="player_${egyptPlayerCount}_status" id="egypt_player_${egyptPlayerCount}_status" data-player-index="${egyptPlayerCount}">
                <option value="">Status</option>
                <option value="اساسي" ${egyptPlayerCount < 11 ? 'selected' : ''}>اساسي</option>
                <option value="احتياطي" ${egyptPlayerCount >= 11 ? 'selected' : ''}>احتياطي</option>
            </select>
        </div>
        <div class="form-group">
            <div class="searchable-select-container">
                <input type="text" name="player_${egyptPlayerCount}_playerout" id="egypt_player_${egyptPlayerCount}_playerout" placeholder="Player Out" autocomplete="off" data-player-index="${egyptPlayerCount}">
                <div class="playerout-dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div class="form-group">
            <input type="text" name="player_${egyptPlayerCount}_minout" id="egypt_player_${egyptPlayerCount}_minout" placeholder="Min Out (e.g. 45+1)" data-player-index="${egyptPlayerCount}">
        </div>
        <div class="form-group">
            <input type="text" name="player_${egyptPlayerCount}_mintotal" id="egypt_player_${egyptPlayerCount}_mintotal" placeholder="Min Total" readonly data-player-index="${egyptPlayerCount}">
        </div>
        <div class="form-group">
            <button type="button" class="remove-player-btn" onclick="removeEgyptPlayerRow(${egyptPlayerCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(playerRow);
    egyptPlayerCount++;
    
    // Add event listeners to the new row
    addEventListenersToEgyptRow(playerRow);
    
    // Setup player search functionality
    const playerInput = playerRow.querySelector('.egypt-player-name-input');
    const playerDropdown = playerRow.querySelector('.dropdown-options');
    
    if (playerInput && playerDropdown) {
        setupEgyptPlayerSearch(playerInput, playerDropdown);
    }
    
    // Setup Player Out dropdown
    const playerOutInput = playerRow.querySelector('input[name*="_playerout"]');
    const playerOutDropdown = playerRow.querySelector('.playerout-dropdown-options');
    
    if (playerOutInput && playerOutDropdown) {
        setupEgyptPlayerOutDropdown(playerOutInput, playerOutDropdown);
    }
}

function removeEgyptPlayerRow(index) {
    const row = document.querySelector(`[data-player-index="${index}"]`).closest('.player-row');
    if (row) {
        row.remove();
    }
}

function addEventListenersToEgyptRow(row) {
    const minMatInput = row.querySelector('input[name*="_minmat"]');
    const minOutInput = row.querySelector('input[name*="_minout"]');
    const statusSelect = row.querySelector('select[name*="_status"]');
    const playerOutInput = row.querySelector('input[name*="_playerout"]');
    const playerNameInput = row.querySelector('.egypt-player-name-input');
    const minTotalInput = row.querySelector('input[name*="_mintotal"]');
    
    // Add event listeners for automatic calculation
    [minMatInput, statusSelect].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                calculateMinTotalForRow(row);
            });
        }
    });
    
    // Special listener for Min Out - updates all rows (affects other players)
    if (minOutInput) {
        minOutInput.addEventListener('input', () => {
            // Update all rows because Min Out change affects:
            // 1. Current substitute player
            // 2. Starter player who was substituted
            updateAllEgyptPlayerTotals();
        });
    }
    
    // Special listener for Player Out - updates both current row AND the player being substituted
    if (playerOutInput) {
        playerOutInput.addEventListener('input', () => {
            // Update all rows (to handle substitutions)
            updateAllEgyptPlayerTotals();
        });
    }
    
    // When player name is entered, auto-fill Min Total with Min Mat value
    if (playerNameInput && minTotalInput && minMatInput) {
        playerNameInput.addEventListener('input', () => {
            const playerName = playerNameInput.value.trim();
            const minMatValue = minMatInput.value.trim();
            
            // If player name is entered and Min Mat has a value, copy it to Min Total
            if (playerName && minMatValue) {
                minTotalInput.value = minMatValue;
            }
            
            // Update all rows in case this player is mentioned in any Player Out field
            updateAllEgyptPlayerTotals();
        });
    }
    
    // Add special listener for MIN MAT to copy to all rows and update Min Total
    if (minMatInput) {
        minMatInput.addEventListener('input', (e) => {
            const value = e.target.value;
            // Copy the value to all MIN MAT fields in all Egypt rows
            const allMinMatInputs = document.querySelectorAll('#egypt-players-container input[name*="_minmat"]');
            allMinMatInputs.forEach(input => {
                if (input !== e.target) { // Don't update the current input
                    input.value = value;
                }
            });
            
            // If player name is entered in current row, also update Min Total
            const playerName = playerNameInput.value.trim();
            if (playerName && value) {
                minTotalInput.value = value;
            }
        });
    }
}

// Helper function to update all Egypt player totals
function updateAllEgyptPlayerTotals() {
    const allRows = document.querySelectorAll('#egypt-players-container .player-row');
    allRows.forEach(row => {
        calculateMinTotalForRow(row);
    });
}

// Get first 11 Egypt starter players names
function getEgyptStarterPlayersNames() {
    const starterNames = [];
    const allRows = document.querySelectorAll('#egypt-players-container .player-row');
    
    // Get first 11 rows (starters)
    for (let i = 0; i < Math.min(11, allRows.length); i++) {
        const row = allRows[i];
        const playerNameInput = row.querySelector('.egypt-player-name-input');
        if (playerNameInput && playerNameInput.value.trim()) {
            starterNames.push(playerNameInput.value.trim());
        }
    }
    
    return starterNames;
}

// Setup Egypt Player Out dropdown with starter players
function setupEgyptPlayerOutDropdown(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const starterPlayers = getEgyptStarterPlayersNames();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter starter players based on search term
        const filteredPlayers = starterPlayers.filter(player => 
            player.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredPlayers.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered players to dropdown
        filteredPlayers.forEach(player => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = player;
            option.addEventListener('click', function() {
                input.value = player;
                dropdown.style.display = 'none';
                
                // Trigger update for all players
                updateAllEgyptPlayerTotals();
            });
            dropdown.appendChild(option);
        });
    });
    
    // Show all starter players on focus
    input.addEventListener('focus', function() {
        const starterPlayers = getEgyptStarterPlayersNames();
        
        if (starterPlayers.length === 0) {
            return;
        }
        
        dropdown.innerHTML = '';
        dropdown.style.display = 'block';
        
        starterPlayers.forEach(player => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = player;
            option.addEventListener('click', function() {
                input.value = player;
                dropdown.style.display = 'none';
                
                // Trigger update for all players
                updateAllEgyptPlayerTotals();
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function clearAllEgyptPlayers() {
    const container = document.getElementById('egypt-players-container');
    container.innerHTML = '';
    egyptPlayerCount = 0;
}

function setupEgyptPlayerSearch(input, dropdown) {
    // Fetch players list if not already loaded
    if (egyptPlayersList.length === 0) {
        fetch('/api/egypt-players')
            .then(response => response.json())
            .then(data => {
                egyptPlayersList = data.players || [];
            })
            .catch(error => {
                console.error('Error fetching Egypt players:', error);
            });
    }
    
    // Show dropdown on focus
    input.addEventListener('focus', function() {
        if (egyptPlayersList.length > 0) {
            showEgyptPlayerDropdown(input, dropdown, egyptPlayersList);
        }
    });
    
    // Filter players as user types
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm === '') {
            showEgyptPlayerDropdown(input, dropdown, egyptPlayersList);
        } else {
            const filteredPlayers = egyptPlayersList.filter(player => 
                player.toLowerCase().includes(searchTerm)
            );
            showEgyptPlayerDropdown(input, dropdown, filteredPlayers);
        }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function showEgyptPlayerDropdown(input, dropdown, players) {
    dropdown.innerHTML = '';
    
    if (players.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-option">No players found</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    // Limit to 10 results for performance
    const limitedPlayers = players.slice(0, 10);
    
    limitedPlayers.forEach(player => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = player;
        option.addEventListener('click', function() {
            input.value = player;
            dropdown.style.display = 'none';
            
            // Auto-fill Min Total with Min Mat value when player is selected
            const row = input.closest('.player-row');
            if (row) {
                const minMatInput = row.querySelector('input[name*="_minmat"]');
                const minTotalInput = row.querySelector('input[name*="_mintotal"]');
                
                if (minMatInput && minTotalInput && minMatInput.value.trim()) {
                    minTotalInput.value = minMatInput.value;
                }
            }
        });
        dropdown.appendChild(option);
    });
    
    dropdown.style.display = 'block';
}

function initializeEgyptPlayers() {
    // Reset player count first
    egyptPlayerCount = 0;
    
    // Fetch players list first
    fetch('/api/egypt-players')
        .then(response => response.json())
        .then(data => {
            egyptPlayersList = data.players || [];
        })
        .catch(error => {
            console.error('Error fetching Egypt players:', error);
        });
    
    // Add 16 empty player rows on page load
    for (let i = 0; i < 16; i++) {
        addEgyptPlayerRow();
    }
}

// ============================================================================
// SECTION 5: AHLY PKS FUNCTIONS
// ============================================================================

let ahlyPlayerCount = 0;
let opponentPlayerCount = 0;

function addAhlyPlayerRow() {
    if (ahlyPlayerCount >= 11) {
        // Maximum 11 players allowed for Ahly
        return;
    }

    const container = document.getElementById('ahly-players-container');
    const playerRow = document.createElement('div');
    playerRow.className = 'pks-player-row';
    playerRow.innerHTML = `
        <div class="form-group">
            <input type="text" name="ahly_${ahlyPlayerCount}_player_name" placeholder="Ahly player name" required>
        </div>
        <div class="form-group">
            <select name="ahly_${ahlyPlayerCount}_eleven_backup" required>
                <option value="">Status</option>
                <option value="GOAL">GOAL</option>
                <option value="MISS">MISS</option>
            </select>
        </div>
        <div class="form-group">
            <input type="text" name="ahly_${ahlyPlayerCount}_howmiss" placeholder="How Miss">
        </div>
        <div class="form-group">
            <button type="button" class="remove-player-btn" onclick="removeAhlyPlayerRow(${ahlyPlayerCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(playerRow);
    ahlyPlayerCount++;
}

function removeAhlyPlayerRow(index) {
    const rows = document.querySelectorAll('.pks-player-row');
    if (rows[index]) {
        rows[index].remove();
        ahlyPlayerCount--;
    }
}

function addOpponentPlayerRow() {
    if (opponentPlayerCount >= 11) {
        // Maximum 11 players allowed for Opponent
        return;
    }

    const container = document.getElementById('opponent-players-container');
    const playerRow = document.createElement('div');
    playerRow.className = 'pks-player-row';
    playerRow.innerHTML = `
        <div class="form-group">
            <input type="text" name="opponent_${opponentPlayerCount}_player_name" placeholder="Opponent player name" required>
        </div>
        <div class="form-group">
            <select name="opponent_${opponentPlayerCount}_eleven_backup" required>
                <option value="">Status</option>
                <option value="GOAL">GOAL</option>
                <option value="MISS">MISS</option>
            </select>
        </div>
        <div class="form-group">
            <input type="text" name="opponent_${opponentPlayerCount}_howmiss" placeholder="How Miss">
        </div>
        <div class="form-group">
            <button type="button" class="remove-player-btn" onclick="removeOpponentPlayerRow(${opponentPlayerCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(playerRow);
    opponentPlayerCount++;
}

function removeOpponentPlayerRow(index) {
    const rows = document.querySelectorAll('#opponent-players-container .pks-player-row');
    if (rows[index]) {
        rows[index].remove();
        opponentPlayerCount--;
    }
}

function clearAllAhlyPlayers() {
    const container = document.getElementById('ahly-players-container');
    container.innerHTML = '';
    ahlyPlayerCount = 0;
}

function clearAllOpponentPlayers() {
    const container = document.getElementById('opponent-players-container');
    container.innerHTML = '';
    opponentPlayerCount = 0;
}

// ============================================================================
// SECTION 6: AHLY MATCH FUNCTIONS (Goals & Assists + GKS)
// ============================================================================

// Goals & Assists Functions
let goalsAssistsCount = 0;

function addGoalsAssistsEntry() {
    const container = document.getElementById('goals-assists-container');
    const row = document.createElement('div');
    row.className = 'goals-assists-row';
    row.id = `goals-assists-row-${goalsAssistsCount}`;
    
    // Get team names from form fields
    const ahlyTeam = document.getElementById('ahly_team')?.value || 'الأهلي';
    const opponentTeam = document.getElementById('opponent_team')?.value || '';
    
    row.innerHTML = `
        <div class="form-group">
            <div class="searchable-select-container">
                <input type="text" name="goals_assists_${goalsAssistsCount}_player_name" class="player-name-input" placeholder="Search player..." autocomplete="off">
                <div class="dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div class="form-group">
            <select name="goals_assists_${goalsAssistsCount}_team" class="team-select">
                <option value="">Select Team</option>
                <option value="${ahlyTeam}">${ahlyTeam}</option>
                ${opponentTeam ? `<option value="${opponentTeam}">${opponentTeam}</option>` : ''}
            </select>
        </div>
        <div class="form-group">
            <select name="goals_assists_${goalsAssistsCount}_ga">
                <option value="">Select GA</option>
                <option value="GOAL">GOAL</option>
                <option value="ASSIST">ASSIST</option>
                <option value="PENASSISTGOAL">PENASSISTGOAL</option>
                <option value="PENASSISTMISSED">PENASSISTMISSED</option>
                <option value="PENMISSED">PENMISSED</option>
                <option value="PENMAKEGOAL">PENMAKEGOAL</option>
                <option value="PENMAKEMISSED">PENMAKEMISSED</option>
            </select>
        </div>
        <div class="form-group">
            <div class="searchable-select-container">
                <input type="text" name="goals_assists_${goalsAssistsCount}_type" class="type-name-input" placeholder="Search type..." autocomplete="off">
                <div class="dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div class="form-group">
            <input type="number" name="goals_assists_${goalsAssistsCount}_minute" placeholder="Minute" min="1" max="120">
        </div>
        <div class="form-group">
            <button type="button" class="remove-goals-assists-btn" onclick="removeGoalsAssistsEntry(${goalsAssistsCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(row);
    
    // Add search functionality to the player input
    const playerInput = row.querySelector('.player-name-input');
    const playerDropdown = row.querySelector('.player-name-input').parentElement.querySelector('.dropdown-options');
    
    if (playerInput && playerDropdown) {
        setupPlayerSearch(playerInput, playerDropdown);
    }
    
    // Add search functionality to the type input
    const typeInput = row.querySelector('.type-name-input');
    const typeDropdown = row.querySelector('.type-name-input').parentElement.querySelector('.dropdown-options');
    
    if (typeInput && typeDropdown) {
        setupTypeSearch(typeInput, typeDropdown);
    }
    
    goalsAssistsCount++;
}

function removeGoalsAssistsEntry(index) {
    const row = document.getElementById(`goals-assists-row-${index}`);
    if (row) {
        row.remove();
    }
}

function clearGoalsAssists() {
    const container = document.getElementById('goals-assists-container');
    container.innerHTML = '';
    goalsAssistsCount = 0;
}

// Global variables to store teams, types, stadiums, champions, managers, and referees lists
let teamsList = [];
let typesList = [];
let stadiumsList = [];
let championsList = [];
let managersList = [];
let refereesList = [];

// Function to load players from API
async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        const data = await response.json();
        
        if (data.players) {
            playersList = data.players;
            console.log('Players loaded:', playersList);
        } else {
            console.error('Error loading players:', data.error);
        }
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

// Function to load teams from API
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const data = await response.json();
        
        if (data.teams) {
            teamsList = data.teams;
            console.log('Teams loaded:', teamsList);
        } else {
            console.error('Error loading teams:', data.error);
        }
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

// Function to load goal types from API
async function loadTypes() {
    try {
        const response = await fetch('/api/goal-types');
        const data = await response.json();
        
        if (data.types) {
            typesList = data.types;
            console.log('Types loaded:', typesList);
        } else {
            console.error('Error loading types:', data.error);
        }
    } catch (error) {
        console.error('Error loading types:', error);
    }
}

// Function to load stadiums from API
async function loadStadiums() {
    try {
        const response = await fetch('/api/stadiums');
        const data = await response.json();
        
        if (data.stadiums) {
            stadiumsList = data.stadiums;
            console.log('Stadiums loaded:', stadiumsList);
        } else {
            console.error('Error loading stadiums:', data.error);
        }
    } catch (error) {
        console.error('Error loading stadiums:', error);
    }
}

// Function to load champions from API
async function loadChampions() {
    try {
        const response = await fetch('/api/champions');
        const data = await response.json();
        
        if (data.champions) {
            championsList = data.champions;
            console.log('Champions loaded:', championsList);
        } else {
            console.error('Error loading champions:', data.error);
        }
    } catch (error) {
        console.error('Error loading champions:', error);
    }
}

// Function to load managers from API
async function loadManagers() {
    try {
        const response = await fetch('/api/managers');
        const data = await response.json();
        
        if (data.managers) {
            managersList = data.managers;
            console.log('Managers loaded:', managersList);
        } else {
            console.error('Error loading managers:', data.error);
        }
    } catch (error) {
        console.error('Error loading managers:', error);
    }
}

// Function to load referees from API
async function loadReferees() {
    try {
        const response = await fetch('/api/referees');
        const data = await response.json();
        
        if (data.referees) {
            refereesList = data.referees;
            console.log('Referees loaded:', refereesList);
        } else {
            console.error('Error loading referees:', data.error);
        }
    } catch (error) {
        console.error('Error loading referees:', error);
    }
}

// Function to setup player search functionality
function setupPlayerSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter players based on search term
        const filteredPlayers = playersList.filter(player => 
            player.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredPlayers.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered players to dropdown
        filteredPlayers.slice(0, 8).forEach(player => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = player;
            option.addEventListener('click', function() {
                input.value = player;
                dropdown.style.display = 'none';
                
                // Auto-fill Min Total with Min Mat value when player is selected
                const row = input.closest('.player-row');
                if (row) {
                    const minMatInput = row.querySelector('.minmat-input');
                    const minTotalInput = row.querySelector('.mintotal-input');
                    
                    if (minMatInput && minTotalInput && minMatInput.value.trim()) {
                        minTotalInput.value = minMatInput.value;
                    }
                }
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}

// Function to setup team search functionality
function setupTeamSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter teams based on search term
        const filteredTeams = teamsList.filter(team => 
            team.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredTeams.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered teams to dropdown
        filteredTeams.slice(0, 8).forEach(team => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = team;
            option.addEventListener('click', function() {
                input.value = team;
                dropdown.style.display = 'none';
                // Trigger generateMatchID if it exists (for opponent_team field)
                if (typeof generateMatchID === 'function' && input.id === 'opponent_team') {
                    generateMatchID();
                }
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}

// Function to setup type search functionality
function setupTypeSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter types based on search term
        const filteredTypes = typesList.filter(type => 
            type.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredTypes.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered types to dropdown
        filteredTypes.slice(0, 8).forEach(type => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = type;
            option.addEventListener('click', function() {
                input.value = type;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}

// Function to setup stadium search functionality
function setupStadiumSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter stadiums based on search term
        const filteredStadiums = stadiumsList.filter(stadium => 
            stadium.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredStadiums.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered stadiums to dropdown
        filteredStadiums.slice(0, 8).forEach(stadium => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = stadium;
            option.addEventListener('click', function() {
                input.value = stadium;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}

// Function to setup champion search functionality
function setupChampionSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter champions based on search term
        const filteredChampions = championsList.filter(champion => 
            champion.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredChampions.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered champions to dropdown
        filteredChampions.slice(0, 8).forEach(champion => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = champion;
            option.addEventListener('click', function() {
                input.value = champion;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}

// Function to setup manager search functionality
function setupManagerSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter managers based on search term
        const filteredManagers = managersList.filter(manager => 
            manager.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredManagers.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered managers to dropdown
        filteredManagers.slice(0, 8).forEach(manager => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = manager;
            option.addEventListener('click', function() {
                input.value = manager;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}

// Function to setup referee search functionality
function setupRefereeSearch(input, dropdown) {
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter referees based on search term
        const filteredReferees = refereesList.filter(referee => 
            referee.toLowerCase().includes(searchTerm)
        );
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        if (filteredReferees.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Show dropdown
        dropdown.style.display = 'block';
        
        // Add filtered referees to dropdown
        filteredReferees.slice(0, 8).forEach(referee => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = referee;
            option.addEventListener('click', function() {
                input.value = referee;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Show dropdown when input is focused
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            dropdown.style.display = 'block';
        }
    });
}


// GKS Functions
let gksCount = 0;

function addGKSEntry() {
    const container = document.getElementById('gks-container');
    const row = document.createElement('div');
    row.className = 'gks-row';
    row.id = `gks-row-${gksCount}`;
    
    // Get team names from form fields
    const ahlyTeam = document.getElementById('ahly_team')?.value || 'الأهلي';
    const opponentTeam = document.getElementById('opponent_team')?.value || '';
    
    row.innerHTML = `
        <div class="form-group">
            <div class="searchable-select-container">
                <input type="text" name="gks_${gksCount}_player_name" class="gks-player-name-input" placeholder="Search player..." autocomplete="off">
                <div class="dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div class="form-group">
            <select name="gks_${gksCount}_eleven_backup" class="gks-eleven-backup-select">
                <option value="">Select Status</option>
                <option value="اساسي">اساسي</option>
                <option value="احتياطي">احتياطي</option>
            </select>
        </div>
        <div class="form-group">
            <input type="number" name="gks_${gksCount}_submin" placeholder="Sub min" min="0" max="120">
        </div>
        <div class="form-group">
            <select name="gks_${gksCount}_team" class="gks-team-select">
                <option value="">Select Team</option>
                <option value="${ahlyTeam}">${ahlyTeam}</option>
                ${opponentTeam ? `<option value="${opponentTeam}">${opponentTeam}</option>` : ''}
            </select>
        </div>
        <div class="form-group">
            <input type="number" name="gks_${gksCount}_goals_conceded" placeholder="Goals" min="0" max="20">
        </div>
        <div class="form-group">
            <input type="text" name="gks_${gksCount}_goal_minute" placeholder="Minute">
        </div>
        <div class="form-group">
            <button type="button" class="remove-gks-btn" onclick="removeGKSEntry(${gksCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(row);
    
    // Add search functionality to the player input
    const playerInput = row.querySelector('.gks-player-name-input');
    const playerDropdown = row.querySelector('.gks-player-name-input').parentElement.querySelector('.dropdown-options');
    
    if (playerInput && playerDropdown) {
        setupPlayerSearch(playerInput, playerDropdown);
    }
    
    // Team is now a dropdown, no need for search functionality
    
    gksCount++;
}

function removeGKSEntry(index) {
    const row = document.getElementById(`gks-row-${index}`);
    if (row) {
        row.remove();
    }
}

function clearGKS() {
    const container = document.getElementById('gks-container');
    container.innerHTML = '';
    gksCount = 0;
}

// HOWPENMISSED Functions
let howPenMissedCount = 0;

function addHowPenMissedEntry() {
    const container = document.getElementById('howpenmissed-container');
    const row = document.createElement('div');
    row.className = 'goals-assists-row';
    row.id = `howpenmissed-row-${howPenMissedCount}`;
    
    // Get team names from form fields
    const ahlyTeam = document.getElementById('ahly_team')?.value || 'الأهلي';
    const opponentTeam = document.getElementById('opponent_team')?.value || '';
    
    row.innerHTML = `
        <div class="form-group">
            <div class="searchable-select-container">
                <input type="text" name="howpenmissed_${howPenMissedCount}_player_name" class="player-name-input" placeholder="Search player..." autocomplete="off">
                <div class="dropdown-options" style="display: none;"></div>
            </div>
        </div>
        <div class="form-group">
            <select name="howpenmissed_${howPenMissedCount}_team" class="team-select">
                <option value="">Select Team</option>
                <option value="${ahlyTeam}">${ahlyTeam}</option>
                ${opponentTeam ? `<option value="${opponentTeam}">${opponentTeam}</option>` : ''}
            </select>
        </div>
        <div class="form-group">
            <input type="number" name="howpenmissed_${howPenMissedCount}_minute" placeholder="Minute" min="1" max="120">
        </div>
        <div class="form-group">
            <button type="button" class="remove-goals-assists-btn" onclick="removeHowPenMissedEntry(${howPenMissedCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(row);
    
    // Add search functionality to the player input
    const playerInput = row.querySelector('.player-name-input');
    const playerDropdown = row.querySelector('.player-name-input').parentElement.querySelector('.dropdown-options');
    
    if (playerInput && playerDropdown) {
        setupPlayerSearch(playerInput, playerDropdown);
    }
    
    howPenMissedCount++;
}

function removeHowPenMissedEntry(index) {
    const row = document.getElementById(`howpenmissed-row-${index}`);
    if (row) {
        row.remove();
    }
}

function clearHowPenMissed() {
    const container = document.getElementById('howpenmissed-container');
    container.innerHTML = '';
    howPenMissedCount = 0;
}

// ============================================================================
// SECTION 7: EXCEL UTILITIES (FROM excel-utils.js)
// ============================================================================

function createExcelFromFormData(dataType, formData) {
    // Prepare data for Excel based on data type
    let excelData = [];
    
    if (dataType === 'ahly_match') {
        excelData = [{
            'MATCH_ID': formData.match_id || '',
            'CHAMPION SYSTEM': formData.champion_system || '',
            'DATE': formData.date || '',
            'CHAMPION': formData.champion || '',
            'SEASON': formData.season || '',
            'AHLY MANAGER': formData.ahly_manager || '',
            'OPPONENT MANAGER': formData.opponent_manager || '',
            'REFREE': formData.referee || '',
            'ROUND': formData.round || '',
            'H-A-N': formData.h_a_n || '',
            'STAD': formData.stadium || '',
            'AHLY TEAM': formData.ahly_team || '',
            'GF': formData.gf || '',
            'GA': formData.ga || '',
            'ET': formData.et || '',
            'PEN': formData.pen || '',
            'OPPONENT TEAM': formData.opponent_team || '',
            'W-D-L': formData.w_d_l || '',
            'CLEAN SHEET': formData.clean_sheet || '',
            'NOTE': formData.notes || ''
        }];
    } else if (dataType === 'egypt_match') {
        excelData = [{
            'Date': formData.match_date || '',
            'Competition': formData.competition || '',
            'Opponent': formData.opponent || '',
            'Egypt Score': formData.egypt_score || '',
            'Opponent Score': formData.opponent_score || '',
            'Venue': formData.venue || '',
            'Notes': formData.notes || ''
        }];
    }
    
    // Send data to server to create Excel
    fetch('/create_excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data_type: dataType,
            data: excelData
        })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(error => {
        console.error('Error:', error);
        // Error creating Excel file
    });
}

function createExcelFromData(dataType, players, matchDate, matchId) {
    // Prepare data for Excel
    let excelData = [];
    
    if (dataType === 'ahly_lineup') {
        excelData = players.map(player => ({
            'MATCH_ID': matchId,
            'DATE': matchDate,
            'MINMAT': player[`player_${players.indexOf(player)}_minmat`] || '',
            'PLAYER': player[`player_${players.indexOf(player)}_name`] || '',
            'STATU': player[`player_${players.indexOf(player)}_status`] || '',
            'PLAYEROUT': player[`player_${players.indexOf(player)}_playerout`] || '',
            'MINOUT': player[`player_${players.indexOf(player)}_minout`] || '',
            'MINTOTAL': player[`player_${players.indexOf(player)}_mintotal`] || ''
        }));
    } else if (dataType === 'egypt_lineup') {
        excelData = players.map(player => ({
            'MATCH_ID': matchId,
            'DATE': matchDate,
            'MINMAT': player[`player_${players.indexOf(player)}_minmat`] || '',
            'PLAYER': player[`player_${players.indexOf(player)}_name`] || '',
            'STATU': player[`player_${players.indexOf(player)}_status`] || '',
            'PLAYEROUT': player[`player_${players.indexOf(player)}_playerout`] || '',
            'MINOUT': player[`player_${players.indexOf(player)}_minout`] || '',
            'MINTOTAL': player[`player_${players.indexOf(player)}_mintotal`] || ''
        }));
    }
    
    // Send data to server to create Excel
    fetch('/create_excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data_type: dataType,
            data: excelData,
            match_date: matchDate,
            match_id: matchId
        })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(error => {
        console.error('Error:', error);
        // Error creating Excel file
    });
}

function createPKSExcelFromData() {
    // Get form data
    const form = document.querySelector('form');
    const formData = new FormData(form);
    
    // Get basic match info
    const basicData = {
        'PKS System': formData.get('pks_system') || '',
        'CHAMPION System': formData.get('champion_system') || '',
        'MATCH_ID': formData.get('match_id') || '',
        'SEASON': formData.get('season') || '',
        'CHAMPION': formData.get('champion') || '',
        'ROUND': formData.get('round') || '',
        'WHO START?': formData.get('who_start') || '',
        'OPPONENT TEAM': formData.get('opponent_team') || '',
        'AHLY GK': formData.get('ahly_gk') || '',
        'OPPONENT GK': formData.get('opponent_gk') || ''
    };
    
    // Get Ahly players data
    const ahlyPlayers = [];
    const ahlyPlayerRows = document.querySelectorAll('#ahly-players-container .pks-player-row');
    ahlyPlayerRows.forEach((row, index) => {
        const playerData = {
            'PKS System': basicData['PKS System'],
            'CHAMPION System': basicData['CHAMPION System'],
            'MATCH_ID': basicData['MATCH_ID'],
            'SEASON': basicData['SEASON'],
            'CHAMPION': basicData['CHAMPION'],
            'ROUND': basicData['ROUND'],
            'WHO START?': basicData['WHO START?'],
            'OPPONENT TEAM': basicData['OPPONENT TEAM'],
            'OPPONENT PLAYER': row.querySelector(`input[name="opponent_player_${index}_name"]`)?.value || '',
            'OPPONENT STATUS': row.querySelector(`select[name="opponent_player_${index}_status"]`)?.value || '',
            'HOWMISS OPPONENT': row.querySelector(`input[name="opponent_player_${index}_howmiss"]`)?.value || '',
            'AHLY GK': basicData['AHLY GK'],
            'MATCH RESULT': formData.get('match_result') || '',
            'PKS RESULT': formData.get('pks_result') || '',
            'PKS W-L': formData.get('pks_w_l') || '',
            'AHLY TEAM': formData.get('ahly_team') || '',
            'AHLY PLAYER': row.querySelector(`input[name="ahly_player_${index}_name"]`)?.value || '',
            'AHLY STATUS': row.querySelector(`select[name="ahly_player_${index}_status"]`)?.value || '',
            'HOWMISS AHLY': row.querySelector(`input[name="ahly_player_${index}_howmiss"]`)?.value || '',
            'OPPONENT GK': basicData['OPPONENT GK']
        };
        ahlyPlayers.push(playerData);
    });
    
    // Get Opponent players data
    const opponentPlayers = [];
    const opponentPlayerRows = document.querySelectorAll('#opponent-players-container .pks-player-row');
    opponentPlayerRows.forEach((row, index) => {
        const playerData = {
            'PKS System': basicData['PKS System'],
            'CHAMPION System': basicData['CHAMPION System'],
            'MATCH_ID': basicData['MATCH_ID'],
            'SEASON': basicData['SEASON'],
            'CHAMPION': basicData['CHAMPION'],
            'ROUND': basicData['ROUND'],
            'WHO START?': basicData['WHO START?'],
            'OPPONENT TEAM': basicData['OPPONENT TEAM'],
            'OPPONENT PLAYER': row.querySelector(`input[name="opponent_player_${index}_name"]`)?.value || '',
            'OPPONENT STATUS': row.querySelector(`select[name="opponent_player_${index}_status"]`)?.value || '',
            'HOWMISS OPPONENT': row.querySelector(`input[name="opponent_player_${index}_howmiss"]`)?.value || '',
            'AHLY GK': basicData['AHLY GK'],
            'MATCH RESULT': formData.get('match_result') || '',
            'PKS RESULT': formData.get('pks_result') || '',
            'PKS W-L': formData.get('pks_w_l') || '',
            'AHLY TEAM': formData.get('ahly_team') || '',
            'AHLY PLAYER': '',
            'AHLY STATUS': '',
            'HOWMISS AHLY': '',
            'OPPONENT GK': basicData['OPPONENT GK']
        };
        opponentPlayers.push(playerData);
    });
    
    // Combine all data
    const allData = [basicData, ...ahlyPlayers, ...opponentPlayers];
    
    // Send data to server to create Excel
    fetch('/create_excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data_type: 'ahly_pks',
            data: allData
        })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ahly_pks_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(error => {
        console.error('Error:', error);
        // Error creating Excel file
    });
}

// ============================================================================
// SECTION 8: INITIALIZATION
// ============================================================================

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Football Data Entry Application Initialized');
    
    // Initialize based on current page
    const currentPath = window.location.pathname;

    if (currentPath === '/') {
        // Main dashboard - no specific initialization needed
        console.log('Main Dashboard loaded');
    } else if (currentPath === '/al-ahly-stats') {
        // Al Ahly stats - initialize stats module
        if (typeof initializeAlAhlyStats === 'function') {
            initializeAlAhlyStats();
        }
    } else if (currentPath === '/al-ahly-pks-stats') {
        // Al Ahly PKS stats - initialize PKS stats module
        if (typeof initializeAlAhlyPKSStats === 'function') {
            initializeAlAhlyPKSStats();
        }
    } else {
        // Individual data entry pages - load standard data
        loadPlayers();
        loadTeams();
        loadTypes();
        loadStadiums();
        loadChampions();
        loadManagers();
        loadReferees();
    }
    
    // Setup team search functionality (opponent_team)
    const teamInput = document.getElementById('opponent_team');
    if (teamInput && teamInput.parentElement) {
        const teamDropdown = teamInput.parentElement.querySelector('.dropdown-options');
        if (teamDropdown) {
            setupTeamSearch(teamInput, teamDropdown);
        }
    }
    
    // Setup stadium search functionality
    const stadiumInput = document.getElementById('stadium');
    if (stadiumInput && stadiumInput.parentElement) {
        const stadiumDropdown = stadiumInput.parentElement.querySelector('.dropdown-options');
        if (stadiumDropdown) {
            setupStadiumSearch(stadiumInput, stadiumDropdown);
        }
    }
    
    // Setup champion search functionality
    const championInput = document.getElementById('champion');
    if (championInput && championInput.parentElement) {
        const championDropdown = championInput.parentElement.querySelector('.dropdown-options');
        if (championDropdown) {
            setupChampionSearch(championInput, championDropdown);
        }
    }
    
    // Setup manager search functionality
    const managerInput = document.getElementById('ahly_manager');
    if (managerInput && managerInput.parentElement) {
        const managerDropdown = managerInput.parentElement.querySelector('.dropdown-options');
        if (managerDropdown) {
            setupManagerSearch(managerInput, managerDropdown);
        }
    }
    
    // Setup opponent manager search functionality
    const opponentManagerInput = document.getElementById('opponent_manager');
    if (opponentManagerInput && opponentManagerInput.parentElement) {
        const opponentManagerDropdown = opponentManagerInput.parentElement.querySelector('.dropdown-options');
        if (opponentManagerDropdown) {
            setupManagerSearch(opponentManagerInput, opponentManagerDropdown);
        }
    }
    
    // Setup referee search functionality
    const refereeInput = document.getElementById('referee');
    if (refereeInput && refereeInput.parentElement) {
        const refereeDropdown = refereeInput.parentElement.querySelector('.dropdown-options');
        if (refereeDropdown) {
            setupRefereeSearch(refereeInput, refereeDropdown);
        }
    }
    
    
    // Add event listeners for existing player rows
    const existingPlayerRows = document.querySelectorAll('.player-row');
    existingPlayerRows.forEach(row => {
        addEventListenersToRow(row);
    });
    
    const existingEgyptRows = document.querySelectorAll('#egypt-players-container .player-row');
    existingEgyptRows.forEach(row => {
        addEventListenersToEgyptRow(row);
    });
    
    // Don't update all min totals on page load to avoid interference
});

// ============================================================================
// CACHE MANAGEMENT FUNCTIONS
// ============================================================================

async function refreshCache() {
    const btn = document.getElementById('refresh-cache-btn');
    const originalText = btn.innerHTML;
    
    try {
        // Show loading state
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            <span>جاري التحديث...</span>
        `;
        
        // Call refresh API
        const response = await fetch('/api/refresh-cache');
        const result = await response.json();
        
        if (result.success) {
            // Reload page immediately to get fresh data (no notification)
            window.location.reload();
        } else {
            // On error, reset button and show error in console
            console.error('Failed to refresh cache:', result.message);
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.innerHTML = originalText;
        }
        
    } catch (error) {
        console.error('Error refreshing cache:', error);
        // On error, reset button
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = originalText;
    }
}

function showFlashMessage(message, type = 'info') {
    // Create flash message element
    const flashDiv = document.createElement('div');
    flashDiv.className = `flash-message flash-${type}`;
    flashDiv.textContent = message;
    
    // Add to flash messages container
    let flashContainer = document.querySelector('.flash-messages');
    if (!flashContainer) {
        flashContainer = document.createElement('div');
        flashContainer.className = 'flash-messages';
        document.body.appendChild(flashContainer);
    }
    
    flashContainer.appendChild(flashDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (flashDiv.parentNode) {
            flashDiv.parentNode.removeChild(flashDiv);
        }
    }, 5000);
}