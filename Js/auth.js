import { 
  auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signInWithPopup, googleProvider, onAuthStateChanged, signOut,
  db, ref, set, get
} from './firebase.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.setupAuthListener();
  }

  setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.loadUserProfile(user.uid);
      } else {
        this.currentUser = null;
        this.userProfile = null;
        this.showAuthUI();
      }
    });
  }

  async loadUserProfile(uid) {
    try {
      // Load user profile from database
      const userRef = ref(db, `users/${uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        this.userProfile = snapshot.val();
        this.showMainApp();
        this.updateUserInfo();
      } else {
        // Create profile for Google users
        this.userProfile = {
          name: this.currentUser.displayName || this.currentUser.email.split('@')[0],
          email: this.currentUser.email,
          photoURL: this.currentUser.photoURL,
          createdAt: new Date().toISOString()
        };
        await this.saveUserProfile();
        this.showMainApp();
        this.updateUserInfo();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  async saveUserProfile() {
    try {
      const userRef = ref(db, `users/${this.currentUser.uid}`);
      await set(userRef, this.userProfile);
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  async signUp(email, password, name) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      this.userProfile = {
        name: name,
        email: email,
        createdAt: new Date().toISOString()
      };
      await this.saveUserProfile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  showAuthUI() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('landing-section').classList.add('hidden');
    document.getElementById('group-list-section').classList.add('hidden');
    document.getElementById('interview-room-section').classList.add('hidden');
  }

  showMainApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('landing-section').classList.remove('hidden');
  }

  getUserName() {
    return this.userProfile ? this.userProfile.name : '';
  }

  getUserId() {
    return this.currentUser ? this.currentUser.uid : '';
  }

  getCurrentUser() {
    return this.currentUser;
  }

  updateUserInfo() {
    const userName = this.getUserName();
    const userAvatar = this.userProfile?.photoURL;
    
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    
    if (userNameElement) {
      userNameElement.textContent = userName;
    }
    
    if (userAvatarElement && userAvatar) {
      userAvatarElement.src = userAvatar;
    }
  }
}

export const authManager = new AuthManager();
