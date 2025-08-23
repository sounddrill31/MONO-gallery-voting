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
            };

            this.init();
        }

        init() {
            this.renderGallery();
            this.setupEventListeners();
            this.handleURLParameters();
            this.setupCountdown();
            this.updateVoteLink();
            this.initHeroCarousel();
            this.initShare();
            this.setupPinchToZoom();
            this.setupGestures();
            this.setupDownloadButton();
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
            if (!this.config.show_countdown) {
                if (this.elements.countdown) this.elements.countdown.style.display = 'none';
                if (this.elements.countdownTitle) this.elements.countdownTitle.style.display = 'none';
                return;
            }

            const openTime = new Date(this.config.deadlines.open).getTime();
            const closeTime = new Date(this.config.deadlines.close).getTime();

            const update = () => {
                const now = new Date().getTime();
                let targetTime, title;

                if (now < openTime) {
                    targetTime = openTime;
                    title = "Voting Opens In";
                } else if (now < closeTime) {
                    targetTime = closeTime;
                    title = "Voting Closes In";
                } else {
                    this.elements.countdown.innerHTML = "";
                    this.elements.countdownTitle.textContent = "Voting has ended.";
                    this.elements.voteLink.classList.add('hidden');
                    return;
                }

                this.elements.countdownTitle.textContent = title;
                const distance = targetTime - now;

                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                this.elements.countdown.innerHTML = `
                    <div class="countdown-box"><div class="value">${days}</div><div class="label">Days</div></div>
                    <div class="countdown-box"><div class="value">${hours}</div><div class="label">Hours</div></div>
                    <div class="countdown-box"><div class="value">${minutes}</div><div class="label">Minutes</div></div>
                    <div class="countdown-box"><div class="value">${seconds}</div><div class="label">Seconds</div></div>
                `;
            };

            update();
            setInterval(update, 1000);
        }
        
        updateVoteLink() {
            if (this.config.forms_url && this.elements.voteLink) {
                this.elements.voteLink.href = this.config.forms_url;
            }
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

            this.elements.carouselNextBtn.addEventListener('click', () => updateCarousel(currentSlide + 1));
            this.elements.carouselPrevBtn.addEventListener('click', () => updateCarousel(currentSlide - 1));
            this.elements.carouselDots.addEventListener('click', (e) => {
                if (e.target.classList.contains('dot')) {
                    updateCarousel(parseInt(e.target.dataset.index));
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
            this.elements.qrCodeContainer.innerHTML = '';
            new QRCode(this.elements.qrCodeContainer, {
                text: url,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
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
