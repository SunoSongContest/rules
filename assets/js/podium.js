/*
 Podium display logic (normalized)

 This module expects vote objects to be in the canonical form produced by the
 normalization adapter in data-handlers.js. Canonical fields used here:
   - id
   - songName
   - stage            // e.g. '1', 'Bunk A', 'Track Save', '2nd-chance', 'Finals'
   - pointsRaw
   - bonusPoints
   - pointsFinal
   - votes12 .. votes1
   - numVoters
   - avgPoints
   - weeklyRank
   - result
   - _rawRow           // original CSV row (optional)

 Backwards compatibility:
   - If canonical fields are absent this code falls back to legacy fields:
     points, week, etc.
*/

async function updatePodium(weekVotes) {
    if (!weekVotes || weekVotes.length === 0) return;

    console.log('Updating podium with votes:', weekVotes);

    const podiumSection = document.querySelector('.top-songs-podium');
    const finalistsPodium = document.querySelector('.finalists-podium');
    const secondChancePodium = document.querySelector('.second-chance-podium');
    const secondChanceSection = document.querySelector('.second-chance-section');

    if (!podiumSection || !finalistsPodium || !secondChancePodium) {
        console.warn('Podium DOM elements missing');
        return;
    }

    // Clear existing content
    finalistsPodium.innerHTML = '';
    secondChancePodium.innerHTML = '';

    // Normalized accessor helpers
    const getPointsFinal = (v) => {
        if (v.pointsFinal !== undefined && v.pointsFinal !== null) return Number(v.pointsFinal);
        if (v.points !== undefined) return Number(v.points);
        // try legacy numeric parsing from _rawRow if present
        return 0;
    };

    const getStage = (v) => v.stage ?? v.week ?? v.stageLabel ?? '';
    const normalizeResult = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');

    // Sort by final points descending
    const sortedSongs = [...weekVotes].sort((a, b) => getPointsFinal(b) - getPointsFinal(a));
    console.log('Sorted songs:', sortedSongs.slice(0, 5));

    // Detect if this is a finals stage by inspecting stage labels or by detecting "final" results
    const stageSamples = sortedSongs.map(s => String(getStage(s)).toLowerCase());
    const isFinalsStage = stageSamples.some(s => s.includes('final'));
    const isBunkStage = stageSamples.some(s => s.toLowerCase().includes('bunk'));
    const isTrackSave = stageSamples.some(s => s.toLowerCase().includes('track'));
    const isSecondChance = stageSamples.some(s => s.includes('2nd') || s.includes('second'));

    // Helper: find by normalized result label (e.g., 'winner', '2ndplace', 'bbn')
    const findByResult = (label) => sortedSongs.find(s => normalizeResult(s.result) === normalizeResult(label));

    // Helper to create a block of finals (Winner/2nd/3rd/BBN) when in Finals stage
    if (isFinalsStage) {
        console.log('Processing Finals week');
        podiumSection.style.display = 'block';
        secondChanceSection.style.display = 'none';

        const winner = findByResult('Winner') || sortedSongs[0];
        const secondPlace = findByResult('2nd-place') || sortedSongs[1];
        const thirdPlace = findByResult('3rd-place') || sortedSongs[2];
        const bbn = findByResult('BBN');

        let finalsHTML = '<div class="finals-podium"><div class="winners-row">';

        if (secondPlace) {
            const submission = (typeof window.findSubmissionBySongName === 'function')
                ? (window.findSubmissionBySongName(secondPlace.songName) || {})
                : {};
            const songInfo = await safeGetSongInfo(submission);
            finalsHTML += createPodiumHTML(secondPlace, submission, songInfo, 'medium');
        }

        if (winner) {
            const submission = (typeof window.findSubmissionBySongName === 'function')
                ? (window.findSubmissionBySongName(winner.songName) || {})
                : {};
            const songInfo = await safeGetSongInfo(submission);
            finalsHTML += createPodiumHTML(winner, submission, songInfo, 'large');
        }

        if (thirdPlace) {
            const submission = (typeof window.findSubmissionBySongName === 'function')
                ? (window.findSubmissionBySongName(thirdPlace.songName) || {})
                : {};
            const songInfo = await safeGetSongInfo(submission);
            finalsHTML += createPodiumHTML(thirdPlace, submission, songInfo, 'medium');
        }

        finalsHTML += '</div>';

        if (bbn) {
            const submission = (typeof window.findSubmissionBySongName === 'function')
                ? (window.findSubmissionBySongName(bbn.songName) || {})
                : {};
            const songInfo = await safeGetSongInfo(submission);
            finalsHTML += `
                <div class="bbn-row">
                    <h3>Best Brand New</h3>
                    ${createPodiumHTML(bbn, submission, songInfo, 'medium')}
                </div>`;
        }

        finalsHTML += '</div>';
        finalistsPodium.innerHTML = finalsHTML;
        return;
    }

    // Regular week handling (Finalists / Second Chance / Bunk summaries)
    // We expect CSV 'result' flags to mark 'Finalist' and '2nd Chance' (or variants).
    const finalists = sortedSongs.filter(song => normalizeResult(song.result) === 'finalist' || normalizeResult(song.result) === 'finalists');
    const secondChance = sortedSongs.filter(song => normalizeResult(song.result).includes('2nd') || normalizeResult(song.result).includes('secondchance') || normalizeResult(song.result).includes('2ndchance') || normalizeResult(song.result).includes('2ndchance'));
    
    // Detect "Group" weeks (e.g., "Group A", "Group B") and apply SSC7 group advancement rules:
    // - 20 move to Showcase (or marked "Showcase")
    // - next 20 move to Track Save Week (or marked "Track save week")
    const isGroupStage = stageSamples.some(s => /\bgroup\b/i.test(s));
    const finalistsLabel = isGroupStage ? 'Showcase' : 'Finalists';
    const secondLabel = isGroupStage ? 'Track Save Week' : 'Second Chance';
    
    // If the CSV doesn't include explicit result flags, gracefully derive finalists from top N
    // (This keeps compatibility when raw CSVs just list top songs)
    const maybeDeriveFinalists = () => {
        if (finalists.length > 0) return finalists;
        // Heuristic for legacy numeric weekly shows: top 5 are finalists and 6-10 are second chance
        const legacyFinals = sortedSongs.slice(0, 5);
        return legacyFinals;
    };
    
    let usedFinalists = [];
    let usedSecondChance = [];
    
    if (isGroupStage) {
        // Prefer explicit 'Showcase' / 'Track save' result flags if present
        usedFinalists = sortedSongs.filter(s => normalizeResult(s.result).includes('showcase'));
        if (usedFinalists.length === 0) {
            // Fallback: top 20
            usedFinalists = sortedSongs.slice(0, 20);
        }
    
        usedSecondChance = sortedSongs.filter(s => normalizeResult(s.result).includes('track') || normalizeResult(s.result).includes('tracksave') || normalizeResult(s.result).includes('tracksaveweek') || normalizeResult(s.result).includes('tracksaveweek'));
        if (usedSecondChance.length === 0) {
            // Fallback: songs 21-40
            usedSecondChance = sortedSongs.slice(20, 40);
        }
    } else {
        // Non-group handling: prefer explicit flags.
        // IMPORTANT: Do NOT automatically derive ranks 6-10 as "Second Chance" when the CSV
        // does not include explicit result flags. Only show explicit Second Chance entries.
        usedFinalists = finalists.length > 0 ? finalists : maybeDeriveFinalists();
        usedSecondChance = secondChance.length > 0 ? secondChance : [];
    }
    
    console.log('Regular week songs:', { usedFinalistsCount: usedFinalists.length, usedSecondChanceCount: usedSecondChance.length, isGroupStage });
    
    if (usedFinalists.length > 0) {
        podiumSection.style.display = 'block';
        let finalistsHTML = `<div class="podium-section"><h2 class="finalists-title">${finalistsLabel}</h2><div class="podium-container">`;
    
        // Insert placeholders first to avoid fetching many images synchronously.
        // We'll asynchronously populate images after inserting the DOM nodes.
        for (const song of usedFinalists) {
            const submission = (typeof window.findSubmissionBySongName === 'function')
                ? (window.findSubmissionBySongName(song.songName) || {})
                : {};
            const safeSubmission = submission || {};
            // Use placeholder image; songInfo will be populated asynchronously below.
            const placeholder = 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365';
            finalistsHTML += createPodiumHTML(song, safeSubmission, { imageUrl: placeholder });
        }
    
        finalistsHTML += '</div></div>';
        finalistsPodium.innerHTML = finalistsHTML;
    
        // Asynchronously fetch and update images for finalists (non-blocking).
        (async () => {
            for (const song of usedFinalists) {
                try {
                    const submission = (typeof window.findSubmissionBySongName === 'function')
                        ? (window.findSubmissionBySongName(song.songName) || {})
                        : {};
                    const safeSubmission = submission || {};
                    const info = await safeGetSongInfo(safeSubmission);
                    if (info && info.imageUrl) {
                        const selector = `.podium-container [data-song-name="${encodeURIComponent(song.songName)}"] img`;
                        const imgEl = finalistsPodium.querySelector(selector);
                        if (imgEl) imgEl.src = info.imageUrl;
                    }
                } catch (e) {
                    // Don't block on individual failures
                    console.warn('Failed to load finalist image for', song.songName, e);
                }
            }
        })();
    
        if (usedSecondChance.length > 0) {
            secondChanceSection.style.display = 'block';
            let secondChanceHTML = `<div class="podium-section second-chance-podium"><h2 class="second-chance-title">${secondLabel}</h2><div class="podium-container">`;
    
            for (const song of usedSecondChance) {
                const submission = (typeof window.findSubmissionBySongName === 'function')
                    ? (window.findSubmissionBySongName(song.songName) || {})
                    : {};
                const safeSubmission = submission || {};
                const placeholder = 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365';
                secondChanceHTML += createPodiumHTML(song, safeSubmission, { imageUrl: placeholder });
            }
    
            secondChanceHTML += '</div></div>';
            secondChancePodium.innerHTML = secondChanceHTML;
    
            // Asynchronously fetch and update second-chance images
            (async () => {
                for (const song of usedSecondChance) {
                    try {
                        const submission = (typeof window.findSubmissionBySongName === 'function')
                            ? (window.findSubmissionBySongName(song.songName) || {})
                            : {};
                        const safeSubmission = submission || {};
                        const info = await safeGetSongInfo(safeSubmission);
                        if (info && info.imageUrl) {
                            const selector = `.podium-container [data-song-name="${encodeURIComponent(song.songName)}"] img`;
                            const imgEl = secondChancePodium.querySelector(selector);
                            if (imgEl) imgEl.src = info.imageUrl;
                        }
                    } catch (e) {
                        console.warn('Failed to load second-chance image for', song.songName, e);
                    }
                }
            })();
        } else {
            secondChanceSection.style.display = 'none';
        }
    } else {
        podiumSection.style.display = 'none';
    }
}

