import { db } from '../firebase';
import {
  collection, getDocs, doc, setDoc, addDoc, deleteDoc,
  query, orderBy, where, onSnapshot, updateDoc,
  serverTimestamp, getDoc, writeBatch, limit, Timestamp
} from 'firebase/firestore';

// ── Types ────────────────────────────────────────────────
export interface ChatRoom {
  id: string;
  type: 'direct' | 'group';
  name?: string;           // group name (building name, etc.)
  avatar?: string;         // group avatar URL
  buildingId?: string;     // if it's a building group chat
  members: string[];       // user IDs
  memberNames?: Record<string, string>;  // id→name map
  createdAt: any;
  createdBy: string;
  lastMessage?: string;
  lastMessageAt?: any;
  lastMessageBy?: string;
  typing?: Record<string, boolean>;
  unreadCounts?: Record<string, number>;  // userId → unread count
  pinned?: string[];       // user IDs who pinned this chat
  muted?: string[];        // user IDs who muted this chat
  archived?: string[];     // user IDs who archived this chat
  locked?: string[];       // user IDs who locked this chat
  description?: string;    // group description
  admins?: string[];       // group admin user IDs
  disappearing?: number;   // disappearing message timeout (minutes), 0=off
  wallpaper?: Record<string, string>; // userId → wallpaper key
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: 'text' | 'image' | 'voice' | 'file' | 'system' | 'poll' | 'location' | 'contact' | 'gif' | 'sticker';
  text?: string;
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;      // voice msg duration in seconds
  replyTo?: { id: string; text: string; senderName: string };
  reactions?: Record<string, string[]>;  // emoji → userId[]
  readBy?: string[];      // user IDs that have read this msg
  deleted?: boolean;
  editedAt?: any;
  createdAt: any;
  starredBy?: string[];
  forwarded?: boolean;
  forwardedFrom?: string;
  mentions?: string[];     // mentioned user IDs
  scheduled?: any;         // scheduled send time
  poll?: { question: string; options: string[]; votes: Record<string, string[]> }; // poll data
  location?: { lat: number; lng: number; name?: string }; // location data
  contact?: { name: string; role?: string; id?: string }; // shared contact
}

// Chat settings per user (stored in localStorage)
export interface ChatSettings {
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  sortBy: 'recent' | 'name' | 'unread';
  readReceipts: boolean;
  notificationSound: 'default' | 'chime' | 'bell' | 'silent';
  autoReply: string;
  autoReplyEnabled: boolean;
  theme: 'light' | 'dark' | 'emerald';
  showLinkPreviews: boolean;
  chatFilter: 'all' | 'unread' | 'groups' | 'direct';
}

export const defaultChatSettings: ChatSettings = {
  fontSize: 'medium',
  compactMode: false,
  sortBy: 'recent',
  readReceipts: true,
  notificationSound: 'default',
  autoReply: '',
  autoReplyEnabled: false,
  theme: 'light',
  showLinkPreviews: true,
  chatFilter: 'all',
};

export const getChatSettings = (): ChatSettings => {
  try {
    const saved = localStorage.getItem('amlak-chat-settings');
    return saved ? { ...defaultChatSettings, ...JSON.parse(saved) } : defaultChatSettings;
  } catch { return defaultChatSettings; }
};

export const saveChatSettings = (settings: Partial<ChatSettings>) => {
  const current = getChatSettings();
  localStorage.setItem('amlak-chat-settings', JSON.stringify({ ...current, ...settings }));
};

// Message templates
export const defaultMessageTemplates = [
  { id: '1', text: '👋 Hello! How can I help you?', label: 'Greeting' },
  { id: '2', text: '✅ Done, I\'ve completed the task.', label: 'Task Done' },
  { id: '3', text: '🔧 I\'m working on it now.', label: 'Working' },
  { id: '4', text: '📋 Please send me the details.', label: 'Request Info' },
  { id: '5', text: '🏢 I\'ll check the building and update you.', label: 'Building Check' },
  { id: '6', text: '⏰ I\'ll be there in 15 minutes.', label: 'ETA 15min' },
  { id: '7', text: '🔑 The keys have been handed over.', label: 'Keys Handover' },
  { id: '8', text: '💰 Rent has been collected.', label: 'Rent Collected' },
  { id: '9', text: '📞 Can we talk on a call?', label: 'Call Request' },
  { id: '10', text: '🚨 Urgent: Please respond ASAP!', label: 'Urgent' },
];

