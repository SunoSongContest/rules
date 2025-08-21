// Data fetching and parsing functions
async function fetchData() {
    console.log('Fetching data started');
    try {
        const editions = window.CSV_MANIFEST.getAllEditions();
        console.log('Editions retrieved:', editions);
        populateEditionSelect(editions);
    } catch (error) {
        console.error('Error loading editions:', error);
    }
}

function populateEditionSelect(editions) {
    console.log('Populating edition select');
    const select = document.getElementById('sscEditionSelect');
    if (!select) {
        console.error('Edition select element not found');
        return;
    }
    
    select.innerHTML = '<option value="">Select SSC Edition</option>';
    editions.forEach(edition => {
        const option = document.createElement('option');
        option.value = edition;
        option.textContent = `SSC${edition}`;
        select.appendChild(option);
    });

    // Remove previous event listener if exists
    select.removeEventListener('change', handleEditionChange);
    // Add new event listener
    select.addEventListener('change', handleEditionChange);
    console.log('Edition select populated and event listener attached');
}

function handleEditionChange(event) {
    const selectedEdition = event.target.value;
    console.log('Edition changed to:', selectedEdition);
    
    // Get all menu items with data-view attribute
    const songVotesMenu = document.querySelector('.menu-item[data-view="song-votes"]');
    const weeklySummaryMenu = document.querySelector('.menu-item[data-view="weekly-summary"]');
    
    console.log('Menu items found:', {
        songVotes: songVotesMenu,
        weeklySummary: weeklySummaryMenu
    });

    if (selectedEdition) {
        if (songVotesMenu) {
            songVotesMenu.style.display = 'block';
            console.log('Song votes menu displayed');
        }
        if (weeklySummaryMenu) {
            weeklySummaryMenu.style.display = 'block';
            console.log('Weekly summary menu displayed');
        }
    }
    
    loadEditionData(event);
}
async function loadEditionData(event) {
    const edition = event.target.value;
    if (!edition) return;

    const editionConfig = window.CSV_MANIFEST.getEditionConfig(parseInt(edition));
    if (!editionConfig) {
        console.error(`No config found for edition: ${edition}`);
        return;
    }

    const files = editionConfig.files;
    if (!files) {
        console.error('No files configured for edition', edition);
        return;
    }

    const csvPath = `${window.location.origin}/rules/assets/csv`;

    try {
        const [submissionsResponse, votesResponse] = await Promise.all([
            fetch(`${csvPath}/${files.submissions}`),
            fetch(`${csvPath}/${files.votes}`)
        ]);

        const submissionsText = await submissionsResponse.text();
        const votesText = await votesResponse.text();

        // Parse submissions using existing parser
        window.submissions = parseSubmissionsCSV(submissionsText);

        // Parse and normalize votes according to edition config
        const rawVotes = parseVotesCSV(votesText, editionConfig);
        window.rawVotes = rawVotes;

        // Provide normalized canonical votes for the rest of the app while preserving backwards compatibility
        // canonical fields: id, songName, stage, pointsRaw, bonusPoints, pointsFinal, numVoters, avgPoints, weeklyRank, result, votes12..votes1
        window.votes = rawVotes; // keep old API; objects are canonical
// Normalize legacy/compat fields so UI filters work reliably.
// Ensure every vote has both `stage` and `pointsFinal` populated.
if (window.votes && Array.isArray(window.votes)) {
    window.votes.forEach(v => {
        // stage fallback: stage <- week <- stageLabel
        v.stage = (v.stage || v.week || v.stageLabel || '').toString();

        // pointsFinal fallback: prefer existing pointsFinal, otherwise use points + bonusPoints (or numeric points)
        const parseNum = x => {
            if (x === undefined || x === null || x === '') return 0;
            const n = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };

        if (v.pointsFinal === undefined || v.pointsFinal === null || v.pointsFinal === '') {
            const rawPoints = parseNum(v.points);
            const bonus = parseNum(v.bonusPoints);
            v.pointsFinal = rawPoints + bonus;
        }

        // ensure points also exists as numeric string for legacy code paths
        if (v.points === undefined || v.points === null) {
            v.points = String(v.pointsFinal || 0);
        }
    });
}

        // Determine weeks/stages for UI
        const weeks = getWeeksFromVotes(window.votes, editionConfig);

        initializeSelects(weeks);
        initializeMenu();

        // Reset views and selectors
        const songSelectEl = document.getElementById('songSelect');
        const weekSelectEl = document.getElementById('weekSelect');
        const summaryWeekSelectEl = document.getElementById('summaryWeekSelect');

        if (songSelectEl) songSelectEl.value = '';
        if (weekSelectEl) weekSelectEl.value = '';
        if (summaryWeekSelectEl) summaryWeekSelectEl.value = '';

        const statsContainer = document.querySelector('.stats-container');
        if (statsContainer) statsContainer.style.display = 'none';

        if (window.chart) {
            window.chart.destroy();
            window.chart = null;
        }

        console.log(`Loaded and normalized edition SSC${edition}`, {
            totalSongs: window.votes.length,
            weeks
        });
    } catch (error) {
        console.error('Error loading edition data:', error);
    }
}
function parseSubmissionsCSV(csv) {
    const lines = csv.split('\n');
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',');
        result.push({
            songTitle: values[4],
            sunoUsername: values[3],
            songUrl: values[5]
        });
    }
    
    return result;
}

