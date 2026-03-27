import { useState, useEffect, useCallback } from "react";
import { auth } from '../../firebase'
import { saveWellnessScore, getWellnessHistory } from "../services/taskService";
import { WHO5_QUESTIONS, getWellnessStatus, getInterventions, detectDecline } from "../constants/wellness";
import { getUserTasks } from '../services/taskService';


const useWellness = () => {
    const user = auth.currentUser;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const raw = await getWellnessHistory(user.uid);
        const parsed = raw.map(entry => ({
          ...entry,
        percentage: entry.percentage ?? (entry.rawScore ? entry.rawScore * 4 : 0),
        date: entry.createdAt?.toDate?.() ?? new Date(entry.createdAt),
        }));
        setHistory(parsed);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const submitAssessment = async (responses) => {
        if (!user) return null;
        setSubmitting(true);
        const rawScore = Object.values(responses).reduce((sum, val) => sum + val, 0);
        const percentageScore = rawScore * 4;
        const status = getWellnessStatus(percentageScore);
        const interventions = getInterventions(percentageScore);
        const scoreData = {
            responses,
            rawScore,
            percentage: percentageScore,
            status: status.label,
            interventions,
        };
        const docId = await saveWellnessScore(user.uid, scoreData);
        setSubmitting(false);
        if (docId) {
            await fetchHistory();
            return { id: docId, rawScore, percentage: percentageScore, status };
        }
        return null;
    };

    // Derived values the screen expects
    const latestScore = history.length > 0 ? history[0] : null;
    const latestStatus = latestScore ? getWellnessStatus(latestScore.percentage) : null;
    const decline = detectDecline(history);
    const interventions = latestScore
        ? getInterventions(latestScore.percentage, activeTaskCount)
        : [];

    const [activeTaskCount, setActiveTaskCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        const fetchTaskCount = async () => {
            const tasks = await getUserTasks(user.uid);
            const active = tasks.filter(t => t.progress < 100).length;
        setActiveTaskCount(active);
        };
        fetchTaskCount();
    }, [user]);


    // Check if 14 days have passed since last assessment
    const canTakeAssessment = (() => {
          if (!latestScore || !latestScore.date) return true;
             const now = new Date();
             const lastDate = latestScore.date instanceof Date ? latestScore.date : new Date(latestScore.date);
             const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
                 return diffDays >= 14;
             })();

    const nextAssessmentDate = (() => {
         if (!latestScore || !latestScore.date) return null;
            const lastDate = latestScore.date instanceof Date ? latestScore.date : new Date(latestScore.date);
            const next = new Date(lastDate);
            next.setDate(next.getDate() + 14);
             return next;
                })();

       return {
        history,
        loading,
        latestScore,
        latestStatus,
        decline,
        interventions,
        activeTaskCount,
        canTakeAssessment,      
        nextAssessmentDate, 
        submitAssessment,
        refetch: fetchHistory,
    };

};

export { useWellness };
