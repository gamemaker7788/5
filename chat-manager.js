/****************************************************************************************
 * ChatManager Fusion v6.0 - 完整房主权限管理版
 * 包含：文字聊天、图片、文件、视频录制、语音消息、房主权限管理
 ****************************************************************************************/
class ChatManager {
    constructor() {
this.kickSubscription = null;
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
        
        // 房主权限管理相关属性
        this.currentUserRole = null;
        this.roomMembers = [];
        this.isRoomOwner = false;
        this.isRoomAdmin = false;
        
        // 绑定所有方法到实例
        this.bindMethods();
        this.init();
    }
showLangSettings() {
    // 把当前值回显到弹窗
    const saved = localStorage.getItem('userLanguage') || 'zh-CN';
    document.getElementById('targetLangSelect').value = saved;
    document.getElementById('autoTransToggle').checked =
        localStorage.getItem('autoTransEnabled') === 'true';
    document.getElementById('langSettingsModal').style.display = 'block';
}

hideLangSettings() {
    document.getElementById('langSettingsModal').style.display = 'none';
}
saveLangSettings() {
    const tgt = document.getElementById('targetLangSelect').value;
    const on = document.getElementById('autoTransToggle').checked;

    localStorage.setItem('userLanguage', tgt);
    localStorage.setItem('autoTransEnabled', on);
	localStorage.removeItem('transCache');
    // 实时更新 translator.js 的变量
    window.USER_LANG = tgt;
    window.TRANS_CACHE = JSON.parse(localStorage.getItem('transCache') || '{}');

    this.showSuccess('语言设置已保存');
    this.hideLangSettings();
}

	// 加载表情图片列表
async loadEmojis() {
  const { data, error } = await this.supabase
    .from('emojis')
    .select('image_url')
    .order('id');

  if (error) {
    console.error('加载表情失败:', error);
    return [];
  }
  return data;
}
// 显示表情网格弹窗
async showEmojiGrid() {
  const emojis = await this.loadEmojis();
  if (!emojis.length) return;

  let grid = document.getElementById('emojiGrid');
  if (grid) grid.remove();

  grid = document.createElement('div');
  grid.id = 'emojiGrid';
  grid.className = 'emoji-grid';
  grid.innerHTML = `
    <div class="emoji-grid-inner">
      <div class="emoji-header">
        <span class="emoji-title">选择表情</span>
        <button class="emoji-close-btn" aria-label="关闭">✕</button>
      </div>
      <div class="emoji-grid-content">
        ${emojis.map(e => `
          <img src="${e.image_url}" class="emoji-img" onclick="chatManager.sendEmojiImage('${e.image_url}')" />
        `).join('')}
      </div>
    </div>
  `;

  // 点空白处关闭
  grid.addEventListener('click', e => {
    if (e.target === grid) this.hideEmojiGrid();
  });
  // 点 ╳ 关闭
  grid.querySelector('.emoji-close-btn').addEventListener('click', () => this.hideEmojiGrid());

  document.body.appendChild(grid);
}


// 发送表情图片（和普通图片一样）
async sendEmojiImage(imageUrl) {
  if (!this.currentRoom || !imageUrl) return;

  try {
    await this.supabase.from('chat_messages').insert({
      content: '[表情]',
      room_id: this.currentRoom.id,
      user_id: this.currentUser.userId,
      message_type: 'image',
      file_url: imageUrl,
      file_name: 'emoji.png',
      direction: 1
    });

    this.hideEmojiGrid();
  } catch (e) {
    this.showError('发送表情失败: ' + e.message);
  }
}

// 关闭表情网格
hideEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  if (grid) grid.remove();
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
            'handleVoiceButtonClick', 'joinRoom', 'updateRecordingUI',
            'createVideoPreview', 'bindVideoPreviewEvents', 'startVideoRecording',
            'stopVideoRecording', 'updateVideoRecordingUI', 'startVideoTimer',
            'stopVideoTimer', 'sendVideo', 'toggleVideoRecording', 'showVideoPreview',
            'hideVideoPreview', 'switchCamera', 'showRoomMembersModal', 'showRoomSettingsModal',
            'hideRoomMembersModal', 'hideRoomSettingsModal', 'saveRoomSettings', 'deleteRoom',
            'kickMember', 'promoteMember', 'demoteMember', 'addRoomMember', 'updateUserPermissions',
            'updateRoomManagementUI', 'renderMembersList', 'getRoleDisplayName'
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
        
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        this.setupEventListeners();
        this.initVoicePlayback();
        
        // 添加重试机制
        await this.loadRoomsWithRetry();
        await this.loadContacts();
        this.showChatList();
        this.showSuccess('应用启动成功！');
        
    } catch (e) {
        console.error('初始化失败:', e);
        this.showError('初始化失败，已启用基础模式');
        this.showBasicFallback();
    }
}

// 带重试的房间加载
async loadRoomsWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await this.loadRooms();
            if (this.rooms.length > 0) break; // 成功加载房间
        } catch (e) {
            console.warn(`房间加载尝试 ${i + 1} 失败:`, e);
            if (i === maxRetries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        }
    }

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
	this.bindButton('emojiBtn', 'click', () => this.showEmojiGrid());
	// 语言设置
