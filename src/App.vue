<script setup lang="ts">
import { ref } from 'vue'
import type { VersionType } from './types/vocabulary'
import HomeView from './views/HomeView.vue'
import VersionSelectView from './views/VersionSelectView.vue'
import BookSelectView from './views/BookSelectView.vue'
import PracticeView from './views/PracticeView.vue'
import ReviewView from './views/ReviewView.vue'

type ViewName = 'home' | 'version' | 'book' | 'practice' | 'review'

const view = ref<ViewName>('home')
const selectedVersion = ref<VersionType>('simple')
const selectedBookId = ref('')

function handleVersionSelect(v: VersionType) {
  selectedVersion.value = v
  view.value = 'book'
}

function handleBookSelect(bookId: string) {
  selectedBookId.value = bookId
  view.value = 'practice'
}
</script>

<template>
  <main class="app-layout">
    <Transition name="fade" mode="out-in">
      <HomeView v-if="view === 'home'" @start="view = 'version'" @review="view = 'review'" />
      <VersionSelectView
        v-else-if="view === 'version'"
        @select="handleVersionSelect"
        @back="view = 'home'"
      />
      <BookSelectView
        v-else-if="view === 'book'"
        :version="selectedVersion"
        @select="handleBookSelect"
        @back="view = 'version'"
      />
      <PracticeView
        v-else-if="view === 'practice'"
        :version="selectedVersion"
        :book-id="selectedBookId"
        @back="view = 'book'"
      />
      <ReviewView
        v-else
        @back="view = 'home'"
      />
    </Transition>
  </main>
</template>

<style>
:root {
  --base: #1e1e2e;
  --surface0: #313244;
  --surface1: #45475a;
  --text: #cdd6f4;
  --subtext: #a6adc8;
  --muted: #6c7086;
  --blue: #89b4fa;
  --lavender: #b4befe;
  --green: #a6e3a1;
  --red: #f38ba8;
  --yellow: #f9e2af;
  --peach: #fab387;
  --mauve: #cba6f7;
  --teal: #94e2d5;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--base);
  overflow: hidden;
}

.app-layout {
  height: 100vh;
  color: var(--text);
  font-family: 'JetBrainsMono Nerd Font Mono', 'JetBrains Mono', 'SF Pro Text', -apple-system, sans-serif;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--base);
}

::-webkit-scrollbar-thumb {
  background: var(--surface1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}
</style>