export const getMessageTemplates = () => {
  try {
    const saved = localStorage.getItem('amlak-chat-templates');
    return saved ? JSON.parse(saved) : defaultMessageTemplates;
  } catch { return defaultMessageTemplates; }
};

export const saveMessageTemplates = (templates: any[]) => {
  localStorage.setItem('amlak-chat-templates', JSON.stringify(templates));
};

// Sticker packs — real sticker images from open sticker CDN
export const STICKER_PACKS: { name: string; stickers: { url: string; emoji: string }[] }[] = [
  {
    name: '👋 Greetings',
    stickers: [
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44b/512.gif', emoji: '👋' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif', emoji: '👍' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44e/512.gif', emoji: '👎' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44f/512.gif', emoji: '👏' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f64f/512.gif', emoji: '🙏' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f91d/512.gif', emoji: '🤝' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4aa/512.gif', emoji: '💪' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f919/512.gif', emoji: '🤙' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/270c_fe0f/512.gif', emoji: '✌️' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f918/512.gif', emoji: '🤘' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1faf6/512.gif', emoji: '🫶' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f90c/512.gif', emoji: '🤌' },
    ],
  },
  {
    name: '😊 Faces',
    stickers: [
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif', emoji: '😀' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif', emoji: '😂' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.gif', emoji: '🥰' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif', emoji: '😎' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/512.gif', emoji: '🤔' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.gif', emoji: '😭' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f631/512.gif', emoji: '😱' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f621/512.gif', emoji: '😡' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.gif', emoji: '🥳' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.gif', emoji: '😍' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.gif', emoji: '🤯' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f971/512.gif', emoji: '🥱' },
    ],
  },
  {
    name: '🔥 Reactions',
    stickers: [
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif', emoji: '🔥' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2b50/512.gif', emoji: '⭐' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.gif', emoji: '💯' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif', emoji: '🚀' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif', emoji: '🎉' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif', emoji: '❤️' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.gif', emoji: '💎' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3c6/512.gif', emoji: '🏆' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f381/512.gif', emoji: '🎁' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a5/512.gif', emoji: '💥' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4ab/512.gif', emoji: '💫' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2728/512.gif', emoji: '✨' },
    ],
  },
  {
    name: '🏢 Work',
    stickers: [
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3d7_fe0f/512.gif', emoji: '🏗️' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f511/512.gif', emoji: '🔑' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b0/512.gif', emoji: '💰' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3e0/512.gif', emoji: '🏠' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f697/512.gif', emoji: '🚗' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4f1/512.gif', emoji: '📱' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f514/512.gif', emoji: '🔔' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2705/512.gif', emoji: '✅' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/274c/512.gif', emoji: '❌' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/26a0_fe0f/512.gif', emoji: '⚠️' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4de/512.gif', emoji: '📞' },
      { url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f6e0_fe0f/512.gif', emoji: '🛠️' },
    ],
  },
];

