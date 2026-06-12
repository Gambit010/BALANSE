import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useAnalytics } from '../hooks/useAnalytics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40;

const chartConfig = {
  backgroundColor: '#1a1a3e',
  backgroundGradientFrom: '#1a1a3e',
  backgroundGradientTo: '#1a1a3e',
  decimalCount: 0,
  color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.6})`,
  propsForDots: {
    r: '5',
    strokeWidth: '2',
    stroke: '#7c3aed',
  },
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: 'rgba(255,255,255,0.06)',
  },
};

export default function AnalyticsScreen({ navigation }) {
  const {
    loading,
    taskStats,
    categoryBreakdown,
    weeklyCompletions,
    priorityDistribution,
    wellnessTrend,
    correlation,
    weekdayHeatmap,
    weeklyReport,
    insights,
    exportSummary,
  } = useAnalytics();

  const handleShare = async () => {
    try {
      await Share.share({ message: exportSummary });
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Analytics & Insights</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={20} color="#a78bfa" />
          </TouchableOpacity>
        </View>

        {/* ─── SECTION 1: WEEKLY REPORT ─── */}
        {weeklyReport && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={18} color="#a78bfa" />
              <Text style={styles.cardTitle}>Weekly Report</Text>
            </View>
            <Text style={styles.periodText}>{weeklyReport.period}</Text>

            <View style={styles.reportGrid}>
              <ReportMetric
                label="Completed"
                value={weeklyReport.thisWeek.completed}
                delta={weeklyReport.completionDelta}
              />
              <ReportMetric
                label="Added"
                value={weeklyReport.thisWeek.added}
                delta={weeklyReport.addedDelta}
                invertColor
              />
              <ReportMetric
                label="Conflicts"
                value={weeklyReport.activeConflicts}
              />
              <ReportMetric
                label="Well-being"
                value={weeklyReport.wellness.current !== null ? `${weeklyReport.wellness.current}%` : '—'}
                delta={weeklyReport.wellness.change}
                suffix="pts"
              />
            </View>
          </View>
        )}

        {/* ─── SECTION 2: WELLNESS TREND ─── */}
        {wellnessTrend.length >= 2 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="heart-outline" size={18} color="#f472b6" />
              <Text style={styles.cardTitle}>Wellness Trend</Text>
            </View>
            <LineChart
              data={{
                labels: wellnessTrend.map(d => d.label),
                datasets: [
                  { data: wellnessTrend.map(d => d.percentage) },
                  { data: [0], withDots: false },
                  { data: [100], withDots: false },
                ],
              }}
              width={CHART_WIDTH}
              height={200}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(244, 114, 182, ${opacity})`,
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#f472b6' },
              }}
              bezier
              style={styles.chart}
              fromZero
              yAxisSuffix="%"
              segments={4}
              decorator={() => (
                <>
                  {/* 50% threshold line */}
                  <View style={[styles.thresholdLine, { bottom: 200 * 0.5 + 10 }]}>
                    <View style={[styles.thresholdDash, { backgroundColor: 'rgba(74,222,128,0.4)' }]} />
                  </View>
                  {/* 28% threshold line */}
                  <View style={[styles.thresholdLine, { bottom: 200 * 0.28 + 10 }]}>
                    <View style={[styles.thresholdDash, { backgroundColor: 'rgba(248,113,113,0.4)' }]} />
                  </View>
                </>
              )}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4ade80' }]} />
                <Text style={styles.legendText}>Positive (50%+)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
                <Text style={styles.legendText}>At Risk (28-49%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f87171' }]} />
                <Text style={styles.legendText}>Low (&lt;28%)</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── SECTION 3: WELLNESS-WORKLOAD CORRELATION ─── */}
        {correlation.length >= 2 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="git-compare-outline" size={18} color="#60a5fa" />
              <Text style={styles.cardTitle}>Wellness vs Workload</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              How your task count relates to your well-being
            </Text>

            {/* Bar chart for active tasks */}
            <BarChart
              data={{
                labels: correlation.map(d => d.label),
                datasets: [{ data: correlation.map(d => d.activeTaskCount) }],
              }}
              width={CHART_WIDTH}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(96, 165, 250, ${opacity * 0.6})`,
                barPercentage: 0.5,
              }}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
            />

            {/* Line chart overlay for wellness */}
            <LineChart
              data={{
                labels: correlation.map(d => d.label),
                datasets: [
                  { data: correlation.map(d => d.wellnessPercentage) },
                  { data: [0], withDots: false },
                  { data: [100], withDots: false },
                ],
              }}
              width={CHART_WIDTH}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(244, 114, 182, ${opacity})`,
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#f472b6' },
              }}
              bezier
              style={[styles.chart, { marginTop: -8 }]}
              fromZero
              yAxisSuffix="%"
              segments={4}
            />

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#60a5fa' }]} />
                <Text style={styles.legendText}>Active Tasks</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f472b6' }]} />
                <Text style={styles.legendText}>WHO-5 Score</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── SECTION 4: WEEKLY COMPLETIONS ─── */}
        {weeklyCompletions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="bar-chart-outline" size={18} color="#34d399" />
              <Text style={styles.cardTitle}>Weekly Completions</Text>
            </View>
            <BarChart
              data={{
                labels: weeklyCompletions.map(w => w.label),
                datasets: [{ data: weeklyCompletions.map(w => w.completed || 0) }],
              }}
              width={CHART_WIDTH}
              height={200}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(52, 211, 153, ${opacity})`,
                barPercentage: 0.6,
              }}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
            />
          </View>
        )}

        {/* ─── SECTION 5: CATEGORY DISTRIBUTION ─── */}
        {categoryBreakdown.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pie-chart-outline" size={18} color="#fbbf24" />
              <Text style={styles.cardTitle}>Category Distribution</Text>
            </View>

            {categoryBreakdown.some(c => c.total > 0) ? (
              <>
                <PieChart
                  data={categoryBreakdown
                    .filter(c => c.total > 0)
                    .map((c, i) => ({
                      name: c.category,
                      count: c.total,
                      color: ['#a78bfa', '#60a5fa', '#34d399'][i],
                      legendFontColor: 'rgba(255,255,255,0.6)',
                      legendFontSize: 12,
                    }))}
                  width={CHART_WIDTH}
                  height={160}
                  chartConfig={chartConfig}
                  accessor="count"
                  backgroundColor="transparent"
                  paddingLeft="10"
                  style={styles.chart}
                />
                <View style={styles.categoryDetails}>
                  {categoryBreakdown.map((c, i) => (
                    <View key={c.category} style={styles.categoryRow}>
                      <View style={styles.categoryLeft}>
                        <View style={[styles.categoryDot, { backgroundColor: ['#a78bfa', '#60a5fa', '#34d399'][i] }]} />
                        <Text style={styles.categoryName}>{c.category}</Text>
                      </View>
                      <Text style={styles.categoryRate}>
                        {c.completed}/{c.total} ({c.completionRate}%)
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>No tasks yet</Text>
            )}
          </View>
        )}

        {/* ─── SECTION 6: PRIORITY DISTRIBUTION ─── */}
        {taskStats && taskStats.total > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="speedometer-outline" size={18} color="#ef4444" />
              <Text style={styles.cardTitle}>Priority Distribution</Text>
            </View>
            {priorityDistribution.map(p => {
              const total = priorityDistribution.reduce((s, x) => s + x.count, 0);
              const width = total > 0 ? (p.count / total) * 100 : 0;
              return (
                <View key={p.label} style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>{p.label}</Text>
                  <View style={styles.priorityBarBg}>
                    <View style={[styles.priorityBarFill, { width: `${width}%`, backgroundColor: p.color }]} />
                  </View>
                  <Text style={styles.priorityCount}>{p.count}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── SECTION 7: WEEKDAY HEATMAP ─── */}
        {weekdayHeatmap.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="grid-outline" size={18} color="#fb923c" />
              <Text style={styles.cardTitle}>Busiest Days</Text>
            </View>
            <View style={styles.heatmapRow}>
              {weekdayHeatmap.map(d => (
                <View key={d.day} style={styles.heatmapCell}>
                  <View
                    style={[
                      styles.heatmapBlock,
                      {
                        backgroundColor: d.count === 0
                          ? 'rgba(255,255,255,0.06)'
                          : `rgba(167, 139, 250, ${0.2 + d.intensity * 0.8})`,
                      },
                    ]}
                  >
                    <Text style={styles.heatmapCount}>{d.count}</Text>
                  </View>
                  <Text style={styles.heatmapDay}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── SECTION 8: PERSONALIZED INSIGHTS ─── */}
        {insights.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="bulb-outline" size={18} color="#fbbf24" />
              <Text style={styles.cardTitle}>Insights</Text>
            </View>
            {insights.map((insight, idx) => (
              <View
                key={idx}
                style={[styles.insightRow, idx < insights.length - 1 && styles.insightBorder]}
              >
                <View style={[styles.insightIcon, {
                  backgroundColor: insight.type === 'warning'
                    ? 'rgba(248,113,113,0.15)'
                    : insight.type === 'wellness'
                      ? 'rgba(244,114,182,0.15)'
                      : insight.type === 'streak'
                        ? 'rgba(251,146,60,0.15)'
                        : 'rgba(167,139,250,0.15)',
                }]}>
                  <Ionicons
                    name={insight.icon}
                    size={18}
                    color={
                      insight.type === 'warning' ? '#f87171'
                        : insight.type === 'wellness' ? '#f472b6'
                          : insight.type === 'streak' ? '#fb923c'
                            : '#a78bfa'
                    }
                  />
                </View>
                <Text style={styles.insightText}>{insight.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── SECTION 9: SHARE BUTTON ─── */}
        <TouchableOpacity style={styles.shareReportButton} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={20} color="#ffffff" />
          <Text style={styles.shareReportText}>Share Weekly Report</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── HELPER COMPONENT ───
function ReportMetric({ label, value, delta, invertColor = false, suffix = '' }) {
  const showDelta = delta !== undefined && delta !== null;
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  let arrowColor = 'rgba(255,255,255,0.4)';
  if (showDelta) {
    if (invertColor) {
      arrowColor = isPositive ? '#f87171' : isNegative ? '#4ade80' : 'rgba(255,255,255,0.4)';
    } else {
      arrowColor = isPositive ? '#4ade80' : isNegative ? '#f87171' : 'rgba(255,255,255,0.4)';
    }
  }

  return (
    <View style={styles.reportMetric}>
      <Text style={styles.reportValue}>{value}</Text>
      <Text style={styles.reportLabel}>{label}</Text>
      {showDelta && (
        <View style={styles.deltaRow}>
          <Ionicons
            name={isPositive ? 'arrow-up' : isNegative ? 'arrow-down' : 'remove'}
            size={12}
            color={arrowColor}
          />
          <Text style={[styles.deltaText, { color: arrowColor }]}>
            {Math.abs(delta)}{suffix ? ` ${suffix}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cards
  card: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
    marginTop: -4,
  },

  // Weekly Report
  periodText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
    marginTop: -4,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportMetric: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  reportValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  reportLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Charts
  chart: {
    borderRadius: 12,
    marginHorizontal: -8,
  },

  // Threshold lines (wellness trend)
  thresholdLine: {
    position: 'absolute',
    left: 40,
    right: 10,
  },
  thresholdDash: {
    height: 1,
    borderStyle: 'dashed',
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },

  // Category details
  categoryDetails: {
    marginTop: 12,
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  categoryRate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },

  // Priority distribution
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  priorityLabel: {
    width: 55,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  priorityBarBg: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  priorityBarFill: {
    height: '100%',
    borderRadius: 10,
    minWidth: 2,
  },
  priorityCount: {
    width: 24,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'right',
  },

  // Heatmap
  heatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heatmapCell: {
    alignItems: 'center',
    gap: 6,
  },
  heatmapBlock: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heatmapCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  heatmapDay: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },

  // Insights
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  insightBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },

  // Share button
  shareReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    marginTop: 4,
  },
  shareReportText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty state
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
});