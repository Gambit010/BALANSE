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

// ─── Helpers ───

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

// Create a board task, optionally assigned to a member. Notifies the assignee.
export const createBoardTask = async (team, taskData, creator) => {
  try {
    const docRef = await addDoc(collection(db, 'boardTasks'), {
      teamId: team.id,
      title: taskData.title.trim(),
      description: taskData.description?.trim() || '',
      deadline: taskData.deadline || null,
      progress: 0,
      assigneeId: taskData.assigneeId || null,
      assigneeName: taskData.assigneeName || null,
      assignedById: creator.uid,
      assignedByName: safeName(creator),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (taskData.assigneeId && taskData.assigneeId !== creator.uid) {
      await createNotification(
        taskData.assigneeId,
        `${safeName(creator)} assigned you "${taskData.title}" in ${team.name}.`,
        'team'
      );
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
      await createNotification(
        uid,
        `${safeName(actor)} updated "${task.title}" to ${label} (${newProgress}%) in ${team.name}.`,
        'team'
      );
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
      await createNotification(
        assignee.uid,
        `${safeName(actor)} assigned you "${task.title}" in ${team.name}.`,
        'team'
      );
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