// Chat wallpapers
export const CHAT_WALLPAPERS: { id: string; label: string; bg: string }[] = [
  { id: 'default', label: 'Default', bg: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 30%, #f0fdfa 60%, #f0f9ff 100%)' },
  { id: 'ocean', label: 'Ocean', bg: 'linear-gradient(135deg, #e0f2fe 0%, #e0e7ff 50%, #ede9fe 100%)' },
  { id: 'sunset', label: 'Sunset', bg: 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 50%, #fae8ff 100%)' },
  { id: 'forest', label: 'Forest', bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)' },
  { id: 'midnight', label: 'Midnight', bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)' },
  { id: 'sand', label: 'Sand', bg: 'linear-gradient(135deg, #fef9c3 0%, #fed7aa 50%, #fdba74 100%)' },
  { id: 'slate', label: 'Slate', bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)' },
  { id: 'rose', label: 'Rose', bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 50%, #fda4af 100%)' },
];

// ── Presence ─────────────────────────────────────────────

/** Set user as online — call when entering chat, heartbeat every 60s */
export const setPresence = async (userId: string, userName: string, online: boolean) => {
  try {
    await setDoc(doc(db, 'chatPresence', userId), {
      online,
      userName,
      lastSeen: serverTimestamp(),
    }, { merge: true });
  } catch { /* ignore */ }
};

/** Listen to a single user's presence */
export const listenPresence = (userId: string, callback: (data: { online: boolean; lastSeen: any } | null) => void) => {
  return onSnapshot(doc(db, 'chatPresence', userId), snap => {
    callback(snap.exists() ? (snap.data() as any) : null);
  });
};

/** Listen to all users' presence */
export const listenAllPresence = (callback: (map: Record<string, { online: boolean; lastSeen: any }>) => void) => {
  return onSnapshot(collection(db, 'chatPresence'), snap => {
    const map: Record<string, { online: boolean; lastSeen: any }> = {};
    snap.docs.forEach(d => { map[d.id] = d.data() as any; });
    callback(map);
  });
};

// ── Chat Notifications ───────────────────────────────────

/** Send browser notification to the current user for an incoming chat message */
export const showChatNotification = (senderName: string, message: string, roomName: string) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
    return;
  }
  try {
    const title = `💬 ${senderName}`;
    const body = roomName ? `[${roomName}] ${message}` : message;
    navigator.serviceWorker?.getRegistration?.().then(reg => {
      if (reg) {
        reg.showNotification(title, {
          body,
          icon: '/images/logo-192.png',
          badge: '/images/logo-192.png',
          vibrate: [100, 50, 100],
          tag: `chat-${Date.now()}`,
          renotify: true,
          silent: false,
          timestamp: Date.now(),
          data: { url: `${self.location?.origin || ''}/#/chat` },
        } as any);
      } else {
        new Notification(title, { body, icon: '/images/logo-192.png' });
      }
    }).catch(() => {
      new Notification(title, { body, icon: '/images/logo-192.png' });
    });
  } catch {
    try { new Notification(`💬 ${senderName}`, { body: message }); } catch { /* skip */ }
  }
};

// ── Chat Rooms ───────────────────────────────────────────

/** Create or return existing direct chat between two users */
export const getOrCreateDirectChat = async (
  userId1: string, userName1: string,
  userId2: string, userName2: string
): Promise<string> => {

  // Check if DM already exists
  const q = query(
    collection(db, 'chatRooms'),
    where('type', '==', 'direct'),
    where('members', 'array-contains', userId1)
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => {
    const data = d.data();
    return data.members?.includes(userId2);
  });
  if (existing) return existing.id;

  // Create new DM
  const ref = await addDoc(collection(db, 'chatRooms'), {
    type: 'direct',
    members: [userId1, userId2],
    memberNames: { [userId1]: userName1, [userId2]: userName2 },
    createdAt: serverTimestamp(),
    createdBy: userId1,
  });
  return ref.id;
};

/** Create a building group chat */
export const createBuildingGroupChat = async (
  buildingId: string,
  buildingName: string,
  memberIds: string[],
  memberNames: Record<string, string>,
  createdBy: string
): Promise<string> => {

  // Check if group already exists for this building
  const q = query(
    collection(db, 'chatRooms'),
    where('type', '==', 'group'),
    where('buildingId', '==', buildingId)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    // If there are duplicates, merge into the first one and delete the rest
    const primaryDoc = snap.docs[0];
    const primaryData = primaryDoc.data();
    let allMembers = [...new Set([...(primaryData.members || []), ...memberIds])];
    let allNames = { ...(primaryData.memberNames || {}), ...memberNames };

    // Merge members from duplicate rooms, then delete duplicates
    if (snap.docs.length > 1) {
      for (let i = 1; i < snap.docs.length; i++) {
        const dupData = snap.docs[i].data();
        allMembers = [...new Set([...allMembers, ...(dupData.members || [])])];
        allNames = { ...allNames, ...(dupData.memberNames || {}) };
        // Delete duplicate room
        try { await deleteDoc(doc(db, 'chatRooms', snap.docs[i].id)); } catch { /* skip */ }
      }
    }

    await updateDoc(doc(db, 'chatRooms', primaryDoc.id), { members: allMembers, memberNames: allNames });
    return primaryDoc.id;
  }

  const ref = await addDoc(collection(db, 'chatRooms'), {
    type: 'group',
    name: buildingName,
    buildingId,
    members: memberIds,
    memberNames,
    createdAt: serverTimestamp(),
    createdBy,
  });
  return ref.id;
};

/** Create a custom group chat */
export const createGroupChat = async (
  name: string,
  memberIds: string[],
  memberNames: Record<string, string>,
  createdBy: string
): Promise<string> => {

  const ref = await addDoc(collection(db, 'chatRooms'), {
    type: 'group',
    name,
    members: memberIds,
    memberNames,
    createdAt: serverTimestamp(),
    createdBy,
  });
  return ref.id;
};

/** Listen to all rooms the user is a member of */
export const listenChatRooms = (userId: string, callback: (rooms: ChatRoom[]) => void) => {

  const q = query(
    collection(db, 'chatRooms'),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(q, snap => {
    let rooms = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatRoom));
    // Deduplicate building groups — keep only the one with the latest activity
    const buildingRoomMap = new Map<string, ChatRoom>();
    const nonBuildingRooms: ChatRoom[] = [];
    for (const room of rooms) {
      if (room.type === 'group' && room.buildingId) {
        const existing = buildingRoomMap.get(room.buildingId);
        if (!existing) {
          buildingRoomMap.set(room.buildingId, room);
        } else {
          // Keep the one with more messages (lastMessageAt) or earlier creation
          const existingTs = existing.lastMessageAt?.toMillis?.() || existing.lastMessageAt?.seconds ? (existing.lastMessageAt.seconds || 0) * 1000 : 0;
          const newTs = room.lastMessageAt?.toMillis?.() || room.lastMessageAt?.seconds ? (room.lastMessageAt.seconds || 0) * 1000 : 0;
          if (newTs > existingTs) {
            buildingRoomMap.set(room.buildingId, room);
          }
        }
      } else {
        nonBuildingRooms.push(room);
      }
    }
    rooms = [...nonBuildingRooms, ...buildingRoomMap.values()];
    // Sort by lastMessageAt descending
    rooms.sort((a, b) => {
      const at = a.lastMessageAt?.toMillis?.() || a.lastMessageAt || 0;
      const bt = b.lastMessageAt?.toMillis?.() || b.lastMessageAt || 0;
      return bt - at;
    });
    callback(rooms);
  });
};

