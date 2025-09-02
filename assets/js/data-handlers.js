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

        if (window.weekChart) {
            window.weekChart.destroy();
            window.weekChart = null;
        }

        console.log(`Loaded and normalized edition SSC${edition}`, {
            totalSongs: window.votes.length,
            weeks
        });
    } catch (error) {
        console.error('Error loading edition data:', error);
    }
}
function parseCSV(text) {
    // Minimal, robust CSV parser that handles:
    // - quoted fields (")
    // - double-quoted quotes ("")
    // - CRLF or LF line endings
    // Returns array of rows, each row is array of column values (strings, unquoted).
    const rows = [];
    if (text === undefined || text === null) return rows;
    const len = text.length;
    let i = 0;
    let cur = '';
    let row = [];
    let inQuotes = false;

    while (i < len) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                // Lookahead for double quote escape
                if (i + 1 < len && text[i + 1] === '"') {
                    cur += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = false;
                    i++;
                    continue;
                }
            } else {
                cur += ch;
                i++;
                continue;
            }
        }

        // Not in quotes
        if (ch === '"') {
            inQuotes = true;
            i++;
            continue;
        }

        if (ch === ',') {
            row.push(cur);
            cur = '';
            i++;
            continue;
        }

        // Handle CRLF or LF line breaks
        if (ch === '\r') {
            // If CRLF, skip next LF
            if (i + 1 < len && text[i + 1] === '\n') i++;
            row.push(cur);
            rows.push(row);
            row = [];
            cur = '';
            i++;
            continue;
        }

        if (ch === '\n') {
            row.push(cur);
            rows.push(row);
            row = [];
            cur = '';
            i++;
            continue;
        }

        cur += ch;
        i++;
    }

    // Push any remaining value
    if (inQuotes) {
        // unterminated quote - still push what we have
        row.push(cur);
        rows.push(row);
    } else {
        if (cur !== '' || row.length > 0) {
            row.push(cur);
            rows.push(row);
        }
    }

    return rows;
}

function parseSubmissionsCSV(csv) {
    // Use the robust CSV parser to correctly handle quoted fields and commas inside fields.
    const rows = parseCSV(csv);
    const result = [];

    if (!rows || rows.length <= 1) return result;

    // Header is rows[0]; data starts from rows[1]
    for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        if (!values || values.length === 0) continue;
        // Defensive: trim all values
        for (let j = 0; j < values.length; j++) {
            if (typeof values[j] === 'string') values[j] = values[j].trim();
        }

        // Determine column indices using the header row when available (handles SSC6 vs SSC7 differences)
        // Fallback to sensible index guesses when header names aren't present.
        const headerRow = rows[0] || [];
        const headerLower = headerRow.map(h => (h || '').toString().toLowerCase());
        let songTitleIndex = headerLower.findIndex(h => /(^|\b)song\b.*\btitle\b|^song\s*title$|^title$/i.test(h));
        if (songTitleIndex === -1) {
            // try looser match for "song title" or "song"
            songTitleIndex = headerLower.findIndex(h => /\bsong\b/i.test(h));
        }
        let sunoIndex = headerLower.findIndex(h => /suno/i.test(h) || /suno username/i.test(h));
        // If header detection failed, fall back to common index patterns:
        if (songTitleIndex === -1 && sunoIndex === -1) {
            // SSC6 style: index 3 = Suno username, 4 = Song title
            // SSC7 style: index 3 = Song title, 4 = Suno username
            // Choose by inspecting which field looks like a URL in index 5 etc.
            songTitleIndex = (values[4] && values[4].toString().trim() !== '') ? 4 : 3;
            sunoIndex = (songTitleIndex === 4) ? 3 : 4;
        } else {
            if (songTitleIndex === -1) songTitleIndex = (sunoIndex === 4 ? 3 : 4);
            if (sunoIndex === -1) sunoIndex = (songTitleIndex === 4 ? 3 : 4);
        }
        const songTitle = (values[songTitleIndex] || '').toString().trim();
        const sunoUsername = (values[sunoIndex] || '').toString().trim();
        const songUrl = (values[5] || values[6] || '').toString().trim();

        // Only include if we have a song title
        if (songTitle) {
            result.push({
                songTitle,
                sunoUsername,
                songUrl
            });
        }
    }

    return result;
}