this.bindButton('langSettingsBtn', 'click', () => this.showLangSettings());
this.bindButton('closeLangSettings', 'click', () => this.hideLangSettings());
this.bindButton('saveLangSettings', 'click', () => this.saveLangSettings());

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

        // 房主权限管理功能 - 新增的事件监听
        this.bindButton('roomMembersBtn', 'click', () => this.showRoomMembersModal());
        this.bindButton('roomSettingsBtn', 'click', () => this.showRoomSettingsModal());
        this.bindButton('closeMembersModal', 'click', () => this.hideRoomMembersModal());
        this.bindButton('closeRoomSettings', 'click', () => this.hideRoomSettingsModal());
        this.bindButton('saveRoomSettings', 'click', () => this.saveRoomSettings());
        this.bindButton('deleteRoomBtn', 'click', () => this.deleteRoom());

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

    /* -------------------- 房主权限管理 -------------------- */
    
    // 修改创建房间方法，设置房主
    async createRoom() {
        const name = document.getElementById('roomNameInput').value.trim();
        const desc = document.getElementById('roomDescInput').value.trim();
        
        if (!name) return this.showError('请输入房间名称');
        
        try {
            const { data, error } = await this.supabase.from('chat_rooms').insert({ 
                name, 
                description: desc, 
                created_by: this.currentUser.userId, 
                is_public: true,
                owner_id: this.currentUser.userId // 设置房主
            }).select();
            
            if (error) throw error;
            
            // 自动将创建者添加为房主
            if (data && data.length) {
                await this.addRoomMember(data[0].id, this.currentUser.userId, 'owner');
                this.hideCreateRoomModal();
                await this.loadRooms();
                this.selectRoom(data[0]);
                this.showSuccess('房间创建成功！您已成为房主');
            }
        } catch (e) { 
            this.showError('创建房间失败: ' + e.message); 
        }
    }

    // 添加房间成员
    async addRoomMember(roomId, userId, role = 'member') {
        try {
            const { error } = await this.supabase.from('room_members').insert({
                room_id: roomId,
                user_id: userId,
                role: role,
                joined_at: new Date().toISOString()
            });
            
            if (error) throw error;
        } catch (e) {
            console.error('添加成员失败:', e);
        }
    }

    // 修改加入房间方法，检查用户角色
   async joinRoom(roomId) {
    try {
        // 获取用户在房间中的角色信息
        const { data: membership, error } = await this.supabase
            .from('room_members')
            .select('role, status')
            .eq('room_id', roomId)
            .eq('user_id', this.currentUser.userId)
            .single();
        
        if (error) {
            // 如果用户不是成员，自动加入房间
            if (error.code === 'PGRST116') { // 记录不存在
                console.log('用户不是房间成员，自动加入...');
                const { error: joinError } = await this.supabase
                    .from('room_members')
                    .insert({
                        room_id: roomId,
                        user_id: this.currentUser.userId,
                        role: 'member',
                        joined_at: new Date().toISOString(),
                        status: 'active'
                    });
                
                if (joinError) throw joinError;
                
                this.currentUserRole = 'member';
            } else {
                throw error;
            }
        } else {
            // 用户已是成员，设置角色
            this.currentUserRole = membership.role;
            
            // 检查是否被踢出
            if (membership.status === 'kicked') {
                this.showError('您已被移出该群聊');
                this.currentRoom = null;
                return;
            }
        }
        
        // 更新权限状态
        this.updateUserPermissions();
        
        console.log('用户角色已设置:', this.currentUserRole);
        console.log('房主权限:', this.isRoomOwner);
        console.log('管理员权限:', this.isRoomAdmin);
        
    } catch (e) {
        console.error('加入房间失败:', e);
        this.showError('加入房间失败: ' + e.message);
    }
}

    // 更新用户权限状态
    updateUserPermissions() {
    // 确保 currentUserRole 有值
    if (!this.currentUserRole) {
        this.currentUserRole = 'member'; // 默认成员
    }
    
    this.isRoomOwner = this.currentUserRole === 'owner';
    this.isRoomAdmin = this.currentUserRole === 'admin' || this.isRoomOwner;
    
    console.log('权限更新 - 角色:', this.currentUserRole, 
                '房主:', this.isRoomOwner, 
                '管理员:', this.isRoomAdmin);
    
    // 更新UI显示
    this.updateRoomManagementUI();
}

    // 更新房间管理UI
   updateRoomManagementUI() {
    const roomSettingsBtn = document.getElementById('roomSettingsBtn');
    const roomMembersBtn = document.getElementById('roomMembersBtn');
    
    console.log('更新房间管理UI - 房主:', this.isRoomOwner, '管理员:', this.isRoomAdmin);
    
    if (roomSettingsBtn && roomMembersBtn) {
        if (this.isRoomAdmin) {
            roomSettingsBtn.style.display = 'block';
            roomMembersBtn.style.display = 'block';
            console.log('显示房主/管理员按钮');
        } else {
            roomSettingsBtn.style.display = 'none';
            roomMembersBtn.style.display = 'block'; // 普通成员也可以查看成员列表
            console.log('隐藏房主设置按钮，显示成员按钮');
        }
    } else {
        console.warn('房间管理按钮未找到');
    }
}

    // 显示成员管理模态框
   async showRoomMembersModal() {
    console.log('显示成员管理模态框');
    
    if (!this.currentRoom) {
        this.showError('请先选择聊天室');
        return;
    }
    
    try {
        // 显示加载状态
        const membersList = document.getElementById('membersList');
        if (membersList) {
            membersList.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><span>加载中...</span></div>';
        }
        
        document.getElementById('roomMembersModal').style.display = 'block';
        
        // 只查询状态为 active 的活跃成员（可以看到聊天的人）
        const { data: members, error } = await this.supabase
            .from('room_members')
            .select(`
                *,
                chat_users (
                    username,
                    is_online,
                    last_login
                )
            `)
            .eq('room_id', this.currentRoom.id)
            .eq('status', 'active')  // 只显示活跃成员
            .order('role', { ascending: false })  // 按角色排序：owner > admin > member
            .order('joined_at', { ascending: true });  // 然后按加入时间排序
        
        if (error) throw error;
        
        this.roomMembers = members || [];
        this.renderMembersList();
        
        console.log('加载到的活跃成员数量:', this.roomMembers.length);
        
    } catch (e) {
        console.error('加载成员列表失败:', e);
        this.showError('加载成员列表失败: ' + e.message);
    }
}
   // 渲染成员列表
