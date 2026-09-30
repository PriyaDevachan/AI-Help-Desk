/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  Check,
  Copy,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface ErrorState {
  type: 'EMPTY_INPUT' | 'GEMINI_API_ERROR' | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';
  title: string;
  message: string;
  failedQuestion?: string;
}

interface PolicyItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  details?: string[];
  sampleQuestion: string;
}

const APPROVED_POLICIES: PolicyItem[] = [
  {
    id: 'leave-policy',
    title: 'Leave Policy',
    category: 'HR & Time Off',
    summary: 'Employees receive 12 casual leaves per calendar year.',
    sampleQuestion: 'How many casual leaves do employees receive per calendar year?',
  },
  {
    id: 'wfh-policy',
    title: 'Work From Home Policy',
    category: 'Workplace Flexibility',
    summary: 'Employees may work from home for up to 5 days per month.',
    sampleQuestion: 'How many days per month am I allowed to work from home?',
  },
  {
    id: 'medical-reimbursement',
    title: 'Medical Reimbursement Policy',
    category: 'Benefits & Claims',
    summary: 'Employees must submit the required documents for medical reimbursement:',
    details: ['Medical bill', 'Prescription', 'Reimbursement form'],
    sampleQuestion: 'What documents do I need to submit for medical reimbursement?',
  },
  {
    id: 'password-policy',
    title: 'Corporate Password Policy',
    category: 'IT Security',
    summary: 'Employees can reset their corporate password through the IT self-service portal.',
    sampleQuestion: 'How can I reset my corporate password?',
  },
  {
    id: 'it-support-policy',
    title: 'IT Support Policy',
    category: 'IT Helpdesk',
    summary: 'Employees can create an IT support ticket for hardware or software issues.',
    sampleQuestion: 'What is the policy for getting help with hardware or software issues?',
  },
];

