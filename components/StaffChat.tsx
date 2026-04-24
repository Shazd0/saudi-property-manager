import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageCircle, Send, Image, Mic, MicOff, Smile, Paperclip, ArrowLeft,
  Search, Plus, Users, Building, Phone, Video, MoreVertical, Check, CheckCheck,
  X, Reply, Trash2, Edit3, Download, Play, Pause, User as UserIcon, Hash,
  Eye, FileText, Share2, Star, Camera, ChevronDown, ArrowDown, Link2, CheckSquare, Square, Info,
  Pin, BellOff, Bell, Archive, Lock, Unlock, Clock, Layout, BarChart3, LogOut,
  Globe, UserPlus, UserMinus, Shield, Palette, Type, FileDown, MessageSquare,
  Zap, MapPin, Contact, Radio, Settings, Filter, SortAsc, Moon, Sun, Volume2, VolumeX,
  AlertTriangle, Ban, Copy, ExternalLink, Sparkles, Timer
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { User, UserRole } from '../types';
import {
  ChatRoom, ChatMessage, ChatSettings,
  listenChatRooms, listenMessages, sendMessage,
  getOrCreateDirectChat, createGroupChat, syncBuildingGroups,
  uploadChatFile, uploadVoiceMessage,
  deleteMessage, editMessage, toggleReaction, toggleStarMessage, markMessagesRead,
  setTyping, setPresence, listenAllPresence, showChatNotification,
  clearChat, togglePinChat, toggleMuteChat, toggleArchiveChat, toggleLockChat,
  addGroupMember, removeGroupMember, leaveGroup, updateGroupDescription, updateGroupName,
  setGroupAdmins, setDisappearingMessages, setChatWallpaper,
  exportChat, getChatStats, getMediaMessages,
  getChatSettings, saveChatSettings, defaultChatSettings,
  getMessageTemplates, saveMessageTemplates, defaultMessageTemplates,
  getBlockedUsers, toggleBlockUser,
  setUserStatus, listenStatuses, sendBroadcast, searchGifs,
  STICKER_PACKS, CHAT_WALLPAPERS
} from '../services/chatService';
import { getUsers, getBuildings } from '../services/firestoreService';

// ── Emoji Picker Data ──
const EMOJI_CATEGORIES: Record<string, string[]> = {
  '😊 Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  '👋 Hands': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦'],
  '❤️ Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💯','💢','💥','💫','💦','💨','🕳️','💬','👁️‍🗨️','🗨️','🗯️','💭','💤'],
  '🏢 Work': ['🏢','🏗️','🏠','🏡','🏘️','🏚️','','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🛝','🎡','🎢','💈','🎪','🚂','🚃','🚄','✈️','🚀'],
  '✅ Symbols': ['✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔘','🔲','🔳','⬛','⬜','◾','◽','▪️','▫️','🟥','🟧','🟨','🟩','🟦','🟪','⏰','🔔','🔕','📢','📣','💰','🔑','🔒','🔓','🛠️','⚙️','🔧','🔨','📌','📎','✂️','📝','📋','📁','📂','📄','📅'],
};

const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🙏'];

interface StaffChatProps {
  currentUser: User;
  fullScreen?: boolean;
  embedded?: boolean;
}

