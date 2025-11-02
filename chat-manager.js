/****************************************************************************************
 * ChatManager Fusion v5.5 - 完整修复版
 * 修复所有事件绑定、语音上传和UI更新问题
 ****************************************************************************************/
class ChatManager {
    constructor() {
        this.supabase = window.supabase.createClient(
            'https://yzbvlywkfuuercapousf.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6YnZseXdrZnV1ZXJjYXBvdXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODk0NjIsImV4cCI6MjA3Njk2NTQ2Mn0.kkDysp4mk4he6uPKG8jifx2EbA-W3Y0-WOr2Z3nzsPs'
        );
        this.currentUser = null;
        this.currentRoom = null;
        this.rooms = [];
        this.contacts = [];
        this.messageSubscription = null;
        this.cameraStream = null;
        this.currentFacingMode = 'user';
        this.imageBucket = 'chat-images';
        this.fileBucket = 'chat-files';
        this.mediaRecorder = null;
        this.videoStream = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.videoQuality = 'hd';
        this.audioContext = null;
        this.analyser = null;
        this.isRecording = false;
        this.isPaused = false;
        this.voiceWaveformInterval = null;
        this.voicePlayInterval = null;
        this.currentAudio = null;
        this.maxRecordingTime = 120000;
        this.eventListeners = new Map();
        
        // 绑定所有方法到实例
        this.bindMethods();
        this.init();
    }

    /* -------------------- 方法绑定 -------------------- */
    bindMethods() {
        const methods = [
            'init', 'loadUserSession', 'setupEventListeners', 'showSuccess',
            'showError', 'showSystemMsg', 'loadRooms', 'loadContacts', 'selectRoom',
            'sendMessage', 'sendImageMessage', 'sendFile', 'openCamera', 'closeCamera',
            'takePicture', 'showVoiceRecordUI', 'hideVoiceRecordUI', 'startVoiceRecording',
            'stopVoiceRecording', 'pauseVoiceRecording', 'resumeVoiceRecording',
            'sendVoiceMessage', 'createRoom', 'changeUsername', 'logout', 'showChatList',
            'showContacts', 'showDiscover', 'showSettings', 'enableChatFeatures',
            'escapeHtml', 'getRandomColor', 'scrollToBottom', 'showLoading', 'hideLoading',
            'selectImageFile', 'selectFile', 'handleImageFile', 'validateImageFile',
            'setupVoiceRecordEvents', 'bindVoiceButton', 'handleVoiceRecordClick',
            'updateVoiceRecordUI', 'setButtonState', 'startVoiceWaveform', 'stopVoiceWaveform',
            'startRecordingTimer', 'stopRecordingTimer', 'resetVoiceWaveform',
            'initVoicePlayback', 'playVoiceMessage', 'handleResize', 'handleGlobalError',
            'handleVoiceButtonClick', 'joinRoom', 'updateRecordingUI'
        ];

        methods.forEach(method => {
            if (typeof this[method] === 'function') {
                this[method] = this[method].bind(this);
            }
        });
    }

    /* -------------------- 初始化 -------------------- */
    async init() {
        try {
            await this.loadUserSession();
            await this.ensureBucketsExist();
            
            // 等待DOM完全加载
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            this.setupEventListeners();
            this.initVoicePlayback();
            await this.loadRooms();
            await this.loadContacts();
            this.showChatList();
            this.showSuccess('应用启动成功！');
        } catch (e) {
            console.error('初始化失败:', e);
            this.showError('初始化失败，已启用基础模式');
            this.showBasicFallback();
        }
    }

    /* -------------------- 用户会话 -------------------- */
    async loadUserSession() {
        try {
            const s = localStorage.getItem('chat_session');
            if (!s) throw new Error('未登录');
            this.currentUser = JSON.parse(s);
        } catch (e) {
            this.showError('加载会话失败: ' + e.message);
            setTimeout(() => (window.location.href = 'login.html'), 1500);
        }
    }

    /* -------------------- 工具方法 -------------------- */
    showSuccess(msg) { 
        this.showSystemMsg(msg, 'success'); 
    }

    showError(msg) { 
        this.showSystemMsg(msg, 'error'); 
    }

    showSystemMsg(text, type) {
        const c = document.getElementById('messagesContainer');
        if (!c) return;
        
        const div = document.createElement('div');
        div.className = `system-message ${type}-message`;
        div.textContent = text;
        c.appendChild(div);
        
        setTimeout(() => {
            if (div.parentNode) {
                div.remove();
            }
        }, type === 'error' ? 5000 : 3000);
        
        this.scrollToBottom();
    }

    scrollToBottom() {
        const box = document.getElementById('messagesContainer');
        if (box) {
            setTimeout(() => {
                box.scrollTop = box.scrollHeight;
            }, 100);
        }
    }

    enableChatFeatures() {
        const i = document.getElementById('messageInput');
        const b = document.getElementById('sendBtn');
        if (i) i.disabled = false;
        if (b) b.disabled = false;
    }

