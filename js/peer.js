let peer = null;
let currentCall = null;

export function createPeer(onOpen) {
  peer = new Peer();
  peer.on('open', id => {
    if (onOpen) onOpen(id);
  });
  return peer;
}

export function getPeer() {
  return peer;
}

export function callPeer(remotePeerId, stream, onCall) {
  currentCall = peer.call(remotePeerId, stream);
  if (onCall) onCall(currentCall);
}

export function answerCall(onStream) {
  peer.on('call', call => {
    call.answer(window.localStream);
    call.on('stream', remoteStream => {
      if (onStream) onStream(remoteStream);
    });
    currentCall = call;
  });
}

export function setLocalStream(stream) {
  window.localStream = stream;
  // Set local video element if present
  const localVideo = document.getElementById('local-video');
  if (localVideo) {
    localVideo.srcObject = stream;
  }
}

export function muteLocal(mute) {
  if (window.localStream) {
    window.localStream.getAudioTracks().forEach(track => {
      track.enabled = !mute;
    });
  }
}

export function shareScreen(onStream) {
  navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    .then(screenStream => {
      if (onStream) onStream(screenStream);
    });
}

export function closeCall() {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
}

export function destroyPeer() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
} 