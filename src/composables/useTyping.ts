import { ref, computed } from 'vue';
import { AudioEngine } from '../utils/audioEngine';

export function useTyping(initialSentence: string) {
  const targetSentence = ref(initialSentence);
  const userInput = ref('');
  const incorrectIndices = ref<Set<number>>(new Set());

  const targetChars = computed(() => targetSentence.value.split(''));
  const currentIndex = computed(() => userInput.value.length);
  const isFinished = computed(() => userInput.value.length >= targetSentence.value.length);

  function handleInput(e: Event) {
    const inputEvent = e as InputEvent;
    const inputElement = e.target as HTMLInputElement;
    
    const oldLen = userInput.value.length;
    const newLen = inputElement.value.length;
    userInput.value = inputElement.value;

    incorrectIndices.value.clear();
    for (let i = 0; i < userInput.value.length; i++) {
      if (userInput.value[i] !== targetChars.value[i]) {
        incorrectIndices.value.add(i);
      }
    }

    if (inputEvent.inputType !== 'deleteContentBackward' && newLen > oldLen) {
      const lastIdx = newLen - 1;
      const isCorrect = userInput.value[lastIdx] === targetChars.value[lastIdx];
      AudioEngine.playTypingSound(isCorrect);
    }
  }

  function setSentence(newSentence: string) {
    targetSentence.value = newSentence;
    userInput.value = '';
    incorrectIndices.value.clear();
  }

  return {
    targetSentence,
    userInput,
    incorrectIndices,
    targetChars,
    currentIndex,
    isFinished,
    handleInput,
    setSentence
  };
}