// ── Messages ─────────────────────────────────────────────

/** Send a chat message */
export const sendMessage = async (
  roomId: string,
  msg: Omit<ChatMessage, 'id' | 'createdAt'>
): Promise<string> => {

  // Strip undefined fields — Firestore rejects them
  const cleanMsg: Record<string, any> = {};
  for (const [k, v] of Object.entries(msg)) {
    if (v !== undefined) cleanMsg[k] = v;
  }

  const ref = await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
    ...cleanMsg,
    createdAt: serverTimestamp(),
  });

  // Update room's last message + increment unread for other members
  const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
  const roomData = roomSnap.data();
  const unreadCounts: Record<string, number> = { ...(roomData?.unreadCounts || {}) };
  // Increment unread for every member except sender
  for (const memberId of (roomData?.members || [])) {
    if (memberId !== msg.senderId) {
      unreadCounts[memberId] = (unreadCounts[memberId] || 0) + 1;
    }
  }
  // Sender always has 0 unread
  unreadCounts[msg.senderId] = 0;

  await updateDoc(doc(db, 'chatRooms', roomId), {
    lastMessage: msg.type === 'text' ? (msg.text || '').slice(0, 100) :
                 msg.type === 'image' ? '📷 Photo' :
                 msg.type === 'voice' ? '🎤 Voice message' :
                 msg.type === 'file' ? `📎 ${msg.fileName || 'File'}` : '',
    lastMessageAt: serverTimestamp(),
    lastMessageBy: msg.senderId,
    unreadCounts,
  });

  return ref.id;
};

