/* National Men Halls - Frontend Module */

window.nationalMenHalls = (function () {
    let allRecords = [];
    let appsScriptUrl = '';
    let filtersApplied = false;

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
                    if (isFinite(d) && d < from) return false;
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
        const btnRanking = document.getElementById('nmh-tab-ranking-btn');
        const tabMatches = document.getElementById('nmh-matches-tab');
        const tabTeams = document.getElementById('nmh-teams-tab');
        const tabRanking = document.getElementById('nmh-ranking-tab');
        if (!btnMatches || !btnTeams || !btnRanking || !tabMatches || !tabTeams || !tabRanking) return;
        const activate = (name) => {
            // Close modal when switching tabs
            closeTeamDetailsModal();
            // Reset all buttons
            [btnMatches, btnTeams, btnRanking].forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = '#f1f3f5';
                btn.style.color = '#495057';
            });
            // Hide all tabs
            [tabMatches, tabTeams, tabRanking].forEach(tab => {
                tab.style.display = 'none';
            });
            
            if (name === 'matches') {
                btnMatches.classList.add('active');
                btnMatches.style.background = '#007bff';
                btnMatches.style.color = '#fff';
                tabMatches.style.display = 'block';
            } else if (name === 'teams') {
                btnTeams.classList.add('active');
                btnTeams.style.background = '#007bff';
                btnTeams.style.color = '#fff';
                tabTeams.style.display = 'block';
            } else if (name === 'ranking') {
                btnRanking.classList.add('active');
                btnRanking.style.background = '#007bff';
                btnRanking.style.color = '#fff';
                tabRanking.style.display = 'block';
            }
        };
        btnMatches.addEventListener('click', () => activate('matches'));
        btnTeams.addEventListener('click', () => activate('teams'));
        btnRanking.addEventListener('click', () => activate('ranking'));
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
            setupRankingTeamSearch();
            setupRankingSubTabs();
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
        filtersApplied = true;
        const filtered = applyCurrentFilters();
        renderTable(filtered);
        renderTeamStats(filtered);
        // Close modal when filters change
        closeTeamDetailsModal();
        const searchInput = document.getElementById('matches-search-input');
        if (searchInput) searchInput.value = '';
        const teamSearchInput = document.getElementById('nmh-teams-search-input');
        if (teamSearchInput) teamSearchInput.value = '';
        
        // Recalculate rankings if a team is selected
        if (window.__nmh_selected_team) {
            const btnLastAge = document.getElementById('nmh-subtab-last-age-btn');
            const isLastAgeActive = btnLastAge && btnLastAge.classList.contains('active');
            if (isLastAgeActive) {
                calculateAndRenderRankingsLastAge(window.__nmh_selected_team);
            } else {
                calculateAndRenderRankingsLastSeason(window.__nmh_selected_team);
            }
        }
    }

    function clearFilters() {
        filtersApplied = false;
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

    // Refresh data with visual feedback
    async function refreshData() {
        const refreshBtn = event.target.closest('button');
        const originalText = refreshBtn.innerHTML;
        
        // Show loading state
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<svg style="animation: spin 1s linear infinite; width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refreshing...';
        
        try {
            await loadData(true);
            
            // Show success message
            refreshBtn.innerHTML = '<svg style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>Refreshed!';
            
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }, 2000);
        } catch (error) {
            refreshBtn.innerHTML = '<svg style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Error!';
            
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }, 2000);
        }
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
        refreshData,
        showTeamDetails,
        closeTeamDetailsModal,
        toggleGameDetails,
        closeGameDetailsModal,
        applyCurrentFilters,
        get filtersApplied() { return filtersApplied; }
    };
})();

// ============================================================================
// RANKING FUNCTIONS
// ============================================================================