const StaffChat: React.FC<StaffChatProps> = ({ currentUser, fullScreen, embedded }) => {
  const { t, isRTL } = useLanguage();
  
  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allBuildings, setAllBuildings] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; lastSeen: any }>>({});
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: 'image' | 'file' } | null>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string; type: 'image' | 'file'; caption: string } | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showStarred, setShowStarred] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showMsgInfo, setShowMsgInfo] = useState<ChatMessage | null>(null);
  const [pendingVoice, setPendingVoice] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const prevMsgCountRef = useRef<Record<string, number>>({});
  const longPressTimerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── New Feature States ──
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(getChatSettings());
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastRoomIds, setBroadcastRoomIds] = useState<Set<string>>(new Set());
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showChatStats, setShowChatStats] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<{ url: string; preview: string }[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showStatusComposer, setShowStatusComposer] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [userStatuses, setUserStatuses] = useState<any[]>([]);
  const [showStatusList, setShowStatusList] = useState(false);
  const [showMentionSuggest, setShowMentionSuggest] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [showAddMember, setShowAddMember] = useState(false);
  const [chatLockPins, setChatLockPins] = useState<Record<string, string>>({});
  const [lockPinInput, setLockPinInput] = useState('');
  const [showLockPrompt, setShowLockPrompt] = useState<string | null>(null);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [imageGalleryIndex, setImageGalleryIndex] = useState(0);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const userId = currentUser.id || (currentUser as any).uid || 'unknown';
  const userName = currentUser.name || (currentUser as any).displayName || 'User';

  // Responsive
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Presence: set online + heartbeat ──
  useEffect(() => {
    // Set online on mount
    setPresence(userId, userName, true);
    // Heartbeat every 60s
    const heartbeat = setInterval(() => {
      setPresence(userId, userName, true);
    }, 60000);
    // Go offline on unmount / tab close
    const handleOffline = () => setPresence(userId, userName, false);
    window.addEventListener('beforeunload', handleOffline);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        setPresence(userId, userName, false);
      } else {
        setPresence(userId, userName, true);
      }
    });
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleOffline);
      setPresence(userId, userName, false);
    };
  }, [userId, userName]);

  // ── Listen to all users' presence ──
  useEffect(() => {
    const unsub = listenAllPresence((map) => {
      // Mark users with stale heartbeat (>2 min) as offline
      const now = Date.now();
      const resolved: Record<string, { online: boolean; lastSeen: any }> = {};
      Object.entries(map).forEach(([uid, p]) => {
        const lastSeenMs = p.lastSeen?.toMillis?.() || p.lastSeen?.seconds ? p.lastSeen.seconds * 1000 : 0;
        const isStale = lastSeenMs && (now - lastSeenMs > 2 * 60 * 1000);
        resolved[uid] = { online: p.online && !isStale, lastSeen: p.lastSeen };
      });
      setPresenceMap(resolved);
    });
    return () => unsub();
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen to user statuses
  useEffect(() => {
    const unsub = listenStatuses((statuses) => setUserStatuses(statuses));
    return () => unsub();
  }, []);

  // Load lock pins from localStorage
  useEffect(() => {
    try {
      const pins = JSON.parse(localStorage.getItem('amlak-chat-lock-pins') || '{}');
      setChatLockPins(pins);
    } catch {}
  }, []);

  // Load users and buildings
  useEffect(() => {
    const loadData = async () => {
      try {
        const [users, buildings] = await Promise.all([getUsers(), getBuildings()]);
        setAllUsers((users || []).filter((u: any) => u.id !== userId && u.status !== 'Inactive'));
        setAllBuildings(buildings || []);
        
        // Sync building groups for all staff
        syncBuildingGroups(
          (buildings || []).map((b: any) => ({ id: b.id, name: b.name })),
          (users || []).concat([{ id: userId, name: userName, buildingId: (currentUser as any).buildingId, buildingIds: (currentUser as any).buildingIds, role: currentUser.role }]).map((u: any) => ({ id: u.id, name: u.name, buildingId: u.buildingId, buildingIds: u.buildingIds, role: u.role }))
        ).catch(() => {});
      } catch (e) {
        console.error('Failed to load chat data:', e);
      }
    };
    loadData();
  }, []);

  // Listen to rooms + notify on new messages from others
  useEffect(() => {
    const unsub = listenChatRooms(userId, (roomsList) => {
      // Check for new incoming messages and fire notifications
      for (const room of roomsList) {
        if (room.lastMessageBy && room.lastMessageBy !== userId && room.lastMessageAt) {
          const lastMs = room.lastMessageAt?.toMillis?.() || (room.lastMessageAt?.seconds ? room.lastMessageAt.seconds * 1000 : 0);
          const prevMs = prevMsgCountRef.current[room.id] || 0;
          if (lastMs > prevMs) {
            // New message from someone else — show notification
            const senderName = room.memberNames?.[room.lastMessageBy] || 'Someone';
            const roomName = room.type === 'group' ? (room.name || 'Group') : '';
            const msgPreview = room.lastMessage || 'New message';
            // Only notify if the chat is not actively viewed and not muted
            if ((!selectedRoom || selectedRoom.id !== room.id || document.visibilityState === 'hidden') && !(room as any).muted?.includes(userId)) {
              showChatNotification(senderName, msgPreview, roomName);
            }
          }
          prevMsgCountRef.current[room.id] = lastMs;
        }
      }
      setRooms(roomsList);
    });
    return () => unsub();
  }, [userId, selectedRoom?.id]);

  // Listen to messages when room is selected
  useEffect(() => {
    if (!selectedRoom) { setMessages([]); return; }
    const unsub = listenMessages(selectedRoom.id, (msgs) => {
      setMessages(msgs);
      // Mark unread messages as read
      const unreadMsgs = msgs.filter(m => m.senderId !== userId && !(m.readBy || []).includes(userId));
      if (unreadMsgs.length > 0) {
        markMessagesRead(selectedRoom.id, userId, unreadMsgs.map(m => m.id)).catch(() => {});
      }
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    return () => unsub();
  }, [selectedRoom?.id, userId]);

  // ── Handlers ───────────────────────────────────────────

  const handleSendMessage = async () => {
    const text = editingMessage ? messageText.trim() : messageText.trim();
    if (!text || !selectedRoom) return;

    if (editingMessage) {
      await editMessage(selectedRoom.id, editingMessage.id, text);
      setEditingMessage(null);
      setMessageText('');
      return;
    }

    const msg: any = {
      roomId: selectedRoom.id,
      senderId: userId,
      senderName: userName,
      type: 'text',
      text,
      readBy: [userId],
    };
    if (replyingTo) {
      msg.replyTo = { id: replyingTo.id, text: replyingTo.text || '📎', senderName: replyingTo.senderName };
    }

    setMessageText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    
    // Clear typing
    setTyping(selectedRoom.id, userId, false);

    await sendMessage(selectedRoom.id, msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!selectedRoom) return;
    setTyping(selectedRoom.id, userId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(selectedRoom.id, userId, false);
    }, 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;
    
    // Stage file for preview instead of sending immediately
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl, type: 'image', caption: '' });
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;

    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl, type: 'file', caption: '' });
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleSendPendingFile = async () => {
    if (!pendingFile || !selectedRoom) return;
    const { file, type, caption } = pendingFile;
    try {
      const url = await uploadChatFile(selectedRoom.id, file, type === 'image' ? 'image' : 'file');
      await sendMessage(selectedRoom.id, {
        roomId: selectedRoom.id,
        senderId: userId,
        senderName: userName,
        type: type,
        text: caption || '',
        fileURL: url,
        fileName: file.name,
        fileSize: file.size,
        readBy: [userId],
      });
    } catch (err) {
      console.error('File upload failed:', err);
    }
    // Clean up
    URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const cancelPendingFile = () => {
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
    }
  };

  // ── Camera capture handler ──
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl, type: 'image', caption: '' });
    e.target.value = '';
    setShowAttachMenu(false);
  };

  // ── Touch gestures for mobile ──
  const handleTouchStart = (msg: ChatMessage, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    longPressTimerRef.current = setTimeout(() => {
      // Long press — show context menu
      setContextMenu({ msg, x: touch.clientX, y: touch.clientY });
      // Vibrate for haptic feedback
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };

  const handleTouchMove = (_msg: ChatMessage, e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    // Cancel long-press if finger moves
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = (_msg: ChatMessage) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    touchStartRef.current = null;
  };

  // ── Double-tap to react ──
  const lastTapRef = useRef<{ msgId: string; time: number } | null>(null);
  const handleDoubleTap = (msg: ChatMessage) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.msgId === msg.id && now - lastTapRef.current.time < 300) {
      // Double-tap detected — toggle ❤️ reaction
      if (selectedRoom) toggleReaction(selectedRoom.id, msg.id, '❤️', userId);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { msgId: msg.id, time: now };
    }
  };

  // ── Scroll detection for scroll-to-bottom button ──
  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const fromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBtn(fromBottom > 200);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Select multiple messages ──
  const toggleSelectMsg = (msgId: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedRoom) return;
    for (const msgId of selectedMsgIds) {
      await deleteMessage(selectedRoom.id, msgId);
    }
    setSelectedMsgIds(new Set());
    setSelectMode(false);
  };

  const handleBulkForward = () => {
    // Pick the first selected message to forward (or we can forward all)
    const firstId = [...selectedMsgIds][0];
    const msg = messages.find(m => m.id === firstId);
    if (msg) {
      setForwardingMsg(msg);
    }
    setSelectMode(false);
    setSelectedMsgIds(new Set());
  };

  // ── Voice preview before send ──
  const handleVoicePreview = (blob: Blob, duration: number) => {
    const url = URL.createObjectURL(blob);
    setPendingVoice({ blob, url, duration });
  };

  const handleSendPendingVoice = async () => {
    if (!pendingVoice || !selectedRoom) return;
    try {
      const { url, duration } = await uploadVoiceMessage(selectedRoom.id, pendingVoice.blob, pendingVoice.duration);
      await sendMessage(selectedRoom.id, {
        roomId: selectedRoom.id,
        senderId: userId,
        senderName: userName,
        type: 'voice',
        fileURL: url,
        duration,
        readBy: [userId],
      });
    } catch (err) {
      console.error('Voice upload failed:', err);
    }
    URL.revokeObjectURL(pendingVoice.url);
    setPendingVoice(null);
  };

  const cancelPendingVoice = () => {
    if (pendingVoice) {
      URL.revokeObjectURL(pendingVoice.url);
      setPendingVoice(null);
    }
  };

  const handleForwardMessage = async (targetRoom: ChatRoom) => {
    if (!forwardingMsg) return;
    const fwd: any = {
      roomId: targetRoom.id,
      senderId: userId,
      senderName: userName,
      type: forwardingMsg.type,
      readBy: [userId],
    };
    if (forwardingMsg.text) fwd.text = forwardingMsg.text;
    if (forwardingMsg.fileURL) fwd.fileURL = forwardingMsg.fileURL;
    if (forwardingMsg.fileName) fwd.fileName = forwardingMsg.fileName;
    if (forwardingMsg.fileSize) fwd.fileSize = forwardingMsg.fileSize;
    if (forwardingMsg.duration) fwd.duration = forwardingMsg.duration;
    // Add forwarded indicator
    fwd.forwarded = true;
    fwd.forwardedFrom = forwardingMsg.senderName;
    try {
      await sendMessage(targetRoom.id, fwd);
    } catch (err) {
      console.error('Forward failed:', err);
    }
    setForwardingMsg(null);
  };

  // ── New Feature Handlers ────────────────────────────────

  const updateChatSettings = (partial: Partial<ChatSettings>) => {
    const newSettings = { ...chatSettings, ...partial };
    setChatSettingsState(newSettings);
    saveChatSettings(partial);
  };

  // Clear chat handler
  const handleClearChat = async () => {
    if (!selectedRoom) return;
    if (!confirm('Clear all messages in this chat? This cannot be undone.')) return;
    await clearChat(selectedRoom.id, userId);
  };

  // Export chat handler
  const handleExportChat = () => {
    if (!selectedRoom) return;
    exportChat(messages, getRoomName(selectedRoom));
  };

  // Poll creation
  const handleCreatePoll = async () => {
    if (!selectedRoom || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    const cleanOptions = pollOptions.filter(o => o.trim()).map(o => o.trim());
    await sendMessage(selectedRoom.id, {
      roomId: selectedRoom.id, senderId: userId, senderName: userName,
      type: 'poll',
      poll: {
        question: pollQuestion.trim(),
        options: cleanOptions,
        votes: {},
      },
      readBy: [userId],
    });
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollCreator(false);
  };

  // Poll voting
  const handleVotePoll = async (msgId: string, optionIndex: number) => {
    if (!selectedRoom) return;
    try {
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const ref = doc(db, 'chatRooms', selectedRoom.id, 'messages', msgId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const poll = snap.data()?.poll;
      if (!poll) return;
      // Toggle vote: remove from all, then add to selected
      const options = [...poll.options];
      options.forEach((opt: any) => {
        opt.votes = (opt.votes || []).filter((id: string) => id !== userId);
      });
      if (options[optionIndex]) {
        if (!options[optionIndex].votes) options[optionIndex].votes = [];
        options[optionIndex].votes.push(userId);
      }
      await updateDoc(ref, { poll: { ...poll, options } });
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  // Location sharing
  const handleShareLocation = async () => {
    if (!selectedRoom || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await sendMessage(selectedRoom.id, {
        roomId: selectedRoom.id, senderId: userId, senderName: userName,
        type: 'location',
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        text: `📍 Location: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        readBy: [userId],
      });
    }, () => alert('Location access denied'));
  };

  // Contact sharing - pick from allUsers
  const handleShareContact = async (user?: any) => {
    if (!selectedRoom) return;
    if (!user) { setShowContactPicker(true); setShowAttachMenu(false); return; }
    await sendMessage(selectedRoom.id, {
      roomId: selectedRoom.id, senderId: userId, senderName: userName,
      type: 'contact',
      contact: { name: user.name, role: user.role, id: user.id },
      text: `👤 ${user.name}`,
      readBy: [userId],
    });
    setShowContactPicker(false);
  };

  // Status posting
  const handlePostStatus = async () => {
    if (!statusText.trim()) return;
    await setUserStatus(userId, userName, statusText.trim());
    setStatusText('');
    setShowStatusComposer(false);
  };

  // GIF search
  const handleGifSearch = async (q: string) => {
    setGifSearch(q);
    if (q.trim().length < 2) { setGifResults([]); return; }
    const results = await searchGifs(q);
    setGifResults(results);
  };

  // Send GIF
  const handleSendGif = async (gifUrl: string) => {
    if (!selectedRoom) return;
    await sendMessage(selectedRoom.id, {
      roomId: selectedRoom.id, senderId: userId, senderName: userName,
      type: 'gif', fileURL: gifUrl, text: 'GIF', readBy: [userId],
    });
    setShowGifPicker(false);
  };

  // Send sticker (now sends image URL)
  const handleSendSticker = async (stickerUrl: string, emoji: string) => {
    if (!selectedRoom) return;
    await sendMessage(selectedRoom.id, {
      roomId: selectedRoom.id, senderId: userId, senderName: userName,
      type: 'sticker', text: emoji, fileURL: stickerUrl, readBy: [userId],
    });
    setShowStickerPicker(false);
  };

  // Broadcast send
  const handleBroadcast = async (broadcastText: string, roomIds: Set<string>) => {
    if (!broadcastText.trim() || roomIds.size === 0) return;
    await sendBroadcast([...roomIds], {
      roomId: '', senderId: userId, senderName: userName,
      type: 'text', text: broadcastText.trim(), readBy: [userId],
    });
    setBroadcastRoomIds(new Set());
    setShowBroadcast(false);
  };

  // Mention handler
  const handleMentionInsert = (name: string) => {
    // Replace the @filter part with the mention
    const text = messageText.replace(/@[\w]*$/, `@${name} `);
    setMessageText(text);
    setShowMentionSuggest(false);
    setMentionFilter('');
  };

  // Check for @mentions while typing
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessageText(val);
    handleTyping();
    // Detect @mention
    const match = val.match(/@(\w*)$/);
    if (match && selectedRoom?.type === 'group') {
      setMentionFilter(match[1]);
      setShowMentionSuggest(true);
    } else {
      setShowMentionSuggest(false);
    }
  };

  // Chat lock
  const handleSetLockPin = (roomId: string, pin: string) => {
    const pins = { ...chatLockPins, [roomId]: pin };
    setChatLockPins(pins);
    localStorage.setItem('amlak-chat-lock-pins', JSON.stringify(pins));
    toggleLockChat(roomId, userId);
  };

  const handleUnlockChat = (roomId: string, pin: string) => {
    if (chatLockPins[roomId] === pin) {
      setShowLockPrompt(null);
      setLockPinInput('');
      setSelectedRoom(rooms.find(r => r.id === roomId) || null);
    } else {
      alert('Wrong PIN!');
    }
  };

  // Voice playback speed
  const cycleVoiceSpeed = () => {
    const speeds = [1, 1.5, 2, 0.5];
    const idx = speeds.indexOf(voiceSpeed);
    setVoiceSpeed(speeds[(idx + 1) % speeds.length]);
  };

  // ── Voice Recording ────────────────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0 && selectedRoom) {
          // Show voice preview instead of sending directly
          handleVoicePreview(blob, recordingTime);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert(t('chat.micDenied') || 'Microphone access denied. Please allow microphone access in browser settings.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // ── Voice Playback ─────────────────────────────────────

  const playVoice = (url: string, msgId: string) => {
    if (playingVoice === msgId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.playbackRate = voiceSpeed;
    audioRef.current = audio;
    setPlayingVoice(msgId);
    audio.play();
    audio.onended = () => setPlayingVoice(null);
  };

  // ── Start Direct Chat ──────────────────────────────────

  const startDirectChat = async (otherUser: any) => {
    const roomId = await getOrCreateDirectChat(userId, userName, otherUser.id, otherUser.name);
    const room: ChatRoom = {
      id: roomId,
      type: 'direct',
      members: [userId, otherUser.id],
      memberNames: { [userId]: userName, [otherUser.id]: otherUser.name },
      createdAt: Date.now(),
      createdBy: userId,
    };
    setSelectedRoom(room);
    setShowNewChat(false);
    setSearchQuery('');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    const memberNames: Record<string, string> = { [userId]: userName };
    const memberIds = [userId, ...selectedMembers];
    selectedMembers.forEach(mid => {
      const u = allUsers.find((u: any) => u.id === mid);
      if (u) memberNames[mid] = u.name;
    });
    
    const roomId = await createGroupChat(groupName.trim(), memberIds, memberNames, userId);
    setSelectedRoom({
      id: roomId,
      type: 'group',
      name: groupName.trim(),
      members: memberIds,
      memberNames,
      createdAt: Date.now(),
      createdBy: userId,
    });
    setShowNewGroup(false);
    setGroupName('');
    setSelectedMembers([]);
  };

  // ── Helpers ────────────────────────────────────────────

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp?.seconds ? timestamp.seconds * 1000 : timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp?.seconds ? timestamp.seconds * 1000 : timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) return t('common.today') || 'Today';
    if (d.toDateString() === yesterday.toDateString()) return t('common.yesterday') || 'Yesterday';
    return d.toLocaleDateString();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRoomName = (room: ChatRoom) => {
    if (room.type === 'group') return room.name || 'Group';
    // Direct: show other person's name
    const otherId = room.members.find(m => m !== userId);
    return room.memberNames?.[otherId || ''] || 'Chat';
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.type === 'group') {
      return room.buildingId ? '🏢' : '👥';
    }
    const otherId = room.members.find(m => m !== userId);
    const name = room.memberNames?.[otherId || ''] || '?';
    return name.charAt(0).toUpperCase();
  };

  const isUserOnline = (uid: string) => !!presenceMap[uid]?.online;

  const getLastSeen = (uid: string) => {
    const p = presenceMap[uid];
    if (!p || !p.lastSeen) return t('chat.offline') || 'Offline';
    if (p.online) return t('chat.online') || 'Online';
    const d = p.lastSeen?.toDate ? p.lastSeen.toDate() : new Date(p.lastSeen?.seconds ? p.lastSeen.seconds * 1000 : 0);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t('chat.justNow') || 'Last seen just now';
    if (diffMin < 60) return `${t('chat.lastSeen') || 'Last seen'} ${diffMin}m ${t('chat.ago') || 'ago'}`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${t('chat.lastSeen') || 'Last seen'} ${diffHrs}h ${t('chat.ago') || 'ago'}`;
    return `${t('chat.lastSeen') || 'Last seen'} ${d.toLocaleDateString()}`;
  };

  const getDirectChatStatus = (room: ChatRoom) => {
    const otherId = room.members.find(m => m !== userId);
    if (!otherId) return t('chat.offline') || 'Offline';
    return getLastSeen(otherId);
  };

  const getTypingUsers = (room: ChatRoom) => {
    if (!room.typing) return [];
    return Object.entries(room.typing)
      .filter(([uid, typing]) => typing && uid !== userId)
      .map(([uid]) => room.memberNames?.[uid] || uid);
  };

  // ── Link Detection ──
  const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/gi;
  
  const renderTextWithLinks = (text: string, isOwn: boolean) => {
    const parts = text.split(URL_REGEX);
    return parts.map((part, i) => {
      if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0; // reset regex state
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all ${isOwn ? 'text-sky-200 hover:text-sky-100' : 'text-blue-600 hover:text-blue-800'}`}
            onClick={e => e.stopPropagation()}
          >
            {part.length > 40 ? part.slice(0, 37) + '...' : part}
          </a>
        );
      }
      URL_REGEX.lastIndex = 0;
      return <span key={i}>{part}</span>;
    });
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '___NONE___';
    for (const msg of messages) {
      const date = formatDate(msg.createdAt) || 'Today';
      if (date !== currentDate || groups.length === 0) {
        currentDate = date;
        groups.push({ date, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }, [messages]);

  // Filter rooms by search + settings
  const filteredRooms = useMemo(() => {
    let result = rooms;
    // Apply chat filter
    const filter = chatSettings.chatFilter;
    if (filter === 'unread') result = result.filter(r => ((r as any).unreadCounts?.[userId] || 0) > 0);
    else if (filter === 'groups') result = result.filter(r => r.type === 'group');
    else if (filter === 'direct') result = result.filter(r => r.type === 'direct');
    // Hide archived
    result = result.filter(r => !(r as any).archived?.includes(userId));
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => getRoomName(r).toLowerCase().includes(q));
    }
    // Sort
    if (chatSettings.sortBy === 'name') {
      result = [...result].sort((a, b) => getRoomName(a).localeCompare(getRoomName(b)));
    } else if (chatSettings.sortBy === 'unread') {
      result = [...result].sort((a, b) => ((b as any).unreadCounts?.[userId] || 0) - ((a as any).unreadCounts?.[userId] || 0));
    }
    // Pin to top
    const pinned = result.filter(r => (r as any).pinned?.includes(userId));
    const unpinned = result.filter(r => !(r as any).pinned?.includes(userId));
    return [...pinned, ...unpinned];
  }, [rooms, searchQuery, chatSettings.chatFilter, chatSettings.sortBy, userId]);

  // Filtered messages by search within chat
  const searchFilteredMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return null;
    const q = chatSearchQuery.toLowerCase();
    return messages.filter(m => 
      m.text?.toLowerCase().includes(q) ||
      m.fileName?.toLowerCase().includes(q) ||
      m.senderName?.toLowerCase().includes(q)
    );
  }, [messages, chatSearchQuery]);

  // Starred messages
  const starredMessages = useMemo(() => {
    return messages.filter(m => (m as any).starredBy?.includes(userId));
  }, [messages, userId]);

  // ── Render: Chat List ──────────────────────────────────

  const renderChatList = () => (
    <div className={`flex flex-col h-full bg-white ${isMobileView && selectedRoom ? 'hidden' : ''}`}
         style={{ width: isMobileView ? '100%' : '380px', minWidth: isMobileView ? '100%' : '380px' }}>
      {/* Stunning Header */}
      <div className="px-4 py-3.5 flex items-center justify-between flex-shrink-0 shadow-lg chat-header-shine" style={{ background: 'linear-gradient(135deg, #075E54 0%, #128C7E 30%, #00A884 70%, #25D366 100%)', backgroundSize: '200% 200%' }}>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <MessageCircle size={18} className="text-white" />
          </div>
          <h2 className="text-[20px] font-extrabold text-white tracking-tight drop-shadow-sm">{t('chat.title') || 'Amlak Chat'}</h2>
        </div>
        <div className="flex items-center gap-0.5">
          {!isMobileView && <button onClick={() => setShowStatusComposer(true)} className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl text-white/85 transition-all duration-200 hover:text-white hover:scale-105"><Radio size={20} /></button>}
          {!isMobileView && <button onClick={() => setShowBroadcast(true)} className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl text-white/85 transition-all duration-200 hover:text-white hover:scale-105"><Zap size={20} /></button>}
          <button onClick={() => setShowNewChat(true)} className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl text-white/85 transition-all duration-200 hover:text-white hover:scale-105"><MessageCircle size={20} /></button>
          <button onClick={() => setShowSettingsPanel(true)} className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl text-white/85 transition-all duration-200 hover:text-white hover:scale-105"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Premium Search Bar */}
      <div className="px-3 py-2.5 flex-shrink-0 bg-gradient-to-b from-[#F0F2F5] to-white">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8696A0]" />
          <input type="text" placeholder={t('chat.searchChats') || 'Search or start new chat'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white text-[#111B21] placeholder-[#8696A0] rounded-2xl text-[15px] outline-none border border-[#E9EDEF]/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus:shadow-[0_2px_16px_rgba(37,211,102,0.12)] focus:border-[#25D366]/30 transition-all duration-300" />
        </div>
      </div>

      {/* Premium Filter Tabs */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto flex-shrink-0 bg-white border-b border-[#E9EDEF]/50" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {(['all', 'unread', 'groups', 'direct'] as const).map(f => (
          <button key={f} onClick={() => updateChatSettings({ chatFilter: f })}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold flex-shrink-0 active:scale-95 transition-all duration-300 ${
              chatSettings.chatFilter === f
                ? 'text-white shadow-md bg-gradient-to-r from-[#25D366] to-[#00A884]'
                : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF] hover:text-[#111B21]'
            }`} style={chatSettings.chatFilter === f ? { boxShadow: '0 2px 12px rgba(37,211,102,0.3)' } : {}}>
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : f === 'groups' ? 'Groups' : 'Direct'}
          </button>
        ))}
      </div>

      {/* Premium Status Strip */}
      {userStatuses.length > 0 && (
        <div className="flex gap-3 px-3 py-2.5 bg-white border-b border-[#E9EDEF]/40 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <button onClick={() => setShowStatusComposer(true)} className="flex flex-col items-center flex-shrink-0 active:scale-95 transition-transform">
            <div className="h-12 w-12 rounded-full bg-[#F0F2F5] flex items-center justify-center" style={{ border: '2px dashed #25D366' }}>
              <Plus size={18} className="text-[#25D366]" />
            </div>
            <span className="text-[10px] text-[#667781] mt-1 font-medium">{t('chat.you')}</span>
          </button>
          {userStatuses.filter(s => s.userId !== userId).slice(0, 10).map(s => (
            <button key={s.id} onClick={() => setShowStatusList(true)} className="flex flex-col items-center flex-shrink-0 active:scale-95 transition-transform">
              <div className="h-12 w-12 rounded-full p-[2.5px]" style={{ background: 'linear-gradient(135deg, #25D366, #00A884, #128C7E)' }}>
                <div className="w-full h-full rounded-full flex items-center justify-center text-white text-sm font-semibold bg-white">
                  <span className="h-full w-full rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #25D366, #00A884)' }}>
                    {(s.userName || '?').charAt(0)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-[#667781] mt-1 truncate max-w-[52px] font-medium">{s.userName?.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Room List */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', scrollbarColor: 'rgba(0,168,132,0.08) transparent' }}>
        {filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#667781] chat-fade-in">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5 chat-float" style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.08), rgba(0,168,132,0.12))', boxShadow: '0 8px 32px rgba(37,211,102,0.08)' }}>
              <MessageCircle size={38} className="text-[#25D366]" strokeWidth={1.5} />
            </div>
            <p className="text-[16px] font-semibold text-[#111B21]">{t('chat.noChats') || 'No chats yet'}</p>
            <p className="text-[13px] mt-1.5 text-[#8696A0] max-w-[240px] text-center">{t('chat.startConversation') || 'Start a new conversation'}</p>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const typingUsers = getTypingUsers(room);
            const isActive = selectedRoom?.id === room.id;
            const isPinned = (room as any).pinned?.includes(userId);
            const isMuted = (room as any).muted?.includes(userId);
            const isLocked = (room as any).locked?.includes(userId);
            const unreadCount = (room as any).unreadCounts?.[userId] || 0;
            return (
              <button
                key={room.id}
                onClick={() => {
                  if (isLocked && chatLockPins[room.id]) { setShowLockPrompt(room.id); return; }
                  setSelectedRoom(room);
                }}
                onContextMenu={(e) => { e.preventDefault(); setSelectedRoom(room); setShowRoomMenu(true); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-200 relative ${
                  isActive ? 'bg-gradient-to-r from-[#25D366]/8 to-transparent' : 'bg-white hover:bg-[#F8F9FA] active:bg-[#F0F2F5]'
                }`}
                style={isActive ? { borderLeft: '3px solid #25D366' } : {}}
              >
                {/* Premium Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`h-[52px] w-[52px] rounded-full flex items-center justify-center text-lg font-semibold ring-2 ring-offset-2 transition-all duration-300 ${
                    room.type === 'group' 
                      ? 'ring-[#25D366]/20 ring-offset-white' 
                      : 'ring-[#DFE5E7]/30 ring-offset-white'
                  }`} style={{
                    background: room.type === 'group' 
                      ? 'linear-gradient(135deg, #25D366 0%, #128C7E 50%, #00A884 100%)' 
                      : 'linear-gradient(135deg, #E8EDF2 0%, #D1D8DE 100%)',
                    boxShadow: room.type === 'group' ? '0 3px 12px rgba(37,211,102,0.2)' : '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    {isLocked ? <Lock size={20} className="text-white" /> : (
                      room.type === 'group' ? (
                        <Users size={22} className="text-white" />
                      ) : (
                        <span className="text-[#54656F] text-[20px] font-semibold">{getRoomAvatar(room)}</span>
                      )
                    )}
                  </div>
                  {room.type === 'direct' && (() => {
                    const otherId = room.members.find(m => m !== userId);
                    const online = otherId ? isUserOnline(otherId) : false;
                    return online ? <div className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 bg-[#25D366] border-[2.5px] border-white rounded-full chat-online-dot" style={{ boxShadow: '0 0 0 0 rgba(37,211,102,0.4)' }} /> : null;
                  })()}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 border-b border-[#E9EDEF] pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <h3 className="text-[16px] font-medium truncate text-[#111B21]">{getRoomName(room)}</h3>
                      {isPinned && <Pin size={12} className="text-[#8696A0] flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />}
                      {isMuted && <BellOff size={12} className="text-[#8696A0] flex-shrink-0" />}
                    </div>
                    <span className={`text-[12px] flex-shrink-0 ml-2 ${unreadCount > 0 ? 'text-[#25D366] font-semibold' : 'text-[#667781]'}`}>
                      {formatTime(room.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex-1 min-w-0">
                      {typingUsers.length > 0 ? (
                        <p className="text-[13.5px] text-[#25D366] truncate font-medium">
                          {typingUsers.join(', ')} {t('chat.typing') || 'typing...'}
                        </p>
                      ) : (
                        <p className="text-[13.5px] text-[#667781] truncate">
                          {room.lastMessage || (t('chat.noMessages') || 'No messages yet')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {room.type === 'group' && room.buildingId && <Building size={14} className="text-[#8696A0]" />}
                      {unreadCount > 0 && (
                        <span className="min-w-[22px] h-[22px] px-1.5 text-white text-[11px] font-bold rounded-full flex items-center justify-center chat-unread-badge" style={{ background: 'linear-gradient(135deg, #25D366, #00A884)', boxShadow: '0 2px 8px rgba(37,211,102,0.35)' }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Premium FAB - New Chat */}
      {!selectedRoom && isMobileView && (
        <button onClick={() => setShowNewChat(true)}
          className="absolute bottom-6 right-5 h-[58px] w-[58px] rounded-2xl flex items-center justify-center text-white z-20 active:scale-90 transition-all duration-300 chat-fab"
          style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 50%, #00A884 100%)', boxShadow: '0 6px 24px rgba(37,211,102,0.4), 0 2px 8px rgba(0,0,0,0.1)' }}>
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );

  // ── Render: Message Bubble ─────────────────────────────

  const renderMessage = (msg: ChatMessage) => {
    const isOwn = msg.senderId === userId;
    const isSystem = msg.type === 'system';

    if (msg.deleted) {
      return (
        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 px-[4%]`}>
          <div className="rounded-lg px-3 py-1.5 max-w-[85%] opacity-60" style={{ backgroundColor: '#F5F5F0' }}>
            <p className="text-[13px] text-[#8696A0] italic flex items-center gap-1">🚫 {t('chat.messageDeleted') || 'This message was deleted'}</p>
          </div>
        </div>
      );
    }

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center mb-2 px-4">
          <span className="text-[12px] text-[#54656F] px-3 py-1 rounded-lg shadow-sm" style={{ backgroundColor: '#E2F7CB' }}>{msg.text}</span>
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        id={`msg-${msg.id}`}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-[2px] px-[4%] group`}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ msg, x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => handleTouchStart(msg, e)}
        onTouchMove={(e) => handleTouchMove(msg, e)}
        onTouchEnd={() => handleTouchEnd(msg)}
        onClick={() => {
          if (selectMode) { toggleSelectMsg(msg.id); return; }
          handleDoubleTap(msg);
        }}
      >
        {/* Select checkbox */}
        {selectMode && (
          <div className={`flex items-center mr-2 ${isOwn ? 'order-1' : 'order-0'}`}>
            {selectedMsgIds.has(msg.id) 
              ? <CheckSquare size={20} className="text-[#00A884]" />
              : <Square size={20} className="text-[#8696A0]" />}
          </div>
        )}
        <div className={`max-w-[85%] sm:max-w-[65%] ${isOwn ? 'order-2' : 'order-1'}`}>
          {/* Sender name in group */}
          {!isOwn && selectedRoom?.type === 'group' && (
            <p className="text-[12.5px] font-medium mb-0.5 px-1" style={{ color: '#06CF9C' }}>{msg.senderName}</p>
          )}
          
          <div className={`relative ${
            isOwn 
              ? 'rounded-[20px] rounded-tr-[6px] text-[#111B21]' 
              : 'rounded-[20px] rounded-tl-[6px] text-[#111B21]'
          }`} style={{ 
            background: isOwn ? 'linear-gradient(135deg, #D9FDD3 0%, #C8F4BE 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #FBFEFB 100%)',
            padding: '7px 9px 8px 10px',
            boxShadow: isOwn ? '0 1px 4px rgba(37,211,102,0.08), 0 1px 2px rgba(0,0,0,0.04)' : '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
          }}>
            {/* Forwarded label */}
            {(msg as any).forwarded && (
              <div className="flex items-center gap-1 mb-1 text-[11px] italic text-[#8696A0]">
                <Share2 size={10} />
                <span>Forwarded{(msg as any).forwardedFrom ? ` from ${(msg as any).forwardedFrom}` : ''}</span>
              </div>
            )}

            {/* Reply preview */}
            {msg.replyTo && (
              <div className="mb-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border-l-[3px]" style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.35)' : 'rgba(37,211,102,0.06)', borderColor: '#25D366' }}>
                <span className="font-semibold" style={{ color: '#25D366' }}>{msg.replyTo.senderName}</span>
                <p className="truncate text-[#667781]">{msg.replyTo.text}</p>
              </div>
            )}

            {/* Content based on type */}
            {msg.type === 'text' && (
              <p className={`whitespace-pre-wrap break-words leading-[20px] text-[#111B21] ${chatSettings.fontSize === 'small' ? 'text-[13px]' : chatSettings.fontSize === 'large' ? 'text-[16px]' : 'text-[14.2px]'}`}>{renderTextWithLinks(msg.text || '', isOwn)}</p>
            )}

            {msg.type === 'image' && (
              <div className="mb-1 -mx-1 -mt-0.5">
                <img
                  src={msg.fileURL}
                  alt={msg.fileName || 'Image'}
                  className="rounded-lg max-w-full max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    if (!msg.fileURL) return;
                    const allImages = messages.filter(m => m.type === 'image' && m.fileURL);
                    const idx = allImages.findIndex(m => m.id === msg.id);
                    setImageGalleryIndex(idx >= 0 ? idx : 0);
                    setPreviewFile({ url: msg.fileURL, name: msg.fileName || 'Image', type: 'image' });
                  }}
                />
                {msg.text && <p className="text-[13px] mt-1 text-[#111B21]">{msg.text}</p>}
              </div>
            )}

            {msg.type === 'voice' && (
              <div className="flex items-center gap-3 min-w-[220px] py-1.5">
                <button
                  onClick={() => msg.fileURL && playVoice(msg.fileURL, msg.id)}
                  className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 active:scale-90 ${
                    isOwn ? 'bg-white/40 hover:bg-white/55' : 'bg-[#25D366]/15 hover:bg-[#25D366]/25'
                  } ${playingVoice === msg.id ? 'chat-pulse-glow' : ''}`}
                  style={playingVoice === msg.id ? { boxShadow: '0 0 0 0 rgba(37,211,102,0.4)' } : {}}
                >
                  {playingVoice === msg.id ? <Pause size={17} className={isOwn ? 'text-[#111B21]' : 'text-[#25D366]'} /> : <Play size={17} className={isOwn ? 'text-[#111B21]' : 'text-[#25D366]'} />}
                </button>
                <div className="flex-1 flex items-end gap-[2px] h-7">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-[3px] rounded-full transition-all duration-300 ${playingVoice === msg.id ? 'chat-wave-bar' : ''}`}
                      style={{
                        height: playingVoice === msg.id ? undefined : `${Math.sin(i * 0.7) * 8 + 5}px`,
                        background: isOwn 
                          ? `rgba(17,27,33,${0.2 + Math.sin(i * 0.5) * 0.15})` 
                          : `rgba(37,211,102,${0.3 + Math.sin(i * 0.5) * 0.2})`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
                <span className={`text-[10px] font-mono font-bold ${isOwn ? 'text-[#111B21]/50' : 'text-[#667781]'}`}>
                  {formatDuration(msg.duration || 0)}
                </span>
                {playingVoice === msg.id && (
                  <button onClick={(e) => { e.stopPropagation(); cycleVoiceSpeed(); }}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isOwn ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                    {voiceSpeed}x
                  </button>
                )}
              </div>
            )}

            {msg.type === 'file' && (
              <button
                onClick={() => msg.fileURL && setPreviewFile({ url: msg.fileURL, name: msg.fileName || 'File', type: 'file' })}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 w-full text-left ${isOwn ? 'text-[#111B21] hover:bg-white/15 active:bg-white/25' : 'text-[#111B21] hover:bg-emerald-50 active:bg-emerald-100'}`}
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/25' : 'bg-emerald-100'}`}>
                  <FileText size={20} className={isOwn ? '' : 'text-emerald-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{msg.fileName || 'File'}</p>
                  <div className="flex items-center gap-2">
                    {msg.fileSize && <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>{formatFileSize(msg.fileSize)}</p>}
                    <span className={`text-[10px] flex items-center gap-0.5 ${isOwn ? 'text-white/60' : 'text-emerald-500'}`}>
                      <Eye size={10} /> Preview
                    </span>
                  </div>
                </div>
              </button>
            )}

            {/* Poll */}
            {msg.type === 'poll' && (msg as any).poll && (
              <div className="space-y-2 min-w-[200px]">
                <p className={`text-sm font-bold flex items-center gap-1 ${isOwn ? 'text-white' : 'text-slate-800'}`}>
                  <BarChart3 size={14} /> {(msg as any).poll.question}
                </p>
                {(msg as any).poll.options.map((opt: any, i: number) => {
                  const totalVotes = (msg as any).poll.options.reduce((s: number, o: any) => s + (o.votes?.length || 0), 0);
                  const pct = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
                  const voted = opt.votes?.includes(userId);
                  return (
                    <button key={i} onClick={() => selectedRoom && handleVotePoll(msg.id, i)}
                      className={`w-full text-left rounded-xl px-3 py-2 text-sm transition-all relative overflow-hidden ${
                        isOwn ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                      } ${voted ? (isOwn ? 'ring-2 ring-white/40' : 'ring-2 ring-emerald-400') : ''}`}>
                      <div className={`absolute left-0 top-0 bottom-0 transition-all ${isOwn ? 'bg-white/10' : 'bg-emerald-100'}`} style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between">
                        <span>{opt.text}</span>
                        <span className={`text-xs font-bold ${isOwn ? 'text-white/70' : 'text-slate-500'}`}>{pct}%</span>
                      </div>
                    </button>
                  );
                })}
                <p className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-slate-400'}`}>
                  {(msg as any).poll.options.reduce((s: number, o: any) => s + (o.votes?.length || 0), 0)} votes
                </p>
              </div>
            )}

            {/* Location */}
            {msg.type === 'location' && (msg as any).location && (
              <a href={`https://www.google.com/maps?q=${(msg as any).location.lat},${(msg as any).location.lng}`}
                target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-3 p-2 rounded-xl transition-all ${isOwn ? 'text-white hover:bg-white/10' : 'text-emerald-700 hover:bg-emerald-50'}`}
                onClick={e => e.stopPropagation()}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isOwn ? 'bg-white/20' : 'bg-red-100'}`}>
                  <MapPin size={18} className={isOwn ? '' : 'text-red-500'} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Location Shared</p>
                  <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>
                    {(msg as any).location.lat.toFixed(4)}, {(msg as any).location.lng.toFixed(4)}
                  </p>
                </div>
              </a>
            )}

            {/* Contact */}
            {msg.type === 'contact' && (msg as any).contact && (
              <div className={`flex items-center gap-3 p-2 rounded-xl ${isOwn ? 'text-white' : 'text-slate-700'}`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isOwn ? 'bg-white/20' : 'bg-teal-100'}`}>
                  <Contact size={18} className={isOwn ? '' : 'text-teal-600'} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{(msg as any).contact.name}</p>
                  {(msg as any).contact.phone && <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>{(msg as any).contact.phone}</p>}
                </div>
              </div>
            )}

            {/* GIF */}
            {msg.type === 'gif' && msg.fileURL && (
              <div className="mb-1 -mx-1 -mt-0.5">
                <img src={msg.fileURL} alt="GIF" className="rounded-xl max-w-full max-h-48 cursor-pointer hover:opacity-90 transition-all" />
              </div>
            )}

            {/* Sticker */}
            {msg.type === 'sticker' && (
              <div className="text-center py-1">
                {msg.fileURL ? (
                  <img src={msg.fileURL} alt={msg.text || 'Sticker'} className="w-28 h-28 object-contain mx-auto" />
                ) : (
                  <span className="text-5xl">{msg.text}</span>
                )}
              </div>
            )}

            {/* Time & read status - WhatsApp style */}
            <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
              {(msg as any).starredBy?.includes(userId) && <Star size={9} className="fill-[#FFD700] text-[#FFD700]" />}
              {msg.editedAt && <span className="text-[11px] italic text-[#667781]">{t('chat.edited') || 'edited'}</span>}
              <span className="text-[11px] text-[#667781]">{formatTime(msg.createdAt)}</span>
              {isOwn && (
                <span className="ml-0.5">
                  {(msg.readBy || []).filter(id => id !== userId).length > 0 
                    ? <CheckCheck size={16} className="text-[#53BDEB]" /> 
                    : <Check size={16} className="text-[#8696A0]" />}
                </span>
              )}
            </div>
          </div>

          {/* Reactions */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-0.5 -mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(selectedRoom!.id, msg.id, emoji, userId)}
                  className={`text-xs px-1.5 py-0.5 rounded-full border shadow-sm transition-all ${
                    (userIds as string[]).includes(userId)
                      ? 'bg-[#E7FFDB] border-[#25D366]'
                      : 'bg-white border-[#E9EDEF]'
                  }`}
                >
                  {emoji} {(userIds as string[]).length}
                </button>
              ))}
            </div>
          )}

          {/* Quick reactions on hover (WhatsApp dropdown arrow style) */}
          <div className={`hidden group-hover:flex items-center gap-0.5 mt-0.5 bg-white rounded-full shadow-md border border-[#E9EDEF] px-0.5 py-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => selectedRoom && toggleReaction(selectedRoom.id, msg.id, emoji, userId)}
                className="text-sm p-1 rounded-full hover:bg-[#F0F2F5] transition-colors"
              >
                {emoji}
              </button>
            ))}
            <button onClick={() => setReplyingTo(msg)} className="p-1.5 hover:bg-[#F0F2F5] rounded-full">
              <Reply size={12} className="text-[#8696A0]" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Chat View ──────────────────────────────────

  const renderChatView = () => {
    if (!selectedRoom) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-[#667781] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F0F2F5 0%, #E8ECF0 30%, #EFEAE2 60%, #F5F3EF 100%)' }}>
          {/* Decorative background circles */}
          <div className="absolute top-20 -left-20 w-64 h-64 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #25D366, transparent)' }} />
          <div className="absolute bottom-10 -right-16 w-48 h-48 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #128C7E, transparent)' }} />
          <div className="flex flex-col items-center max-w-[560px] text-center px-8 chat-fade-in">
            <div className="relative mb-10">
              <div className="w-36 h-36 rounded-full flex items-center justify-center chat-float" style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.08), rgba(0,168,132,0.12))', boxShadow: '0 8px 40px rgba(37,211,102,0.1)' }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(0,168,132,0.2))' }}>
                  <MessageCircle size={44} className="text-[#25D366]" strokeWidth={1.5} />
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #25D366, #00A884)', boxShadow: '0 2px 12px rgba(37,211,102,0.3)' }}>
                <Sparkles size={14} className="text-white" />
              </div>
            </div>
            <h3 className="text-[26px] font-bold text-[#111B21] mb-2 tracking-tight">{t('chat.title') || 'Amlak Chat'}</h3>
            <p className="text-[15px] text-[#667781] leading-7 max-w-[360px]">{t('chat.selectChat') || 'Send and receive messages. Start a conversation from the list.'}</p>
            <div className="mt-8 flex items-center gap-2 text-[13px] text-[#8696A0] bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-[#E9EDEF]/50">
              <Lock size={12} /> <span>End-to-end encrypted</span>
            </div>
          </div>
        </div>
      );
    }

    const typingUsers = getTypingUsers(selectedRoom);

    return (
      <div className={`flex-1 flex flex-col h-full ${isMobileView && !selectedRoom ? 'hidden' : ''}`}>
        {/* Premium Chat Header */}
        <div className="px-2 py-2.5 flex items-center gap-2.5 flex-shrink-0 chat-header-shine" style={{ background: 'linear-gradient(135deg, #075E54 0%, #128C7E 30%, #00A884 70%, #25D366 100%)', boxShadow: '0 2px 12px rgba(7,94,84,0.3)' }}>
          {isMobileView && (
            <button onClick={() => setSelectedRoom(null)} className="p-2 active:bg-white/20 rounded-full text-white -ml-1">
              <ArrowLeft size={22} />
            </button>
          )}
          <div className={`h-[44px] w-[44px] rounded-full flex items-center justify-center text-base font-semibold flex-shrink-0 active:scale-95 transition-all duration-200 ring-2 ring-white/20 ring-offset-1 ring-offset-transparent ${
            selectedRoom.type === 'group' ? 'bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-md' : 'bg-gradient-to-br from-white/90 to-white/70'
          }`} style={{ boxShadow: selectedRoom.type === 'group' ? '0 2px 12px rgba(37,211,102,0.3)' : '0 2px 8px rgba(0,0,0,0.1)' }}
               onClick={() => setShowRoomInfo(!showRoomInfo)}>
            {selectedRoom.type === 'group' ? (
              <Users size={18} className="text-white" />
            ) : (
              <span className="text-[#54656F] text-[17px] font-semibold">{getRoomAvatar(selectedRoom)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowRoomInfo(!showRoomInfo)}>
            <h3 className="text-[16px] font-semibold text-white truncate leading-tight">{getRoomName(selectedRoom)}</h3>
            {typingUsers.length > 0 ? (
              <p className="text-[12px] text-[#25D366] leading-tight font-medium">
                {typingUsers.join(', ')} {t('chat.typing') || 'typing...'}
              </p>
            ) : (
              <p className="text-[12px] text-white/60 leading-tight">
                {selectedRoom.type === 'group'
                  ? `${selectedRoom.members.length} ${t('chat.members') || 'members'}`
                  : getDirectChatStatus(selectedRoom)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {!isMobileView && (
              <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearchQuery(''); }}
                className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl text-white/85 transition-all duration-200 hover:text-white hover:scale-105">
                <Search size={20} />
              </button>
            )}
            <button onClick={() => setShowRoomMenu(true)}
              className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-xl text-white/85 transition-all duration-200 hover:text-white hover:scale-105">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Room Info Panel */}
        {showRoomInfo && (
          <div className="bg-white border-b border-[#E9EDEF] px-4 py-3">
            <h4 className="text-[13px] font-medium text-[#008069] mb-2">{t('chat.members') || 'Members'}</h4>
            <div className="flex flex-wrap gap-2">
              {selectedRoom.members.map((mid) => (
                <div key={mid} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F0F2F5] rounded-lg text-xs">
                  <div className="relative">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white" style={{ backgroundColor: '#00A884' }}>
                      {(selectedRoom.memberNames?.[mid] || mid).charAt(0)}
                    </div>
                    {isUserOnline(mid) && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#00A884] rounded-full border-2 border-white" />}
                  </div>
                  <span className="text-[#111B21] font-medium">
                    {selectedRoom.memberNames?.[mid] || mid}
                    {mid === userId && ` (${t('chat.you') || 'You'})`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-chat Search Bar */}
        {showChatSearch && (
          <div className="px-3 py-2 bg-white border-b border-[#E9EDEF] flex items-center gap-2">
            <Search size={16} className="text-[#54656F] flex-shrink-0" />
            <input type="text" placeholder="Search messages..." value={chatSearchQuery} onChange={e => setChatSearchQuery(e.target.value)}
              className="flex-1 bg-[#F0F2F5] rounded-lg px-3 py-2 text-sm text-[#111B21] outline-none" autoFocus />
            {chatSearchQuery && <span className="text-[12px] text-[#667781] flex-shrink-0">{searchFilteredMessages?.length || 0} found</span>}
            <button onClick={() => { setShowChatSearch(false); setChatSearchQuery(''); }} className="p-1.5 hover:bg-[#F0F2F5] rounded-full">
              <X size={14} className="text-[#54656F]" />
            </button>
          </div>
        )}

        {/* Select Mode Toolbar */}
        {selectMode && (
          <div className="px-3 py-3 flex items-center gap-3 text-white bg-gradient-to-r from-[#128C7E] to-[#075E54]">
            <button onClick={() => { setSelectMode(false); setSelectedMsgIds(new Set()); }} className="p-2 hover:bg-white/15 active:bg-white/25 rounded-full transition-colors">
              <X size={20} />
            </button>
            <span className="flex-1 text-[15px] font-semibold">{selectedMsgIds.size} selected</span>
            <button onClick={handleBulkForward} disabled={selectedMsgIds.size === 0} className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-full disabled:opacity-30 transition-colors" title="Forward">
              <Share2 size={20} />
            </button>
            <button onClick={handleBulkDelete} disabled={selectedMsgIds.size === 0} className="p-2.5 hover:bg-white/15 active:bg-white/25 rounded-full disabled:opacity-30 transition-colors" title={t('common.delete')}>
              <Trash2 size={20} />
            </button>
          </div>
        )}

        {/* Starred Messages Panel */}
        {showStarred && (
          <div className="bg-[#FFF8E1] border-b border-[#FFE082] px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-[#795548] flex items-center gap-1"><Star size={12} className="fill-[#FFB300] text-[#FFB300]" /> Starred ({starredMessages.length})</span>
              <button onClick={() => setShowStarred(false)} className="p-1 hover:bg-[#FFE082]/50 rounded-full"><X size={14} className="text-[#795548]" /></button>
            </div>
            {starredMessages.length === 0 
              ? <p className="text-[12px] text-[#8D6E63] py-2 text-center">No starred messages</p>
              : <div className="max-h-32 overflow-y-auto space-y-1">
                  {starredMessages.map(m => (
                    <div key={m.id} className="bg-white rounded-md px-3 py-1.5 text-[12px] text-[#111B21] truncate flex items-center gap-2 border border-[#E9EDEF]">
                      <Star size={10} className="fill-[#FFB300] text-[#FFB300] flex-shrink-0" />
                      <span className="font-medium text-[#008069] flex-shrink-0">{m.senderName}:</span>
                      <span className="truncate">{m.text || (m.type === 'image' ? '📷 Image' : m.type === 'voice' ? '🎤 Voice' : `📎 ${m.fileName}`)}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* Search Results (if searching) */}
        {showChatSearch && chatSearchQuery.trim() && searchFilteredMessages && (
          <div className="bg-blue-50/90 backdrop-blur-sm border-b border-blue-200/60 px-3 py-2 max-h-40 overflow-y-auto chat-scrollbar chat-slide-up">
            {searchFilteredMessages.length === 0 
              ? <p className="text-xs text-blue-400 py-2 text-center">No messages found</p>
              : searchFilteredMessages.map(m => (
                  <div key={m.id} className="bg-white/80 rounded-lg px-3 py-1.5 text-xs text-slate-700 mb-1 flex items-center gap-2 cursor-pointer hover:bg-blue-100/50 transition-all"
                    onClick={() => {
                      // Scroll to the message
                      const el = document.getElementById(`msg-${m.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <span className="font-semibold text-blue-700 flex-shrink-0">{m.senderName}:</span>
                    <span className="truncate">{m.text || m.fileName || m.type}</span>
                    <span className="text-[9px] text-slate-400 flex-shrink-0 ml-auto">{formatTime(m.createdAt)}</span>
                  </div>
                ))
            }
          </div>
        )}

        {/* Messages - Premium background */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto py-2 relative chat-messages-bg" onScroll={handleMessagesScroll} style={{ WebkitOverflowScrolling: 'touch' }}>
          {groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[12.5px] text-[#111B21] px-4 py-1.5 rounded-xl font-medium shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                  {group.date}
                </span>
              </div>
              {group.messages.map(renderMessage)}
            </div>
          ))}
          <div ref={messagesEndRef} />

          {/* Premium Scroll to bottom */}
          {showScrollBtn && (
            <button onClick={scrollToBottom}
              className="sticky bottom-3 ml-auto mr-3 h-11 w-11 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center z-10 border border-[#E9EDEF]/50 active:scale-90 transition-all duration-200 hover:scale-105"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)' }}>
              <ArrowDown size={20} className="text-[#25D366]" />
            </button>
          )}
        </div>

        {/* Reply Preview */}
        {replyingTo && (
          <div className="px-4 py-2.5 bg-[#F0F2F5] border-t border-[#E9EDEF] flex items-center gap-3">
            <div className="flex-1 min-w-0 border-l-[3px] pl-3 rounded-sm" style={{ borderColor: '#25D366' }}>
              <p className="text-[13px] font-semibold" style={{ color: '#25D366' }}>{replyingTo.senderName}</p>
              <p className="text-[13px] text-[#667781] truncate">{replyingTo.text || '📎 Attachment'}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-[#E9EDEF] active:bg-[#DDE0E3] rounded-full transition-colors">
              <X size={18} className="text-[#54656F]" />
            </button>
          </div>
        )}

        {/* Editing Preview */}
        {editingMessage && (
          <div className="px-4 py-2.5 bg-[#FFF8E1] border-t border-[#FFE082] flex items-center gap-3">
            <Edit3 size={16} className="text-[#FF8F00] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#795548]">{t('chat.editingMessage') || 'Editing message'}</p>
            </div>
            <button onClick={() => { setEditingMessage(null); setMessageText(''); }} className="p-2 hover:bg-[#FFE082]/50 active:bg-[#FFD54F]/50 rounded-full transition-colors">
              <X size={16} className="text-[#795548]" />
            </button>
          </div>
        )}

        {/* Premium Input Area */}
        <div className="px-2 py-2.5 flex items-end gap-1.5 flex-shrink-0" style={{ background: 'linear-gradient(180deg, #F0F2F5 0%, #E8ECF0 100%)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}>
          {isRecording ? (
            <div className="flex items-center gap-2 py-1 w-full">
              <button onClick={cancelRecording} className="p-2.5 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all duration-200">
                <X size={22} className="text-red-500" />
              </button>
              <div className="flex-1 flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-red-100/50">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.4)' }} />
                <span className="text-[15px] text-red-600 font-mono font-bold tracking-wide">{formatDuration(recordingTime)}</span>
                <div className="flex-1 flex items-end justify-center gap-[2px] h-7">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div key={i} className="w-[2.5px] rounded-full chat-wave-bar" 
                         style={{ background: `rgba(239,68,68,${0.3 + Math.sin(i*0.3)*0.3})`, animationDelay: `${i * 0.035}s` }} />
                  ))}
                </div>
              </div>
              <button onClick={stopRecording} className="p-3.5 rounded-2xl text-white active:scale-90 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', boxShadow: '0 4px 16px rgba(37,211,102,0.35)' }}>
                <Send size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-1.5 w-full">
              {/* Emoji Button */}
              <button
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
                className={`p-2.5 rounded-xl flex-shrink-0 active:scale-90 transition-all duration-300 ${showEmojiPicker ? 'text-[#25D366] bg-[#25D366]/10 shadow-sm' : 'text-[#8696A0] hover:text-[#54656F]'}`}>
                <Smile size={24} />
              </button>

              {/* Text Input */}
              <div className="flex-1 relative min-w-0">
                {renderMentionSuggestions()}
                <textarea
                  value={messageText}
                  onChange={(e) => { handleTextChange(e); }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.typeMessage') || 'Type a message'}
                  className="w-full px-4 py-2.5 bg-white rounded-[22px] text-[16px] text-[#111B21] placeholder-[#8696A0] outline-none resize-none max-h-[120px] min-h-[44px] leading-[22px] border border-[#E9EDEF]/60 transition-all duration-300 focus:border-[#25D366]/30 focus:shadow-[0_0_0_3px_rgba(37,211,102,0.08)]"
                  rows={1}
                  style={{ height: 'auto', fontSize: '16px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>

              {/* Attach Button */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
                  className={`p-2.5 rounded-xl active:scale-90 transition-all duration-300 ${showAttachMenu ? 'text-[#25D366] bg-[#25D366]/10 rotate-45 shadow-sm' : 'text-[#8696A0] hover:text-[#54656F]'}`}>
                  <Paperclip size={22} className="transition-transform" />
                </button>
                {showAttachMenu && (
                  <>{/* Premium Backdrop */}
                  <div className="fixed inset-0 z-40" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.25), rgba(0,0,0,0.08))' }} onClick={() => setShowAttachMenu(false)} />
                  <div className={`z-50 py-2 ${
                    isMobileView 
                      ? 'fixed bottom-0 left-0 right-0 rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),16px)] chat-slide-up' 
                      : 'absolute bottom-14 right-0 rounded-2xl w-60 border border-white/40'
                  }`} style={{ background: isMobileView ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 -8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                    {isMobileView && <div className="w-12 h-1.5 rounded-full mx-auto mt-2 mb-3" style={{ background: 'linear-gradient(90deg, #D1D5DB, #B0B7BE, #D1D5DB)' }} />}
                    <div className={isMobileView ? 'grid grid-cols-4 gap-2 px-5 pb-3' : ''}>
                      <button onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="h-13 w-13 rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #0795DC, #0670A8)', boxShadow: '0 4px 12px rgba(7,149,220,0.3)' }}><Camera size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>Camera</span>
                      </button>
                      <button onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #C861F9, #A033D4)', boxShadow: '0 4px 12px rgba(200,97,249,0.3)' }}><Image size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>{t('chat.photo')}</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #5157AE, #3D4291)', boxShadow: '0 4px 12px rgba(81,87,174,0.3)' }}><Paperclip size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>{t('chat.document')}</span>
                      </button>
                      <button onClick={() => { setShowGifPicker(true); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #D4307F, #AB1E63)', boxShadow: '0 4px 12px rgba(212,48,127,0.3)' }}><Sparkles size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>GIF</span>
                      </button>
                      <button onClick={() => { setShowStickerPicker(true); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #FF6723, #D44E15)', boxShadow: '0 4px 12px rgba(255,103,35,0.3)' }}><Smile size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>Sticker</span>
                      </button>
                      <button onClick={() => { handleShareLocation(); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #1FA855, #128C3A)', boxShadow: '0 4px 12px rgba(31,168,85,0.3)' }}><MapPin size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>Location</span>
                      </button>
                      <button onClick={() => { setShowPollCreator(true); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #006DE0, #004AAD)', boxShadow: '0 4px 12px rgba(0,109,224,0.3)' }}><BarChart3 size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>Poll</span>
                      </button>
                      <button onClick={() => { setShowTemplates(true); setShowAttachMenu(false); }}
                        className={isMobileView ? 'flex flex-col items-center gap-2 py-3.5 rounded-2xl active:bg-[#F0F2F5] active:scale-95 transition-all' : 'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors'}>
                        <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #009688, #00796B)', boxShadow: '0 4px 12px rgba(0,150,136,0.3)' }}><MessageSquare size={22} className="text-white" /></div>
                        <span className={isMobileView ? 'text-[11px] text-[#54656F] font-semibold' : ''}>Templates</span>
                      </button>
                    </div>
                    {!isMobileView && (
                      <>
                        <div className="mx-3 my-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #E9EDEF, transparent)' }} />
                        <button onClick={() => { handleShareContact(); setShowAttachMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] text-sm text-[#111B21] rounded-xl mx-1 transition-colors">
                          <div className="rounded-2xl flex items-center justify-center shadow-md" style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #0EABF4, #0A86C2)', boxShadow: '0 4px 12px rgba(14,171,244,0.3)' }}><Contact size={18} className="text-white" /></div>
                          <span>Contact</span>
                        </button>
                      </>
                    )}
                  </div></>
                )}
              </div>

              {/* Text Input - hidden duplicate */}
              <div className="flex-1 relative min-w-0 hidden">
                {/* moved above */}
              </div>

              {/* Premium Send / Voice Button */}
              {messageText.trim() ? (
                <button onClick={handleSendMessage}
                  className="p-3 rounded-2xl text-white flex-shrink-0 active:scale-90 transition-all duration-300 hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 50%, #00A884 100%)', boxShadow: '0 4px 16px rgba(37,211,102,0.35), 0 2px 4px rgba(0,0,0,0.05)' }}>
                  <Send size={20} />
                </button>
              ) : (
                <button onClick={startRecording}
                  className="p-2.5 rounded-xl text-[#8696A0] active:scale-90 active:text-[#25D366] flex-shrink-0 transition-all duration-300 hover:text-[#54656F] hover:bg-[#F0F2F5]">
                  <Mic size={24} />
                </button>
              )}
            </div>
          )}

          {/* Hidden file inputs */}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
            <div className={`z-50 overflow-hidden ${
              isMobileView 
                ? 'fixed bottom-0 left-0 right-0 rounded-t-[28px] chat-slide-up' 
                : 'absolute bottom-16 left-2 rounded-2xl'
            }`} style={{ width: isMobileView ? '100%' : '350px', maxHeight: isMobileView ? '45vh' : '400px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: isMobileView ? '0 -8px 40px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
              {isMobileView && <div className="w-12 h-1.5 rounded-full mx-auto mt-2.5" style={{ background: 'linear-gradient(90deg, #D1D5DB, #B0B7BE, #D1D5DB)' }} />}
              <div className="p-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(233,237,239,0.6)' }}>
                <span className="text-[14px] font-bold text-[#111B21] flex items-center gap-2.5">
                  <span className="text-xl">😊</span> {t('chat.emoji') || 'Emoji'}
                </span>
                <button onClick={() => setShowEmojiPicker(false)} className="p-2 hover:bg-[#F0F2F5] active:bg-[#E9EDEF] rounded-xl transition-all active:scale-90">
                  <X size={16} className="text-[#54656F]" />
                </button>
              </div>
              <div className="overflow-y-auto p-3.5" style={{ maxHeight: isMobileView ? 'calc(45vh - 60px)' : '340px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
                {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                  <div key={category} className="mb-5">
                    <p className="text-[10px] font-extrabold text-[#8696A0] mb-2.5 px-1 uppercase tracking-[0.1em]">{category}</p>
                    <div className="flex flex-wrap gap-0.5">
                      {emojis.map((emoji, ei) => (
                        <button key={`${emoji}-${ei}`} onClick={() => { setMessageText(prev => prev + emoji); setShowEmojiPicker(false); }}
                          className={`${isMobileView ? 'text-[24px] p-2.5' : 'text-[22px] p-2'} hover:bg-[#F0F2F5] active:bg-[#25D366]/10 active:scale-125 rounded-xl transition-all duration-150`}>{emoji}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Render: Context Menu ───────────────────────────────

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const isOwn = contextMenu.msg.senderId === userId;
    const isStarred = (contextMenu.msg as any).starredBy?.includes(userId);
    
    const menuBtnClass = `w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-[#F0F2F5] text-[15px] text-[#111B21] transition-all hover:bg-[#F0F2F5]/60`;
    const menuBtnDanger = `w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-red-50 text-[15px] text-[#EA0038] transition-all hover:bg-red-50/50`;

    return (
      <>
        <div className={`fixed inset-0 z-[100]`} style={{ background: isMobileView ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)', backdropFilter: isMobileView ? 'blur(4px)' : 'none' }} onClick={() => setContextMenu(null)} />
        <div
          className={`fixed z-[101] ${
            isMobileView 
              ? 'bottom-0 left-0 right-0 rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),16px)] chat-slide-up max-h-[70vh] overflow-y-auto' 
              : 'rounded-2xl py-1.5 min-w-[210px]'
          }`}
          style={isMobileView 
            ? { background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }
            : { top: Math.min(contextMenu.y, window.innerHeight - 400), left: Math.min(contextMenu.x, window.innerWidth - 210), background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)' }
          }
        >
          {isMobileView && <div className="w-12 h-1.5 rounded-full mx-auto mt-3 mb-2" style={{ background: 'linear-gradient(90deg, #D1D5DB, #B0B7BE, #D1D5DB)' }} />}
          {/* Premium Quick reactions row */}
          {isMobileView && (
            <div className="flex items-center justify-center gap-1.5 px-4 py-3 mx-4 mb-1 rounded-2xl" style={{ background: 'linear-gradient(135deg, #F8F9FA, #F0F2F5)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}>
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { selectedRoom && toggleReaction(selectedRoom.id, contextMenu.msg.id, emoji, userId); setContextMenu(null); }}
                  className="text-[26px] p-2.5 rounded-2xl hover:bg-white active:bg-white active:scale-125 transition-all"
                  style={{ boxShadow: 'none' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { setReplyingTo(contextMenu.msg); setContextMenu(null); }} className={menuBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Reply size={16} className="text-[#54656F]" /></div> {t('chat.reply') || 'Reply'}
          </button>
          {contextMenu.msg.type === 'text' && (
            <button onClick={() => { navigator.clipboard.writeText(contextMenu.msg.text || ''); setContextMenu(null); }} className={menuBtnClass}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Hash size={16} className="text-[#54656F]" /></div> {t('chat.copy') || 'Copy'}
            </button>
          )}
          <button onClick={() => { setForwardingMsg(contextMenu.msg); setContextMenu(null); }} className={menuBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Share2 size={16} className="text-[#54656F]" /></div> {t('chat.forward') || 'Forward'}
          </button>
          <button onClick={() => { if (selectedRoom) toggleStarMessage(selectedRoom.id, contextMenu.msg.id, userId); setContextMenu(null); }} className={menuBtnClass}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isStarred ? 'bg-[#FFF8E1]' : 'bg-[#F0F2F5]'}`}><Star size={16} className={isStarred ? 'text-[#FFB300] fill-[#FFB300]' : 'text-[#54656F]'} /></div>
            {isStarred ? 'Unstar' : 'Star'}
          </button>
          <button onClick={() => { setSelectMode(true); toggleSelectMsg(contextMenu.msg.id); setContextMenu(null); }} className={menuBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><CheckSquare size={16} className="text-[#54656F]" /></div> Select
          </button>
          {selectedRoom?.type === 'group' && (
            <button onClick={() => { setShowMsgInfo(contextMenu.msg); setContextMenu(null); }} className={menuBtnClass}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Info size={16} className="text-[#54656F]" /></div>{t('common.info')}</button>
          )}
          {isOwn && contextMenu.msg.type === 'text' && (
            <button onClick={() => { setEditingMessage(contextMenu.msg); setMessageText(contextMenu.msg.text || ''); setContextMenu(null); }} className={menuBtnClass}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Edit3 size={16} className="text-[#54656F]" /></div> {t('common.edit') || 'Edit'}
            </button>
          )}
          {isOwn && (
            <>
              <div className="mx-5 my-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #E9EDEF, transparent)' }} />
              <button onClick={() => { if (selectedRoom) deleteMessage(selectedRoom.id, contextMenu.msg.id); setContextMenu(null); }} className={menuBtnDanger}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50"><Trash2 size={16} /></div> {t('common.delete') || 'Delete'}
              </button>
            </>
          )}
          {contextMenu.msg.type === 'text' && contextMenu.msg.text && (
            <button onClick={() => { navigator.clipboard.writeText(contextMenu.msg.text || ''); setContextMenu(null); }} className={menuBtnClass}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Copy size={16} className="text-[#54656F]" /></div> Copy Text
            </button>
          )}
          {!isOwn && (
            <>
              <div className="mx-5 my-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #E9EDEF, transparent)' }} />
              <button onClick={() => { toggleBlockUser(contextMenu.msg.senderId); setContextMenu(null); }} className={menuBtnDanger}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50"><Ban size={16} /></div> Block User
              </button>
            </>
          )}
        </div>
      </>
    );
  };

  // ── Render: New Chat Modal ─────────────────────────────

  const renderNewChatModal = () => {
    if (!showNewChat) return null;
    const filtered = allUsers.filter(u => 
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setShowNewChat(false); setUserSearch(''); }}>
        <div className={`bg-white w-full overflow-hidden shadow-2xl chat-slide-up sm:chat-bounce-in ${
          isMobileView ? 'h-[85vh] rounded-t-3xl' : 'max-w-md max-h-[80vh] rounded-3xl'
        }`} onClick={e => e.stopPropagation()}>
          <div className="p-5 bg-gradient-to-br from-[#128C7E] via-[#075E54] to-[#064E47] text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <h3 className="font-extrabold text-lg tracking-tight relative z-10">{t('chat.newChat') || 'New Chat'}</h3>
            <button onClick={() => { setShowNewChat(false); setUserSearch(''); }} className="p-2 hover:bg-white/20 active:bg-white/30 rounded-xl relative z-10 transition-all">
              <X size={20} />
            </button>
          </div>
          <div className="p-4">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('chat.searchStaff') || 'Search staff...'}
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-3 bg-slate-50 rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white border border-transparent focus:border-emerald-200 transition-all duration-300"
                autoFocus={!isMobileView}
              />
            </div>
            {/* New group button */}
            <button
              onClick={() => { setShowNewChat(false); setShowNewGroup(true); setUserSearch(''); }}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-emerald-50 active:bg-emerald-100 rounded-xl transition-all mb-2"
            >
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white flex items-center justify-center shadow-md shadow-emerald-200">
                <Users size={18} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-slate-800">{t('chat.newGroup') || 'New Group'}</p>
                <p className="text-[12px] text-slate-400">Create a group chat</p>
              </div>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 chat-scrollbar" style={{ maxHeight: isMobileView ? undefined : '50vh' }}>
            {filtered.length === 0 ? (
              <p className="text-center text-[14px] text-slate-400 py-12">{t('common.noData') || 'No staff found'}</p>
            ) : (
              filtered.map((user, i) => (
                <button
                  key={user.id}
                  onClick={() => startDirectChat(user)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-emerald-50 active:bg-emerald-100 transition-all duration-200 text-left border-b border-slate-100/60"
                >
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white flex items-center justify-center font-bold text-[15px] shadow-md shadow-emerald-200">
                      {user.name?.charAt(0) || '?'}
                    </div>
                    {isUserOnline(user.id) && <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-[#25D366] border-2 border-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-slate-800 truncate">{user.name}</p>
                    <p className="text-[12px] text-slate-400 font-medium">{user.role}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: New Group Modal ────────────────────────────

  const renderNewGroupModal = () => {
    if (!showNewGroup) return null;

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowNewGroup(false)}>
        <div className={`bg-white w-full overflow-hidden shadow-2xl chat-slide-up sm:chat-bounce-in ${
          isMobileView ? 'h-[85vh] rounded-t-3xl' : 'max-w-md max-h-[80vh] rounded-3xl'
        }`} onClick={e => e.stopPropagation()}>
          <div className="p-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <h3 className="font-extrabold text-lg tracking-tight relative z-10">{t('chat.newGroup') || 'New Group'}</h3>
            <button onClick={() => setShowNewGroup(false)} className="p-2 hover:bg-white/20 active:bg-white/30 rounded-xl relative z-10 transition-all">
              <X size={20} />
            </button>
          </div>
          <div className="p-4">
            <input
              type="text"
              placeholder={t('chat.groupName') || 'Group name...'}
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white border border-transparent focus:border-blue-200 transition-all duration-300 mb-4 font-medium"
              autoFocus
            />
            <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">{t('chat.selectMembers') || 'Select members'}</p>
            <div className="max-h-[35vh] overflow-y-auto chat-scrollbar">
              {allUsers.map((user, i) => (
                <label
                  key={user.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 chat-fade-in ${
                    selectedMembers.includes(user.id) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMembers(prev => [...prev, user.id]);
                      } else {
                        setSelectedMembers(prev => prev.filter(id => id !== user.id));
                      }
                    }}
                    className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {user.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{user.role}</p>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-sm disabled:opacity-40 hover:shadow-lg hover:shadow-blue-200/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('chat.createGroup') || 'Create Group'} ({selectedMembers.length} {t('chat.members') || 'members'})
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Forward Modal ───────────────────────────────

  const renderForwardModal = () => {
    if (!forwardingMsg) return null;
    const filteredRooms = rooms.filter(r => r.id !== selectedRoom?.id);
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setForwardingMsg(null)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-md'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2"><Share2 size={20} /> {t('chat.forward') || 'Forward'}</h3>
              <button onClick={() => setForwardingMsg(null)} className="p-2 hover:bg-white/20 rounded-xl transition-all"><X size={18} /></button>
            </div>
            <div className="mt-3 bg-white/15 rounded-xl px-3 py-2 text-sm truncate backdrop-blur-sm">
              {forwardingMsg.type === 'text' ? forwardingMsg.text : forwardingMsg.type === 'image' ? '📷 Image' : forwardingMsg.type === 'voice' ? '🎤 Voice' : `📎 ${forwardingMsg.fileName || 'File'}`}
            </div>
          </div>
          <div className="p-2 max-h-80 sm:max-h-80 overflow-y-auto chat-scrollbar" style={isMobileView ? { maxHeight: 'calc(85vh - 120px)' } : undefined}>
            {filteredRooms.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">No other chats available</p>
            ) : filteredRooms.map(room => (
              <button
                key={room.id}
                onClick={() => handleForwardMessage(room)}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-indigo-50 rounded-2xl transition-all duration-200 text-left"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                  {room.type === 'group' ? <Users size={18} /> : <UserIcon size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{getRoomName(room)}</p>
                  <p className="text-[10px] text-slate-400">{room.type === 'group' ? `${room.members?.length || 0} members` : 'Direct'}</p>
                </div>
                <Share2 size={14} className="text-indigo-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Pending File Preview (before send) ─────────

  const renderPendingFilePreview = () => {
    if (!pendingFile) return null;
    
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col chat-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2 min-w-0">
            {pendingFile.type === 'image' ? <Image size={18} className="text-white/70 flex-shrink-0" /> : <FileText size={18} className="text-white/70 flex-shrink-0" />}
            <span className="text-white text-sm font-semibold truncate">{pendingFile.file.name}</span>
            <span className="text-white/40 text-xs flex-shrink-0">({formatFileSize(pendingFile.file.size)})</span>
          </div>
          <button onClick={cancelPendingFile} className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 text-white hover:scale-105">
            <X size={20} />
          </button>
        </div>

        {/* Preview content */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          {pendingFile.type === 'image' ? (
            <img src={pendingFile.previewUrl} alt={pendingFile.file.name} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl chat-preview-in" />
          ) : (
            <div className="flex flex-col items-center gap-4 chat-preview-in">
              <div className="h-28 w-28 rounded-3xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                <FileText size={48} className="text-white/70" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">{pendingFile.file.name}</p>
                <p className="text-white/50 text-sm mt-1">{formatFileSize(pendingFile.file.size)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Caption + Send bar */}
        <div className="px-5 pb-5 pt-3 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              placeholder={t('chat.addCaption') || 'Add a caption...'}
              value={pendingFile.caption}
              onChange={e => setPendingFile(prev => prev ? { ...prev, caption: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendPendingFile(); }}
              className="flex-1 bg-white/15 text-white placeholder-white/40 border border-white/20 rounded-2xl px-4 py-3 text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
              autoFocus
            />
            <button
              onClick={handleSendPendingFile}
              className="h-12 w-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-110 active:scale-95"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Message Info Modal ──────────────────────────

  const renderMsgInfoModal = () => {
    if (!showMsgInfo || !selectedRoom) return null;
    const readUsers = (showMsgInfo.readBy || []).filter((id: string) => id !== showMsgInfo.senderId);
    const unreadUsers = selectedRoom.members.filter(m => m !== showMsgInfo.senderId && !readUsers.includes(m));
    
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowMsgInfo(null)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Info size={18} /> Message Info</h3>
            <button onClick={() => setShowMsgInfo(null)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            {/* Read by */}
            <div>
              <p className="text-xs font-bold text-blue-600 mb-1.5 flex items-center gap-1"><CheckCheck size={12} className="text-sky-500" /> Read by ({readUsers.length})</p>
              {readUsers.length === 0 ? <p className="text-xs text-slate-400 pl-4">Nobody yet</p> : (
                <div className="space-y-1 pl-4">
                  {readUsers.map(uid => (
                    <div key={uid} className="flex items-center gap-2 text-xs">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 text-white flex items-center justify-center text-[9px] font-bold">
                        {(selectedRoom.memberNames?.[uid] || '?').charAt(0)}
                      </div>
                      <span className="text-slate-700 font-medium">{selectedRoom.memberNames?.[uid] || uid}</span>
                      {isUserOnline(uid) && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Unread (delivered) */}
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Check size={12} className="text-slate-400" /> Delivered ({unreadUsers.length})</p>
              {unreadUsers.length === 0 ? <p className="text-xs text-slate-400 pl-4">Everyone has read</p> : (
                <div className="space-y-1 pl-4">
                  {unreadUsers.map(uid => (
                    <div key={uid} className="flex items-center gap-2 text-xs">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 text-white flex items-center justify-center text-[9px] font-bold">
                        {(selectedRoom.memberNames?.[uid] || '?').charAt(0)}
                      </div>
                      <span className="text-slate-500">{selectedRoom.memberNames?.[uid] || uid}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Voice Preview ──────────────────────────────

  const renderVoicePreview = () => {
    if (!pendingVoice) return null;
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-6 chat-fade-in">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-sm w-full text-center border border-white/20 chat-bounce-in">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/30">
            <Mic size={36} className="text-white" />
          </div>
          <p className="text-white text-lg font-bold mb-1">Voice Message</p>
          <p className="text-white/60 text-sm mb-6">{formatDuration(pendingVoice.duration)}</p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => {
                const audio = new Audio(pendingVoice.url);
                audio.play();
              }}
              className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all active:scale-95"
            >
              <Play size={24} />
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={cancelPendingVoice} className="flex-1 py-3 bg-white/10 text-white rounded-2xl font-bold text-sm hover:bg-white/20 transition-all active:scale-95 border border-white/20">{t('common.cancel')}</button>
            <button onClick={handleSendPendingVoice} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95">
              <span className="flex items-center justify-center gap-2"><Send size={16} /> Send</span>
            </button>
          </div>
        </div>
        <button onClick={cancelPendingVoice} className="mt-4 p-2 text-white/40 hover:text-white/80 transition-all">
          <X size={24} />
        </button>
      </div>
    );
  };

  // ── Render: Room Menu (right-click / long-press on room) ──

  const renderRoomMenu = () => {
    if (!showRoomMenu || !selectedRoom) return null;
    const isPinned = (selectedRoom as any).pinned?.includes(userId);
    const isMuted = (selectedRoom as any).muted?.includes(userId);
    const isArchived = (selectedRoom as any).archived?.includes(userId);
    const isLocked = (selectedRoom as any).locked?.includes(userId);

    const rmBtnClass = `w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-[#F0F2F5] hover:bg-[#F8F9FA] text-[15px] text-[#111B21] transition-all`;

    return (
      <>
        <div className={`fixed inset-0 z-[100]`} style={{ background: isMobileView ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)', backdropFilter: isMobileView ? 'blur(4px)' : 'none' }} onClick={() => setShowRoomMenu(false)} />
        <div className={`fixed z-[101] py-1 ${
          isMobileView 
            ? 'bottom-0 left-0 right-0 rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),16px)] chat-slide-up max-h-[75vh] overflow-y-auto' 
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl w-72'
        }`} style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: isMobileView ? '0 -8px 40px rgba(0,0,0,0.15)' : '0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          {isMobileView && <div className="w-12 h-1.5 rounded-full mx-auto mt-3 mb-2" style={{ background: 'linear-gradient(90deg, #D1D5DB, #B0B7BE, #D1D5DB)' }} />}
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(233,237,239,0.6)' }}>
            <p className="text-[16px] font-bold text-[#111B21] truncate">{getRoomName(selectedRoom)}</p>
          </div>
          {isMobileView && (
            <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearchQuery(''); setShowRoomMenu(false); }}
              className={rmBtnClass}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Search size={16} className="text-[#54656F]" /></div> Search in Chat
            </button>
          )}
          <button onClick={() => { setShowStarred(!showStarred); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${showStarred ? 'bg-[#FFF8E1]' : 'bg-[#F0F2F5]'}`}><Star size={16} className={`${showStarred ? 'text-[#FFB300] fill-[#FFB300]' : 'text-[#54656F]'}`} /></div> Starred Messages
          </button>
          <button onClick={() => { togglePinChat(selectedRoom.id, userId); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isPinned ? 'bg-[#E8F5E9]' : 'bg-[#F0F2F5]'}`}><Pin size={16} className={`${isPinned ? 'text-[#25D366] fill-[#25D366]' : 'text-[#54656F]'}`} style={{ transform: 'rotate(45deg)' }} /></div> {isPinned ? 'Unpin' : 'Pin Chat'}
          </button>
          <button onClick={() => { toggleMuteChat(selectedRoom.id, userId); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]">{isMuted ? <Bell size={16} className="text-[#54656F]" /> : <BellOff size={16} className="text-[#54656F]" />}</div>
            {isMuted ? 'Unmute' : 'Mute Chat'}
          </button>
          <button onClick={() => { toggleArchiveChat(selectedRoom.id, userId); setShowRoomMenu(false); setSelectedRoom(null); }}
            className={rmBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Archive size={16} className="text-[#54656F]" /></div> {isArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => {
            if (isLocked) { toggleLockChat(selectedRoom.id, userId); setShowRoomMenu(false); return; }
            const pin = prompt('Set a 4-digit PIN to lock this chat:');
            if (pin && pin.length === 4) { handleSetLockPin(selectedRoom.id, pin); toggleLockChat(selectedRoom.id, userId); }
            setShowRoomMenu(false);
          }} className={rmBtnClass}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isLocked ? 'bg-[#E8F5E9]' : 'bg-[#F0F2F5]'}`}>{isLocked ? <Unlock size={16} className="text-[#25D366]" /> : <Lock size={16} className="text-[#54656F]" />}</div>
            {isLocked ? 'Unlock Chat' : 'Lock Chat'}
          </button>
          <button onClick={() => { setShowWallpaperPicker(true); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Palette size={16} className="text-[#54656F]" /></div> Wallpaper
          </button>
          {selectedRoom.type === 'group' && (
            <button onClick={() => { setShowGroupSettings(true); setShowRoomMenu(false); }}
              className={rmBtnClass}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Settings size={16} className="text-[#54656F]" /></div> Group Settings
            </button>
          )}
          <button onClick={() => { handleExportChat(); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><FileDown size={16} className="text-[#54656F]" /></div> Export Chat
          </button>
          <button onClick={() => { setShowMediaGallery(true); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><Image size={16} className="text-[#54656F]" /></div> Media Gallery
          </button>
          <button onClick={() => { setShowChatStats(true); setShowRoomMenu(false); }}
            className={rmBtnClass}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F0F2F5]"><BarChart3 size={16} className="text-[#54656F]" /></div> Chat Stats
          </button>
          <div className="mx-5 my-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #E9EDEF, transparent)' }} />
            <button onClick={() => { handleClearChat(); setShowRoomMenu(false); }}
              className="w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-red-50 hover:bg-red-50/50 text-[15px] text-[#EA0038] transition-all">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50"><Trash2 size={16} /></div> Clear Chat
            </button>
        </div>
      </>
    );
  };

  // ── Render: Settings Panel ──

  const renderSettingsPanel = () => {
    if (!showSettingsPanel) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowSettingsPanel(false)}>
        <div className={`w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${
          isMobileView ? 'fixed inset-x-0 bottom-0 rounded-t-[28px] max-h-[90vh]' : 'rounded-2xl max-w-sm'
        }`} style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="w-12 h-1.5 rounded-full mx-auto mt-3 mb-1" style={{ background: 'linear-gradient(90deg, #D1D5DB, #B0B7BE, #D1D5DB)' }} />}
          <div className="p-4 flex items-center justify-between text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #075E54, #128C7E, #00A884, #25D366)' }}>
            <div className="chat-header-shine absolute inset-0" />
            <h3 className="font-bold text-[17px] flex items-center gap-2.5 relative z-10"><Settings size={18} /> Chat Settings</h3>
            <button onClick={() => setShowSettingsPanel(false)} className="p-2 hover:bg-white/20 active:bg-white/30 rounded-xl transition-all relative z-10"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Font Size */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 flex items-center gap-2"><Type size={14} /> Font Size</span>
              <select value={chatSettings.fontSize} onChange={e => updateChatSettings({ fontSize: e.target.value as any })}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="small">Small</option><option value="medium">{t('task.medium')}</option><option value="large">Large</option>
              </select>
            </div>
            {/* Compact Mode */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 flex items-center gap-2"><Layout size={14} />{t('settings.compactMode')}</span>
              <input type="checkbox" checked={chatSettings.compactMode} onChange={e => updateChatSettings({ compactMode: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
            </label>
            {/* Sort By */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 flex items-center gap-2"><SortAsc size={14} /> Sort Chats</span>
              <select value={chatSettings.sortBy} onChange={e => updateChatSettings({ sortBy: e.target.value as any })}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="recent">Recent</option><option value="name">{t('common.name')}</option><option value="unread">{t('notifications.unreadTab')}</option>
              </select>
            </div>
            {/* Read Receipts */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 flex items-center gap-2"><CheckCheck size={14} /> Read Receipts</span>
              <input type="checkbox" checked={chatSettings.readReceipts} onChange={e => updateChatSettings({ readReceipts: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
            </label>
            {/* Notification Sound */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 flex items-center gap-2"><Volume2 size={14} /> Notification Sound</span>
              <input type="checkbox" checked={chatSettings.notificationSound} onChange={e => updateChatSettings({ notificationSound: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
            </label>
            {/* Link Previews */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 flex items-center gap-2"><Link2 size={14} /> Show Link Previews</span>
              <input type="checkbox" checked={chatSettings.showLinkPreviews} onChange={e => updateChatSettings({ showLinkPreviews: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
            </label>
            {/* Theme */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 flex items-center gap-2">{chatSettings.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />} Theme</span>
              <select value={chatSettings.theme} onChange={e => updateChatSettings({ theme: e.target.value as any })}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="light">Light</option><option value="dark">Dark</option><option value="auto">Auto</option>
              </select>
            </div>
            {/* Auto Reply */}
            <div>
              <span className="text-sm text-slate-700 flex items-center gap-2 mb-1"><MessageSquare size={14} /> Auto-Reply Message</span>
              <input type="text" value={chatSettings.autoReply || ''} onChange={e => updateChatSettings({ autoReply: e.target.value })}
                placeholder="Leave empty to disable" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Templates Panel ──

  const renderTemplatesPanel = () => {
    if (!showTemplates) return null;
    const templates = getMessageTemplates();
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowTemplates(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[80vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Sparkles size={18} /> Quick Templates</h3>
            <button onClick={() => setShowTemplates(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-2 max-h-[60vh] overflow-y-auto chat-scrollbar">
            {templates.map((tx, i) => (
              <button key={i} onClick={() => { setMessageText(t); setShowTemplates(false); }}
                className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl text-sm text-slate-700 border-b border-slate-50 transition-all">
                <span className="text-emerald-600 font-medium mr-1">#{i+1}</span> {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Broadcast Modal ──

  const renderBroadcastModal = () => {
    if (!showBroadcast) return null;
    const [broadcastMsg, setBroadcastMsg] = React.useState('');
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowBroadcast(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-md'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Zap size={18} /> Broadcast Message</h3>
            <button onClick={() => setShowBroadcast(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Type your broadcast message..."
              className="w-full text-[15px] border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-300 resize-none h-24" />
            <p className="text-xs text-slate-400">Select chats to broadcast to:</p>
            <div className="max-h-40 overflow-y-auto chat-scrollbar space-y-1">
              {rooms.map(r => (
                <label key={r.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${broadcastRoomIds.has(r.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                  <input type="checkbox" checked={broadcastRoomIds.has(r.id)} onChange={() => {
                    const s = new Set(broadcastRoomIds);
                    s.has(r.id) ? s.delete(r.id) : s.add(r.id);
                    setBroadcastRoomIds(s);
                  }} className="w-4 h-4 rounded text-blue-600" />
                  <span className="text-sm text-slate-700 truncate">{getRoomName(r)}</span>
                </label>
              ))}
            </div>
            <button onClick={() => { if (broadcastMsg.trim() && broadcastRoomIds.size > 0) { handleBroadcast(broadcastMsg, broadcastRoomIds); setShowBroadcast(false); setBroadcastRoomIds(new Set()); } }}
              disabled={!broadcastMsg.trim() || broadcastRoomIds.size === 0}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-sm disabled:opacity-40 hover:shadow-lg transition-all">
              Send to {broadcastRoomIds.size} chat{broadcastRoomIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Poll Creator ──

  const renderPollCreator = () => {
    if (!showPollCreator) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowPollCreator(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><BarChart3 size={18} /> Create Poll</h3>
            <button onClick={() => setShowPollCreator(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question..."
              className="w-full text-[15px] border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-300 font-medium" />
            {pollOptions.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={o} onChange={e => { const opts = [...pollOptions]; opts[i] = e.target.value; setPollOptions(opts); }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 text-[15px] border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-300" />
                {pollOptions.length > 2 && (
                  <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-sm text-violet-600 font-medium flex items-center gap-1">
                <Plus size={14} /> Add Option
              </button>
            )}
            <button onClick={() => { handleCreatePoll(); setShowPollCreator(false); }}
              disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl font-bold text-sm disabled:opacity-40 hover:shadow-lg transition-all">
              Create Poll
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Media Gallery ──

  const renderMediaGallery = () => {
    if (!showMediaGallery || !selectedRoom) return null;
    const mediaMessages = messages.filter(m => m.type === 'image' || m.type === 'file' || m.type === 'voice');
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowMediaGallery(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[90vh]' : 'rounded-3xl max-w-md'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Image size={18} /> Media Gallery ({mediaMessages.length})</h3>
            <button onClick={() => setShowMediaGallery(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-3 max-h-[60vh] overflow-y-auto chat-scrollbar">
            {mediaMessages.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No media shared yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaMessages.filter(m => m.type === 'image').map(m => (
                  <img key={m.id} src={m.fileURL} alt="" onClick={() => m.fileURL && setPreviewFile({ url: m.fileURL, name: m.fileName || 'Image', type: 'image' })}
                    className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-all" />
                ))}
              </div>
            )}
            {mediaMessages.filter(m => m.type === 'file').length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-bold text-slate-500 mb-1">Files</p>
                {mediaMessages.filter(m => m.type === 'file').map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-sm cursor-pointer hover:bg-slate-100 transition-all"
                    onClick={() => m.fileURL && setPreviewFile({ url: m.fileURL, name: m.fileName || 'File', type: 'file' })}>
                    <FileText size={14} className="text-blue-500" />
                    <span className="truncate text-slate-700">{m.fileName}</span>
                    <span className="text-[10px] text-slate-400 ml-auto">{m.fileSize ? formatFileSize(m.fileSize) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Chat Stats ──

  const renderChatStats = () => {
    if (!showChatStats || !selectedRoom) return null;
    const totalMsgs = messages.length;
    const textMsgs = messages.filter(m => m.type === 'text').length;
    const imgMsgs = messages.filter(m => m.type === 'image').length;
    const voiceMsgs = messages.filter(m => m.type === 'voice').length;
    const fileMsgs = messages.filter(m => m.type === 'file').length;
    const byUser: Record<string, number> = {};
    messages.forEach(m => { byUser[m.senderName || m.senderId] = (byUser[m.senderName || m.senderId] || 0) + 1; });

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowChatStats(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><BarChart3 size={18} /> Chat Statistics</h3>
            <button onClick={() => setShowChatStats(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-blue-600">{totalMsgs}</p><p className="text-[10px] text-blue-400 font-bold">{t('common.total')}</p></div>
              <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-green-600">{textMsgs}</p><p className="text-[10px] text-green-400 font-bold">Text</p></div>
              <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-purple-600">{imgMsgs}</p><p className="text-[10px] text-purple-400 font-bold">Images</p></div>
              <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-amber-600">{voiceMsgs}</p><p className="text-[10px] text-amber-400 font-bold">Voice</p></div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Messages by User</p>
              {Object.entries(byUser).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-sm text-slate-700">{name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-emerald-200 rounded-full" style={{ width: `${Math.max(20, (count / totalMsgs) * 120)}px` }} />
                    <span className="text-xs font-bold text-slate-500">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Group Settings ──

  const renderGroupSettings = () => {
    if (!showGroupSettings || !selectedRoom || selectedRoom.type !== 'group') return null;
    const isAdmin = (selectedRoom as any).admins?.includes(userId) || selectedRoom.createdBy === userId;

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowGroupSettings(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[90vh]' : 'rounded-3xl max-w-md'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Settings size={18} /> Group Settings</h3>
            <button onClick={() => setShowGroupSettings(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto chat-scrollbar">
            {/* Group Name */}
            {isAdmin && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Group Name</label>
                <div className="flex gap-2">
                  <input type="text" defaultValue={selectedRoom.name} id="grpNameInput"
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button onClick={() => {
                    const inp = document.getElementById('grpNameInput') as HTMLInputElement;
                    if (inp?.value.trim()) updateGroupName(selectedRoom.id, inp.value.trim());
                  }} className="px-3 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold">{t('common.save')}</button>
                </div>
              </div>
            )}
            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">{t('entry.description')}</label>
              <div className="flex gap-2">
                <input type="text" defaultValue={(selectedRoom as any).description || ''} id="grpDescInput" placeholder="Add group description..."
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" disabled={!isAdmin} />
                {isAdmin && <button onClick={() => {
                  const inp = document.getElementById('grpDescInput') as HTMLInputElement;
                  updateGroupDescription(selectedRoom.id, inp?.value || '');
                }} className="px-3 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold">{t('common.save')}</button>}
              </div>
            </div>
            {/* Members */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500">Members ({selectedRoom.members.length})</label>
                {isAdmin && <button onClick={() => setShowAddMember(true)} className="text-xs text-indigo-600 font-bold flex items-center gap-1"><UserPlus size={12} />{t('common.add')}</button>}
              </div>
              <div className="space-y-1">
                {selectedRoom.members.map(mid => {
                  const name = selectedRoom.memberNames?.[mid] || mid;
                  const isAdminMember = (selectedRoom as any).admins?.includes(mid) || mid === selectedRoom.createdBy;
                  return (
                    <div key={mid} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                          {name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm text-slate-700 font-medium">{name}{mid === userId ? ' (You)' : ''}</span>
                          {isAdminMember && <span className="ml-1 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">Admin</span>}
                        </div>
                      </div>
                      {isAdmin && mid !== userId && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => {
                            const admins = (selectedRoom as any).admins || [];
                            const newAdmins = admins.includes(mid) ? admins.filter((a: string) => a !== mid) : [...admins, mid];
                            setGroupAdmins(selectedRoom.id, newAdmins);
                          }} className="p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-400" title="Toggle Admin">
                            <Shield size={12} />
                          </button>
                          <button onClick={() => { removeGroupMember(selectedRoom.id, mid); }}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-400" title="Remove">
                            <UserMinus size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Disappearing Messages */}
            {isAdmin && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 flex items-center gap-2"><Timer size={14} /> Disappearing Messages</span>
                <select defaultValue={(selectedRoom as any).disappearing || 0}
                  onChange={e => setDisappearingMessages(selectedRoom.id, parseInt(e.target.value))}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none">
                  <option value={0}>Off</option>
                  <option value={3600}>1 hour</option>
                  <option value={86400}>24 hours</option>
                  <option value={604800}>7 days</option>
                </select>
              </div>
            )}
            {/* Leave Group */}
            <button onClick={() => { if (confirm('Leave this group?')) { leaveGroup(selectedRoom.id, userId); setSelectedRoom(null); setShowGroupSettings(false); } }}
              className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2">
              <LogOut size={14} /> Leave Group
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Add Member Modal ──

  const renderAddMemberModal = () => {
    if (!showAddMember || !selectedRoom) return null;
    const nonMembers = allUsers.filter(u => !selectedRoom.members.includes(u.id));
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[160] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowAddMember(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[80vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><UserPlus size={18} /> Add Member</h3>
            <button onClick={() => setShowAddMember(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-2 max-h-[50vh] overflow-y-auto chat-scrollbar">
            {nonMembers.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">All staff already in group</p>
            ) : nonMembers.map(u => (
              <button key={u.id} onClick={() => { addGroupMember(selectedRoom.id, u.id, u.name); setShowAddMember(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50 rounded-xl text-left transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold">{u.name?.charAt(0)}</div>
                <div><p className="text-[15px] font-semibold text-slate-800">{u.name}</p><p className="text-xs text-slate-400">{u.role}</p></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Wallpaper Picker ──

  const renderWallpaperPicker = () => {
    if (!showWallpaperPicker || !selectedRoom) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowWallpaperPicker(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[80vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Palette size={18} /> Chat Wallpaper</h3>
            <button onClick={() => setShowWallpaperPicker(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 grid grid-cols-4 gap-2">
            {CHAT_WALLPAPERS.map(w => (
              <button key={w.id} onClick={() => { setChatWallpaper(selectedRoom.id, userId, w.id); setShowWallpaperPicker(false); }}
                className="aspect-square rounded-xl border-2 border-transparent hover:border-pink-400 transition-all hover:scale-105 overflow-hidden"
                style={{ background: w.bg }} title={w.label}>
                <div className="w-full h-full flex items-end justify-center pb-1">
                  <span className="text-[8px] font-bold text-white/80 bg-black/20 px-1.5 py-0.5 rounded-full">{w.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: GIF Picker ──

  const renderGifPicker = () => {
    if (!showGifPicker) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowGifPicker(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Sparkles size={18} /> GIF</h3>
            <button onClick={() => setShowGifPicker(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-3">
            <div className="flex gap-2 mb-3">
              <input value={gifSearch} onChange={e => setGifSearch(e.target.value)} placeholder="Search GIFs..."
                className="flex-1 text-[15px] border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-pink-300" />
              <button onClick={() => handleGifSearch(gifSearch)} className="px-4 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-bold">
                <Search size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] sm:max-h-60 overflow-y-auto chat-scrollbar">
              {gifResults.map((g, i) => (
                <img key={i} src={g.preview || g.url} alt="" onClick={() => handleSendGif(g.url)}
                  className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-all" />
              ))}
              {gifResults.length === 0 && <p className="col-span-2 text-center text-sm text-slate-400 py-8">Search for GIFs...</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Sticker Picker ──

  const renderStickerPicker = () => {
    if (!showStickerPicker) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowStickerPicker(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[80vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">Stickers</h3>
            <button onClick={() => setShowStickerPicker(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-3 max-h-[50vh] overflow-y-auto chat-scrollbar">
            {STICKER_PACKS.map(pack => (
              <div key={pack.name} className="mb-3">
                <p className="text-xs font-bold text-slate-500 mb-1.5">{pack.name}</p>
                <div className="grid grid-cols-6 gap-1">
                  {pack.stickers.map((s, i) => (
                    <button key={i} onClick={() => handleSendSticker(s.url, s.emoji)}
                      className="text-2xl p-2 hover:bg-amber-50 rounded-xl transition-all hover:scale-110">
                      {s.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Status Composer ──

  const renderStatusComposer = () => {
    if (!showStatusComposer) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowStatusComposer(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Radio size={18} /> Set Status</h3>
            <button onClick={() => setShowStatusComposer(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <textarea value={statusText} onChange={e => setStatusText(e.target.value)} placeholder="What's on your mind?"
              className="w-full text-[15px] border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-300 resize-none h-24" />
            <div className="flex flex-wrap gap-1">
              {['Available', 'In a meeting', 'On site visit', 'Busy', 'Back soon'].map(s => (
                <button key={s} onClick={() => setStatusText(s)} className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-all">{s}</button>
              ))}
            </div>
            <button onClick={() => { handlePostStatus(); setShowStatusComposer(false); }}
              disabled={!statusText.trim()}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-2xl font-bold text-sm disabled:opacity-40 hover:shadow-lg transition-all">
              Post Status
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Status List ──

  const renderStatusList = () => {
    if (!showStatusList) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => setShowStatusList(false)}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl max-h-[85vh]' : 'rounded-3xl max-w-sm'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Radio size={18} /> Status Updates</h3>
            <button onClick={() => setShowStatusList(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-2 max-h-[60vh] overflow-y-auto chat-scrollbar">
            {userStatuses.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No status updates</p>
            ) : userStatuses.map(s => (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-all">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(s.userName || '?').charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{s.userName}</p>
                  <p className="text-sm text-slate-600">{s.text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(s.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Lock Prompt ──

  const renderLockPrompt = () => {
    if (!showLockPrompt) return null;
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4 chat-fade-in" onClick={() => { setShowLockPrompt(null); setLockPinInput(''); }}>
        <div className={`bg-white shadow-2xl w-full overflow-hidden chat-slide-up sm:chat-bounce-in ${isMobileView ? 'rounded-t-3xl' : 'rounded-3xl max-w-xs'}`} onClick={e => e.stopPropagation()}>
          {isMobileView && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-[#D1D5DB] rounded-full" /></div>}
          <div className="p-4 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Lock size={18} /> Locked Chat</h3>
            <button onClick={() => { setShowLockPrompt(null); setLockPinInput(''); }} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-slate-600 text-center">Enter PIN to unlock this chat</p>
            <input type="password" maxLength={4} value={lockPinInput} onChange={e => setLockPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="****" className="w-full text-center text-3xl tracking-[0.5em] font-mono border border-slate-200 rounded-xl px-3 py-4 outline-none focus:ring-2 focus:ring-emerald-300" autoFocus />
            <button onClick={() => {
              handleUnlockChat(showLockPrompt, lockPinInput);
              setLockPinInput('');
            }} disabled={lockPinInput.length !== 4}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-sm disabled:opacity-40 hover:shadow-lg transition-all">
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: @Mention Suggestion ──

  const renderMentionSuggestions = () => {
    if (!showMentionSuggest || !selectedRoom || selectedRoom.type !== 'group') return null;
    const memberList = selectedRoom.members.filter(m => m !== userId)
      .map(m => ({ id: m, name: selectedRoom.memberNames?.[m] || m }))
      .filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));
    if (memberList.length === 0) return null;

    return (
      <div className="absolute bottom-full left-0 right-0 bg-white rounded-t-2xl shadow-2xl border border-slate-200 z-50 max-h-40 overflow-y-auto chat-scrollbar chat-bounce-in">
        {memberList.map(m => (
          <button key={m.id} onClick={() => handleMentionInsert(m.name)}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-50 text-left transition-all">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-[10px] font-bold">{m.name.charAt(0)}</div>
            <span className="text-sm text-slate-700 font-medium">{m.name}</span>
          </button>
        ))}
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────

  return (
    <div className={`${fullScreen || embedded ? '' : 'bg-white shadow-lg border border-[#E9EDEF] rounded-xl'} overflow-hidden chat-container`} style={{ height: fullScreen || embedded ? '100%' : 'calc(100vh - 140px)', minHeight: fullScreen || embedded ? undefined : '500px' }}>
      <div className="flex h-full relative" style={{ height: '100%' }}>
        {renderChatList()}
        {(selectedRoom || !isMobileView) && renderChatView()}
        {renderContextMenu()}
        {renderRoomMenu()}
        {renderNewChatModal()}
        {renderNewGroupModal()}
        {renderForwardModal()}
        {renderMsgInfoModal()}
        {renderSettingsPanel()}
        {renderTemplatesPanel()}
        {renderBroadcastModal()}
        {renderPollCreator()}
        {renderMediaGallery()}
        {renderChatStats()}
        {renderGroupSettings()}
        {renderAddMemberModal()}
        {renderWallpaperPicker()}
        {renderGifPicker()}
        {renderStickerPicker()}
        {renderStatusComposer()}
        {renderStatusList()}
        {renderLockPrompt()}
      </div>

      {/* Pending file preview before send */}
      {renderPendingFilePreview()}

      {/* Voice preview before send */}
      {renderVoicePreview()}

      {/* File Preview Overlay (supports images + documents) */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex flex-col chat-fade-in"
          onClick={() => setPreviewFile(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/60 to-transparent" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 min-w-0">
              {previewFile.type === 'image' ? <Image size={18} className="text-white/70 flex-shrink-0" /> : <FileText size={18} className="text-white/70 flex-shrink-0" />}
              <span className="text-white text-sm font-semibold truncate">{previewFile.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={previewFile.url}
                download={previewFile.name}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 text-white hover:scale-105"
                onClick={e => e.stopPropagation()}
              >
                <Download size={20} />
              </a>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 text-white hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={e => e.stopPropagation()}>
            {previewFile.type === 'image' ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl chat-preview-in"
              />
            ) : (
              <iframe
                src={previewFile.url}
                title={previewFile.name}
                className="w-full h-full max-w-4xl rounded-2xl shadow-2xl bg-white chat-preview-in"
                style={{ minHeight: '80vh' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffChat;
