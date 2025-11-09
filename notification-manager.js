/**
 * NotificationManager.js
 * Windows 原生通知 + 应用内红点/声音
 * 仅需 init() 一次，后续自动工作
 */
class NotificationManager {
  constructor() {
    this.permission = false;          // 浏览器通知权限
    this.audio     = new Audio();     // 提示音
   this.audio.src = 'Message.mp3'
    this.unreadCount = 0;             // 未读数
    this.lastTitle   = document.title;
  }

  /* ---------- 初始化 ---------- */
  async init() {
    // 1. 申请浏览器通知权限
    if ('Notification' in window) {
      const status = await Notification.requestPermission();
      this.permission = status === 'granted';
    }

    // 2. 监听窗口可见性
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clearBadge(); // 回到前台清零
    });
  }

  /* ---------- 外部调用：收到新消息时触发 ---------- */
  onNewMessage({ room, sender, body, mention }) {
    const isBg = document.hidden;
    this.incBadge();

    // 1. 应用内提示音
    this.audio.currentTime = 0;
    this.audio.play().catch(() => {});

    // 2. Windows 原生通知
    if (isBg && this.permission && body) {
      const n = new Notification(
        mention ? `有人@你 - ${room}` : `新消息 - ${room}`,
        {
          body: `${sender}: ${body.length > 50 ? body.slice(0, 50) + '…' : body}`,
          icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f4ac.png', // 气泡 emoji
          tag: 'chat-msg',          // 同 tag 自动合并
          renotify: true,
          silent: true              // 我们自己控制声音
        }
      );

      n.onclick = () => {
        window.focus();   // 拉起窗口
        n.close();
      };

      // 8s 后自动关闭
      setTimeout(() => n.close(), 8000);
    }
  }

  /* ---------- 未读红点 + 标题数字 ---------- */
  incBadge() {
    this.unreadCount++;
    document.title = `(${this.unreadCount}) ${this.lastTitle}`;
    // 可选：在 favicon 上画红点，此处略
  }

  clearBadge() {
    if (this.unreadCount > 0) {
      this.unreadCount = 0;
      document.title = this.lastTitle;
    }
  }
}

// 全局单例
window.notificationManager = new NotificationManager();
