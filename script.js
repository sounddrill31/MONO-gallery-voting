class ImageGallery {
    constructor() {
        this.images = [];
        this.currentSlide = 0;
        this.modalCurrentSlide = 0;
        this.imageTransforms = new Map(); // Track image transformations
        this.autoPlayInterval = null;
        this.initializeElements();
        this.init();
    }

    async init() {
        this.showLoading();
        try {
            const res = await fetch('teams.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            // Convert JSON to internal list
            this.images = data.map(team => ({
                src: team.image,
                filename: team.image.split('/').pop(),
                folder: team.image.split('/').slice(-2, -1)[0] || '',
                teamName: team.teamName,
                description: team.description || ''
            }));

            if (this.images.length === 0) {
                this.showError("No teams found in teams.json");
                return;
            }

            this.hideLoading();
            this.renderCarousel();
            this.showCarousel();
            this.startAutoPlay();
        } catch (err) {
            console.error("Failed to load teams.json", err);
            this.hideLoading();
            this.showError("Error loading team data");
        }
    }

    initializeElements() {
        this.carousel = document.getElementById('carousel');
        this.carouselContainer = document.getElementById('carouselContainer');
        this.dotsContainer = document.getElementById('carouselDots');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');

        // Modal elements
        this.imageModal = document.getElementById('imageModal');
        this.modalImage = document.getElementById('modalImage');
        this.modalFilename = document.getElementById('modalFilename');
        this.previewLoading = document.getElementById('previewLoading');
        this.closeModal = document.getElementById('closeModal');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.modalPrevBtn = document.getElementById('modalPrevBtn');
        this.modalNextBtn = document.getElementById('modalNextBtn');
        this.flipLeftBtn = document.getElementById('flipLeftBtn');
        this.flipRightBtn = document.getElementById('flipRightBtn');

        // Voting modal
        this.votingModal = document.getElementById('votingModal');
        this.votingBtn = document.getElementById('votingBtn');
        this.closeVoting = document.getElementById('closeVoting');

        // Share modal
        this.shareModal = document.getElementById('shareModal');
        this.shareBtn = document.getElementById('shareBtn');
        this.closeShare = document.getElementById('closeShare');
        this.shareUrl = document.getElementById('shareUrl');
        this.copyUrlBtn = document.getElementById('copyUrlBtn');
        this.qrCode = document.getElementById('qrCode');

        // New elements for additional features
        this.votingBtn2 = document.getElementById('votingBtn2');
        this.liveResultsBtn = document.getElementById('liveResultsBtn');
        this.liveResultsModal = document.getElementById('liveResultsModal');
        this.closeLiveResults = document.getElementById('closeLiveResults');

        // Event listeners
        this.prevBtn.addEventListener('click', () => this.previousSlide());
        this.nextBtn.addEventListener('click', () => this.nextSlide());
        this.carouselContainer.addEventListener('mouseenter', () => this.pauseAutoPlay());
        this.carouselContainer.addEventListener('mouseleave', () => this.startAutoPlay());
        document.addEventListener('keydown', (e) => this.keyHandler(e));

        // Modal controls
        this.closeModal.addEventListener('click', () => this.closeImagePreview());
        this.imageModal.addEventListener('click', (e) => {
            if (e.target === this.imageModal) this.closeImagePreview();
        });
        this.modalPrevBtn.addEventListener('click', () => this.modalPreviousImage());
        this.modalNextBtn.addEventListener('click', () => this.modalNextImage());

        // Image controls
        this.flipLeftBtn.addEventListener('click', () => this.flipImageLeft());
        this.flipRightBtn.addEventListener('click', () => this.flipImageRight());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.copyBtn.addEventListener('click', () => this.copyImage());

        // Voting form
        this.votingBtn.addEventListener('click', () => this.openVotingForm());
        this.closeVoting.addEventListener('click', () => this.closeVotingForm());
        this.votingModal.addEventListener('click', (e) => {
            if (e.target === this.votingModal) this.closeVotingForm();
        });

        // Share functionality
        this.shareBtn.addEventListener('click', () => this.openShareForm());
        this.closeShare.addEventListener('click', () => this.closeShareForm());
        this.shareModal.addEventListener('click', (e) => {
            if (e.target === this.shareModal) this.closeShareForm();
        });
        this.copyUrlBtn.addEventListener('click', () => this.copyUrl());

        // New event listeners for new buttons/modals
        this.votingBtn2.addEventListener('click', () => this.openVotingForm());
        this.liveResultsBtn.addEventListener('click', () => this.openLiveResults());
        this.closeLiveResults.addEventListener('click', () => this.closeLiveResultsForm());
        this.liveResultsModal.addEventListener('click', (e) => {
            if (e.target === this.liveResultsModal) this.closeLiveResultsForm();
        });
    }

    keyHandler(e) {
        if (this.imageModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                this.closeImagePreview();
                return;
            }
            if (e.key === 'ArrowLeft') this.modalPreviousImage();
            if (e.key === 'ArrowRight') this.modalNextImage();
            if (e.key === 'f' || e.key === 'F') this.flipImageLeft();
            if (e.key === 'g' || e.key === 'G') this.flipImageRight();
            return;
        }

        if (this.votingModal.classList.contains('active') || this.shareModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                this.closeVotingForm();
                this.closeShareForm();
            }
            return;
        }

        if (e.key === 'ArrowLeft') this.previousSlide();
        if (e.key === 'ArrowRight') this.nextSlide();
    }

    renderCarousel() {
        this.carousel.innerHTML = '';
        this.dotsContainer.innerHTML = '';

        this.images.forEach((img, idx) => {
            // Create slide
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.dataset.index = idx;

            const imageEl = document.createElement('img');
            imageEl.src = img.src;
            imageEl.alt = img.teamName || img.filename;
            imageEl.addEventListener('click', () => this.openImagePreview(idx));

            const label = document.createElement('div');
            label.className = 'slide-label';
            label.textContent = img.teamName || `${img.folder}/${img.filename}`;

            slide.appendChild(imageEl);
            slide.appendChild(label);
            this.carousel.appendChild(slide);

            // Create dot
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.addEventListener('click', () => this.goToSlide(idx));
            this.dotsContainer.appendChild(dot);
        });

        this.updateCarousel();
    }

    updateCarousel() {
        const slides = this.carousel.querySelectorAll('.carousel-slide');
        const dots = this.dotsContainer.querySelectorAll('.dot');

        slides.forEach((slide, idx) => {
            slide.className = 'carousel-slide';
            if (idx === this.currentSlide) {
                slide.classList.add('active');
            } else if (idx === this.getPrevIndex()) {
                slide.classList.add('prev');
            } else if (idx === this.getNextIndex()) {
                slide.classList.add('next');
            } else {
                slide.classList.add('hidden');
            }
        });

        // Update dots
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === this.currentSlide);
        });
    }

    getPrevIndex() {
        return (this.currentSlide - 1 + this.images.length) % this.images.length;
    }

    getNextIndex() {
        return (this.currentSlide + 1) % this.images.length;
    }

    goToSlide(i) {
        this.currentSlide = i;
        this.updateCarousel();
        this.resetAutoPlay();
    }

    nextSlide() {
        this.currentSlide = (this.currentSlide + 1) % this.images.length;
        this.updateCarousel();
        this.resetAutoPlay();
    }

    previousSlide() {
        this.currentSlide = (this.currentSlide - 1 + this.images.length) % this.images.length;
        this.updateCarousel();
        this.resetAutoPlay();
    }

    // Modal navigation methods
    modalNextImage() {
        this.modalCurrentSlide = (this.modalCurrentSlide + 1) % this.images.length;
        this.updateModalImage();
    }

    modalPreviousImage() {
        this.modalCurrentSlide = (this.modalCurrentSlide - 1 + this.images.length) % this.images.length;
        this.updateModalImage();
    }

    updateModalImage() {
        const img = this.images[this.modalCurrentSlide];
        this.modalFilename.textContent = img.teamName || img.filename;
        this.modalImage.classList.remove('loaded');
        this.previewLoading.style.display = 'block';

        // Reset image transforms when changing images
        this.resetImageTransform();

        const hiRes = new Image();
        hiRes.onload = () => {
            this.modalImage.src = img.src;
            this.modalImage.classList.add('loaded');
            this.previewLoading.style.display = 'none';
        };
        hiRes.onerror = () => {
            this.previewLoading.style.display = 'none';
            this.modalImage.alt = 'Failed to load image';
        };
        hiRes.src = img.src;
    }

    // Image flip controls
    resetImageTransform() {
        this.modalImage.style.transform = '';
    }

    flipImageLeft() {
      const imageKey = this.modalCurrentSlide;
      const t = this.imageTransforms.get(imageKey) || { scaleX: 1, scaleY: 1, rotate: 0 };
      t.rotate = (t.rotate - 90) % 360;
      this.imageTransforms.set(imageKey, t);
      this.applyImageTransform();
    }


    flipImageRight() {
      const imageKey = this.modalCurrentSlide;
      const t = this.imageTransforms.get(imageKey) || { scaleX: 1, scaleY: 1, rotate: 0 };
      t.rotate = (t.rotate + 90) % 360;
      this.imageTransforms.set(imageKey, t);
      this.applyImageTransform();
    }

    applyImageTransform() {
      const imageKey = this.modalCurrentSlide;
      const t = this.imageTransforms.get(imageKey) || { scaleX: 1, scaleY: 1, rotate: 0 };
    
      const { scaleX = 1, scaleY = 1, rotate = 0 } = t;
    
      // Apply rotation and scale; order matters: functions are applied right-to-left.
      // Using "rotate(...) scale(...)" is standard for images.
      this.modalImage.style.transform = `rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`;
    
      // Keep rotation around the visual center to avoid unexpected shifts
      this.modalImage.style.transformOrigin = 'center center';
    }

    startAutoPlay() {
        if (this.images.length <= 1) return;
        this.autoPlayInterval = setInterval(() => this.nextSlide(), 4000);
    }

    pauseAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    resetAutoPlay() {
        this.pauseAutoPlay();
        this.startAutoPlay();
    }

    openImagePreview(i) {
        this.modalCurrentSlide = i;
        this.updateModalImage();
        this.imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.pauseAutoPlay();
    }

    closeImagePreview() {
        this.imageModal.classList.remove('active');
        document.body.style.overflow = '';
        this.startAutoPlay();
    }

    openVotingForm() {
        this.votingModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.pauseAutoPlay();
    }

    closeVotingForm() {
        this.votingModal.classList.remove('active');
        document.body.style.overflow = '';
        this.startAutoPlay();
    }

    openShareForm() {
        // Set current URL
        this.shareUrl.value = window.location.href;
        
        // Generate QR code
        this.generateQRCode(window.location.href);
        
        this.shareModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.pauseAutoPlay();
    }

    closeShareForm() {
        this.shareModal.classList.remove('active');
        document.body.style.overflow = '';
        this.startAutoPlay();
    }

    openLiveResults() {
        this.liveResultsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.pauseAutoPlay();
    }

    closeLiveResultsForm() {
        this.liveResultsModal.classList.remove('active');
        document.body.style.overflow = '';
        this.startAutoPlay();
    }

    generateQRCode(url) {
        this.qrCode.innerHTML = ''; // Clear previous QR code
    
        try {
            // Create a new QRCode instance: this creates and appends the QR code automatically
            new QRCode(this.qrCode, {
                text: url,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (error) {
            console.error('Error generating QR code:', error);
            this.qrCode.innerHTML = '<p>QR code generation failed</p>';
        }
    }

    async copyUrl() {
        try {
            await navigator.clipboard.writeText(this.shareUrl.value);
            this.copyUrlBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyUrlBtn.textContent = 'Copy';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
            this.copyUrlBtn.textContent = 'Failed';
            setTimeout(() => {
                this.copyUrlBtn.textContent = 'Copy';
            }, 2000);
        }
    }

    downloadImage() {
        const img = this.images[this.modalCurrentSlide];
        const a = document.createElement('a');
        a.href = img.src;
        a.download = img.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async copyImage() {
        const img = this.images[this.modalCurrentSlide];
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const res = await fetch(img.src);
                const blob = await res.blob();
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                console.log('Image copied to clipboard');
            } else {
                await navigator.clipboard.writeText(img.src);
                console.log('Image URL copied to clipboard');
            }
        } catch (err) {
            console.error('Copy failed', err);
            try {
                await navigator.clipboard.writeText(img.src);
                console.log('Image URL copied as fallback');
            } catch (fallbackErr) {
                console.error('Fallback copy also failed', fallbackErr);
            }
        }
    }

    showLoading() {
        this.loadingState.style.display = 'block';
        this.carouselContainer.style.display = 'none';
        this.dotsContainer.style.display = 'none';
    }

    hideLoading() {
        this.loadingState.style.display = 'none';
    }

    showCarousel() {
        this.carouselContainer.style.display = 'flex';
        this.dotsContainer.style.display = 'flex';
    }

    showError(msg) {
        this.errorState.querySelector('p').textContent = msg;
        this.errorState.style.display = 'block';
        this.carouselContainer.style.display = 'none';
        this.dotsContainer.style.display = 'none';
    }
}

// Initialize the gallery when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ImageGallery();
});
