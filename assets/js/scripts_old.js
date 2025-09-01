let votes = [];
let submissions = [];
let chart = null;
let audioContext = null;
let analyser = null;
let filenameCases = {
    submissions: null,
    votes: null
};

async function fetchData() {
    try {
        const _assetsPath = window.location.origin + '/rules/assets/csv/';
        
        // First fetch available editions
        const editions = await getAvailableEditions(_assetsPath);
        populateEditionSelect(editions);
        
        // Add event listener for edition changes
        const editionSelect = document.getElementById('sscEditionSelect');
        editionSelect.addEventListener('change', (e) => {
            // Show menu items when edition is selected
            const menuItems = document.querySelectorAll('.menu-item[data-view]');
            menuItems.forEach(item => {
                if(e.target.value) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
            loadEditionData(e);
        });
    } catch (error) {
        console.error('Error loading editions:', error);
    }
}
async function getAvailableEditions() {
    const csvPath = `${window.location.origin}/rules/assets/csv/`;
    const editions = new Set();
    
    try {
        const response = await fetch(csvPath);
        const files = await response.text();
        
        // Store the exact case pattern we find
        const sscMatch = files.match(/(?:SSC|ssc)\d+_[A-Za-z_]+\.csv/i);
        if (sscMatch) {
            const pattern = sscMatch[0];
            filenameCases.votes = pattern.includes('Votes') ? 'Votes' : 'votes';
            filenameCases.submissions = pattern.includes('Submissions') ? 'Submissions' : 'submissions';
        }

        const matches = files.match(/(?:SSC|ssc)(\d+)_/gi) || [];
        matches.forEach(match => {
            const edition = match.match(/\d+/)[0];
            editions.add(parseInt(edition));
        });

        return Array.from(editions).sort((a, b) => a - b);
    } catch(e) {
        console.warn('Directory listing failed:', e);
        return [];
    }
}

function populateEditionSelect(editions) {
    const select = document.getElementById('sscEditionSelect');
    select.innerHTML = '<option value="">Select SSC Edition</option>';
    
    editions.forEach(edition => {
        const option = document.createElement('option');
        option.value = edition;
        option.textContent = `SSC${edition}`;
        select.appendChild(option);
    });
}
async function loadEditionData(event) {
    const edition = event.target.value;
    if(!edition) return;
    
    const csvPath = `${window.location.origin}/rules/assets/csv/`;
    
    try {
        const [submissionsResponse, votesResponse] = await Promise.all([
            fetch(`${csvPath}SSC${edition}_${filenameCases.submissions}.csv`),
            fetch(`${csvPath}SSC${edition}_${filenameCases.votes}_list.csv`)
        ]);

        const submissionsText = await submissionsResponse.text();
        const votesText = await votesResponse.text();
        
        submissions = parseSubmissionsCSV(submissionsText);
        votes = parseVotesCSV(votesText);
        
        // Initialize selects after data is loaded
        initializeSelects();
        initializeMenu(); // Re-initialize menu with new data
        
        // Reset views
        document.getElementById('songSelect').value = '';
        document.getElementById('weekSelect').value = '';
        document.getElementById('summaryWeekSelect').value = '';
        
        // Clear any existing visualizations
        const statsContainer = document.querySelector('.stats-container');
        statsContainer.style.display = 'none';
        
        if(chart) {
            chart.destroy();
        }
    } catch (error) {
        console.error('Error loading edition data:', error);
    }
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

function initializeMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sideMenu = document.querySelector('.side-menu');
    
    menuToggle.addEventListener('click', () => {
        sideMenu.classList.toggle('open');
        menuToggle.classList.toggle('menu-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!sideMenu.contains(e.target) && 
            !menuToggle.contains(e.target) && 
            sideMenu.classList.contains('open')) {
            sideMenu.classList.remove('open');
            menuToggle.classList.remove('menu-open');
        }
    });

    // Close menu when clicking menu items on mobile
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sideMenu.classList.remove('open');
                menuToggle.classList.remove('menu-open');
            }
        });
    });
}