function parseVotesCSV(csv, editionConfig = {}) {
    // Flexible votes parser + normalizer
    // Produces canonical vote objects with fields:
    // id, songName, stage, pointsRaw, bonusPoints, pointsFinal,
    // votes12..votes1, numVoters, avgPoints, weeklyRank, result, _rawRow
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length <= 1) return [];

    // Detect header row
    const headerParts = lines[0].split(',');
    const hasHeader = headerParts.some(h => /song|title|week|points|vote/i.test(h));

    const rows = hasHeader ? lines.slice(1) : lines.slice(1);
    const result = [];

    // Legacy index map fallback
    const legacyMap = {
        id: 0,
        songName: 1,
        week: 2,
        points: 3,
        votes12: 4,
        votes10: 5,
        votes8: 6,
        votes7: 7,
        votes6: 8,
        votes5: 9,
        votes4: 10,
        votes3: 11,
        votes2: 12,
        votes1: 13,
        numVoters: 14,
        avgPoints: 15,
        weeklyRank: 16,
        result: 17
    };

    const colMap = (editionConfig && editionConfig.columnMap) ? editionConfig.columnMap : legacyMap;
    const bonusCfg = editionConfig?.rules?.bonusHandling || { enabled: false };

    const parseNum = v => {
        if (v === undefined || v === null || v === '') return 0;
        const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        return isNaN(n) ? 0 : n;
    };

    for (let i = 0; i < rows.length; i++) {
        const line = rows[i];
        const values = line.split(',');

        const getByIndexOrName = (key) => {
            const idx = colMap[key];
            if (typeof idx === 'number' && values[idx] !== undefined) return values[idx];
            if (hasHeader) {
                const headerIndex = headerParts.findIndex(h => new RegExp(key, 'i').test(h));
                if (headerIndex >= 0) return values[headerIndex];
            }
            return undefined;
        };

        const id = getByIndexOrName('id') ?? (i + 1).toString();
        const songName = (getByIndexOrName('songName') || getByIndexOrName('song_title') || '').trim();
        const stageLabel = (getByIndexOrName('stageLabel') || getByIndexOrName('week') || getByIndexOrName('stage') || '').trim();
        const pointsRawStr = getByIndexOrName('pointsRaw') || getByIndexOrName('points') || '0';

        const votes12 = getByIndexOrName('votes12') || '0';
        const votes10 = getByIndexOrName('votes10') || '0';
        const votes8 = getByIndexOrName('votes8') || '0';
        const votes7 = getByIndexOrName('votes7') || '0';
        const votes6 = getByIndexOrName('votes6') || '0';
        const votes5 = getByIndexOrName('votes5') || '0';
        const votes4 = getByIndexOrName('votes4') || '0';
        const votes3 = getByIndexOrName('votes3') || '0';
        const votes2 = getByIndexOrName('votes2') || '0';
        const votes1 = getByIndexOrName('votes1') || '0';

        const numVoters = getByIndexOrName('numVoters') || getByIndexOrName('voters') || '0';
        const avgPoints = getByIndexOrName('avgPoints') || '0';
        const weeklyRank = getByIndexOrName('weeklyRank') || '';
        const resultFlag = (getByIndexOrName('result') || '').trim();

        const pointsRaw = parseNum(pointsRawStr);

        // Bonus handling
        let bonusPoints = 0;
        if (bonusCfg?.enabled) {
            if (typeof colMap.bonusPoints === 'number' && values[colMap.bonusPoints] !== undefined) {
                bonusPoints = parseNum(values[colMap.bonusPoints]);
            } else if (hasHeader) {
                const bonusIdx = headerParts.findIndex(h => /bonus/i.test(h));
                if (bonusIdx >= 0) bonusPoints = parseNum(values[bonusIdx]);
            }
        }

        const pointsFinal = bonusCfg?.pointsIncludeBonus ? pointsRaw : (pointsRaw + (bonusPoints || 0));

        const canonical = {
            id: String(id),
            songName: songName,
            stage: stageLabel || '',        // canonical stage/week label
            pointsRaw: pointsRaw,
            bonusPoints: bonusPoints,
            pointsFinal: pointsFinal,
            votes12: parseNum(votes12),
            votes10: parseNum(votes10),
            votes8: parseNum(votes8),
            votes7: parseNum(votes7),
            votes6: parseNum(votes6),
            votes5: parseNum(votes5),
            votes4: parseNum(votes4),
            votes3: parseNum(votes3),
            votes2: parseNum(votes2),
            votes1: parseNum(votes1),
            numVoters: parseNum(numVoters),
            avgPoints: parseFloat(avgPoints) || 0,
            weeklyRank: weeklyRank,
            result: resultFlag,
            _rawRow: values
        };

        result.push(canonical);
    }

    console.log('Parsed and normalized votes data (preview):', result.slice(0,5));
    return result;
}

