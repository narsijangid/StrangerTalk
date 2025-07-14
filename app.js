// Firebase Realtime Database REST API base URL
const FIREBASE_URL = 'https://dazzlone-default-rtdb.firebaseio.com';

const joinBtn = document.getElementById('join-btn');
const groupIdSpan = document.getElementById('group-id');
const videoGrid = document.getElementById('video-grid');

let localStream = null;
let groupId = null;
let userId = null;
let peers = {};

// Utility: Generate random user ID
function randomId(len = 8) {
  return Math.random().toString(36).substr(2, len);
}

// --- WebRTC and Signaling Logic ---
const ICE_CONFIG = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' }
] };

// Listen for group changes and signaling
async function listenForPeers() {
  // Poll group members every 2 seconds (since REST API, no real-time events)
  setInterval(async () => {
    const res = await fetch(`${FIREBASE_URL}/groups/${groupId}.json`);
    const members = await res.json() || {};
    const memberIds = Object.keys(members);
    // Add new peers
    for (const peerId of memberIds) {
      if (peerId !== userId && !peers[peerId]) {
        createPeerConnection(peerId, false);
      }
    }
    // Remove peers who left
    for (const pid in peers) {
      if (!memberIds.includes(pid)) {
        removePeer(pid);
      }
    }
  }, 2000);

  // Poll signaling messages every 1s
  setInterval(async () => {
    const res = await fetch(`${FIREBASE_URL}/signals/${groupId}/${userId}.json`);
    const signals = await res.json() || {};
    for (const [fromId, msgs] of Object.entries(signals)) {
      for (const [msgId, msg] of Object.entries(msgs)) {
        await handleSignal(fromId, msg);
        // Delete the message after processing
        await fetch(`${FIREBASE_URL}/signals/${groupId}/${userId}/${fromId}/${msgId}.json`, { method: 'DELETE' });
      }
    }
  }, 1000);
}

// Send signaling message to peer
async function sendSignal(toId, data) {
  const msgId = randomId(10);
  await fetch(`${FIREBASE_URL}/signals/${groupId}/${toId}/${userId}/${msgId}.json`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// Create peer connection
function createPeerConnection(peerId, isInitiator) {
  const pc = new RTCPeerConnection(ICE_CONFIG);
  peers[peerId] = { pc, stream: null };

  // Add local tracks
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // ICE candidates
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignal(peerId, { type: 'candidate', candidate: e.candidate });
    }
  };

  // Remote stream
  pc.ontrack = (e) => {
    if (!peers[peerId].stream) {
      peers[peerId].stream = new MediaStream();
      addVideoStream(peers[peerId].stream, peerId);
    }
    peers[peerId].stream.addTrack(e.track);
  };

  // Initiator creates offer
  if (isInitiator) {
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { type: 'offer', sdp: offer });
    };
  }
}

// Handle incoming signaling message
async function handleSignal(fromId, msg) {
  const pcObj = peers[fromId] || createPeerConnection(fromId, false);
  const pc = peers[fromId].pc;
  if (msg.type === 'offer') {
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal(fromId, { type: 'answer', sdp: answer });
  } else if (msg.type === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
  } else if (msg.type === 'candidate') {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } catch (e) {}
  }
}

// Remove peer
function removePeer(pid) {
  if (peers[pid]) {
    if (peers[pid].pc) peers[pid].pc.close();
    const vid = document.getElementById(`video-${pid}`);
    if (vid) vid.remove();
    delete peers[pid];
  }
}

// --- Chat Logic ---
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

// Poll for chat messages
let enumChatPoll = null;
function startChatPolling() {
  if (enumChatPoll) clearInterval(enumChatPoll);
  let lastTs = 0;
  enumChatPoll = setInterval(async () => {
    if (!groupId) return;
    const res = await fetch(`${FIREBASE_URL}/chats/${groupId}.json`);
    const msgs = await res.json() || {};
    // Sort by timestamp
    const msgArr = Object.values(msgs).sort((a, b) => a.ts - b.ts);
    chatMessages.innerHTML = '';
    for (const msg of msgArr) {
      const div = document.createElement('div');
      div.className = 'msg' + (msg.uid === userId ? ' me' : '');
      div.textContent = (msg.uid === userId ? 'Me: ' : `User ${msg.uid.substr(0, 4)}: `) + msg.text;
      chatMessages.appendChild(div);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 1000);
}

// Send chat message
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !groupId || !userId) return;
  const msg = { uid: userId, text, ts: Date.now() };
  await fetch(`${FIREBASE_URL}/chats/${groupId}.json`, {
    method: 'POST',
    body: JSON.stringify(msg)
  });
  chatInput.value = '';
});

// On join, start listening and connect to existing peers
joinBtn.addEventListener('click', async () => {
  joinBtn.disabled = true;
  userId = randomId();
  groupId = await joinOrCreateGroup(userId);
  groupIdSpan.textContent = `Group: ${groupId}`;
  await startLocalStream();
  await listenForPeers();
  startChatPolling();
  // Initiate connections to existing peers
  const res = await fetch(`${FIREBASE_URL}/groups/${groupId}.json`);
  const members = await res.json() || {};
  for (const pid of Object.keys(members)) {
    if (pid !== userId) {
      createPeerConnection(pid, true);
    }
  }
});

// Group assignment logic using Firebase REST API
async function joinOrCreateGroup(userId) {
  // 1. Get all groups
  const res = await fetch(`${FIREBASE_URL}/groups.json`);
  const groups = await res.json() || {};
  // 2. Find group with <4 users
  for (const [gid, members] of Object.entries(groups)) {
    if (members && Object.keys(members).length < 4) {
      // Join this group
      await fetch(`${FIREBASE_URL}/groups/${gid}/${userId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ joined: Date.now() })
      });
      return gid;
    }
  }
  // 3. Create new group
  const newGroupId = randomId(6);
  await fetch(`${FIREBASE_URL}/groups/${newGroupId}/${userId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ joined: Date.now() })
  });
  return newGroupId;
}

// Get local video/audio
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addVideoStream(localStream, userId);
  } catch (e) {
    alert('Could not access camera/mic.');
  }
}

// Add video to grid
function addVideoStream(stream, uid) {
  let video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.id = `video-${uid}`;
  if (uid === userId) video.muted = true;
  videoGrid.appendChild(video);
}

// Remove self from group and cleanup on unload
window.addEventListener('beforeunload', async () => {
  if (groupId && userId) {
    await fetch(`${FIREBASE_URL}/groups/${groupId}/${userId}.json`, { method: 'DELETE' });
    // Clean up signals
    await fetch(`${FIREBASE_URL}/signals/${groupId}/${userId}.json`, { method: 'DELETE' });
  }
  for (const pid in peers) removePeer(pid);
  if (enumChatPoll) clearInterval(enumChatPoll);
}); 