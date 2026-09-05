import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { createNotification } from './notificationService';
import { sendPushToToken } from './pushNotificationServices';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

// ─── Helpers ───

// Looks up a user's stored Expo push token and sends a real remote push to
// their device. Falls back silently (no-op) if the user has no token saved —
// e.g. they've never opened the app on a physical device, or denied permission.
const notifyUserDevice = async (uid, title, body, data = {}) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'pushToken'));
    const token = snap.exists() ? snap.data().token : null;
    if (token) {
      await sendPushToToken(token, title, body, data);
    }
  } catch (error) {
    console.error('Error notifying user device:', error);
  }
};

// Progress is the single source of truth; status is derived for the board columns.
export const statusFromProgress = (progress) => {
  if (progress >= 100) return 'done';
  if (progress > 0) return 'in-progress';
  return 'todo';
};

export const STATUS_LABELS = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
};

// Safe display name fallback for users who never set a displayName
const safeName = (user) =>
  user?.displayName || (user?.email ? user.email.split('@')[0] : 'A teammate');

// ─── Teams ───

// Create a team with the creator as owner + first member
export const createTeam = async (owner, name) => {
  try {
    const member = { uid: owner.uid, email: owner.email || '', name: safeName(owner) };
    const docRef = await addDoc(collection(db, 'teams'), {
      name: name.trim(),
      ownerId: owner.uid,
      ownerName: safeName(owner),
      memberIds: [owner.uid],
      members: [member],
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating team:', error);
    return null;
  }
};

// Get all teams the user belongs to
export const getUserTeams = async (uid) => {
  try {
    const q = query(
      collection(db, 'teams'),
      where('memberIds', 'array-contains', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
};

// Get a single team
export const getTeam = async (teamId) => {
  try {
    const snap = await getDoc(doc(db, 'teams', teamId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('Error fetching team:', error);
    return null;
  }
};

// Add a member (resolved via findUserByEmail) to a team. Notifies the new member.
export const addTeamMember = async (team, userToAdd) => {
  try {
    if (team.memberIds?.includes(userToAdd.uid)) {
      return { success: false, reason: 'already-member' };
    }
    const member = {
      uid: userToAdd.uid,
      email: userToAdd.email || '',
      name: userToAdd.displayName || 'Student',
    };
    await updateDoc(doc(db, 'teams', team.id), {
      memberIds: arrayUnion(userToAdd.uid),
      members: arrayUnion(member),
    });
    await createNotification(
      userToAdd.uid,
      `You were added to the team "${team.name}".`,
      'team'
    );
    await notifyUserDevice(
      userToAdd.uid,
      'Added to a team',
      `You were added to the team "${team.name}".`,
      { type: 'team', teamId: team.id }
    );
    return { success: true };
  } catch (error) {
    console.error('Error adding team member:', error);
    return { success: false, reason: 'error' };
  }
};

// Delete a team (owner only — enforced in the UI)
export const deleteTeam = async (teamId) => {
  try {
    await deleteDoc(doc(db, 'teams', teamId));
    return true;
  } catch (error) {
    console.error('Error deleting team:', error);
    return false;
  }
};

// ─── Board Tasks ───

// Get every board task assigned to a user, across ALL teams they belong to —
// not scoped to a single team. Used by HomeScreen to fold team assignments
// into "Today's Focus" so they aren't invisible outside the Teams tab.
export const getMyAssignedBoardTasks = async (uid) => {
  try {
    const q = query(
      collection(db, 'boardTasks'),
      where('assigneeId', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching assigned board tasks:', error);
    return [];
  }
};

// Create a board task, optionally assigned to a member. Notifies the assignee.
export const createBoardTask = async (team, taskData, creator) => {
  try {
    // Score board tasks the same way personal tasks are scored, so priority
    // is consistent across the whole app rather than team tasks being unranked.
    const scoreInput = {
      deadline: taskData.deadline || null,
      priority: taskData.priority || 'Medium',
      category: taskData.category || 'Organization',
    };
    const priorityScore = computePriorityScore(scoreInput);
    const priorityLabel = getPriorityLabel(priorityScore);

    const docRef = await addDoc(collection(db, 'boardTasks'), {
      teamId: team.id,
      title: taskData.title.trim(),
      description: taskData.description?.trim() || '',
      deadline: taskData.deadline || null,
      priority: scoreInput.priority,
      category: scoreInput.category,
      priorityScore,
      priorityLabel,
      progress: 0,
      assigneeId: taskData.assigneeId || null,
      assigneeName: taskData.assigneeName || null,
      assignedById: creator.uid,
      assignedByName: safeName(creator),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (taskData.assigneeId && taskData.assigneeId !== creator.uid) {
      const msg = `${safeName(creator)} assigned you "${taskData.title}" in ${team.name}.`;
      await createNotification(taskData.assigneeId, msg, 'team');
      await notifyUserDevice(taskData.assigneeId, 'New task assigned', msg, {
        type: 'team',
        teamId: team.id,
        taskId: docRef.id,
      });
    }
    return docRef.id;
  } catch (error) {
    console.error('Error creating board task:', error);
    return null;
  }
};

// Get all board tasks for a team
export const getBoardTasks = async (teamId) => {
  try {
    const q = query(
      collection(db, 'boardTasks'),
      where('teamId', '==', teamId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching board tasks:', error);
    return [];
  }
};

// Update progress. Notifies the OTHER stakeholder(s) — never the person who changed it.
export const updateBoardTaskProgress = async (team, task, newProgress, actor) => {
  try {
    await updateDoc(doc(db, 'boardTasks', task.id), {
      progress: newProgress,
      updatedAt: serverTimestamp(),
    });
    const label = STATUS_LABELS[statusFromProgress(newProgress)];
    const recipients = new Set();
    if (task.assignedById && task.assignedById !== actor.uid) recipients.add(task.assignedById);
    if (task.assigneeId && task.assigneeId !== actor.uid) recipients.add(task.assigneeId);
    for (const uid of recipients) {
      const msg = `${safeName(actor)} updated "${task.title}" to ${label} (${newProgress}%) in ${team.name}.`;
      await createNotification(uid, msg, 'team');
      await notifyUserDevice(uid, 'Team task updated', msg, {
        type: 'team',
        teamId: team.id,
        taskId: task.id,
      });
    }
    return true;
  } catch (error) {
    console.error('Error updating board task:', error);
    return false;
  }
};

// Assign / reassign a task to a member. Notifies the new assignee.
export const assignBoardTask = async (team, task, assignee, actor) => {
  try {
    await updateDoc(doc(db, 'boardTasks', task.id), {
      assigneeId: assignee.uid,
      assigneeName: assignee.name,
      updatedAt: serverTimestamp(),
    });
    if (assignee.uid !== actor.uid) {
      const msg = `${safeName(actor)} assigned you "${task.title}" in ${team.name}.`;
      await createNotification(assignee.uid, msg, 'team');
      await notifyUserDevice(assignee.uid, 'New task assigned', msg, {
        type: 'team',
        teamId: team.id,
        taskId: task.id,
      });
    }
    return true;
  } catch (error) {
    console.error('Error assigning board task:', error);
    return false;
  }
};

// Delete a board task
export const deleteBoardTask = async (taskId) => {
  try {
    await deleteDoc(doc(db, 'boardTasks', taskId));
    return true;
  } catch (error) {
    console.error('Error deleting board task:', error);
    return false;
  }
};