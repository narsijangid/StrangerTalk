import { db, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push } from './firebase.js';

function randomGroupId() {
  return 'group_' + Math.random().toString(36).substr(2, 6);
}

// Create a new group as interviewer
export async function createGroup(interviewerName, peerId) {
  const groupId = randomGroupId();
  const groupRef = ref(db, `groups/${groupId}`);
  await set(groupRef, {
    createdBy: interviewerName,
    status: 'waiting',
    users: {
      interviewer: { name: interviewerName, peerId }
    }
  });
  return groupId;
}

// Fetch all groups with status 'waiting'
export async function fetchWaitingGroups() {
  const groupsRef = ref(db, 'groups');
  const snapshot = await get(groupsRef);
  if (!snapshot.exists()) return [];
  const groups = snapshot.val();
  // Filter groups with status 'waiting'
  return Object.entries(groups)
    .filter(([id, data]) => data.status === 'waiting')
    .map(([id, data]) => ({ id, ...data }));
}

// Join a group as candidate
export async function joinGroup(groupId, candidateName, peerId) {
  const groupRef = ref(db, `groups/${groupId}`);
  await update(groupRef, {
    status: 'active',
    'users/candidate': { name: candidateName, peerId }
  });
}

// Remove user from group
export async function removeUser(groupId, role) {
  const userRef = ref(db, `groups/${groupId}/users/${role}`);
  await remove(userRef);
}

// Delete group if both users are gone
export async function deleteGroupIfEmpty(groupId) {
  const groupRef = ref(db, `groups/${groupId}/users`);
  const snapshot = await get(groupRef);
  const users = snapshot.val();
  if (!users || (!users.interviewer && !users.candidate)) {
    await remove(ref(db, `groups/${groupId}`));
  }
}

// Listen for group changes
export function onGroupChange(groupId, callback) {
  const groupRef = ref(db, `groups/${groupId}`);
  return onValue(groupRef, snapshot => {
    callback(snapshot.val());
  });
} 