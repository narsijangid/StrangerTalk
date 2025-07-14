import { app, firebaseConfig } from './firebase-config.js';
import {
  getDatabase,
  ref,
  onValue,
  set,
  push,
  remove,
  get,
  child,
  update
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const db = getDatabase(app);
const joinBtn = document.getElementById('join-btn');
const statusDiv = document.getElementById('status');
const videos = [
  document.getElementById('video-1'),
  document.getElementById('video-2'),
  document.getElementById('video-3'),
  document.getElementById('video-4')
];

let localStream = null;
let peers = {};
let myId = null;
let myGroup = null;

function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

async function assignGroup() {
  const groupsRef = ref(db, 'groups');
  const snapshot = await get(groupsRef);
  let groupId = null;
  let groupMembers = null;
  if (snapshot.exists()) {
    const groups = snapshot.val();
    for (const [gid, members] of Object.entries(groups)) {
      if (members && Object.keys(members).length < 4) {
        groupId = gid;
        groupMembers = members;
        break;
      }
    }
  }
  if (!groupId) {
    groupId = randomId();
    groupMembers = {};
  }
  return { groupId, groupMembers };
}

async function joinGroup() {
  joinBtn.disabled = true;
  statusDiv.textContent = 'Joining group...';
  myId = randomId();
  await startLocalStream(); // Start local stream first
  const { groupId, groupMembers } = await assignGroup();
  myGroup = groupId;

  await update(ref(db, `groups/${groupId}/${myId}`), { joined: Date.now() });
  statusDiv.textContent = `Joined group: ${groupId}`;

  onValue(ref(db, `groups/${groupId}`), (snap) => {
    const members = snap.val() || {};
    const ids = Object.keys(members);
    connectToPeers(ids);
  });

  listenSignaling();
}

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    videos[0].srcObject = localStream;
  } catch (e) {
    statusDiv.textContent = 'Camera/Mic access denied.';
  }
}

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function connectToPeers(ids) {
  ids = ids.filter(id => id !== myId);
  // Sort IDs for consistent video assignment
  const sortedIds = [myId, ...ids].sort();
  // Remove old peers
  for (const pid in peers) {
    if (!ids.includes(pid)) {
      console.log('Closing peer connection for', pid);
      peers[pid].pc.close();
      delete peers[pid];
    }
  }
  ids.forEach((pid) => {
    if (!peers[pid]) {
      console.log('Creating peer connection with', pid);
      const pc = new RTCPeerConnection(rtcConfig);
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('Sending ICE candidate to', pid);
          sendSignal(pid, { type: 'ice', candidate: e.candidate });
        }
      };
      pc.ontrack = (e) => {
        console.log('Received remote track from', pid, e.streams[0]);
        // Find the correct video index for this peer
        const idx = sortedIds.indexOf(pid);
        if (videos[idx]) {
          videos[idx].srcObject = e.streams[0];
        }
      };
      // Always try negotiation, not just myId < pid
      pc.onnegotiationneeded = async () => {
        try {
          console.log('Negotiation needed with', pid);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(pid, { type: 'offer', sdp: offer });
        } catch (err) {
          console.error('Negotiation error:', err);
        }
      };
      peers[pid] = { pc };
    }
  });
}

function sendSignal(to, data) {
  console.log('Sending signal to', to, data);
  const sigRef = ref(db, `signals/${myGroup}/${to}/${myId}`);
  set(sigRef, data);
}

function listenSignaling() {
  onValue(ref(db, `signals/${myGroup}/${myId}`), async (snap) => {
    const signals = snap.val() || {};
    for (const from in signals) {
      const data = signals[from];
      let pc = peers[from]?.pc;
      if (!pc) {
        console.warn('No peer connection for', from, 'when receiving signal', data);
        continue;
      }
      if (data.type === 'offer') {
        console.log('Received offer from', from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { type: 'answer', sdp: answer });
      } else if (data.type === 'answer') {
        console.log('Received answer from', from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'ice') {
        console.log('Received ICE from', from);
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('ICE error:', err);
        }
      }
      remove(ref(db, `signals/${myGroup}/${myId}/${from}`));
    }
  });
}

joinBtn.onclick = joinGroup;
