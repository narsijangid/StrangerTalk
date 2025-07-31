import { db, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push } from './firebase.js';

function randomGroupId() {
  return 'group_' + Math.random().toString(36).substr(2, 6);
}

// Create a new group as interviewer
export async function createGroup(roomName, category, peerId) {
  // Ensure unique group name
  const groupsRef = ref(db, 'groups');
  const snapshot = await get(groupsRef);
  let uniqueName = roomName;
  if (snapshot.exists()) {
    const groups = snapshot.val();
    const names = Object.values(groups).map(g => g.roomName);
    if (names.includes(roomName)) {
      // Find a unique suffix
      let suffix = 2;
      let candidateName = `${roomName}★`;
      while (names.includes(candidateName)) {
        candidateName = `${roomName}${suffix}`;
        suffix++;
      }
      uniqueName = candidateName;
    }
  }
  const groupId = randomGroupId();
  const groupRef = ref(db, `groups/${groupId}`);
  await set(groupRef, {
    roomName: uniqueName,
    category: category,
    createdBy: uniqueName,
    status: 'waiting',
    users: {
      interviewer: { name: uniqueName, peerId }
    }
  });
  return groupId;
}

// Fetch all groups that are available for candidates to join
export async function fetchWaitingGroups() {
  const groupsRef = ref(db, 'groups');
  const snapshot = await get(groupsRef);
  if (!snapshot.exists()) return [];
  const groups = snapshot.val();
  // Show groups that are:
  // - status 'waiting' (host present, waiting for candidate)
  // - OR status 'active' and interviewer is missing (host left, but candidates can join)
  return Object.entries(groups)
    .filter(([id, data]) =>
      (data.status === 'waiting') ||
      (data.status === 'active' && (!data.users || !data.users.interviewer))
    )
    .map(([id, data]) => ({ id, ...data }));
}

// Join a group as candidate
export async function joinGroup(groupId, candidateName, peerId) {
  // Check if user is blocked
  const blockedRef = ref(db, `blockedUsers/${groupId}/${peerId}`);
  const blockedSnapshot = await get(blockedRef);
  
  if (blockedSnapshot.exists()) {
    // User is blocked from this group
    throw new Error('You have been blocked from joining this group.');
  }
  
  const groupRef = ref(db, `groups/${groupId}`);
  // Add candidate to users.candidates
  await update(groupRef, {
    status: 'active',
    [`users/candidates/${peerId}`]: { name: candidateName, peerId }
  });
}

// Remove user from group
export async function removeUser(groupId, role, peerId = null) {
  if (role === 'candidate' && peerId) {
    // Remove specific candidate by peerId
    const candidateRef = ref(db, `groups/${groupId}/users/candidates/${peerId}`);
    await remove(candidateRef);
  } else {
    // Remove interviewer or general user
    const userRef = ref(db, `groups/${groupId}/users/${role}`);
    await remove(userRef);
  }
}

// Delete group if both users are gone
export async function deleteGroupIfEmpty(groupId) {
  const groupRef = ref(db, `groups/${groupId}/users`);
  const snapshot = await get(groupRef);
  const users = snapshot.val();
  if (!users || (!users.interviewer && (!users.candidates || Object.keys(users.candidates).length === 0))) {
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