async function updatePodium(weekVotes) {
    const podiumSection = document.querySelector('.top-songs-podium');
    const finalistsPodium = document.querySelector('.finalists-podium');
    const secondChancePodium = document.querySelector('.second-chance-podium');
    const secondChanceSection = document.querySelector('.second-chance-section'); // Add this selector

    // Clear existing content
    finalistsPodium.innerHTML = '';
    secondChancePodium.innerHTML = '';

    // Sort and filter songs
    const sortedSongs = weekVotes.sort((a, b) => parseInt(b.points) - parseInt(a.points));
    const finalists = sortedSongs.filter(song => song.result && song.result.trim() === 'Finalist');
    const secondChance = sortedSongs.filter(song => song.result && song.result.trim() === '2nd Chance');

    // Hide both sections initially
    podiumSection.style.display = 'none';
    secondChanceSection.style.display = 'none';

    // Only show sections if there are entries
    if (finalists.length > 0) {
        podiumSection.style.display = 'block';
        // Create finalist podium items...
        for (let song of finalists) {
            const submission = (typeof window.findSubmissionBySongName === 'function')
                ? window.findSubmissionBySongName(song.songName)
                : submissions.find(s => s.songTitle === song.songName);
            if (!submission) continue;
          
            const songId = getSongIdFromUrl(submission.songUrl);
            const songInfo = await getSongInfo(songId).catch(err => {
                console.warn(`Failed to fetch info for song ${songId}:`, err);
                return {
                    id: songId,
                    imageUrl: 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365'
                };
            });

            const podiumItem = document.createElement('div');
            podiumItem.className = 'podium-item';
            podiumItem.innerHTML = `
                <a href="${submission.songUrl}" target="_blank">
                    <img src="${songInfo.imageUrl}" alt="${song.songName}" onerror="this.src='https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365'">
                </a>
                <div class="podium-rank"># ${song.weeklyRank}</div>
                <div class="podium-title">
                    <a href="${submission.songUrl}" target="_blank">${song.songName}</a>
                </div>
                <div class="podium-artist">by ${submission.sunoUsername}</div>
                <div class="podium-points">${song.points} points</div>
            `;
            finalistsPodium.appendChild(podiumItem);
        }
        
        // Only show second chance if there are finalists AND second chance entries
        if (secondChance.length > 0) {
            secondChanceSection.style.display = 'block';
            // Create second chance podium items...
            for (let song of secondChance) {
                const submission = (typeof window.findSubmissionBySongName === 'function')
                    ? window.findSubmissionBySongName(song.songName)
                    : submissions.find(s => s.songTitle === song.songName);
                if (!submission) continue;
                
                const songId = getSongIdFromUrl(submission.songUrl);
                    const songInfo = await getSongInfo(songId).catch(err => {
                        console.warn(`Failed to fetch info for song ${songId}:`, err);
                        return {
                            id: songId,
                            imageUrl: 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365'
                        };
                    });
            
                const podiumItem = document.createElement('div');
                podiumItem.className = 'podium-item';
                podiumItem.innerHTML = `
                    <a href="${submission.songUrl}" target="_blank">
                        <img src="${songInfo?.imageUrl || ''}" alt="${song.songName}">
                    </a>
                    <div class="podium-rank"># ${song.weeklyRank}</div>
                    <div class="podium-title">
                        <a href="${submission.songUrl}" target="_blank">${song.songName}</a>
                    </div>
                    <div class="podium-artist">by ${submission.sunoUsername}</div>
                    <div class="podium-points">${song.points} points</div>
                `;
            
                secondChancePodium.appendChild(podiumItem);
            }
        }
    }
}
function updateWeeklySummary() {
    const weekSelect = document.getElementById('summaryWeekSelect');
    const selectedWeek = weekSelect.value;
    
    // Hide podium if no week selected
    const podiumSection = document.querySelector('.top-songs-podium');
    podiumSection.style.display = selectedWeek ? 'block' : 'none';
    
    if (!selectedWeek) return;
    
    const weekVotes = votes.filter(v => v.week === selectedWeek);
    updatePodium(weekVotes);
    
    // Reset chart size before updating
    const chartCanvas = document.getElementById('weekSummaryChart');
    chartCanvas.style.height = '1200px';
    
    const sortedVotes = weekVotes.sort((a, b) => parseInt(b.points) - parseInt(a.points));
    
    const ctx = document.getElementById('weekSummaryChart').getContext('2d');
    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedVotes.map(v => v.songName),
            datasets: [{
                label: 'Total Points',
                data: sortedVotes.map(v => parseInt(v.points)),
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
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 10
                    },
                    grid: {
                        color: 'rgba(255,255,255,.15)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,.15)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Weekly Points Distribution',
                    color: '#ffffff',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            }
        }
    });
}