// Setup ranking team search
function setupRankingTeamSearch() {
    const input = document.getElementById('nmh-ranking-team-search');
    const dropdown = document.getElementById('nmh-ranking-team-dropdown');
    
    if (!input || !dropdown) return;
    
    // Get all unique teams from TeamA and TeamB
    const allTeams = new Set();
    const records = window.__nmh_records || [];
    
    records.forEach(record => {
        if (record['TeamA']) allTeams.add(String(record['TeamA']).trim());
        if (record['TeamB']) allTeams.add(String(record['TeamB']).trim());
    });
    
    const sortedTeams = Array.from(allTeams).filter(t => t).sort();
    
    // Remove previous listeners by cloning
    const container = input.parentElement;
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    
    const newInput = newContainer.querySelector('input');
    const newDropdown = newContainer.querySelector('.dropdown-options');
    
    if (!newInput || !newDropdown) return;
    
    // Setup search
    newInput.addEventListener('focus', () => {
        renderTeamOptions(newInput, newDropdown, sortedTeams, newInput.value || '');
    });
    
    newInput.addEventListener('input', (e) => {
        renderTeamOptions(newInput, newDropdown, sortedTeams, e.target.value);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-select-container')) {
            newDropdown.style.display = 'none';
        }
    });
}

function renderTeamOptions(input, dropdown, teams, filterText) {
    const filter = filterText.toLowerCase().trim();
    const filtered = teams.filter(team => 
        team.toLowerCase().includes(filter)
    );
    
    dropdown.innerHTML = '';
    
    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    filtered.forEach(team => {
        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.textContent = team;
        div.addEventListener('click', () => {
            input.value = team;
            dropdown.style.display = 'none';
            // Store selected team globally
            window.__nmh_selected_team = team;
            // Calculate and display rankings - Last AGE is now the default
            calculateAndRenderRankingsLastAge(team);
        });
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
}

// Setup ranking sub tabs
function setupRankingSubTabs() {
    const btnLastSeason = document.getElementById('nmh-subtab-last-season-btn');
    const btnLastAge = document.getElementById('nmh-subtab-last-age-btn');
    const contentLastSeason = document.getElementById('nmh-subtab-last-season-content');
    const contentLastAge = document.getElementById('nmh-subtab-last-age-content');
    
    if (!btnLastSeason || !btnLastAge || !contentLastSeason || !contentLastAge) return;
    
    const activate = (type) => {
        // Reset all buttons
        [btnLastSeason, btnLastAge].forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = '#f1f3f5';
            btn.style.color = '#495057';
        });
        
        // Hide all contents
        [contentLastSeason, contentLastAge].forEach(content => {
            content.style.display = 'none';
        });
        
        if (type === 'last-age') {
            btnLastAge.classList.add('active');
            btnLastAge.style.background = '#007bff';
            btnLastAge.style.color = '#fff';
            contentLastAge.style.display = 'block';
            // Recalculate if team is selected
            if (window.__nmh_selected_team) {
                calculateAndRenderRankingsLastAge(window.__nmh_selected_team);
            }
        } else if (type === 'last-season') {
            btnLastSeason.classList.add('active');
            btnLastSeason.style.background = '#007bff';
            btnLastSeason.style.color = '#fff';
            contentLastSeason.style.display = 'block';
            // Recalculate if team is selected
            if (window.__nmh_selected_team) {
                calculateAndRenderRankingsLastSeason(window.__nmh_selected_team);
            }
        }
    };
    
    btnLastAge.addEventListener('click', () => activate('last-age'));
    btnLastSeason.addEventListener('click', () => activate('last-season'));
}

