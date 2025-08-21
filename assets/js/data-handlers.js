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

function parseVotesCSV(csv) {
    const lines = csv.split('\n');
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',');
        result.push({
            id: values[0],
            songName: values[1],
            week: values[2],
            points: values[3],
            votes12: values[4],
            votes10: values[5],
            votes8: values[6],
            votes7: values[7],
            votes6: values[8],
            votes5: values[9],
            votes4: values[10],
            votes3: values[11],
            votes2: values[12],
            votes1: values[13],
            numVoters: values[14],
            avgPoints: values[15],
            weeklyRank: values[16],
            result: values[17]  // Add this line
        });
    }

    return result;
}

function getWeeksFromVotes(votesData) {
    // Get unique week values
    const weeks = new Set(votesData.map(vote => vote.week));
    console.log('Detected weeks:', [...weeks]);
}    
function parseVotesCSV(csv) {
    const lines = csv.split('\n');
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',');
        result.push({
            id: values[0],
            songName: values[1],
            week: values[2],         // Week is in the third column
            points: values[3],
            votes12: values[4],
            votes10: values[5],
            votes8: values[6],
            votes7: values[7],
            votes6: values[8],
            votes5: values[9],
            votes4: values[10],
            votes3: values[11],
            votes2: values[12],
            votes1: values[13],
            numVoters: values[14],
            avgPoints: values[15],
            weeklyRank: values[16],
            result: values[17]
        });
    }
    console.log('Parsed votes data:', result);
    return result;
}

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
function getWeeksFromVotes(votesData) {
    // Get unique week values
    const weeks = new Set(votesData.map(vote => vote.week));
    console.log('Detected weeks:', [...weeks]);
    
    // Filter and sort numeric weeks
    const numericWeeks = [...weeks]
        .filter(week => !isNaN(week))
        .map(Number)
        .sort((a, b) => a - b);
    
    // Add special weeks in correct order
    if (weeks.has('2nd-chance')) numericWeeks.push('2nd-chance');
    if (weeks.has('Finals')) numericWeeks.push('Finals');
    
    return numericWeeks;
}

function initializeSelects(weeks) {
    const weekSelect = document.getElementById('weekSelect');
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    
    weekSelect.innerHTML = '<option value="">Select Week</option>';
    summaryWeekSelect.innerHTML = '<option value="">Select Week</option>';
    
    weeks.forEach(week => {
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

function updateWeeklySummaryChart(sortedVotes, selectedWeek) {
    const chartCanvas = document.getElementById('weekSummaryChart');
    chartCanvas.style.height = '1200px';
    
    if (window.chart) {
        window.chart.destroy();
    }
    
    console.log('Creating chart with votes:', sortedVotes.length);
    
    const ctx = chartCanvas.getContext('2d');
    window.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedVotes.map(v => v.songName),
            datasets: [{
                label: 'Total Points',
                data: sortedVotes.map(v => parseInt(v.pointsFinal)),
                backgroundColor: 'rgba(90, 30, 90, 0.6)',
                borderColor: 'rgba(90, 30, 90, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            layout: {
                padding: {
                    left: 15,
                    right: 15,
                    top: 20,
                    bottom: 20
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#ffffff',
                        font: { size: 14, weight: 'bold' },
                        padding: 10
                    },
                    grid: {
                        color: 'rgba(255,255,255,.15)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(255,255,255,.15)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Week ${selectedWeek} Points Distribution`,
                    color: '#ffffff',
                    font: { size: 18, weight: 'bold' }
                }
            }
        }
    });
}