/** Listen to messages in a room (real-time) */
export const listenMessages = (
  roomId: string,
  callback: (msgs: ChatMessage[]) => void,
  msgLimit = 100
) => {

  const q = query(
    collection(db, 'chatRooms', roomId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(msgLimit)
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
    callback(msgs);
  });
};

/** Mark messages as read */
export const markMessagesRead = async (roomId: string, userId: string, messageIds: string[]) => {

  // Reset unread count for this user on the room
  try {
    const roomRef = doc(db, 'chatRooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const data = roomSnap.data();
      const unreadCounts = { ...(data?.unreadCounts || {}) };
      unreadCounts[userId] = 0;
      await updateDoc(roomRef, { unreadCounts });
    }
  } catch { /* skip */ }

  const batch = writeBatch(db);
  for (const mid of messageIds.slice(0, 500)) {
    const ref = doc(db, 'chatRooms', roomId, 'messages', mid);
    // We use arrayUnion-like approach via update
    batch.update(ref, { readBy: [...new Set([userId])] }); // will merge
  }
  // Actually we want to use arrayUnion, but batch.update with arrayUnion works:
  // Let's do it one by one if not too many
  for (const mid of messageIds.slice(0, 50)) {
    try {
      const ref = doc(db, 'chatRooms', roomId, 'messages', mid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const readBy = [...new Set([...(data?.readBy || []), userId])];
        await updateDoc(ref, { readBy });
      }
    } catch { /* skip */ }
  }
};

/** Delete a message (soft-delete) */
export const deleteMessage = async (roomId: string, messageId: string) => {
  await updateDoc(doc(db, 'chatRooms', roomId, 'messages', messageId), {
    deleted: true,
    text: '',
    fileURL: '',
  });
};

/** Edit a message */
export const editMessage = async (roomId: string, messageId: string, newText: string) => {
  await updateDoc(doc(db, 'chatRooms', roomId, 'messages', messageId), {
    text: newText,
    editedAt: serverTimestamp(),
  });
};

