import { useState, useRef, useEffect, CSSProperties, ReactNode, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Message {
  id: string;
  from: 'user' | 'system';
  text: string;
  timestamp: string;
}

function linkifyText(text: string): ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        {part}
      </a>
    ) : (
      part
    )
  );
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

  const hasAutoSent = useRef(false);

  // Auto-send greeting on connect to trigger the LLM's first response
  useEffect(() => {
    if (isConnected && !hasAutoSent.current) {
      hasAutoSent.current = true;
      handleSend('Hi');
    }
  }, [isConnected]);

  function handleConnect() {
    const cleaned = phoneNumber.trim();
    if (!cleaned) return;
    const formatted = cleaned.startsWith('+') ? cleaned : `+1${cleaned.replace(/\D/g, '')}`;
    setPhoneNumber(formatted);
    hasAutoSent.current = false;
    setIsConnected(true);
    setMessages([]);
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

  const quickActions = isConnected ? [
    'Who has the kids this week?',
    'Can we swap Friday?',
    'School is closed tomorrow',
    'My son is sick today',
    'Show me the calendar',
    'Yes',
    'No',
  ] : [];

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
