import { authManager } from './auth.js';

class AuthUI {
  constructor() {
    this.setupEventListeners();
    this.showLoginForm();
  }

  setupEventListeners() {
    // Form switching
    document.getElementById('show-signup').addEventListener('click', (e) => {
      e.preventDefault();
      this.showSignupForm();
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginForm();
    });

    // Login form
    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin();
    });

    // Signup form
    document.getElementById('signup-btn').addEventListener('click', () => {
      this.handleSignup();
    });

    // Google authentication
    document.getElementById('google-login-btn').addEventListener('click', () => {
      this.handleGoogleAuth();
    });

    document.getElementById('google-signup-btn').addEventListener('click', () => {
      this.handleGoogleAuth();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Enter key support
    document.getElementById('login-email').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    document.getElementById('login-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    document.getElementById('signup-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSignup();
    });

    document.getElementById('signup-email').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSignup();
    });

    document.getElementById('signup-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSignup();
    });

    document.getElementById('signup-confirm-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSignup();
    });
  }

  showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    this.hideError();
  }

  showSignupForm() {
    document.getElementById('signup-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
    this.hideError();
  }

  showError(message) {
    const errorElement = document.getElementById('auth-error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  hideError() {
    document.getElementById('auth-error').classList.add('hidden');
  }

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    const result = await authManager.signIn(email, password);
    if (!result.success) {
      this.showError(result.error);
    }
  }

  async handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!name || !email || !password || !confirmPassword) {
      this.showError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters long');
      return;
    }

    const result = await authManager.signUp(email, password, name);
    if (!result.success) {
      this.showError(result.error);
    }
  }

  async handleGoogleAuth() {
    const result = await authManager.signInWithGoogle();
    if (!result.success) {
      this.showError(result.error);
    }
  }

  async handleLogout() {
    await authManager.signOut();
  }

  updateUserInfo() {
    const userName = authManager.getUserName();
    const userAvatar = authManager.userProfile?.photoURL;
    
    document.getElementById('user-name').textContent = userName;
    if (userAvatar) {
      document.getElementById('user-avatar').src = userAvatar;
    }
  }
}

export const authUI = new AuthUI(); 