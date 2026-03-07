import { useState, useRef, useEffect, CSSProperties, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Message {
  id: string;
  from: 'user' | 'system';
  text: string;
  timestamp: string;
}

function linkifyText(text: string): ReactNode[] {
  // Match markdown images ![alt](url), raw image URLs, and regular URLs
  const pattern = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s)]+)/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Markdown image: ![alt](url)
      result.push(
        <img
          key={match.index}
          src={match[2]}
          alt={match[1] || 'Schedule'}
          style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6, display: 'block' }}
        />
      );
    } else {
      const url = match[3];
      // Raw URL — check if image
      if (/\/messaging\/media\/.*\.png/i.test(url) || /\.(png|jpg|jpeg|gif)(\?|$)/i.test(url)) {
        result.push(
          <img
            key={match.index}
            src={url}
            alt="Schedule"
            style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6, display: 'block' }}
          />
        );
      } else {
        result.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            {url}
          </a>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

export function SmsSimulator() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleConnect() {
    const cleaned = phoneNumber.trim();
    if (!cleaned) return;
    const formatted = cleaned.startsWith('+') ? cleaned : `+1${cleaned.replace(/\D/g, '')}`;
    setPhoneNumber(formatted);
    setIsConnected(true);
    setMessages([]);
    setSending(true);

    // Call connect endpoint to get LLM's opening message
    fetch(`${API_BASE}/messaging/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formatted }),
    })
      .then(res => res.json())
      .then(data => {
        const text = data.data?.message || data.message || 'Welcome!';
        setMessages([{
          id: `sys-${Date.now()}`,
          from: 'system',
          text,
          timestamp: new Date().toLocaleTimeString(),
        }]);
      })
      .catch(() => {
        setMessages([{
          id: `err-${Date.now()}`,
          from: 'system',
          text: `Could not reach API at ${API_BASE}`,
          timestamp: new Date().toLocaleTimeString(),
        }]);
      })
      .finally(() => setSending(false));
  }

  function handleDisconnect() {
    setIsConnected(false);
    setPhoneNumber('');
    setMessages([]);
  }

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      from: 'user',
      text: msg,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/messaging/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: phoneNumber, Body: msg }),
      });

      const data = await res.json();
      // Parse TwiML response or JSON
      let responseText = '';
      if (typeof data === 'string') {
        const match = data.match(/<Message>([\s\S]*?)<\/Message>/);
        responseText = match ? match[1] : data;
      } else if (data.data) {
        const match = data.data.match(/<Message>([\s\S]*?)<\/Message>/);
        responseText = match ? match[1] : data.data;
      } else {
        responseText = JSON.stringify(data);
      }

      const sysMsg: Message = {
        id: `sys-${Date.now()}`,
        from: 'system',
        text: responseText,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, sysMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        from: 'system',
        text: `Error: Could not reach API at ${API_BASE}`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    }

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Dynamic quick actions based on the last system message
  const quickActions = (() => {
    if (!isConnected) return [];

    const lastSys = [...messages].reverse().find(m => m.from === 'system');
    if (!lastSys) return ['Yes', 'No'];

    const t = lastSys.text.toLowerCase();

    // Onboarding: asking about kids
    if (t.includes('how many') && (t.includes('kid') || t.includes('child'))) {
      return ['1 kid', '2 kids', '3 kids'];
    }
    // Asking about ages
    if (t.includes('age') && !t.includes('stage')) {
      return ['Ages 2 and 5', 'Age 7', 'Ages 3, 6, and 10'];
    }
    // Asking about current arrangement / custody
    if (t.includes('custody') || t.includes('arrangement') || t.includes('how does') && t.includes('work')) {
      return ['We alternate weeks', 'I have them weekdays, co-parent gets weekends', 'We do a 2-2-3', "It's pretty informal right now"];
    }
    // Asking about weekends
    if (t.includes('weekend')) {
      return ['We alternate weekends', 'I always have weekends', 'We split Saturday/Sunday', 'Weekends are flexible'];
    }
    // Asking about locked/specific days
    if (t.includes('always') && (t.includes('night') || t.includes('day'))) {
      return ['Mondays and Tuesdays are mine', 'Wednesday nights are always mine', 'No specific locked days', 'Weekends are always mine'];
    }
    // Asking about remaining days or full week picture
    if (t.includes('remaining') || t.includes('other days') || t.includes('rest of')) {
      return ['Co-parent has them', 'We alternate those days', "It varies week to week"];
    }
    // Asking about split
    if (t.includes('split') || t.includes('50/50') || t.includes('overall time')) {
      return ['50/50', '60/40 — I have more', '70/30 — mostly me', "I'm flexible"];
    }
    // Asking about distance
    if (t.includes('far apart') || t.includes('distance') || t.includes('how far')) {
      return ['About 10 miles', '20-30 minutes', 'Same neighborhood', 'Over an hour'];
    }
    // Asking about handoffs/exchanges
    if (t.includes('handoff') || t.includes('exchange') || t.includes('drop')) {
      return ['At school/daycare', 'Curbside at their house', 'At a public place', 'We meet halfway'];
    }
    // Asking about phone number
    if (t.includes('phone') && (t.includes('co-parent') || t.includes('other parent') || t.includes('partner'))) {
      return ['+15559876543', "I'll add them later"];
    }
    // Asking about frustrations / pain points
    if (t.includes('frustrat') || t.includes('pain') || t.includes('wish') || t.includes('bother') || t.includes('what would')) {
      return ['Too many transitions', 'Weekends are unpredictable', 'Too much driving', 'Schedule changes last minute', "It's working okay"];
    }
    // Asking about max consecutive nights
    if (t.includes('consecutive') || t.includes('stretch') || t.includes('in a row')) {
      return ['3 nights max', '4-5 nights is fine', 'No limit', 'Shorter is better for the kids'];
    }
    // Preview / confirmation
    if (t.includes('look good') || t.includes('confirm') || t.includes('does this') || t.includes('go with')) {
      return ['Yes, looks great!', "Can we adjust it?", 'Show me other options', 'No, start over'];
    }
    // Post-onboarding / general conversation
    if (t.includes('schedule') && (t.includes('created') || t.includes('generated') || t.includes('ready'))) {
      return ['Show me the calendar', 'Who has the kids this week?', 'Can we swap a day?'];
    }
    // Default conversation actions
    return ['Who has the kids this week?', 'Show me the calendar', 'Yes', 'No'];
  })();

  if (!isConnected) {
    return (
      <div style={s.root}>
        <div style={s.connectScreen}>
          <div style={s.logo}>ADCP</div>
          <div style={s.subtitle}>SMS Simulator</div>
          <p style={s.desc}>
            Enter a phone number to simulate the messaging experience.
            Use a new number to start onboarding, or an existing one to continue.
          </p>
          <div style={s.phoneRow}>
            <input
              type="text"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="+15551234567"
              style={s.phoneInput}
              autoFocus
            />
            <button style={s.connectBtn} onClick={handleConnect}>
              Connect
            </button>
          </div>
          <div style={s.presets}>
            <span style={s.presetLabel}>Quick start:</span>
            <button style={s.presetBtn} onClick={() => { setPhoneNumber('+1' + Math.floor(5550000000 + Math.random() * 9999999).toString()); }}>
              New number
            </button>
            <button style={s.presetBtn} onClick={() => setPhoneNumber('+15551234567')}>
              Parent A (existing)
            </button>
            <button style={s.presetBtn} onClick={() => setPhoneNumber('+15559876543')}>
              Parent B (existing)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {/* Phone frame */}
      <div style={s.phone}>
        {/* Status bar */}
        <div style={s.statusBar}>
          <span style={s.statusTime}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span style={s.statusCarrier}>ADCP</span>
          <span style={s.statusBattery}>100%</span>
        </div>

        {/* Chat header */}
        <div style={s.chatHeader}>
          <button style={s.backBtn} onClick={handleDisconnect}>&larr;</button>
          <div style={s.chatHeaderInfo}>
            <div style={s.chatHeaderName}>ADCP Scheduler</div>
            <div style={s.chatHeaderNumber}>{phoneNumber}</div>
          </div>
        </div>

        {/* Messages */}
        <div style={s.messageArea} ref={scrollRef}>
          {messages.map(msg => (
            <div key={msg.id} style={{ ...s.msgRow, justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={msg.from === 'user' ? s.userBubble : s.systemBubble}>
                <div style={s.msgText}>{linkifyText(msg.text)}</div>
                <div style={s.msgTime}>{msg.timestamp}</div>
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ ...s.msgRow, justifyContent: 'flex-start' }}>
              <div style={s.systemBubble}>
                <div style={s.typing}>typing...</div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={s.quickActions}>
          {quickActions.map(action => (
            <button
              key={action}
              style={s.quickBtn}
              onClick={() => handleSend(action)}
              disabled={sending}
            >
              {action}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={s.inputBar}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            style={s.msgInput}
            disabled={sending}
            autoFocus
          />
          <button
            style={{ ...s.sendBtn, opacity: sending ? 0.5 : 1 }}
            onClick={() => handleSend()}
            disabled={sending || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f0f2f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  // Connect screen
  connectScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    maxWidth: 420,
    width: '100%',
  },
  logo: {
    fontSize: 36,
    fontWeight: 800,
    color: '#1a1a2e',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 500,
    marginTop: -8,
  },
  desc: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: '20px',
    margin: '8px 0',
  },
  phoneRow: {
    display: 'flex',
    gap: 8,
    width: '100%',
  },
  phoneInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: 16,
    border: '2px solid #e5e7eb',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'monospace',
  },
  connectBtn: {
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  presets: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  presetLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  presetBtn: {
    padding: '4px 10px',
    fontSize: 11,
    color: '#4A90D9',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 6,
    cursor: 'pointer',
  },
  // Phone frame
  phone: {
    width: 390,
    height: 760,
    backgroundColor: '#fff',
    borderRadius: 40,
    border: '8px solid #1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 20px',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
  statusTime: { fontSize: 11 },
  statusCarrier: { fontSize: 12, fontWeight: 700, letterSpacing: 1 },
  statusBattery: { fontSize: 11 },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  backBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: '#4A90D9',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 8,
  },
  chatHeaderInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  chatHeaderName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  chatHeaderNumber: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  // Messages
  messageArea: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
  },
  msgRow: {
    display: 'flex',
    marginBottom: 8,
  },
  userBubble: {
    maxWidth: '78%',
    padding: '10px 14px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    borderRadius: '18px 18px 4px 18px',
    fontSize: 14,
    lineHeight: '20px',
  },
  systemBubble: {
    maxWidth: '78%',
    padding: '10px 14px',
    backgroundColor: '#fff',
    color: '#1a1a2e',
    borderRadius: '18px 18px 18px 4px',
    border: '1px solid #e5e7eb',
    fontSize: 14,
    lineHeight: '20px',
    whiteSpace: 'pre-line',
  },
  msgText: {
    wordBreak: 'break-word',
  },
  msgTime: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 4,
    textAlign: 'right',
  },
  typing: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  // Quick actions
  quickActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '6px 12px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  quickBtn: {
    padding: '4px 8px',
    fontSize: 10,
    color: '#4A90D9',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Input
  inputBar: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    backgroundColor: '#fff',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  msgInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    outline: 'none',
    backgroundColor: '#f8fafc',
  },
  sendBtn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 700,
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 20,
    cursor: 'pointer',
  },
};
