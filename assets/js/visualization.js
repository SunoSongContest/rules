// Chart and visualization related code
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
async function updateVisualization() {
    const songSelect = document.getElementById('songSelect');
    const weekSelect = document.getElementById('weekSelect');
    const selectedSong = songSelect?.value;
    const selectedWeek = weekSelect?.value;
    const statsContainer = document.querySelector('.stats-container');

    // Hide stats if no selections
    if (!selectedSong || !selectedWeek) {
        if (statsContainer) statsContainer.style.display = 'none';
        return;
    }

    // Show stats container
    if (statsContainer) statsContainer.style.display = 'grid';

    // Clear any existing images
    const existingImg = document.querySelector('.song-group img');
    if (existingImg) existingImg.remove();

    // Find song by name and stage/week (support both legacy 'week' and new 'stage' field)
    const songData = window.votes.find(v =>
        v.songName === selectedSong &&
        (String(v.stage) === String(selectedWeek) || String(v.week) === String(selectedWeek))
    );

    const submissionData = window.submissions.find(s => s.songTitle === (songData && songData.songName));

    if (!songData || !submissionData) {
        console.warn('Song or submission data not found for selection:', selectedSong, selectedWeek);
        if (statsContainer) statsContainer.style.display = 'none';
        return;
    }

    // Get song ID from URL
    const songId = getSongIdFromUrl(submissionData.songUrl);

    // Fetch additional song info including image
    if (songId) {
        const songInfo = await getSongInfo(songId);
        if (songInfo) {
            const imgElement = document.createElement('img');
            imgElement.src = songInfo.imageUrl;
            imgElement.style.width = '100%';
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
    if (songId) audioPlayer.src = `https://cdn1.suno.ai/${songId}.mp3`;

    // Create audio visualizer if it doesn't exist
    if (!document.querySelector('.visualizer')) {
        createAudioVisualizer(audioPlayer);
    }

    // Update audio player event listener
    audioPlayer.addEventListener('play', () => {
        if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    });

    // Update all stats (use canonical fields)
    document.getElementById('SongName').innerHTML = `<a href="${submissionData.songUrl}" target="_blank">${songData.songName}</a>`;
    document.getElementById('sunoArtist').textContent = submissionData.sunoUsername || '-';
    document.getElementById('averageScore').textContent = songData.avgPoints ?? songData.avg_points ?? '-';
    document.getElementById('totalVoters').textContent = songData.numVoters ?? songData.num_voters ?? '-';
    document.getElementById('totalPoints').textContent = songData.pointsFinal ?? songData.points ?? '-';
    document.getElementById('weeklyRank').textContent = songData.weeklyRank ?? songData.weekly_rank ?? '-';
    
    // Bonus points: show separately when available
    try {
        const bonus = (songData.bonusPoints ?? songData.bonus_points ?? 0);
        const bonusCard = document.getElementById('bonusPointsCard');
        const bonusEl = document.getElementById('bonusPoints');
        if (bonusCard && bonusEl) {
            if (Number(bonus) && Number(bonus) !== 0) {
                bonusEl.textContent = String(bonus);
                bonusCard.style.display = ''; // default / inherit from CSS grid
            } else {
                bonusEl.textContent = '-';
                bonusCard.style.display = 'none';
            }
        }
    } catch (e) {
        // defensive: ignore if DOM elements missing
        console.warn('Failed to render bonus points', e);
    }

    // Update chart with vote distribution (chart expects votes12..votes1)
    updateChart(songData);
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
function updateWeeklySummary() {
    const weekSelect = document.getElementById('summaryWeekSelect');
    const selectedWeek = weekSelect.value;
    
    // Hide podium if no week selected
    const podiumSection = document.querySelector('.top-songs-podium');
    podiumSection.style.display = selectedWeek ? 'block' : 'none';
    
    if (!selectedWeek) return;
    
    const weekVotes = votes.filter(v => v.week === selectedWeek);
    
    // Destroy existing chart before creating new one
    if (window.chart) {
        window.chart.destroy();
    }
    
    updatePodium(weekVotes);
    
    // Reset chart size before updating
    const chartCanvas = document.getElementById('weekSummaryChart');
    chartCanvas.style.height = '1200px';
    
    const sortedVotes = weekVotes.sort((a, b) => parseInt(b.points) - parseInt(a.points));
    
    const ctx = document.getElementById('weekSummaryChart').getContext('2d');
    window.chart = new Chart(ctx, {
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
            scales: {
                y: {
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
// Add this after updateWeeklySummary function is defined
document.addEventListener('DOMContentLoaded', () => {
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    if (summaryWeekSelect) {
        summaryWeekSelect.addEventListener('change', updateWeeklySummary);
    }
});