// Calculate team rankings - Last Season (last position in last season for each GAME+AGE)
function calculateAndRenderRankingsLastSeason(teamName) {
    // Use filtered records only if Apply Filter was clicked
    const records = window.nationalMenHalls?.filtersApplied ? 
        (window.nationalMenHalls.applyCurrentFilters ? window.nationalMenHalls.applyCurrentFilters() : window.__nmh_records || []) :
        (window.__nmh_records || []);
    const teamNameLower = String(teamName).toLowerCase().trim();
    
    const teamMatches = records.filter(r => {
        const teamA = String(r['TeamA'] || '').toLowerCase().trim();
        const teamB = String(r['TeamB'] || '').toLowerCase().trim();
        return teamA === teamNameLower || teamB === teamNameLower;
    });
    
    if (teamMatches.length === 0) {
        showRankingMessage('No matches found for this team');
        return;
    }
    
    // Group matches by (GAME, AGE)
    const groupedByGameAge = {};
    teamMatches.forEach(match => {
        const game = String(match['GAME'] || '').trim();
        const age = String(match['AGE'] || '').trim();
        if (!game && !age) return;
        const key = `${game}|${age}`;
        if (!groupedByGameAge[key]) groupedByGameAge[key] = [];
        groupedByGameAge[key].push(match);
    });
    
    const rankings = [];

    const getRoundPriority = (round) => {
        const roundLower = String(round).toLowerCase().trim();
        if (roundLower === 'final' || roundLower.includes('final')) return 1;
        const num = parseInt(round);
        if (!isNaN(num) && num >= 1 && num <= 7) return num + 1;
        return 999;
    };

    Object.keys(groupedByGameAge).forEach(key => {
        const matches = groupedByGameAge[key];
        const [game, competition] = key.split('|');
        
        // Find the last match to get context like season and result
        const sortedMatches = matches.slice().sort((a, b) => {
            const seasonA = String(a['Season'] || '');
            const seasonB = String(b['Season'] || '');
            if (seasonA !== seasonB) return seasonB.localeCompare(seasonA);
            
            const dateA = new Date(String(a['Date'] || ''));
            const dateB = new Date(String(b['Date'] || ''));
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
            return 0;
        });
        
        if (sortedMatches.length === 0) return;
        const lastMatch = sortedMatches[0];
        
        const lastSeason = String(lastMatch['Season'] || '');
        const gameFull = String(lastMatch['GAME'] || game || '');
        
        const position = String(lastMatch['Round'] || '');

        // Always add a row
        let result = '-';
        const teamA = String(lastMatch['TeamA'] || '').toLowerCase().trim();
        const teamB = String(lastMatch['TeamB'] || '').toLowerCase().trim();
        const scoreA = parseInt(lastMatch['TeamAScore'] || '0', 10);
        const scoreB = parseInt(lastMatch['TeamBScore'] || '0', 10);
        
        if (teamA === teamNameLower) {
            if (scoreA > scoreB) result = 'W'; else if (scoreA < scoreB) result = 'L'; else result = 'D';
        } else if (teamB === teamNameLower) {
            if (scoreB > scoreA) result = 'W'; else if (scoreB < scoreA) result = 'L'; else result = 'D';
        }
        
        rankings.push({
            game: gameFull,
            age: competition,
            position: position,
            season: lastSeason,
            result: result
        });
     });
     
     rankings.sort((a, b) => {
         if (a.game !== b.game) return a.game.localeCompare(b.game);
         if (a.age !== b.age) return a.age.localeCompare(b.age);
         return getRoundPriority(a.position) - getRoundPriority(b.position);
     });
     
     renderRankingTableLastSeason(rankings);
 }
 
