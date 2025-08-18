// Performance optimized text animation with loading states
(function() {
    'use strict';
    
    const hub1 = document.querySelector(".hubs-1");
    if (!hub1) {
        console.warn('Element with class "hubs-1" not found');
        return;
    }
    
    const hub1_text = hub1.textContent.trim();
    if (!hub1_text) {
        console.warn('No text content found in hubs-1 element');
        return;
    }
    
    // Show loading state
    hub1.classList.add('text-loading');
    
    // Small delay to show loading state, then start animation
    setTimeout(() => {
        const hub1_text_split = hub1_text.split(" ");
        hub1.textContent = "";
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < hub1_text_split.length; i++) {
            if (hub1_text_split[i] === 'Synergy') {
                hub1_text_split[i] += "<br>";
            }
            const span = document.createElement('span');
            span.innerHTML = hub1_text_split[i] + " ";
            fragment.appendChild(span);
        }
        hub1.appendChild(fragment);
        
        // Remove loading state and start animation
        hub1.classList.remove('text-loading');
        hub1.classList.add('text-loaded');
        
        let char = 0;
        let timer = setInterval(onTick, 800); // Adjust this value to control animation speed

        function onTick() {
        const spans = hub1.querySelectorAll('span');
        if (char >= spans.length) {
            complete();
            return;
        }
        
        const span = spans[char];
        if (!span) {
            complete();
            return;
        }
        
        span.classList.add('fade');
        
        const spanText = span.textContent.trim();
        if (spanText === 'Synergy') {
            span.classList.add('synergy', 'shadow_white');
        } else if (spanText === 'Human') {
            span.classList.add('human');
        } else if (spanText === 'Building') {
            span.classList.add('building');
        } else {
            span.classList.add('shadow_black', 'text-white');
        }
        
        char++;
        if (char >= hub1_text_split.length) {
            complete();
        }
    }
    
        function complete() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }
    }, 1000); // 1 second delay to show loading cursor
})();