/* Helper: normalize song titles for matching (strip trailing bracketed/parenthesized suffixes like "[SSC7, USA]" or "(SSC7 USA)") */
function normalizeSongTitle(title) {
    if (!title && title !== 0) return '';
    // Coerce and trim
    let t = String(title).trim();

    // Normalize smart quotes/dashes to ASCII equivalents
    t = t.replace(/[“”„‟"]/g, '"').replace(/[‘’‛']/g, "'").replace(/[\u2013\u2014]/g, '-');

    // Remove only trailing bracketed or parenthesized suffixes (safer than removing from first '[' or '(')
    // e.g. "What Am I Doing? [SSC7, United States]" -> "What Am I Doing?"
    //       "Strange Creek (SSC7 USA)" -> "Strange Creek"
    t = t.replace(/\s*\[[^\]]*\]\s*$/g, '');
    t = t.replace(/\s*\([^\)]*\)\s*$/g, '');

    // Remove surrounding quotes/apostrophes
    t = t.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');

    // Unicode normalize and strip diacritics
    try {
        t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
        // ignore if normalize not supported
    }

    // Remove punctuation except letters, numbers, spaces, apostrophes and hyphens
    // This keeps contractions and hyphenated words but strips stray commas/colons/brackets/etc.
    t = t.replace(/[^\p{L}\p{N}\s'-]+/gu, '');

    // Collapse repeated whitespace and lowercase for robust comparison
    t = t.replace(/\s+/g, ' ').trim().toLowerCase();

    return t;
}

/* Helper: compute small edit distance (Levenshtein) for fuzzy fallback */
function levenshtein(a, b) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const matrix = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) matrix[i][0] = i;
    for (let j = 0; j <= bl; j++) matrix[0][j] = j;
    for (let i = 1; i <= al; i++) {
        for (let j = 1; j <= bl; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[al][bl];
}

/* Helper: find a submission by song name using normalized comparison with fallbacks:
   1) exact normalized equality
   2) normalized substring (one contains the other)
   3) fuzzy Levenshtein distance (small threshold)
*/
function findSubmissionBySongName(songName) {
    if (!Array.isArray(window.submissions) || !songName) return undefined;
    const norm = normalizeSongTitle(songName);

    // Exact match first
    let match = window.submissions.find(s => normalizeSongTitle(s.songTitle) === norm);
    if (match) return match;

    // Substring match (handle small formatting differences)
    match = window.submissions.find(s => {
        const sn = normalizeSongTitle(s.songTitle);
        return sn.includes(norm) || norm.includes(sn);
    });
    if (match) return match;

    // Fuzzy fallback: allow small edit distance relative to length
    let best = null;
    let bestScore = Infinity;
    for (const s of window.submissions) {
        const sn = normalizeSongTitle(s.songTitle);
        if (!sn) continue;
        const dist = levenshtein(norm, sn);
        const rel = dist / Math.max(1, Math.max(norm.length, sn.length));
        if (rel < 0.18 && dist < bestScore) { // threshold: ~18% difference or small absolute diff
            best = s;
            bestScore = dist;
        }
    }
    if (best) return best;

    return undefined;
}

// Expose helper globally so other modules can use it
window.findSubmissionBySongName = findSubmissionBySongName;

function parseVotesCSV(csv, editionConfig = {}) {
    // Use robust CSV parsing to avoid splitting on commas inside quoted fields.
    const parsed = parseCSV(csv);
    if (!parsed || parsed.length <= 1) return [];

    const headerParts = parsed[0].map(h => (h || '').toString());
    const hasHeader = headerParts.some(h => /song|title|week|points|vote|# of voters|avg/i.test(h));

    const rows = hasHeader ? parsed.slice(1) : parsed.slice(1);
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

    const parseNum = v => {
        if (v === undefined || v === null || v === '') return 0;
        const s = String(v).trim().replace(/\u00A0/g, '').replace(/\s+/g, '');
        // Support comma decimal in avgPoints elsewhere; here we strip non-digit for counts
        const n = parseInt(s.replace(/[^0-9-]/g, ''), 10);
        return isNaN(n) ? 0 : n;
    };

    const parseFloatSafe = v => {
        if (v === undefined || v === null || v === '') return 0;
        const s = String(v).trim().replace(/\u00A0/g, '').replace(/\s+/g, '');
        // Accept commas as decimal separators (e.g., "7,26")
        const normalized = s.indexOf(',') > -1 && s.indexOf('.') === -1 ? s.replace(',', '.') : s;
        const f = parseFloat(normalized.replace(/[^0-9.\-]/g, ''));
        return isNaN(f) ? 0 : f;
    };

    // Helper to match header names loosely
    const findHeaderIndex = (pattern) => {
        const re = new RegExp(pattern, 'i');
        for (let i = 0; i < headerParts.length; i++) {
            if (re.test(headerParts[i])) return i;
            // Also allow exact numeric header match for votes columns like "12","10"
            if (String(headerParts[i]).trim() === String(pattern).trim()) return i;
        }
        return -1;
    };

    for (let r = 0; r < rows.length; r++) {
        const values = rows[r] || [];

        const getByIndexOrName = (key) => {
            const idx = colMap && (colMap[key] !== undefined) ? colMap[key] : undefined;
            if (typeof idx === 'number' && values[idx] !== undefined) return values[idx];
            if (hasHeader) {
                // Try a few sensible header matches based on common key names
                const common = {
                    songName: '(song|title)',
                    song_title: '(song|title)',
                    stageLabel: '(stage|week|group)',
                    week: '(stage|week|group)',
                    stage: '(stage|week|group)',
                    pointsRaw: '(points|total|pts)',
                    points: '(points|total|pts)',
                    votes12: '(?:^12$|\\b12\\b|12)',
                    votes10: '(?:^10$|\\b10\\b|10)',
                    votes8: '(?:^8$|\\b8\\b|8)',
                    votes7: '(?:^7$|\\b7\\b|7)',
                    votes6: '(?:^6$|\\b6\\b|6)',
                    votes5: '(?:^5$|\\b5\\b|5)',
                    votes4: '(?:^4$|\\b4\\b|4)',
                    votes3: '(?:^3$|\\b3\\b|3)',
                    votes2: '(?:^2$|\\b2\\b|2)',
                    votes1: '(?:^1$|\\b1\\b|1)',
                    numVoters: '(# of voters|num of voters|voters|# voters|numvoters)',
                    avgPoints: '(avg|average|avg points)',
                    weeklyRank: '(weekly rank|weeklyrank|rank)',
                    result: '(result|status)'
                };
                const pattern = common[key] || key;
                const headerIndex = findHeaderIndex(pattern);
                if (headerIndex >= 0 && values[headerIndex] !== undefined) return values[headerIndex];
            }
            return undefined;
        };

        const idVal = getByIndexOrName('id');
        const id = idVal !== undefined ? String(idVal) : String(r + 1);

        const songNameRaw = getByIndexOrName('songName') ?? getByIndexOrName('song_title') ?? getByIndexOrName('Song name') ?? '';
        const songName = String(songNameRaw).trim();

        const stageLabelRaw = getByIndexOrName('stageLabel') ?? getByIndexOrName('week') ?? getByIndexOrName('stage') ?? '';
        const stageLabel = String(stageLabelRaw).trim();

        const pointsRawStr = getByIndexOrName('pointsRaw') ?? getByIndexOrName('points') ?? '0';

        const votes12 = getByIndexOrName('votes12') ?? '0';
        const votes10 = getByIndexOrName('votes10') ?? '0';
        const votes8 = getByIndexOrName('votes8') ?? '0';
        const votes7 = getByIndexOrName('votes7') ?? '0';
        const votes6 = getByIndexOrName('votes6') ?? '0';
        const votes5 = getByIndexOrName('votes5') ?? '0';
        const votes4 = getByIndexOrName('votes4') ?? '0';
        const votes3 = getByIndexOrName('votes3') ?? '0';
        const votes2 = getByIndexOrName('votes2') ?? '0';
        const votes1 = getByIndexOrName('votes1') ?? '0';

        const numVotersRaw = getByIndexOrName('numVoters') ?? getByIndexOrName('voters') ?? '0';
        const avgPointsRaw = getByIndexOrName('avgPoints') ?? '0';
        const weeklyRank = getByIndexOrName('weeklyRank') ?? '';
        const resultFlag = (getByIndexOrName('result') || '').toString().trim();

        const pointsRaw = parseNum(pointsRawStr);

        // Bonus handling (auto-detected).
        let bonusPoints = 0;
        let bonusColumnIndex = undefined;
        if (typeof colMap.bonusPoints === 'number') {
            bonusColumnIndex = colMap.bonusPoints;
        } else if (hasHeader) {
            const bonusIdx = headerParts.findIndex(h => /bonus/i.test(h));
            if (bonusIdx >= 0) bonusColumnIndex = bonusIdx;
        }
        if (typeof bonusColumnIndex === 'number' && values[bonusColumnIndex] !== undefined) {
            bonusPoints = parseNum(values[bonusColumnIndex]);
        }

        const pointsFinal = pointsRaw + (bonusPoints || 0);

        const canonical = {
            id: String(id),
            songName: songName,
            stage: stageLabel || '',
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
            numVoters: parseNum(numVotersRaw),
            avgPoints: parseFloatSafe(avgPointsRaw),
            weeklyRank: weeklyRank,
            result: resultFlag,
            _rawRow: values
        };

        result.push(canonical);
    }

    console.log('Parsed and normalized votes data (preview):', result.slice(0, 5));
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
            const submissionData = (typeof window.findSubmissionBySongName === 'function')
                ? window.findSubmissionBySongName(selectedSong)
                : undefined;
            
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
                
                // Bonus: show separate bonus points card if present and non-zero
                try {
                    const bonus = (songData.bonusPoints ?? songData.bonus_points ?? 0);
                    const bonusCard = document.getElementById('bonusPointsCard');
                    const bonusEl = document.getElementById('bonusPoints');
                    if (bonusCard && bonusEl) {
                        if (Number(bonus) && Number(bonus) !== 0) {
                            bonusEl.textContent = String(bonus);
                            bonusCard.style.display = ''; // show card
                        } else {
                            bonusEl.textContent = '-';
                            bonusCard.style.display = 'none';
                        }
                    }
                } catch (e) {
                    console.warn('Failed to render bonus points', e);
                }
                
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
    // Robust week/stage derivation with sanitization to avoid stray CSV artifacts
    if (!Array.isArray(votesData)) return [];

    // Extract raw stage candidates from canonical fields
    const raw = votesData
        .map(v => (v.stage ?? v.week ?? v.stageLabel ?? ''))
        .map(s => (s === undefined || s === null) ? '' : String(s))
        .map(s => s.trim())
        .filter(Boolean);

    // Cleaning routine to remove common CSV/field artifacts like trailing ]", [SSC7 fragments, extra quotes, etc.
    const cleanLabel = (s) => {
        if (!s) return '';
        let t = String(s).trim();

        // Remove surrounding quotes
        t = t.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');

        // Remove trailing bracket+quote patterns e.g. `]"`
        t = t.replace(/\]\s*"*$/g, '').replace(/\]\s*'*$/g, '');

        // Remove common [SSC7] or similar markers which belong on song titles not stage labels
        t = t.replace(/\[SSC\d*\]/gi, '');
        t = t.replace(/\[SSC\d*/gi, '');
        t = t.replace(/\[.*?SSC\d*.*?\]/gi, '');

        // Replace multiple spaces/tabs/newlines with single space
        t = t.replace(/\s+/g, ' ').trim();

        return t;
    };

    const stages = [...new Set(raw.map(cleanLabel).filter(Boolean))];
 
    // Separate numeric and non-numeric
    const numeric = stages
        .filter(s => !isNaN(s))
        .map(Number)
        .sort((a, b) => a - b)
        .map(String);
 
    const alphas = stages.filter(s => isNaN(s));
 
    // Preferred ordering heuristics for alpha labels
    const bunkRegex = /^bunk\s*([A-Za-z0-9]+)$/i;
    const showcaseRegex = /showcase\s*(\d+)/i;
 
    const bunks = alphas.filter(s => bunkRegex.test(s)).sort((a, b) => {
        const ma = (a.match(bunkRegex) || [null, a])[1].toString().toUpperCase();
        const mb = (b.match(bunkRegex) || [null, b])[1].toString().toUpperCase();
        return ma.localeCompare(mb);
    });
 
    const showcases = alphas.filter(s => showcaseRegex.test(s)).sort((a, b) => {
        const ma = a.match(showcaseRegex);
        const mb = b.match(showcaseRegex);
        const na = ma ? parseInt(ma[1], 10) : 0;
        const nb = mb ? parseInt(mb[1], 10) : 0;
        return na - nb;
    });
 
    const trackSaves = alphas.filter(s => /track\s*save/i.test(s) || /tracksave/i.test(s));
    const secondChances = alphas.filter(s => /2nd|second\s*chance|2nd-?chance/i.test(s));
    const finals = alphas.filter(s => /final/i.test(s));
 
    // If editionConfig provides an orderedStages array, use it to generate the alpha ordering.
    if (editionConfig && Array.isArray(editionConfig.orderedStages) && editionConfig.orderedStages.length > 0) {
        const obsSet = new Set(alphas.map(a => a.toLowerCase()));
        const ordered = [];
 
        const normalizeForMatch = (s) => String(s || '').trim().toLowerCase();
 
        for (const entry of editionConfig.orderedStages) {
            if (!entry || !entry.type) continue;
            if (entry.type === 'bunk') {
                const groups = entry.groups || 0;
                const prefix = entry.groupPrefix || 'Group ';
                for (let i = 0; i < groups; i++) {
                    const label = `${prefix}${String.fromCharCode(65 + i)}`; // A,B,C...
                    if (obsSet.has(normalizeForMatch(label))) ordered.push(label);
                }
            } else if (entry.type === 'sequential') {
                const weeksCount = entry.weeks || 0;
                const prefix = entry.weekPrefix || (entry.label || 'Showcase ');
                for (let i = 1; i <= weeksCount; i++) {
                    const label = `${prefix}${i}`;
                    if (obsSet.has(normalizeForMatch(label))) ordered.push(label);
                }
            } else if (entry.type === 'single') {
                const label = entry.labelValue || entry.label || (entry.id || '');
                if (label && obsSet.has(normalizeForMatch(label))) ordered.push(label);
            } else {
                // Fallback: treat entry.label as literal
                const label = entry.label || '';
                if (label && obsSet.has(normalizeForMatch(label))) ordered.push(label);
            }
        }
 
        // Remaining alpha labels not covered by manifest ordering
        const remaining = alphas.filter(s => !ordered.map(x => normalizeForMatch(x)).includes(normalizeForMatch(s))).sort();
 
        // Final order: numeric weeks + manifest ordered alphas + remaining
        return [...numeric, ...ordered, ...remaining];
    }
 
    // Default fallback ordering (when no manifest ordering provided):
    // Keep bunks/showcases near the top, then remaining labels, then track-save / 2nd-chance / finals
    const prioritizedStart = [...bunks, ...showcases];
    const tail = [...trackSaves, ...secondChances, ...finals];
 
    // Remaining labels not matched above (exclude both prioritizedStart and tail)
    const remaining = alphas.filter(s => ![...prioritizedStart, ...tail].includes(s)).sort();
 
    // Final order: numeric weeks, bunks/showcases, remaining labels, then track-save / 2nd-chance / finals
    return [...numeric, ...prioritizedStart, ...remaining, ...tail];
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
    if (window.weekChart) {
        window.weekChart.destroy();
        window.weekChart = null;
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

    // Compute chart height based on number of bars to avoid excessive blank space.
    // Approx 40px per row + padding; clamp between 400px and 1200px.
    const itemCount = Array.isArray(sortedVotes) ? sortedVotes.length : 0;
    const computed = Math.max(400, Math.min(40 * itemCount + 200, 1200));
    chartCanvas.style.height = `${computed}px`;

    // Destroy previous chart instance if present
    if (window.weekChart) {
        try { window.weekChart.destroy(); } catch (e) { /* ignore */ }
        window.weekChart = null;
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
    window.weekChart = new Chart(chartCanvas, {
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
        if (window.weekChart) {
            window.weekChart.data.labels = labels;
            window.weekChart.data.datasets = [{
                label: 'Total Points',
                data: dataPoints,
                backgroundColor: 'rgba(90, 30, 90, 0.95)',
                borderColor: 'rgba(90, 30, 90, 1)',
                borderWidth: 1
            }];
            window.weekChart.update();
            console.log('Assigned chart.labels/data synchronously; lengths:', window.weekChart.data.labels.length, window.weekChart.data.datasets[0].data.length);
        }
    } catch (e) {
        console.warn('Synchronous chart assignment failed:', e);
    }

    // Defensive fallback: if Chart.js ended up with empty labels/data, set them explicitly and force an update.
    try {
        const hasEmptyData = (Array.isArray(window.weekChart.data.labels) && window.weekChart.data.labels.length === 0)
            || (Array.isArray(window.weekChart.data.datasets?.[0]?.data) && window.weekChart.data.datasets[0].data.length === 0);

        if (hasEmptyData && dataPoints.length > 0) {
            console.warn('Chart initialized with empty data — applying fallback assignment and forcing update.');
            window.weekChart.data.labels = labels;
            if (!window.weekChart.data.datasets) window.weekChart.data.datasets = [{ label: 'Total Points', data: [] }];
            window.weekChart.data.datasets[0].data = dataPoints;
            // Ensure visible dataset
            if (typeof window.weekChart.setDatasetVisibility === 'function') {
                try { window.weekChart.setDatasetVisibility(0, true); } catch (e) {}
            }
            window.weekChart.update();
            console.log('Fallback chart update applied. labels/data lengths:', window.weekChart.data.labels.length, window.weekChart.data.datasets[0].data.length);
        } else {
            window.weekChart.update();
        }
    } catch (e) {
        console.warn('chart.update() or fallback assignment failed:', e);
    }

    // Extra fallback: re-assign labels/data on the next tick if Chart.js clears them asynchronously.
    setTimeout(() => {
        if (!window.weekChart) return;
        try {
            const currentLabelsLen = Array.isArray(window.weekChart.data.labels) ? window.weekChart.data.labels.length : 0;
            const currentDataLen = Array.isArray(window.weekChart.data.datasets?.[0]?.data) ? window.weekChart.data.datasets[0].data.length : 0;
            if ((currentLabelsLen === 0 || currentDataLen === 0) && dataPoints.length > 0) {
                console.warn('Applying setTimeout fallback to populate chart data');
                window.weekChart.data.labels = labels;
                if (!window.weekChart.data.datasets) window.weekChart.data.datasets = [{ label: 'Total Points', data: [] }];
                window.weekChart.data.datasets[0].data = dataPoints;
                try { window.weekChart.update(); } catch (e) { console.warn('setTimeout chart.update failed', e); }
                console.log('setTimeout fallback applied. labels/data lengths now:', window.weekChart.data.labels.length, window.weekChart.data.datasets[0].data.length);
            }
        } catch (e) {
            console.warn('setTimeout fallback failed:', e);
        }
    }, 50);
}
