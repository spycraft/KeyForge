<script setup lang="ts">
import type { VersionType } from '../types/vocabulary'
import { VERSION_INFO } from '../data/bookCatalog'

defineEmits<{ select: [version: VersionType]; back: [] }>()

const versions: VersionType[] = ['simple', 'sentence', 'full']

const versionStyle: Record<VersionType, { icon: string; gradient: string; border: string }> = {
  simple:   { icon: '📝', gradient: 'linear-gradient(135deg, #a6e3a1, #94e2d5)', border: '#a6e3a1' },
  sentence: { icon: '📖', gradient: 'linear-gradient(135deg, #f9e2af, #fab387)', border: '#f9e2af' },
  full:     { icon: '🔬', gradient: 'linear-gradient(135deg, #cba6f7, #89b4fa)', border: '#cba6f7' },
}
</script>

<template>
  <div class="version-select">
    <header class="view-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2>选择词库版本</h2>
    </header>

    <div class="cards">
      <div
        v-for="v in versions"
        :key="v"
        class="version-card"
        :style="{ '--card-border': versionStyle[v].border }"
        @click="$emit('select', v)"
      >
        <div class="card-icon" :style="{ background: versionStyle[v].gradient }">
          {{ versionStyle[v].icon }}
        </div>
        <h3>{{ VERSION_INFO[v].label }}</h3>
        <p class="desc">{{ VERSION_INFO[v].description }}</p>
        <div class="tags">
          <span v-for="f in VERSION_INFO[v].features" :key="f" class="tag">{{ f }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.version-select {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 2rem 3rem;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.view-header h2 {
  margin: 0;
  font-size: 1.6rem;
  color: #cdd6f4;
}

.back-btn {
  background: transparent;
  border: 1px solid #45475a;
  color: #a6adc8;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-size: 0.9rem;
}

.back-btn:hover {
  border-color: #89b4fa;
  color: #cdd6f4;
  background: #313244;
}

.cards {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex: 1;
  align-items: center;
}

.version-card {
  width: 280px;
  background: #313244;
  border: 2px solid #45475a;
  border-radius: 16px;
  padding: 2rem 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.version-card:hover {
  border-color: var(--card-border);
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.card-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0 auto 1.2rem;
}

.version-card h3 {
  font-size: 1.4rem;
  color: #cdd6f4;
  margin: 0 0 0.5rem;
}

.desc {
  color: #a6adc8;
  font-size: 0.9rem;
  margin: 0 0 1.2rem;
  line-height: 1.5;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: center;
}

.tag {
  background: #1e1e2e;
  color: #a6adc8;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  border: 1px solid #45475a;
}
</style>
