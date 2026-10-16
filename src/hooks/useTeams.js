import { useState, useEffect, useCallback } from 'react';
import { auth } from '../../firebase';
import {
  createTeam,
  getUserTeams,
  getTeam,
  addTeamMember,
  deleteTeam,
  createBoardTask,
  getBoardTasks,
  updateBoardTaskProgress,
  assignBoardTask,
  deleteBoardTask,
  statusFromProgress,
} from '../services/teamService';
import { findUserByEmail } from '../services/userService';
import { getUserTasks } from '../services/taskService';
import { detectConflicts } from '../services/conflictService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

// ─── Hook: list of the current user's teams ───
export const useTeams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getUserTeams(user.uid);
    setTeams(result);
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

  return { teams, loading, create, refetch: fetchTeams };
};

// ─── Hook: a single team + its board ───
export const useTeamBoard = (teamId) => {
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
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
    const [t, bt] = await Promise.all([getTeam(teamId), getBoardTasks(teamId)]);
    setTeam(t);

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

  const addMemberByEmail = async (email) => {
    if (!team || !email?.trim()) return { success: false, reason: 'invalid' };
    if (actor && email.trim().toLowerCase() === (actor.email || '').toLowerCase()) {
      return { success: false, reason: 'self' };
    }
    const found = await findUserByEmail(email);
    if (!found) return { success: false, reason: 'not-found' };
    const res = await addTeamMember(team, found);
    if (res.success) await fetchBoard();
    return res;
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

  return {
    team,
    tasks,
    columns,
    loading,
    isOwner,
    actor,
    teamTaskConflicts,
    addMemberByEmail,
    addTask,
    updateProgress,
    assign,
    removeTask,
    removeTeam,
    refetch: fetchBoard,
  };
};