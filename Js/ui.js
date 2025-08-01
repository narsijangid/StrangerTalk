import { createGroup, fetchWaitingGroups, joinGroup, removeUser, deleteGroupIfEmpty, onGroupChange } from './group.js';
import { db, ref, set, get } from './firebase.js';
import { createPeer, getPeer, callPeer, answerCall, setLocalStream, muteLocal, shareScreen, closeCall, destroyPeer } from './peer.js';
import { sendMessage, onChatMessages } from './chat.js';
import { authManager } from './auth.js';

// UI Elements
const landingSection = document.getElementById('landing-section');
const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('name-input');
const nameSubmitBtn = document.getElementById('name-submit-btn');
const modalTitle = document.getElementById('modal-title');
const groupListSection = document.getElementById('group-list-section');
const groupList = document.getElementById('group-list');
const backToLandingBtn = document.getElementById('back-to-landing-btn');
const interviewRoomSection = document.getElementById('interview-room-section');
const roomTitle = document.getElementById('room-title');
const roomInfo = document.getElementById('room-info');
const currentUserElem = document.getElementById('current-user');
const audioStatus = document.getElementById('audio-status');
const screenShareBtn = document.getElementById('screen-share-btn');
const muteBtn = document.getElementById('mute-btn');
const exitBtn = document.getElementById('exit-btn');
const chatSection = document.getElementById('chat-section');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const modalBlurOverlay = document.getElementById('modal-blur-overlay');
const groupNameElem = document.getElementById('group-name');
const videoToggleBtn = document.getElementById('video-toggle-btn');
let isVideoOff = false;

// Add custom modal HTML to the page if not present
if (!document.getElementById('custom-alert-modal')) {
  const modal = document.createElement('div');
  modal.id = 'custom-alert-modal';
  modal.className = 'custom-alert-modal hidden';
  modal.innerHTML = `
    <div class="custom-alert-content">
      <div class="custom-alert-title">Group Ended</div>
      <button id="custom-alert-ok-btn" class="custom-alert-btn">OK</button>
    </div>
  `;
  document.body.appendChild(modal);
}
const customAlertModal = document.getElementById('custom-alert-modal');
const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');
if (customAlertOkBtn) {
  customAlertOkBtn.onclick = () => {
    customAlertModal.classList.add('hidden');
    exitToLanding();
  };
}
function showCustomAlert() {
  customAlertModal.classList.remove('hidden');
}

// State
let userRole = null;
let userName = '';
let groupId = '';
let peerId = '';
let remotePeerId = '';
let groupListener = null;
let chatListener = null;
let isMuted = false;

// Helper: Show/Hide sections
function showSection(section) {
  [landingSection, groupListSection, interviewRoomSection].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}
function showModal(title) {
  modalTitle.textContent = title;
  nameInput.value = '';
  nameModal.classList.remove('hidden');
  if (modalBlurOverlay) modalBlurOverlay.classList.remove('hidden');
  nameInput.focus();
}
function hideModal() {
  nameModal.classList.add('hidden');
  if (modalBlurOverlay) modalBlurOverlay.classList.add('hidden');
}

// Landing Page Events
let pendingRole = null;
document.getElementById('join-interviewer-btn').onclick = () => {
  pendingRole = 'interviewer';
  // Use authenticated user's name
  userName = authManager.getUserName();
  if (!userName) {
    showModal('Enter your name');
    return;
  }
  showRoomCreationModal();
};

document.getElementById('join-candidate-btn').onclick = () => {
  pendingRole = 'candidate';
  // Use authenticated user's name
  userName = authManager.getUserName();
  if (!userName) {
    showModal('Enter your name');
    return;
  }
  userRole = 'candidate';
  startAsCandidate();
};

nameSubmitBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return;
  userName = name;
  userRole = pendingRole;
  hideModal();
  if (userRole === 'interviewer') {
    showRoomCreationModal();
  } else {
    await startAsCandidate();
  }
};

