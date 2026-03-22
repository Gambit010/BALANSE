import { useState, useEffect, useCallback } from "react";
import { useAuth } from './useAuth';
import { saveWellnessScore, getWellnessHistory } from "../services/taskService";
import { WHO5_QUESTIONS, getWellnessStatus, getInterventions } from "../constants/wellness";

const useWellness = () => {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchHistory = useCallback(async () =>{
        if (!user) return;
        setLoading(true);
        const data = await getWellnessHistory(user.uid)
        setHistory(data);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchHistory();

    }, [fetchHistory]);

    const submitAssessment = async (responses) => {
        if (!user) return null;
        setSubmitting(true);

        const rawScore = response.reduce((sum, val) => sum + val, 0);
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

        if (docId){
            await fetchHistory();
            return { id: docId, ...scoreData};
        }
        return null;
    }

    const isWellnessDeclining = () => {
        if (history.length < 3) return false;
        const recent = history.slice(0, 3);

        return (
            recent[0].percentageScore < recent[1].percentageScore &&
            recent[1].percentageScore < recent[2].percentageScore
        );
    }

    const latestResult = history.length > 0 ? history[0] : null

    const chartData = [...history]
        .reverse()
        .map((entry) => ({
          data: entry.createdAt?.toDate?.()
            ? entry.createdAt.toDate().toLocaleDataString('en-US', { month: 'short', day: 'numeric', })
            : 'N/A',
        score: entry.percentageScore,
        }));
    
    return {
        history,
        latestResult,
        chartData,
        loading,
        submitting,
        submitAssessment,
        isWellnessDeclining,
        fetchHistory,
        questions: WHO5_QUESTIONS,
    };
};
