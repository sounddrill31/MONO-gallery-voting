document.addEventListener('DOMContentLoaded', () => {
    let galleryInstance = null;
    const TEAMS_DATA_PLACEHOLDER = '{{TEAMS_DATA}}';
    const CONFIG_DATA_PLACEHOLDER = '{{CONFIG_DATA}}';

    class PhotoGallery {
        constructor(teams, config) {
            this.teams = teams;
            this.config = config;
            this.currentTeamIndex = 0;
            this.zoomLevel = 1;
            this.pan = { x: 0, y: 0 };
            this.isPanning = false;
            this.startPan = { x: 0, y: 0 };
            this.initialPan = { x: 0, y: 0 };
            this.phase = 'none';
            this.phaseReloadTimer = null;
            this._openSeq = 0; // increments each open to invalidate old visibility enforcement loops

            this.elements = {
                galleryGrid: document.getElementById('galleryGrid'),
                modal: document.getElementById('imageModal'),
                modalImage: document.getElementById('modalImage'),
                modalTeamName: document.getElementById('modalTeamName'),
                closeModalBtn: document.getElementById('closeModal'),
                prevBtn: document.getElementById('prevBtn'),
                nextBtn: document.getElementById('nextBtn'),
                zoomInBtn: document.getElementById('zoomInBtn'),
                zoomOutBtn: document.getElementById('zoomOutBtn'),
                resetPanZoomBtn: document.getElementById('resetPanZoomBtn'),
                imageContainer: document.getElementById('image-container'),
                countdown: document.getElementById('countdown'),
                countdownTitle: document.getElementById('countdown-title'),
                voteLink: document.getElementById('voteLink'),
                heroCarousel: document.getElementById('hero-carousel'),
                carouselTrack: document.getElementById('carousel-track'),
                carouselNextBtn: document.getElementById('carousel-next'),
                carouselPrevBtn: document.getElementById('carousel-prev'),
                carouselDots: document.getElementById('carousel-dots'),
                shareBtn: document.getElementById('shareBtn'),
                shareModal: document.getElementById('shareModal'),
                closeShareModalBtn: document.getElementById('closeShareModal'),
                shareUrlInput: document.getElementById('shareUrlInput'),
                copyUrlBtn: document.getElementById('copyUrlBtn'),
                qrCodeContainer: document.getElementById('qrCodeContainer'),
                featuresSection: document.getElementById('features-section'),
                featuresGrid: document.getElementById('features-grid'),
            };

            this.init();
        }

        // Determine if team data (team names) should be hidden for the current phase.
        // New config flag: show_team_data can be 'all','none','submission','voting','results' or array of phases.
        // Legacy flag: hide_team_data (boolean) still supported; if true and show_team_data undefined -> always hide.
        shouldHideTeamData(){
            const legacyHide = this.config.hide_team_data === true && typeof this.config.show_team_data === 'undefined';
            const phase = this.getPrimaryPhase(this.determinePhase(Date.now()));
            // flagActive returns true when feature should be shown. We invert for hiding logic.
            // If show_team_data not provided, defaultAll true => visible (unless legacyHide)
            const visible = this.flagActive(this.config.show_team_data, phase, { defaultAll: true });
            return legacyHide ? true : !visible;
        }

        getDisplayName(team){
            if (this.shouldHideTeamData()) {
                const r = team.rank != null ? team.rank : '?';
                return `Submission #${r}`;
            }
            return team.teamName;
        }

        init() {
            // Determine current phase
            const now = Date.now();
            this.phase = this.determinePhase(now);
            // Schedule a reload exactly when the next phase change boundary occurs
            this.schedulePhaseChangeReload(now);
            // Primary phase collapses intermediary states (pre-submission -> submission, between -> voting)
            this.primaryPhase = this.getPrimaryPhase(this.phase);

            // Handle gallery and carousel visibility based on phase and config
            const mainElement = document.querySelector('main');
            const countdownSection = document.querySelector('section.text-center');
            const carouselWrapper = document.querySelector('.carousel-wrapper');
            const galleryGrid = this.elements.galleryGrid;
            const galleryHeading = document.querySelector('h3');
            const galleryInstruction = document.getElementById('galleryInstruction');
            const hrs = document.querySelectorAll('hr');

            // Gallery visibility logic (supports scalar or array flags incl. 'results')
            let showGallery = this.flagActive(this.config.show_gallery, this.primaryPhase, { defaultAll: false });

            if (!showGallery) {
                if (carouselWrapper) carouselWrapper.style.display = 'none';
                if (galleryGrid) galleryGrid.style.display = 'none';
                if (galleryHeading) galleryHeading.style.display = 'none';
                if (galleryInstruction) galleryInstruction.style.display = 'none';
                hrs.forEach(hr => hr.style.display = 'none');
                if (countdownSection) {
                    countdownSection.classList.add('center-content', 'section-spacing');
                }
            } else {
                this.renderGallery();
                this.initHeroCarousel();
                if (galleryInstruction) galleryInstruction.style.display = '';
            }

            // Unified button for Voting/Submit/Results
            let actionBtn = document.getElementById('actionBtn');
            if (!actionBtn) {
                actionBtn = document.createElement('a');
                actionBtn.id = 'actionBtn';
                actionBtn.className = 'mono-btn mono-btn-primary';
                if (this.elements.voteLink && this.elements.voteLink.parentNode) {
                    this.elements.voteLink.parentNode.appendChild(actionBtn);
                } else if (document.body) {
                    document.body.appendChild(actionBtn);
                }
            }
            // Hide by default
            actionBtn.classList.add('hidden');
            const showSubmit = (typeof this.config.show_submit === 'undefined') ? true : this.config.show_submit;
            if (this.phase === 'submission' && showSubmit) {
                actionBtn.textContent = 'Submit Photo';
                actionBtn.href = this.config.submission_forms_url || '#';
                actionBtn.classList.remove('hidden');
            } else if (this.phase === 'voting' && this.config.show_voting) {
                actionBtn.textContent = 'Vote Now';
                actionBtn.href = this.config.voting_forms_url || '#';
                actionBtn.classList.remove('hidden');
            } else if (this.phase === 'results' && this.config.show_results) {
                actionBtn.textContent = 'Results';
                actionBtn.href = '#results';
                actionBtn.removeAttribute('target');
                actionBtn.classList.remove('hidden');
                actionBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openResultsModal();
                });
            }

            // Remove old resultsBtn creation (now using modal)

            // Countdown visibility (handled again in setupCountdown, but we pre-hide if needed)
            if (this.elements.countdown && this.elements.countdownTitle) {
                const cdActive = this.flagActive(this.config.show_countdown, this.primaryPhase, { allowResults: true });
                if (!cdActive) {
                    this.elements.countdown.style.display = 'none';
                    this.elements.countdownTitle.style.display = 'none';
                }
            }

            // Features visibility / rendering
            this.applyFeaturesVisibility();

            // Home title / description / phase date
            this.applyHomeIntro();

            this.setupEventListeners();
            this.handleURLParameters();
            this.setupCountdown();
            this.updateVoteLink();
            this.initShare();
            this.setupPinchToZoom();
            this.setupGestures();
            this.setupDownloadButton();
            if (this.phase === 'results' && this.config.show_results) {
                this.prepareResultsData();
            }
        }

        /* ================= RESULTS MODAL + STATS ================= */
        openResultsModal() {
            const modal = document.getElementById('resultsModal');
            if (!modal) return;
            this.prepareResultsData(); // lightweight if already prepared
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            const closeBtn = document.getElementById('closeResultsModal');
            if (closeBtn && !closeBtn._added) {
                closeBtn.addEventListener('click', () => this.closeResultsModal());
                closeBtn._added = true;
            }
            if (!this._resultsBackdropAdded) {
                modal.addEventListener('click', (e) => { if (e.target === modal) this.closeResultsModal(); });
                this._resultsBackdropAdded = true;
            }
        }

        closeResultsModal() {
            const modal = document.getElementById('resultsModal');
            if (!modal) return;
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }

        prepareResultsData() {
            // If server already rendered results, just mark prepared and exit.
            if (typeof RESULTS_PRERENDERED !== 'undefined' && RESULTS_PRERENDERED) {
                this._resultsPrepared = true;
                return;
            }
            if (this._resultsPrepared) return;
            // Build and render in a single animation frame to keep UI responsive
            // Cache computed data for subsequent opens.
            if (!this._resultsCache) {
                const hideTeamData = this.shouldHideTeamData();
                // Pre-compute commonly needed sorted arrays only once.
                const sortedByRank = [...this.teams].sort((a,b)=> (parseFloat(a.rank)||9999) - (parseFloat(b.rank)||9999));
                const sortedByVote = [...this.teams].sort((a,b)=> {
                    const av = (typeof a.public_vote_percent==='number')? a.public_vote_percent : -1;
                    const bv = (typeof b.public_vote_percent==='number')? b.public_vote_percent : -1;
                    if (bv !== av) return bv - av;
                    return (parseFloat(a.rank)||9999) - (parseFloat(b.rank)||9999);
                });
                const winners = sortedByRank.slice(0,3);
                const publicVoteData = this.teams.filter(t=> typeof t.public_vote_percent === 'number' && !isNaN(t.public_vote_percent));
                this._resultsCache = { hideTeamData, sortedByRank, sortedByVote, winners, publicVoteData };
            }
            requestAnimationFrame(()=>{
                this.computeWinners();
                this.buildPublicVoteChart();
                this.renderExtraStats();
                this._resultsPrepared = true;
            });
        }

        computeWinners() {
            if (!this._resultsCache) return; // safety
            const { winners, sortedByVote, hideTeamData } = this._resultsCache;
            const winnersList = document.getElementById('winnersList');
            if (winnersList && winnersList.children.length===0) {
                let winnerHTML = '';
                winners.forEach((team,idx)=>{
                    const medal = idx===0?'🥇':idx===1?'🥈':'🥉';
                    const percent = (team.public_vote_percent!=null)? `<span class="text-xs block mt-1 opacity-70">${team.public_vote_percent}% public vote</span>`: '';
                    winnerHTML += `
                    <div class="winner-card mono-border p-4 flex flex-col gap-3">
                        <div class="aspect-square overflow-hidden border border-black/20">
                            <img src="${team.images[0]}" alt="${team.teamName}" loading="lazy" class="object-cover w-full h-full" />
                        </div>
                        <div>
                            <h4 class="font-bold tracking-wide text-sm">${medal} ${hideTeamData? 'Submission #'+team.rank : team.teamName}</h4>
                            ${percent}
                        </div>
                    </div>`;
                });
                winnersList.innerHTML = winnerHTML.trim();
            }
            const gallery = document.getElementById('winnerGallery');
            if (gallery && gallery.children.length===0) {
                const LIMIT = this.config.results_gallery_limit || 50; // safeguard for very large contests
                let galleryHTML = '';
                sortedByVote.forEach((team,index)=>{
                    const medal = index<3 ? (index===0?'🥇':index===1?'🥈':'🥉') : '';
                    galleryHTML += `
                    <div class="winner-gallery-card flex flex-col border border-black/30 bg-white hover:shadow-md transition-shadow">
                        <div class="h-40 overflow-hidden"><img src="${team.images[0]}" alt="${team.teamName}" loading="lazy" class="object-cover w-full h-full" /></div>
                        <div class="p-3 flex flex-col flex-grow">
                            <div class="flex items-center justify-between text-xs font-mono mb-1">
                                <span class="font-bold">${hideTeamData? '#'+team.rank : team.teamName}</span>
                                <span>${medal}</span>
                            </div>
                            <div class="text-[10px] opacity-70 mt-auto">${team.public_vote_percent!=null? team.public_vote_percent + '% vote' : ''}</div>
                        </div>
                    </div>`;
                    if (index+1 === LIMIT) return; // stop early if limit reached
                });
                gallery.innerHTML = galleryHTML.trim();
                // If limited and there are more, offer an expansion control without pre-building DOM.
                if (sortedByVote.length > LIMIT) {
                    const moreBtn = document.createElement('button');
                    moreBtn.className = 'mono-btn mono-btn-secondary mt-4 text-xs';
                    moreBtn.textContent = `Show All (${sortedByVote.length})`;
                    moreBtn.addEventListener('click', ()=>{
                        // Append remaining teams (string build for remainder only)
                        let extraHTML='';
                        for (let i=LIMIT;i<sortedByVote.length;i++) {
                            const team = sortedByVote[i];
                            const medal = i<3 ? (i===0?'🥇':i===1?'🥈':'🥉') : '';
                            extraHTML += `
                            <div class="winner-gallery-card flex flex-col border border-black/30 bg-white hover:shadow-md transition-shadow">
                                <div class="h-40 overflow-hidden"><img src="${team.images[0]}" alt="${team.teamName}" loading="lazy" class="object-cover w-full h-full" /></div>
                                <div class="p-3 flex flex-col flex-grow">
                                    <div class="flex items-center justify-between text-xs font-mono mb-1">
                                        <span class="font-bold">${hideTeamData? '#'+team.rank : team.teamName}</span>
                                        <span>${medal}</span>
                                    </div>
                                    <div class="text-[10px] opacity-70 mt-auto">${team.public_vote_percent!=null? team.public_vote_percent + '% vote' : ''}</div>
                                </div>
                            </div>`;
                        }
                        gallery.insertAdjacentHTML('beforeend', extraHTML.trim());
                        moreBtn.remove();
                    });
                    gallery.parentElement.appendChild(moreBtn);
                }
            }
        }

        buildPublicVoteChart() {
            const container = document.getElementById('publicVoteChart');
            if (!container || container.childElementCount>0) return;
            if (!this._resultsCache) return;
            const { publicVoteData, hideTeamData } = this._resultsCache;
            const data = [...publicVoteData];
            if (!data.length) {
                container.innerHTML = '<p class="text-sm opacity-60">No public vote data available.</p>';
                return;
            }
            data.sort((a,b)=> b.public_vote_percent - a.public_vote_percent);
            const total = data.reduce((sum,t)=> sum + t.public_vote_percent, 0) || 1;
            const size = 260; const radius = size/2; const fullCirc = Math.PI * 2 * radius;
            let cumulative = 0;
            let circlesHTML = '';
            data.forEach((t,i)=>{
                const value = t.public_vote_percent;
                const frac = value/total;
                const dash = frac * fullCirc;
                const gap = fullCirc - dash;
                circlesHTML += `<circle r="${radius}" cx="${radius}" cy="${radius}" fill="transparent" stroke="hsl(0,0%,${15 + i*8}%)" stroke-width="${radius}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-cumulative * fullCirc}" data-label="${hideTeamData? '#'+t.rank : t.teamName}"></circle>`;
                cumulative += frac;
            });
            container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" class="mono-pie">${circlesHTML}</svg>`;
            const legend = document.getElementById('publicVoteLegend');
            if (legend && legend.childElementCount===0) {
                let legendHTML='';
                data.forEach((t,i)=>{
                    legendHTML += `<div class="flex items-center gap-1"><span class="inline-block w-3 h-3" style="background:hsl(0,0%,${15+i*8}%);"></span><span class="text-[10px] uppercase tracking-wide">${hideTeamData? '#'+t.rank : t.teamName} – ${t.public_vote_percent}%</span></div>`;
                });
                legend.innerHTML = legendHTML.trim();
            }
        }

        renderExtraStats() {
            const grid = document.getElementById('extraStatsGrid');
            if (!grid || !this.config.extra_stats) return;
            const stats = this.config.extra_stats;
            Object.entries(stats).forEach(([rawTitle, obj])=>{
                const title = rawTitle.trim();
                const chart = obj.chart;
                if (obj.value != null) {
                    const card = document.createElement('div');
                    card.className='extra-stat-card mono-border p-4 bg-white flex flex-col';
                    card.innerHTML = `<h4 class="font-bold mb-2 text-sm uppercase tracking-wide">${title}</h4><div class="text-3xl font-mono">${obj.value}</div>`;
                    grid.appendChild(card);
                } else if (Array.isArray(obj.data) && obj.data.length) {
                    if (chart === 'pie') {
                        grid.appendChild(this.buildMiniPie(title,obj.data));
                    } else if (chart === 'bar') {
                        grid.appendChild(this.buildMiniBar(title,obj.data));
                    } else {
                        const card=document.createElement('div');
                        card.className='extra-stat-card mono-border p-4 bg-white';
                        card.innerHTML=`<h4 class="font-bold mb-2 text-sm uppercase tracking-wide">${title}</h4>`;
                        const list=document.createElement('ul'); list.className='space-y-1 text-xs';
                        obj.data.forEach(d=>{ list.innerHTML += `<li class=\"flex justify-between\"><span>${d.label}</span><span class=\"font-mono\">${d.value}</span></li>`; });
                        card.appendChild(list); grid.appendChild(card);
                    }
                }
            });
        }

        buildMiniPie(title,data) {
            const card=document.createElement('div');
            card.className='extra-stat-card mono-border p-4 bg-white flex flex-col';
            card.innerHTML = `<h4 class="font-bold mb-2 text-sm uppercase tracking-wide">${title}</h4>`;
            const size=160; const radius=size/2; const stroke=radius;
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox',`0 0 ${size} ${size}`); svg.classList.add('mini-pie');
            const total=data.reduce((s,d)=> s + (typeof d.value==='number'? d.value:0),0)||1; let cumulative=0;
            data.forEach((d,i)=>{ const val=(typeof d.value==='number')? d.value:0; const frac=val/total; const dash=frac*Math.PI*2*radius; const gap=Math.PI*2*radius - dash; const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); c.setAttribute('r',radius); c.setAttribute('cx',radius); c.setAttribute('cy',radius); c.setAttribute('fill','transparent'); c.setAttribute('stroke',`hsl(0,0%,${20+i*10}%)`); c.setAttribute('stroke-width',stroke); c.setAttribute('stroke-dasharray',`${dash} ${gap}`); c.setAttribute('stroke-dashoffset',(-cumulative*Math.PI*2*radius)); svg.appendChild(c); cumulative+=frac; });
            card.appendChild(svg);
            const legend=document.createElement('div'); legend.className='flex flex-wrap gap-1 mt-2';
            data.forEach((d,i)=>{ legend.innerHTML += `<span class=\"flex items-center gap-1 text-[10px]\"><span class=\"w-2 h-2 inline-block\" style=\"background:hsl(0,0%,${20+i*10}%);\"></span>${d.label}<span class=\"font-mono\">${d.value}</span></span>`; });
            card.appendChild(legend);
            return card;
        }

        buildMiniBar(title,data) {
            const card=document.createElement('div'); card.className='extra-stat-card mono-border p-4 bg-white flex flex-col';
            card.innerHTML = `<h4 class="font-bold mb-3 text-sm uppercase tracking-wide">${title}</h4>`;
            const max=Math.max(...data.map(d=> (typeof d.value==='number'? d.value:0)),1); const list=document.createElement('div'); list.className='space-y-2';
            data.forEach((d,i)=>{ const val=(typeof d.value==='number')? d.value:0; const pct=(val/max)*100; const row=document.createElement('div'); row.className='text-xs'; row.innerHTML = `<div class=\"flex justify-between mb-1\"><span>${d.label}</span><span class=\"font-mono\">${d.value}</span></div><div class=\"h-2 w-full bg-gray-200 relative overflow-hidden\"><div class=\"h-full\" style=\"width:${pct}%;background:hsl(0,0%,${20+i*10}%);\"></div></div>`; list.appendChild(row); });
            card.appendChild(list); return card;
        }
        /* ================= END RESULTS ================= */

        applyFeaturesVisibility() {
            const features = Array.isArray(this.config.features) ? this.config.features : [];
            if (!this.elements.featuresSection) return;
            const show = features.length > 0 && this.flagActive(this.config.show_features, this.primaryPhase, { defaultAll: false, allowResults: true });
            if (!show) {
                this.elements.featuresSection.classList.add('hidden');
                return;
            }
            if (this.elements.featuresGrid && this.elements.featuresGrid.children.length === 0) {
                features.forEach(f => {
                    const card = document.createElement('div');
                    card.className = 'feature-card';
                    card.innerHTML = `
                        <h3>${f.title || ''}</h3>
                        <p>${f.description || ''}</p>
                    `;
                    this.elements.featuresGrid.appendChild(card);
                });
            }
            this.setFeatureGridColumns(features.length);
            this.elements.featuresSection.classList.remove('hidden');
        }

        applyHomeIntro() {
            const titleEl = document.getElementById('homeTitle');
            const descEl = document.getElementById('homeDescription');
            const phaseDateEl = document.getElementById('phaseDate');
            // Header element keeps HTML, but document.title should be plain text only
            if (titleEl && this.config.home_title) {
                titleEl.innerHTML = this.config.home_title;
                const tmp = document.createElement('div');
                tmp.innerHTML = this.config.home_title;
                const plain = tmp.textContent || tmp.innerText || '';
                if (plain.trim()) {
                    document.title = plain.trim();
                }
            } else if (titleEl) {
                titleEl.style.display = 'none';
            }
            // Determine phase-specific description keys
            const phaseDescMap = {
                'submission': this.config.home_description_submission,
                'pre-submission': this.config.home_description_submission,
                'between': this.config.home_description_voting, // waiting for voting
                'voting': this.config.home_description_voting,
                'results': this.config.home_description_results
            };
            let descHTML = phaseDescMap[this.phase];
            if (!descHTML) {
                // fallback to legacy single description if provided
                descHTML = this.config.home_description;
            }
            if (descEl) {
                if (descHTML) {
                    descEl.innerHTML = descHTML;
                } else {
                    descEl.style.display = 'none';
                }
            }
            if (!phaseDateEl) return;
            const mode = this.config.show_date || 'none';
            if (mode === 'none') { phaseDateEl.style.display='none'; return; }
            const d = this.config.deadlines || {};
            const tryFormat = (raw) => {
                if (!raw) return '';
                const dt = new Date(raw); // let browser parse as-is; if invalid return original
                if (isNaN(dt.getTime())) return raw; // show as-is (user asked not to show invalid differently)
                return dt.toLocaleString(undefined,{ dateStyle:'medium', timeStyle:'short'});
            };
            let text = '';
            if (this.phase === 'submission' || this.phase === 'pre-submission') {
                if (mode === 'submission' || mode === 'all') {
                    text = `Submission Window: <strong>${tryFormat(d.submit_open)} → ${tryFormat(d.submit_close)}</strong>`;
                }
            } else if (this.phase === 'between' || this.phase === 'voting') {
                if (mode === 'voting' || mode === 'all') {
                    text = `Voting Window: <strong>${tryFormat(d.voting_open)} → ${tryFormat(d.voting_close)}</strong>`;
                }
            } else if (this.phase === 'results') {
                if (mode === 'submission' || mode === 'all') {
                    text += `Submission: <strong>${tryFormat(d.submit_open)} → ${tryFormat(d.submit_close)}</strong>`;
                }
                if (mode === 'voting' || mode === 'all') {
                    text += (text ? ' • ' : '') + `Voting: <strong>${tryFormat(d.voting_open)} → ${tryFormat(d.voting_close)}</strong>`;
                }
                if (d.results && (mode === 'all')) {
                    text += (text ? ' • ' : '') + `Results: <strong>${tryFormat(d.results)}</strong>`;
                }
            }
            if (!text) { phaseDateEl.style.display='none'; } else { phaseDateEl.innerHTML = text; }
        }

        // Decide optimal columns given feature count to minimize vertical scroll while maintaining readable width
        setFeatureGridColumns(count) {
            if (!this.elements.featuresGrid) return;
            let cols = 1;
            if (count === 1) cols = 1;
            else if (count === 2) cols = 2;
            else if (count === 3) cols = 3;
            else if (count === 4) cols = 2; // 2x2 layout looks better than a very short 4-wide row on desktop
            else if (count >= 5 && count <= 6) cols = 3;
            else if (count >= 7 && count <= 8) cols = 4;
            else if (count === 9) cols = 3; // perfect square 3x3
            else if (count === 10) cols = 4; // 3 rows: 4,4,2 (last centered by gap) acceptable
            else if (count > 10) cols = 4;
            this.elements.featuresGrid.setAttribute('data-cols', cols.toString());
        }

        // Determine phase given a timestamp
        determinePhase(nowTs) {
            const d = this.config.deadlines || {};
            const submitOpen = d.submit_open ? new Date(d.submit_open).getTime() : null;
            const submitClose = d.submit_close ? new Date(d.submit_close).getTime() : null;
            const votingOpen = d.voting_open ? new Date(d.voting_open).getTime() : null;
            const votingClose = d.voting_close ? new Date(d.voting_close).getTime() : null;
            const resultsTime = d.results ? new Date(d.results).getTime() : null;

            if (submitOpen && nowTs < submitOpen) return 'pre-submission';
            if (submitOpen && submitClose && nowTs >= submitOpen && nowTs < submitClose) return 'submission';
            if (votingOpen && nowTs < votingOpen) return 'between';
            if (votingOpen && votingClose && nowTs >= votingOpen && nowTs < votingClose) return 'voting';
            if (votingClose && nowTs >= votingClose) {
                // If a results unlock time exists and hasn't arrived yet, enter waiting-results
                if (resultsTime && nowTs < resultsTime) return 'waiting-results';
                return 'results';
            }
            return 'none';
        }

        // Collapse detailed internal phase to primary bucket for flag checks
        getPrimaryPhase(phase) {
            if (phase === 'pre-submission') return 'submission';
            if (phase === 'between') return 'voting';
            if (phase === 'waiting-results') return 'voting'; // treat as voting for most visibility flags
            return phase; // submission, voting, results, none
        }

        // Generic flag activation logic. flag can be: undefined, 'all', 'none', 'submission', 'voting', 'results', or an array of those.
        flagActive(flag, currentPrimaryPhase, opts = {}) {
            const { defaultAll = true } = opts;
            if (Array.isArray(flag)) {
                return flag.map(String).includes(currentPrimaryPhase);
            }
            if (flag == null || flag === '') {
                return defaultAll; // historical default mostly showed content
            }
            if (typeof flag === 'string') {
                const normalized = flag.toLowerCase();
                if (normalized === 'all') return true;
                if (normalized === 'none') return false;
                if (['submission','voting','results'].includes(normalized)) {
                    return normalized === currentPrimaryPhase;
                }
            }
            return false;
        }

        // Schedule a page reload exactly at the next phase transition boundary
        schedulePhaseChangeReload(nowTs) {
            if (this.phaseReloadTimer) {
                clearTimeout(this.phaseReloadTimer);
                this.phaseReloadTimer = null;
            }
            const d = this.config.deadlines || {};
            const times = [d.submit_open, d.submit_close, d.voting_open, d.voting_close, d.results]
                .filter(Boolean)
                .map(t => new Date(t).getTime())
                .filter(t => t > nowTs) // future only
                .sort((a,b)=>a-b);
            if (!times.length) return; // nothing upcoming
            const nextBoundary = times[0];
            const delay = Math.max(0, nextBoundary - nowTs + 1000); // +1s buffer
            this.phaseReloadTimer = setTimeout(() => {
                // Double-check phase actually changed before reloading
                const newPhase = this.determinePhase(Date.now());
                if (newPhase !== this.phase) {
                    window.location.reload();
                } else {
                    // If not changed (edge), schedule again
                    this.schedulePhaseChangeReload(Date.now());
                }
            }, delay);
        }

        renderGallery() {
            this.elements.galleryGrid.innerHTML = '';
            this.teams.forEach((team, index) => {
                const card = document.createElement('div');
                card.className = 'team-card bg-white rounded-lg shadow-md border border-gray-200';
                card.dataset.index = index;
                card.innerHTML = `
                    <div class="overflow-hidden h-48">
                        <img src="${team.images[0]}" alt="${this.getDisplayName(team)}" class="w-full h-full object-cover">
                    </div>
                    <div class="p-4">
                        <h3 class="font-bold text-lg truncate">${this.getDisplayName(team)}</h3>
                    </div>
                `;
                card.addEventListener('click', () => this.openModal(index));
                this.elements.galleryGrid.appendChild(card);
            });
        }

        openModal(index) {
            this._openSeq++; // new open sequence id
            const seq = this._openSeq;
            this.currentTeamIndex = index;
            this.updateModalContent();
            const modal = this.elements.modal;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            // Inline style enforcement (belt & suspenders)
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.zIndex = '9999';
            document.body.style.overflow = 'hidden';
            this.updateURL();
            // Defensive: if current team is NOT video, ensure image element is visible (handles rare race conditions)
            const team = this.teams[this.currentTeamIndex];
            if (!(team && team.is_video && team.video_embed_url)) {
                const imgEl = this.elements.modalImage;
                if (imgEl) {
                    imgEl.classList.remove('hidden');
                    imgEl.style.display = 'block';
                }
                const iframe = document.getElementById('modalVideo');
                if (iframe) {
                    iframe.classList.add('hidden');
                    iframe.style.display = 'none';
                }
            }
            this.ensureModalVisibility(seq);
            if (new URLSearchParams(location.search).has('debug')) {
                console.debug('[gallery] openModal', {index, team: this.teams[index]?.team_number, classList:[...modal.classList], style: {display: modal.style.display, opacity: modal.style.opacity}});
            }
        }

        closeModal() {
            // Pause any playing video before closing
            this.pauseActiveVideo();
            const modal = this.elements.modal;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modal.style.opacity = '0.0001'; // keep tiny to allow CSS observers; will be reset on next open
            // Invalidate any pending ensure loops so they don't resurrect modal
            this._openSeq++;
            // Do not set display none inline; rely on hidden class so removing it restores flex inline style we set
            document.body.style.overflow = '';
            this.resetPanZoom();
            this.updateURL(true);
            if (new URLSearchParams(location.search).has('debug')) {
                console.debug('[gallery] closeModal', {classList:[...modal.classList], style:{display:modal.style.display, opacity:modal.style.opacity}});
            }
        }

        updateModalContent() {
            const team = this.teams[this.currentTeamIndex];
            const videoEl = document.getElementById('modalVideo');
            const imgEl = this.elements.modalImage;
            const hintEl = document.querySelector('#imageModal .text-xs.text-gray-400');
            const controlsEl = document.getElementById('image-controls');
            const downloadBtn = document.getElementById('downloadBtn');
            let revealTimer = null;

            const enterVideoMode = () => {
                // Pause any prior video first (defensive if switching video->video)
                this.pauseActiveVideo();
                if (videoEl && team.video_embed_url) {
                    // Include enablejsapi=1 for pause support; keep rel=0 to limit related videos.
                    const base = team.video_embed_url;
                    const params = '?rel=0&enablejsapi=1';
                    // Only set src if different to avoid reload flicker when navigating back to same video
                    if (!videoEl.src || !videoEl.src.includes(team.video_embed_url)) {
                        videoEl.src = base + params;
                    }
                    videoEl.classList.remove('hidden');
                    videoEl.style.display = 'block';
                    videoEl.style.objectFit = 'contain';
                    videoEl.style.padding = '80px 60px 140px 60px';
                    videoEl.style.boxSizing = 'border-box';
                }
                // Hide image
                imgEl.classList.add('hidden');
                imgEl.style.display = 'none';
                // Hide pan/zoom controls + hint
                if (controlsEl) controlsEl.style.visibility = 'hidden';
                if (hintEl) hintEl.style.display = 'none';
                if (downloadBtn) downloadBtn.style.display = 'none';
            };

            const enterImageMode = () => {
                // If leaving a video, pause it first.
                this.pauseActiveVideo();
                if (videoEl) {
                    videoEl.classList.add('hidden');
                    videoEl.style.display = 'none';
                    videoEl.style.padding = '';
                    // Do not clear src immediately; clearing can cause network abort noise. Lazy clear later.
                    setTimeout(()=>{ if (videoEl.classList.contains('hidden')) videoEl.src = ''; }, 500);
                }
                if (team.images && team.images.length > 0) {
                    const imageUrl = team.images[0];
                    // Preload image first to avoid flash-of-hidden if large
                    if (imgEl.dataset.currentSrc !== imageUrl) {
                        const preImg = new Image();
                        preImg.onload = () => {
                            imgEl.src = imageUrl;
                            imgEl.dataset.currentSrc = imageUrl;
                            imgEl.alt = `Image for ${this.getDisplayName(team)}`;
                            imgEl.classList.remove('hidden');
                            imgEl.style.display = 'block';
                            imgEl.style.opacity = '1';
                            imgEl.style.backgroundImage = 'none';
                            if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
                        };
                        preImg.onerror = () => {
                            // Fallback: still attempt to show whatever existing src we have
                            imgEl.src = imageUrl;
                            imgEl.dataset.currentSrc = imageUrl;
                            imgEl.classList.remove('hidden');
                            imgEl.style.display = 'block';
                            imgEl.style.opacity = '1';
                            if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
                        };
                        // Start hidden but reserve space and add background placeholder (in case onload stalls)
                        imgEl.style.opacity = '0';
                        imgEl.classList.remove('hidden');
                        imgEl.style.display = 'block';
                        imgEl.style.backgroundSize = 'contain';
                        imgEl.style.backgroundPosition = 'center center';
                        imgEl.style.backgroundRepeat = 'no-repeat';
                        imgEl.style.backgroundImage = `url('${imageUrl}')`; // last-resort fallback
                        preImg.src = imageUrl;
                        // Force reveal after 1s even if onload not fired (slow network / cached race)
                        revealTimer = setTimeout(()=>{
                            imgEl.style.opacity = '1';
                        }, 1000);
                    } else {
                        // Same image as before; just ensure visible
                        imgEl.classList.remove('hidden');
                        imgEl.style.display = 'block';
                        imgEl.style.opacity = '1';
                    }
                } else {
                    imgEl.src = '';
                    imgEl.alt = 'No image available';
                    imgEl.classList.remove('hidden');
                    imgEl.style.display = 'block';
                    imgEl.style.opacity = '1';
                }
                if (controlsEl) controlsEl.style.visibility = 'visible';
                if (hintEl) hintEl.style.display = '';
                if (downloadBtn) downloadBtn.style.display = '';
                this.resetPanZoom();
            };

            if (team.is_video && team.video_embed_url) {
                enterVideoMode();
            } else {
                enterImageMode();
            }

            this.elements.modalTeamName.textContent = this.getDisplayName(team);
        }

        // Post a pause command to the active YouTube iframe if present.
        pauseActiveVideo() {
            const iframe = document.getElementById('modalVideo');
            if (!iframe || iframe.classList.contains('hidden') || !iframe.contentWindow) return;
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
            } catch (e) {
                // Silently ignore
            }
        }

        nextTeam() {
            // Pause if current team is a video before switching
            this.pauseActiveVideo();
            this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
            this.updateModalContent();
            this.updateURL();
        }

        prevTeam() {
            this.pauseActiveVideo();
            this.currentTeamIndex = (this.currentTeamIndex - 1 + this.teams.length) % this.teams.length;
            this.updateModalContent();
            this.updateURL();
        }

        setupEventListeners() {
            this.elements.closeModalBtn.addEventListener('click', () => this.closeModal());
            this.elements.nextBtn.addEventListener('click', () => this.nextTeam());
            this.elements.prevBtn.addEventListener('click', () => this.prevTeam());
            this.elements.zoomInBtn.addEventListener('click', () => this.zoom(1.2));
            this.elements.zoomOutBtn.addEventListener('click', () => this.zoom(1 / 1.2));
            this.elements.resetPanZoomBtn.addEventListener('click', () => this.resetPanZoom());

            this.elements.imageContainer.addEventListener('mousedown', (e) => this.startPanDrag(e));
            this.elements.imageContainer.addEventListener('mousemove', (e) => this.panDrag(e));
            this.elements.imageContainer.addEventListener('mouseup', () => this.endPanDrag());
            this.elements.imageContainer.addEventListener('mouseleave', () => this.endPanDrag());
            this.elements.imageContainer.addEventListener('wheel', (e) => this.handleWheelZoom(e), { passive: false });

            document.addEventListener('keydown', (e) => {
                if (this.elements.modal.classList.contains('flex')) {
                    if (e.key === 'Escape') this.closeModal();
                    if (e.key === 'ArrowRight') this.nextTeam();
                    if (e.key === 'ArrowLeft') this.prevTeam();
                    if (e.key === '+' || e.key === '=') this.zoom(1.2);
                    if (e.key === '-' || e.key === '_') this.zoom(1/1.2);
                    if (e.key === '0') this.resetPanZoom();
                }
            });

            // Pause video when page/tab loses visibility
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.pauseActiveVideo();
                }
            });
        }

        zoom(factor) {
            // Ensure the zoom level is updated correctly without reversing the direction
            const newZoomLevel = this.zoomLevel * factor;
            this.zoomLevel = Math.max(0.5, Math.min(newZoomLevel, 10));

            this.applyTransform();
        }

        applyTransform() {
            // Removed background reset logic to allow unrestricted panning
            this.elements.modalImage.style.transform = `scale(${this.zoomLevel}) translate(${this.pan.x}px, ${this.pan.y}px)`;
        }

        resetPanZoom() {
            this.zoomLevel = 1;
            this.pan = { x: 0, y: 0 };
            this.applyTransform();
        }

        startPanDrag(e) {
            // Ensure the user is touching the photo itself
            if (e.target !== this.elements.modalImage) return;

            // Support both mouse and touch events
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.isPanning = true;
            this.startPan.x = clientX;
            this.startPan.y = clientY;
            this.initialPan.x = this.pan.x;
            this.initialPan.y = this.pan.y;
            this.elements.imageContainer.classList.add('grabbing');

            // Prevent default behavior to avoid text selection or scrolling
            e.preventDefault();
        }

        panDrag(e) {
            if (!this.isPanning) return;

            // Support both mouse and touch events
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const dx = clientX - this.startPan.x;
            const dy = clientY - this.startPan.y;

            // Calculate the new pan position
            this.pan.x = this.initialPan.x + dx / this.zoomLevel;
            this.pan.y = this.initialPan.y + dy / this.zoomLevel;

            this.applyTransform();

            // Prevent default behavior to avoid unwanted side effects
            e.preventDefault();
        }

        endPanDrag() {
            this.isPanning = false;
            this.elements.imageContainer.classList.remove('grabbing');
        }

        setupPinchToZoom() {
            let initialDistance = null;
            let initialZoomLevel = this.zoomLevel;

            const getDistance = (touches) => {
                const [touch1, touch2] = touches;
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                return Math.sqrt(dx * dx + dy * dy);
            };

            this.elements.imageContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    initialDistance = getDistance(e.touches);
                    initialZoomLevel = this.zoomLevel;
                }
            });

            this.elements.imageContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && initialDistance) {
                    const currentDistance = getDistance(e.touches);
                    const scaleFactor = currentDistance / initialDistance;
                    this.zoomLevel = Math.max(0.5, Math.min(initialZoomLevel * scaleFactor, 10));
                    this.applyTransform();
                    e.preventDefault();
                }
            });

            this.elements.imageContainer.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) {
                    initialDistance = null;
                }
            });
        }

        handleWheelZoom(e) {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            this.zoom(zoomFactor);
        }

        handleURLParameters() {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');
            if (id) {
                const teamIndex = this.teams.findIndex(t => {
                    if (this.shouldHideTeamData()) {
                        return t.rank != null && t.rank.toString() === id;
                    }
                    return t.team_number === id;
                });
                if (teamIndex !== -1) {
                    this.openModal(teamIndex);
                }
            }
        }

        updateURL(clear = false) {
            const url = new URL(window.location);
            if (clear || this.elements.modal.classList.contains('hidden')) {
                url.searchParams.delete('id');
            } else {
                const team = this.teams[this.currentTeamIndex];
                const id = this.shouldHideTeamData() ? team.rank : team.team_number;
                url.searchParams.set('id', id);
            }
            history.pushState({}, '', url);
        }

        setupCountdown() {
            const { deadlines, show_countdown, show_results } = this.config;
            const { countdown, countdownTitle } = this.elements;

            if (!this.flagActive(show_countdown, this.primaryPhase, { defaultAll: false })) {
                if (countdown) countdown.style.display = 'none';
                if (countdownTitle) countdownTitle.style.display = 'none';
                return;
            }

            const update = () => {
                const now = new Date().getTime();
                const submitOpen = deadlines.submit_open ? new Date(deadlines.submit_open).getTime() : null;
                const submitClose = deadlines.submit_close ? new Date(deadlines.submit_close).getTime() : null;
                const votingOpen = deadlines.voting_open ? new Date(deadlines.voting_open).getTime() : null;
                const votingClose = deadlines.voting_close ? new Date(deadlines.voting_close).getTime() : null;
                const resultsTime = deadlines.results ? new Date(deadlines.results).getTime() : null;

                let targetTime = null;
                let title = "";
                let phase = 'none';

                if (submitOpen && now < submitOpen) {
                    targetTime = submitOpen;
                    title = "Submission Opens In";
                    phase = 'before-submission';
                } else if (submitClose && now < submitClose) {
                    targetTime = submitClose;
                    title = "Submission Closes In";
                    phase = 'submission';
                } else if (votingOpen && now < votingOpen) {
                    targetTime = votingOpen;
                    title = "Voting Opens In";
                    phase = 'before-voting';
                } else if (votingClose && now < votingClose) {
                    targetTime = votingClose;
                    title = "Voting Closes In";
                    phase = 'voting';
                } else if (resultsTime && now < resultsTime) {
                    targetTime = resultsTime;
                    title = "Results Revealed In";
                    phase = 'before-results';
                } else {
                    phase = 'ended';
                }

                // Determine which primary phase we are counting within
                const interimPrimary = this.getPrimaryPhase(this.determinePhase(now));
                const isVisible = this.flagActive(show_countdown, interimPrimary, { defaultAll: false });
                if (!isVisible) {
                    if (countdown) countdown.style.display = 'none';
                    if (countdownTitle) countdownTitle.style.display = 'none';
                    return;
                }
                
                if (countdown) countdown.style.display = 'flex';
                if (countdownTitle) countdownTitle.style.display = 'block';

                if (targetTime) {
                    countdownTitle.textContent = title;
                    const distance = targetTime - now;

                    if (distance < 0) {
                        // In case of a slight delay, just show 0
                        countdown.innerHTML = `
                            <div class="countdown-box"><div class="value">0</div><div class="label">Days</div></div>
                            <div class="countdown-box"><div class="value">0</div><div class="label">Hours</div></div>
                            <div class="countdown-box"><div class="value">0</div><div class="label">Minutes</div></div>
                            <div class="countdown-box"><div class="value">0</div><div class="label">Seconds</div></div>
                        `;
                        return;
                    }

                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    countdown.innerHTML = `
                        <div class="countdown-box"><div class="value">${days}</div><div class="label">Days</div></div>
                        <div class="countdown-box"><div class="value">${hours}</div><div class="label">Hours</div></div>
                        <div class="countdown-box"><div class="value">${minutes}</div><div class="label">Minutes</div></div>
                        <div class="countdown-box"><div class="value">${seconds}</div><div class="label">Seconds</div></div>
                    `;
             } else {
                countdown.innerHTML = "";
                if (show_results) {
                    countdownTitle.textContent = "Results are available!";
                } else {
                    countdownTitle.textContent = "The event has ended.";
                }
                }
            };

            update();
            setInterval(update, 1000);
        }
        
        updateVoteLink() {
            // This function is now obsolete as the action button is handled in init()
            // and countdown logic is self-contained. It can be removed.
        }

        initHeroCarousel() {
            if (!this.elements.heroCarousel) return;

            const topTeams = this.teams
                .sort((a, b) => a.rank - b.rank)
                .slice(0, 10);

            if (topTeams.length === 0) return;

            this.elements.carouselTrack.innerHTML = '';
            this.elements.carouselDots.innerHTML = '';

            topTeams.forEach((team, index) => {
                const slide = document.createElement('div');
                slide.className = 'carousel-slide';
                slide.style.backgroundImage = `url('${team.images[0]}')`;

                const caption = document.createElement('div');
                caption.className = 'slide-caption';
                caption.style.bottom = '4rem'; // Position higher to avoid dots overlap
                caption.textContent = this.shouldHideTeamData() ? `Submission #${team.rank}` : team.teamName;
                slide.appendChild(caption);
                this.elements.carouselTrack.appendChild(slide);

                const dot = document.createElement('button');
                dot.className = 'dot';
                dot.dataset.index = index;
                this.elements.carouselDots.appendChild(dot);
            });

            let currentSlide = 0;
            const slides = this.elements.carouselTrack.querySelectorAll('.carousel-slide');
            const dots = this.elements.carouselDots.querySelectorAll('.dot');
            let carouselDebounceTimer = null;

            const updateCarousel = (newIndex) => {
                currentSlide = (newIndex + slides.length) % slides.length;

                slides.forEach((slide, index) => {
                    slide.classList.remove('active', 'prev', 'next');
                    if (index === currentSlide) {
                        slide.classList.add('active');
                    } else if (index === (currentSlide - 1 + slides.length) % slides.length) {
                        slide.classList.add('prev');
                    } else if (index === (currentSlide + 1) % slides.length) {
                        slide.classList.add('next');
                    }
                });

                dots.forEach((dot, index) => {
                    dot.classList.toggle('active', index === currentSlide);
                });
            };

            const debouncedUpdateCarousel = (newIndex) => {
                if (carouselDebounceTimer) {
                    clearTimeout(carouselDebounceTimer);
                }
                carouselDebounceTimer = setTimeout(() => {
                    updateCarousel(newIndex);
                }, 150); // Very low delay - feels instant but prevents rapid clicks
            };

            this.elements.carouselNextBtn.addEventListener('click', () => debouncedUpdateCarousel(currentSlide + 1));
            this.elements.carouselPrevBtn.addEventListener('click', () => debouncedUpdateCarousel(currentSlide - 1));
            this.elements.carouselDots.addEventListener('click', (e) => {
                if (e.target.classList.contains('dot')) {
                    debouncedUpdateCarousel(parseInt(e.target.dataset.index));
                }
            });

            setInterval(() => updateCarousel(currentSlide + 1), 5000);
            updateCarousel(0);
        }

        initShare() {
            if (!this.elements.shareBtn) return;

            this.elements.shareBtn.addEventListener('click', () => {
                this.elements.shareUrlInput.value = window.location.href;
                this.elements.shareModal.classList.remove('hidden');
                this.elements.shareModal.classList.add('flex');
                this.generateQRCode(window.location.href);
            });

            this.elements.closeShareModalBtn.addEventListener('click', () => {
                this.elements.shareModal.classList.add('hidden');
                this.elements.shareModal.classList.remove('flex');
            });

            this.elements.copyUrlBtn.addEventListener('click', () => {
                this.elements.shareUrlInput.select();
                document.execCommand('copy');
                this.elements.copyUrlBtn.textContent = 'Copied!';
                setTimeout(() => {
                    this.elements.copyUrlBtn.textContent = 'Copy';
                }, 2000);
            });
        }

        generateQRCode(url) {
            if (!this.elements.qrCodeContainer) return;
            const container = this.elements.qrCodeContainer;
            const wrapper = container.parentElement;
            // Use wrapper's inner box size (minus padding) for QR size
            let wrapperSize = 300;
            if (wrapper) {
                const cs = getComputedStyle(wrapper);
                const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
                wrapperSize = wrapper.clientWidth - padX;
            }
            const size = Math.max(120, Math.min(320, wrapperSize));
            container.innerHTML = '';
            new QRCode(container, {
                text: url,
                width: size,
                height: size,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            // Store last URL for resize regeneration
            this._lastQrUrl = url;
            if (!this._qrResizeHandler) {
                this._qrResizeHandler = () => {
                    // Debounce
                    clearTimeout(this._qrResizeTimer);
                    this._qrResizeTimer = setTimeout(() => {
                        if (this.elements.shareModal && !this.elements.shareModal.classList.contains('hidden')) {
                            this.generateQRCode(this._lastQrUrl || window.location.href);
                        }
                    }, 150);
                };
                window.addEventListener('resize', this._qrResizeHandler);
            }
        }

        setupGestures() {
            let initialDistance = null;
            let initialZoomLevel = this.zoomLevel;

            const getDistance = (touches) => {
                const [touch1, touch2] = touches;
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                return Math.sqrt(dx * dx + dy * dy);
            };

            this.elements.imageContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    initialDistance = getDistance(e.touches);
                    initialZoomLevel = this.zoomLevel;
                } else if (e.touches.length === 1) {
                    this.startPanDrag(e);
                }
            });

            this.elements.imageContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && initialDistance) {
                    const currentDistance = getDistance(e.touches);
                    const scaleFactor = currentDistance / initialDistance;
                    this.zoomLevel = Math.max(0.5, Math.min(initialZoomLevel * scaleFactor, 10));
                    this.applyTransform();
                    e.preventDefault();
                } else if (e.touches.length === 1) {
                    this.panDrag(e);
                }
            });

            this.elements.imageContainer.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) {
                    initialDistance = null;
                }
                this.endPanDrag();
            });
        }

        setupDownloadButton() {
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 13.95C13.7485 13.95 13.95 13.7485 13.95 13.5C13.95 13.2514 13.7485 13.05 13.5 13.05L1.49995 13.05C1.25142 13.05 1.04995 13.2514 1.04995 13.5C1.04995 13.7485 1.25142 13.95 1.49995 13.95L13.5 13.95ZM11.0681 7.5683C11.2439 7.39257 11.2439 7.10764 11.0681 6.93191C10.8924 6.75617 10.6075 6.75617 10.4317 6.93191L7.94993 9.41371L7.94993 1.49998C7.94993 1.25146 7.74846 1.04998 7.49993 1.04998C7.2514 1.04998 7.04993 1.25146 7.04993 1.49998L7.04993 9.41371L4.56813 6.93191C4.39239 6.75617 4.10746 6.75617 3.93173 6.93191C3.75599 7.10764 3.75599 7.39257 3.93173 7.5683L7.18173 10.8183C7.35746 10.994 7.64239 10.994 7.81812 10.8183L11.0681 7.5683Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>`;

            downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = this.elements.modalImage.src;
                const team = this.teams[this.currentTeamIndex];
                const id = this.shouldHideTeamData() ? team.rank : team.team_number;
                link.download = `${id}-gcc-photography.avif`;
                link.click();
            });
        }

        // Ensure modal truly visible: multiple RAF + timeout checks; reassert classes/styles if tampered.
        ensureModalVisibility(seqAtOpen) {
            const modal = this.elements.modal;
            const debugOn = new URLSearchParams(location.search).has('debug');
            let attempts = 0;
            const maxAttempts = 6; // ~3 frames + a couple of timers
            const reassert = () => {
                // Abort if a newer open/close happened
                if (seqAtOpen !== this._openSeq) return;
                if (!modal) return;
                const hidden = modal.classList.contains('hidden');
                const displayNone = getComputedStyle(modal).display === 'none';
                if (hidden || displayNone) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    modal.style.display = 'flex';
                    modal.style.opacity = '1';
                    modal.style.zIndex = '9999';
                    if (debugOn) console.debug('[gallery] reassert modal visibility', {attempts});
                }
                if (++attempts < maxAttempts) {
                    if (attempts <= 3) {
                        requestAnimationFrame(reassert);
                    } else {
                        setTimeout(reassert, 60 * attempts);
                    }
                } else if (debugOn) {
                    console.debug('[gallery] finalize ensureModalVisibility', {classList:[...modal.classList], display:getComputedStyle(modal).display});
                }
            };
            requestAnimationFrame(reassert);
        }
    }

    // This is a placeholder replacement. The actual data will be injected by the build script.
    // For development, you can replace this with a fetch call to a local teams.json and config.yaml
    let teams, config;
    try {
        // In a generated file, these placeholders are replaced with actual JSON.
        teams = TEAMS_DATA_PLACEHOLDER;
        config = CONFIG_DATA_PLACEHOLDER;
        // Expose globally for fallback shim / debugging
        window.__GALLERY_TEAMS__ = teams;
        window.__GALLERY_CONFIG__ = config;
        if (!galleryInstance) {
            galleryInstance = new PhotoGallery(teams, config);
            // Ensure global reference for reliability block & external scripts
            window.galleryInstance = galleryInstance;
            // Diagnostic helper
            window.galleryDiag = () => {
                const inst = window.galleryInstance;
                if (!inst) return null;
                const m = inst.elements.modal;
                return {
                    modalClasses: m? [...m.classList]:[],
                    modalComputedDisplay: m? getComputedStyle(m).display:undefined,
                    modalInline: m? {display:m.style.display, opacity:m.style.opacity}: {},
                    bodyOverflow: document.body.style.overflow,
                    currentIndex: inst.currentTeamIndex,
                    currentTeam: inst.teams[inst.currentTeamIndex]?.team_number,
                    url: location.href
                };
            };
        }
    } catch (e) {
        // Fallback for development when viewing the template directly
        console.log("Could not parse inline data, fetching from files...");
        Promise.all([
            fetch('../teams.yaml').then(res => res.text()).then(text => jsyaml.load(text).teams),
            fetch('../config.yaml').then(res => res.text()).then(text => jsyaml.load(text))
        ]).then(([teamsData, configData]) => {
            new PhotoGallery(teamsData, configData);
        }).catch(err => {
            console.error("Error fetching data for development:", err);
            document.getElementById('galleryGrid').innerHTML = '<p class="text-red-500">Error loading team data. Please run the generation script.</p>';
        });
    }
});

/* --- Reliability / Delegated Click + Watchdog Block ---
   Goal: Address intermittent issue where clicking certain areas of a card updates the URL but
   the modal does not become visible. Adds:
   1. Capture-phase delegated click handler (and mousedown) to aggressively detect card intent.
   2. Consistency watchdog that re-opens modal if URL ?id=... present but modal hidden.
   3. popstate listener + periodic poll for deep links.
   4. Optional debug logging enabled via ?debug (add &debug to URL).
*/
(function(){
    if (window.__GALLERY_RELIABILITY__) return; // singleton
    window.__GALLERY_RELIABILITY__ = true;
    const debug = new URLSearchParams(location.search).has('debug');
    const log = (...args) => { if (debug) console.debug('[gallery-rel]', ...args); };
    let lastUserCardIndex = null;

    function findCardIndexFromEvent(ev){
        const target = ev.target;
        if (!target) return null;
        const card = target.closest && target.closest('.team-card');
        if (!card || !card.dataset.index) return null;
        const idx = parseInt(card.dataset.index, 10);
        return isNaN(idx) ? null : idx;
    }

    // Mousedown early capture to remember intent before any other handler might stop propagation.
    document.addEventListener('mousedown', (e)=>{
        const idx = findCardIndexFromEvent(e);
        if (idx != null) {
            lastUserCardIndex = idx;
            log('capture mousedown on card', idx);
        }
    }, true);

    // Click capture: ensure modal opens even if direct listener was somehow skipped.
    document.addEventListener('click', (e)=>{
        const idx = findCardIndexFromEvent(e);
        if (idx != null) {
            lastUserCardIndex = idx;
            const inst = window.galleryInstance;
            if (inst && inst.elements && inst.elements.modal.classList.contains('hidden')) {
                log('delegated click open attempt', idx);
                try { inst.openModal(idx); } catch(err){ log('openModal error', err); }
                setTimeout(checkConsistency, 120);
            }
        }
    }, true);

    function resolveIndexFromId(id){
        if (!window.galleryInstance) return null;
        const g = galleryInstance;
        const idx = g.teams.findIndex(t => {
            if (g.shouldHideTeamData()) {
                return t.rank != null && t.rank.toString() === id;
            }
            return t.team_number === id;
        });
        return idx >= 0 ? idx : null;
    }

    function checkConsistency(){
    const inst = window.galleryInstance;
    if (!inst || !inst.elements) return;
    const modal = inst.elements.modal;
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        if (!id) return;
        if (modal.classList.contains('hidden')) {
            const idx = resolveIndexFromId(id);
            if (idx != null) {
                log('watchdog reopening modal for id', id, 'idx', idx);
                try { inst.openModal(idx); } catch(err){ log('reopen error', err); }
            } else {
                log('watchdog id present but no team match', id);
            }
        }
    }

    // Deep-link support & history navigation resilience.
    window.addEventListener('popstate', () => {
        log('popstate');
        setTimeout(checkConsistency, 50);
    });

    // Periodic poll (low frequency) to catch any external code hiding modal.
    const POLL_MS = 4000;
    setInterval(checkConsistency, POLL_MS);

    // Initial consistency check after main script likely initialized.
    setTimeout(checkConsistency, 500);
})();
/* --- End Reliability Block --- */

/* --- Fallback Modal + Video Shim (appended) ---
     Purpose: In case upstream build trimming removed class methods (openModal/updateModalContent),
     this lightweight shim re-enables fullscreen preview with coexistence of image + YouTube video.
     It only activates if required DOM elements exist and no other openModal is defined globally. */
(function(){
    if (window._galleryShimApplied) return;
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    const iframe = document.getElementById('modalVideo');
    if (!modal || !img || !iframe) return; // nothing to do
    // If a proper gallery instance exists with openModal method, exit; else continue.
    if (window.galleryInstance && typeof window.galleryInstance.openModal === 'function') {
        return; // primary logic active; no shim needed
    }
    window._galleryShimApplied = true;
    console.warn('[gallery-shim] Activating fallback modal/video logic');

    // Acquire teams data injected earlier
    const teams = (window.__GALLERY_TEAMS__) ? window.__GALLERY_TEAMS__ : (typeof TEAMS_DATA_PLACEHOLDER !== 'undefined' ? TEAMS_DATA_PLACEHOLDER : []);
    let current = 0;

    function getTeam(i){ return teams[i]; }
    function hide(el){ if(el){ el.classList.add('hidden'); el.style.display='none'; } }
    function show(el,display='block'){ if(el){ el.classList.remove('hidden'); el.style.display=display; } }
    function pauseVideo(){ if(!iframe || iframe.classList.contains('hidden')) return; try{ iframe.contentWindow.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:''}), '*'); }catch(e){} }

    function update(){
        const team = getTeam(current);
        if(!team) return;
        const nameEl = document.getElementById('modalTeamName');
        const downloadBtn = document.getElementById('downloadBtn');
        if (team.is_video && team.video_embed_url){
            // Video mode
            pauseVideo();
            iframe.src = team.video_embed_url + '?rel=0&enablejsapi=1';
            show(iframe);
            hide(img);
            iframe.style.objectFit='contain';
            iframe.style.padding='80px 60px 140px 60px';
            if (nameEl) nameEl.textContent = team.teamName || ('Submission #' + (team.rank||'?'));
            const ctr = document.getElementById('image-controls'); if (ctr) ctr.style.visibility='hidden';
            const hint = modal.querySelector('.text-xs.text-gray-400'); if (hint) hint.style.display='none';
            if (downloadBtn) downloadBtn.style.display='none';
        } else {
            // Image mode
            pauseVideo();
            hide(iframe); iframe.style.padding='';
            if (team.images && team.images.length) {
                if (img.src !== team.images[0]) img.src = team.images[0];
                img.alt = team.teamName || 'Submission';
            } else { img.src=''; img.alt='No image'; }
            show(img,'block');
            const ctr = document.getElementById('image-controls'); if (ctr) ctr.style.visibility='visible';
            const hint = modal.querySelector('.text-xs.text-gray-400'); if (hint) hint.style.display='';
            if (nameEl) nameEl.textContent = team.teamName || ('Submission #' + (team.rank||'?'));
            // Reset transforms
            img.style.transform = 'scale(1) translate(0px,0px)';
            if (downloadBtn) downloadBtn.style.display='';
        }
    }

    function open(idx){
        current = idx;
        update();
        show(modal,'flex');
        document.body.style.overflow='hidden';
        const team = getTeam(current);
        if (!(team && team.is_video && team.video_embed_url)) {
            // Ensure image element is visible and iframe hidden (belt & suspenders)
            img.classList.remove('hidden');
            img.style.display='block';
            iframe.classList.add('hidden');
            iframe.style.display='none';
        }
    }
    function close(){ pauseVideo(); hide(modal); document.body.style.overflow=''; }
    function next(){ pauseVideo(); current = (current+1)%teams.length; update(); }
    function prev(){ pauseVideo(); current = (current-1+teams.length)%teams.length; update(); }

    // Wire gallery cards (by order) if they exist
    const cards = document.querySelectorAll('[data-index]');
    if (cards.length){
        cards.forEach(card=>{ card.addEventListener('click', ()=> open(parseInt(card.dataset.index,10))); });
    } else {
        // If no cards (edge dev case), open first team automatically to prove image mode works
        if (teams.length){ open(0); }
    }

    document.getElementById('closeModal')?.addEventListener('click', close);
    document.getElementById('nextBtn')?.addEventListener('click', next);
    document.getElementById('prevBtn')?.addEventListener('click', prev);
    document.addEventListener('keydown', e=>{
        if (modal.classList.contains('flex')){
            if (e.key==='Escape') close();
            else if (e.key==='ArrowRight') next();
            else if (e.key==='ArrowLeft') prev();
        }
    });
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) pauseVideo(); });
})();
/* --- End Fallback Shim --- */
