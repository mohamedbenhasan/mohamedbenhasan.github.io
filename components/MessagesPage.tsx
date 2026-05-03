import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase';
import { conversationsService, Conversation, Message, UserProfile } from '../services/conversationsService';
import { Search, ArrowLeft, Send, User, Clock, Circle, MessageSquare } from 'lucide-react';

interface MessagesPageProps {
  onBack?: () => void;
}

export default function MessagesPage({ onBack }: MessagesPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  const [conversationUsers, setConversationUsers] = useState<Record<string, UserProfile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    if (!auth.currentUser) {
      if (onBack) onBack();
      return;
    }

    const unsubConvs = conversationsService.subscribeToConversations((convs) => {
      setConversations(convs);
      
      // Fetch missing user profiles
      convs.forEach(conv => {
        const otherId = conv.members.find(id => id !== auth.currentUser?.uid);
        if (otherId) {
          setConversationUsers(prev => {
            if (!prev[otherId]) {
              conversationsService.getUserProfile(otherId).then(profile => {
                if (profile) {
                  setConversationUsers(current => ({ ...current, [otherId]: profile }));
                }
              });
            }
            return prev;
          });
        }
      });
    });
    const unsubOnline = conversationsService.subscribeToOnlineUsers(setOnlineUsers);

    return () => {
      unsubConvs();
      unsubOnline();
    };
  }, [onBack]);

  // Handle search
  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length > 0) {
        const results = await conversationsService.searchUsers(searchQuery);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    };
    
    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Load active conversation messages and other user profile
  useEffect(() => {
    if (!activeConversationId) return;

    const unsubMessages = conversationsService.subscribeToMessages(activeConversationId, setMessages);
    
    // Find other user ID
    const conv = conversations.find(c => c.id === activeConversationId);
    if (conv && auth.currentUser) {
      const otherId = conv.members.find(id => id !== auth.currentUser?.uid);
      if (otherId) {
        conversationsService.getUserProfile(otherId).then(setOtherUser);
      }
    }

    return () => unsubMessages();
  }, [activeConversationId, conversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartConversation = async (userId: string) => {
    try {
      const convId = await conversationsService.getOrCreateDirectConversation(userId);
      setActiveConversationId(convId);
      setIsMobileListVisible(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || !newMessage.trim()) return;

    try {
      await conversationsService.sendMessage(activeConversationId, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const isOnline = (user: UserProfile) => {
    if (!user.lastActiveAt) return false;
    try {
      const lastActive = user.lastActiveAt.toDate ? user.lastActiveAt.toDate() : new Date(user.lastActiveAt);
      const now = new Date();
      const diffSeconds = (now.getTime() - lastActive.getTime()) / 1000;
      return user.online && diffSeconds < 60;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans pt-16">
      {/* Left Sidebar - List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col bg-slate-900/50 ${!isMobileListVisible ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white">Messages</h1>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Search Results */}
          {searchQuery && (
            <div className="p-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">Résultats</h3>
              {searchResults.length === 0 ? (
                <div className="text-sm text-slate-400 px-2">Aucun utilisateur trouvé</div>
              ) : (
                searchResults.map(user => (
                  <button
                    key={user.uid}
                    onClick={() => handleStartConversation(user.uid)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0 relative">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                      {isOnline(user) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{user.displayName || 'Utilisateur inconnu'}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Online Users */}
          {!searchQuery && onlineUsers.length > 0 && (
            <div className="p-2 border-b border-slate-800/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">En ligne</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 px-2 hide-scrollbar">
                {onlineUsers.map(user => (
                  <button
                    key={user.uid}
                    onClick={() => handleStartConversation(user.uid)}
                    className="flex flex-col items-center gap-1 min-w-[60px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center relative">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                    </div>
                    <span className="text-xs text-slate-300 truncate w-full text-center">{user.displayName?.split(' ')[0] || 'User'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversations List */}
          {!searchQuery && (
            <div className="p-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2 mt-2">Conversations</h3>
              {conversations.length === 0 ? (
                <div className="text-sm text-slate-400 px-2 text-center mt-4">Aucune conversation</div>
              ) : (
                conversations.map(conv => {
                  const otherId = conv.members.find(id => id !== auth.currentUser?.uid);
                  const userProfile = otherId ? conversationUsers[otherId] : null;
                  
                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setActiveConversationId(conv.id);
                        setIsMobileListVisible(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left mb-1 ${activeConversationId === conv.id ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center shrink-0 relative">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt={userProfile.displayName || 'User'} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                        {userProfile && isOnline(userProfile) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <div className="font-medium text-white truncate">{userProfile?.displayName || 'Utilisateur inconnu'}</div>
                          <div className="text-[10px] text-slate-500 shrink-0 ml-2">
                            {formatTime(conv.updatedAt)}
                          </div>
                        </div>
                        <div className="text-sm text-slate-400 truncate">
                          {conv.lastMessage ? (
                            <span className={conv.lastMessage.senderId === auth.currentUser?.uid ? 'text-slate-500' : 'text-slate-300'}>
                              {conv.lastMessage.senderId === auth.currentUser?.uid ? 'Vous: ' : ''}{conv.lastMessage.text}
                            </span>
                          ) : 'Nouvelle conversation'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className={`flex-1 flex flex-col bg-slate-950 ${isMobileListVisible ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-slate-800 flex items-center px-4 shrink-0 bg-slate-900/50 backdrop-blur">
              <button 
                onClick={() => setIsMobileListVisible(true)}
                className="md:hidden mr-3 p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center relative">
                  {otherUser?.photoURL ? (
                    <img src={otherUser.photoURL} alt={otherUser.displayName || 'User'} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                  {otherUser && isOnline(otherUser) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>}
                </div>
                <div>
                  <div className="font-semibold text-white">{otherUser?.displayName || 'Utilisateur inconnu'}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    {otherUser && isOnline(otherUser) ? (
                      <span className="text-green-400">En ligne</span>
                    ) : (
                      <span>Hors ligne</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              {messages.map((msg, index) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const showTime = index === 0 || (msg.createdAt && messages[index-1]?.createdAt && (msg.createdAt.toMillis() - messages[index-1].createdAt.toMillis() > 300000)); // 5 mins
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showTime && (
                      <div className="text-[10px] text-slate-500 mb-2 self-center bg-slate-800/50 px-2 py-1 rounded-full">
                        {formatTime(msg.createdAt)}
                      </div>
                    )}
                    <div 
                      className={`relative max-w-[75%] md:max-w-[60%] p-3 rounded-2xl text-sm shadow-sm ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-tr-sm' 
                          : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                      }`}
                    >
                      <span className="break-words">{msg.text}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 px-1">
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800">
              <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrivez un message..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-full transition-colors flex items-center justify-center shrink-0 shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Vos messages</h2>
            <p className="max-w-md">Sélectionnez une conversation ou recherchez un utilisateur pour commencer à discuter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
