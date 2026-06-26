<script setup lang="ts">
import { computed } from 'vue'
import { useProgress } from '../composables/useProgress'
import { formatNextReview } from '../utils/ebbinghaus'

defineEmits<{ start: []; review: [] }>()

const { stats, dueReviews, hasDueReviews } = useProgress()

// 格式化学习时长
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const restMin = minutes % 60
  return restMin > 0 ? `${hours} 小时 ${restMin} 分` : `${hours} 小时`
}

// 最近 7 天最大值（用于柱状图缩放）
const maxActivity = computed(() => {
  return Math.max(1, ...stats.value.recentActivity.map(a => a.learned + a.reviewed))
})

// 即将到期的复习（前 3 个）
const upcomingReviews = computed(() => {
  return dueReviews.value.slice(0, 3)
})
</script>

<template>
  <div class="home">
    <div class="logo-area">
      <div class="logo-icon">🔑</div>
      <h1 class="title">KeyForge</h1>
      <p class="subtitle">锻造你的词汇肌肉记忆</p>
    </div>

    <!-- 学习进度概览 -->
    <div v-if="stats.totalLearned > 0" class="stats-panel">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalLearned }}</div>
          <div class="stat-label">已学单词</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.streakDays }}</div>
          <div class="stat-label">连续天数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.averageMastery }}%</div>
          <div class="stat-label">平均掌握</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatDuration(stats.totalStudyTime) }}</div>
          <div class="stat-label">累计时长</div>
        </div>
      </div>

      <!-- 7 天活动柱状图 -->
      <div class="activity-chart">
        <div class="chart-title">最近 7 天学习活动</div>
        <div class="chart-bars">
          <div v-for="act in stats.recentActivity" :key="act.date" class="chart-bar-group">
            <div class="chart-bar-wrapper">
              <div
                class="chart-bar learned"
                :style="{ height: `${(act.learned / maxActivity) * 100}%` }"
                :title="`学习 ${act.learned}`"
              ></div>
              <div
                class="chart-bar reviewed"
                :style="{ height: `${(act.reviewed / maxActivity) * 100}%` }"
                :title="`复习 ${act.reviewed}`"
              ></div>
            </div>
            <div class="chart-label">{{ act.date.slice(5) }}</div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-color learned"></span>学习</span>
          <span class="legend-item"><span class="legend-color reviewed"></span>复习</span>
        </div>
      </div>
    </div>

    <!-- 复习提醒 -->
    <div v-if="hasDueReviews" class="review-alert" @click="$emit('review')">
      <div class="alert-icon">🔔</div>
      <div class="alert-content">
        <div class="alert-title">{{ stats.dueReviewCount }} 个单词需要复习</div>
        <div class="alert-detail">
          <span v-for="(r, i) in upcomingReviews" :key="r.id" class="review-word">
            {{ r.word }}<span class="review-time">{{ formatNextReview(r.nextReviewAt) }}</span><span v-if="i < upcomingReviews.length - 1">、</span>
          </span>
        </div>
      </div>
      <div class="alert-arrow">→</div>
    </div>

    <div class="action-buttons">
      <button class="start-btn" @click="$emit('start')">
        {{ stats.totalLearned > 0 ? '继续学习' : '开始学习' }}
        <span class="arrow">→</span>
      </button>
      <button v-if="hasDueReviews" class="review-btn" @click="$emit('review')">
        开始复习 ({{ stats.dueReviewCount }})
      </button>
    </div>

    <div class="features">
      <div class="feature">
        <span class="feature-icon">📚</span>
        <span>多版本词库</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🔊</span>
        <span>真人发音</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🧠</span>
        <span>智能复习</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1.5rem;
  padding: 1rem;
  overflow-y: auto;
}

.logo-area {
  text-align: center;
}

.logo-icon {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.title {
  font-size: 3rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #b4befe, #89b4fa, #cba6f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.subtitle {
  color: #a6adc8;
  font-size: 1rem;
  margin: 0.3rem 0 0;
}

/* 统计面板 */
.stats-panel {
  width: 100%;
  max-width: 520px;
  background: rgba(49, 50, 68, 0.5);
  border: 1px solid #45475a;
  border-radius: 14px;
  padding: 1rem 1.2rem;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.stat-card {
  text-align: center;
  background: rgba(30, 30, 46, 0.6);
  border-radius: 10px;
  padding: 0.6rem 0.3rem;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: #89b4fa;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.72rem;
  color: #6c7086;
  margin-top: 0.2rem;
}

/* 活动图表 */
.activity-chart {
  border-top: 1px solid #45475a;
  padding-top: 0.8rem;
}

.chart-title {
  font-size: 0.8rem;
  color: #a6adc8;
  margin-bottom: 0.6rem;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 60px;
  gap: 0.3rem;
}

.chart-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-bar-wrapper {
  display: flex;
  gap: 2px;
  height: 45px;
  align-items: flex-end;
  width: 100%;
  justify-content: center;
}

.chart-bar {
  width: 8px;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
}

.chart-bar.learned {
  background: #89b4fa;
}

.chart-bar.reviewed {
  background: #a6e3a1;
}

.chart-label {
  font-size: 0.65rem;
  color: #6c7086;
  margin-top: 0.3rem;
}

.chart-legend {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: #a6adc8;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-color.learned { background: #89b4fa; }
.legend-color.reviewed { background: #a6e3a1; }

/* 复习提醒 */
.review-alert {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  max-width: 520px;
  background: linear-gradient(135deg, rgba(249, 226, 175, 0.12), rgba(250, 179, 135, 0.08));
  border: 1px solid rgba(249, 226, 175, 0.3);
  border-radius: 12px;
  padding: 0.8rem 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.review-alert:hover {
  border-color: rgba(249, 226, 175, 0.6);
  transform: translateY(-1px);
}

.alert-icon {
  font-size: 1.5rem;
  animation: ring 2s ease-in-out infinite;
}

@keyframes ring {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(10deg); }
  40% { transform: rotate(-10deg); }
  60% { transform: rotate(6deg); }
  80% { transform: rotate(-6deg); }
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f9e2af;
}

.alert-detail {
  font-size: 0.78rem;
  color: #a6adc8;
  margin-top: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-word {
  display: inline;
}

.review-time {
  color: #6c7086;
  font-size: 0.7rem;
  margin-left: 0.2rem;
}

.alert-arrow {
  color: #f9e2af;
  font-size: 1.2rem;
}

/* 按钮区 */
.action-buttons {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}

.start-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #89b4fa, #b4befe);
  color: #1e1e2e;
  border: none;
  padding: 14px 36px;
  border-radius: 12px;
  font-size: 1.15rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
  box-shadow: 0 4px 20px rgba(137, 180, 250, 0.3);
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(137, 180, 250, 0.45);
}

.start-btn:active {
  transform: translateY(0);
}

.arrow {
  transition: transform 0.2s;
}

.start-btn:hover .arrow {
  transform: translateX(4px);
}

.review-btn {
  background: rgba(249, 226, 175, 0.15);
  color: #f9e2af;
  border: 1px solid rgba(249, 226, 175, 0.4);
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
}

.review-btn:hover {
  background: rgba(249, 226, 175, 0.25);
  transform: translateY(-2px);
}

.features {
  display: flex;
  gap: 2rem;
  margin-top: 0.5rem;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #6c7086;
  font-size: 0.9rem;
}

.feature-icon {
  font-size: 1.1rem;
}
</style>