/* Legacy parseVotesCSV removed.
   The canonical, flexible parser defined earlier in this file produces normalized
   vote objects with `stage` and `pointsFinal` fields. The old, legacy parser
   would overwrite that function and return objects without the canonical fields,
   causing filtering by stage/pointsFinal to fail. Keeping a note here for history.
*/

/* NOTE: This function was duplicated earlier in the file. The active loadEditionData
   implementation is defined above. This duplicate has been removed to avoid conflicts. */

function updateSongSelect() {
    const weekSelect = document.getElementById('weekSelect');
    const songSelect = document.getElementById('songSelect');
    const selectedWeek = weekSelect.value;

    console.log('Updating songs for week:', selectedWeek);
    console.log('Available votes data:', window.votes);
    
    songSelect.innerHTML = '<option value="">Select Song</option>';

    if (selectedWeek && window.votes) {
        const weekSongs = window.votes.filter(s => String(s.stage) === String(selectedWeek));
        console.log('Filtered songs for week:', weekSongs);
        
        weekSongs.sort((a, b) => parseInt(b.pointsFinal) - parseInt(a.pointsFinal));
        
        weekSongs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.songName;
            option.textContent = `${song.songName} (${song.pointsFinal} points)`;
            songSelect.appendChild(option);
            console.log('Added song:', song.songName);
        });
    }
}

// Make updateSongSelect globally available
window.updateSongSelect = updateSongSelect;