// Add event listener to summaryWeekSelect
document.getElementById('summaryWeekSelect').addEventListener('change', updateWeeklySummary);
// Update initializeMenu to properly handle view switching
function initializeMenu() {
    console.log('Initializing menu...');
    const menuItems = document.querySelectorAll('.menu-item[data-view]');
    console.log('Found menu items:', menuItems.length);
    const songVotesView = document.getElementById('song-votes-view');
    const weeklySummaryView = document.getElementById('weekly-summary-view');

    // Initialize summary week select with unique weeks from votes data
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    summaryWeekSelect.innerHTML = '<option value="">Select Week</option>';
    
    // Get unique weeks from votes data
    const uniqueWeeks = [...new Set(votes.map(v => v.week))].sort((a, b) => {
        // Custom sort: numeric weeks first, then '2nd-chance', then 'Finals'
        if (!isNaN(a) && !isNaN(b)) return parseInt(a) - parseInt(b);
        if (!isNaN(a)) return -1;
        if (!isNaN(b)) return 1;
        if (a === '2nd-chance') return -1;
        if (b === '2nd-chance') return 1;
        return 0;
    });

    // Populate select with all available weeks
    uniqueWeeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = isNaN(week) ? week : `Week ${week}`;
        summaryWeekSelect.appendChild(option);
    });

    // Add event listener for week selection
    summaryWeekSelect.addEventListener('change', updateWeeklySummary);

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            console.log('Menu item clicked:', item.dataset.view);
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const view = item.dataset.view;
            songVotesView.style.display = view === 'song-votes' ? 'block' : 'none';
            weeklySummaryView.style.display = view === 'weekly-summary' ? 'block' : 'none';
            
            if (view === 'weekly-summary') {
                const chartCanvas = document.getElementById('weekSummaryChart');
                chartCanvas.style.height = '1200px';
                updateWeeklySummary();
            }
        });
    });
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
function initializeSelects() {
    const weekSelect = document.getElementById('weekSelect');
    weekSelect.innerHTML = '<option value="">Select Week</option>';
    
    // Manually add weeks 1-5
    for (let week = 1; week <= 5; week++) {
        const option = document.createElement('option');
        option.value = week.toString();
        option.textContent = `Week ${week}`;
        weekSelect.appendChild(option);
    }

    weekSelect.addEventListener('change', updateSongSelect);
}

function updateSongSelect() {
    const weekSelect = document.getElementById('weekSelect');
    const songSelect = document.getElementById('songSelect');
    const selectedWeek = weekSelect.value;

    songSelect.innerHTML = '<option value="">Select Song</option>';

    if (selectedWeek) {
        const weekSongs = votes.filter(s => s.week === selectedWeek && parseInt(s.points) > 0);
        
        weekSongs.sort((a, b) => parseInt(b.points) - parseInt(a.points));
        
        weekSongs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.songName;
            option.textContent = song.songName;
            songSelect.appendChild(option);
        });
    }
}

