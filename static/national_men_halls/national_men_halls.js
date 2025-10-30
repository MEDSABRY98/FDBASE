/* National Men Halls - Frontend Module */

window.nationalMenHalls = (function () {
    let allRecords = [];
    let appsScriptUrl = '';

    function setupDynamicTableSearch() {
        const searchInput = document.getElementById('matches-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('keyup', () => {
            const tableBody = document.getElementById('national-men-halls-tbody');
            if (!tableBody) return;
            
            const searchTerm = searchInput.value.toLowerCase().trim();
            const rows = tableBody.getElementsByTagName('tr');

            for (const row of rows) {
                const rowText = row.textContent.toLowerCase();
                if (rowText.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    function setupDynamicTeamsSearch() {
        const searchInput = document.getElementById('nmh-teams-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('keyup', () => {
            const tableBody = document.getElementById('nmh-teams-stats-tbody');
            if (!tableBody) return;
            const searchTerm = searchInput.value.toLowerCase().trim();
            const rows = tableBody.getElementsByTagName('tr');
            for (const row of rows) {
                const rowText = row.textContent.toLowerCase();
                row.style.display = rowText.includes(searchTerm) ? '' : 'none';
            }
        });
    }

    async function getConfig() {
        const res = await fetch('/api/national-men-halls/config');
        if (!res.ok) throw new Error('Failed to load config');
        const cfg = await res.json();
        if (!cfg.success || !cfg.appsScriptUrl) throw new Error('Apps Script URL not configured');
        return cfg.appsScriptUrl;
    }

    async function fetchData(forceRefresh = false) {
        const fetchFunction = async () => {
            // Use backend API endpoint with caching instead of direct Google Apps Script
            const url = forceRefresh 
                ? '/api/national-men-halls/data?refresh=true'
                : '/api/national-men-halls/data';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch data');
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) {
                throw new Error('Invalid response from API');
            }
            return json.data;
        };
        // Backend already handles caching, so we can still use browser cache for offline support
        const records = await fetchWithBrowserCache('national_men_halls', fetchFunction, forceRefresh);
        return Array.isArray(records) ? records : [];
    }

    function normalizeRecord(rec) {
        const obj = {};
        (window.NATIONAL_MEN_HALLS_COLUMNS || []).forEach((k) => {
            const value = rec ? rec[k] : null;
            // This logic is borrowed from al_ahly_stats.js to correctly handle zero values
            obj[k] = (value == null ? '' : String(value)).trim();
        });
        return obj;
    }

    function applyCurrentFilters() {
        const cols = window.NATIONAL_MEN_HALLS_COLUMNS || [];
        const textFilters = {};
        cols.forEach((c) => {
            const el = document.getElementById(`filter-${c}`);
            if (el && el.value && c !== 'Date') {
                textFilters[c] = String(el.value).toLowerCase().trim();
            }
        });
        // combined Teams filter (matches TeamA or TeamB)
        const teamFilterEl = document.getElementById('filter-Teams');
        const teamFilter = teamFilterEl && teamFilterEl.value ? String(teamFilterEl.value).toLowerCase().trim() : '';
        const dateFrom = document.getElementById('filter-DateFrom')?.value;
        const dateTo = document.getElementById('filter-DateTo')?.value;

        return allRecords.filter((r) => {
            for (const k in textFilters) {
                const v = String(r[k] || '').toLowerCase();
                if (!v.includes(textFilters[k])) return false;
            }
            if (teamFilter) {
                const ta = String(r['TeamA'] || '').toLowerCase();
                const tb = String(r['TeamB'] || '').toLowerCase();
                if (!ta.includes(teamFilter) && !tb.includes(teamFilter)) return false;
            }
            if (dateFrom || dateTo) {
                const dStr = r['Date'];
                if (dStr) {
                    const d = new Date(dStr);
                    if (dateFrom) {
                        const from = new Date(dateFrom);
                        if (isFinite(d) && d < from) return false;
                    }
                    if (dateTo) {
                        const to = new Date(dateTo);
                        if (isFinite(d) && d > to) return false;
                    }
                }
            }
            return true;
        });
    }

    function getSelectedTeamFilter() {
        const el = document.getElementById('filter-Teams');
        return el && el.value ? String(el.value).trim() : '';
    }

    function getResultSymbol(n) {
        const selectedTeam = getSelectedTeamFilter();
        if (!selectedTeam) return '-';
        const teamA = String(n['TeamA'] || '').trim();
        const teamB = String(n['TeamB'] || '').trim();
        const a = parseInt(n['TeamAScore'], 10);
        const b = parseInt(n['TeamBScore'], 10);
        if (isNaN(a) || isNaN(b)) return '-';
        const sel = selectedTeam.toLowerCase();
        const isA = teamA.toLowerCase() === sel;
        const isB = teamB.toLowerCase() === sel;
        if (!isA && !isB) return '-';
        if (a === b) return 'D';
        if (isA) return a > b ? 'W' : 'L';
        // isB
        return b > a ? 'W' : 'L';
    }

    function getResultClass(symbol) {
        if (symbol === 'W') return 'wl-cell wl-win';
        if (symbol === 'D') return 'wl-cell wl-draw';
        if (symbol === 'L') return 'wl-cell wl-loss';
        return 'wl-cell';
    }

    function renderTable(records) {
        const tbody = document.getElementById('national-men-halls-tbody');
        if (!tbody) return;
        // Match the headers in the template (exact order requested + W/L computed at the end)
        const cols = ['GAME','AGE','Season','Round','TeamA','TeamAScore','TeamBScore','TeamB'];
        const rowsHtml = records.map((rec) => {
            const n = normalizeRecord(rec);
            const tds = cols.map((c) => `<td>${escapeHtml(String(n[c] ?? ''))}</td>`).join('');
            const wl = getResultSymbol(n);
            const wlClass = getResultClass(wl);
            return `<tr>${tds}<td><span class="${wlClass}">${wl}</span></td></tr>`;
        }).join('');
        tbody.innerHTML = rowsHtml;
    }

    function computeTeamStats(records) {
        const stats = new Map();
        function ensure(team) {
            if (!stats.has(team)) {
                stats.set(team, { team, matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, seasons: new Set() });
            }
            return stats.get(team);
        }
        records.forEach(r => {
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const a = parseInt(r['TeamAScore'], 10);
            const b = parseInt(r['TeamBScore'], 10);
            const season = String(r['Season'] || '').trim();
            if (!aTeam || !bTeam || isNaN(a) || isNaN(b)) return;
            const sa = ensure(aTeam); const sb = ensure(bTeam);
            sa.matches += 1; sb.matches += 1;
            sa.gf += a; sa.ga += b;
            sb.gf += b; sb.ga += a;
            if (season) { sa.seasons.add(season); sb.seasons.add(season); }
            if (a > b) { sa.win += 1; sb.loss += 1; }
            else if (a < b) { sa.loss += 1; sb.win += 1; }
            else { sa.draw += 1; sb.draw += 1; }
        });
        return Array.from(stats.values()).map(s => ({
            team: s.team,
            matches: s.matches,
            win: s.win,
            draw: s.draw,
            loss: s.loss,
            gf: s.gf,
            ga: s.ga,
            participations: s.seasons.size
        })).sort((x,y) => y.matches - x.matches || x.team.localeCompare(y.team));
    }

    function renderTeamStats(records) {
        const tbody = document.getElementById('nmh-teams-stats-tbody');
        if (!tbody) return;
        const stats = computeTeamStats(records);
        // Store filtered records for details view
        window.__nmh_filtered_records = records;
        const rows = stats.map((s) => {
            return `
            <tr>
                <td style="cursor:pointer; color:#007bff; text-decoration:underline;" onclick="window.nationalMenHalls.showTeamDetails('${escapeHtml(s.team).replace(/'/g, "\\'")}')">${escapeHtml(s.team)}</td>
                <td>${s.participations || 0}</td>
                <td>${s.matches}</td>
                <td>${s.win}</td>
                <td>${s.draw}</td>
                <td>${s.loss}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
            </tr>
        `;
        }).join('');
        tbody.innerHTML = rows;
    }

    function computeTeamStatsByGame(teamName, records) {
        const stats = new Map();
        function ensure(game) {
            if (!stats.has(game)) {
                stats.set(game, { game, matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, seasons: new Set() });
            }
            return stats.get(game);
        }
        const normalizedTeamName = String(teamName || '').trim();
        records.forEach(r => {
            const game = String(r['GAME'] || '').trim();
            if (!game) return;
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const a = parseInt(r['TeamAScore'], 10);
            const b = parseInt(r['TeamBScore'], 10);
            if (isNaN(a) || isNaN(b)) return;
            // Use case-insensitive comparison to handle minor differences
            const isTeamA = aTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            const isTeamB = bTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            if (!isTeamA && !isTeamB) return;
            const s = ensure(game);
            s.matches += 1;
            const season = String(r['Season'] || '').trim();
            if (season) s.seasons.add(season);
            if (isTeamA) {
                s.gf += a; s.ga += b;
                if (a > b) s.win += 1;
                else if (a < b) s.loss += 1;
                else s.draw += 1;
            } else {
                s.gf += b; s.ga += a;
                if (b > a) s.win += 1;
                else if (b < a) s.loss += 1;
                else s.draw += 1;
            }
        });
        return Array.from(stats.values()).map(s => ({
            game: s.game,
            matches: s.matches,
            win: s.win,
            draw: s.draw,
            loss: s.loss,
            gf: s.gf,
            ga: s.ga,
            participations: s.seasons.size
        })).sort((x,y) => x.game.localeCompare(y.game));
    }

    function getTeamStatsByGameAndAge(teamName, gameName, records) {
        const normalizedTeamName = String(teamName || '').trim();
        const normalizedGameName = String(gameName || '').trim();
        const stats = new Map();
        
        function ensure(age) {
            if (!stats.has(age)) {
                stats.set(age, { AGE: age, matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, seasons: new Set() });
            }
            return stats.get(age);
        }
        
        records.forEach(r => {
            const game = String(r['GAME'] || '').trim();
            if (game !== normalizedGameName) return;
            
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const a = parseInt(r['TeamAScore'], 10);
            const b = parseInt(r['TeamBScore'], 10);
            if (isNaN(a) || isNaN(b)) return;
            
            const isTeamA = aTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            const isTeamB = bTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            if (!isTeamA && !isTeamB) return;
            
            const age = String(r['AGE'] || '').trim();
            if (!age) return;
            
            const s = ensure(age);
            s.matches += 1;
            const season = String(r['Season'] || '').trim();
            if (season) s.seasons.add(season);
            
            if (isTeamA) {
                s.gf += a;
                s.ga += b;
                if (a > b) s.win += 1;
                else if (a < b) s.loss += 1;
                else s.draw += 1;
            } else {
                s.gf += b;
                s.ga += a;
                if (b > a) s.win += 1;
                else if (b < a) s.loss += 1;
                else s.draw += 1;
            }
        });
        
        return Array.from(stats.values()).map(s => ({
            AGE: s.AGE,
            matches: s.matches,
            win: s.win,
            draw: s.draw,
            loss: s.loss,
            gf: s.gf,
            ga: s.ga,
            participations: s.seasons.size
        })).sort((x, y) => x.AGE.localeCompare(y.AGE));
    }

    function showTeamDetails(teamName) {
        const records = Array.isArray(window.__nmh_filtered_records) ? window.__nmh_filtered_records : [];
        const details = computeTeamStatsByGame(teamName, records);
        
        if (!details || details.length === 0) {
            alert(`No statistics available for ${teamName}`);
            return;
        }
        
        // Create unique ID for this modal
        const modalId = `nmh-team-modal-${Date.now()}`;
        
        // Create modal content
        let modalContent = `
            <div class="modal-overlay" id="${modalId}" onclick="window.nationalMenHalls.closeTeamDetailsModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${escapeHtml(teamName)} - Statistics by Game</h3>
                        <button class="modal-close" onclick="window.nationalMenHalls.closeTeamDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Game</th>
                                    <th>Participations</th>
                                    <th>Matches</th>
                                    <th>Win</th>
                                    <th>Draw</th>
                                    <th>Loss</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
            details.forEach((d, idx) => {
            const gameId = `game-row-${idx}`;
            const gameNameRaw = String(d.game || '');
            modalContent += `
                <tr id="${gameId}">
                    <td style="cursor:pointer; color:#007bff; text-decoration:underline; font-weight:600;" 
                        class="game-clickable" 
                        data-team="${escapeHtml(teamName).replace(/"/g, '&quot;')}" 
                        data-game="${escapeHtml(gameNameRaw).replace(/"/g, '&quot;')}" 
                        data-modal-id="${modalId}">${escapeHtml(gameNameRaw)}</td>
                    <td>${d.participations || 0}</td>
                    <td>${d.matches || 0}</td>
                    <td>${d.win || 0}</td>
                    <td>${d.draw || 0}</td>
                    <td>${d.loss || 0}</td>
                    <td>${d.gf || 0}</td>
                    <td>${d.ga || 0}</td>
                </tr>
            `;
        });
        
        // Calculate totals
        let totalMatches = 0, totalWin = 0, totalDraw = 0, totalLoss = 0, totalGF = 0, totalGA = 0;
        details.forEach(d => {
            totalMatches += d.matches || 0;
            totalWin += d.win || 0;
            totalDraw += d.draw || 0;
            totalLoss += d.loss || 0;
            totalGF += d.gf || 0;
            totalGA += d.ga || 0;
        });
        // Total participations = unique seasons for this team in all filtered records
        const totalSeasons = new Set();
        records.forEach(r => {
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const season = String(r['Season'] || '').trim();
            if (!season) return;
            if (aTeam.toLowerCase() === String(teamName).toLowerCase() || bTeam.toLowerCase() === String(teamName).toLowerCase()) {
                totalSeasons.add(season);
            }
        });
        const totalParticipations = totalSeasons.size;
        
        modalContent += `
                                <tr class="total-row">
                                    <td><strong>Total</strong></td>
                                    <td><strong>${totalParticipations}</strong></td>
                                    <td><strong>${totalMatches}</strong></td>
                                    <td><strong>${totalWin}</strong></td>
                                    <td><strong>${totalDraw}</strong></td>
                                    <td><strong>${totalLoss}</strong></td>
                                    <td><strong>${totalGF}</strong></td>
                                    <td><strong>${totalGA}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.nationalMenHalls.closeTeamDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalContent);
        
        // Store team name and records in modal for later use
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement._teamName = teamName;
            modalElement._records = records;
        }
        
        // Add event listeners to game-clickable cells
        setTimeout(() => {
            const gameCells = modalElement?.querySelectorAll('.game-clickable');
            gameCells?.forEach(cell => {
                cell.addEventListener('click', function() {
                    const team = this.getAttribute('data-team');
                    const game = this.getAttribute('data-game');
                    const parentModalId = this.getAttribute('data-modal-id');
                    toggleGameDetails(team, game, null, parentModalId);
                });
            });
        }, 10);
    }
    
    function toggleGameDetails(teamName, gameName, expandRowId, modalId) {
        // Get records from modal or global
        const modal = document.getElementById(modalId);
        const records = modal && modal._records ? modal._records : (Array.isArray(window.__nmh_filtered_records) ? window.__nmh_filtered_records : []);
        const stats = getTeamStatsByGameAndAge(teamName, gameName, records);
        
        if (!stats || stats.length === 0) {
            alert(`No statistics found for ${teamName} in ${gameName}`);
            return;
        }
        
        // Create a new modal for game statistics by AGE
        const gameModalId = `nmh-game-modal-${Date.now()}`;
        
        let modalContent = `
            <div class="modal-overlay" id="${gameModalId}" onclick="window.nationalMenHalls.closeGameDetailsModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${escapeHtml(teamName)} - ${escapeHtml(gameName)} - Statistics by AGE</h3>
                        <button class="modal-close" onclick="window.nationalMenHalls.closeGameDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>AGE</th>
                                    <th>Participations</th>
                                    <th>Matches</th>
                                    <th>Win</th>
                                    <th>Draw</th>
                                    <th>Loss</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        stats.forEach(s => {
            modalContent += `
                <tr>
                    <td>${escapeHtml(String(s.AGE || ''))}</td>
                    <td>${s.participations || 0}</td>
                    <td>${s.matches || 0}</td>
                    <td>${s.win || 0}</td>
                    <td>${s.draw || 0}</td>
                    <td>${s.loss || 0}</td>
                    <td>${s.gf || 0}</td>
                    <td>${s.ga || 0}</td>
                </tr>
            `;
        });
        
        // Calculate totals
        let totalMatches = 0, totalWin = 0, totalDraw = 0, totalLoss = 0, totalGF = 0, totalGA = 0;
        stats.forEach(s => {
            totalMatches += s.matches || 0;
            totalWin += s.win || 0;
            totalDraw += s.draw || 0;
            totalLoss += s.loss || 0;
            totalGF += s.gf || 0;
            totalGA += s.ga || 0;
        });
        // Total participations = unique seasons for this team in this game across AGE
        const seasonsInGame = new Set();
        records.forEach(r => {
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const season = String(r['Season'] || '').trim();
            const game = String(r['GAME'] || '').trim();
            if (!season || game !== String(gameName).trim()) return;
            if (aTeam.toLowerCase() === String(teamName).toLowerCase() || bTeam.toLowerCase() === String(teamName).toLowerCase()) {
                seasonsInGame.add(season);
            }
        });
        const totalParticipations = seasonsInGame.size;
        
        modalContent += `
                                <tr class="total-row">
                                    <td><strong>Total</strong></td>
                                    <td><strong>${totalParticipations}</strong></td>
                                    <td><strong>${totalMatches}</strong></td>
                                    <td><strong>${totalWin}</strong></td>
                                    <td><strong>${totalDraw}</strong></td>
                                    <td><strong>${totalLoss}</strong></td>
                                    <td><strong>${totalGF}</strong></td>
                                    <td><strong>${totalGA}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.nationalMenHalls.closeGameDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalContent);
    }
    
    function closeGameDetailsModal() {
        const modals = document.querySelectorAll('.modal-overlay[id^="nmh-game-modal-"]');
        modals.forEach(modal => modal.remove());
    }
    
    function closeTeamDetailsModal() {
        // Close only team details modal, not game details modals
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            if (modal.id && modal.id.startsWith('nmh-team-modal-')) {
                modal.remove();
            } else if (!modal.id || !modal.id.startsWith('nmh-game-modal-')) {
                // Fallback for modals without ID
                modal.remove();
            }
        });
    }

    function hookTabs() {
        const btnMatches = document.getElementById('nmh-tab-matches-btn');
        const btnTeams = document.getElementById('nmh-tab-teams-btn');
        const tabMatches = document.getElementById('nmh-matches-tab');
        const tabTeams = document.getElementById('nmh-teams-tab');
        if (!btnMatches || !btnTeams || !tabMatches || !tabTeams) return;
        const activate = (name) => {
            // Close modal when switching tabs
            closeTeamDetailsModal();
            if (name === 'matches') {
                btnMatches.classList.add('active'); btnMatches.style.background = '#007bff'; btnMatches.style.color = '#fff';
                btnTeams.classList.remove('active'); btnTeams.style.background = '#f1f3f5'; btnTeams.style.color = '#495057';
                tabMatches.style.display = 'block'; tabTeams.style.display = 'none';
            } else {
                btnTeams.classList.add('active'); btnTeams.style.background = '#007bff'; btnTeams.style.color = '#fff';
                btnMatches.classList.remove('active'); btnMatches.style.background = '#f1f3f5'; btnMatches.style.color = '#495057';
                tabTeams.style.display = 'block'; tabMatches.style.display = 'none';
            }
        };
        btnMatches.addEventListener('click', () => activate('matches'));
        btnTeams.addEventListener('click', () => activate('teams'));
        // default active is matches
        activate('matches');
    }

    function showLoading(show) {
        const l = document.getElementById('loading-container');
        const c = document.getElementById('content-container');
        if (l) l.style.display = show ? 'flex' : 'none';
        if (c) c.style.display = show ? 'none' : 'block';
    }

    function escapeHtml(s) {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function loadData(forceRefresh = false) {
        try {
            showLoading(true);
            const data = await fetchData(forceRefresh);
            allRecords = data.map(normalizeRecord);
            // expose for other helpers
            window.__nmh_records = allRecords;
            populateFilterOptions(allRecords);
            setupAllSearchableSelects();
            const filtered = applyCurrentFilters();
            renderTable(filtered);
            renderTeamStats(filtered);
            hookTabs();
            setupDynamicTeamsSearch();
            showLoading(false);
        } catch (e) {
            console.error('Failed to load National Men Halls data:', e);
            allRecords = [];
            renderTable([]);
            renderTeamStats([]);
            showLoading(false);
        }
    }

    function applyFilters() {
        const filtered = applyCurrentFilters();
        renderTable(filtered);
        renderTeamStats(filtered);
        // Close modal when filters change
        closeTeamDetailsModal();
        const searchInput = document.getElementById('matches-search-input');
        if (searchInput) searchInput.value = '';
        const teamSearchInput = document.getElementById('nmh-teams-search-input');
        if (teamSearchInput) teamSearchInput.value = '';
    }

    function clearFilters() {
        const cols = window.NATIONAL_MEN_HALLS_COLUMNS || [];
        cols.forEach((c) => {
            const el = document.getElementById(`filter-${c}`);
            if (el) el.value = '';
        });
        const teams = document.getElementById('filter-Teams');
        if (teams) teams.value = '';
        const df = document.getElementById('filter-DateFrom');
        const dt = document.getElementById('filter-DateTo');
        if (df) df.value = '';
        if (dt) dt.value = '';
        
        const searchInput = document.getElementById('matches-search-input');
        if (searchInput) searchInput.value = '';

        applyFilters();
    }

    const initPage = () => {
        loadData(false);
        setupDynamicTableSearch();
        setupDynamicTeamsSearch();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }

    return {
        loadData,
        applyFilters,
        clearFilters,
        showTeamDetails,
        closeTeamDetailsModal,
        toggleGameDetails,
        closeGameDetailsModal
    };
})();

