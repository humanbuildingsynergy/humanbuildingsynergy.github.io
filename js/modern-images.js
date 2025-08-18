// Modern Image Format Support
// Provides progressive enhancement for WebP and other modern formats

(function() {
    'use strict';
    
    // Check if browser supports WebP
    function supportsWebP() {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = function () {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }
    
    // Create picture element with WebP support
    function createModernPicture(src, alt, className = '') {
        const picture = document.createElement('picture');
        
        // Add WebP source if supported
        const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        const webpSource = document.createElement('source');
        webpSource.srcset = webpSrc;
        webpSource.type = 'image/webp';
        
        // Add AVIF source for even better compression (future)
        const avifSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
        const avifSource = document.createElement('source');
        avifSource.srcset = avifSrc;
        avifSource.type = 'image/avif';
        
        // Fallback image
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        if (className) {
            img.className = className;
        }
        img.loading = 'lazy';
        img.decoding = 'async';
        
        // Assemble picture element
        picture.appendChild(avifSource);
        picture.appendChild(webpSource);
        picture.appendChild(img);
        
        return picture;
    }
    
    // Progressive image loading with fade-in effect
    function addImageLoadEffect() {
        const images = document.querySelectorAll('img[loading="lazy"]');
        
        images.forEach(img => {
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.3s ease';
            
            if (img.complete) {
                img.style.opacity = '1';
            } else {
                img.addEventListener('load', () => {
                    img.style.opacity = '1';
                });
            }
        });
    }
    
    // Add critical image preloading
    function preloadCriticalImages() {
        const criticalImages = [
            '/assets/background/bg-masthead.jpg',
            '/assets/logo/hubs_logo_one_inch.png'
        ];
        
        supportsWebP().then(hasWebP => {
            criticalImages.forEach(src => {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                
                if (hasWebP && src.match(/\.(jpg|jpeg|png)$/i)) {
                    link.href = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
                    link.type = 'image/webp';
                } else {
                    link.href = src;
                }
                
                document.head.appendChild(link);
            });
        });
    }
    
    // Image intersection observer for better lazy loading
    function initIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // Load the image
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        
                        // Add fade-in effect
                        img.style.opacity = '0';
                        img.style.transition = 'opacity 0.3s ease';
                        img.addEventListener('load', () => {
                            img.style.opacity = '1';
                        });
                        
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
            
            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            addImageLoadEffect();
            initIntersectionObserver();
            preloadCriticalImages();
        });
    } else {
        addImageLoadEffect();
        initIntersectionObserver();
        preloadCriticalImages();
    }
    
    // Export functions for manual use
    window.HUBSImages = {
        createModernPicture,
        supportsWebP,
        addImageLoadEffect
    };
})();