function initializeWeekListeners() {
    const weekSelect = document.getElementById('weekSelect');
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    
    // Song votes view listener
    weekSelect.addEventListener('change', (e) => {
        console.log('Week selection changed:', e.target.value);
        const weekSongs = window.votes.filter(v => v.stage === e.target.value);
        console.log('Found songs:', weekSongs.length, weekSongs);
        
        const songSelect = document.getElementById('songSelect');
        songSelect.innerHTML = '<option value="">Select Song</option>';
        
        weekSongs
            .sort((a, b) => parseInt(b.pointsFinal) - parseInt(a.pointsFinal))
            .forEach(song => {
                const option = document.createElement('option');
                option.value = song.songName;
                option.textContent = `${song.songName} (${song.pointsFinal} pts)`;
                songSelect.appendChild(option);
            });
    });

    // Weekly summary view listener
    summaryWeekSelect.addEventListener('change', (e) => {
        const selectedWeek = e.target.value;
        console.log('Summary week changed:', selectedWeek);
        
        if (selectedWeek && window.votes) {
            const weekVotes = window.votes.filter(v => String(v.stage) === String(selectedWeek));
            console.log('Found votes for summary:', weekVotes.length, weekVotes);
            
            // Update podium and chart in a single call
            handleWeeklySummaryUpdate(weekVotes, selectedWeek);
        }
    });

    // Add song selection listener
    const songSelect = document.getElementById('songSelect');
    songSelect.addEventListener('change', async (e) => {
        const selectedSong = e.target.value;
        const selectedWeek = weekSelect.value;
        
        if (selectedSong && selectedWeek) {
            const songData = window.votes.find(v =>
                v.songName === selectedSong &&
                v.stage === selectedWeek
            );
            const submissionData = window.submissions.find(s =>
                s.songTitle === selectedSong
            );
            
            if (songData && submissionData) {
                // Update stats display
                document.querySelector('.stats-container').style.display = 'grid';
                
                // Update song info
                document.getElementById('SongName').innerHTML =
                    `<a href="${submissionData.songUrl}" target="_blank">${songData.songName}</a>`;
                document.getElementById('sunoArtist').textContent = submissionData.sunoUsername;
                document.getElementById('averageScore').textContent = songData.avgPoints;
                document.getElementById('totalVoters').textContent = songData.numVoters;
                document.getElementById('totalPoints').textContent = songData.pointsFinal;
                document.getElementById('weeklyRank').textContent = songData.weeklyRank;
                
                // Create/update audio player and visualizer
                await updateAudioPlayer(submissionData.songUrl);
                
                // Update vote distribution chart
                updateChart(songData);
            }
        }
    });
}

async function updateAudioPlayer(songUrl) {
    const songId = getSongIdFromUrl(songUrl);
    if (!songId) return;
    
    let audioPlayer = document.getElementById('songPlayer');
    if (!audioPlayer) {
        audioPlayer = createStyledAudioPlayer();
        document.querySelector('.song-group').appendChild(audioPlayer);
    }
    
    audioPlayer.src = `https://cdn1.suno.ai/${songId}.mp3`;
    
    // Create audio visualizer
    if (!document.querySelector('.visualizer')) {
        createAudioVisualizer(audioPlayer);
    }
    
    // Add cover art
    const songInfo = await getSongInfo(songId);
    if (songInfo) {
        const existingImg = document.querySelector('.song-group img');
        if (existingImg) existingImg.remove();
        
        const imgElement = document.createElement('img');
        imgElement.src = songInfo.imageUrl;
        imgElement.style.width = '100%';
        imgElement.style.height = 'auto';
        imgElement.style.borderRadius = '8px';
        imgElement.style.marginBottom = '15px';
        imgElement.style.objectFit = 'cover';
        
        document.querySelector('.song-group').insertBefore(
            imgElement, 
            document.querySelector('.song-card')
        );
    }
}
/**
 * Determine ordered weeks/stages for UI based on votes data and optional editionConfig.
 * - If editionConfig.orderedStages exists, expand it (bunks, sequential weeks, single labels).
 * - Otherwise infer order from the data, preferring "Bunk A..", "Showcase N", "Track Save", "2nd-chance", "Finals".
 */
