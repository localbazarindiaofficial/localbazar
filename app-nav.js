// LocalBazar Professional App Navigation & Smart Back Controller
// Handles 1-step-at-a-time navigation, modal interception & hardware/gesture back
(function() {
    'use strict';

    const STACK_KEY = 'lb_app_history_stack';
    const lbModalStack = [];

    // Helper: Clean current relative path + query string
    function getCurrentPageKey() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        return path + window.location.search;
    }

    function getHistoryStack() {
        try {
            const raw = sessionStorage.getItem(STACK_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistoryStack(stack) {
        try {
            sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-25)));
        } catch (e) {}
    }

    // 1. Maintain in-app page stack on page load
    (function initPageStack() {
        const curPage = getCurrentPageKey();
        const isHome = curPage.startsWith('index.html') || curPage === '' || curPage === '/';

        let stack = getHistoryStack();

        if (isHome) {
            // Reset to home root
            stack = ['index.html'];
        } else {
            // Ensure stack starts with home
            if (stack.length === 0 || !stack[0].startsWith('index.html')) {
                stack.unshift('index.html');
            }

            const lastIdx = stack.length - 1;
            if (lastIdx >= 0 && stack[lastIdx] === curPage) {
                // Already at top, do nothing (e.g. reload)
            } else if (lastIdx >= 1 && stack[lastIdx - 1] === curPage) {
                // Stepped 1 level back
                stack.pop();
            } else {
                // New level navigation: push onto stack
                stack.push(curPage);
            }
        }

        saveHistoryStack(stack);
    })();

    // 2. Modal Stack Registration (for Android / browser back interception)
    window.lbPushModal = function(modalId, closeFn) {
        if (!modalId) return;
        // Avoid duplicate push
        const existingIdx = lbModalStack.findIndex(m => m.id === modalId);
        if (existingIdx !== -1) {
            lbModalStack.splice(existingIdx, 1);
        }
        lbModalStack.push({ id: modalId, closeFn: closeFn });

        // Push history state so hardware back triggers popstate instead of leaving page
        try {
            window.history.pushState({ lbModal: modalId }, '');
        } catch (e) {}
    };

    window.lbPopModal = function(modalId, skipHistoryBack = false) {
        const idx = lbModalStack.findIndex(m => m.id === modalId);
        if (idx !== -1) {
            lbModalStack.splice(idx, 1);
            // If the current history state was this modal, pop state safely unless skipped
            if (!skipHistoryBack && window.history.state && window.history.state.lbModal === modalId) {
                try { window.history.back(); } catch (e) {}
            }
        }
    };

    // Seamless modal-to-modal transition without triggering asynchronous popstate conflicts
    window.lbTransitionModal = function(fromModalId, toModalId, toCloseFn) {
        if (!toModalId) return;
        const fromIdx = lbModalStack.findIndex(m => m.id === fromModalId);
        if (fromIdx !== -1) {
            lbModalStack[fromIdx] = { id: toModalId, closeFn: toCloseFn };
            try {
                window.history.replaceState({ lbModal: toModalId }, '');
            } catch (e) {}
        } else {
            window.lbPushModal(toModalId, toCloseFn);
        }
    };

    window.lbCloseAnyActiveModal = function() {
        if (lbModalStack.length > 0) {
            const topModal = lbModalStack.pop();
            if (typeof topModal.closeFn === 'function') {
                try { topModal.closeFn(); } catch (e) {}
            }
            return true;
        }
        return false;
    };

    // 3. Smart 1-Step Back Navigation Function
    window.lbSmartBack = function(fallbackUrl) {
        // Step A: If any modal or popup is open, close it first!
        if (window.lbCloseAnyActiveModal()) {
            return;
        }

        // Step B: Pop stack & inspect previous page
        let stack = getHistoryStack();
        const curPage = getCurrentPageKey();

        // Remove current page from stack if present at top
        if (stack.length > 0 && stack[stack.length - 1] === curPage) {
            stack.pop();
        }

        const prevPage = stack.length > 0 ? stack[stack.length - 1] : null;
        saveHistoryStack(stack);

        const hasLocalReferrer = document.referrer && (
            document.referrer.includes(window.location.host) ||
            document.referrer.includes('localhost') ||
            document.referrer.includes('127.0.0.1')
        );

        // If in-domain history is available, go back 1 step naturally
        if (window.history.length > 1 && hasLocalReferrer) {
            window.history.back();
            return;
        }

        // Fallback to logical previous page or home
        const destination = prevPage || fallbackUrl || 'index.html';
        window.location.href = destination;
    };

    // 4. Hardware / Browser Back Event Listener (popstate)
    let lastHomeBackPress = 0;

    window.addEventListener('popstate', (e) => {
        // A. If a modal is open, close it and stay on page
        if (lbModalStack.length > 0) {
            const topModal = lbModalStack.pop();
            if (typeof topModal.closeFn === 'function') {
                try { topModal.closeFn(); } catch (err) {}
            }
            return;
        }

        // B. Account Hub Sub-View Interception
        if (window.location.pathname.includes('account.html')) {
            // Check if merchant portal is open
            const portalOverlay = document.getElementById('merchantPortalOverlay');
            if (portalOverlay && portalOverlay.classList.contains('active')) {
                if (typeof window.closeMerchantPortal === 'function') {
                    window.closeMerchantPortal();
                    return;
                }
            }

            // Check if sub-screen is open (e.g. My Listings, Add Listing, Profile)
            const activeSub = document.querySelector('.account-view-screen.active');
            if (activeSub && activeSub.id !== 'viewMainMenu' && typeof window.switchAccountScreen === 'function') {
                window.switchAccountScreen('viewMainMenu');
                return;
            }
        }

        // C. Home Page Exit Confirmation
        const curPage = getCurrentPageKey();
        const isHome = curPage.startsWith('index.html') || curPage === '' || curPage === '/';
        if (isHome) {
            const now = Date.now();
            if (now - lastHomeBackPress < 2200) {
                // Allow exit
                return;
            }
            lastHomeBackPress = now;

            // Push dummy state to stay on home and show prompt
            try {
                window.history.pushState({ homeExitGuard: true }, '');
            } catch (err) {}

            showHomeExitToast('Press back again to exit LocalBazar');
        }
    });

    function showHomeExitToast(msg) {
        let toast = document.getElementById('lbAppNavExitToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'lbAppNavExitToast';
            toast.style.cssText = `
                position: fixed;
                bottom: 85px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: rgba(15, 23, 42, 0.92);
                color: #ffffff;
                padding: 0.65rem 1.25rem;
                border-radius: 25px;
                font-size: 0.82rem;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(0,0,0,0.25);
                z-index: 99999;
                opacity: 0;
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: none;
                white-space: nowrap;
                letter-spacing: 0.2px;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2000);
    }

})();