function initializeSelects() {
    const weekSelect = document.getElementById('weekSelect');
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    
    // Clear existing options
    weekSelect.innerHTML = '<option value="">Select Week</option>';
    summaryWeekSelect.innerHTML = '<option value="">Select Week</option>';
    
    // Get unique weeks from votes data
    const uniqueWeeks = [...new Set(votes.map(v => v.week))].sort((a, b) => {
        // Custom sort: numeric weeks first, then '2nd-chance', then 'Finals'
        if (!isNaN(a) && !isNaN(b)) return parseInt(a) - parseInt(b);
        if (!isNaN(a)) return -1;
        if (!isNaN(b)) return 1;
        if (a === '2nd-chance') return -1;
        if (b === '2nd-chance') return 1;
        return 0;
    });

    // Populate both selects with all available weeks
    uniqueWeeks.forEach(week => {
        // For main week select
        const option1 = document.createElement('option');
        option1.value = week;
        option1.textContent = isNaN(week) ? week : `Week ${week}`;
        weekSelect.appendChild(option1);
        
        // For summary week select
        const option2 = document.createElement('option');
        option2.value = week;
        option2.textContent = isNaN(week) ? week : `Week ${week}`;
        summaryWeekSelect.appendChild(option2);
    });

    weekSelect.addEventListener('change', updateSongSelect);
    document.getElementById('songSelect').addEventListener('change', updateVisualization);
    summaryWeekSelect.addEventListener('change', updateWeeklySummary);
}


function getSongIdFromUrl(url) {
    const matches = url.match(/song\/([^/]+)/);
    return matches ? matches[1] : null;
}

function createStyledAudioPlayer() {
    const audioPlayer = document.createElement('audio');
    audioPlayer.id = 'songPlayer';
    audioPlayer.controls = true;
    audioPlayer.className = 'styled-player';
    audioPlayer.crossOrigin = 'anonymous';
    
    // Add CSS styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        .styled-player {
            width: 100%;
            height: 32px;
            margin: 10px 0;
        }
        
        .styled-player::-webkit-media-controls-panel {
            background-color: rgba(108, 92, 231, 0.1);
        }
        
        .styled-player::-webkit-media-controls-current-time-display,
        .styled-player::-webkit-media-controls-time-remaining-display {
            color: #6c5ce7;
        }
        
        .styled-player::-webkit-media-controls-play-button,
        .styled-player::-webkit-media-controls-mute-button {
            filter: hue-rotate(220deg);
        }
        
        .styled-player::-webkit-media-controls-timeline,
        .styled-player::-webkit-media-controls-volume-slider {
            accent-color: #6c5ce7;
        }
        
        .song-group .styled-player {
            width: 100%;
            margin: 0;
        }
    `;
    document.head.appendChild(styleSheet);
    
    return audioPlayer;
}
async function getSongInfo(songId) {
    // Define fallback images
    const localFallback = 'ssc_coverart_logo.jpeg';
    const glitchFallback = 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365';

    // List of CORS proxies to try
    const corsProxies = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://proxy.cors.sh/',
        'https://cors.bridged.cc/'
    ];

    // Try each proxy in sequence
    for (let proxy of corsProxies) {
        try {
            const url = `${proxy}${encodeURIComponent(`https://suno.com/song/${songId}?_rsc=asdf`)}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const content = await response.text();
                const imgMatch = content.match(/property="og:image" content="([^"]+)"/);
                
                if (imgMatch) {
                    return {
                        id: songId,
                        imageUrl: imgMatch[1]
                    };
                }
            }
            console.warn(`Proxy ${proxy} failed, trying next...`);
        } catch (error) {
            console.warn(`Error with proxy ${proxy}:`, error);
            continue; // Try next proxy
        }
    }

    // If all proxies fail, try local fallback
    try {
        const localResponse = await fetch(localFallback);
        if (localResponse.ok) {
            return {
                id: songId,
                imageUrl: localFallback
            };
        }
    } catch (localError) {
        console.warn('Local fallback not available:', localError);
    }

    // Use Glitch fallback as last resort
    return {
        id: songId,
        imageUrl: glitchFallback
    };
}