function getWeeksFromVotes(votesData, editionConfig = {}) {
    // Simplified: derive unique stage labels from votesData and return them
    // in a sensible order. Ignore editionConfig for now to avoid mismatches.
    if (!Array.isArray(votesData)) return [];

    const stages = [...new Set(votesData.map(v => (v.stage ?? v.week ?? v.stageLabel ?? '').toString()).filter(Boolean))];

    // Separate numeric and non-numeric
    const numeric = stages.filter(s => !isNaN(s)).map(Number).sort((a, b) => a - b).map(String);
    const alphas = stages.filter(s => isNaN(s));

    // Preferred ordering heuristics for alpha labels
    const bunkRegex = /^bunk\s*([A-Za-z])$/i;
    const showcaseRegex = /showcase\s*(\d+)/i;

    const bunks = alphas.filter(s => bunkRegex.test(s)).sort((a, b) => {
        const ma = a.match(bunkRegex)[1].toUpperCase();
        const mb = b.match(bunkRegex)[1].toUpperCase();
        return ma.localeCompare(mb);
    });

    const showcases = alphas.filter(s => showcaseRegex.test(s)).sort((a, b) => {
        const na = parseInt(a.match(showcaseRegex)[1], 10);
        const nb = parseInt(b.match(showcaseRegex)[1], 10);
        return na - nb;
    });

    const trackSaves = alphas.filter(s => /track\s*save/i.test(s));
    const secondChances = alphas.filter(s => /2nd|second\s*chance/i.test(s));
    const finals = alphas.filter(s => /final/i.test(s));

    const remaining = alphas.filter(s => ![...bunks, ...showcases, ...trackSaves, ...secondChances, ...finals].includes(s)).sort();

    return [...numeric, ...bunks, ...showcases, ...trackSaves, ...secondChances, ...finals, ...remaining];
}

function initializeSelects(weeks) {
    const weekSelect = document.getElementById('weekSelect');
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    
    weekSelect.innerHTML = '<option value="">Select Week</option>';
    summaryWeekSelect.innerHTML = '<option value="">Select Week</option>';
    
    console.log('initializeSelects called with weeks:', weeks);
    
    // Fallback: if weeks is empty, derive from window.votes
    let effectiveWeeks = weeks;
    if (!effectiveWeeks || !Array.isArray(effectiveWeeks) || effectiveWeeks.length === 0) {
        console.warn('initializeSelects: received empty weeks; deriving from window.votes');
        effectiveWeeks = [...new Set((window.votes || []).map(v => (v.stage ?? v.week ?? v.stageLabel ?? '').toString()).filter(Boolean))];
    }
    
    console.log('initializeSelects effectiveWeeks:', effectiveWeeks);
    
    effectiveWeeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = isNaN(week) ? week : `Week ${week}`;
        
        weekSelect.appendChild(option.cloneNode(true));
        summaryWeekSelect.appendChild(option.cloneNode(true));
    });
}

async function tryPatterns(basePath, patterns) {
    for (const pattern of patterns) {
        try {
            const response = await fetch(`${basePath}${pattern}`);
            if (response.ok) return response;
        } catch (e) {
            continue;
        }
    }
    throw new Error('No matching file found');
}

function populateEditionSelect(editions) {
    const select = document.getElementById('sscEditionSelect');
    console.log('Setting up edition select with:', editions);
    
    select.innerHTML = '<option value="">Select SSC Edition</option>';
    editions.forEach(edition => {
        const option = document.createElement('option');
        option.value = edition;
        option.textContent = `SSC${edition}`;
        select.appendChild(option);
    });

    select.addEventListener('change', handleEditionSelection);
    console.log('Edition select initialized');
}