// Build unique options and attach datalists to filter inputs
function populateFilterOptions(records) {
    try {
        const escapeVal = (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const fieldsToSuggest = [
            'GAME','AGE','Season','Host Country','Category','Round','TeamAPEN','TeamBPEN'
        ];

        fieldsToSuggest.forEach((field) => {
            const input = document.getElementById(`filter-${field}`);
            if (!input) return;

            // Remove old datalist-based suggestions if exist (we now use custom searchable dropdowns)
            const existingListId = input.getAttribute('list');
            if (existingListId) {
                const oldDl = document.getElementById(existingListId);
                if (oldDl && oldDl.parentElement) {
                    oldDl.parentElement.removeChild(oldDl);
                }
                input.removeAttribute('list');
            }
        });

        // Also ensure Teams input has no datalist
        const teamsInput = document.getElementById('filter-Teams');
        if (teamsInput) {
            const listId = teamsInput.getAttribute('list');
            if (listId) {
                const oldDl = document.getElementById(listId);
                if (oldDl && oldDl.parentElement) oldDl.parentElement.removeChild(oldDl);
                teamsInput.removeAttribute('list');
            }
        }
    } catch (e) {
        console.warn('populateFilterOptions failed:', e);
    }
}


// Searchable select helpers (mirror behavior from other tabs)
function setupSearchableSelect(inputId, fieldName) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const container = input.closest('.searchable-select-container');
    if (!container) return;
    const dropdown = container.querySelector('.dropdown-options');
    if (!dropdown) return;

    const getUniqueValues = () => {
        const recs = Array.isArray(window.__nmh_records) ? window.__nmh_records : [];
        const vals = recs.map(r => r[fieldName]).filter(v => v !== undefined && v !== null);
        const unique = Array.from(new Set(vals.map(v => String(v).trim()).filter(v => v !== '')));
        return unique.sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };

    function showDropdownOptions(options) {
        dropdown.innerHTML = '';
        const allOption = document.createElement('div');
        allOption.className = 'dropdown-option';
        allOption.textContent = 'All';
        allOption.addEventListener('click', function() {
            input.value = '';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(allOption);

        options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'dropdown-option';
            optionDiv.textContent = option;
            optionDiv.addEventListener('click', function() {
                input.value = option;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(optionDiv);
        });

        dropdown.style.display = 'block';
    }

    input.addEventListener('focus', function() {
        showDropdownOptions(getUniqueValues());
    });

    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filtered = getUniqueValues().filter(opt => opt.toLowerCase().includes(searchTerm));
        showDropdownOptions(filtered);
    });

    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function setupAllSearchableSelects() {
    const fields = ['GAME','AGE','Season','Host Country','Category','Round','TeamAPEN','TeamBPEN'];
    fields.forEach((f) => setupSearchableSelect(`filter-${f}`, f));
    setupTeamsSearchableSelect();
}

function setupTeamsSearchableSelect() {
    const input = document.getElementById('filter-Teams');
    if (!input) return;
    const container = input.closest('.searchable-select-container');
    if (!container) return;
    const dropdown = container.querySelector('.dropdown-options');
    if (!dropdown) return;

    const getTeamOptions = () => {
        const recs = Array.isArray(window.__nmh_records) ? window.__nmh_records : [];
        const teams = [];
        recs.forEach(r => {
            if (r['TeamA']) teams.push(String(r['TeamA']).trim());
            if (r['TeamB']) teams.push(String(r['TeamB']).trim());
        });
        return Array.from(new Set(teams.filter(v => v))).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };

    function showDropdownOptions(options) {
        dropdown.innerHTML = '';
        const allOption = document.createElement('div');
        allOption.className = 'dropdown-option';
        allOption.textContent = 'All';
        allOption.addEventListener('click', function() {
            input.value = '';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(allOption);

        options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'dropdown-option';
            optionDiv.textContent = option;
            optionDiv.addEventListener('click', function() {
                input.value = option;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(optionDiv);
        });

        dropdown.style.display = 'block';
    }

    input.addEventListener('focus', function() {
        showDropdownOptions(getTeamOptions());
    });

    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filtered = getTeamOptions().filter(opt => opt.toLowerCase().includes(searchTerm));
        showDropdownOptions(filtered);
    });

    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}