async function updateVisualization() {
    const songSelect = document.getElementById('songSelect');
    const weekSelect = document.getElementById('weekSelect');
    const selectedSong = songSelect.value;
    const selectedWeek = weekSelect.value;
    const statsContainer = document.querySelector('.stats-container');

    // Hide stats if no selections
    if (!selectedSong || !selectedWeek) {
        statsContainer.style.display = 'none';
        return;
    }

    // Show stats container
    statsContainer.style.display = 'grid';

    // Clear any existing images
    const existingImg = document.querySelector('.song-group img');
    if (existingImg) {
        existingImg.remove();
    }

    const songData = votes.find(v => v.songName === selectedSong && v.week === selectedWeek);
    const submissionData = (typeof window.findSubmissionBySongName === 'function')
        ? window.findSubmissionBySongName(songData && songData.songName)
        : submissions.find(s => s.songTitle === (songData && songData.songName));
    
    // Get song ID from URL
    const songId = getSongIdFromUrl(submissionData.songUrl);
    
    // Fetch additional song info including image
    if (songId) {
        const songInfo = await getSongInfo(songId);
        if (songInfo) {
            const imgElement = document.createElement('img');
            imgElement.src = songInfo.imageUrl;
            imgElement.style.width = '100%'; // Makes image full width of container
            imgElement.style.height = 'auto';
            imgElement.style.borderRadius = '8px';
            imgElement.style.marginBottom = '15px';
            imgElement.style.objectFit = 'cover';
            
            document.querySelector('.song-group').insertBefore(imgElement, document.querySelector('.song-card'));
        }
    }

    // Create or update audio player
    let audioPlayer = document.getElementById('songPlayer');
    if (!audioPlayer) {
        audioPlayer = createStyledAudioPlayer();
        document.querySelector('.song-group').appendChild(audioPlayer);
    }
    
    // Set audio source
    audioPlayer.src = `https://cdn1.suno.ai/${songId}.mp3`;

    // Create audio visualizer if it doesn't exist
    if (!document.querySelector('.visualizer')) {
        createAudioVisualizer(audioPlayer);
    }

    // Update audio player event listener
    audioPlayer.addEventListener('play', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    });

    // Update all stats
    document.getElementById('SongName').innerHTML = `<a href="${submissionData.songUrl}" target="_blank">${songData.songName}</a>`;
    document.getElementById('sunoArtist').textContent = submissionData.sunoUsername;
    document.getElementById('averageScore').textContent = songData.avgPoints;
    document.getElementById('totalVoters').textContent = songData.numVoters;
    document.getElementById('totalPoints').textContent = songData.points;
    document.getElementById('weeklyRank').textContent = songData.weeklyRank;

    // Update chart with vote distribution
    updateChart(songData);
}
// Separate chart update logic for cleaner code

function updateChart(songData) {
    const voteDistribution = [
        parseInt(songData.votes12),
        parseInt(songData.votes10),
        parseInt(songData.votes8),
        parseInt(songData.votes7),
        parseInt(songData.votes6),
        parseInt(songData.votes5),
        parseInt(songData.votes4),
        parseInt(songData.votes3),
        parseInt(songData.votes2),
        parseInt(songData.votes1)
    ];

    if (chart) {
        chart.destroy();
    }

    const ctx = document.getElementById('votesChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [12, 10, 8, 7, 6, 5, 4, 3, 2, 1],
            datasets: [{
                label: 'Number of Votes',
                data: voteDistribution,
                backgroundColor: 'rgba(90, 30, 90, 0.6)',
                borderColor: 'rgba(90, 30, 90, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,.15)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,.15)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Vote Distribution',
                    color: '#ffffff',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            }
        }
    });
}
function createAudioVisualizer(audioElement) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!analyser) {
        analyser = audioContext.createAnalyser();
        visualizerSource = audioContext.createMediaElementSource(audioElement);
        visualizerSource.connect(analyser);
        analyser.connect(audioContext.destination);
    }
    
    analyser.fftSize = 256;
    
    const canvas = document.createElement('canvas');
    canvas.className = 'visualizer';
    const ctx = canvas.getContext('2d');
    
    audioElement.parentNode.insertBefore(canvas, audioElement.nextSibling);
    
    function animate() {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        canvas.width = canvas.offsetWidth;
        canvas.height = 60;
        
        const draw = () => {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = 'rgb(26, 26, 26)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            
            for(let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2;
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, 'rgba(90, 30, 90, 0.8)');
                gradient.addColorStop(1, 'rgba(51, 51, 51, 0.6)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    }
    animate();
}
// Add these function calls at the bottom of script.js
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    initializeMobileMenu();
    initializeMenu();
});
fetchData();