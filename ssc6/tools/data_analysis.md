---
layout:
title: Votes visualization
permalink: /ssc6/tools/data-analysis/
parenturl: /ssc6/
emoji: 🔬
order: 1
short_description: Inspect SSC6 weeks' data with an analyzation tool made by @spupuz
classname: page
tag: tool
---

<style>
    .finals-podium {
        display: flex;
        flex-direction: column;
        gap: 3rem;
        padding: 2rem;
    }

    .winners-row {
        display: grid;
        grid-template-columns: 1fr 1.2fr 1fr;
        gap: 2rem;
        align-items: flex-end;
    }

    .bbn-row {
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid var(--primary-color);
        text-align: center;
    }

    .podium-item-large {
        transform: scale(1.2);
    }

    .podium-item-medium {
        transform: scale(1);
    }
    .container {
        max-width: 1200px;
        margin: 0 auto;
        background: var(--secondary-color);
        padding: 2rem;
        border-radius: 15px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
        text-align: center;
        color: var(--text-color);
        margin-bottom: 2rem;
    }

    .controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    select {
        padding: 0.8rem;
        border: 2px solid var(--primary-color);
        border-radius: 8px;
        font-size: 1rem;
        background: var(--secondary-color);
        color: var(--text-color);
        cursor: pointer;
        transition: all 0.3s ease;
    }

    select:hover {
        border-color: rgb(90,30,90);
    }
    .stats-container {
        display: grid;
        grid-template-columns: 300px 1fr; /* Narrower left column */
        gap: 2rem;
        max-width: 1000px; /* Limit overall width */
        margin: 0 auto 2rem; /* Center the container */
    }
    .song-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
    }
    .song-group img {
        width: 250px; /* Smaller cover art */
        height: 250px;
        margin: 0 auto; /* Center image */
        display: block;
        border: 8px solid rgb(90,30,90); /* Added thick border */
        box-sizing: border-box;
    }
    .song-card {
        flex-grow: 0;
        }
    .stats-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
    .stat-card {
        background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
        color: white;
        padding: 1rem;
        border-radius: 10px;
        text-align: center;
    }
    .stat-card h3 {
        margin: 0;
        font-size: 1.2rem; /* Larger font */
        opacity: 0.9;
    }
    .stat-card p {
        margin: 0.5rem 0 0;
        font-size: 2rem; /* Larger font */
        font-weight: 600;
    }
    /* Add these styles for the chart */
    canvas#votesChart {
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
    }
    .chart-container {
        position: relative;
        height: 400px;
        margin-top: 2rem;
    }
    /* Add these styles for the chart */
    canvas#votesChart {
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
    }
    @media (max-width: 768px) {
        .controls {
            grid-template-columns: 1fr;
        }
        
        .stats-container {
            grid-template-columns: 1fr;
        }
        
        .stats-group {
            grid-template-columns: 1fr;
        }
    }
    .stats {
        grid-template-columns: 1fr;
    }
    .visualizer {
        width: 100%;
        height: 60px;
        border-radius: 8px;
        margin-top: 10px;
        background: rgb(248, 249, 250);
    }
    #SongName a, #SongName a:visited {
        color: var(--text-color);
        text-decoration: none;
    }
    .podium-artist {
        font-size: 1rem;
        color: #cccccc;
        margin: 0.2rem 0;
    }
    :root {

    /* Existing styles... */

    #readme-view {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        line-height: 1.6;
        color: var(--text-color);
    }

    #readme-view h1 {
        text-align: center;
        margin-bottom: 2rem;
    }

    #readme-view h2 {
        margin: 2rem 0 1rem;
    }

    #readme-view ul {
        list-style-type: disc;
        margin-left: 2rem;
        margin-bottom: 1.5rem;
    }

    #readme-view li {
        margin-bottom: 0.5rem;
    }

    #readme-view code {
        background: rgba(255, 255, 255, 0.1);
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
    }
        --primary-color: #5a1e5a;
        --secondary-color: #191919;
        --background-color: #1a1a1a;
        --text-color: #ffffff;
    }
    body {
        font-family: 'Poppins', sans-serif;
        background-image: url('{{ "/assets/img/header_bg.png" | prepend: site.baseurl }}');
        background-repeat: repeat;
        background-attachment: fixed;
        background-size: cover;
        background-color: var(--background-color); /* Fallback color */
        margin: 0;
        padding: 20px;
        color: var(--text-color);
    }
    .container {
        max-width: 1200px;
        margin: 0 auto;
        background: var(--secondary-color);
        padding: 2rem;
        border-radius: 15px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
        text-align: center;
        color: var(--text-color);
        margin-bottom: 2rem;
    }

    .controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 2rem;
    }
      #sscEditionSelect {
          margin: 10px 20px;
          width: calc(100% - 40px);
          background: var(--secondary-color);
          color: var(--text-color);
          border: 2px solid var(--primary-color);
          border-radius: 8px;
          padding: 8px;
      }

      #sscEditionSelect:hover {
          border-color: rgb(90,30,90);
      }
    .stats-container {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 1rem;
        margin-bottom: 2rem;
    }
        .song-group {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            width: 100%;
        }
        .song-group img {
            display: block;
            width: 100%;
            aspect-ratio: 1/1;
            object-fit: cover;
        }
        .song-card {
            flex-grow: 0;
        }
    .stats-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }

    .stat-card {
        background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
        color: white;
        padding: 1rem;
        border-radius: 10px;
        text-align: center;
    }

    .stat-card h3 {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.9;
    }

    .stat-card p {
        margin: 0.5rem 0 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .chart-container {
        position: relative;
        height: 400px;
        margin-top: 2rem;
    }

    #weekly-summary-view .chart-container {
        height: 1500px; /* Increased from previous height */
    }

    @media (max-width: 768px) {
        .controls {
            grid-template-columns: 1fr;
        }
        
        .stats-container {
            grid-template-columns: 1fr;
        }
        
        .stats-group {
            grid-template-columns: 1fr;
        }
    }
        .stats {
            grid-template-columns: 1fr;
        }
    }

    .side-menu {
        position: fixed;
        left: 0;
        top: 0;
        height: 100%;
        width: 200px;
        background: var(--secondary-color);
        padding: 20px 0;
    }

    .menu-item {
        padding: 15px 20px;
        cursor: pointer;
        color: var(--text-color);
        transition: background-color 0.3s;
    }

    .menu-item:hover {
        background: var(--primary-color);
    }

    .menu-item.active {
        background: var(--primary-color);
    }
    .menu-toggle {
            display: none;
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            cursor: pointer;
        }
    
        .hamburger {
            width: 30px;
            height: 25px;
            position: relative;
        }
    
        .hamburger span {
            display: block;
            position: absolute;
            height: 3px;
            width: 100%;
            background: var(--text-color);
            border-radius: 3px;
            transition: 0.25s ease-in-out;
        }
    
        .hamburger span:nth-child(1) { top: 0; }
        .hamburger span:nth-child(2) { top: 10px; }
        .hamburger span:nth-child(3) { top: 20px; }
    
        /* Mobile menu states */
        .menu-open .hamburger span:nth-child(1) {
            top: 10px;
            transform: rotate(45deg);
        }
        
        .menu-open .hamburger span:nth-child(2) {
            opacity: 0;
        }
        
        .menu-open .hamburger span:nth-child(3) {
            top: 10px;
            transform: rotate(-45deg);
        }
    
        @media (max-width: 768px) {
            .menu-toggle {
                display: block;
            }
    
            .side-menu {
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }
    
            .side-menu.open {
                transform: translateX(0);
            }
    
            .container {
                padding-top: 60px;
            }
        }
        .side-menu {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh; /* Full viewport height */
            width: 200px;
            background: var(--secondary-color);
            padding: 20px 0;
            z-index: 100;
            display: flex;          /* Add these */
            flex-direction: column; /* for flex layout */
        }

        .container {
            margin-left: 220px;
            max-width: calc(100% - 240px);
        }

        @media (max-width: 768px) {
            .side-menu {
                position: relative;
                width: 100%;
                height: auto;
            }
            
            .container {
                margin-left: 0;
                max-width: 100%;
            }
        }
        .visualizer {            width: 100%;
            height: 60px;
            border-radius: 8px;
            margin-top: 10px;
            background: rgb(248, 249, 250);
        }
        #SongName a, #SongName a:visited {
            color: var(--text-color);
            text-decoration: none;
        }
    .top-songs-podium {
            max-width: 1200px;
            margin: 2rem auto;
        }
    
        .podium-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 2rem;
            padding: 1rem;
            margin-bottom: 2rem;
        }
        .podium-item a {
            color: var(--text-color);
            text-decoration: none;
        }

        .podium-item a:hover {
            text-decoration: underline;
        }

        .podium-item img:hover {
            transform: scale(1.05);
            transition: transform 0.2s ease;
        }
        .podium-item {
            text-align: center;
        }
    
        .podium-item img {
            width: 150px;
            height: 150px;
            object-fit: cover;
            border: 8px solid var(--primary-color);
            border-radius: 8px;
        }
    
        .podium-rank {
            font-size: 1.5rem;
            font-weight: bold;
            color: gold;
            margin: 1rem 0;
        }
    
        .podium-points {
            font-size: 1.2rem;
            color: white;
        }

        .podium-section {
            margin-bottom: 3rem;
        }

        .second-chance-podium {
            /* Smaller scale for 2nd chance songs */
            transform: scale(0.8);
            transform-origin: top center;
            opacity: 0.9;
        }

        .second-chance-podium .podium-item img {
            width: 120px;
            height: 120px;
        }

        .second-chance-podium .podium-rank {
            font-size: 1.6rem;
        }

        .second-chance-podium .podium-points {
            font-size: 1rem;
        }

        .podium-winners {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            gap: 2rem;
            align-items: flex-end;
            margin: 2rem 0;
        }

        .podium-item-large {
            transform: scale(1.2);
        }

        .podium-item-medium {
            transform: scale(1);
        }

        .podium-item-small {
            transform: scale(0.8);
        }

        .bbn-section {
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 2px solid var(--primary-color);
        }

        .copyright {
            margin-top: auto;   /* Push to bottom */
            padding: 20px 10px;
            width: 100%;
            text-align: center;
            font-size: 0.8rem;
            color: var(--text-color);
            opacity: 0.7;
        }
        .menu-item.hidden {
            display: none;
        }

