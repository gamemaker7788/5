// config.js - 配置和常量定义
class AppConfig {
    constructor() {
        this.SUPABASE_URL = 'https://yzbvlywkfuuercapousf.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6YnZseXdrZnV1ZXJjYXBvdXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODk0NjIsImV4cCI6MjA3Njk2NTQ2Mn0.kkDysp4mk4he6uPKG8jifx2EbA-W3Y0-WOr2Z3nzsPs';
        
        // 应用配置
        this.APP_NAME = '微信风格聊天室';
        this.VERSION = '1.0.0';
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        this.MESSAGE_LIMIT = 1000;
        this.ONLINE_TIMEOUT = 5 * 60 * 1000; // 5分钟
        
        // 存储桶配置
        this.BUCKETS = {
            IMAGES: 'chat-images',
            FILES: 'chat-files'
        };
        
        // 消息类型
        this.MESSAGE_TYPES = {
            TEXT: 'text',
            IMAGE: 'image',
            FILE: 'file',
            SYSTEM: 'system'
        };
        
        // 房间类型
        this.ROOM_TYPES = {
            GROUP: 'group',
            PRIVATE: 'private',
            CHANNEL: 'channel'
        };
    }
    
    // 获取Supabase客户端
    getSupabaseClient() {
        if (!this.supabase) {
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
        }
        return this.supabase;
    }
    
    // 验证配置
    validateConfig() {
        const errors = [];
        
        if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
            errors.push('Supabase配置不完整');
        }
        
        if (this.SUPABASE_URL.includes('your-project')) {
            errors.push('请配置正确的Supabase URL');
        }
        
        return errors;
    }
}

// 创建全局配置实例
const appConfig = new AppConfig();

// 工具函数
class Utils {
    // HTML转义
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 获取随机颜色
    static getRandomColor(str = 'default') {
        const colors = ['#07c160', '#1a2a6c', '#b21f1f', '#fdbb2d', '#6b8cff', '#9b59b6', '#e74c3c', '#3498db'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
    
    // 格式化时间
    static formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) { // 1天内
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }
    
    // 文件大小格式化
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 生成唯一ID
    static generateId(prefix = '') {
        return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
    }
    
    // 数据URL转Blob
    static dataURLToBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        
        for (let i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }
    
    // 防抖函数
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 节流函数
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// 错误处理类
class ErrorHandler {
    static handle(error, context = '未知操作') {
        console.error(`[${context}] 错误:`, error);
        
        let userMessage = '操作失败，请重试';
        
        if (error.message.includes('401')) {
            userMessage = '认证失败，请重新登录';
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else if (error.message.includes('404')) {
            userMessage = '资源不存在';
        } else if (error.message.includes('409')) {
            userMessage = '数据冲突，请检查输入';
        } else if (error.message.includes('413')) {
            userMessage = '文件太大，请选择小于10MB的文件';
        } else if (error.message.includes('42703')) {
            userMessage = '数据库结构问题，请联系管理员';
        } else if (error.message.includes('42501')) {
            userMessage = '权限不足，请检查设置';
        } else if (error.message.includes('网络错误') || error.message.includes('离线')) {
            userMessage = '网络连接失败，请检查网络设置';
        }
        
        this.showUserMessage(userMessage, 'error');
        return userMessage;
    }
    
    static showUserMessage(message, type = 'error') {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `system-message ${type}-message`;
        messageEl.textContent = message;
        container.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }
}