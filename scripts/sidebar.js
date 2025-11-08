// Sidebar Toggle Functionality
(function() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
    
    function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        
        // Add ID if it doesn't exist
        if (!sidebar.id) {
            sidebar.id = 'sidebar';
        }
        
        // Get the scrollable menu element (not the sidebar itself)
        const sidebarMenu = sidebar.querySelector('.sidebar-menu');
        
        // Save sidebar scroll position when scrolling
        if (sidebarMenu) {
            sidebarMenu.addEventListener('scroll', () => {
                localStorage.setItem('sidebarScroll', sidebarMenu.scrollTop.toString());
            });
        }
        
        // Restore or reset sidebar scroll position on page load
        function restoreOrResetScroll() {
            if (!sidebarMenu) return;
            
            const scrollPos = localStorage.getItem('sidebarScroll');
            if (scrollPos && scrollPos !== '0') {
                // Restore saved scroll position
                sidebarMenu.scrollTop = parseInt(scrollPos, 10);
            } else {
                // First time or no saved position - start at top
                sidebarMenu.scrollTop = 0;
            }
        }
        
        // Restore scroll position on page load
        window.addEventListener('load', () => {
            restoreOrResetScroll();
        });
        
        // Also restore after DOM is ready (in case load event already fired)
        if (document.readyState === 'complete') {
            restoreOrResetScroll();
            // Also restore after a short delay to ensure DOM is fully rendered
            setTimeout(restoreOrResetScroll, 50);
            setTimeout(restoreOrResetScroll, 150);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                restoreOrResetScroll();
                setTimeout(restoreOrResetScroll, 50);
                setTimeout(restoreOrResetScroll, 150);
            });
        }
        
        // Find or create toggle button - add to sidebar header
        let toggleButton = document.getElementById('sidebarToggle');
        const sidebarHeader = sidebar.querySelector('.sidebar-header');
        
        if (!toggleButton && sidebarHeader) {
            toggleButton = document.createElement('button');
            toggleButton.className = 'sidebar-toggle';
            toggleButton.id = 'sidebarToggle';
            toggleButton.setAttribute('aria-label', 'إخفاء/إظهار القائمة');
            toggleButton.setAttribute('title', 'إخفاء/إظهار القائمة الجانبية');
            toggleButton.innerHTML = `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            `;
            // Add to sidebar header so it's on the left side of sidebar
            sidebarHeader.appendChild(toggleButton);
        }
        
        // CRITICAL: Clear saved state and force sidebar visible
        localStorage.removeItem('sidebarState');
        
        // Force sidebar visible immediately - remove hidden class and inline styles
        sidebar.classList.remove('hidden');
        sidebar.style.cssText = sidebar.style.cssText.replace(/transform[^;]*;?/g, '').replace(/width[^;]*;?/g, '').replace(/min-width[^;]*;?/g, '');
        
        let isHidden = false;
        
        // Update button position based on sidebar state
        function updateButtonPosition() {
            // Button is now inside sidebar header, CSS handles positioning
            // No need to update position manually
        }
        
        // Only proceed if toggle button exists
        if (!toggleButton) return;
        
        // Function to hide sidebar
        function hideSidebar() {
            if (!isHidden) {
                isHidden = true;
                sidebar.classList.add('hidden');
                // Move button to body when sidebar is hidden so it stays visible
                if (toggleButton.parentElement === sidebarHeader) {
                    document.body.appendChild(toggleButton);
                }
                // Update button position
                updateButtonPosition();
                // Save state
                localStorage.setItem('sidebarState', JSON.stringify({
                    isHidden: isHidden
                }));
            }
        }
        
        // Function to show sidebar
        function showSidebar() {
            if (isHidden) {
                isHidden = false;
                sidebar.classList.remove('hidden');
                // Force remove any inline styles that might interfere
                sidebar.style.transform = '';
                sidebar.style.width = '';
                sidebar.style.minWidth = '';
                // Move button back to sidebar header when visible
                if (toggleButton.parentElement === document.body && sidebarHeader) {
                    sidebarHeader.appendChild(toggleButton);
                }
                // Update button position
                updateButtonPosition();
                // Save state
                localStorage.setItem('sidebarState', JSON.stringify({
                    isHidden: isHidden
                }));
            }
        }
        
        // Toggle sidebar on button click
        toggleButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (isHidden) {
                showSidebar();
            } else {
                hideSidebar();
            }
        });
        
        // Hide sidebar when clicking outside of it
        document.addEventListener('click', function(e) {
            // Don't hide if clicking on sidebar or toggle button
            if (sidebar.contains(e.target) || toggleButton.contains(e.target)) {
                return;
            }
            
            // Hide sidebar if it's visible
            if (!isHidden) {
                hideSidebar();
            }
        });
        
        // Force visible multiple times on page load
        [0, 50, 100, 200].forEach(delay => {
            setTimeout(() => {
                sidebar.classList.remove('hidden');
                sidebar.style.transform = '';
                sidebar.style.width = '';
                sidebar.style.minWidth = '';
                // Ensure button is in sidebar header when visible
                if (toggleButton && sidebarHeader && toggleButton.parentElement === document.body) {
                    sidebarHeader.appendChild(toggleButton);
                }
            }, delay);
        });
        
        // Check saved state and restore button position if needed
        const savedState = localStorage.getItem('sidebarState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.isHidden && toggleButton && sidebarHeader) {
                    // Sidebar is hidden, move button to body
                    if (toggleButton.parentElement === sidebarHeader) {
                        document.body.appendChild(toggleButton);
                    }
                } else if (!state.isHidden && toggleButton && sidebarHeader) {
                    // Sidebar is visible, ensure button is in header
                    if (toggleButton.parentElement === document.body) {
                        sidebarHeader.appendChild(toggleButton);
                    }
                }
            } catch (e) {
                console.error('Error parsing sidebar state:', e);
            }
        }
    }
})();

// User Greeting - Display logged in user name
(function() {
    function updateUserGreeting() {
        // Check if user is logged in
        const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
        const userGreetingBadge = document.getElementById('userGreetingBadge');
        const userGreetingName = document.getElementById('userGreetingName');
        
        if (!userGreetingBadge) return;
        
        if (!isLoggedIn) {
            userGreetingBadge.style.display = 'none';
            return;
        }
        
        // Get username from localStorage
        const username = localStorage.getItem('asel_user') || 'مستخدم';
        
        // Show badge and update name
        userGreetingBadge.style.display = 'flex';
        if (userGreetingName) {
            userGreetingName.textContent = username;
        }
    }
    
    // Update on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateUserGreeting);
    } else {
        updateUserGreeting();
    }
    
    // Update on storage changes
    window.addEventListener('storage', (e) => {
        if (e.key === 'asel_user' || e.key === 'asel_loggedIn') {
            updateUserGreeting();
        }
    });
    
    // Update when permissions are updated
    window.addEventListener('permissionsUpdated', updateUserGreeting);
})();

