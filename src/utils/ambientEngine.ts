export const AmbientEngine = {
  audio: new Audio(),

  init() {
    this.audio.loop = true;
    this.audio.volume = 0.4;
  },

  play(src: string) {
    if (!this.audio.src || this.audio.src !== src) {
      this.audio.src = src;
    }
    this.audio.play().catch(e => console.warn("环境音播放失败，可能需要用户先交互页面:", e));
  },

  stop() {
    this.audio.pause();
  }
};

// 初始化实例的配置
AmbientEngine.init();
