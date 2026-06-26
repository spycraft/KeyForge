<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VersionType } from '../types/vocabulary'
import { getAvailableBooks, VERSION_INFO } from '../data/bookCatalog'

const props = defineProps<{ version: VersionType }>()
defineEmits<{ select: [bookId: string]; back: [] }>()

const books = computed(() => getAvailableBooks(props.version))
const searchQuery = ref('')
const activeCategory = ref('全部')

const categories = computed(() => {
  const cats = new Set(books.value.map(b => b.category))
  return ['全部', ...cats]
})

const filteredBooks = computed(() => {
  let result = books.value
  if (activeCategory.value !== '全部') {
    result = result.filter(b => b.category === activeCategory.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
    )
  }
  return result
})
</script>

<template>
  <div class="book-select">
    <header class="view-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2>选择词汇书</h2>
      <span class="version-badge">{{ VERSION_INFO[version].label }}</span>
    </header>

    <div class="toolbar">
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat"
          class="cat-tab"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >{{ cat }}</button>
      </div>

      <input
        v-model="searchQuery"
        class="search-input"
        placeholder="搜索词汇书..."
      />
    </div>

    <div class="book-grid">
      <div
        v-for="book in filteredBooks"
        :key="book.id"
        class="book-card"
        @click="$emit('select', book.id)"
      >
        <div class="book-card-header">
          <span class="book-name">{{ book.name }}</span>
          <span v-if="book.isRandom" class="random-badge">乱序</span>
        </div>
        <div class="book-card-body">
          <span class="book-volume">第 {{ book.volume }} 册</span>
          <span class="book-category">{{ book.category }}</span>
        </div>
      </div>
    </div>

    <p v-if="filteredBooks.length === 0" class="empty-hint">
      没有找到匹配的词汇书
    </p>
  </div>
</template>

<style scoped>
.book-select {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 2rem 3rem;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.view-header h2 {
  margin: 0;
  font-size: 1.6rem;
  color: #cdd6f4;
}

.version-badge {
  background: #45475a;
  color: #b4befe;
  padding: 3px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  border: 1px solid #585b70;
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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.category-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cat-tab {
  background: transparent;
  border: 1px solid #45475a;
  color: #a6adc8;
  padding: 5px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-size: 0.85rem;
}

.cat-tab:hover {
  border-color: #89b4fa;
  color: #cdd6f4;
}

.cat-tab.active {
  background: #89b4fa;
  color: #1e1e2e;
  border-color: #89b4fa;
  font-weight: 600;
}

.search-input {
  background: #313244;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 7px 14px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
  outline: none;
  width: 220px;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #89b4fa;
}

.search-input::placeholder {
  color: #6c7086;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 1rem;
}

.book-card {
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 12px;
  padding: 1.1rem 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.book-card:hover {
  border-color: #89b4fa;
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.book-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
}

.book-name {
  font-size: 1.05rem;
  color: #cdd6f4;
  font-weight: 600;
}

.random-badge {
  background: #f9e2af;
  color: #1e1e2e;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

.book-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.book-volume {
  color: #a6adc8;
  font-size: 0.85rem;
}

.book-category {
  color: #6c7086;
  font-size: 0.8rem;
}

.empty-hint {
  text-align: center;
  color: #6c7086;
  padding: 3rem;
}
</style>