    escapeHtml(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    getRandomColor(str = 'default') {
        const colors = ['#07c160', '#1a2a6c', '#b21f1f', '#fdbb2d', '#6b8cff', '#9b59b6', '#e74c3c', '#3498db'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    showLoading(msg = '加载中...') {
        const div = document.createElement('div');
        div.id = 'loading-overlay';
        div.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${msg}</div>`;
        document.body.appendChild(div);
    }

    hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) el.remove();
    }

    dataURLToBlob(dataURL) {
        const [head, base] = dataURL.split(',');
        const mime = head.split(':')[1].split(';')[0];
        const raw = window.atob(base);
        const u = new Uint8Array(raw.length);
        
        for (let i = 0; i < raw.length; ++i) {
            u[i] = raw.charCodeAt(i);
        }
        
        return new Blob([u], { type: mime });
    }

    handleGlobalError(error) {
        if (!error) {
            console.warn('收到空错误对象');
            return;
        }
        
        console.error('应用程序错误:', error);
        this.showSystemMsg('应用程序错误，部分功能可能不可用', 'error');
    }

    /* -------------------- 存储桶 -------------------- */
    async ensureBucketsExist() {
        await this.ensureBucketExists(this.imageBucket);
        await this.ensureBucketExists(this.fileBucket);
    }

    async ensureBucketExists(name) {
        try {
            const test = new Blob(['test']);
            const fn = `test-${Date.now()}.txt`;
            const { error } = await this.supabase.storage.from(name).upload(fn, test);
            if (!error || !error.message.includes('bucket')) {
                await this.supabase.storage.from(name).remove([fn]);
            }
        } catch (e) { 
            console.warn('存储桶检查非致命错误:', e.message); 
        }
    }

    /* -------------------- 事件监听器 -------------------- */
    setupEventListeners() {
        console.log('开始设置事件监听器');
        
        // 清理旧的事件监听器
        this.removeAllEventListeners();

        // 导航标签
        this.bindButton('chatTab', 'click', () => this.showChatList());
        this.bindButton('contactsTab', 'click', () => this.showContacts());
        this.bindButton('discoverTab', 'click', () => this.showDiscover());
        this.bindButton('settingsTab', 'click', () => this.showSettings());

        // 聊天功能
        this.bindButton('sendBtn', 'click', () => this.sendMessage());
        this.bindInput('messageInput', 'keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 房间操作
        this.bindButton('createRoomBtn', 'click', () => this.showCreateRoomModal());
        this.bindButton('confirmCreateRoom', 'click', () => this.createRoom());
        this.bindButton('cancelCreateRoom', 'click', () => this.hideCreateRoomModal());

        // 用户设置
        this.bindButton('changeNameBtn', 'click', () => this.showChangeNameModal());
        this.bindButton('confirmChangeName', 'click', () => this.changeUsername());
        this.bindButton('cancelChangeName', 'click', () => this.hideChangeNameModal());
        this.bindButton('logoutBtn', 'click', () => this.logout());

        // 多媒体功能
        this.bindButton('cameraBtn', 'click', () => this.openCamera());
        this.bindButton('imageBtn', 'click', () => this.selectImageFile());
        this.bindButton('fileBtn', 'click', () => this.selectFile());
        this.bindButton('videoBtn', 'click', () => this.toggleVideoRecording());
        this.bindButton('voiceBtn', 'click', () => this.showVoiceRecordUI());
        this.bindButton('captureBtn', 'click', () => this.takePicture());
        this.bindButton('closeCameraBtn', 'click', () => this.closeCamera());
        this.bindButton('switchCameraBtn', 'click', () => this.switchCamera());

        // 模态框点击外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            this.bindEvent(modal, 'click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // 快捷键
        this.bindEvent(document, 'keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
                this.closeCamera();
                this.hideVideoPreview();
                this.hideVoiceRecordUI();
            }
        });

        console.log('事件监听器设置完成');
    }

    // 通用事件绑定方法
    bindButton(buttonId, event, handler) {
        const el = document.getElementById(buttonId);
        if (!el) {
            console.warn('按钮未找到:', buttonId);
            return;
        }
        
        const wrappedHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`按钮 ${buttonId} 被点击`);
            handler(e);
        };
        
        el.addEventListener(event, wrappedHandler);
        
        // 添加视觉反馈
        if (event === 'click') {
            el.addEventListener('mousedown', () => {
                el.style.transform = 'scale(0.95)';
            });
            
            el.addEventListener('mouseup', () => {
                el.style.transform = 'scale(1)';
            });
            
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'scale(1)';
            });
        }
        
        // 存储监听器
        if (!this.eventListeners.has(buttonId)) {
            this.eventListeners.set(buttonId, []);
        }
        this.eventListeners.get(buttonId).push({ event, handler: wrappedHandler });
        
        console.log(`按钮 ${buttonId} 绑定成功`);
    }

    bindInput(inputId, event, handler) {
        const input = document.getElementById(inputId);
        if (!input) {
            console.warn('输入框未找到:', inputId);
            return;
        }
        
        input.addEventListener(event, handler);
        console.log(`输入框 ${inputId} 绑定成功`);
    }

    bindEvent(element, event, handler) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (!element || typeof element.addEventListener !== 'function') {
            console.warn('无效的元素:', element);
            return;
        }
        element.addEventListener(event, handler);
    }

    // 移除所有事件监听器
    removeAllEventListeners() {
        for (const [elementId, listeners] of this.eventListeners) {
            const element = document.getElementById(elementId) || elementId;
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        }
        this.eventListeners.clear();
    }

    /* -------------------- 语音录制功能 -------------------- */
    showVoiceRecordUI() {
        console.log('显示语音录制界面');
        
        // 先移除已存在的界面
        this.hideVoiceRecordUI();
        
        const voiceUIHTML = `
            <div class="voice-record-overlay" id="voiceRecordOverlay">
                <div class="voice-record-container">
                    <div class="voice-record-header">
                        <div class="voice-record-title">语音录制</div>
                        <button class="voice-close-btn" id="closeVoiceRecord">✕</button>
                    </div>
                    
                    <div class="voice-record-main">
                        <div class="voice-waveform" id="voiceWaveform">
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <div class="waveform-bar"></div>
                            <waveform-bar"></div>
                        </div>
                        
                        <div class="voice-record-time">
                            <span id="voiceRecordTime">00:00</span>
                            <span class="voice-max-time">/02:00</span>
                        </div>
                        
                        <div class="voice-record-status" id="voiceRecordStatus">
                            <span class="status-dot"></span>
                            <span>准备就绪</span>
                        </div>
                    
                        <button class="voice-control-btn" id="voiceRecordBtn" title="开始录制">
                            <div class="control-icon">⏺️</div>
                            <span>录制</span>
                        </button>
                        
                        <button class="voice-control-btn" id="voicePauseBtn" title="暂停" disabled>
                            <div class="control-icon">⏸️</div>
                            <span>暂停</span>
                        </button>
                        
                        <button class="voice-control-btn" id="voiceResumeBtn" title="继续" disabled>
                            <div class="control-icon">▶️</div>
                            <span>继续</span>
                        </button>
                        
                        <button class="voice-control-btn" id="voiceStopBtn" title="停止">
                            <div class="control-icon">⏹️</div>
                            <span>停止</span>
                        </button>
                        
                        <button class="voice-control-btn send-btn" id="voiceSendBtn" title="发送" disabled>
                            <div class="control-icon">📤</div>
                            <span>发送</span>
                        </button>
                    
                        <p>录制时长：最长2分钟</p>
                        <p>文件大小：约1.5MB/分钟</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', voiceUIHTML);
        
        // 延迟绑定事件，确保DOM完全渲染
        setTimeout(() => {
            this.setupVoiceRecordEvents();
            console.log('语音录制界面事件绑定完成');
        }, 100);
    }

    setupVoiceRecordEvents() {
        console.log('设置语音录制事件');
        
        // 使用事件委托处理动态内容
        const overlay = document.getElementById('voiceRecordOverlay');
        if (!overlay) {
            console.error('语音录制界面未找到');
            return;
        }
        
        overlay.addEventListener('click', (e) => {
            this.handleVoiceRecordClick(e);
        });

        // 单独绑定每个按钮
        const buttons = [
            'voiceRecordBtn', 'voicePauseBtn', 'voiceResumeBtn',
            'voiceStopBtn', 'voiceSendBtn', 'closeVoiceRecord'
        ];
        
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`语音按钮 ${buttonId} 被点击`);
                    this.handleVoiceButtonClick(buttonId);
                });
            } else {
                console.warn(`语音按钮未找到: ${buttonId}`);
            }
        });

        console.log('语音录制事件设置完成');
    }

    handleVoiceButtonClick(buttonId) {
        switch(buttonId) {
            case 'voiceRecordBtn':
                if (!this.isRecording) this.startVoiceRecording();
                break;
            case 'voicePauseBtn':
                this.pauseVoiceRecording();
                break;
            case 'voiceResumeBtn':
                this.resumeVoiceRecording();
                break;
            case 'voiceStopBtn':
                this.stopVoiceRecording();
                break;
            case 'voiceSendBtn':
                this.sendVoiceMessage();
                this.hideVoiceRecordUI();
                break;
            case 'closeVoiceRecord':
                this.stopVoiceRecording();
                this.hideVoiceRecordUI();
                break;
        }
    }

    handleVoiceRecordClick(e) {
        const target = e.target;
        const button = target.closest('.voice-control-btn');
        
        if (!button) {
            // 点击外部关闭
            if (e.target.id === 'voiceRecordOverlay') {
                this.stopVoiceRecording();
                this.hideVoiceRecordUI();
            }
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const buttonId = button.id;
        console.log('事件委托捕获按钮点击:', buttonId);

        switch(buttonId) {
            case 'voiceRecordBtn':
                if (!this.isRecording) this.startVoiceRecording();
                break;
            case 'voicePauseBtn':
                this.pauseVoiceRecording();
                break;
            case 'voiceResumeBtn':
                this.resumeVoiceRecording();
                break;
            case 'voiceStopBtn':
                this.stopVoiceRecording();
                break;
            case 'voiceSendBtn':
                this.sendVoiceMessage();
                this.hideVoiceRecordUI();
                break;
            case 'closeVoiceRecord':
                this.stopVoiceRecording();
                this.hideVoiceRecordUI();
                break;
        }
    }

    async startVoiceRecording() {
        try {
            if (!this.currentRoom) {
                this.showError('请先选择聊天室');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });
            
            this.recordedChunks = [];
            this.recordingStartTime = Date.now();
            this.isRecording = true;
            this.isPaused = false;
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.stopRecordingTimer();
                this.stopVoiceWaveform();
                this.isRecording = false;
                
                if (this.mediaRecorder.stream) {
                    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                
                if (this.audioContext) {
                    this.audioContext.close();
                    this.audioContext = null;
                }
            };
            
            this.mediaRecorder.start(1000);
            this.startVoiceWaveform();
            this.startRecordingTimer();
            
            this.updateRecordingUI(true);
            this.showSystemMsg('开始录音...', 'info');
            
        } catch (error) {
            this.showError('无法访问麦克风: ' + error.message);
        }
    }

    stopVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordingUI(false);
            this.showSystemMsg('录音已停止', 'info');
        }
    }

    pauseVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.updateRecordingUI(false);
            this.showSystemMsg('录音已暂停', 'info');
        }
    }

    resumeVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.updateRecordingUI(true);
            this.showSystemMsg('继续录音...', 'info');
        }
    }

    updateRecordingUI(isRecording) {
        const recordBtn = document.getElementById('voiceRecordBtn');
        const pauseBtn = document.getElementById('voicePauseBtn');
        const resumeBtn = document.getElementById('voiceResumeBtn');
        const stopBtn = document.getElementById('voiceStopBtn');
        const sendBtn = document.getElementById('voiceSendBtn');
        
        if (recordBtn) recordBtn.disabled = isRecording;
        if (pauseBtn) pauseBtn.disabled = !isRecording;
        if (resumeBtn) resumeBtn.disabled = isRecording;
        if (stopBtn) stopBtn.disabled = !isRecording;
        if (sendBtn) sendBtn.disabled = isRecording || this.recordedChunks.length === 0;
        
        const statusEl = document.getElementById('voiceRecordStatus');
        if (statusEl) {
            statusEl.innerHTML = isRecording ? 
                '<span class="status-dot recording"></span><span>录制中</span>' :
                '<span class="status-dot stopped"></span><span>已停止</span>';
        }
    }

    async sendVoiceMessage() {
        if (!this.recordedChunks.length || !this.currentRoom) {
            this.showError('没有录音内容或未选择聊天室');
            return;
        }
        
        try {
            this.showLoading('发送语音中...');
            
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const duration = Date.now() - this.recordingStartTime;
            
            // 检查文件大小
            if (blob.size > 3 * 1024 * 1024) {
                this.showError('语音文件过大，请缩短录音时间');
                return;
            }
            
            // 生成文件名 - 使用 chat-files 存储桶
            const fn = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webm`;
            
            // 上传到 chat-files 存储桶
            const { error: uploadError } = await this.supabase.storage
                .from('chat-files')  // 使用现有的文件存储桶
                .upload(fn, blob, {
                    contentType: 'audio/webm',
                    upsert: false
                });
            
            if (uploadError) throw uploadError;
            
            // 获取公开URL
            const { data: { publicUrl } } = this.supabase.storage
                .from('chat-files')
                .getPublicUrl(fn);
            
            // 发送消息
            const { error: messageError } = await this.supabase.from('chat_messages').insert({
                content: `[语音消息] ${Math.round(duration / 1000)}秒`,
                room_id: this.currentRoom.id,
                user_id: this.currentUser.userId,
                message_type: 'voice',
                file_url: publicUrl,
                file_name: fn,
                file_size: blob.size,
                voice_duration: Math.round(duration / 1000),
                direction: 1
            });
            
            if (messageError) throw messageError;
            
            this.hideLoading();
            this.showSuccess('语音发送成功！');
            
            // 清空录音数据
            this.recordedChunks = [];
            this.updateRecordingUI(false);
            
        } catch (error) {
            this.hideLoading();
            console.error('语音发送失败:', error);
            this.showError('语音发送失败: ' + (error.message || '服务器错误'));
        }
    }

    updateVoiceRecordUI() {
        const buttons = {
            record: document.getElementById('voiceRecordBtn'),
            pause: document.getElementById('voicePauseBtn'),
            resume: document.getElementById('voiceResumeBtn'),
            stop: document.getElementById('voiceStopBtn'),
            send: document.getElementById('voiceSendBtn')
        };
        
        const statusEl = document.getElementById('voiceRecordStatus');
        
        if (this.isRecording) {
            if (this.isPaused) {
                // 暂停状态
                this.setButtonState(buttons, {
                    record: { disabled: true, text: '录制' },
                    pause: { disabled: true, text: '暂停' },
                    resume: { disabled: false, text: '继续' },
                    stop: { disabled: false, text: '停止' },
                    send: { disabled: true, text: '发送' }
                });
                
                if (statusEl) {
                    statusEl.innerHTML = '<span class="status-dot paused"></span><span>已暂停</span>';
                }
            } else {
                // 录制状态
                this.setButtonState(buttons, {
                    record: { disabled: true, text: '录制' },
                    pause: { disabled: false, text: '暂停' },
                    resume: { disabled: true, text: '继续' },
                    stop: { disabled: false, text: '停止' },
                    send: { disabled: true, text: '发送' }
                });
                
                if (statusEl) {
                    statusEl.innerHTML = '<span class="status-dot recording"></span><span>录制中</span>';
                }
            }
        } else {
          // 停止状态
            this.setButtonState(buttons, {
                record: { disabled: false, text: '录制' },
                pause: { disabled: true, text: '暂停' },
                resume: { disabled: true, text: '继续' },
                stop: { disabled: true, text: '停止' },
                send: { disabled: this.recordedChunks.length === 0, text: '发送' }
            });
            
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-dot stopped"></span><span>已停止</span>';
            }
        }
    }

    setButtonState(buttons, states) {
        Object.keys(states).forEach(key => {
            if (buttons[key]) {
                const button = buttons[key];
                const state = states[key];
                
                button.disabled = state.disabled;
                const textSpan = button.querySelector('span');
                if (textSpan) {
                    textSpan.textContent = state.text;
                }
                
                button.style.opacity = state.disabled ? '0.6' : '1';
                button.style.cursor = state.disabled ? 'not-allowed' : 'pointer';
            }
        });
    }

    hideVoiceRecordUI() {
        const overlay = document.getElementById('voiceRecordOverlay');
        if (overlay) {
            overlay.remove();
        }
        this.stopRecordingTimer();
        this.stopVoiceWaveform();
    }

    startVoiceWaveform() {
        this.stopVoiceWaveform();
        
        this.voiceWaveformInterval = setInterval(() => {
            if (!this.analyser || !this.isRecording || this.isPaused) return;
            
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(dataArray);
            
            const waveform = document.getElementById('voiceWaveform');
            if (!waveform) return;
            
            const bars = waveform.querySelectorAll('.waveform-bar');
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            bars.forEach((bar, index) => {
                const height = Math.max(5, (average / 256) * 50 + Math.random() * 10);
                bar.style.height = `${height}px`;
                bar.style.backgroundColor = this.isRecording && !this.isPaused ? '#07c160' : '#ffa500';
            });
        }, 100);
    }

    stopVoiceWaveform() {
        if (this.voiceWaveformInterval) {
            clearInterval(this.voiceWaveformInterval);
            this.voiceWaveformInterval = null;
        }
    }

    startRecordingTimer() {
        this.stopRecordingTimer();
        
        this.recordingTimer = setInterval(() => {
            if (!this.isRecording || this.isPaused) return;
            
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            const timeElement = document.getElementById('voiceRecordTime');
            
            if (timeElement) {
                timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                
                // 时间警告
                if (elapsed > this.maxRecordingTime - 10000) {
                    timeElement.style.color = '#ff4757';
                } else {
                    timeElement.style.color = '#07c160';
                }
            }
            
            // 达到时间限制自动停止
            if (elapsed >= this.maxRecordingTime) {
                this.stopVoiceRecording();
                this.updateVoiceRecordUI();
            }
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    /* -------------------- 语音播放功能 -------------------- */
    initVoicePlayback() {
        console.log('初始化语音播放功能');
        
        // 使用事件委托处理动态创建的语音消息
        document.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.voice-play-btn');
            if (playBtn) {
                console.log('语音播放按钮点击');
                const voiceMessage = playBtn.closest('.message-voice');
                const url = playBtn.getAttribute('data-url');
                const duration = parseInt(voiceMessage.getAttribute('data-duration'));
                
                this.playVoiceMessage(url, voiceMessage, duration);
            }
        });
        
        console.log('语音播放功能初始化完成');
    }

    async playVoiceMessage(url, voiceElement, duration) {
        if (!url) return;
        
        try {
            // 停止当前播放
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.resetVoiceWaveform(voiceElement);
            }
            
            // 创建音频元素
            this.currentAudio = new Audio(url);
            this.currentAudio.volume = 0.8;
            
            // 设置播放状态
            voiceElement.classList.add('playing');
            const waveBars = voiceElement.querySelectorAll('.wave-bar');
            
            // 播放动画
            this.voicePlayInterval = setInterval(() => {
                waveBars.forEach((bar, index) => {
                    const height = 5 + Math.random() * 15;
                    bar.style.height = `${height}px`;
                });
            }, 200);
            
            // 播放结束处理
            this.currentAudio.onended = () => {
                this.resetVoiceWaveform(voiceElement);
                voiceElement.classList.remove('playing');
            };
            
            this.currentAudio.onerror = () => {
                this.showError('语音播放失败');
                this.resetVoiceWaveform(voiceElement);
                voiceElement.classList.remove('playing');
            };
            
            // 开始播放
            await this.currentAudio.play();
            
        } catch (error) {
            this.showError('播放语音失败: ' + error.message);
            this.resetVoiceWaveform(voiceElement);
            voiceElement.classList.remove('playing');
        }
    }

    resetVoiceWaveform(voiceElement) {
        if (this.voicePlayInterval) {
            clearInterval(this.voicePlayInterval);
            this.voicePlayInterval = null;
        }
        
        const waveBars = voiceElement.querySelectorAll('.wave-bar');
        waveBars.forEach(bar => {
            bar.style.height = '5px';
        });
    }

    /* -------------------- 房间管理 -------------------- */
    async loadRooms() {
        try {
            const { data, error } = await this.supabase.from('chat_rooms').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            this.rooms = data || [];
        } catch (e) { 
            this.rooms = []; 
        }
        this.renderRoomList();
    }

    renderRoomList() {
        const c = document.getElementById('chatItems');
        if (!c) return;
        
        if (!this.rooms.length) {
            c.innerHTML = `<div class="welcome-message"><p>暂无聊天室</p><button onclick="chatManager.showCreateRoomModal()" class="login-btn">创建第一个聊天室</button></div>`;
            return;
        }
        
        c.innerHTML = '';
        this.rooms.forEach(r => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.onclick = () => this.selectRoom(r);
            div.innerHTML = `
                <div class="chat-avatar" style="background:${this.getRandomColor(r.name)}">${r.name[0].toUpperCase()}</div>
                <div class="chat-info">
                    <div class="chat-name">${this.escapeHtml(r.name)}</div>
                    <div class="chat-preview">${this.escapeHtml(r.description || '暂无描述')}</div>
                </div>`;
            c.appendChild(div);
        });
    }

    async selectRoom(room) {
        try {
            this.currentRoom = room;
            document.querySelectorAll('.chat-item').forEach(n => n.classList.remove('active'));
            event.currentTarget.classList.add('active');
            document.getElementById('roomTitle').textContent = room.name;
            this.enableChatFeatures();
            await this.joinRoom(room.id);
            await this.loadMessages(room.id);
            this.setupMessageSubscription(room.id);
            this.scrollToBottom();
        } catch (e) { 
            this.showError('进入房间失败'); 
        }
    }

    async joinRoom(roomId) {
        try {
            // 先检查是否已是成员
            const { data: existing, error: checkError } = await this.supabase
                .from('room_members')
                .select('id')
                .eq('room_id', roomId)
                .eq('user_id', this.currentUser.userId)
                .maybeSingle();
            
            if (checkError) throw checkError;
            if (existing) {
                console.log('用户已是房间成员');
                return; // 已是成员则直接返回
            }
            
            // 不是成员则加入
            const { error } = await this.supabase.from('room_members').insert({
                room_id: roomId,
                user_id: this.currentUser.userId
            });
            
            if (error) throw error;
        } catch (e) {
            if (!e.message.includes('duplicate')) {
                console.error('加入房间失败:', e);
                this.showError('加入房间失败');
            }
        }
    }

    /* -------------------- 消息发送 -------------------- */
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const txt = input.value.trim();
        
        if (!txt || !this.currentRoom) return;
        
        try {
            await this.supabase.from('chat_messages').insert({
                content: txt,
                room_id: this.currentRoom.id,
                user_id: this.currentUser.userId,
                message_type: 'text',
                direction: 1
            });
            
            input.value = '';
            input.focus();
        } catch (e) { 
            this.showError('发送失败: ' + e.message); 
        }
    }

    async sendImageMessage(imageData) {
        if (!this.currentRoom) return;
        
        this.showLoading('上传图片中...');
        try {
            const url = await this.uploadImage(imageData);
            await this.supabase.from('chat_messages').insert({
                content: `[图片]`,
                room_id: this.currentRoom.id,
                user_id: this.currentUser.userId,
                message_type: 'image',
                file_url: url,
                file_name: 'image.jpg',
                direction: 1
            });
            
            this.hideLoading();
            this.showSuccess('图片发送成功！');
        } catch (e) {
            this.hideLoading();
            this.showError('图片发送失败: ' + e.message);
        }
    }

    async sendFile(file) {
        if (!this.currentRoom) return;
        
        this.showLoading('上传文件中...');
        try {
            const url = await this.uploadFile(file);
            await this.supabase.from('chat_messages').insert({
                content: `[文件]${file.name}`,
                room_id: this.currentRoom.id,
                user_id: this.currentUser.userId,
                message_type: 'file',
                file_url: url,
                file_name: file.name,
                file_size: file.size,
                direction: 1
            });
            
            this.hideLoading();
            this.showSuccess('文件发送成功！');
            return url;
        } catch (e) {
            this.hideLoading();
            this.showError('文件发送失败: ' + e.message);
        }
    }

    /* -------------------- 文件上传 -------------------- */
    async uploadImage(imageData) {
        const uploader = new OnlineImageUploader(this.supabase);
        return await uploader.uploadImage(imageData, this);
    }

    async uploadFile(file) {
        try {
            // 验证文件
            if (!file || !(file instanceof File)) {
                throw new Error('无效的文件对象');
            }
            
            // 检查文件大小
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                throw new Error(`文件大小不能超过 ${this.formatFileSize(maxSize)}`);
            }
            
            // 生成安全的文件名
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fn = `file_${Date.now()}_${safeName}`;
            
            // 上传文件
            const { error } = await this.supabase.storage
                .from(this.fileBucket)
                .upload(fn, file, {
                    contentType: file.type,
                    upsert: false,
                    cacheControl: '3600'
                });
            
            if (error) {
                if (error.message.includes('bucket')) {
                    throw new Error('文件存储桶不存在或无法访问');
                }
                if (error.message.includes('size')) {
                    throw new Error('文件大小超出限制');
                }
                throw error;
            }
            
            // 获取公开URL
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.fileBucket)
                .getPublicUrl(fn);
            
            return publicUrl;
            
        } catch (error) {
            console.error('文件上传失败:', error);
            throw new Error(`文件上传失败: ${error.message}`);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /* -------------------- 消息加载 -------------------- */
    async loadMessages(roomId) {
        try {
            const { data, error } = await this.supabase
                .from('chat_messages')
                .select(`*, chat_users(username)`)
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            
            const c = document.getElementById('messagesContainer');
            c.innerHTML = '';
            
            if (!data.length) {
                c.innerHTML = '<div class="system-message">暂无消息，开始聊天吧</div>';
                return;
            }
            
            data.forEach(m => this.addMessageToChat(m, m.chat_users.username));
            this.scrollToBottom();
        } catch (e) { 
            this.showError('加载消息失败'); 
        }
    }

    addMessageToChat(msg, username) {
        const c = document.getElementById('messagesContainer');
        if (!c) return;
        
        const isOwn = username === this.currentUser.username;
        const div = document.createElement('div');
        div.className = `message ${isOwn ? 'own' : 'other'}`;
        
        const t = new Date(msg.created_at).toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let content = '';
        switch (msg.message_type) {
            case 'image': 
                content = this.createImageMessageHtml(msg); 
                break;
            case 'file':  
                content = this.createFileMessageHtml(msg);  
                break;
            case 'video': 
                content = this.createVideoMessageHtml(msg); 
                break;
            case 'voice':
                content = this.createVoiceMessageHtml(msg);
                break;
            default:      
                content = `<div class="message-text">${this.escapeHtml(msg.content)}</div>`;
        }
        
        div.innerHTML = `
            ${!isOwn ? `<div class="message-avatar" style="background:${this.getRandomColor(username)}">${username[0].toUpperCase()}</div>` : ''}
            <div class="message-bubble">
                ${!isOwn ? `<div class="message-sender">${this.escapeHtml(username)}</div>` : ''}
                ${content}
                <div class="message-time">${t}</div>
            </div>
            ${isOwn ? `<div class="message-avatar" style="background:${this.getRandomColor(username)}">${username[0].toUpperCase()}</div>` : ''}`;
        
        c.appendChild(div);
        this.scrollToBottom();

        // 自动翻译文本消息
        if (msg.message_type === 'text' && document.getElementById('autoTransToggle')?.checked) {
            setTimeout(() => window.translateMessage(div), 0);
        }
    }

   createImageMessageHtml(msg) {
    const url = msg.file_url;
    if (!url || !url.startsWith('http')) return '<div class="image-missing">图片地址无效</div>';
    return `
        <div class="message-image-container">
            <img src="${url}" class="message-image" alt="图片"
                onload="this.style.display='block'; this.nextElementSibling.style.display='none';"
                onerror="this.style.display='none'; this.nextElementSibling.nextElementSibling.style.display='block';">
            <div class="image-loading-state"><div class="loading-spinner"></div><span>加载中...</span></div>
            <div class="image-error-state" style="display:none;">❌ 图片加载失败<br><a href="${url}" target="_blank" style="color:#07c160">查看原图</a></div>
        </div>`;
}


    createFileMessageHtml(msg) {
        return `
            <div class="message-file">
                <div class="file-icon">📄</div>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(msg.file_name)}</div>
                    <a href="${msg.file_url}" download="${this.escapeHtml(msg.file_name)}" class="file-link">下载文件</a>
                </div>
            </div>`;
    }

    createVideoMessageHtml(msg) {
        const url = msg.file_url;
        if (!url || !url.startsWith('http')) return '<div class="video-missing">视频地址无效</div>';
        return `
            <div class="message-video-container">
                <video src="${url}" class="message-video" controls></video>
            </div>`;
    }

    createVoiceMessageHtml(msg) {
        const duration = msg.voice_duration || 1;
        const durationText = duration < 60 ? `${duration}秒` : `${Math.floor(duration / 60)}分${duration % 60}秒`;
        
        return `
            <div class="message-voice" data-duration="${duration}">
                <div class="voice-play-btn" data-url="${msg.file_url}">
                    <div class="voice-play-icon">▶</div>
                </div>
                <div class="voice-info">
                    <div class="voice-duration">${durationText}</div>
                    <div class="voice-wave">
                        <span class="wave-bar"></span>
                        <span class="wave-bar"></span>
                        <span class="wave-bar"></span>
                        <span class="wave-bar"></span>
                        <span class="wave-bar"></span>
                    </div>
                </div>
            </div>
        `;
    }

    /* -------------------- 实时订阅 -------------------- */
    setupMessageSubscription(roomId) {
        if (this.messageSubscription) {
            this.supabase.removeChannel(this.messageSubscription);
        }
        
        this.messageSubscription = this.supabase
            .channel('public:chat_messages')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat_messages', 
                filter: `room_id=eq.${roomId}` 
            }, async (payload) => {
                const { data } = await this.supabase.from('chat_users')
                    .select('username')
                    .eq('id', payload.new.user_id)
                    .single();
                    
                if (data) {
                    const msg = { ...payload.new, direction: payload.new.direction ?? 0 };
                    this.addMessageToChat(msg, data.username);
                }
            })
            .subscribe();
    }

    /* -------------------- 联系人管理 -------------------- */
    async loadContacts() {
        try {
            const { data, error } = await this.supabase.from('chat_users')
                .select('id, username, is_online, last_login')
                .neq('id', this.currentUser.userId)
                .order('username');
                
            if (error) throw error;
            this.contacts = data || [];
        } catch (e) { 
            this.contacts = []; 
        }
        this.renderContacts();
    }

    renderContacts() {
        const c = document.getElementById('contactsList');
        if (!c) return;
        
        if (!this.contacts.length) {
            c.innerHTML = '<div class="welcome-message">暂无联系人</div>';
            return;
        }
        
        c.innerHTML = '';
        this.contacts.forEach(u => {
            const isOnline = u.is_online || (Date.now() - new Date(u.last_login).getTime() < 300000);
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.onclick = () => this.startPrivateChat(u);
            div.innerHTML = `
                <div class="contact-avatar" style="background:${this.getRandomColor(u.username)}">${u.username[0].toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name">${this.escapeHtml(u.username)}</div>
                    <div class="contact-status"><span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>${isOnline ? '在线' : '离线'}</div>
                </div>`;
            c.appendChild(div);
        });
    }

    async startPrivateChat(contact) {
        try {
            const name = `private_${Math.min(this.currentUser.userId, contact.id)}_${Math.max(this.currentUser.userId, contact.id)}`;
            let room = this.rooms.find(r => r.name === name);
            
            if (!room) {
                const { data, error } = await this.supabase.from('chat_rooms').insert({
                    name, 
                    description: `与 ${contact.username} 的私聊`, 
                    created_by: this.currentUser.userId, 
                    is_public: false, 
                    room_type: 'private'
                }).select();
                
                if (error) throw error;
                room = data[0];
                this.rooms.push(room);
                
                await this.supabase.from('room_members').insert([
                    { room_id: room.id, user_id: this.currentUser.userId },
                    { room_id: room.id, user_id: contact.id }
                ]);
            }
            
            this.selectRoom(room);
            this.showChatList();
        } catch (e) { 
            this.showError('私聊失败: ' + e.message); 
        }
    }

    /* -------------------- 摄像头功能 -------------------- */
    async openCamera() {
        try {
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(t => t.stop());
            }
            
            this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: this.currentFacingMode }, 
                audio: false 
            });
            
            const video = document.getElementById('cameraLive');
            video.srcObject = this.cameraStream;
            document.getElementById('cameraPreview').style.display = 'block';
        } catch (e) { 
            this.showError('无法访问摄像头'); 
        }
    }

    closeCamera() {
        if (this.cameraStream) { 
            this.cameraStream.getTracks().forEach(t => t.stop()); 
            this.cameraStream = null; 
        }
        document.getElementById('cameraPreview').style.display = 'none';
    }

    async switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        await this.openCamera();
    }

    async takePicture() {
        const video = document.getElementById('cameraLive');
        if (!video || !video.videoWidth) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        await this.sendImageMessage(imageData);
        this.closeCamera();
    }

    /* -------------------- 视频录制功能 -------------------- */
    async startVideoRecording() {
        try {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.showSystemMsg('正在录制...', 'info');
                return;
            }
            
            this.videoStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: 1280, 
                    height: 720,
                    facingMode: this.currentFacingMode 
                }, 
                audio: true 
            });
            
            this.showVideoPreview();
            
            this.mediaRecorder = new MediaRecorder(this.videoStream, { 
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 2500000
            });
            
            this.recordedChunks = [];
            this.recordingStartTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.stopRecordingTimer();
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                this.sendVideo(blob);
                this.hideVideoPreview();
            };
            
            this.mediaRecorder.start(1000);
            this.updateRecordingUI(true);
            this.startRecordingTimer();
            
            this.showSystemMsg('开始录制视频...', 'info');
        } catch (e) {
            this.showError('无法访问视频设备: ' + e.message);
            this.hideVideoPreview();
        }
    }

    stopVideoRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.updateRecordingUI(false);
            this.showSystemMsg('录制完成，正在上传...', 'info');
        }
    }

    toggleVideoRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.stopVideoRecording();
        } else {
            this.startVideoRecording();
        }
    }

    showVideoPreview() {
        const previewContainer = document.getElementById('videoPreview');
        if (!previewContainer) {
            this.createVideoPreview();
        } else {
            previewContainer.style.display = 'block';
        }
        
        const videoElement = document.getElementById('videoLive');
        if (videoElement && this.videoStream) {
            videoElement.srcObject = this.videoStream;
            videoElement.play().catch(e => console.error('视频播放失败:', e));
        }
        
        this.updateRecordingUI(false);
    }

    hideVideoPreview() {
        const preview = document.getElementById('videoPreview');
        if (preview) {
            preview.style.display = 'none';
        }
        
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        this.updateRecordingUI(false);
        this.stopRecordingTimer();
    }

    /* -------------------- 房间创建 -------------------- */
    showCreateRoomModal() {
        document.getElementById('roomNameInput').value = '';
        document.getElementById('roomDescInput').value = '';
        document.getElementById('createRoomModal').style.display = 'block';
    }

    hideCreateRoomModal() { 
        document.getElementById('createRoomModal').style.display = 'none'; 
    }

    async createRoom() {
        const name = document.getElementById('roomNameInput').value.trim();
        const desc = document.getElementById('roomDescInput').value.trim();
        
        if (!name) return this.showError('请输入房间名称');
        
        try {
            const { data, error } = await this.supabase.from('chat_rooms').insert({ 
                name, 
                description: desc, 
                created_by: this.currentUser.userId, 
                is_public: true 
            }).select();
            
            if (error) throw error;
            
            this.hideCreateRoomModal();
            await this.loadRooms();
            if (data && data.length) this.selectRoom(data[0]);
            this.showSuccess('房间创建成功！');
        } catch (e) { 
            this.showError('创建房间失败: ' + e.message); 
        }
    }

    /* -------------------- 用户设置 -------------------- */
    showChangeNameModal() {
        document.getElementById('newNameInput').value = this.currentUser.username;
        document.getElementById('changeNameModal').style.display = 'block';
    }

    hideChangeNameModal() { 
        document.getElementById('changeNameModal').style.display = 'none'; 
    }

    async changeUsername() {
        const name = document.getElementById('newNameInput').value.trim();
        if (!name || name.length < 3) return this.showError('用户名至少3个字符');
        
        try {
            const { error } = await this.supabase.from('chat_users')
                .update({ username: name })
                .eq('id', this.currentUser.userId);
                
            if (error) throw error;
            
            this.currentUser.username = name;
            localStorage.setItem('chat_session', JSON.stringify(this.currentUser));
            this.hideChangeNameModal();
            this.showSuccess('用户名修改成功！');
            await this.loadContacts();
        } catch (e) { 
            this.showError('修改用户名失败: ' + e.message); 
        }
    }

    logout() {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('chat_session');
            window.location.href = 'login.html';
        }
    }

    /* -------------------- 导航控制 -------------------- */
    showChatList() {
        this.setContainerVisibility({ chatList: true, chatArea: true });
        this.updateSidebarActive(0);
    }

    showContacts() {
        this.setContainerVisibility({ contactsContainer: true });
        this.updateSidebarActive(1);
    }

    showDiscover() {
        this.setContainerVisibility({ discoverContainer: true });
        this.updateSidebarActive(2);
    }

    showSettings() {
        this.setContainerVisibility({ settingsContainer: true });
        this.updateSidebarActive(3);
    }

    setContainerVisibility(show) {
        const containers = [
            'chatList', 'chatArea', 'contactsContainer', 'discoverContainer', 'settingsContainer'
        ];
        
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        Object.keys(show).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = show[id] ? 'flex' : 'none';
            }
        });
    }

    updateSidebarActive(idx) {
        document.querySelectorAll('.sidebar-item').forEach((n, i) => {
            n.classList.toggle('active', i === idx);
        });
    }

    /* -------------------- 文件处理 -------------------- */
    selectImageFile() {
        const inp = document.createElement('input');
        inp.type = 'file'; 
        inp.accept = 'image/*';
        inp.onchange = e => { 
            const f = e.target.files[0]; 
            if (f) this.handleImageFile(f); 
        };
        inp.click();
    }

    selectFile() {
        const inp = document.createElement('input');
        inp.type = 'file'; 
        inp.accept = '*/*';
        inp.onchange = e => { 
            const f = e.target.files[0]; 
            if (f) this.sendFile(f); 
        };
        inp.click();
    }

    async handleImageFile(file) {
        try {
            this.validateImageFile(file);
            const reader = new FileReader();
            reader.onload = async ev => await this.sendImageMessage(ev.target.result);
            reader.readAsDataURL(file);
        } catch (e) { 
            this.showError(e.message); 
        }
    }

    validateImageFile(file) {
        const valid = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const max = 5 * 1024 * 1024;
        if (!valid.includes(file.type)) throw new Error('仅支持 JPEG PNG GIF WebP');
        if (file.size > max) throw new Error('图片不能超过 5MB');
    }

    /* -------------------- 响应式适配 -------------------- */
    handleResize() {
        console.log('处理窗口大小变化');
        
        // 调整聊天区域高度
        const chatArea = document.getElementById('chatArea');
        const messagesContainer = document.getElementById('messagesContainer');
        
        if (chatArea && messagesContainer) {
            const headerHeight = chatArea.querySelector('.chat-header').offsetHeight;
            const inputHeight = chatArea.querySelector('.input-area').offsetHeight;
            const availableHeight = window.innerHeight - headerHeight - inputHeight - 20;
            
            messagesContainer.style.maxHeight = `${availableHeight}px`;
        }
        
        this.scrollToBottom();
    }

    /* -------------------- 测试和降级功能 -------------------- */
    showBasicFallback() {
        const c = document.getElementById('chatItems');
        if (!c) return;
        
        c.innerHTML = `<div class.welcome-message">
            <p>部分功能加载失败，但您可以：</p>
            <button onclick="chatManager.showCreateRoomModal()" class="login-btn" style="margin:10px;">创建新房间</button>
            <button onclick="chatManager.testBasicChat()" class="login-btn">测试基本聊天</button>
        </div>`;
        this.enableChatFeatures();
    }

    async testBasicChat() {
        this.showSuccess('测试功能已激活');
        const testRoom = { 
            id: 'test-room', 
            name: '测试房间', 
            description: '用于功能测试的临时房间', 
            created_at: new Date().toISOString() 
        };
        
        this.currentRoom = testRoom;
        document.getElementById('roomTitle').textContent = testRoom.name;
        this.enableChatFeatures();
        
        const c = document.getElementById('messagesContainer');
        c.innerHTML = '';
        
        this.addMessageToChat({ 
            content: '欢迎使用测试聊天功能！', 
            created_at: new Date().toISOString(), 
            message_type: 'text' 
        }, '系统');
        
        this.addMessageToChat({ 
            content: '您可以在这里测试基本的聊天功能', 
            created_at: new Date().toISOString(), 
            message_type: 'text' 
        }, '系统');
        
        this.scrollToBottom();
    }

    /* -------------------- 在线图片上传器 -------------------- */
    async uploadImage(imageData) {
        const uploader = new OnlineImageUploader(this.supabase);
        return await uploader.uploadImage(imageData, this);
    }
}

/* ****************************************************************************************
 * 在线图片上传器
 ****************************************************************************************/
class OnlineImageUploader {
    constructor(supabase) {
        this.supabase = supabase;
        this.maxSize = 5 * 1024 * 1024;
        this.timeout = 30000;
    }

    async uploadImage(imageData, chatManager) {
        if (!this.validate(imageData)) throw new Error('无效图片或超出大小');
        
        const size = (imageData.split(',')[1].length * 3) / 4;
        if (size > this.maxSize) {
            const blob = this.dataURLToBlob(imageData);
            const file = new File([blob], `large_image_${Date.now()}.jpg`, { type: 'image/jpeg' });
            return await chatManager.sendFile(file);
        }
        
        const compressed = await this.compress(imageData);
        return await this.upload(compressed);
    }

    validate(d) {
        if (!d || !d.startsWith('data:image/')) return false;
        return true;
    }

    async compress(data) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let { width, height } = img;
                const max = 800;
                
                if (width > max) {
                    height = (height * max) / width;
                    width = max;
                }
                if (height > max) {
                    width = (width * max) / height;
                    height = max;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            
            img.onerror = () => resolve(data);
            img.src = data;
        });
    }

    async upload(data) {
        return new Promise(async (resolve, reject) => {
            const t = setTimeout(() => reject(new Error('上传超时')), this.timeout);
            
            try {
                const fn = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
                const blob = this.dataURLToBlob(data);
                
                const { error } = await this.supabase.storage.from('chat-images').upload(fn, blob, {
                    contentType: 'image/jpeg',
                    upsert: false
                });
                
                clearTimeout(t);
                if (error) throw error;
                
                const { data: { publicUrl } } = this.supabase.storage.from('chat-images').getPublicUrl(fn);
                resolve(publicUrl);
            } catch (e) {
                clearTimeout(t);
                reject(e);
            }
        });
    }

    dataURLToBlob(dataURL) {
        const [head, base] = dataURL.split(',');
        const mime = head.split(':')[1].split(';')[0];
        const raw = window.atob(base);
        const u = new Uint8Array(raw.length);
        
        for (let i = 0; i < raw.length; ++i) {
            u[i] = raw.charCodeAt(i);
        }
        
        return new Blob([u], { type: mime });
    }
}

/* ****************************************************************************************
 * 翻译器
 ****************************************************************************************/
class Translator {
    constructor() {
        this.cache = JSON.parse(localStorage.getItem('transCache') || '{}');
        this.useGoogleDetect = false;
        this.userLang = localStorage.getItem('userLanguage') || 'zh-CN';
        this.langInfo = {
            zh: { name: '中文', flag: '🇨🇳', code: 'zh-CN', color: '#dc2626' },
            ru: { name: '俄语', flag: '🇷🇺', code: 'ru-RU', color: '#2563eb' },
            de: { name: '德语', flag: '🇩🇪', code: 'de-DE', color: '#059669' },
            en: { name: '英语', flag: '🇺🇸', code: 'en-US', color: '#7c3aed' },
            ka: { name: '格鲁吉亚文', flag: '🇬🇪', code: 'ka-GE', color: '#d97706' },
            auto: { name: '自动检测', flag: '🌐', code: '', color: '#6b7280' }
        };
    }

    async translateText(original, sourceLang, targetLang) {
        if (!original.trim()) return '';
        
        if (sourceLang === 'auto') {
            sourceLang = this.useGoogleDetect ? await this.googleDetect(original) : this.regexDetect(original);
        }
        
        const key = `${original}::${sourceLang}->${targetLang}`;
        if (this.cache[key]) return this.cache[key];
        
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(original)}&langpair=${sourceLang}|${targetLang}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.responseStatus === 200 && data.responseData) {
                this.cache[key] = data.responseData.translatedText;
                localStorage.setItem('transCache', JSON.stringify(this.cache));
                return data.responseData.translatedText;
            }
            throw new Error(data.responseDetails || '翻译失败');
        } catch (error) {
            console.error('翻译失败:', error);
            return original;
        }
    }

    regexDetect(text) {
        if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
        if (/[ა-ჰჰ]/.test(text)) return 'ka';
        if (/[а-яА-Я]/.test(text)) return 'ru';
        if (/[äöüßÄÖÜ]/.test(text)) return 'de';
        if (/[a-zA-Z]/.test(text)) return 'en';
        return 'en';
    }

    async googleDetect(text) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=ld&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            const data = await response.json();
            return data[2] || 'en';
        } catch {
            return 'en';
        }
    }

    async appendTranslation(msgBubble, originalText) {
        if (!originalText) return;
        
        let bar = msgBubble.querySelector('.trans-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'trans-bar';
            msgBubble.appendChild(bar);
        }
        
        const translated = await this.translateText(originalText, 'auto', this.userLang);
        if (translated && translated !== originalText) {
            bar.textContent = `翻译：${translated}`;
            bar.classList.add('show');
        }
    }
}

/* ****************************************************************************************
 * 全局初始化
 ****************************************************************************************/
const chatManager = new ChatManager();
const translator = new Translator();

// 全局函数
window.translateMessage = async (msgDiv) => {
    const bubble = msgDiv.querySelector('.message-bubble');
    const textEl = bubble.querySelector('.message-text');
    if (!textEl) return;
    
    const original = textEl.textContent.trim();
    if (!original) return;
    
    await translator.appendTranslation(bubble, original);
};

window.appendTranslation = async (bubble, text) => {
    await translator.appendTranslation(bubble, text);
};

// 全局暴露
window.chatManager = chatManager;
window.translator = translator;

// 错误处理
window.addEventListener('error', (e) => {
    console.error('全局错误:', e.error);
    chatManager.handleGlobalError(e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的Promise拒绝:', e.reason);
    chatManager.handleGlobalError(e.reason);
});

// 网络状态检测
window.addEventListener('online', () => {
    chatManager.showSystemMsg('网络连接已恢复', 'success');
});

window.addEventListener('offline', () => {
    chatManager.showSystemMsg('网络连接已断开', 'error');
});

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM完全加载，初始化应用');
});

console.log('ChatManager v5.5 加载完成 - 功能：文字聊天、图片、文件、视频录制、语音消息（分开按钮）、多语言翻译');