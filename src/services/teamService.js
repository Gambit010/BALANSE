import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayUnion,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { createNotification } from './notificationService';
import { sendPushToToken } from './pushNotificationServices';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';
import { recordActiveDay } from './activityService';
import { inviteIdFor, normalizeEmail } from '../utils/inviteUtils';

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

// ─── Invitations ───
// Joining a team takes two steps: a member invites an email, and the person
// with that email accepts. Nobody can add someone else to a team directly.

// Invite an email to a team. The invited student sees it on their Teams tab.
export const createInvite = async (team, email, inviter) => {
  try {
    const emailLower = normalizeEmail(email);
    await setDoc(doc(db, 'invites', inviteIdFor(team.id, emailLower)), {
      teamId: team.id,
      teamName: team.name,
      emailLower,
      invitedById: inviter.uid,
      invitedByName: safeName(inviter),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error creating invite:', error);
    return false;
  }
};

// Invitations waiting for the signed-in student's email
export const getMyInvites = async (email) => {
  try {
    const q = query(collection(db, 'invites'), where('emailLower', '==', normalizeEmail(email)));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching my invites:', error);
    return [];
  }
};

// Invitations a team has sent that nobody has answered yet
export const getTeamInvites = async (teamId) => {
  try {
    const q = query(collection(db, 'invites'), where('teamId', '==', teamId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching team invites:', error);
    return [];
  }
};

// Accept: the student adds themselves to the team and the invitation is
// removed, together in one batch. The rules only allow this when there is an
// invitation for the student's own verified email.
export const acceptInvite = async (invite, user) => {
  try {
    const member = { uid: user.uid, email: user.email || '', name: safeName(user) };
    const batch = writeBatch(db);
    batch.update(doc(db, 'teams', invite.teamId), {
      memberIds: arrayUnion(user.uid),
      members: arrayUnion(member),
    });
    batch.delete(doc(db, 'invites', invite.id));
    await batch.commit();

    // Let the person who sent the invitation know
    const msg = `${safeName(user)} joined the team "${invite.teamName}".`;
    await createNotification(invite.invitedById, msg, 'team', { teamId: invite.teamId });
    await notifyUserDevice(invite.invitedById, 'Invitation accepted', msg, {
      type: 'team',
      teamId: invite.teamId,
    });
    return { success: true };
  } catch (error) {
    console.error('Error accepting invite:', error);
    // The team was deleted after the invitation was sent
    return { success: false, reason: error?.code === 'not-found' ? 'team-gone' : 'error' };
  }
};

// Decline (by the invited student) or cancel (by the inviter or team owner)
export const deleteInvite = async (inviteId) => {
  try {
    await deleteDoc(doc(db, 'invites', inviteId));
    return true;
  } catch (error) {
    console.error('Error deleting invite:', error);
    return false;
  }
};

// Delete a team, its board tasks and its pending invitations (owner only —
// enforced in the UI and rules). These go first: once the team is gone, the
// rules can no longer tell who owns them.
export const deleteTeam = async (teamId) => {
  try {
    const [tasks, invites] = await Promise.all([
      getDocs(query(collection(db, 'boardTasks'), where('teamId', '==', teamId))),
      getDocs(query(collection(db, 'invites'), where('teamId', '==', teamId))),
    ]);
    const refs = [...tasks.docs, ...invites.docs].map((d) => d.ref);
    // Firestore batches are capped at 500 writes.
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db);
      refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
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
      await createNotification(taskData.assigneeId, msg, 'team', { teamId: team.id, taskId: docRef.id });
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
    if (newProgress >= 100 && (task.progress ?? 0) < 100) {
      recordActiveDay(actor.uid, `team_${task.id}`);
    }
    const label = STATUS_LABELS[statusFromProgress(newProgress)];
    const recipients = new Set();
    if (task.assignedById && task.assignedById !== actor.uid) recipients.add(task.assignedById);
    if (task.assigneeId && task.assigneeId !== actor.uid) recipients.add(task.assigneeId);
    for (const uid of recipients) {
      const msg = `${safeName(actor)} updated "${task.title}" to ${label} (${newProgress}%) in ${team.name}.`;
      await createNotification(uid, msg, 'team', { teamId: team.id, taskId: task.id });
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
      await createNotification(assignee.uid, msg, 'team', { teamId: team.id, taskId: task.id });
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