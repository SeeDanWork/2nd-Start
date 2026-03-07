'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Message } from '@/lib/types';

interface PhoneSimulatorProps {
  label: string;
  phone: string;
  color: string;
  messages: Message[];
  onSend: (text: string) => void;
  onConnect: () => void;
  connected: boolean;
  sending: boolean;
  quickActions?: string[];
}

function linkifyText(text: string): ReactNode[] {
  const pattern = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s)]+)/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      result.push(
        <img key={match.index} src={match[2]} alt={match[1] || 'Schedule'}
          className="max-w-full rounded-lg mt-1.5 block" />
      );
    } else {
      const url = match[3];
      if (/\/messaging\/media\/.*\.png/i.test(url) || /\.(png|jpg|jpeg|gif)(\?|$)/i.test(url)) {
        result.push(
          <img key={match.index} src={url} alt="Schedule"
            className="max-w-full rounded-lg mt-1.5 block" />
        );
      } else {
        result.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
            className="underline text-inherit">
            {url.length > 50 ? url.slice(0, 50) + '...' : url}
          </a>
        );
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result.length > 0 ? result : [text];
}

export function PhoneSimulator({
  label,
  phone,
  color,
  messages,
  onSend,
  onConnect,
  connected,
  sending,
  quickActions,
}: PhoneSimulatorProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Phone Header */}
      <div
        className="px-3 py-2 rounded-t-lg flex items-center justify-between"
        style={{ backgroundColor: color }}
      >
        <div>
          <div className="text-white text-sm font-semibold">{label}</div>
          <div className="text-white/70 text-[10px]">{phone}</div>
        </div>
        {!connected && (
          <button
            onClick={onConnect}
            className="px-3 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30"
          >
            Connect
          </button>
        )}
        {connected && (
          <span className="text-[10px] text-white/70">Connected</span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-lab-50 p-3 space-y-2 phone-scroll"
        style={{ minHeight: 300 }}
      >
        {messages.length === 0 && (
          <div className="text-center text-lab-300 text-xs mt-8">
            Click Connect to start
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                msg.from === 'user'
                  ? 'bg-lab-700 text-white rounded-br-sm'
                  : 'bg-white border border-lab-200 text-lab-800 rounded-bl-sm'
              }`}
            >
              {linkifyText(msg.text)}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-lab-200 px-3 py-2 rounded-xl rounded-bl-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-lab-300 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-lab-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-1.5 h-1.5 bg-lab-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {connected && quickActions && quickActions.length > 0 && (
        <div className="px-3 py-1.5 bg-white border-t border-lab-100 flex gap-1.5 flex-wrap">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => onSend(action)}
              disabled={sending}
              className="px-2 py-1 text-[11px] bg-lab-100 text-lab-600 rounded-full hover:bg-lab-200 disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {connected && (
        <div className="p-2 bg-white border-t border-lab-200 rounded-b-lg">
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm border border-lab-200 rounded-full focus:outline-none focus:ring-1 focus:ring-lab-400"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-4 py-2 text-sm rounded-full disabled:opacity-30"
              style={{ backgroundColor: color, color: 'white' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
