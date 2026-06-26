const synth = window.speechSynthesis;

export const TTSEngine = {
  speak(text: string) {
    if (synth.speaking) {
      synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;

    const voices = synth.getVoices();
    const bestVoice = voices.find(v => v.name === 'Samantha' || v.name === 'Alex');
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    synth.speak(utterance);
  }
};
