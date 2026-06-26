const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

// 1. 初始状态设为 null，不要在文件加载时立刻创建
let audioCtx: AudioContext | null = null;

export const AudioEngine = {
  // 核心修复：安全初始化函数
  init() {
    // 只有在用户第一次敲击键盘时，才真正向系统申请音频权限
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    // 确保被挂起的上下文被唤醒
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  },

  playTypingSound(isCorrect: boolean) {
    this.init(); // 每次播放前检查并确保引擎已启动
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (isCorrect) {
      // 敲击正确：清脆机械音
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    } else {
      // 敲击错误：沉闷警告音
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gainNode.gain.setValueAtTime(0.6, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    }
  }
};