</style>
<div class="menu-toggle">
    <div class="hamburger">
        <span></span>
        <span></span>
        <span></span>
    </div>
</div>
<div class="side-menu">
    <a class="menu-item" href="{{ site.baseurl }}">
        <span>Back to homepage</span>
    </a>
    <select id="sscEditionSelect" class="menu-item">
        <option value="">Select SSC Edition</option>
    </select>
    <div class="menu-item" data-view="song-votes" style="display: none;">
        <span>Song Votes</span>
    </div>
    <div class="menu-item" data-view="weekly-summary" style="display: none;">
        <span>Weekly Summary</span>
    </div>
    <div class="copyright">
        © SSC & spupuz
    </div>
</div>
<div class="container">
    <div id="readme-view" style="display: block;">
        <!-- README content will be loaded here -->
    </div>
    <div id="song-votes-view" style="display: none;">
        <h1>🎶 SSC Votes Visualization</h1>
        <div class="controls">
            <select id="weekSelect">
                <option value="">Select Week</option>
            </select>
            <select id="songSelect">
                <option value="">Select Song</option>
            </select>
        </div>
        <div class="stats-container" style="display: none;">
            <div class="song-group">
                <div class="stat-card song-card">
                    <h3>Song Name</h3>
                    <p id="SongName">-</p>
                </div>
                <!-- Audio player will be inserted here by JavaScript -->
            </div>
            <div class="stats-group">
                <div class="stat-card">
                    <h3>Suno Artist</h3>
                    <p id="sunoArtist">-</p>
                </div>
                <div class="stat-card">
                    <h3>Average Score</h3>
                    <p id="averageScore">-</p>
                </div>
                <div class="stat-card">
                    <h3>Total Voters</h3>
                    <p id="totalVoters">-</p>
                </div>
                <div class="stat-card">
                    <h3>Total Points</h3>
                    <p id="totalPoints">-</p>
                </div>
                <div class="stat-card" id="bonusPointsCard" style="display: none;">
                    <h3>Bonus Points</h3>
                    <p id="bonusPoints">-</p>
                </div>
                <div class="stat-card">
                    <h3>Weekly Rank</h3>
                    <p id="weeklyRank">-</p>
                </div>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="votesChart"></canvas>
        </div>
    </div>
    <div id="weekly-summary-view" style="display: none;">
        <h1>🎶 Weekly Voting Summary</h1>
        <select id="summaryWeekSelect">
            <option value="">Select Week</option>
        </select>
        <div class="top-songs-podium" style="display: none;">
            <div class="podium-section">
                <h2 class="finalists-title" style="display: none;">Finalists</h2>
                <div class="podium-container finalists-podium"></div>
            </div>
            <div class="podium-section second-chance-section" style="display: none;">
                <h2 class="second-chance-title" style="display: none;">Second Chance</h2>
                <div class="podium-container second-chance-podium"></div>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="weekSummaryChart"></canvas>
        </div>
    </div>
</div>

<!-- Add proper script loading order with correct paths -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
    // Define base path handling
    const getBasePath = () => {
        const isGitHub = window.location.hostname.includes('github.io');
        return isGitHub ? '/rules' : '';
    };
    // Configure asset paths
    window.assetPaths = {
        csv: `${getBasePath()}/assets/csv`,
        js: `${getBasePath()}/assets/js`,
        readme: `${getBasePath()}/ssc6/tools/README.md`
    };
</script>
<!-- Add manifest before other scripts -->
<script src="{{ "/assets/js/csv-manifest.js" | prepend: site.baseurl }}"></script>
<script src="{{ "/assets/js/core.js" | prepend: site.baseurl }}"></script>
<script src="{{ "/assets/js/data-handlers.js" | prepend: site.baseurl }}"></script>
<script src="{{ "/assets/js/ui-handlers.js" | prepend: site.baseurl }}"></script>
<script src="{{ "/assets/js/visualization.js" | prepend: site.baseurl }}"></script>
<script src="{{ "/assets/js/podium.js" | prepend: site.baseurl }}"></script>