backToLandingBtn.onclick = () => {
  showSection(landingSection);
};

// Room Creation Modal
function showRoomCreationModal() {
  // Create room creation modal if not exists
  if (!document.getElementById('room-creation-modal')) {
    const modal = document.createElement('div');
    modal.id = 'room-creation-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content name-modal-content">
        <h2>Create Interview Room</h2>
        <div class="form-group">
          <input type="text" id="room-name-input" placeholder="Room Name (e.g., Frontend Interview)" required>
        </div>
        <div class="form-group">
          <select id="room-category-input" required>
            <option value="">Select Category</option>
            <option value="Frontend Interview">Frontend Interview</option>
            <option value="Backend Interview">Backend Interview</option>
            <option value="Full Stack Interview">Full Stack Interview</option>
            <option value="HR Interview">HR Interview</option>
            <option value="Technical Interview">Technical Interview</option>
            <option value="System Design">System Design</option>
            <option value="Data Science">Data Science</option>
            <option value="DevOps Interview">DevOps Interview</option>
            <option value="Mobile Development">Mobile Development</option>
            <option value="QA Interview">QA Interview</option>
            <option value="UI/UX Interview">UI/UX Interview</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <button id="create-room-btn" class="modal-btn">Create Room</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('create-room-btn').onclick = () => {
      const roomName = document.getElementById('room-name-input').value.trim();
      const category = document.getElementById('room-category-input').value;
      
      if (!roomName || !category) {
        alert('Please fill in all fields');
        return;
      }
      
      userRole = 'interviewer';
      userName = authManager.getUserName();
      hideRoomCreationModal();
      startAsInterviewer(roomName, category);
    };
  }
  
  document.getElementById('room-creation-modal').classList.remove('hidden');
  if (modalBlurOverlay) modalBlurOverlay.classList.remove('hidden');
  document.getElementById('room-name-input').focus();
}

function hideRoomCreationModal() {
  document.getElementById('room-creation-modal').classList.add('hidden');
  if (modalBlurOverlay) modalBlurOverlay.classList.add('hidden');
}

// Interviewer Flow
async function startAsInterviewer(roomName, category) {
  showSection(interviewRoomSection);
  roomTitle.textContent = 'Waiting for Candidate to Join...';
  roomInfo.textContent = '';
  currentUserElem.textContent = `You: ${userName}`;
  audioStatus.textContent = '';
  if (groupNameElem) groupNameElem.textContent = userName;
  // Create Peer
  createPeer(async id => {
    peerId = id;
    groupId = await createGroup(roomName, category, peerId);
    listenGroup();
    setupLocalMedia();
    listenChat();
    roomInfo.textContent = `Group ID: ${groupId}`;
    roomInfo.className = 'header-info';
    audioStatus.textContent = 'Waiting...';
    audioStatus.className = 'header-status waiting';
    if (groupNameElem) groupNameElem.textContent = userName;
  });
}