/** Add reaction to a message */
export const toggleReaction = async (roomId: string, messageId: string, emoji: string, userId: string) => {
  const ref = doc(db, 'chatRooms', roomId, 'messages', messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const reactions = { ...(data?.reactions || {}) };
  if (!reactions[emoji]) reactions[emoji] = [];
  
  if (reactions[emoji].includes(userId)) {
    reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    reactions[emoji].push(userId);
  }
  await updateDoc(ref, { reactions });
};

/** Toggle star on a message for a specific user */
export const toggleStarMessage = async (roomId: string, messageId: string, usrId: string) => {
  const ref = doc(db, 'chatRooms', roomId, 'messages', messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const starredBy: string[] = data?.starredBy || [];
  if (starredBy.includes(usrId)) {
    await updateDoc(ref, { starredBy: starredBy.filter((id: string) => id !== usrId) });
  } else {
    await updateDoc(ref, { starredBy: [...starredBy, usrId] });
  }
};

// ── File Uploads (Cloudinary for all file types) ───

// Cloudinary settings — free 25GB storage
const CLOUDINARY_CLOUD_NAME = 'dygyd2ril';
const CLOUDINARY_UPLOAD_PRESET = 'amlak-chat';

/** Upload any file to Cloudinary — returns public URL */
const uploadToCloudinary = async (
  file: File | Blob,
  fileName: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
): Promise<string> => {
  console.log(`[AmlakChat] Uploading to Cloudinary: "${fileName}" (${file.size} bytes, type=${resourceType})`);

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'amlak-chat');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[AmlakChat] Cloudinary upload FAILED (${res.status}) for "${fileName}":`, errText);
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  const data = await res.json();
  if (data.error) {
    console.error('[AmlakChat] Cloudinary returned error:', data.error);
    throw new Error(`Cloudinary error: ${data.error.message}`);
  }

  const url = data.secure_url;
  console.log(`[AmlakChat] Cloudinary upload SUCCESS: "${fileName}" → ${url}`);
  return url;
};

/** Convert a Blob/File to a base64 data URL (last resort fallback) */
const toBase64DataURL = (file: File | Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
};

/** Upload image/voice/file — all via Cloudinary */
export const uploadChatFile = async (
  roomId: string,
  file: File,
  type: 'image' | 'voice' | 'file'
): Promise<string> => {

  const resourceType = type === 'image' ? 'image' : type === 'voice' ? 'video' : 'raw';
  const fileName = type === 'voice' ? `voice_${Date.now()}.webm` : `${Date.now()}_${file.name}`;

  try {
    return await uploadToCloudinary(file, fileName, resourceType);
  } catch (e) {
    console.error(`[AmlakChat] Cloudinary ${type} upload FAILED for "${file.name}", using base64 fallback:`, e);
    return toBase64DataURL(file);
  }
};

/** Upload voice recording blob — Cloudinary, base64 fallback */
export const uploadVoiceMessage = async (
  _roomId: string,
  blob: Blob,
  duration: number
): Promise<{ url: string; duration: number }> => {

  try {
    const fileName = `voice_${Date.now()}.webm`;
    console.log(`[AmlakChat] Uploading voice to Cloudinary (${blob.size} bytes, ${duration}s)`);
    const url = await uploadToCloudinary(blob, fileName, 'video');
    return { url, duration };
  } catch (e) {
    console.error('[AmlakChat] Cloudinary voice upload FAILED, using base64 fallback:', e);
    const url = await toBase64DataURL(blob);
    return { url, duration };
  }
};

// ── Typing Indicator ─────────────────────────────────────

export const setTyping = async (roomId: string, userId: string, isTyping: boolean) => {
  try {
    await updateDoc(doc(db, 'chatRooms', roomId), {
      [`typing.${userId}`]: isTyping,
    });
  } catch { /* ignore */ }
};

// ── Room Management ──────────────────────────────────────

export const updateRoomMembers = async (roomId: string, memberIds: string[], memberNames: Record<string, string>) => {
  await updateDoc(doc(db, 'chatRooms', roomId), { members: memberIds, memberNames });
};

export const deleteRoom = async (roomId: string) => {
  await deleteDoc(doc(db, 'chatRooms', roomId));
};

/** Get unread count for a user across all rooms */
export const getUnreadCount = async (userId: string): Promise<number> => {
  // This is a simplified approach - for production you'd use a counter
  let count = 0;
  try {
    const q = query(
      collection(db, 'chatRooms'),
      where('members', 'array-contains', userId)
    );
    const snap = await getDocs(q);
    for (const roomDoc of snap.docs) {
      const data = roomDoc.data();
      if (data.lastMessageBy && data.lastMessageBy !== userId) {
        count++;
      }
    }
  } catch { /* ignore */ }
  return count;
};

/** Listen to unread count changes */
export const listenUnreadCount = (userId: string, callback: (count: number) => void) => {
  const q = query(
    collection(db, 'chatRooms'),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(q, snap => {
    let count = 0;
    for (const roomDoc of snap.docs) {
      const data = roomDoc.data();
      if (data.lastMessageBy && data.lastMessageBy !== userId && data.lastMessageAt) {
        count++;
      }
    }
    callback(count);
  });
};

// ── Auto-create building groups ──────────────────────────

/** Sync building groups: create group chats for each building with assigned staff */
export const syncBuildingGroups = async (
  buildings: Array<{ id: string; name: string }>,
  users: Array<{ id: string; name: string; buildingId?: string; buildingIds?: string[]; role?: string }>
) => {

  for (const building of buildings) {
    // Find staff assigned to this building
    const assignedUsers = users.filter(u => {
      if (u.buildingIds?.includes(building.id)) return true;
      if (u.buildingId === building.id) return true;
      if (u.role === 'ADMIN') return true; // admins are in all groups
      return false;
    });

    if (assignedUsers.length === 0) continue;

    const memberIds = assignedUsers.map(u => u.id);
    const memberNames: Record<string, string> = {};
    assignedUsers.forEach(u => { memberNames[u.id] = u.name; });

    await createBuildingGroupChat(building.id, building.name, memberIds, memberNames, 'system');
  }
};

// ── Clear Chat ───────────────────────────────────────────

/** Clear all messages in a room (for current user or all) */
export const clearChat = async (roomId: string, userId: string) => {
  try {
    const q = query(collection(db, 'chatRooms', roomId, 'messages'));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    // Reset room's last message
    await updateDoc(doc(db, 'chatRooms', roomId), {
      lastMessage: '',
      lastMessageAt: null,
      lastMessageBy: '',
      unreadCounts: {},
    });
  } catch (e) { console.error('Clear chat failed:', e); }
};

// ── Pin/Unpin Chat ───────────────────────────────────────

export const togglePinChat = async (roomId: string, userId: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const pinned: string[] = snap.data()?.pinned || [];
  if (pinned.includes(userId)) {
    await updateDoc(ref, { pinned: pinned.filter(id => id !== userId) });
  } else {
    await updateDoc(ref, { pinned: [...pinned, userId] });
  }
};

// ── Mute/Unmute Chat ─────────────────────────────────────

export const toggleMuteChat = async (roomId: string, userId: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const muted: string[] = snap.data()?.muted || [];
  if (muted.includes(userId)) {
    await updateDoc(ref, { muted: muted.filter(id => id !== userId) });
  } else {
    await updateDoc(ref, { muted: [...muted, userId] });
  }
};

// ── Archive/Unarchive Chat ───────────────────────────────

export const toggleArchiveChat = async (roomId: string, userId: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const archived: string[] = snap.data()?.archived || [];
  if (archived.includes(userId)) {
    await updateDoc(ref, { archived: archived.filter(id => id !== userId) });
  } else {
    await updateDoc(ref, { archived: [...archived, userId] });
  }
};

// ── Lock/Unlock Chat ─────────────────────────────────────

export const toggleLockChat = async (roomId: string, userId: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const locked: string[] = snap.data()?.locked || [];
  if (locked.includes(userId)) {
    await updateDoc(ref, { locked: locked.filter(id => id !== userId) });
  } else {
    await updateDoc(ref, { locked: [...locked, userId] });
  }
};

// ── Group Admin ──────────────────────────────────────────

export const setGroupAdmins = async (roomId: string, adminIds: string[]) => {
  await updateDoc(doc(db, 'chatRooms', roomId), { admins: adminIds });
};

export const addGroupMember = async (roomId: string, memberId: string, memberName: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const members = [...new Set([...(data.members || []), memberId])];
  const memberNames = { ...(data.memberNames || {}), [memberId]: memberName };
  await updateDoc(ref, { members, memberNames });
};

export const removeGroupMember = async (roomId: string, memberId: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const members = (data.members || []).filter((id: string) => id !== memberId);
  const memberNames = { ...(data.memberNames || {}) };
  delete memberNames[memberId];
  await updateDoc(ref, { members, memberNames });
};

export const leaveGroup = async (roomId: string, userId: string) => {
  await removeGroupMember(roomId, userId);
};

export const updateGroupDescription = async (roomId: string, description: string) => {
  await updateDoc(doc(db, 'chatRooms', roomId), { description });
};

export const updateGroupName = async (roomId: string, name: string) => {
  await updateDoc(doc(db, 'chatRooms', roomId), { name });
};

// ── Disappearing Messages ────────────────────────────────

export const setDisappearingMessages = async (roomId: string, minutes: number) => {
  await updateDoc(doc(db, 'chatRooms', roomId), { disappearing: minutes });
};

// ── Chat Wallpaper ───────────────────────────────────────

export const setChatWallpaper = async (roomId: string, userId: string, wallpaperId: string) => {
  const ref = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(ref);
  const wallpaper = snap.exists() ? (snap.data()?.wallpaper || {}) : {};
  wallpaper[userId] = wallpaperId;
  await updateDoc(ref, { wallpaper });
};

// ── Export Chat ──────────────────────────────────────────

export const exportChat = (messages: ChatMessage[], roomName: string) => {
  let text = `Chat Export: ${roomName}\nExported: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;
  for (const msg of messages) {
    if (msg.deleted) continue;
    const time = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : '';
    const content = msg.type === 'text' ? msg.text :
                    msg.type === 'image' ? `[Image] ${msg.fileURL || ''}` :
                    msg.type === 'voice' ? `[Voice Message ${msg.duration || 0}s]` :
                    msg.type === 'file' ? `[File: ${msg.fileName}]` :
                    msg.type === 'poll' ? `[Poll: ${msg.poll?.question}]` :
                    msg.type === 'location' ? `[Location: ${msg.location?.lat},${msg.location?.lng}]` :
                    msg.type === 'contact' ? `[Contact: ${msg.contact?.name}]` :
                    msg.text || '[Message]';
    text += `[${time}] ${msg.senderName}: ${content}\n`;
  }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${roomName}_chat_export.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Chat Statistics ──────────────────────────────────────

export const getChatStats = (messages: ChatMessage[]) => {
  const totalMessages = messages.filter(m => !m.deleted).length;
  const textMessages = messages.filter(m => m.type === 'text' && !m.deleted).length;
  const imageMessages = messages.filter(m => m.type === 'image' && !m.deleted).length;
  const voiceMessages = messages.filter(m => m.type === 'voice' && !m.deleted).length;
  const fileMessages = messages.filter(m => m.type === 'file' && !m.deleted).length;
  const byUser: Record<string, number> = {};
  messages.filter(m => !m.deleted).forEach(m => {
    byUser[m.senderName] = (byUser[m.senderName] || 0) + 1;
  });
  return { totalMessages, textMessages, imageMessages, voiceMessages, fileMessages, byUser };
};

// ── Media Gallery ────────────────────────────────────────

export const getMediaMessages = (messages: ChatMessage[]) => {
  return messages.filter(m => !m.deleted && (m.type === 'image' || m.type === 'file' || m.type === 'voice'));
};

// ── Block/Report User ────────────────────────────────────

export const getBlockedUsers = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('amlak-blocked-users') || '[]');
  } catch { return []; }
};

