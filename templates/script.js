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

        init() {
            // Determine current phase
            const now = Date.now();
            this.phase = this.determinePhase(now);
            // Schedule a reload exactly when the next phase change boundary occurs
            this.schedulePhaseChangeReload(now);

            // Handle gallery and carousel visibility based on phase and config
            const mainElement = document.querySelector('main');
            const countdownSection = document.querySelector('section.text-center');
            const carouselWrapper = document.querySelector('.carousel-wrapper');
            const galleryGrid = this.elements.galleryGrid;
            const galleryHeading = document.querySelector('h3');
            const hrs = document.querySelectorAll('hr');

            // Gallery visibility logic
            let showGallery = false;
            if (this.config.show_gallery === 'all') {
                showGallery = true;
            } else if (this.config.show_gallery === 'submission' && this.phase === 'submission') {
                showGallery = true;
            } else if (this.config.show_gallery === 'voting' && this.phase === 'voting') {
                showGallery = true;
            }

            if (!showGallery) {
                if (carouselWrapper) carouselWrapper.style.display = 'none';
                if (galleryGrid) galleryGrid.style.display = 'none';
                if (galleryHeading) galleryHeading.style.display = 'none';
                hrs.forEach(hr => hr.style.display = 'none');
                if (countdownSection) {
                    countdownSection.classList.add('center-content', 'section-spacing');
                }
            } else {
                this.renderGallery();
                this.initHeroCarousel();
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

            // Countdown visibility
            if (this.elements.countdown && this.elements.countdownTitle) {
                if (this.config.show_countdown === 'none') {
                    this.elements.countdown.style.display = 'none';
                    this.elements.countdownTitle.style.display = 'none';
                } else if (this.config.show_countdown === 'all') {
                    this.elements.countdown.style.display = '';
                    this.elements.countdownTitle.style.display = '';
                } else if (this.config.show_countdown === 'submission' && this.phase === 'submission') {
                    this.elements.countdown.style.display = '';
                    this.elements.countdownTitle.style.display = '';
                } else if (this.config.show_countdown === 'voting' && this.phase === 'voting') {
                    this.elements.countdown.style.display = '';
                    this.elements.countdownTitle.style.display = '';
                } else {
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
            this.prepareResultsData();
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
            if (this._resultsPrepared) return;
            this._resultsPrepared = true;
            this.computeWinners();
            this.buildPublicVoteChart();
            this.renderExtraStats();
        }

        computeWinners() {
            const teamsSorted = [...this.teams].sort((a,b)=> {
                const ra = parseFloat(a.rank) || 9999;
                const rb = parseFloat(b.rank) || 9999;
                return ra - rb;
            });
            this._winners = teamsSorted.slice(0,3);
            const winnersList = document.getElementById('winnersList');
            if (winnersList && winnersList.children.length===0) {
                this._winners.forEach((team,idx)=>{
                    const medal = idx===0?'🥇':idx===1?'🥈':'🥉';
                    const percent = (team.public_vote_percent!=null)? `<span class="text-xs block mt-1 opacity-70">${team.public_vote_percent}% public vote</span>`: '';
                    const card = document.createElement('div');
                    card.className='winner-card mono-border p-4 flex flex-col gap-3';
                    card.innerHTML = `
                        <div class="aspect-square overflow-hidden border border-black/20">
                            <img src="${team.images[0]}" alt="${team.teamName}" class="object-cover w-full h-full" />
                        </div>
                        <div>
                            <h4 class="font-bold tracking-wide text-sm">${medal} ${this.config.hide_team_data? 'Submission #'+team.rank : team.teamName}</h4>
                            ${percent}
                        </div>`;
                    winnersList.appendChild(card);
                });
            }
            const gallery = document.getElementById('winnerGallery');
            if (gallery && gallery.children.length===0) {
                const sortedByVote = [...this.teams].sort((a,b)=>{
                    const av = (a.public_vote_percent==null)? -1 : a.public_vote_percent;
                    const bv = (b.public_vote_percent==null)? -1 : b.public_vote_percent;
                    if (bv !== av) return bv - av;
                    const ar = parseFloat(a.rank)||9999; const br = parseFloat(b.rank)||9999; return ar - br;
                });
                sortedByVote.forEach((team,index)=>{
                    const medal = index<3 ? (index===0?'🥇':index===1?'🥈':'🥉') : '';
                    const card = document.createElement('div');
                    card.className='winner-gallery-card flex flex-col border border-black/30 bg-white hover:shadow-md transition-shadow';
                    card.innerHTML = `
                        <div class="h-40 overflow-hidden"><img src="${team.images[0]}" alt="${team.teamName}" class="object-cover w-full h-full" /></div>
                        <div class="p-3 flex flex-col flex-grow">
                            <div class="flex items-center justify-between text-xs font-mono mb-1">
                                <span class="font-bold">${this.config.hide_team_data? '#'+team.rank : team.teamName}</span>
                                <span>${medal}</span>
                            </div>
                            <div class="text-[10px] opacity-70 mt-auto">${team.public_vote_percent!=null? team.public_vote_percent + '% vote' : ''}</div>
                        </div>`;
                    gallery.appendChild(card);
                });
            }
        }

        buildPublicVoteChart() {
            const container = document.getElementById('publicVoteChart');
            if (!container || container.childElementCount>0) return;
            const data = this.teams.filter(t=> typeof t.public_vote_percent === 'number' && !isNaN(t.public_vote_percent));
            if (!data.length) {
                container.innerHTML = '<p class="text-sm opacity-60">No public vote data available.</p>';
                return;
            }
            const total = data.reduce((sum,t)=> sum + t.public_vote_percent, 0) || 1;
            let cumulative = 0;
            const size = 260; const radius = size/2; const stroke = radius;
            const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
            svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
            svg.classList.add('mono-pie');
            data.sort((a,b)=> b.public_vote_percent - a.public_vote_percent);
            data.forEach((t,i)=>{
                const value = t.public_vote_percent;
                const frac = value/total;
                const dash = frac * Math.PI * 2 * radius;
                const gap = Math.PI * 2 * radius - dash;
                const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
                circle.setAttribute('r', radius.toString());
                circle.setAttribute('cx', radius.toString());
                circle.setAttribute('cy', radius.toString());
                circle.setAttribute('fill','transparent');
                circle.setAttribute('stroke',`hsl(0,0%,${15 + i*8}%)`);
                circle.setAttribute('stroke-width', stroke.toString());
                circle.setAttribute('stroke-dasharray', `${dash} ${gap}`);
                circle.setAttribute('stroke-dashoffset', (-cumulative * Math.PI * 2 * radius).toString());
                circle.setAttribute('data-label', this.config.hide_team_data? '#'+t.rank : t.teamName);
                svg.appendChild(circle);
                cumulative += frac;
            });
            container.appendChild(svg);
            const legend = document.getElementById('publicVoteLegend');
            if (legend && legend.childElementCount===0) {
                data.forEach((t,i)=>{
                    const item = document.createElement('div');
                    item.className='flex items-center gap-1';
                    item.innerHTML = `<span class="inline-block w-3 h-3" style="background:hsl(0,0%,${15+i*8}%);"></span><span class="text-[10px] uppercase tracking-wide">${this.config.hide_team_data? '#'+t.rank : t.teamName} – ${t.public_vote_percent}%</span>`;
                    legend.appendChild(item);
                });
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
            const flag = this.config.show_features || 'none';
            const features = Array.isArray(this.config.features) ? this.config.features : [];
            const hasFeatures = features.length > 0;
            if (!this.elements.featuresSection) return;

            // Determine if we should show based on phase & flag
            let show = false;
            if (hasFeatures) {
                if (flag === 'all') show = true;
                else if (flag === 'submission' && this.phase === 'submission') show = true;
                else if (flag === 'voting' && this.phase === 'voting') show = true;
            }
            if (!show) {
                this.elements.featuresSection.classList.add('hidden');
                return;
            }

            // Render only once or if grid empty
            if (this.elements.featuresGrid && this.elements.featuresGrid.children.length === 0) {
                features.forEach(f => {
                    const card = document.createElement('div');
                    card.className = 'feature-card';
                    // Insert HTML directly (trusted config). If untrusted, sanitize separately.
                    card.innerHTML = `
                        <h3>${f.title || ''}</h3>
                        <p>${f.description || ''}</p>
                    `;
                    this.elements.featuresGrid.appendChild(card);
                });
            }
            // Dynamically set optimal columns to reduce vertical scroll
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

            if (submitOpen && nowTs < submitOpen) return 'pre-submission';
            if (submitOpen && submitClose && nowTs >= submitOpen && nowTs < submitClose) return 'submission';
            if (votingOpen && nowTs < votingOpen) return 'between';
            if (votingOpen && votingClose && nowTs >= votingOpen && nowTs < votingClose) return 'voting';
            if (votingClose && nowTs >= votingClose) return 'results';
            return 'none';
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
                        <img src="${team.images[0]}" alt="${team.teamName}" class="w-full h-full object-cover">
                    </div>
                    <div class="p-4">
                        <h3 class="font-bold text-lg truncate">${team.teamName}</h3>
                    </div>
                `;
                card.addEventListener('click', () => this.openModal(index));
                this.elements.galleryGrid.appendChild(card);
            });
        }

        openModal(index) {
            this.currentTeamIndex = index;
            this.updateModalContent();
            this.elements.modal.classList.remove('hidden');
            this.elements.modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
            this.updateURL();
        }

        closeModal() {
            this.elements.modal.classList.add('hidden');
            this.elements.modal.classList.remove('flex');
            document.body.style.overflow = '';
            this.resetPanZoom();
            this.updateURL(true);
        }

        updateModalContent() {
            const team = this.teams[this.currentTeamIndex];
            // Ensure the image URL is valid and set it to the modal image
            if (team.images && team.images.length > 0) {
                const imageUrl = team.images[0];
                this.elements.modalImage.src = imageUrl;
                this.elements.modalImage.alt = `Image for ${team.teamName}`;
                this.elements.modalImage.classList.add('loaded'); // Ensure the image is visible
            } else {
                this.elements.modalImage.src = '';
                this.elements.modalImage.alt = 'No image available';
                this.elements.modalImage.classList.remove('loaded'); // Hide the image if no URL is available
            }

            this.elements.modalTeamName.textContent = team.teamName;
            this.resetPanZoom();
        }

        nextTeam() {
            this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
            this.updateModalContent();
            this.updateURL();
        }

        prevTeam() {
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
                    if (this.config.hide_team_data) {
                        return t.rank.toString() === id;
                    } else {
                        return t.team_number === id;
                    }
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
                const id = this.config.hide_team_data ? team.rank : team.team_number;
                url.searchParams.set('id', id);
            }
            history.pushState({}, '', url);
        }

        setupCountdown() {
            const { deadlines, show_countdown, show_results } = this.config;
            const { countdown, countdownTitle } = this.elements;

            if (!show_countdown || show_countdown === 'none') {
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

                // Countdown visibility based on config
                const isVisible = show_countdown === 'all' ||
                                  (show_countdown === 'submission' && (phase === 'before-submission' || phase === 'submission')) ||
                                  (show_countdown === 'voting' && (phase === 'before-voting' || phase === 'voting'));

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
                caption.textContent = this.config.hide_team_data ? `Submission #${team.rank}` : team.teamName;
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
                const id = this.config.hide_team_data ? team.rank : team.team_number;
                link.download = `${id}-gcc-photography.avif`;
                link.click();
            });
        }
    }

    // This is a placeholder replacement. The actual data will be injected by the build script.
    // For development, you can replace this with a fetch call to a local teams.json and config.yaml
    let teams, config;
    try {
        // In a generated file, these placeholders are replaced with actual JSON.
        const teams = TEAMS_DATA_PLACEHOLDER;
        const config = CONFIG_DATA_PLACEHOLDER;
        if (!galleryInstance) {
            galleryInstance = new PhotoGallery(teams, config);
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