// Calculate team rankings - Last AGE (last position in last AGE for each GAME+Season)
function calculateAndRenderRankingsLastAge(teamName) {
    // Use filtered records only if Apply Filter was clicked
    const records = window.nationalMenHalls?.filtersApplied ? 
        (window.nationalMenHalls.applyCurrentFilters ? window.nationalMenHalls.applyCurrentFilters() : window.__nmh_records || []) :
        (window.__nmh_records || []);
    const teamNameLower = String(teamName).toLowerCase().trim();
    
    const teamMatches = records.filter(r => {
        const teamA = String(r['TeamA'] || '').toLowerCase().trim();
        const teamB = String(r['TeamB'] || '').toLowerCase().trim();
        return teamA === teamNameLower || teamB === teamNameLower;
    });
    
    if (teamMatches.length === 0) {
        showRankingMessageLastAge('No matches found for this team');
        return;
    }
    
    // Group matches by (GAME, Season)
    const groupedByGameSeason = {};
    teamMatches.forEach(match => {
        const game = String(match['GAME'] || '').trim();
        const season = String(match['Season'] || '').trim();
        if (!game && !season) return;
        const key = `${game}|${season}`;
        if (!groupedByGameSeason[key]) groupedByGameSeason[key] = [];
        groupedByGameSeason[key].push(match);
    });
    
    const rankings = [];

    const getRoundPriority = (round) => {
        const roundLower = String(round).toLowerCase().trim();
        if (roundLower === 'final' || roundLower.includes('final')) return 1;
        const num = parseInt(round);
        if (!isNaN(num) && num >= 1 && num <= 7) return num + 1;
        return 999;
    };

    Object.keys(groupedByGameSeason).forEach(key => {
        const matches = groupedByGameSeason[key];
        const [game, season] = key.split('|');
        
        // Find the last match to get context like AGE and result
        const sortedMatches = matches.slice().sort((a, b) => {
            const ageA = String(a['AGE'] || '').trim();
            const ageB = String(b['AGE'] || '').trim();
            if (ageA !== ageB) return ageB.localeCompare(ageA);
            
            const dateA = new Date(String(a['Date'] || ''));
            const dateB = new Date(String(b['Date'] || ''));
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
            return 0;
        });
        
        if (sortedMatches.length === 0) return;
        const lastMatch = sortedMatches[0];
        
        const gameFull = String(lastMatch['GAME'] || game || '');
        const age = String(lastMatch['AGE'] || '').trim();
        const position = String(lastMatch['Round'] || '');

        // Always add a row
        let result = '-';
        const teamA = String(lastMatch['TeamA'] || '').toLowerCase().trim();
        const teamB = String(lastMatch['TeamB'] || '').toLowerCase().trim();
        const scoreA = parseInt(lastMatch['TeamAScore'] || '0', 10);
        const scoreB = parseInt(lastMatch['TeamBScore'] || '0', 10);
        
        if (teamA === teamNameLower) {
            if (scoreA > scoreB) result = 'W'; else if (scoreA < scoreB) result = 'L'; else result = 'D';
        } else if (teamB === teamNameLower) {
            if (scoreB > scoreA) result = 'W'; else if (scoreB < scoreA) result = 'L'; else result = 'D';
        }
        
        rankings.push({
            game: gameFull,
            age: age,
            position: position,
            season: season,
            result: result
        });
     });
     
     rankings.sort((a, b) => {
         if (a.game !== b.game) return a.game.localeCompare(b.game);
         if (a.age !== b.age) return a.age.localeCompare(b.age);
         if (a.season !== b.season) return b.season.localeCompare(a.season);
         return getRoundPriority(a.position) - getRoundPriority(b.position);
     });
     
     renderRankingTableLastAge(rankings);
 }