export const toggleBlockUser = (userId: string) => {
  const blocked = getBlockedUsers();
  if (blocked.includes(userId)) {
    localStorage.setItem('amlak-blocked-users', JSON.stringify(blocked.filter(id => id !== userId)));
  } else {
    localStorage.setItem('amlak-blocked-users', JSON.stringify([...blocked, userId]));
  }
};

// ── Status/Story ─────────────────────────────────────────

export const setUserStatus = async (userId: string, userName: string, status: string) => {
  try {
    await setDoc(doc(db, 'chatStatuses', userId), {
      userId, userName, status,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
    });
  } catch { /* ignore */ }
};

export const listenStatuses = (callback: (statuses: any[]) => void) => {
  return onSnapshot(collection(db, 'chatStatuses'), snap => {
    const statuses = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter((s: any) => s.expiresAt?.toDate ? s.expiresAt.toDate() > new Date() : true);
    callback(statuses);
  });
};

// ── Broadcast Lists ──────────────────────────────────────

export const sendBroadcast = async (
  roomIds: string[],
  msg: Omit<ChatMessage, 'id' | 'createdAt'>
) => {
  for (const roomId of roomIds) {
    try {
      await sendMessage(roomId, { ...msg, roomId });
    } catch { /* skip failed */ }
  }
};

// ── GIF Search (Tenor API — free tier) ───────────────────

export const searchGifs = async (query: string): Promise<{ url: string; preview: string }[]> => {
  try {
    // Use Tenor's public API
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=20&media_filter=gif,tinygif`);
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
    }));
  } catch {
    return [];
  }
};