// Candidate Flow
async function startAsCandidate() {
  showSection(groupListSection);
  groupList.innerHTML = '<em>Loading...</em>';
  const groups = await fetchWaitingGroups();
  groupList.innerHTML = '';
  if (groups.length === 0) {
    groupList.innerHTML = '<em>No groups available. Try again later.</em>';
    return;
  }
  groups.forEach(g => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-info">
        <div class="group-name"><b>${g.roomName || g.createdBy}</b></div>
        <div class="group-category">${g.category || 'Interview'}</div>
        <div class="group-host">Host: <b>${g.users && g.users.interviewer ? g.createdBy : 'Gone'}</b></div>
        <div class="group-status">Status: <span class="status-${g.status}">${g.status}</span></div>
      </div>
      <button class="join-btn">Join</button>
    `;
    card.querySelector('.join-btn').onclick = () => joinAsCandidate(g.id);
    groupList.appendChild(card);
  });
}

async function joinAsCandidate(selectedGroupId) {
  groupId = selectedGroupId;
  createPeer(async id => {
    peerId = id;
    try {
      await joinGroup(groupId, userName, peerId);
      showSection(interviewRoomSection);
      roomTitle.textContent = 'Interview Room';
      roomInfo.textContent = `Group ID: ${groupId}`;
      currentUserElem.textContent = `You: ${userName}`;
      roomInfo.className = 'header-info';
      audioStatus.textContent = 'Connecting...';
      audioStatus.className = 'header-status waiting';
      
      // Start listening for group changes immediately
      listenGroup();
      setupLocalMedia();
      listenChat();
      
      // Try to connect immediately after joining
      setTimeout(() => {
        if (remotePeerId && getPeer()) {
          startCallIfReady();
        }
      }, 500);
    } catch (error) {
      alert(error.message || 'Failed to join group');
      showSection(groupListSection);
      // Refresh group list
      startAsCandidate();
    }
  });
}

// Group Listener
function listenGroup() {
  if (groupListener) groupListener();
  groupListener = onGroupChange(groupId, group => {
    if (!group) {
      // Group deleted
      showCustomAlert();
      return;
    }
    
    // Check if current user is blocked
    const checkIfBlocked = async () => {
      const blockedRef = ref(db, `blockedUsers/${groupId}/${peerId}`);
      const blockedSnapshot = await get(blockedRef);
      
      if (blockedSnapshot.exists()) {
        // Current user is blocked, show alert and exit
        alert('You have been blocked from this group.');
        exitToLanding();
        return true;
      }
      return false;
    };
    
    // Run the check
    checkIfBlocked().then(isBlocked => {
      if (isBlocked) return;
    
    // Update group name and user info display
    if (groupNameElem && group.createdBy) {
      groupNameElem.textContent = group.createdBy;
    }
    
    // Update room title to show group name
    if (group.createdBy) {
      roomTitle.textContent = `Interview Room - ${group.createdBy}`;
    }
    
    // Set remote peerId based on role
    if (userRole === 'interviewer' && group.users && group.users.candidates) {
      // Interviewer: connect to first candidate
      const candidateIds = Object.keys(group.users.candidates || {});
      if (candidateIds.length > 0) {
        const firstCandidate = candidateIds[0];
        remotePeerId = group.users.candidates[firstCandidate].peerId;
        startCallIfReady();
      }
    } else if (userRole === 'candidate') {
      if (group.users && group.users.interviewer) {
        // Connect to interviewer
        remotePeerId = group.users.interviewer.peerId;
        startCallIfReady();
      } else if (group.users && group.users.candidates) {
        // Connect to another candidate (peer-to-peer)
        const candidateIds = Object.keys(group.users.candidates || {});
        // Find another candidate (not self)
        const otherCandidateId = candidateIds.find(id => id !== peerId);
        if (otherCandidateId && candidateIds.length > 1) {
          remotePeerId = group.users.candidates[otherCandidateId].peerId;
          console.log('Connecting to other candidate:', otherCandidateId, 'with peerId:', remotePeerId);
          startCallIfReady();
        } else if (candidateIds.length === 1 && candidateIds[0] === peerId) {
          // Only one candidate (self), wait for others
          console.log('Waiting for other candidates to join...');
        }
      }
    }
    });
  });
}

// PeerJS Video Call
function setupLocalMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    setLocalStream(stream);
    // Show local video
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
      localVideo.srcObject = stream;
      localVideo.poster = '';
      localVideo.style.background = '';
    }
    answerCall(remoteStream => {
      audioStatus.innerHTML = '<b>Connected!</b>';
      audioStatus.className = 'header-status connected';
      playRemoteVideo(remoteStream);
      // Hide waiting message if present
      if (roomTitle.textContent.includes('Waiting')) {
        roomTitle.textContent = 'Interview Room';
      }
    });
  });
}
function startCallIfReady() {
  if (remotePeerId && getPeer()) {
    console.log('Attempting to connect to:', remotePeerId);
    callPeer(remotePeerId, window.localStream, call => {
      call.on('stream', remoteStream => {
        console.log('Connection established successfully');
        audioStatus.innerHTML = '<b>Connected!</b>';
        audioStatus.className = 'header-status connected';
        playRemoteVideo(remoteStream);
        // Hide waiting message if present
        if (roomTitle.textContent.includes('Waiting')) {
          roomTitle.textContent = 'Interview Room';
        }
      });
      
      call.on('error', error => {
        console.error('Call error:', error);
        audioStatus.textContent = 'Connection failed';
        audioStatus.className = 'header-status waiting';
      });
      
      call.on('close', () => {
        console.log('Call closed');
        audioStatus.textContent = 'Connection lost';
        audioStatus.className = 'header-status waiting';
      });
    });
  } else {
    console.log('Not ready to call:', { remotePeerId, peer: getPeer() });
  }
}
function playRemoteVideo(stream) {
  const remoteVideo = document.getElementById('remote-video');
  if (remoteVideo) {
    remoteVideo.srcObject = stream;
    remoteVideo.poster = '';
    remoteVideo.style.background = '';
    remoteVideo.style.objectFit = 'cover';
    remoteVideo.style.backgroundColor = '';
  }
}

// Chat
function listenChat() {
  if (chatListener) chatListener();
  chatListener = onChatMessages(groupId, messages => {
    chatMessages.innerHTML = '';
    messages.sort((a, b) => a.timestamp - b.timestamp).forEach(msg => {
      const div = document.createElement('div');
      div.textContent = `${msg.sender}: ${msg.text}`;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}
sendChatBtn.onclick = () => {
  const text = chatInput.value.trim();
  if (!text) return;
  sendMessage(groupId, userName, text);
  chatInput.value = '';
};

// Screen Share
screenShareBtn.onclick = () => {
  navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(screenStream => {
    // Replace local video with screen
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
      localVideo.srcObject = screenStream;
    }
    // Send screen stream to remote
    if (remotePeerId && getPeer()) {
      callPeer(remotePeerId, screenStream, call => {
        call.on('stream', remoteStream => {
          playRemoteVideo(remoteStream);
        });
      });
    }
    // When screen sharing stops, revert to webcam
    screenStream.getVideoTracks()[0].onended = () => {
      setupLocalMedia();
      // Send webcam stream to remote
      if (remotePeerId && getPeer() && window.localStream) {
        callPeer(remotePeerId, window.localStream, call => {
          call.on('stream', remoteStream => {
            playRemoteVideo(remoteStream);
          });
        });
      }
    };
  });
};

// Mute/Unmute
muteBtn.onclick = () => {
  isMuted = !isMuted;
  muteLocal(isMuted);
  // Toggle icon
  const icon = muteBtn.querySelector('i');
  if (icon) {
    icon.className = isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
  }
};

// Video Toggle
videoToggleBtn.onclick = () => {
  const localVideo = document.getElementById('local-video');
  if (!window.localStream) return;
  isVideoOff = !isVideoOff;
  // Toggle video tracks
  window.localStream.getVideoTracks().forEach(track => {
    track.enabled = !isVideoOff;
  });
  // Update icon
  const icon = videoToggleBtn.querySelector('i');
  if (icon) {
    icon.className = isVideoOff ? 'fas fa-video-slash' : 'fas fa-video';
  }
  // Show/hide placeholder
  if (isVideoOff) {
    const defaultImg = 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif?t=' + Date.now();
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.poster = '';
      localVideo.style.background = `url('${defaultImg}') center center / contain no-repeat`;
      localVideo.style.backgroundColor = 'transparent';
    }
  } else {
    if (localVideo) {
      localVideo.srcObject = window.localStream;
      localVideo.poster = '';
      localVideo.style.background = '';
      localVideo.style.backgroundColor = '';
    }
  }
};

// Chat Popup Toggle
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatPopup = document.getElementById('chat-popup');
chatToggleBtn.onclick = () => {
  chatPopup.classList.toggle('hidden');
};
// Chat Popup Close Button
const chatCloseBtn = document.getElementById('chat-close-btn');
if (chatCloseBtn) {
  chatCloseBtn.onclick = () => {
    chatPopup.classList.add('hidden');
  };
}

// Options Menu
const optionsBtn = document.getElementById('options-btn');
const optionsPopup = document.getElementById('options-popup');
const blockUserBtn = document.getElementById('block-user-btn');
const reportUserBtn = document.getElementById('report-user-btn');
const closeOptionsBtn = document.getElementById('close-options-btn');

optionsBtn.onclick = () => {
  optionsPopup.classList.toggle('hidden');
};

closeOptionsBtn.onclick = () => {
  optionsPopup.classList.add('hidden');
};

// Block User Functionality
blockUserBtn.onclick = async () => {
  if (!remotePeerId) {
    alert('No user to block');
    return;
  }
  
  if (confirm('Are you sure you want to block this user? They will be disconnected and unable to rejoin this group.')) {
    // Add user to blocked list in database
    const blockedRef = ref(db, `blockedUsers/${groupId}/${remotePeerId}`);
    await set(blockedRef, true);
    
    // Remove user from the group
    if (userRole === 'interviewer') {
      // If interviewer is blocking a candidate
      await removeUser(groupId, 'candidates', remotePeerId);
    } else {
      // If candidate is blocking interviewer
      await removeUser(groupId, 'interviewer');
    }
    
    // Disconnect the call
    closeCall();
    
    // Show confirmation
    alert('User has been blocked and disconnected.');
    
    // Hide options popup
    optionsPopup.classList.add('hidden');
    
    // Update UI to show waiting status
    audioStatus.textContent = 'User blocked';
    audioStatus.className = 'header-status waiting';
    
    // Clear remote video
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      setDefaultVideoPlaceholders();
    }
  }
};

// Report User Functionality
reportUserBtn.onclick = () => {
  if (!remotePeerId) {
    alert('No user to report');
    return;
  }
  
  const reason = prompt('Please provide a reason for reporting this user:');
  if (reason) {
    // Store report in database
    const reportsRef = ref(db, `reports/${groupId}/${remotePeerId}`);
    set(reportsRef, {
      reportedBy: peerId,
      reason: reason,
      timestamp: new Date().toISOString()
    });
    
    // Show confirmation
    alert('Thank you for your report. We will review it shortly.');
    
    // Hide options popup
    optionsPopup.classList.add('hidden');
  }
};

// Exit
exitBtn.onclick = async () => {
  if (userRole === 'candidate') {
    await removeUser(groupId, userRole, peerId);
  } else {
    await removeUser(groupId, userRole);
  }
  await deleteGroupIfEmpty(groupId);
  closeCall();
  destroyPeer();
  exitToLanding();
};

function exitToLanding() {
  if (groupListener) groupListener();
  if (chatListener) chatListener();
  groupId = '';
  peerId = '';
  remotePeerId = '';
  userRole = null;
  userName = '';
  showSection(landingSection);
  setDefaultVideoPlaceholders();
}

// Modal close on outside click
nameModal.onclick = e => {
  if (e.target === nameModal) hideModal();
};

// Room creation modal close on outside click
document.addEventListener('click', e => {
  const roomCreationModal = document.getElementById('room-creation-modal');
  if (roomCreationModal && e.target === roomCreationModal) {
    hideRoomCreationModal();
  }
});

// Set default images for video elements until streams are set
function setDefaultVideoPlaceholders() {
  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');
  const defaultImg = 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif?t=' + Date.now();
  if (localVideo) {
    localVideo.srcObject = null;
    localVideo.poster = '';
    localVideo.style.background = `url('${defaultImg}') center center / contain no-repeat`;
    localVideo.style.backgroundColor = 'transparent';
  }
  if (remoteVideo) {
    remoteVideo.srcObject = null;
    remoteVideo.poster = '';
    remoteVideo.style.background = `url('${defaultImg}') center center / cover no-repeat`;
    remoteVideo.style.backgroundColor = 'transparent';
  }
}

// Call this on page load
setDefaultVideoPlaceholders();

// Profile Sidebar Functionality
const profileToggleBtn = document.getElementById('profile-toggle-btn');
const profileSidebar = document.getElementById('profile-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const blockedUsersBtn = document.getElementById('blocked-users-btn');
const blockedUsersPopup = document.getElementById('blocked-users-popup');
const closeBlockedUsersBtn = document.getElementById('close-blocked-users-btn');
const logoutBtn = document.getElementById('sidebar-logout-btn');
const sidebarUsername = document.getElementById('sidebar-user-name');
const sidebarUserEmail = document.getElementById('sidebar-user-email');
const sidebarAvatar = document.getElementById('sidebar-user-avatar');

// Profile sidebar toggle
profileToggleBtn.onclick = () => {
  profileSidebar.classList.add('active');
  updateSidebarUserInfo();
};

closeSidebarBtn.onclick = () => {
  profileSidebar.classList.remove('active');
};

// Close sidebar when clicking outside
profileSidebar.addEventListener('click', (e) => {
  if (e.target === profileSidebar) {
    profileSidebar.classList.remove('active');
  }
});

// Update sidebar user info
function updateSidebarUserInfo() {
  const user = authManager.getCurrentUser();
  if (user) {
    sidebarUsername.textContent = user.displayName || user.email.split('@')[0];
    sidebarUserEmail.textContent = user.email;
    sidebarAvatar.src = user.photoURL || 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif?t=' + Date.now();
  }
}

// Blocked users popup
blockedUsersBtn.onclick = async () => {
  profileSidebar.classList.remove('active');
  await loadBlockedUsers();
  blockedUsersPopup.classList.add('active');
};

closeBlockedUsersBtn.onclick = () => {
  blockedUsersPopup.classList.remove('active');
};

// Close popup when clicking outside
blockedUsersPopup.addEventListener('click', (e) => {
  if (e.target === blockedUsersPopup) {
    blockedUsersPopup.classList.remove('active');
  }
});

// Load blocked users
async function loadBlockedUsers() {
  const blockedUsersList = document.getElementById('blocked-users-list');
  const noBlockedUsers = blockedUsersList.querySelector('.no-blocked-users');
  
  try {
    const user = authManager.getCurrentUser();
    if (!user) return;
    
    const blockedRef = ref(db, `userBlocks/${user.uid}`);
    const snapshot = await get(blockedRef);
    
    // Clear the list but keep the no-blocked-users message
    const existingItems = blockedUsersList.querySelectorAll('.blocked-user-item');
    existingItems.forEach(item => item.remove());
    
    if (snapshot.exists() && Object.keys(snapshot.val()).length > 0) {
      if (noBlockedUsers) noBlockedUsers.style.display = 'none';
      
      const blockedUsers = snapshot.val();
      for (const [userId, userData] of Object.entries(blockedUsers)) {
        // Try to get actual user data from Firebase if available
        let displayName = userData.name || 'Unknown User';
        let userPhoto = userData.photoURL || 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif?t=' + Date.now();
        
        // Try to fetch user's actual data from the users collection
        try {
          const userRef = ref(db, `users/${userId}`);
          const userSnapshot = await get(userRef);
          if (userSnapshot.exists()) {
            const actualUserData = userSnapshot.val();
            displayName = actualUserData.name || displayName;
            userPhoto = actualUserData.photoURL || userPhoto;
          }
        } catch (err) {
          console.log('Could not fetch additional user data:', err);
        }
        
        const userItem = document.createElement('div');
        userItem.className = 'blocked-user-item';
        userItem.innerHTML = `
          <div class="blocked-user-info">
            <img src="${userPhoto}" alt="${displayName}" class="blocked-user-avatar">
            <div>
              <div class="blocked-user-name">${displayName}</div>
              <div class="blocked-user-date">Blocked on ${new Date(userData.blockedAt).toLocaleDateString()}</div>
            </div>
          </div>
          <button class="unblock-btn" data-user-id="${userId}">UnBlock</button>
        `;
        blockedUsersList.appendChild(userItem);
      }
      
      // Add unblock functionality
      document.querySelectorAll('.unblock-btn').forEach(btn => {
        btn.onclick = async (e) => {
          const userId = e.target.dataset.userId;
          await unblockUser(userId);
        };
      });
    } else {
      if (noBlockedUsers) noBlockedUsers.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading blocked users:', error);
  }
}

// Unblock user
async function unblockUser(userId) {
  try {
    const user = authManager.getCurrentUser();
    if (!user) return;
    
    const blockedRef = ref(db, `userBlocks/${user.uid}/${userId}`);
    await set(blockedRef, null);
    
    // Reload the list
    await loadBlockedUsers();
    
    alert('User unblocked successfully');
  } catch (error) {
    console.error('Error unblocking user:', error);
    alert('Failed to unblock user');
  }
}

// Block user function (updated to store in userBlocks)
async function blockUser(userId, userData) {
  try {
    const user = authManager.getCurrentUser();
    if (!user) return;
    
    const blockedRef = ref(db, `userBlocks/${user.uid}/${userId}`);
    await set(blockedRef, {
      name: userData.name || 'Unknown User',
      email: userData.email || '',
      photoURL: userData.photoURL || '',
      blockedAt: new Date().toISOString()
    });
    
    console.log('User blocked successfully');
  } catch (error) {
    console.error('Error blocking user:', error);
  }
}

// Sidebar logout
logoutBtn.onclick = async () => {
  try {
    await authManager.signOut();
    profileSidebar.classList.remove('active');
    showSection(landingSection);
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// Enhanced block user functionality
blockUserBtn.onclick = async () => {
  if (!remotePeerId) {
    alert('No user to block');
    return;
  }
  
  if (confirm('Are you sure you want to block this user? They will be disconnected and unable to rejoin this group.')) {
    try {
      // Try to get actual user data from Firebase
      let userData = {
        name: remotePeerId, // Fallback to peer ID
        email: '',
        photoURL: ''
      };
      
      // Attempt to fetch user's actual profile data
      try {
        const userRef = ref(db, `users/${remotePeerId}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const actualUserData = userSnapshot.val();
          userData = {
            name: actualUserData.name || remotePeerId,
            email: actualUserData.email || '',
            photoURL: actualUserData.photoURL || ''
          };
        }
      } catch (err) {
        console.log('Could not fetch user profile data:', err);
      }
      
      // Block user with actual data
      await blockUser(remotePeerId, userData);
      
      // Remove user from the group
      if (userRole === 'interviewer') {
        await removeUser(groupId, 'candidates', remotePeerId);
      } else {
        await removeUser(groupId, 'interviewer');
      }
      
      // Disconnect the call
      closeCall();
      
      // Show confirmation
      alert(`User "${userData.name}" has been blocked and disconnected.`);
      
      // Hide options popup
      optionsPopup.classList.add('hidden');
      
      // Update UI
      audioStatus.textContent = 'User blocked';
      audioStatus.className = 'header-status waiting';
      
      // Clear remote video
      const remoteVideo = document.getElementById('remote-video');
      if (remoteVideo) {
        remoteVideo.srcObject = null;
        setDefaultVideoPlaceholders();
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      alert('Failed to block user');
    }
  }
};

// Update profile toggle button with user avatar
document.addEventListener('DOMContentLoaded', () => {
  setDefaultVideoPlaceholders();
  
  const user = authManager.getCurrentUser();
  if (user && profileToggleBtn) {
    const avatarImg = profileToggleBtn.querySelector('.profile-avatar');
    if (avatarImg) {
      avatarImg.src = user.photoURL || 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif?t=' + Date.now();
    }
  }
});