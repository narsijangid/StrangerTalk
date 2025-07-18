import { db, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push } from './firebase.js';

function randomGroupId() {
  return 'group_' + Math.random().toString(36).substr(2, 6);
}

// Create a new group as interviewer
export async function createGroup(interviewerName, peerId) {
  // Ensure unique group name
  const groupsRef = ref(db, 'groups');
  const snapshot = await get(groupsRef);
  let uniqueName = interviewerName;
  if (snapshot.exists()) {
    const groups = snapshot.val();
    const names = Object.values(groups).map(g => g.createdBy);
    if (names.includes(interviewerName)) {
      // Find a unique suffix
      let suffix = 2;
      let candidateName = `${interviewerName}★`;
      while (names.includes(candidateName)) {
        candidateName = `${interviewerName}${suffix}`;
        suffix++;
      }
      uniqueName = candidateName;
    }
  }
  const groupId = randomGroupId();
  const groupRef = ref(db, `groups/${groupId}`);
  await set(groupRef, {
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
  const groupRef = ref(db, `groups/${groupId}`);
  // Add candidate to users.candidates
  await update(groupRef, {
    status: 'active',
    [`users/candidates/${peerId}`]: { name: candidateName, peerId }
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