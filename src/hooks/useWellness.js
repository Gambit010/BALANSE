import { useState, useEffect, useCallback } from "react";
import { auth } from '../../firebase'
import { saveWellnessScore, getWellnessHistory } from "../services/taskService";
import { WHO5_QUESTIONS, getWellnessStatus, getInterventions, detectDecline } from "../constants/wellness";

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
        ? getInterventions(latestScore.percentage)
        : [];
    const activeTaskCount = 0; // TODO: wire up from useTasks if needed

       return {
        history,
        loading,
        latestScore,
        latestStatus,
        decline,
        interventions,
        activeTaskCount,
        submitAssessment,
        refetch: fetchHistory,
    };

};

export { useWellness };