renderMembersList() {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    membersList.innerHTML = '';
    
    if (this.roomMembers.length === 0) {
        membersList.innerHTML = '<div class="empty-state">暂无成员</div>';
        return;
    }
    
    // 添加统计信息
    const stats = this.calculateMemberStats();
    const statsHTML = `
        <div class="room-stats">
            <h4>房间成员统计</h4>
            <p>👥 总成员: ${stats.total} 人</p>
            <p>👑 房主: ${stats.owners} 人</p>
            <p>⚡ 管理员: ${stats.admins} 人</p>
            <p>👤 普通成员: ${stats.members} 人</p>
        </div>
    `;
    membersList.innerHTML = statsHTML;
    
    this.roomMembers.forEach(member => {
        const user = member.chat_users;
        if (!user) return;
        
        const isCurrentUser = member.user_id === this.currentUser.userId;
        const canManage = this.isRoomAdmin && !isCurrentUser;
        const isOwner = member.role === 'owner';
        
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
            <div class="member-info">
                <div class="member-avatar" style="background:${this.getRandomColor(user.username)}">
                    ${user.username[0].toUpperCase()}
                </div>
                <div class="member-details">
                    <div class="member-name">
                        ${this.escapeHtml(user.username)} 
                        ${isCurrentUser ? '(我)' : ''}
                        ${this.getOnlineStatus(user)}
                    </div>
                    <div class="member-role ${'role-' + member.role}">
                        ${this.getRoleDisplayName(member.role)}
                        ${this.getMemberStatusBadge(member)}
                    </div>
                </div>
            </div>
            ${canManage && !isOwner ? `
                <div class="member-actions">
                    <button class="action-btn kick" onclick="chatManager.kickMember('${member.user_id}')" title="移出群聊">🚫 移出</button>
                    ${member.role === 'member' ? `
                        <button class="action-btn promote" onclick="chatManager.promoteMember('${member.user_id}')" title="设为管理员">⚡ 提升</button>
                    ` : ''}
                    ${member.role === 'admin' ? `
                        <button class="action-btn demote" onclick="chatManager.demoteMember('${member.user_id}')" title="撤销管理员">⬇️ 撤销</button>
                    ` : ''}
                </div>
            ` : ''}
        `;
        
        membersList.appendChild(memberItem);
    });
}

// 计算成员统计
calculateMemberStats() {
    const stats = {
        total: this.roomMembers.length,
        owners: 0,
        admins: 0,
        members: 0
    };
    
    this.roomMembers.forEach(member => {
        switch(member.role) {
            case 'owner': stats.owners++; break;
            case 'admin': stats.admins++; break;
            case 'member': stats.members++; break;
        }
    });
    
    return stats;
}

// 获取在线状态显示
getOnlineStatus(user) {
    const isOnline = user.is_online || (Date.now() - new Date(user.last_login).getTime() < 300000);
    return isOnline ? '🟢' : '⚫';
}

// 获取成员状态徽章
getMemberStatusBadge(member) {
    if (member.status === 'kicked') {
        return ' 🚫 已移出';
    } else if (member.status === 'muted') {
        return ' 🔇 禁言中';
    }
    return '';
}
// 在成员管理模态框中添加切换按钮
async showRoomMembersModal() {
    console.log('显示成员管理模态框');
    
    if (!this.currentRoom) {
        this.showError('请先选择聊天室');
        return;
    }
    
    try {
        const membersList = document.getElementById('membersList');
        if (membersList) {
            membersList.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><span>加载中...</span></div>';
        }
        
        document.getElementById('roomMembersModal').style.display = 'block';
        
        // 添加切换按钮
        this.addMemberViewToggle();
        
        // 默认显示活跃成员
        await this.loadActiveMembers();
        
    } catch (e) {
        console.error('加载成员列表失败:', e);
        this.showError('加载成员列表失败: ' + e.message);
    }
}

// 添加成员视图切换
addMemberViewToggle() {
    const modalContent = document.querySelector('#roomMembersModal .modal-content');
    const existingToggle = document.getElementById('memberViewToggle');
    
    if (existingToggle) {
        existingToggle.remove();
    }
    
    // 只有管理员才能查看被移出成员
    if (this.isRoomAdmin) {
        const toggleHTML = `
            <div class="member-view-toggle" id="memberViewToggle">
                <button class="toggle-btn active" data-view="active">👥 当前成员</button>
                <button class="toggle-btn" data-view="kicked">🚫 已移出成员</button>
            </div>
        `;
        
        const modalTitle = modalContent.querySelector('.modal-title');
        modalTitle.insertAdjacentHTML('afterend', toggleHTML);
        
        // 绑定切换事件
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const view = e.target.getAttribute('data-view');
                if (view === 'active') {
                    this.loadActiveMembers();
                } else {
                    this.loadKickedMembers();
                }
            });
        });
    }
}

// 加载活跃成员（可以看到聊天的人）
async loadActiveMembers() {
    try {
        const { data: members, error } = await this.supabase
            .from('room_members')
            .select(`
                *,
                chat_users (
                    username,
                    is_online,
                    last_login
                )
            `)
            .eq('room_id', this.currentRoom.id)
            .eq('status', 'active')
            .order('role', { ascending: false })
            .order('joined_at', { ascending: true });
        
        if (error) throw error;
        
        this.roomMembers = members || [];
        this.renderMembersList();
        
    } catch (e) {
        console.error('加载活跃成员失败:', e);
        this.showError('加载成员失败: ' + e.message);
    }
}

// 加载被移出成员（管理员专用）
async loadKickedMembers() {
    try {
        const { data: members, error } = await this.supabase
            .from('room_members')
            .select(`
                *,
                chat_users (
                    username,
                    is_online,
                    last_login
                )
            `)
            .eq('room_id', this.currentRoom.id)
            .eq('status', 'kicked')
            .order('kicked_at', { ascending: false });
        
        if (error) throw error;
        
        this.renderKickedMembersList(members || []);
        
    } catch (e) {
        console.error('加载被移出成员失败:', e);
        this.showError('加载被移出成员失败: ' + e.message);
    }
}

// 渲染被移出成员列表
renderKickedMembersList(kickedMembers) {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    if (kickedMembers.length === 0) {
        membersList.innerHTML = '<div class="empty-state">暂无被移出成员</div>';
        return;
    }
    
    let html = `
        <div class="room-stats" style="border-left-color: #ff4757;">
            <h4>🚫 被移出成员</h4>
            <p>共 ${kickedMembers.length} 人被移出</p>
        </div>
    `;
    
    kickedMembers.forEach(member => {
        const user = member.chat_users;
        if (!user) return;
        
        html += `
            <div class="member-item kicked-member">
                <div class="member-info">
                    <div class="member-avatar" style="background: #ccc;">
                        ${user.username[0].toUpperCase()}
                    </div>
                    <div class="member-details">
                        <div class="member-name" style="color: #999;">
                            ${this.escapeHtml(user.username)}
                        </div>
                        <div class="member-role" style="color: #ff4757;">
                            🚫 已移出
                            ${member.kicked_at ? `于 ${new Date(member.kicked_at).toLocaleDateString()}` : ''}
                        </div>
                    </div>
                </div>
                <div class="member-actions">
                    <button class="action-btn unban" onclick="chatManager.unbanMember('${member.user_id}')" title="恢复成员身份">↩️ 恢复</button>
                </div>
            </div>
        `;
    });
    
    membersList.innerHTML = html;
}

// 恢复被移出成员
async unbanMember(userId) {
    if (!this.isRoomAdmin) {
        this.showError('权限不足');
        return;
    }
    
    try {
        const { error } = await this.supabase
            .from('room_members')
            .update({ 
                status: 'active',
                kicked_at: null,
                kicked_by: null
            })
            .eq('room_id', this.currentRoom.id)
            .eq('user_id', userId);
        
        if (error) throw error;
        
        this.showSuccess('成员已恢复');
        this.loadActiveMembers(); // 切换回活跃成员视图
        
    } catch (e) {
        console.error('恢复成员失败:', e);
        this.showError('恢复成员失败: ' + e.message);
    }
}
    // 获取角色显示名称
    getRoleDisplayName(role) {
        const roleNames = {
            'owner': '房主',
            'admin': '管理员',
            'member': '成员'
        };
        return roleNames[role] || '成员';
    }

    // 踢出成员
   // 踢人函数（替换你原来的 kickMember）
// 踢人函数 - 更新为完全移除权限
async kickMember(userId) {
    if (!this.isRoomAdmin) {
        this.showError('只有房主和管理员可以踢人');
        return;
    }
    
    if (userId === this.currentUser.userId) {
        this.showError('不能踢自己');
        return;
    }

    try {
        // 检查目标用户角色
        const { data: targetMember, error: checkError } = await this.supabase
            .from('room_members')
            .select('role')
            .eq('room_id', this.currentRoom.id)
            .eq('user_id', userId)
            .single();
            
        if (checkError) throw checkError;
        if (!targetMember) {
            this.showError('成员不存在');
            return;
        }
        
        // 权限验证
        if (targetMember.role === 'owner') {
            this.showError('不能踢房主');
            return;
        }
        
        if (targetMember.role === 'admin' && !this.isRoomOwner) {
            this.showError('只有房主可以踢管理员');
            return;
        }
        
        // 标记为被踢出状态（而不是删除记录，便于管理）
        const { error } = await this.supabase
            .from('room_members')
            .update({ 
                status: 'kicked',
                kicked_at: new Date().toISOString(),
                kicked_by: this.currentUser.userId
            })
            .eq('room_id', this.currentRoom.id)
            .eq('user_id', userId);
            
        if (error) throw error;
        
        this.showSuccess('成员已移出群聊');
        this.loadActiveMembers(); // 刷新显示当前成员
        
    } catch (e) {
        console.error('踢人失败:', e);
        this.showError('踢人失败: ' + e.message);
    }
}


    // 提升为管理员
    async promoteMember(userId) {
        if (!this.isRoomOwner) {
            this.showError('只有房主可以设置管理员');
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('room_members')
                .update({ role: 'admin' })
                .eq('room_id', this.currentRoom.id)
                .eq('user_id', userId);
            
            if (error) throw error;
            
            this.showSuccess('已提升为管理员');
            await this.showRoomMembersModal(); // 刷新列表
            
        } catch (e) {
            console.error('提升管理员失败:', e);
            this.showError('提升管理员失败: ' + e.message);
        }
    }

    // 撤销管理员
    async demoteMember(userId) {
        if (!this.isRoomOwner) {
            this.showError('只有房主可以撤销管理员');
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('room_members')
                .update({ role: 'member' })
                .eq('room_id', this.currentRoom.id)
                .eq('user_id', userId);
            
            if (error) throw error;
            
            this.showSuccess('已撤销管理员权限');
            await this.showRoomMembersModal(); // 刷新列表
            
        } catch (e) {
            console.error('撤销管理员失败:', e);
            this.showError('撤销管理员失败: ' + e.message);
        }
    }

    // 显示房间设置模态框
    async showRoomSettingsModal() {
        if (!this.currentRoom) {
            this.showError('请先选择聊天室');
            return;
        }
        
        if (!this.isRoomAdmin) {
            this.showError('权限不足');
            return;
        }
        
        document.getElementById('editRoomName').value = this.currentRoom.name;
        document.getElementById('editRoomDesc').value = this.currentRoom.description || '';
        document.getElementById('roomPermission').value = this.currentRoom.is_public ? 'public' : 'private';
        
        // 只有房主可以删除房间
        const deleteBtn = document.getElementById('deleteRoomBtn');
        if (deleteBtn) {
            deleteBtn.style.display = this.isRoomOwner ? 'block' : 'none';
        }
        
        document.getElementById('roomSettingsModal').style.display = 'block';
    }

    // 保存房间设置
    async saveRoomSettings() {
        if (!this.isRoomAdmin) return;
        
        const name = document.getElementById('editRoomName').value.trim();
        const desc = document.getElementById('editRoomDesc').value.trim();
        const isPublic = document.getElementById('roomPermission').value === 'public';
        
        if (!name) {
            this.showError('房间名称不能为空');
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('chat_rooms')
                .update({
                    name: name,
                    description: desc,
                    is_public: isPublic
                })
                .eq('id', this.currentRoom.id);
            
            if (error) throw error;
            
            this.currentRoom.name = name;
            this.currentRoom.description = desc;
            this.currentRoom.is_public = isPublic;
            
            document.getElementById('roomTitle').textContent = name;
            this.hideRoomSettingsModal();
            this.showSuccess('房间设置已保存');
            
        } catch (e) {
            console.error('保存设置失败:', e);
            this.showError('保存设置失败: ' + e.message);
        }
    }

    // 删除房间
    async deleteRoom() {
        if (!this.isRoomOwner) {
            this.showError('只有房主可以删除房间');
            return;
        }
        
        if (!confirm('确定要删除这个房间吗？此操作不可撤销！')) return;
        
        try {
            const { error } = await this.supabase
                .from('chat_rooms')
                .delete()
                .eq('id', this.currentRoom.id);
            
            if (error) throw error;
            
            this.hideRoomSettingsModal();
            this.showSuccess('房间已删除');
            await this.loadRooms();
            this.showChatList();
            
        } catch (e) {
            console.error('删除房间失败:', e);
            this.showError('删除房间失败: ' + e.message);
        }
    }

    // 隐藏模态框的方法
    hideRoomMembersModal() {
        const modal = document.getElementById('roomMembersModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    hideRoomSettingsModal() {
        const modal = document.getElementById('roomSettingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /* -------------------- 房间管理 -------------------- */
   async loadRooms() {
    try {
        // 方法1：使用明确的连接查询
        const { data, error } = await this.supabase
            .from('room_members')
            .select(`
                chat_rooms (
                    id,
                    name,
                    description,
                    created_at,
                    is_public,
                    owner_id
                )
            `)
            .eq('user_id', this.currentUser.userId)
            .neq('status', 'kicked')
            .order('joined_at', { ascending: false });

        if (error) throw error;
        
        // 提取房间数据
        this.rooms = data.map(item => item.chat_rooms).filter(room => room !== null);
        
    } catch (e) {
        console.error('加载房间失败', e);
        
        // 方法2：备用查询方案
        try {
            const { data: backupData, error: backupError } = await this.supabase
                .from('chat_rooms')
                .select('id, name, description, created_at, is_public, owner_id')
                .order('created_at', { ascending: false });
                
            if (!backupError) {
                this.rooms = backupData || [];
            } else {
                this.rooms = [];
            }
        } catch (backupError) {
            this.rooms = [];
        }
    }
    this.renderRoomList();
}

    renderRoomList() {
    const container = document.getElementById('chatItems');
    if (!container) return;
    
    if (!this.rooms || this.rooms.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <p>暂无聊天室</p>
                <button onclick="chatManager.showCreateRoomModal()" class="login-btn">
                    创建第一个聊天室
                </button>
            </div>`;
        return;
    }
    
    container.innerHTML = '';
    this.rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => this.selectRoom(room);
        div.innerHTML = `
            <div class="chat-avatar" style="background:${this.getRandomColor(room.name)}">
                ${room.name[0].toUpperCase()}
            </div>
            <div class="chat-info">
                <div class="chat-name">${this.escapeHtml(room.name)}</div>
                <div class="chat-preview">${this.escapeHtml(room.description || '暂无描述')}</div>
            </div>`;
        container.appendChild(div);
    });
}

    async selectRoom(room) {
    try {
        this.currentRoom = room;
        
        // 更新UI
        document.querySelectorAll('.chat-item').forEach(n => n.classList.remove('active'));
        event.currentTarget.classList.add('active');
        document.getElementById('roomTitle').textContent = room.name;
        
        // 加入房间并获取用户角色
        await this.joinRoom(room.id);
        
        // 启用聊天功能
        this.enableChatFeatures();
        await this.loadMessages(room.id);
        this.setupMessageSubscription(room.id);
        this.scrollToBottom();
        
        console.log('房间选择完成，用户角色:', this.currentUserRole);
        console.log('房主状态:', this.isRoomOwner);
        console.log('管理员状态:', this.isRoomAdmin);
        
    } catch (e) { 
        this.showError('进入房间失败: ' + e.message); 
    }
}

    /* -------------------- 消息发送 -------------------- */
   async sendMessage() {
    // 发送前检查是否被踢
    if (!this.currentRoom) {
        this.showError('请先选择聊天室');
        return;
    }
    
    // 检查用户在当前房间的权限
    const { data: membership, error } = await this.supabase
        .from('room_members')
        .select('status')
        .eq('room_id', this.currentRoom.id)
        .eq('user_id', this.currentUser.userId)
        .single();
        
    if (error || !membership || membership.status === 'kicked') {
        this.showError('您已被移出该群聊，无法发送消息');
        this.currentRoom = null;
        this.loadRooms();
        this.showChatList();
        return;
    }
    
    const input = document.getElementById('messageInput');
    const txt = input.value.trim();
    
    if (!txt) return;
    
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

/* -------------------- 消息加载 -------------------- */
async loadMessages(roomId) {
    try {
        // 只加载用户有权限查看的消息
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
        
        // 过滤消息：被踢后的用户不能看到被踢后发送的消息
        const filteredMessages = await this.filterMessagesByPermission(data, roomId);
        
        filteredMessages.forEach(m => this.addMessageToChat(m, m.chat_users.username));
        this.scrollToBottom();
        // ✅ 只翻译文本消息，跳过图片/语音/文件
if (localStorage.getItem('autoTransEnabled') === 'true') {
    setTimeout(() => {
        document.querySelectorAll('#messagesContainer .message').forEach(msgDiv => {
            const bubble = msgDiv.querySelector('.message-bubble');
            const textEl = bubble?.querySelector('.message-text');
            if (textEl && textEl.textContent.trim()) {
                window.translateMessage(msgDiv);
            }
        });
    }, 300);
}

    } catch (e) { 
        this.showError('加载消息失败'); 
    }
}

// 消息权限过滤
async filterMessagesByPermission(messages, roomId) {
    try {
        // 获取用户被踢的时间（如果有）
        const { data: membership } = await this.supabase
            .from('room_members')
            .select('kicked_at')
            .eq('room_id', roomId)
            .eq('user_id', this.currentUser.userId)
            .single();
            
        // 如果用户没有被踢，返回所有消息
        if (!membership || !membership.kicked_at) {
            return messages;
        }
        
        const kickedTime = new Date(membership.kicked_at);
        
        // 只显示被踢时间之前的消息
        return messages.filter(msg => new Date(msg.created_at) <= kickedTime);
        
    } catch (e) {
        console.error('消息过滤错误:', e);
        return messages; // 出错时返回所有消息
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
    if (msg.message_type === 'text' && localStorage.getItem('autoTransEnabled') === 'true') {
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

/* -------------------- 房间创建模态框 -------------------- */
showCreateRoomModal() {
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomDescInput').value = '';
    document.getElementById('createRoomModal').style.display = 'block';
}

hideCreateRoomModal() { 
    document.getElementById('createRoomModal').style.display = 'none'; 
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
   if (this.kickSubscription) {
  this.supabase.removeChannel(this.kickSubscription);
  this.kickSubscription = null;
}
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

/* -------------------- 文件上传 -------------------- */
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

async uploadImage(imageData) {
    const uploader = new OnlineImageUploader(this.supabase);
    return await uploader.uploadImage(imageData, this);
}

async uploadFile(file) {
    try {
        if (!file || !(file instanceof File)) {
            throw new Error('无效的文件对象');
        }
        
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error(`文件大小不能超过 ${this.formatFileSize(maxSize)}`);
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fn = `file_${Date.now()}_${safeName}`;
        
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

/* -------------------- 语音录制功能 -------------------- */
showVoiceRecordUI() {
    console.log('显示语音录制界面');
    
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
                        <div class="waveform-bar"></div>
                    </div>
                    
                    <div class="voice-record-time">
                        <span id="voiceRecordTime">00:00</span>
                        <span class="voice-max-time">/02:00</span>
                    </div>
                    
                    <div class="voice-record-status" id="voiceRecordStatus">
                        <span class="status-dot"></span>
                        <span>准备就绪</span>
                    </div>
                
                   <div class="voice-record-controls">
                        <button class="voice-control-btn" id="voiceRecordBtn" title="开始录制">
                            <div class="control-icon">⏺</div>
                            <span>录制</span>
                        </button>
                        
                        <button class="voice-control-btn" id="voicePauseBtn" title="暂停" disabled>
                            <div class="control-icon">⏸</div>
                            <span>暂停</span>
                        </button>
                        
                       <button class="voice-control-btn" id="voiceResumeBtn" title="继续" disabled>
                            <div class="control-icon">▶️</div>
                            <span>继续</span>
                       </button>
                        
                        <button class="voice-control-btn" id="voiceStopBtn" title="停止">
                            <div class="control-icon">⏹</div>
                            <span>停止</span>
                        </button>
                        
                        <button class="voice-control-btn send-btn" id="voiceSendBtn" title="发送" disabled>
                            <div class="control-icon">📤</div>
                            <span>发送</span>
                        </button>
                    </div>
                    <p>录制时长：最长2分钟</p>
                    <p>文件大小：约1.5MB/分钟</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', voiceUIHTML);
    
    setTimeout(() => {
        this.setupVoiceRecordEvents();
    }, 100);
}

setupVoiceRecordEvents() {
    console.log('设置语音录制事件');
    
    const overlay = document.getElementById('voiceRecordOverlay');
    if (!overlay) {
        console.error('语音录制界面未找到');
        return;
    }
    
    overlay.addEventListener('click', (e) => {
        this.handleVoiceRecordClick(e);
    });

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
        }
    });
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

async sendVoiceMessage() {
    if (!this.recordedChunks.length || !this.currentRoom) {
        this.showError('没有录音内容或未选择聊天室');
        return;
    }
    
    try {
        this.showLoading('发送语音中...');
        
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const duration = Date.now() - this.recordingStartTime;
        
        if (blob.size > 3 * 1024 * 1024) {
    this.showError('语音文件过大，请缩短录音时间');
    return;
}

// 生成文件名
const fn = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webm`;

// 上传到 chat-files 存储桶
const { error: uploadError } = await this.supabase.storage
    .from('chat-files')
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
}

async playVoiceMessage(url, voiceElement, duration) {
    if (!url) return;

    try {
        // 停止当前音频
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.resetVoiceWaveform(voiceElement);
        }

        // 创建新音频
        this.currentAudio = new Audio(url);
        this.currentAudio.volume = 0.8;

        // 等待音频加载完成再播放
        await new Promise((resolve, reject) => {
            this.currentAudio.addEventListener('canplaythrough', resolve, { once: true });
            this.currentAudio.addEventListener('error', reject, { once: true });
            setTimeout(() => reject(new Error('音频加载超时')), 5000); // 5秒超时
        });

        // 设置播放状态
        voiceElement.classList.add('playing');
        const waveBars = voiceElement.querySelectorAll('.wave-bar');

        this.voicePlayInterval = setInterval(() => {
            waveBars.forEach(bar => {
                bar.style.height = `${5 + Math.random() * 15}px`;
            });
        }, 200);

        // 播放结束清理
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

/* -------------------- 视频录制功能 -------------------- */
createVideoPreview() {
    this.hideVideoPreview();
    
    const previewHTML = `
        <div class="video-preview-overlay" id="videoPreview">
            <div class="video-preview-modal">
                <div class="video-preview-header">
                    <div class="video-preview-title">视频录制</div>
                    <button class="video-close-btn" id="closeVideoPreview">✕</button>
                </div>
                
                <div class="video-preview-content">
                    <video class="video-live" id="videoLive" autoplay muted playsinline></video>
                    
                    <div class="recording-indicator" id="recordingIndicator" style="display:none;">
                        <div class="recording-dot"></div>
                        <span>录制中</span>
                        <span class="recording-time" id="recordingTime">00:00</span>
                    </div>
                </div>
                
                <div class="video-preview-controls">
                    <button class="video-control-btn record-btn" id="startVideoRecord">
                        <span class="record-icon">📹</span>
                        <span>开始录制</span>
                    </button>
                    
                    <button class="video-control-btn stop-btn" id="stopVideoRecord" disabled>
                        <span class="stop-icon">🤚</span>
                        <span>停止录制</span>
                    </button>
                    
                    <button class="video-control-btn switch-btn" id="switchVideoCamera">
                        <span class="switch-icon">🔄</span>
                        <span>切换摄像头</span>
                    </button>
                </div>
                
                <div class="video-preview-info">
                    <p>• 最长录制时间: 2分钟</p>
                    <p>• 文件大小: 约5MB/分钟</p>
                    <p>• 格式: WebM (VP9 + Opus)</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', previewHTML);
    
    this.bindVideoPreviewEvents();
}

bindVideoPreviewEvents() {
    console.log('绑定视频预览事件');
    
    this.bindButton('closeVideoPreview', 'click', () => {
        this.hideVideoPreview();
    });
    
    this.bindButton('startVideoRecord', 'click', () => {
        this.startVideoRecording();
    });
    
    this.bindButton('stopVideoRecord', 'click', () => {
        this.stopVideoRecording();
    });
    
    this.bindButton('switchVideoCamera', 'click', () => {
        this.switchCamera();
    });
    
    const overlay = document.getElementById('videoPreview');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'videoPreview') {
                this.hideVideoPreview();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('videoPreview')) {
            this.hideVideoPreview();
        }
    });
}

async startVideoRecording() {
    try {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.showSystemMsg('正在录制中...', 'info');
            return;
        }
        
        // 获取视频流
        this.videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 1280, 
                height: 720,
                facingMode: this.currentFacingMode 
            }, 
            audio: true 
        });
        
        // 设置视频元素
        const videoElement = document.getElementById('videoLive');
        if (videoElement) {
            videoElement.srcObject = this.videoStream;
            videoElement.play().catch(e => console.error('视频播放失败:', e));
        }
        
        // 创建媒体录制器
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
        
        this.mediaRecorder.onstop = async () => {
            this.stopVideoTimer();
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            
            // 自动发送视频
            await this.sendVideo(blob);
            this.hideVideoPreview();
        };
        
        this.mediaRecorder.onerror = (event) => {
            console.error('录制错误:', event.error);
            this.showError('录制失败: ' + event.error);
        };
        
        // 开始录制
        this.mediaRecorder.start(1000);
        
        // 更新UI状态
        this.updateVideoRecordingUI(true);
        this.startVideoTimer();
        
        this.showSystemMsg('开始录制视频...', 'info');
        
    } catch (error) {
        console.error('视频录制失败:', error);
        this.showError('无法访问摄像头/麦克风: ' + error.message);
        this.hideVideoPreview();
    }
}

stopVideoRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        this.updateVideoRecordingUI(false);
        this.showSystemMsg('录制完成，正在上传...', 'info');
    }
}

updateVideoRecordingUI(isRecording) {
    const startBtn = document.getElementById('startVideoRecord');
    const stopBtn = document.getElementById('stopVideoRecord');
    const indicator = document.getElementById('recordingIndicator');
    
    if (startBtn) {
        startBtn.disabled = isRecording;
        startBtn.innerHTML = isRecording ? 
            '<span class="record-icon">●</span><span>录制中...</span>' : 
            '<span class="record-icon">●</span><span>开始录制</span>';
    }
    
    if (stopBtn) stopBtn.disabled = !isRecording;
    if (indicator) indicator.style.display = isRecording ? 'flex' : 'none';
}

startVideoTimer() {
    this.stopVideoTimer();
    
    this.videoTimer = setInterval(() => {
        if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return;
        
        const elapsed = Date.now() - this.recordingStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        const timeElement = document.getElementById('recordingTime');
        if (timeElement) {
            timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        
        // 2分钟自动停止
        if (elapsed >= 120000) {
            this.stopVideoRecording();
        }
    }, 1000);
}

stopVideoTimer() {
    if (this.videoTimer) {
        clearInterval(this.videoTimer);
        this.videoTimer = null;
    }
}

async sendVideo(blob) {
    if (!blob || blob.size === 0) {
        this.showError('视频数据为空');
        return;
    }
    
    if (!this.currentRoom) {
        this.showError('请先选择聊天室');
        return;
    }
    
    try {
        this.showLoading('上传视频中...');
        
        // 检查文件大小
        if (blob.size > 10 * 1024 * 1024) {
            this.showError('视频文件过大，请缩短录制时间');
            return;
        }
        
        // 生成文件名
        const fileName = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webm`;
        
        // 上传到文件存储桶
        const { error: uploadError } = await this.supabase.storage
            .from(this.fileBucket)
            .upload(fileName, blob, {
                contentType: 'video/webm',
                upsert: false
            });
        
        if (uploadError) throw uploadError;
        
        // 获取公开URL
        const { data: { publicUrl } } = this.supabase.storage
            .from(this.fileBucket)
            .getPublicUrl(fileName);
        
        // 计算视频时长
        const duration = Math.round((Date.now() - this.recordingStartTime) / 1000);
        
        // 发送视频消息
        const { error: messageError } = await this.supabase.from('chat_messages').insert({
            content: `[视频消息] ${duration}秒`,
            room_id: this.currentRoom.id,
            user_id: this.currentUser.userId,
            message_type: 'video',
            file_url: publicUrl,
            file_name: fileName,
            file_size: blob.size,
            video_duration: duration,
            direction: 1
        });
        
        if (messageError) throw messageError;
        
        this.hideLoading();
        this.showSuccess('视频发送成功！');
        
    } catch (error) {
        this.hideLoading();
        console.error('视频上传失败:', error);
        this.showError('视频上传失败: ' + error.message);
    }
}

toggleVideoRecording() {
    if (document.getElementById('videoPreview')) {
        this.hideVideoPreview();
    } else {
        this.showVideoPreview();
    }
}

showVideoPreview() {
    this.createVideoPreview();
}

hideVideoPreview() {
    const overlay = document.getElementById('videoPreview');
    if (overlay) {
        overlay.remove();
    }
    
    if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
        this.videoStream = null;
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
    }
    
    this.stopVideoTimer();
    this.updateVideoRecordingUI(false);
}

/* -------------------- 错误处理 -------------------- */
handleGlobalError(error) {
    if (!error) {
        console.warn('收到空错误对象');
        return;
    }
    
    console.error('应用程序错误:', error);
    this.showSystemMsg('应用程序错误，部分功能可能不可用', 'error');
}

/* -------------------- 响应式适配 -------------------- */
handleResize() {
    console.log('处理窗口大小变化');
    
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
    
    c.innerHTML = `<div class="welcome-message">
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

/* -------------------- 数据转换工具 -------------------- */
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
 * 全局初始化
 ****************************************************************************************/
const chatManager = new ChatManager();

// 全局函数
window.translateMessage = async (msgDiv) => {
    const bubble = msgDiv.querySelector('.message-bubble');
    const textEl = bubble.querySelector('.message-text');
    if (!textEl) return;
    
    const original = textEl.textContent.trim();
    if (!original) return;
    
    await appendTranslation(bubble, original);

};

// 全局暴露
window.chatManager = chatManager;

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
    // 添加窗口大小变化监听
    window.addEventListener('resize', () => {
        chatManager.handleResize();
    });
});

console.log('ChatManager v6.0 加载完成 - 功能：文字聊天、图片、文件、视频录制、语音消息、房主权限管理');