function handleEditionSelection(event) {
    const edition = event.target.value;
    console.log('Edition selected:', edition);
    
    // Show menu items
    document.querySelectorAll('.menu-item[data-view]').forEach(item => {
        item.style.display = edition ? 'block' : 'none';
    });
    
    // Hide readme view when edition is selected
    const readmeView = document.getElementById('readme-view');
    if (readmeView) {
        readmeView.style.display = edition ? 'none' : 'block';
    }
    
    if (edition) {
        loadEditionData(event);
    }
}

function updateWeeklySummary(selectedWeek) {
    const podiumSection = document.querySelector('.top-songs-podium');
    podiumSection.style.display = selectedWeek ? 'block' : 'none';
    
    if (selectedWeek && window.votes) {
        const weekVotes = window.votes.filter(v => String(v.stage) === String(selectedWeek));
        console.log('Processing votes for weekly summary:', weekVotes.length);
        
        handleWeeklySummaryUpdate(weekVotes, selectedWeek);
    }
}

function handleWeeklySummaryUpdate(weekVotes, selectedWeek) {
    // Clear previous chart
    if (window.chart) {
        window.chart.destroy();
        window.chart = null;
    }
    
    // Sort votes once
    const sortedVotes = weekVotes.sort((a, b) => parseInt(b.pointsFinal) - parseInt(a.pointsFinal));
    console.log('Sorted votes for display:', sortedVotes);
    
    // Single call to update podium
    updatePodium(sortedVotes);
    
    // Create new chart
    const ctx = document.getElementById('weekSummaryChart').getContext('2d');
    updateWeeklySummaryChart(sortedVotes, selectedWeek, ctx);
}

// Make updateWeeklySummary globally availablewindow.updateWeeklySummary = updateWeeklySummary;window.updateWeeklySummary = updateWeeklySummary;

