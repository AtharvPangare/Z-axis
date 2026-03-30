const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const formTitle = document.getElementById('form-title');
const formSubtitle = document.getElementById('form-subtitle');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const pwdInput = document.getElementById('password');
const errorDiv = document.getElementById('auth-error');
const submitBtn = document.getElementById('submit-btn');
const spinner = document.getElementById('submit-spinner');

let isLoginMode = true;
// Dynamic hostname fixes SameSite=Lax cookie drops between 127.0.0.1 and localhost
const API_BASE = `http://${window.location.hostname}:5000`;

function switchMode(isLogin) {
    isLoginMode = isLogin;
    errorDiv.classList.add('hidden');
    if (isLogin) {
        tabLogin.classList.replace('bg-transparent', 'bg-white');
        tabLogin.classList.replace('text-brown-sec', 'text-brown-dark');
        tabLogin.classList.add('shadow-sm');
        
        tabSignup.classList.replace('bg-white', 'bg-transparent');
        tabSignup.classList.replace('text-brown-dark', 'text-brown-sec');
        tabSignup.classList.remove('shadow-sm');

        formTitle.textContent = "Welcome Back";
        formSubtitle.textContent = "Log in to your 3D workspace.";
        submitBtn.querySelector('span').textContent = "Continue with Email";
    } else {
        tabSignup.classList.replace('bg-transparent', 'bg-white');
        tabSignup.classList.replace('text-brown-sec', 'text-brown-dark');
        tabSignup.classList.add('shadow-sm');
        
        tabLogin.classList.replace('bg-white', 'bg-transparent');
        tabLogin.classList.replace('text-brown-dark', 'text-brown-sec');
        tabLogin.classList.remove('shadow-sm');

        formTitle.textContent = "Create Account";
        formSubtitle.textContent = "Join the next-gen floorplanner.";
        submitBtn.querySelector('span').textContent = "Sign Up via Email";
    }
}

tabLogin.addEventListener('click', () => switchMode(true));
tabSignup.addEventListener('click', () => switchMode(false));

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pwdInput.value.length < 8) return;

    // Loading State
    const originalText = submitBtn.querySelector('span').textContent;
    submitBtn.querySelector('span').textContent = isLoginMode ? "Logging in..." : "Creating Account...";
    spinner.classList.remove('hidden');
    submitBtn.disabled = true;
    errorDiv.classList.add('hidden');

    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Important: Ensures HttpOnly cookies are set!
            body: JSON.stringify({
                email: emailInput.value,
                password: pwdInput.value
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Success! Send to dashboard securely
            window.location.href = 'index.html';
        } else {
            errorDiv.textContent = data.error || "An error occurred.";
            errorDiv.classList.remove('hidden');
        }
    } catch (err) {
        errorDiv.textContent = "Failed to connect to the server.";
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.querySelector('span').textContent = originalText;
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
    }
});

// Callback automatically invoked by Google Identity SDK when user signs in
async function handleGoogleResponse(response) {
    if(!response.credential) return;
    
    // Switch button to loading state
    submitBtn.querySelector('span').textContent = "Verifying Google...";
    spinner.classList.remove('hidden');
    submitBtn.disabled = true;
    errorDiv.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken: response.credential })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            window.location.href = 'index.html';
        } else {
            errorDiv.textContent = data.error || "Google login failed.";
            errorDiv.classList.remove('hidden');
        }
    } catch (err) {
        errorDiv.textContent = "Server communication failed.";
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.querySelector('span').textContent = "Continue with Email";
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

// Dynamically Initialize Google SDK so you don't have to copy-paste the Client ID twice
window.addEventListener('load', async () => {
    try {
        const res = await fetch(`${API_BASE}/auth/config`);
        const config = await res.json();
        
        if (config.google_client_id && config.google_client_id !== 'placeholder-id' && config.google_client_id !== 'your-google-client-id.apps.googleusercontent.com') {
            google.accounts.id.initialize({
                client_id: config.google_client_id,
                callback: handleGoogleResponse
            });
            
            google.accounts.id.renderButton(
                document.getElementById('google-btn-container'),
                { theme: "outline", size: "large", type: "standard", shape: "rectangular", text: "continue_with" }
            );
        } else {
            document.getElementById('google-btn-container').innerHTML = `<p class="text-xs text-red-400 text-center w-full">Google OAuth not configured in backend .env</p>`;
        }
    } catch(err) {
        console.warn("Could not load Google Config");
    }
});
