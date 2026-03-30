const AUTH_API_BASE = `http://${window.location.hostname || '127.0.0.1'}:5000`;

async function checkAuth() {
    try {
        const response = await fetch(`${AUTH_API_BASE}/auth/me`, {
            credentials: 'include' // Send HttpOnly cookie
        });

        if (!response.ok) {
            // Not authenticated, redirect to login
            window.location.href = 'login.html';
        } else {
            // Authenticated
            const data = await response.json();
            console.log("Authenticated as:", data.user.email);
            // Optionally update UI here
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = 'login.html';
    }
}

async function logout() {
    try {
        await fetch(`${AUTH_API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = 'login.html';
    } catch (err) {
        console.error("Logout failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Attach logout functional if button exists
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});