function updateWeeklySummaryChart(sortedVotes, selectedWeek, ctx) {
    const chartCanvas = document.getElementById('weekSummaryChart');
    if (!chartCanvas) {
        console.error('updateWeeklySummaryChart: canvas element with id "weekSummaryChart" not found');
        return;
    }

    // Only set a sensible default height if none is defined.
    if (!chartCanvas.style.height) chartCanvas.style.height = '600px';

    // Destroy previous chart instance if present
    if (window.chart) {
        try { window.chart.destroy(); } catch (e) { /* ignore */ }
        window.chart = null;
    }

    console.log('Creating chart with votes:', Array.isArray(sortedVotes) ? sortedVotes.length : 0);

    // Robust numeric parsing for points (accept numbers, numeric-strings, or fallbacks)
    const parseNum = v => {
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? 0 : n;
    };

    const safeVotes = Array.isArray(sortedVotes) ? sortedVotes : [];
    const dataPoints = safeVotes.map(v => parseNum(v?.pointsFinal ?? v?.points));
    const labels = safeVotes.map(v => v?.songName ?? '');

    console.log('Chart dataPoints sample (first 10):', dataPoints.slice(0, 10));
    console.log('Chart labels sample (first 10):', labels.slice(0, 10));
    console.log('Canvas offset size:', chartCanvas.offsetWidth, chartCanvas.offsetHeight, 'computed height:', window.getComputedStyle(chartCanvas).height);

    // Use passed context if provided (handleWeeklySummaryUpdate passes ctx), otherwise get from canvas
    const context = ctx || chartCanvas.getContext('2d');
    if (!context) {
        console.error('Unable to obtain 2D context for weekSummaryChart');
        return;
    }

    // Create Chart.js instance with initial data (may be empty).
    // Use the canvas element itself as the first argument (some Chart.js builds
    // perform better when given the element instead of a 2D context).
    window.chart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            // Start with the labels/data we computed. We'll re-assign explicitly
            // after creation to guard against Chart.js clearing behaviour.
            labels: labels,
            datasets: [{
                label: 'Total Points',
                data: dataPoints,
                backgroundColor: 'rgba(90, 30, 90, 0.95)',
                borderColor: 'rgba(90, 30, 90, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: { duration: 300 },
            layout: {
                padding: { left: 15, right: 15, top: 20, bottom: 20 }
            },
            scales: {
                y: {
                    ticks: { color: '#ffffff', font: { size: 14, weight: 'bold' }, padding: 10 },
                    grid: { color: 'rgba(255,255,255,.15)' }
                },
                x: {
                    ticks: { color: '#ffffff', font: { size: 14, weight: 'bold' } },
                    grid: { color: 'rgba(255,255,255,.15)' }
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `${selectedWeek} Points Distribution`,
                    color: '#ffffff',
                    font: { size: 18, weight: 'bold' }
                }
            }
        }
    });

    // Immediately (synchronously) re-assign the chart data to ensure nothing in Chart.js
    // runtime overwrites/clears it. Then force an update.
    try {
        if (window.chart) {
            window.chart.data.labels = labels;
            window.chart.data.datasets = [{
                label: 'Total Points',
                data: dataPoints,
                backgroundColor: 'rgba(90, 30, 90, 0.95)',
                borderColor: 'rgba(90, 30, 90, 1)',
                borderWidth: 1
            }];
            window.chart.update();
            console.log('Assigned chart.labels/data synchronously; lengths:', window.chart.data.labels.length, window.chart.data.datasets[0].data.length);
        }
    } catch (e) {
        console.warn('Synchronous chart assignment failed:', e);
    }

    // Defensive fallback: if Chart.js ended up with empty labels/data, set them explicitly and force an update.
    try {
        const hasEmptyData = (Array.isArray(window.chart.data.labels) && window.chart.data.labels.length === 0)
            || (Array.isArray(window.chart.data.datasets?.[0]?.data) && window.chart.data.datasets[0].data.length === 0);

        if (hasEmptyData && dataPoints.length > 0) {
            console.warn('Chart initialized with empty data — applying fallback assignment and forcing update.');
            window.chart.data.labels = labels;
            if (!window.chart.data.datasets) window.chart.data.datasets = [{ label: 'Total Points', data: [] }];
            window.chart.data.datasets[0].data = dataPoints;
            // Ensure visible dataset
            if (typeof window.chart.setDatasetVisibility === 'function') {
                try { window.chart.setDatasetVisibility(0, true); } catch (e) {}
            }
            window.chart.update();
            console.log('Fallback chart update applied. labels/data lengths:', window.chart.data.labels.length, window.chart.data.datasets[0].data.length);
        } else {
            window.chart.update();
        }
    } catch (e) {
        console.warn('chart.update() or fallback assignment failed:', e);
    }

    // Extra fallback: re-assign labels/data on the next tick if Chart.js clears them asynchronously.
    setTimeout(() => {
        if (!window.chart) return;
        try {
            const currentLabelsLen = Array.isArray(window.chart.data.labels) ? window.chart.data.labels.length : 0;
            const currentDataLen = Array.isArray(window.chart.data.datasets?.[0]?.data) ? window.chart.data.datasets[0].data.length : 0;
            if ((currentLabelsLen === 0 || currentDataLen === 0) && dataPoints.length > 0) {
                console.warn('Applying setTimeout fallback to populate chart data');
                window.chart.data.labels = labels;
                if (!window.chart.data.datasets) window.chart.data.datasets = [{ label: 'Total Points', data: [] }];
                window.chart.data.datasets[0].data = dataPoints;
                try { window.chart.update(); } catch (e) { console.warn('setTimeout chart.update failed', e); }
                console.log('setTimeout fallback applied. labels/data lengths now:', window.chart.data.labels.length, window.chart.data.datasets[0].data.length);
            }
        } catch (e) {
            console.warn('setTimeout fallback failed:', e);
        }
    }, 50);
}
