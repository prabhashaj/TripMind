'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTripStore } from '@/store/trip-store';
import { Send, Loader2, Sparkles, MapPin } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGES = [
  'Hello! I am your AI Travel Assistant. Ask me about destinations, best times to visit, travel tips, or budgets. When you are ready to plan a trip, just say "Plan a trip to..." and I will create a complete itinerary for you.',
  'Hi there! I can answer travel questions, give destination recommendations, or help you plan your perfect trip. Just chat naturally with me.',
  'Welcome! Feel free to ask me anything about travel. When you want to plan a trip, tell me where you want to go, when, and for how many people.',
];

const TRAVEL_KEYWORDS = [
  'trip', 'travel', 'vacation', 'holiday', 'journey', 'destination',
  'hotel', 'flight', 'resort', 'beach', 'mountain', 'city', 'country',
  'visit', 'explore', 'adventure', 'getaway', 'plan', 'itinerary'
];

const PLANNING_TRIGGERS = [
  'plan a trip', 'plan my trip', 'plan the trip', 'create a trip',
  'make a plan', 'design a trip', 'organize a trip', 'start planning',
  'book a trip', 'arrange a trip', 'set up a trip',
  'i want to travel to', 'i need a trip to', 'can you plan',
  'help me plan', 'please plan'
];