function renderRankingTableLastSeason(rankings) {
    const tbody = document.getElementById('nmh-ranking-tbody');
    const resultsDiv = document.getElementById('nmh-ranking-results');
    const noTeamDiv = document.getElementById('nmh-ranking-no-team');
    const searchInput = document.getElementById('nmh-ranking-search');
    
    if (!tbody || !resultsDiv || !noTeamDiv) return;
    
    if (rankings.length === 0) {
        resultsDiv.style.display = 'none';
        noTeamDiv.style.display = 'block';
        if (searchInput) searchInput.style.display = 'none';
        return;
    }
    
    noTeamDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
    if (searchInput) searchInput.style.display = 'block';
    
    // Store rankings globally for filtering
    window.__nmh_last_season_rankings = rankings;
    
    // Format position for display
    const formatPosition = (pos) => {
        if (pos.toLowerCase() === 'final') return 'Final';
        return pos;
    };
    
    // Format result for display
    const formatResult = (result) => {
        const resultUpper = String(result || '').toUpperCase();
        if (resultUpper === 'W') return '<span style="color: #28a745; font-weight: 700;">W</span>';
        if (resultUpper === 'D') return '<span style="color: #ffc107; font-weight: 700;">D</span>';
        if (resultUpper === 'L') return '<span style="color: #dc3545; font-weight: 700;">L</span>';
        return '<span style="color: #6c757d;">-</span>';
    };
    
    // Render function
    const renderRows = (data) => {
        tbody.innerHTML = data.map(r => {
            return `
                <tr>
                    <td>${escapeHtml(r.game || '')}</td>
                    <td>${escapeHtml(r.age || '')}</td>
                    <td style="font-weight: 600; color: #007bff;">${formatPosition(r.position)}</td>
                    <td style="text-align: center;">${formatResult(r.result)}</td>
                    <td>${escapeHtml(r.season || '')}</td>
                </tr>
            `;
        }).join('');
        
        // Show message if no results
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                        No results found matching your search
                    </td>
                </tr>
            `;
        }
    };
    
    // Initial render
    renderRows(rankings);
    
    // Setup search functionality
    if (searchInput) {
        // Remove previous listeners
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const sourceRankings = window.__nmh_last_season_rankings;
            
            if (!sourceRankings) return;
            
            if (!searchTerm) {
                renderRows(sourceRankings);
                return;
            }
            
            const filtered = sourceRankings.filter(r => {
                const game = String(r.game || '').toLowerCase();
                const age = String(r.age || '').toLowerCase();
                const position = String(r.position || '').toLowerCase();
                const result = String(r.result || '').toLowerCase();
                const season = String(r.season || '').toLowerCase();
                
                return game.includes(searchTerm) ||
                       age.includes(searchTerm) ||
                       position.includes(searchTerm) ||
                       result.includes(searchTerm) ||
                       season.includes(searchTerm);
            });
            
            renderRows(filtered);
        });
    }
}

function renderRankingTableLastAge(rankings) {
    const tbody = document.getElementById('nmh-last-age-tbody');
    const resultsDiv = document.getElementById('nmh-last-age-results');
    const noTeamDiv = document.getElementById('nmh-last-age-no-team');
    const searchInput = document.getElementById('nmh-last-age-search');
    
    if (!tbody || !resultsDiv || !noTeamDiv) return;
    
    if (rankings.length === 0) {
        resultsDiv.style.display = 'none';
        noTeamDiv.style.display = 'block';
        if (searchInput) searchInput.style.display = 'none';
        return;
    }
    
    noTeamDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
    if (searchInput) searchInput.style.display = 'block';
    
    // Store rankings globally for filtering
    window.__nmh_last_age_rankings = rankings;
    
    // Format position for display
    const formatPosition = (pos) => {
        if (pos.toLowerCase() === 'final') return 'Final';
        return pos;
    };
    
    // Format result for display
    const formatResult = (result) => {
        const resultUpper = String(result || '').toUpperCase();
        if (resultUpper === 'W') return '<span style="color: #28a745; font-weight: 700;">W</span>';
        if (resultUpper === 'D') return '<span style="color: #ffc107; font-weight: 700;">D</span>';
        if (resultUpper === 'L') return '<span style="color: #dc3545; font-weight: 700;">L</span>';
        return '<span style="color: #6c757d;">-</span>';
    };
    
    // Render function
    const renderRows = (data) => {
        tbody.innerHTML = data.map(r => {
            return `
                <tr>
                    <td>${escapeHtml(r.game || '')}</td>
                    <td>${escapeHtml(r.age || '')}</td>
                    <td style="font-weight: 600; color: #007bff;">${formatPosition(r.position)}</td>
                    <td style="text-align: center;">${formatResult(r.result)}</td>
                    <td>${escapeHtml(r.season || '')}</td>
                </tr>
            `;
        }).join('');
        
        // Show message if no results
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                        No results found matching your search
                    </td>
                </tr>
            `;
        }
    };
    
    // Initial render
    renderRows(rankings);
    
    // Setup search functionality
    if (searchInput) {
        // Remove previous listeners
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const sourceRankings = window.__nmh_last_age_rankings;
            
            if (!sourceRankings) return;
            
            if (!searchTerm) {
                renderRows(sourceRankings);
                return;
            }
            
            const filtered = sourceRankings.filter(r => {
                const game = String(r.game || '').toLowerCase();
                const age = String(r.age || '').toLowerCase();
                const position = String(r.position || '').toLowerCase();
                const result = String(r.result || '').toLowerCase();
                const season = String(r.season || '').toLowerCase();
                
                return game.includes(searchTerm) ||
                       age.includes(searchTerm) ||
                       position.includes(searchTerm) ||
                       result.includes(searchTerm) ||
                       season.includes(searchTerm);
            });
            
            renderRows(filtered);
        });
    }
}

function showRankingMessageLastAge(message) {
    const resultsDiv = document.getElementById('nmh-last-age-results');
    const noTeamDiv = document.getElementById('nmh-last-age-no-team');
    
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (noTeamDiv) {
        noTeamDiv.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem; opacity: 0.5;">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p style="font-size: 1.1rem; margin-top: 1rem;">${message}</p>
        `;
        noTeamDiv.style.display = 'block';
    }
}

function showRankingMessage(message) {
    const resultsDiv = document.getElementById('nmh-ranking-results');
    const noTeamDiv = document.getElementById('nmh-ranking-no-team');
    
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (noTeamDiv) {
        noTeamDiv.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem; opacity: 0.5;">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p style="font-size: 1.1rem; margin-top: 1rem;">${message}</p>
        `;
        noTeamDiv.style.display = 'block';
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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


