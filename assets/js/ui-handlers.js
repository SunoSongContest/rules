// First define the function
function setupMenuHandlers() {
    const menuItems = document.querySelectorAll('.menu-item[data-view]');
    console.log('Setting up menu handlers for items:', menuItems.length);
    
    menuItems.forEach(item => {
        // Initially hide menu items
        item.style.display = 'none';
        
        item.addEventListener('click', () => {
            console.log('Menu item clicked:', item.dataset.view);
            toggleViews(item.dataset.view);
        });
    });
}

function toggleViews(selectedView) {
    const views = {
        readme: document.getElementById('readme-view'),
        songVotes: document.getElementById('song-votes-view'),
        weeklySummary: document.getElementById('weekly-summary-view')
    };
    
    // Hide all views
    Object.values(views).forEach(view => {
        if (view) view.style.display = 'none';
    });
    
    // Show selected view
    const viewToShow = selectedView === 'song-votes' ? views.songVotes : 
                      selectedView === 'weekly-summary' ? views.weeklySummary : 
                      views.readme;
    
    if (viewToShow) viewToShow.style.display = 'block';
}

function initializeMenu() {
    console.log('Initializing menu...');
    const songVotesView = document.getElementById('song-votes-view');
    const weeklySummaryView = document.getElementById('weekly-summary-view');
    const readmeView = document.getElementById('readme-view');
    
    console.log('Views found:', {
        songVotesView,
        weeklySummaryView,
        readmeView
    });

    const menuItems = document.querySelectorAll('.menu-item[data-view]');
    console.log('Menu items found:', menuItems.length);

    // Show readme by default
    if (readmeView) {
        readmeView.style.display = 'block';
        songVotesView.style.display = 'none';
        weeklySummaryView.style.display = 'none';
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            console.log('Menu item clicked:', view);
            
            // Update menu item states
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Update view visibility
            if (readmeView) readmeView.style.display = 'none';
            songVotesView.style.display = view === 'song-votes' ? 'block' : 'none';
            weeklySummaryView.style.display = view === 'weekly-summary' ? 'block' : 'none';
        });
    });
}

// Export for use in visualization.js
window.setupMenuHandlers = setupMenuHandlers;

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

function initializeSelects(weeks) {
    const weekSelect = document.getElementById('weekSelect');
    const summaryWeekSelect = document.getElementById('summaryWeekSelect');
    
    weekSelect.innerHTML = '<option value="">Select Week</option>';
    summaryWeekSelect.innerHTML = '<option value="">Select Week</option>';
    
    // Use the weeks array passed from data-handlers.js (derived from edition-config or data)
    if (weeks && Array.isArray(weeks)) {
        weeks.forEach(week => {
            const option = document.createElement('option');
            option.value = week;
            option.textContent = isNaN(week) ? week : `Week ${week}`;
            
            weekSelect.appendChild(option.cloneNode(true));
            summaryWeekSelect.appendChild(option.cloneNode(true));
        });
    }

    // Add all event listeners in one place
    weekSelect.addEventListener('change', updateSongSelect);
    document.getElementById('songSelect').addEventListener('change', updateVisualization);
    document.getElementById('summaryWeekSelect').addEventListener('change', updateWeeklySummary);
}

function updateSongSelect() {
    const weekSelect = document.getElementById('weekSelect');
    const songSelect = document.getElementById('songSelect');
    const selectedWeek = weekSelect ? weekSelect.value : '';

    console.log('UI-handlers.updateSongSelect called for week:', selectedWeek);
    songSelect.innerHTML = '<option value="">Select Song</option>';

    if (selectedWeek && Array.isArray(window.votes)) {
        // Use the same normalization routine as data-handlers to avoid mismatched labels
        // (normalizeStageLabel is defined in data-handlers.js and available globally).
        const target = (typeof normalizeStageLabel === 'function') ? normalizeStageLabel(selectedWeek) : String(selectedWeek).trim().toLowerCase();

        const weekSongs = window.votes.filter(s => {
            const ns = (typeof normalizeStageLabel === 'function')
                ? (normalizeStageLabel(s.stage) || normalizeStageLabel(s.week) || normalizeStageLabel(s.stageLabel))
                : ((String(s.stage || s.week || s.stageLabel || '')).trim().toLowerCase());
            // Ensure we only include songs that actually belong to the selected normalized stage
            // and have a positive pointsFinal value.
            return ns === target && Number(s.pointsFinal || s.points || 0) > 0;
        });

        console.log('UI-handlers.filtered weekSongs count:', weekSongs.length);

        weekSongs.sort((a, b) => Number(b.pointsFinal || b.points || 0) - Number(a.pointsFinal || a.points || 0));

        weekSongs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.songName;
            option.textContent = `${song.songName} (${song.pointsFinal || song.points || 0} points)`;
            songSelect.appendChild(option);
        });
    }
}