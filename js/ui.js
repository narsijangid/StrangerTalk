import { createGroup, fetchWaitingGroups, joinGroup, removeUser, deleteGroupIfEmpty, onGroupChange } from './group.js';
import { createPeer, getPeer, callPeer, answerCall, setLocalStream, muteLocal, shareScreen, closeCall, destroyPeer } from './peer.js';
import { sendMessage, onChatMessages } from './chat.js';

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
  showModal('Enter group name');
};
document.getElementById('join-candidate-btn').onclick = () => {
  pendingRole = 'candidate';
  showModal('Enter your name');
};

nameSubmitBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return;
  userName = name;
  userRole = pendingRole;
  hideModal();
  if (userRole === 'interviewer') {
    await startAsInterviewer();
  } else {
    await startAsCandidate();
  }
};

backToLandingBtn.onclick = () => {
  showSection(landingSection);
};

// Interviewer Flow
async function startAsInterviewer() {
  showSection(interviewRoomSection);
  roomTitle.textContent = 'Waiting for Candidate to Join...';
  roomInfo.textContent = '';
  audioStatus.textContent = '';
  if (groupNameElem) groupNameElem.textContent = userName;
  // Create Peer
  createPeer(async id => {
    peerId = id;
    groupId = await createGroup(userName, peerId);
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
      <div>
        <div class="group-name"><b>${g.createdBy}</b></div>
        <div class="group-host">Host: <b>${g.users && g.users.interviewer ? g.createdBy : 'Gone'}</b></div>
      </div>
      <button>Join</button>
    `;
    card.querySelector('button').onclick = () => joinAsCandidate(g.id);
    groupList.appendChild(card);
  });
}

async function joinAsCandidate(selectedGroupId) {
  groupId = selectedGroupId;
  createPeer(async id => {
    peerId = id;
    await joinGroup(groupId, userName, peerId);
    showSection(interviewRoomSection);
    roomTitle.textContent = 'Interview Room';
    roomInfo.textContent = `Group ID: ${groupId}`;
    roomInfo.className = 'header-info';
    audioStatus.textContent = 'Connecting...';
    audioStatus.className = 'header-status waiting';
    listenGroup();
    setupLocalMedia();
    listenChat();
  });
}

// Group Listener
function listenGroup() {
  if (groupListener) groupListener();
  groupListener = onGroupChange(groupId, group => {
    if (!group) {
      // Group deleted
      alert('Group ended.');
      exitToLanding();
      return;
    }
    // Set group name in header for candidate (from group.createdBy)
    if (groupNameElem && group.createdBy) groupNameElem.textContent = group.createdBy;
    // Set remote peerId
    if (userRole === 'interviewer' && group.users && group.users.candidates) {
      // Interviewer: connect to first candidate
      const candidateIds = Object.keys(group.users.candidates || {});
      if (candidateIds.length > 0) {
        remotePeerId = group.users.candidates[candidateIds[0]].peerId;
        startCallIfReady();
      }
    } else if (userRole === 'candidate') {
      if (group.users && group.users.interviewer) {
        remotePeerId = group.users.interviewer.peerId;
        startCallIfReady();
      } else if (group.users && group.users.candidates) {
        // No interviewer, connect to another candidate
        const candidateIds = Object.keys(group.users.candidates || {});
        // Find another candidate (not self)
        const otherCandidateId = candidateIds.find(id => id !== peerId);
        if (otherCandidateId) {
          remotePeerId = group.users.candidates[otherCandidateId].peerId;
          startCallIfReady();
        }
      }
    }
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
    callPeer(remotePeerId, window.localStream, call => {
      call.on('stream', remoteStream => {
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
}
function playRemoteVideo(stream) {
  const remoteVideo = document.getElementById('remote-video');
  if (remoteVideo) {
    remoteVideo.srcObject = stream;
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

// Exit
exitBtn.onclick = async () => {
  await removeUser(groupId, userRole);
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
}

// Modal close on outside click
nameModal.onclick = e => {
  if (e.target === nameModal) hideModal();
}; 