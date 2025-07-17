import { db, ref, set, onValue, push } from './firebase.js';

// Send a chat message
export async function sendMessage(groupId, sender, text) {
  const chatRef = ref(db, `groups/${groupId}/chat`);
  const message = {
    sender,
    text,
    timestamp: Date.now()
  };
  const newMsgRef = push(chatRef);
  await set(newMsgRef, message);
}

// Listen for chat messages
export function onChatMessages(groupId, callback) {
  const chatRef = ref(db, `groups/${groupId}/chat`);
  return onValue(chatRef, snapshot => {
    const messages = [];
    snapshot.forEach(child => {
      messages.push(child.val());
    });
    callback(messages);
  });
} 