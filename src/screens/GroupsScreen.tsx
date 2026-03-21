import { useState } from 'react';
import { GROUPS } from '../data';
import type { Group, GroupMessage } from '../types';

export default function GroupsScreen() {
  const [groups] = useState<Group[]>(GROUPS);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [input, setInput] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  const sendMessage = () => {
    if (!input.trim() || !activeGroup) return;
    const msg: GroupMessage = { id: Date.now().toString(), sender: 'You', text: input.trim(), mine: true, time: 'Just now' };
    activeGroup.messages.push(msg);
    setInput('');
  };

  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setShowInvite(false); setInviteEmail(''); }, 2000);
  };

  if (activeGroup) {
    return (
      <div className="flex flex-col h-full">
        {/* Chat header */}
        <div className="flex items-center gap-3 p-4 bg-card border-b border-border flex-shrink-0 shadow-sm">
          <button onClick={() => setActiveGroup(null)} className="ms text-muted-foreground">arrow_back</button>
          <div className="w-10 h-10 rounded-full bg-kipita-red-lt flex items-center justify-center text-xl flex-shrink-0">{activeGroup.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{activeGroup.name}</div>
            <div className="text-xs text-muted-foreground">{activeGroup.members} members</div>
          </div>
          <button onClick={() => setShowInvite(true)}
            className="w-9 h-9 rounded-full bg-kipita-red-lt flex items-center justify-center flex-shrink-0 hover:bg-kipita-red hover:text-white transition-colors">
            <span className="ms text-lg text-kipita-red hover:text-white">person_add</span>
          </button>
        </div>

        {/* Invite modal */}
        {showInvite && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[200]" onClick={() => { setShowInvite(false); setInviteEmail(''); setInviteSent(false); }} />
            <div className="fixed inset-x-4 top-[20%] max-w-sm mx-auto bg-card rounded-2xl shadow-2xl z-[201] p-5">
              <h3 className="font-extrabold text-base mb-1">Invite to {activeGroup.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">Enter email or username to invite someone to this group.</p>
              {inviteSent ? (
                <div className="text-center py-4">
                  <span className="text-3xl">✅</span>
                  <p className="font-bold text-sm mt-2 text-kipita-green">Invite sent to {inviteEmail}!</p>
                </div>
              ) : (
                <>
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendInvite(); }}
                    placeholder="Email or username…"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-kipita-red mb-3" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowInvite(false); setInviteEmail(''); }}
                      className="flex-1 py-2.5 rounded-full border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={sendInvite}
                      className="flex-1 py-2.5 rounded-full bg-kipita-red text-white font-bold text-sm hover:bg-kipita-red-dk transition-colors">
                      Send Invite
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeGroup.messages.map(msg => (
            <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.mine ? 'self-end items-end' : 'self-start items-start'}`}>
              {!msg.mine && <span className="text-[10px] font-bold text-muted-foreground mb-0.5 px-1">{msg.sender}</span>}
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.mine ? 'bg-kipita-red text-white rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'
              }`}>{msg.text}</div>
              <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{msg.time}</span>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 p-3 border-t border-border bg-card flex-shrink-0">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            placeholder="Type a message…"
            className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm outline-none focus:border-kipita-red" />
          <button onClick={sendMessage}
            className="w-10 h-10 bg-kipita-red text-white rounded-full flex items-center justify-center flex-shrink-0">
            <span className="ms text-lg">send</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold">Community Groups</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Connect with nomads, share tips, and stay safe together.</p>
      </div>
      <div className="flex-1 overflow-y-auto pb-24">
        {groups.map(g => (
          <button key={g.id} onClick={() => setActiveGroup(g)}
            className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-border text-left hover:bg-muted/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-kipita-red-lt flex items-center justify-center text-xl flex-shrink-0">{g.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{g.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{g.lastMessage}</div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">{g.members} members</span>
              {g.unread > 0 && (
                <span className="bg-kipita-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">{g.unread}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
