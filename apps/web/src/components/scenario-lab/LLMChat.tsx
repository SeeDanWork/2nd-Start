import { useState, useRef, useEffect, CSSProperties } from 'react';
import { useScenarioStore } from '../../stores/scenario';
import type { ChatMessage } from '../../stores/scenario';
import { parseNaturalLanguage } from './scheduleEngine';

const SUGGESTIONS = [
  'Swap weekends this month.',
  'School is closed Monday.',
  'He has to travel next week.',
  'I need coverage this Friday.',
  'I have the kids today.',
  'Can she take them Saturday?',
];

export function LLMChat() {
  const { chatMessages, addChatMessage } = useScenarioStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `chat-${Date.now()}-u`,
      role: 'user',
      text: msg,
    };
    addChatMessage(userMsg);

    // Parse intent
    const parsed = parseNaturalLanguage(msg);

    // Add system response
    const systemMsg: ChatMessage = {
      id: `chat-${Date.now()}-s`,
      role: 'system',
      text: parsed.explanation,
      parsedIntent: {
        type: parsed.type,
        dateRange: parsed.dateRange,
        parent: parsed.parent,
        confidence: parsed.confidence,
      },
      systemResult: {
        action: parsed.action,
        proposals: parsed.type === 'NEED_COVERAGE' || parsed.type === 'SWAP_REQUEST' ? 3 : undefined,
        explanation: parsed.explanation,
      },
    };
    addChatMessage(systemMsg);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={s.root}>
      <div style={s.header}>LLM Chat</div>

      {/* Messages */}
      <div style={s.messages} ref={scrollRef}>
        {chatMessages.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyText}>Test natural language interpretation.</p>
            <p style={s.emptyText}>Type a message or try a suggestion below.</p>
          </div>
        )}
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <div style={s.inputArea}>
        <div style={s.inputRow}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            style={s.input}
          />
          <button style={s.sendBtn} onClick={() => handleSend()}>
            &#9654;
          </button>
        </div>
        <div style={s.suggestions}>
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              style={s.sugBtn}
              onClick={() => handleSend(sug)}
            >
              "{sug}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div style={{ ...s.msgRow, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={isUser ? s.userBubble : s.systemBubble}>
        {/* Level 1: User message */}
        {isUser && (
          <div style={s.levelLabel}>User:</div>
        )}
        <div style={s.msgText}>{message.text}</div>

        {/* Level 2: Parsed intent */}
        {message.parsedIntent && (
          <div style={s.intentBlock}>
            <div style={s.intentTitle}>AI Interpreter</div>
            <div style={s.intentRow}>
              <span style={s.intentLabel}>Type:</span>
              <span style={s.intentValue}>{message.parsedIntent.type}</span>
            </div>
            {message.parsedIntent.dateRange && (
              <div style={s.intentRow}>
                <span style={s.intentLabel}>Date:</span>
                <span style={s.intentValue}>{message.parsedIntent.dateRange}</span>
              </div>
            )}
            <div style={s.intentRow}>
              <span style={s.intentLabel}>Confidence:</span>
              <span style={{
                ...s.intentValue,
                color: message.parsedIntent.confidence >= 0.8 ? '#16a34a' : '#f59e0b',
              }}>
                {message.parsedIntent.confidence.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Level 3: System result */}
        {message.systemResult && (
          <div style={s.resultBlock}>
            <div style={s.resultTitle}>Solver Response:</div>
            <div style={s.resultText}>{message.systemResult.action}</div>
            {message.systemResult.proposals && (
              <div style={s.resultProposals}>
                {message.systemResult.proposals} proposals generated
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: 300,
    minWidth: 300,
    borderLeft: '1px solid #e5e7eb',
    height: '100%',
    backgroundColor: '#fafafa',
  },
  header: {
    padding: '10px 12px',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 100,
  },
  emptyText: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center' as const,
    margin: 2,
  },
  msgRow: {
    display: 'flex',
    marginBottom: 8,
  },
  userBubble: {
    maxWidth: '85%',
    padding: '8px 10px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    borderRadius: '12px 12px 4px 12px',
    fontSize: 12,
  },
  systemBubble: {
    maxWidth: '90%',
    padding: '8px 10px',
    backgroundColor: '#fff',
    color: '#374151',
    borderRadius: '12px 12px 12px 4px',
    border: '1px solid #e5e7eb',
    fontSize: 12,
  },
  levelLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  msgText: {
    lineHeight: '16px',
  },
  intentBlock: {
    marginTop: 8,
    padding: '6px 8px',
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    border: '1px solid #fcd34d',
  },
  intentTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#92400e',
    marginBottom: 4,
  },
  intentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    padding: '1px 0',
  },
  intentLabel: {
    color: '#78716c',
  },
  intentValue: {
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#1a1a2e',
  },
  resultBlock: {
    marginTop: 6,
    padding: '6px 8px',
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    border: '1px solid #86efac',
  },
  resultTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#166534',
    marginBottom: 2,
  },
  resultText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: '14px',
  },
  resultProposals: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: 600,
    color: '#8b5cf6',
  },
  inputArea: {
    borderTop: '1px solid #e5e7eb',
    padding: 8,
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    gap: 4,
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    fontSize: 12,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
  },
  sendBtn: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  },
  suggestions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
    marginTop: 6,
  },
  sugBtn: {
    padding: '3px 6px',
    fontSize: 9,
    color: '#4A90D9',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
};
