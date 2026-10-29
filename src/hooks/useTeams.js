import { useState, useEffect, useCallback } from 'react';
import { auth } from '../../firebase';
import {
  createTeam,
  getUserTeams,
  getTeam,
  deleteTeam,
  createInvite,
  getMyInvites,
  getTeamInvites,
  acceptInvite,
  deleteInvite,
  removeTeamMember,
  createBoardTask,
  getBoardTasks,
  updateBoardTaskProgress,
  assignBoardTask,
  deleteBoardTask,
  statusFromProgress,
} from '../services/teamService';
import { getInviteError } from '../utils/inviteUtils';
import { getUserTasks } from '../services/taskService';
import { detectConflicts } from '../services/conflictService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

// ─── Hook: list of the current user's teams and invitations ───
export const useTeams = () => {
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setTeams([]);
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [result, myInvites] = await Promise.all([
      getUserTeams(user.uid),
      getMyInvites(user.email),
    ]);
    setTeams(result);
    setInvites(myInvites);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const create = async (name) => {
    const user = auth.currentUser;
    if (!user || !name?.trim()) return null;
    const id = await createTeam(user, name);
    await fetchTeams();
    return id;
  };

  const accept = async (invite) => {
    const user = auth.currentUser;
    if (!user) return { success: false, reason: 'error' };
    const res = await acceptInvite(invite, user);
    await fetchTeams();
    return res;
  };

  const decline = async (invite) => {
    const ok = await deleteInvite(invite.id);
    await fetchTeams();
    return ok;
  };

  return { teams, invites, loading, create, accept, decline, refetch: fetchTeams };
};

// ─── Hook: a single team + its board ───
export const useTeamBoard = (teamId) => {
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamTaskConflicts, setTeamTaskConflicts] = useState({}); // { [boardTaskId]: conflict[] }

  // Normalized current user (the "actor" performing changes)
  const actor = (() => {
    const u = auth.currentUser;
    if (!u) return null;
    return { uid: u.uid, email: u.email, displayName: u.displayName };
  })();

  const fetchBoard = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    const [t, bt, inv] = await Promise.all([getTeam(teamId), getBoardTasks(teamId), getTeamInvites(teamId)]);
    setTeam(t);
    setPendingInvites(inv);

    // Recompute priority score fresh on every fetch — same as personal tasks
    // in useTasks.js. Deadline proximity changes daily, so a score stored once
    // at creation would silently go stale (e.g. never escalating to "High" as
    // the deadline approaches). The value stored at creation is just a fallback
    // for the brief window before the first fetch.
    const scored = bt.map((task) => {
      const score = computePriorityScore(task);
      return { ...task, priorityScore: score, priorityLabel: getPriorityLabel(score) };
    });

    // Sort: unfinished before done, then highest priority score first, then earliest deadline
    const sorted = [...scored].sort((a, b) => {
      const aDone = a.progress === 100 ? 1 : 0;
      const bDone = b.progress === 100 ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });
    setTasks(sorted);

    // Cross-check team tasks assigned to the current user against their
    // personal tasks/classes — without this, a team task could silently
    // overlap a class or personal deadline with no warning anywhere.
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const personalTasks = await getUserTasks(currentUser.uid);
        const myAssignedTasks = sorted.filter((bTask) => bTask.assigneeId === currentUser.uid);
        const newConflictMap = {};
        for (const bTask of myAssignedTasks) {
          if (!bTask.deadline) continue;
          const found = detectConflicts(bTask, personalTasks, null);
          if (found.length > 0) newConflictMap[bTask.id] = found;
        }
        setTeamTaskConflicts(newConflictMap);
      } catch (error) {
        console.error('Error cross-checking team task conflicts:', error);
      }
    }

    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Group tasks into board columns (status derived from progress)
  const columns = {
    todo: tasks.filter((t) => statusFromProgress(t.progress) === 'todo'),
    'in-progress': tasks.filter((t) => statusFromProgress(t.progress) === 'in-progress'),
    done: tasks.filter((t) => statusFromProgress(t.progress) === 'done'),
  };

  const isOwner = !!(team && actor && team.ownerId === actor.uid);

  // ─── Actions ───

  const inviteByEmail = async (email) => {
    if (!team || !actor) return { success: false, reason: 'error' };
    const reason = getInviteError(email, {
      myEmail: actor.email,
      members: team.members,
      pendingEmails: pendingInvites.map((i) => i.emailLower),
    });
    if (reason) return { success: false, reason };
    const ok = await createInvite(team, email, actor);
    if (ok) await fetchBoard();
    return ok ? { success: true } : { success: false, reason: 'error' };
  };

  const cancelInvite = async (invite) => {
    const ok = await deleteInvite(invite.id);
    if (ok) await fetchBoard();
    return ok;
  };

  const addTask = async (taskData) => {
    if (!team || !actor || !taskData?.title?.trim()) return null;
    const id = await createBoardTask(team, taskData, actor);
    await fetchBoard();
    return id;
  };

  const updateProgress = async (task, newProgress) => {
    if (!team || !actor) return false;
    const ok = await updateBoardTaskProgress(team, task, newProgress, actor);
    if (ok) await fetchBoard();
    return ok;
  };

  const assign = async (task, assignee) => {
    if (!team || !actor) return false;
    const ok = await assignBoardTask(team, task, assignee, actor);
    if (ok) await fetchBoard();
    return ok;
  };

  const removeTask = async (taskId) => {
    const ok = await deleteBoardTask(taskId);
    if (ok) await fetchBoard();
    return ok;
  };

  const removeTeam = async () => {
    if (!team) return false;
    return await deleteTeam(team.id);
  };

  // Any member except the owner can leave. The screen goes back afterwards,
  // so there's no board to reload.
  const leave = async () => {
    if (!team || !actor) return false;
    const me = (team.members || []).find((m) => m.uid === actor.uid);
    if (!me) return false;
    return await removeTeamMember(team, me, actor);
  };

  // Owner only (checked in the screen and the rules)
  const removeMember = async (member) => {
    if (!team || !actor) return false;
    const ok = await removeTeamMember(team, member, actor);
    if (ok) await fetchBoard();
    return ok;
  };

  return {
    team,
    tasks,
    columns,
    loading,
    isOwner,
    actor,
    teamTaskConflicts,
    pendingInvites,
    inviteByEmail,
    cancelInvite,
    addTask,
    updateProgress,
    assign,
    removeTask,
    removeTeam,
    leave,
    removeMember,
    refetch: fetchBoard,
  };
};