'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUserId } from '@/lib/api';
import { useTripStore } from '@/store/trip-store';
import { createTripSSEClient } from '@/lib/sse-client';
import { AgentActionShimmer } from '@/components/AgentActionShimmer';
import { DestinationCard } from '@/components/DestinationCard';
import { IntakeWizard, IntakeData } from '@/components/IntakeWizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Send,
  Loader2,
  Sparkles,
  MapPin,
  ArrowRight,
  Compass,
  CheckCircle2,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedTripQuery?: string;
  planningTripId?: string;
}

interface TravelChatProps {
  initialPrompt?: string;
}

const WELCOME_MESSAGES = [
  'Tell me the destination you want to plan. I will collect the essential details and then start the planning workflow.',
];

/** Render the small Markdown subset used by the assistant without injecting HTML. */
function renderMessage(content: string) {
  return content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    const isBold = (part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'));
    return isBold ? <strong key={index}>{part.replace(/^\*\*?|\*\*?$/g, '')}</strong> : part;
  });
}

export function TravelChat({ initialPrompt = '' }: TravelChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLaunchingPlan, setIsLaunchingPlan] = useState(false);
  const [userId, setUserId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [lastUserQuery, setLastUserQuery] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(true);

  const router = useRouter();
  const { setTripId, setIsPlanning, reset, tripState, preferenceQuestions } = useTripStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<ReturnType<typeof createTripSSEClient> | null>(null);

  useEffect(() => {
    // If we were launched with a pre-filled prompt (e.g. from ?prompt= URL param),
    // skip the wizard and go straight to freeform chat — the user already has a
    // specific query in mind and shouldn't be forced through a structured form.
    if (initialPrompt) {
      setInput(initialPrompt);
      setLastUserQuery(initialPrompt);
      setShowWizard(false);
    }
  }, [initialPrompt]);

  useEffect(() => {
    const welcomeMsg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    setMessages([
      {
        role: 'assistant',
        content: welcomeMsg,
        timestamp: new Date(),
      },
    ]);

    const storedUserId = getUserId();
    const storedConversationId =
      window.localStorage.getItem('tripmind-conversation-id') || crypto.randomUUID();
    window.localStorage.setItem('tripmind-user-id', storedUserId);
    window.localStorage.setItem('tripmind-conversation-id', storedConversationId);
    setUserId(storedUserId);
    setConversationId(storedConversationId);

    return () => {
      if (sseRef.current) {
        sseRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, tripState, preferenceQuestions]);

  const handleLaunchPlanning = async (queryToPlan?: string, statusMessage?: string, wizardData?: IntakeData) => {
    const tripQuery = (queryToPlan || lastUserQuery || input || 'Curated holiday destination').trim();
    if (!tripQuery) return;

    setIsLaunchingPlan(true);

    try {
      reset();
      // Read any saved profile preferences
      let homeLocation: string | undefined;
      let homeCountry: string | undefined;
      let currency: string | undefined;

      try {
        const saved = window.localStorage.getItem('tripmind-user-profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.home_city) homeLocation = parsed.home_city;
          if (parsed.home_country) homeCountry = parsed.home_country;
          if (parsed.currency) currency = parsed.currency;
        }
      } catch {
        /* ignore */
      }

      const response = await api.startPlanning(tripQuery, userId || undefined, {
        home_location: wizardData?.origin || homeLocation,
        home_country: homeCountry,
        currency: currency,
        budget: wizardData?.budgetStyle,
        trip_duration: wizardData?.duration,
        destinations: wizardData?.destination ? [wizardData.destination] : undefined,
        travelers: wizardData?.travelers,
      });

      const newTripId = response.trip_id;
      setTripId(newTripId);
      setIsPlanning(true);

      // Connect to SSE directly inside the chat interface
      if (sseRef.current) {
        sseRef.current.disconnect();
      }
      const client = createTripSSEClient(newTripId);
      sseRef.current = client;

      client
        .on('*', (event) => {
          useTripStore.getState().handleEvent(event);
        })
        .on('trip.ready', () => {
          useTripStore.setState({ isPlanning: false });
          router.push(`/trip/${newTripId}`);
        })
        .connect();

      // Poll current trip state
      api.getTrip(newTripId).then((st) => useTripStore.getState().setTripState(st)).catch(console.error);

      // Replace an existing “brief ready” prompt when launched from it;
      // otherwise add the one combined workflow message.
      setMessages((prev) => {
        const lastAssistantIndex = [...prev].map((message) => message.role).lastIndexOf('assistant');
        const lastAssistant = lastAssistantIndex >= 0 ? prev[lastAssistantIndex] : undefined;
        const workflowMessage: Message = {
          role: 'assistant',
          content: statusMessage || "Your planning workflow has started.",
          timestamp: new Date(),
          planningTripId: newTripId,
        };
        if (lastAssistant?.suggestedTripQuery) {
          return prev.map((message, index) => index === lastAssistantIndex ? workflowMessage : message);
        }
        return [...prev, workflowMessage];
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Planning could not be started: ${message}. Please verify the connection or try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLaunchingPlan(false);
    }
  };

  const handleSelectDestination = async (targetTripId: string, destinationId: string) => {
    setSelectedDestId(destinationId);
    try {
      await api.selectDestination(targetTripId, destinationId);
      useTripStore.setState({ isPlanning: true });
    } catch (err) {
      console.error(err);
    }
  };

  const submitPreferences = async (targetTripId: string) => {
    if (!preferenceQuestions.every((question) => answers[question.id]?.trim())) return;
    try {
      await api.answerPreferences(targetTripId, answers);
      useTripStore.setState({ preferenceQuestions: [], isPlanning: true });
    } catch (error) {
      console.error(error);
    }
  };

  const destinations = tripState?.candidate_destinations || [];
  const hasDestinations = destinations.length > 0;
  const destinationChosen = Boolean(selectedDestId || tripState?.selected_destination?.id);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isLoading || isLaunchingPlan) return;

    setInput('');
    setLastUserQuery(text);

    // Append user message immediately
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      // Pure LLM invocation - no keyword checks or hardcoded traps
      const result = await api.sendConversationMessage(userId, conversationId, text, true);

      if (result.planning_ready) {
        // Use the backend-constructed planning_query (which the LLM assembled from
        // all collected fields) rather than the raw user message — this gives the
        // trip workflow a self-contained, unambiguous query even when the user's
        // message was a one-word answer like "Delhi" or "7 days".
        await handleLaunchPlanning(
          result.planning_query || text,
          "I have the essentials. **Your trip brief is ready.** Planning workflow has started."
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.response,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "I'm experiencing a brief connection delay to the LLM. Please check your backend connection and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWizardComplete = (data: IntakeData) => {
    setShowWizard(false);
    setMessages([]); // Clear the initial text welcome message

    // Translate the qualitative budget style into approximate ranges so the
    // user_preference LLM can extract a numeric budget_amount and won't ask again.
    const budgetDescriptions: Record<string, string> = {
      'Luxury':          'luxury budget (high-end, cost is not a concern)',
      'Medium':          'mid-range budget (comfortable but cost-conscious)',
      'Budget Friendly': 'budget-friendly (economical, lowest reasonable cost)',
    };
    const budgetText = budgetDescriptions[data.budgetStyle] ?? `${data.budgetStyle} budget`;

    const query = [
      `Plan a trip to ${data.destination}`,
      `from ${data.origin}`,
      `for ${data.duration} days`,
      `for ${data.travelers} person${Number(data.travelers) !== 1 ? 's' : ''}`,
      `with a ${budgetText}.`,
    ].join(' ');

    handleLaunchPlanning(query, "Your trip brief is ready. The planning workflow has started.", data);
  };

  if (showWizard) {
    return (
      <Card className="w-full h-[min(720px,80vh)] min-h-[520px] flex flex-col border-none overflow-hidden shadow-none bg-transparent">
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full flex flex-col items-center gap-4">
            <IntakeWizard onComplete={handleWizardComplete} />
            {/* Escape hatch for users who prefer to type naturally */}
            <button
              type="button"
              onClick={() => setShowWizard(false)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Skip — I&apos;ll describe my trip in my own words
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[min(720px,80vh)] min-h-[520px] flex flex-col border-none overflow-hidden shadow-none bg-transparent">
      {/* Chat Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
        <div className="flex flex-col gap-5 pb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}>
                
                {/* Avatar */}
                <Avatar className="w-8 h-8 border mt-0.5 shadow-sm">
                  {msg.role === 'assistant' ? (
                    <AvatarFallback className="bg-primary/10">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-muted">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Bubble */}
                <div className={cn(
                  "flex flex-col gap-1.5",
                  msg.planningTripId ? "w-full max-w-[680px]" : ""
                )}>
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted/50 border rounded-tl-sm text-foreground"
                    )}
                  >
                    {msg.role === 'assistant' && msg.planningTripId && tripState?.id === msg.planningTripId && preferenceQuestions.length > 0 ? (
                      <span>A few details would help tailor your trip to your exact taste.</span>
                    ) : (
                      renderMessage(msg.content)
                    )}

                    {/* "Generate full itinerary" pill — only shown when assistant
                        explicitly offered a suggested query to confirm. */}
                    {msg.role === 'assistant' && msg.suggestedTripQuery && !msg.planningTripId && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLaunchPlanning(msg.suggestedTripQuery)}
                          disabled={isLaunchingPlan}
                          className="w-full sm:w-auto flex items-center justify-start gap-2 h-9 border-primary/30 hover:bg-primary/5 hover:border-primary/50 text-xs shadow-sm transition-all rounded-lg"
                        >
                          {isLaunchingPlan ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                              <span>Starting orchestration...</span>
                            </>
                          ) : (
                            <>
                              <Compass className="w-3.5 h-3.5 text-primary" />
                              <span className="font-medium text-foreground">Generate full 9-agent itinerary</span>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto sm:ml-2" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {/* Live Agent Action Shimmer shown directly in the chat interface */}
                    {msg.planningTripId && (
                      <div className="mt-4 w-full flex flex-col gap-4">
                        <AgentActionShimmer
                          tripId={msg.planningTripId}
                          compact
                          onOpenTrip={() => router.push(`/trip/${msg.planningTripId}`)}
                        />

                        {/* If preference questions are waiting */}
                        {tripState?.id === msg.planningTripId && preferenceQuestions.length > 0 && (
                          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader className="pb-3 border-b bg-muted/20 px-4 py-3 flex flex-row items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-sm">Tailor Your Trip</CardTitle>
                                <p className="text-xs text-muted-foreground">A few essentials to personalize your route.</p>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 flex flex-col gap-5">
                              {preferenceQuestions.map((question, qIdx) => (
                                <div key={question.id} className="flex flex-col gap-2">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-bold text-muted-foreground mt-0.5">0{qIdx + 1}</span>
                                    <label className="text-sm font-medium">{question.prompt || question.question}</label>
                                  </div>
                                  
                                  {question.options && question.options.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 mt-1 pl-5">
                                      {question.options.map((option: string) => {
                                        const isSelected = answers[question.id] === option;
                                        return (
                                          <Button
                                            key={option}
                                            variant={isSelected ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                              "h-8 rounded-full text-xs font-medium transition-all shadow-none",
                                              isSelected ? "shadow-sm" : ""
                                            )}
                                            onClick={() => setAnswers((cur) => ({ ...cur, [question.id]: option }))}
                                          >
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                                            {option}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="pl-5 mt-1">
                                      <Input
                                        type="text"
                                        value={answers[question.id] || ""}
                                        onChange={(e) =>
                                          setAnswers((cur) => ({ ...cur, [question.id]: e.target.value }))
                                        }
                                        placeholder="Type your answer..."
                                        className="h-9 text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </CardContent>
                            <CardFooter className="p-4 pt-0 flex justify-end">
                              <Button
                                onClick={() => submitPreferences(msg.planningTripId!)}
                                disabled={!preferenceQuestions.every((q) => answers[q.id]?.trim())}
                                size="sm"
                                className="gap-1.5 h-8 font-medium rounded-md text-xs shadow-sm"
                              >
                                Continue Planning
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </CardFooter>
                          </Card>
                        )}

                        {/* Candidate Destinations directly inline in chat */}
                        {tripState?.id === msg.planningTripId && hasDestinations && !destinationChosen && (
                          <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                              Select Candidate Destination
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {destinations.map((dest: any) => (
                                <DestinationCard
                                  key={dest.id}
                                  destination={dest}
                                  onSelect={(destId) => handleSelectDestination(msg.planningTripId!, destId)}
                                  isSelected={selectedDestId === dest.id}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <span className={cn(
                    "text-[10px] px-1 font-medium",
                    msg.role === 'user' ? "text-muted-foreground text-right" : "text-muted-foreground"
                  )}>
                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Shimmering agent reasoning state directly inside the chat interface */}
          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <Avatar className="w-8 h-8 border mt-0.5 shadow-sm">
                  <AvatarFallback className="bg-primary/10">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  </AvatarFallback>
                </Avatar>
                <div className="px-2 py-1">
                  <AgentActionShimmer
                    statusMessage="Thinking..."
                    compact
                  />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="p-4 bg-transparent shrink-0">
        <div className="relative flex items-center w-full">
          <Input
            id="main-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything or describe your journey..."
            disabled={isLoading || isLaunchingPlan}
            className="pr-12 h-12 rounded-xl border-muted bg-muted/30 focus-visible:ring-primary/50 text-[15px] shadow-sm transition-all"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || isLaunchingPlan}
            className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
