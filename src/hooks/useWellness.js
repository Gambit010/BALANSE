import { useState, useEffect, useCallback } from "react";
import { useAuth } from './useAuth';
import { saveWellnessScore, getWellnessHistory } from "../services/taskService";
import { WHO5_QUESTIONS, getWellnessStatus, getInterventions, detectDecline } from "../constants/wellness";

const useWellness = () => {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const data = await getWellnessHistory(user.uid);
        setHistory(data);
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
            percentageScore,
            status: status.label,
            interventions,
        };
        const docId = await saveWellnessScore(user.uid, scoreData);
        setSubmitting(false);
        if (docId) {
            await fetchHistory();
            return { id: docId, ...scoreData };
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

export default useWellness;