export function TravelChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([]);
  
  const router = useRouter();
  const { setTripId, setIsPlanning, reset } = useTripStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMsg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    setMessages([{
      role: 'assistant',
      content: welcomeMsg,
      timestamp: new Date()
    }]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const detectPlanningIntent = (text: string): boolean => {
    const lower = text.toLowerCase();
    return PLANNING_TRIGGERS.some(trigger => lower.includes(trigger));
  };

  const extractTripQuery = (text: string): string | null => {
    const lower = text.toLowerCase().trim();
    
    // First check for explicit planning triggers
    for (const trigger of PLANNING_TRIGGERS) {
      if (lower.includes(trigger)) {
        // Try to extract the actual query
        const index = lower.indexOf(trigger);
        const query = text.substring(index + trigger.length).trim();
        // Only proceed if there's actual content after the trigger
        if (query.length > 0) {
          return query;
        }
        return text.trim();
      }
    }
    
    // For very short messages (hi, hello, hey), never trigger planning
    if (lower.match(/^(hi|hello|hey|hii?|yo|hey there|good morning|good evening|what's up|howdy|thanks|thank you)$/i)) {
      return null;
    }
    
    // Check if it looks like a planning request with enough context
    const hasTravelKeyword = TRAVEL_KEYWORDS.some(kw => lower.includes(kw));
    const hasLocation = /(to |from |in |at )[a-z]/i.test(lower);
    const hasDuration = /\d+\s*(day|night|week)/i.test(lower);
    const hasActionWord = /(plan|book|create|design|organize|arrange|visit|explore|want|need|can you|could you|trip|travel)/i.test(lower);
    
    // Require travel context with intent
    if (hasTravelKeyword && (hasLocation || hasDuration || hasActionWord)) {
      return text.trim();
    }
    
    return null;
  };

  const generateFollowUpSuggestions = (userMessage: string): string[] => {
    const lower = userMessage.toLowerCase();
    const suggestions: string[] = [];
    
    if (lower.includes('where') || lower.includes('destination') || lower.includes('go')) {
      suggestions.push('What type of trip are you interested in?');
      suggestions.push('Do you have a specific destination in mind?');
    }
    
    if (lower.includes('budget') || lower.includes('cost') || lower.includes('price')) {
      suggestions.push('What is your approximate budget range?');
    }
    
    if (lower.includes('when') || lower.includes('time') || lower.includes('best')) {
      suggestions.push('What time of year are you planning to travel?');
    }
    
    if (lower.includes('how many') || lower.includes('who') || lower.includes('people')) {
      suggestions.push('How many people will be traveling?');
    }
    
    if (suggestions.length === 0 && !detectPlanningIntent(userMessage)) {
      suggestions.push('When you are ready to plan, just tell me where you want to go!');
    }
    
    return suggestions.slice(0, 2);
  };

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    
    const text = input.trim();
    if (!text || isLoading) return;
    
    setInput('');
    setSuggestedFollowups([]);
    
    // Add user message
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: text,
        timestamp: new Date()
      }
    ]);
    
    // Check if this is a planning request
    const tripQuery = extractTripQuery(text);
    
    if (tripQuery) {
      // User wants to start planning
      setIsLoading(true);
      
      try {
        reset();
        const response = await api.startPlanning(tripQuery);
        setTripId(response.trip_id);
        setIsPlanning(true);
        setHasStarted(true);
        router.push(`/plan/${response.trip_id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `I am sorry, I encountered an error starting your trip planning: ${message}. Please check that the backend is running.`,
            timestamp: new Date()
          }
        ]);
        setIsLoading(false);
      }
      return;
    }
    
    // For now, generate helpful responses for travel questions
    // In a full implementation, this would call an LLM API
    setIsLoading(true);
    
    // Simulate thinking delay
    setTimeout(() => {
      const response = generateTravelResponse(text);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }
      ]);
      setSuggestedFollowups(generateFollowUpSuggestions(text));
      setIsLoading(false);
    }, 800);
  };

  const generateTravelResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();
    
    // Planning-related but not explicit enough
    if (lower.includes('trip') || lower.includes('travel') || lower.includes('vacation')) {
      if (lower.includes('where') || lower.includes('destination')) {
        return "I can help with that! There are many wonderful destinations depending on your interests. Popular choices include Goa for beaches, Shimla for mountains, Rajasthan for culture, and Kerala for nature. Where were you thinking of going?";
      }
      if (lower.includes('budget') || lower.includes('cost')) {
        return "Trip budgets can vary greatly. For a 7-day trip in India: Budget travel can be ₹20,000-₹30,000, Mid-range is ₹40,000-₹70,000, and Luxury starts from ₹1,00,000+. What type of experience are you looking for?";
      }
      if (lower.includes('when') || lower.includes('best time')) {
        return "The best time to visit most Indian destinations is between October and March when the weather is pleasant. For hill stations like Shimla or Manali, summer months (April-June) are ideal. For Goa, November to February is perfect. When are you planning to travel?";
      }
      if (lower.includes('how many') || lower.includes('people') || lower.includes('who')) {
        return "I can plan trips for solo travelers, couples, families, or groups. The experience and recommendations will be tailored accordingly. How many people will be traveling with you?";
      }
      return "That sounds like a great idea! When you are ready to start planning, just tell me where you want to go, when, and for how many people. I will take care of the rest.";
    }
    
    // General greetings
    if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
      return "Hello! I am your AI Travel Assistant. Ask me about travel destinations, get recommendations, or when you are ready, I can help plan your perfect trip. Where would you like to go?";
    }
    
    // How are you
    if (lower.includes('how are you') || lower.includes('how do you')) {
      return "I am doing great, ready to help you with your travel plans! What can I assist you with today?";
    }
    
    // What can you do
    if (lower.includes('what can you') || lower.includes('help') || lower.includes('assist')) {
      return "I can help you plan complete trips with flights, hotels, and activities. I can also answer travel questions, give destination recommendations, suggest itineraries, and provide travel tips. When you are ready to plan a trip, just tell me where you want to go!";
    }
    
    // Thank you
    if (lower.includes('thank') || lower.includes('thanks')) {
      return "You are welcome! Feel free to ask if you have any more travel questions or when you are ready to plan your next adventure.";
    }
    
    // Default response for travel-related queries
    if (TRAVEL_KEYWORDS.some(kw => lower.includes(kw))) {
      return "I would be happy to help! Could you tell me more about what you are looking for? When you are ready to plan a trip, just let me know your destination, dates, and traveler count.";
    }
    
    // Very generic response
    return "I am here to help with your travel needs. When you are ready to plan a trip, just tell me where you want to go and I will create a complete itinerary for you.";
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="travel-chat-container">
      <div className="travel-chat-messages">
        <div className="messages-inner">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`travel-message ${msg.role === 'user' ? 'travel-message-user' : 'travel-message-assistant'}`}
            >
              <div className="message-bubble-wrapper">
                <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                  <p className="message-text">{msg.content}</p>
                  <span className="message-timestamp">
                    {msg.timestamp.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="travel-message travel-message-assistant">
              <div className="message-bubble-wrapper">
                <div className="assistant-bubble">
                  <div className="typing-indicator">
                    <div className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <div className="typing-dot" style={{ animationDelay: '200ms' }} />
                    <div className="typing-dot" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {suggestedFollowups.length > 0 && !isLoading && (
            <div className="suggestions-container">
              <p className="suggestions-label">Suggestions:</p>
              <div className="suggestions-grid">
                {suggestedFollowups.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="suggestion-button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="travel-chat-input">
        <div className="input-wrapper">
          <input
            id="main-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Chat with me about travel, or say 'Plan a trip to...' to start planning"
            disabled={isLoading}
            className="chat-input-field"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      <style jsx global>{`
        .travel-chat-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border-accent);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.08), 0 4px 12px rgba(139, 92, 246, 0.05);
          min-height: 320px;
          max-height: 500px;
          transition: all var(--transition-base);
        }
        
        .travel-chat-container:hover {
          box-shadow: 0 12px 30px rgba(139, 92, 246, 0.12), 0 6px 16px rgba(139, 92, 246, 0.08);
        }

        .travel-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: transparent;
        }

        .messages-inner {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .travel-message {
          display: flex;
          max-width: 90%;
          animation: message-fade-in 0.3s ease-out;
        }

        .travel-message-assistant {
          align-self: flex-start;
        }

        .travel-message-user {
          align-self: flex-end;
        }

        @keyframes message-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-bubble-wrapper {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .message-bubble {
          padding: 16px 20px;
          border-radius: var(--radius-lg);
          position: relative;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .assistant-bubble {
          background: var(--color-bg-card);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .user-bubble {
          background: var(--gradient-primary);
          color: var(--color-text-inverse);
          border: none;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
        }

        .message-text {
          font-size: 14px;
          line-height: 1.6;
          font-weight: 500;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .message-timestamp {
          font-size: 10px;
          color: var(--color-text-muted);
          font-weight: 400;
          display: block;
          margin-top: 6px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 8px 0;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-primary-500);
          animation: typing-bounce 1.4s ease-in-out infinite;
        }

        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        .suggestions-container {
          margin-top: 12px;
          padding: 16px 20px;
          background: transparent;
        }

        .suggestions-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .suggestions-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .suggestion-button {
          padding: 8px 14px;
          background: var(--color-bg-input);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .suggestion-button:hover {
          background: var(--color-primary-50);
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
        }

        .travel-chat-input {
          padding: 16px 20px;
          background: var(--color-bg-input);
          border-top: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .input-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          background: var(--color-bg-base);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 12px 12px 12px 20px;
          transition: all var(--transition-fast);
        }

        .input-wrapper:focus-within {
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 3px var(--color-primary-glow);
        }

        .chat-input-field {
          flex: 1;
          padding: 12px 0;
          background: transparent;
          border: none;
          font-size: 15px;
          color: var(--color-text-primary);
          font-weight: 500;
          outline: none;
          min-width: 0;
        }

        .chat-input-field::placeholder {
          color: var(--color-text-muted);
        }

        .send-button {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          background: var(--gradient-primary);
          border: none;
          color: var(--color-text-inverse);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-base);
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
        }

        .send-button:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .travel-chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .travel-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .travel-chat-messages::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 3px;
        }

        .travel-chat-messages::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
