'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTripStore } from '@/store/trip-store';
import { ArrowUp, Sparkles, WandSparkles, Loader2, Send, Bot, User, Star, Zap } from 'lucide-react';

interface AskAIPanelProps {
  tripId: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  'Make it cheaper',
  'Add one more day',
  'Find a better hotel',
  'More relaxed pace',
  'Use trains instead',
];

export function AskAIPanel({ tripId }: AskAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'I can help you modify your trip. Ask me anything — "Make it cheaper", "Add Gulmarg", "Move this to tomorrow", or any other change.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setIsPlanning } = useTripStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.modifyTrip(tripId, text.trim());
      setIsPlanning(true);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Updating your trip: "${text.trim()}". You'll see the changes appear in real time.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'There was an issue processing your request. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="premium-chat-container">
      <div className="premium-chat-header">
        <div className="premium-chat-avatar">
          <div className="avatar-gradient">
            <WandSparkles className="w-5 h-5" />
          </div>
          <div className="avatar-pulse-ring" />
        </div>
        <div className="premium-chat-info">
          <div className="premium-chat-title">
            <span className="title-gradient">AI Trip Copilot</span>
            <span className="premium-badge">Premium</span>
          </div>
          <p className="premium-chat-subtitle">Your itinerary, fine-tuned in plain English</p>
        </div>
        <div className="premium-chat-indicator">
          <Zap className="w-4 h-4" />
          <span>Online</span>
        </div>
      </div>

      <div className="premium-chat-messages">
        <div className="messages-inner">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`premium-message ${msg.role === 'user' ? 'premium-message-user' : 'premium-message-assistant'}`}
            >
              <div className="message-avatar">
                {msg.role === 'assistant' ? (
                  <div className="assistant-avatar">
                    <Bot className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="user-avatar">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="message-content-wrapper">
                <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                  {msg.role === 'assistant' && (
                    <div className="assistant-message-header">
                      <span className="assistant-name">TripMind AI</span>
                      <div className="message-timestamp">
                        {msg.timestamp.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  )}
                  <p className="message-text">{msg.content}</p>
                  {msg.role === 'user' && (
                    <div className="user-message-footer">
                      <span className="message-timestamp">
                        {msg.timestamp.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="premium-message premium-message-assistant">
              <div className="message-avatar">
                <div className="assistant-avatar">
                  <Bot className="w-4 h-4" />
                </div>
              </div>
              <div className="message-content-wrapper">
                <div className="assistant-bubble">
                  <div className="assistant-message-header">
                    <span className="assistant-name">TripMind AI</span>
                    <div className="typing-indicator">
                      <div className="typing-dot" style={{ animationDelay: '0ms' }} />
                      <div className="typing-dot" style={{ animationDelay: '200ms' }} />
                      <div className="typing-dot" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                  <p className="message-text message-typing">Processing your request...</p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-background-pattern" />
      </div>

      <div className="premium-chat-suggestions">
        <div className="suggestions-header">
          <Sparkles className="w-4 h-4" />
          <span>Quick Suggestions</span>
        </div>
        <div className="suggestions-grid">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              disabled={isLoading}
              className="suggestion-pill"
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <span className="suggestion-icon">
                {index === 0 && '💰'}
                {index === 1 && '📅'}
                {index === 2 && '🏨'}
                {index === 3 && '😌'}
                {index === 4 && '🚄'}
              </span>
              <span className="suggestion-text">{action}</span>
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(event) => { 
          event.preventDefault(); 
          void sendMessage(input); 
        }}
        className="premium-chat-input"
      >
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void sendMessage(input)}
            placeholder="Ask anything about your trip..."
            disabled={isLoading}
            className="premium-input-field"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="premium-send-button"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {input.trim() && (
          <div className="input-hint">
            <span>Press Enter to send</span>
          </div>
        )}
      </form>

      <style jsx global>{`
        .premium-chat-container {
          position: relative;
          display: flex;
          flex-direction: column;
          height: min(580px, calc(100vh - 12rem));
          min-height: 380px;
          max-height: 580px;
          background: linear-gradient(145deg, #1a1d26 0%, #12141a 50%, #0a0b0e 100%);
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 
                      0 4px 20px rgba(0, 0, 0, 0.3),
                      inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .premium-chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
        }

        .premium-chat-header::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.02) 50%, transparent 100%);
          pointer-events: none;
        }

        .premium-chat-avatar {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .avatar-gradient {
          width: 100%;
          height: 100%;
          border-radius: 16px;
          background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
        }

        .avatar-pulse-ring {
          position: absolute;
          inset: -4px;
          border-radius: 20px;
          border: 2px solid rgba(139, 92, 246, 0.2);
          animation: avatar-pulse 2s ease-in-out infinite;
        }

        @keyframes avatar-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .premium-chat-info {
          flex: 1;
          min-width: 0;
        }

        .premium-chat-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .title-gradient {
          font-size: 16px;
          font-weight: 700;
          background: linear-gradient(135deg, #f0f1f5 0%, #d1d5db 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.01em;
        }

        .premium-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--gradient-primary);
          color: var(--color-text-inverse);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .premium-chat-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        .premium-chat-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: rgba(139, 92, 246, 0.8);
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 20px;
          border: 1px solid rgba(139, 92, 246, 0.2);
          font-weight: 500;
        }

        .premium-chat-messages {
          flex: 1;
          overflow-y: auto;
          position: relative;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .messages-inner {
          position: relative;
          z-index: 1;
        }

        .chat-background-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.03) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(245, 158, 11, 0.02) 0%, transparent 40%);
          pointer-events: none;
        }

        .premium-message {
          display: flex;
          gap: 12px;
          max-width: 85%;
          animation: message-fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        .premium-message-assistant {
          align-self: flex-start;
        }

        .premium-message-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        @keyframes message-fade-in {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .assistant-avatar {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .user-avatar {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(107, 40, 217, 0.2) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary-600);
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .message-content-wrapper {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .message-bubble {
          padding: 14px 18px;
          border-radius: 20px;
          position: relative;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .assistant-bubble {
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--color-text-primary);
          border-bottom-left-radius: 4px;
        }

        .user-bubble {
          background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .assistant-message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .assistant-name {
          font-size: 13px;
          font-weight: 700;
          color: #a78bfa;
          letter-spacing: 0.02em;
        }

        .message-timestamp {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 500;
        }

        .message-text {
          font-size: 14px;
          line-height: 1.6;
          font-weight: 500;
          color: inherit;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .message-typing {
          color: rgba(255, 255, 255, 0.7) !important;
          font-style: italic;
        }

        .user-message-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8b5cf6;
          animation: typing-bounce 1.4s ease-in-out infinite;
        }

        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }

        .premium-chat-suggestions {
          padding: 12px 20px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .suggestions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .suggestions-grid {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }

        .suggestions-grid::-webkit-scrollbar {
          display: none;
        }

        .suggestion-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          animation: suggestion-fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        @keyframes suggestion-fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .suggestion-pill:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%);
          border-color: rgba(139, 92, 246, 0.3);
          color: white;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
        }

        .suggestion-pill:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .suggestion-icon {
          font-size: 14px;
        }

        .suggestion-text {
          font-weight: 500;
        }

        .premium-chat-input {
          padding: 16px 20px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }

        .input-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 4px 4px 4px 16px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-wrapper:focus-within {
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
          background: rgba(255, 255, 255, 0.08);
        }

        .premium-input-field {
          flex: 1;
          padding: 12px 0;
          background: transparent;
          border: none;
          font-size: 15px;
          color: var(--color-text-primary);
          font-weight: 500;
          outline: none;
        }

        .premium-input-field::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .premium-send-button {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }

        .premium-send-button:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
        }

        .premium-send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .input-hint {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .premium-chat-messages::-webkit-scrollbar {
          width: 4px;
        }

        .premium-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .premium-chat-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }

        .premium-chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  );
}