const QUICK_TEST_PROMPTS = [
  {
    label: 'Casual Leave Allowance',
    question: 'How many casual leaves do employees receive per calendar year?',
  },
  {
    label: 'Work From Home Limit',
    question: 'How many days per month can employees work from home?',
  },
  {
    label: 'Medical Claim Documents',
    question: 'What documents must I submit for medical reimbursement?',
  },
  {
    label: 'Password Reset Process',
    question: 'Where can I reset my corporate password?',
  },
  {
    label: 'Request IT Ticket Creation',
    question: 'Can you create an IT support ticket for my broken laptop screen?',
  },
  {
    label: 'Unlisted Policy Check',
    question: 'What is the company policy on international travel reimbursement?',
  },
];

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [policySearch, setPolicySearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'chat' | 'policies'>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const filteredPolicies = APPROVED_POLICIES.filter(
    (policy) =>
      policy.title.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.summary.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.category.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.details?.some((d) => d.toLowerCase().includes(policySearch.toLowerCase()))
  );

  const sendQuestion = async (questionText: string) => {
    if (isLoading) return;

    const trimmed = questionText.trim();

    // 1. Graceful & explicit handling of empty user input
    if (!trimmed) {
      setError({
        type: 'EMPTY_INPUT',
        title: 'Empty Question',
        message: 'Please enter a question before sending.',
      });
      inputRef.current?.focus();
      return;
    }

    setError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    const historyPayload = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsLoading(true);
    setMobileTab('chat');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
        }),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      // Parse response JSON safely to catch unexpected non-JSON responses
      let data: { reply?: unknown; error?: unknown; code?: unknown; timestamp?: string } | null =
        null;
      try {
        data = await response.json();
      } catch {
        setError({
          type: 'UNEXPECTED_RESPONSE',
          title: 'Unexpected Response',
          message:
            'The server returned a malformed response that could not be parsed. Please try again.',
          failedQuestion: trimmed,
        });
        return;
      }

      // Handle server-side / Gemini API errors
      if (!response.ok) {
        const errorMsg =
          typeof data?.error === 'string' && data.error.trim().length > 0
            ? data.error
            : `The server responded with status ${response.status}.`;
        const errorCode =
          data?.code === 'UNEXPECTED_RESPONSE' ? 'UNEXPECTED_RESPONSE' : 'GEMINI_API_ERROR';

        setError({
          type: errorCode,
          title:
            errorCode === 'UNEXPECTED_RESPONSE'
              ? 'Unexpected AI Response'
              : 'AI Service Error',
          message: errorMsg,
          failedQuestion: trimmed,
        });
        return;
      }

      // Validate that reply is a non-empty string
      if (!data || typeof data.reply !== 'string' || data.reply.trim().length === 0) {
        setError({
          type: 'UNEXPECTED_RESPONSE',
          title: 'Unexpected Response',
          message: 'Received an empty or invalid response structure from the assistant.',
          failedQuestion: trimmed,
        });
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply.trim(),
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      window.clearTimeout(timeoutId);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      setError({
        type: 'NETWORK_ERROR',
        title: isAbort ? 'Request Timed Out' : 'Network Error',
        message: isAbort
          ? 'The request to the helpdesk server timed out. Please check your connection and try again.'
          : 'Unable to connect to the helpdesk server. Please verify your network connection and try again.',
        failedQuestion: trimmed,
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(inputQuestion);
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    setInputQuestion('');
    inputRef.current?.focus();
  };

  const handleRetry = () => {
    if (!error?.failedQuestion || isLoading) return;
    const questionToRetry = error.failedQuestion;
    // Remove the last user message if it matches the failed question to avoid duplicate entries
    setMessages((prev) => {
      if (
        prev.length > 0 &&
        prev[prev.length - 1].role === 'user' &&
        prev[prev.length - 1].text === questionToRetry
      ) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    void sendQuestion(questionToRetry);
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar — Clean 3-Zone Contract */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-4">
          {/* Zone 1: Brand Title */}
          <div className="min-w-0">
            <h1
              data-testid="app-title"
              className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 truncate"
            >
              AI Employee Helpdesk Assistant
            </h1>
            <p
              data-testid="app-description"
              className="text-xs sm:text-sm text-slate-600 truncate"
            >
              Ask questions about company policies and support processes.
            </p>
          </div>

          {/* Zone 2: Mobile View Switcher / Desktop Session Context */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>Approved Knowledge Base</span>
            <span aria-hidden="true">·</span>
            <span>5 Active Policies</span>
            <span aria-hidden="true">·</span>
            <span>{messages.length} Messages in Session</span>
          </div>

          {/* Zone 3: Primary Action — Clear Chat Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex lg:hidden items-center bg-slate-100 p-0.5 rounded-lg mr-1">
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mobileTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('policies')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mobileTab === 'policies'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Policies
              </button>
            </div>

            <button
              type="button"
              data-testid="clear-chat-button"
              onClick={handleClearChat}
              disabled={isLoading && messages.length === 0}
              aria-label="Clear Chat"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Approved Company Knowledge Base */}
        <aside
          aria-label="Approved Company Knowledge Base"
          className={`lg:col-span-4 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden ${
            mobileTab === 'policies' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Approved Company Knowledge
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {filteredPolicies.length} of {APPROVED_POLICIES.length}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3.5">
              The assistant answers strictly using the verified policies listed below. Click any
              policy to ask about it.
            </p>

            {/* Filter Input */}
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={policySearch}
                onChange={(e) => setPolicySearch(e.target.value)}
                placeholder="Filter approved policies..."
                aria-label="Filter approved policies"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Policy List */}
          <div className="flex-1 divide-y divide-slate-200 overflow-y-auto max-h-[560px]">
            {filteredPolicies.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-500 mb-2">
                  No approved policies match &ldquo;{policySearch}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => setPolicySearch('')}
                  className="text-xs font-medium text-slate-900 underline hover:text-slate-700 cursor-pointer"
                >
                  Reset filter
                </button>
              </div>
            ) : (
              filteredPolicies.map((policy, index) => (
                <div key={policy.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-mono tabular-nums">
                      0{index + 1} · {policy.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">{policy.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{policy.summary}</p>
                  {policy.details && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700 pl-4 list-disc">
                      {policy.details.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => void sendQuestion(policy.sampleQuestion)}
                    disabled={isLoading}
                    className="mt-3 text-xs font-medium text-slate-900 hover:text-slate-600 underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Ask about this policy
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
            Questions outside these 5 policies return a standard insufficient-information notice.
            Direct IT ticket creation is not yet connected.
          </div>
        </aside>

        {/* Right Main Column: Chat Interface */}
        <section
          aria-label="Helpdesk Chat Interface"
          className={`lg:col-span-8 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[620px] ${
            mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Chat Area Header */}
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span className="font-medium text-slate-900">Conversation Session</span>
              <span aria-hidden="true">·</span>
              <span>Context maintained while chat is open</span>
            </div>
            {messages.length > 0 && (
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {messages.length} {messages.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>

          {/* Chat Message Area */}
          <div
            data-testid="chat-message-area"
            role="log"
            aria-live="polite"
            aria-label="Chat message history"
            className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-5 bg-slate-50/40"
          >
            {messages.length === 0 ? (
              <div
                data-testid="empty-chat-state"
                className="h-full flex flex-col justify-center max-w-xl mx-auto py-8"
              >
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <BookOpen className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <span>Internal Employee Support</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1.5">
                    How can the Helpdesk Assistant help you today?
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Type a question below or choose a sample topic to verify policy details on
                    casual leave, work from home, medical reimbursement, corporate password resets,
                    or IT support tickets.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2.5">
                    Try a sample employee question:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {QUICK_TEST_PROMPTS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => void sendQuestion(item.question)}
                        disabled={isLoading}
                        className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50/60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-slate-900 mb-0.5">
                          {item.label}
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-2">{item.question}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    data-testid={isUser ? 'chat-message-user' : 'chat-message-assistant'}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Message Metadata Header */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 px-1">
                      <span className="font-medium text-slate-700">
                        {isUser ? 'Employee' : 'Helpdesk Assistant'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={msg.timestamp} className="font-mono tabular-nums">
                        {formatTime(msg.timestamp)}
                      </time>
                      {!isUser && (
                        <>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(msg.id, msg.text)}
                            aria-label="Copy assistant response"
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Message Body */}
                    <div
                      className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-900 border border-slate-200'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}

            {/* Loading Indicator while Gemini is responding */}
            {isLoading && (
              <div
                data-testid="loading-indicator"
                role="status"
                aria-live="polite"
                className="flex flex-col items-start"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 px-1">
                  <span className="font-medium text-slate-700">Helpdesk Assistant</span>
                  <span aria-hidden="true">·</span>
                  <span>Checking approved company knowledge...</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 inline-flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" aria-hidden="true" />
                  <span>Generating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner Area (for Empty Input, Gemini API Errors, Network Errors, Unexpected Responses) */}
          {error && (
            <div
              data-testid="error-banner"
              role="alert"
              className="mx-5 mb-3 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle
                  className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-red-900">{error.title}</p>
                  <p data-testid="error-message" className="text-red-800 mt-0.5">
                    {error.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {error.failedQuestion && (
                  <button
                    type="button"
                    data-testid="retry-button"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-900 bg-white border border-red-300 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="dismiss-error-button"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="p-1 text-red-700 hover:text-red-900 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Question Input Form */}
          <form
            onSubmit={handleFormSubmit}
            noValidate
            className="p-4 sm:p-5 bg-white border-t border-slate-200"
          >
            <div className="flex items-center gap-2.5">
              <label htmlFor="employee-question-input" className="sr-only">
                Ask a question about company policies or support processes
              </label>
              <input
                id="employee-question-input"
                ref={inputRef}
                type="text"
                data-testid="question-input"
                value={inputQuestion}
                onChange={(e) => {
                  setInputQuestion(e.target.value);
                  if (error?.type === 'EMPTY_INPUT') {
                    setError(null);
                  }
                }}
                disabled={isLoading}
                placeholder="Ask a question about company policies or support processes..."
                autoComplete="off"
                className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              />

              <button
                type="submit"
                data-testid="send-button"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:bg-slate-950 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
