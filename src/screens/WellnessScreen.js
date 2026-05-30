import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWellness } from '../hooks/useWellness';
import {
  WHO5_QUESTIONS,
  LIKERT_OPTIONS,
  TIMEFRAME_TEXT,
  getWellnessStatus,
} from '../constants/wellness';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 180;
const CHART_PADDING = 40;

export default function WellnessScreen() {
  const {
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
    refetch,
  } = useWellness();

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ─── Questionnaire Logic ───

  const startAssessment = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setResult(null);
    setShowQuestionnaire(true);
  };

  const selectAnswer = (questionId, value) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (currentQuestion < WHO5_QUESTIONS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < 5) {
      Alert.alert('Incomplete', 'Please answer all 5 questions before submitting.');
      return;
    }
    setSubmitting(true);
    const res = await submitAssessment(answers);
    setSubmitting(false);
    if (res) {
      setResult(res);
    } else {
      Alert.alert('Error', 'Failed to save your assessment. Please try again.');
    }
  };

  const closeQuestionnaire = () => {
    setShowQuestionnaire(false);
    setResult(null);
  };

  // ─── Simple Line Chart ───

  const renderChart = () => {
    if (history.length < 2) return null;

    const data = [...history].reverse().slice(-10);
    const maxVal = 100;
    const chartWidth = SCREEN_WIDTH - 64;
    const usableWidth = chartWidth - CHART_PADDING;
    const usableHeight = CHART_HEIGHT - 40;
    const stepX = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth;

    const points = data.map((entry, i) => ({
      x: CHART_PADDING + i * stepX,
      y: 20 + usableHeight - (entry.percentage / maxVal) * usableHeight,
      percentage: entry.percentage,
      date: entry.date,
    }));

    const pathSegments = [];
    for (let i = 0; i < points.length - 1; i++) {
      pathSegments.push({ from: points[i], to: points[i + 1] });
    }

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Score History</Text>
        <View style={[styles.chartBox, { height: CHART_HEIGHT }]}>
          {[0, 25, 50, 75, 100].map(val => {
            const y = 20 + usableHeight - (val / maxVal) * usableHeight;
            return (
              <View key={val} style={styles.gridRow}>
                <Text style={[styles.gridLabel, { top: y - 8 }]}>{val}</Text>
                <View style={[styles.gridLine, { top: y }]} />
              </View>
            );
          })}
          <View
            style={[
              styles.thresholdLine,
              { top: 20 + usableHeight - (50 / maxVal) * usableHeight },
            ]}
          />
          {pathSegments.map((seg, i) => {
            const dx = seg.to.x - seg.from.x;
            const dy = seg.to.y - seg.from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={i}
                style={[
                  styles.lineSegment,
                  {
                    left: seg.from.x,
                    top: seg.from.y,
                    width: length,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
          {points.map((pt, i) => {
            const status = getWellnessStatus(pt.percentage);
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    left: pt.x - 5,
                    top: pt.y - 5,
                    backgroundColor: status.color,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.dateRow}>
          {points.length > 0 && (
            <>
              <Text style={styles.dateLabel}>{formatShortDate(points[0].date)}</Text>
              <Text style={styles.dateLabel}>{formatShortDate(points[points.length - 1].date)}</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  // ─── Render ───

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>Loading wellness data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Well-being</Text>
          <Text style={styles.subtitle}>WHO-5 Well-Being Index</Text>
        </View>

        {/* Current Score Card */}
        {latestScore ? (
          <View style={[styles.scoreCard, { borderLeftColor: latestStatus?.color }]}>
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.scoreValue}>{latestScore.percentage}%</Text>
                <Text style={[styles.scoreLabel, { color: latestStatus?.color }]}>
                  {latestStatus?.label}
                </Text>
              </View>
              <View style={styles.scoreRing}>
                <Text style={styles.scoreRingText}>{latestScore.rawScore}/25</Text>
                <Text style={styles.scoreRingLabel}>Raw</Text>
              </View>
            </View>
            <Text style={styles.scoreDescription}>{latestStatus?.description}</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="heart-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No assessments yet</Text>
            <Text style={styles.emptySubtext}>
              Take your first WHO-5 check-in to track your well-being over time.
            </Text>
          </View>
        )}

        {/* Decline Alert */}
        {decline?.hasDrop && (
          <View style={styles.alertCard}>
            <Ionicons name="trending-down" size={22} color="#f87171" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Score Decline Detected</Text>
              <Text style={styles.alertText}>{decline.message}</Text>
            </View>
          </View>
        )}

        {/* Take Assessment Button */}
        <TouchableOpacity
            style={[styles.assessButton, !canTakeAssessment && { opacity: 0.5 }]}
            onPress={startAssessment}
            disabled={!canTakeAssessment}
>
        <Ionicons name="clipboard-outline" size={20} color="#fff" />
        <Text style={styles.assessButtonText}>
        {!canTakeAssessment
            ? `Next check-in: ${nextAssessmentDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : latestScore ? 'New Check-in' : 'Take WHO-5 Assessment'}
         </Text>
         </TouchableOpacity>

        {/* Score History Chart */}
        {renderChart()}

        {/* Workload Correlation */}
        {latestScore && (
          <View style={styles.correlationCard}>
            <Text style={styles.sectionTitle}>Workload Snapshot</Text>
            <View style={styles.correlationRow}>
              <View style={styles.correlationItem}>
                <Text style={styles.correlationValue}>{activeTaskCount}</Text>
                <Text style={styles.correlationLabel}>Active Tasks</Text>
              </View>
              <View style={styles.correlationItem}>
                <Text style={styles.correlationValue}>{latestScore.percentage}%</Text>
                <Text style={styles.correlationLabel}>Well-being</Text>
              </View>
              <View style={styles.correlationItem}>
                <Text style={styles.correlationValue}>{history.length}</Text>
                <Text style={styles.correlationLabel}>Check-ins</Text>
              </View>
            </View>
            {activeTaskCount > 5 && latestScore.percentage < 50 && (
              <Text style={styles.correlationWarning}>
                High workload with low well-being detected. Consider reducing active tasks.
              </Text>
            )}
          </View>
        )}

        {/* Interventions / Recommendations */}
        {interventions.length > 0 && (
          <View style={styles.interventionsSection}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {interventions.map((item, idx) => (
              <View key={idx} style={styles.interventionCard}>
                <Ionicons name={item.icon} size={24} color="#a78bfa" />
                <View style={styles.interventionContent}>
                  <Text style={styles.interventionTitle}>{item.title}</Text>
                  <Text style={styles.interventionText}>{item.text}</Text>
                  {item.link && (
                    <TouchableOpacity onPress={() => Linking.openURL(item.link)}>
                      <Text style={styles.interventionLink}>Visit Resource</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* History List */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Past Assessments</Text>
            {history.slice(0, 10).map((entry, idx) => {
              const status = getWellnessStatus(entry.percentage);
              return (
                <View key={entry.id || idx} style={styles.historyItem}>
                  <View style={[styles.historyDot, { backgroundColor: status.color }]} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyScore}>{entry.percentage}%</Text>
                    <Text style={styles.historyLabel}>{status.label}</Text>
                  </View>
                  <Text style={styles.historyDate}>{formatDate(entry.date)}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ─── Questionnaire Modal ─── */}
      <Modal visible={showQuestionnaire} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          {result ? (
            <View style={styles.resultContainer}>
              <View style={[styles.resultCircle, { borderColor: result.status.color }]}>
                <Text style={styles.resultScore}>{result.percentage}%</Text>
              </View>
              <Text style={[styles.resultLabel, { color: result.status.color }]}>
                {result.status.label}
              </Text>
              <Text style={styles.resultRaw}>Raw Score: {result.rawScore} / 25</Text>
              <Text style={styles.resultDescription}>{result.status.description}</Text>
              <TouchableOpacity style={styles.doneButton} onPress={closeQuestionnaire}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.questionContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeQuestionnaire}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>WHO-5 Check-in</Text>
                <Text style={styles.modalProgress}>
                  {currentQuestion + 1} / {WHO5_QUESTIONS.length}
                </Text>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${((currentQuestion + 1) / WHO5_QUESTIONS.length) * 100}%` },
                  ]}
                />
              </View>

              <Text style={styles.timeframe}>{TIMEFRAME_TEXT}</Text>

              <Animated.View style={[styles.questionCard, { opacity: fadeAnim }]}>
                <Text style={styles.questionNumber}>Q{currentQuestion + 1}</Text>
                <Text style={styles.questionText}>
                  {WHO5_QUESTIONS[currentQuestion].text}
                </Text>

                {LIKERT_OPTIONS.map(option => {
                  const questionId = WHO5_QUESTIONS[currentQuestion].id;
                  const isSelected = answers[questionId] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionButton, isSelected && styles.optionSelected]}
                      onPress={() => selectAnswer(questionId, option.value)}
                    >
                      <View style={[styles.optionRadio, isSelected && styles.optionRadioFilled]}>
                        {isSelected && <View style={styles.optionRadioDot} />}
                      </View>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.optionValue, isSelected && styles.optionValueSelected]}>
                        {option.value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.navButton, currentQuestion === 0 && styles.navButtonDisabled]}
                  onPress={() => currentQuestion > 0 && setCurrentQuestion(currentQuestion - 1)}
                  disabled={currentQuestion === 0}
                >
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                  <Text style={styles.navButtonText}>Back</Text>
                </TouchableOpacity>

                {currentQuestion === WHO5_QUESTIONS.length - 1 && Object.keys(answers).length === 5 ? (
                  <TouchableOpacity
                    style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.navButton,
                      currentQuestion === WHO5_QUESTIONS.length - 1 && styles.navButtonDisabled,
                    ]}
                    onPress={() =>
                      currentQuestion < WHO5_QUESTIONS.length - 1 &&
                      setCurrentQuestion(currentQuestion + 1)
                    }
                    disabled={currentQuestion === WHO5_QUESTIONS.length - 1}
                  >
                    <Text style={styles.navButtonText}>Next</Text>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Helpers ───

const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Styles ───

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  scoreCard: { backgroundColor: '#1a1a3e', borderRadius: 16, padding: 20, borderLeftWidth: 4, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  scoreValue: { fontSize: 42, fontWeight: 'bold', color: '#ffffff' },
  scoreLabel: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  scoreRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#a78bfa', justifyContent: 'center', alignItems: 'center' },
  scoreRingText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scoreRingLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  scoreDescription: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19 },
  emptyCard: { backgroundColor: '#1a1a3e', borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 12 },
  emptySubtext: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 8 },
  alertCard: { flexDirection: 'row', backgroundColor: 'rgba(248, 113, 113, 0.15)', borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'flex-start', gap: 12 },
  alertContent: { flex: 1 },
  alertTitle: { color: '#f87171', fontWeight: '600', fontSize: 14 },
  alertText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, lineHeight: 18 },
  assessButton: { backgroundColor: '#a78bfa', borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, gap: 8, marginBottom: 24 },
  assessButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chartContainer: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  chartBox: { backgroundColor: '#1a1a3e', borderRadius: 12, position: 'relative', overflow: 'hidden' },
  gridRow: {},
  gridLabel: { position: 'absolute', left: 4, color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  gridLine: { position: 'absolute', left: CHART_PADDING, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  thresholdLine: { position: 'absolute', left: CHART_PADDING, right: 0, height: 1, backgroundColor: 'rgba(251, 191, 36, 0.4)', borderStyle: 'dashed' },
  lineSegment: { position: 'absolute', height: 2, backgroundColor: '#a78bfa', transformOrigin: 'left center' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#1a1a3e' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  dateLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  correlationCard: { backgroundColor: '#1a1a3e', borderRadius: 12, padding: 16, marginBottom: 24 },
  correlationRow: { flexDirection: 'row', justifyContent: 'space-around' },
  correlationItem: { alignItems: 'center' },
  correlationValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  correlationLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  correlationWarning: { color: '#fbbf24', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  interventionsSection: { marginBottom: 24 },
  interventionCard: { flexDirection: 'row', backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'flex-start', gap: 12 },
  interventionContent: { flex: 1 },
  interventionTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  interventionText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4, lineHeight: 18 },
  interventionLink: { color: '#a78bfa', fontSize: 12, marginTop: 6, textDecorationLine: 'underline', fontWeight: '500' }, 
  historySection: { marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 10, padding: 14, marginBottom: 8, gap: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyInfo: { flex: 1 },
  historyScore: { color: '#fff', fontSize: 16, fontWeight: '600' },
  historyLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  historyDate: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  modalContainer: { flex: 1, backgroundColor: '#0f0f23' },
  questionContainer: { flex: 1, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  modalProgress: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 24 },
  progressFill: { height: 4, backgroundColor: '#a78bfa', borderRadius: 2 },
  timeframe: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontStyle: 'italic', marginBottom: 16 },
  questionCard: { flex: 1 },
  questionNumber: { color: '#a78bfa', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  questionText: { color: '#fff', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 28 },
  optionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  optionSelected: { borderColor: '#a78bfa', backgroundColor: 'rgba(167, 139, 250, 0.12)' },
  optionRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionRadioFilled: { borderColor: '#a78bfa' },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#a78bfa' },
  optionLabel: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  optionLabelSelected: { color: '#fff', fontWeight: '500' },
  optionValue: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
  optionValueSelected: { color: '#a78bfa' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  navButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 4 },
  navButtonDisabled: { opacity: 0.3 },
  navButtonText: { color: '#fff', fontSize: 15 },
  submitButton: { backgroundColor: '#a78bfa', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  resultCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resultScore: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  resultLabel: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  resultRaw: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 },
  resultDescription: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  doneButton: { backgroundColor: '#a78bfa', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48 },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
