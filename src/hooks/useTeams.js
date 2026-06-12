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
    // Sort: lower progress first, then earliest deadline
    const sorted = [...bt].sort((a, b) => {
      if (a.progress !== b.progress) return a.progress - b.progress;
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });
    setTasks(sorted);
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
    addMemberByEmail,
    addTask,
    updateProgress,
    assign,
    removeTask,
    removeTeam,
    refetch: fetchBoard,
  };
};