/**
 * Create HTML for a podium item. Uses canonical fields if present and falls back to legacy ones.
 */
function createPodiumHTML(song, submission = {}, songInfo = { imageUrl: '' }, size = '') {
    const sizeClass = size ? ` podium-item-${size}` : '';

    const displayRank = song.weeklyRank ?? song.weekly_rank ?? (song._rawRow && song._rawRow[16]) ?? '';
    const displayPoints = (song.pointsFinal !== undefined) ? song.pointsFinal : (song.points ?? 0);
    const artist = submission.sunoUsername || submission.suno_username || submission.artist || '-';
    const imageUrl = songInfo?.imageUrl || 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365';

    // Include a data attribute with an encoded song name so we can find the node later for lazy image replacement.
    const dataAttr = `data-song-name="${encodeURIComponent(song.songName)}"`;

    return `
        <div class="podium-item${sizeClass}" ${dataAttr}>
            <a href="${submission.songUrl || '#'}" target="_blank">
                <img src="${imageUrl}" alt="${escapeHtml(song.songName)}" onerror="this.src='https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365'">
            </a>
            <div class="podium-rank">${displayRank ? `# ${displayRank}` : ''}</div>
            <div class="podium-title">
                <a href="${submission.songUrl || '#'}" target="_blank">${escapeHtml(song.songName)}</a>
            </div>
            <div class="podium-artist">by ${escapeHtml(artist)}</div>
            <div class="podium-points">${displayPoints} points</div>
        </div>
    `;
}

/**
 * Helper to safely fetch songInfo (wrap getSongInfo call and handle missing submission URLs)
 */
async function safeGetSongInfo(submission) {
    try {
        if (!submission || !submission.songUrl) {
            return { imageUrl: 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365' };
        }
        const songId = getSongIdFromUrl(submission.songUrl);
        if (!songId) return { imageUrl: 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365' };
        const info = await getSongInfo(songId);
        return info || { imageUrl: 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365' };
    } catch (e) {
        console.warn('safeGetSongInfo failed', e);
        return { imageUrl: 'https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365' };
    }
}

/**
 * Lightweight HTML escape for titles/usernames
 */
function escapeHtml(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
}

/**
 * Backwards-compatible async helper: createPodiumItem kept for any callers that want an item string
 */
async function createPodiumItem(song, size = 'medium') {
    if (!song) return '';
    const submission = (typeof window.findSubmissionBySongName === 'function')
        ? (window.findSubmissionBySongName(song.songName) || {})
        : ((window.submissions || []).find(s => s.songTitle === song.songName) || {});
    const songInfo = await safeGetSongInfo(submission);
    const sizeClasses = {
        large: 'podium-item-large',
        medium: 'podium-item-medium',
        small: 'podium-item-small'
    };

    const rankLabel = (() => {
        const r = (song.result || '').toString();
        const normalized = r.toLowerCase().replace(/[\s_-]+/g, '');
        if (normalized === 'winner') return '🏆 Winner';
        if (normalized === '2ndplace' || normalized === '2nd-place' || normalized === '2ndplace') return '🥈 2nd Place';
        if (normalized === '3rdplace') return '🥉 3rd Place';
        if (normalized === 'bbn') return '✨ Best Brand New';
        return `#${song.weeklyRank || song.weekly_rank || ''}`;
    })();

    const points = (song.pointsFinal !== undefined) ? song.pointsFinal : (song.points ?? 0);
    const artist = submission.sunoUsername || submission.suno_username || submission.artist || '-';

    return `
        <div class="podium-item ${sizeClasses[size]}">
            <a href="${submission.songUrl || '#'}" target="_blank">
                <img src="${songInfo.imageUrl}" 
                     alt="${escapeHtml(song.songName)}" 
                     onerror="this.src='https://cdn.glitch.global/1f7954fd-4779-4304-a1e0-16c4218d8634/ssc_coverart_logo.jpeg?v=1733688489365'">
            </a>
            <div class="podium-rank">${rankLabel}</div>
            <div class="podium-title">
                <a href="${submission.songUrl || '#'}" target="_blank">${escapeHtml(song.songName)}</a>
            </div>
            <div class="podium-artist">by ${escapeHtml(artist)}</div>
            <div class="podium-points">${points} points</div>
        </div>
    `;
}