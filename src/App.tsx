/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Building2,
  Home,
  MessageSquare,
  ClipboardList,
  BookOpen,
  LifeBuoy,
  Settings,
  Bell,
  User,
  Send,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  Check,
  Copy,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Menu,
  CheckCircle2,
  Wrench,
  Plus,
  Clock,
  MessageCircle,
  Laptop,
  Layers,
  ArrowUpRight,
  Edit3,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FileText,
} from 'lucide-react';

export type TicketIssueType = 'hardware' | 'software';
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface ITTicket {
  id: string;
  ticketId: string;
  title: string;
  issueType: TicketIssueType;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  comments: TicketComment[];
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export interface PolicyItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  details?: string[];
  sampleQuestion: string;
  isApproved: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  ticket?: ITTicket;
}

interface ErrorState {
  type: 'EMPTY_INPUT' | 'GEMINI_API_ERROR' | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';
  title: string;
  message: string;
  failedQuestion?: string;
}

// Fallback questions matching the requested wireframe
const DEFAULT_SUGGESTED_QUESTIONS = [
  'How many casual leaves do I get?',
  'Can I work from home for 5 days?',
  'What documents are needed for medical reimbursement?',
  'I need to reset my password',
];

const ADDITIONAL_QA_QUESTIONS = [
  'Can you create an IT support ticket for my broken monitor?',
  'What is the status of ticket TK-2026-089?',
  'What is the company maternity leave policy?',
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

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'home' | 'ask-ai' | 'tickets' | 'policies' | 'policy-management' | 'support' | 'settings'
  >('home');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState | null>(null);

  // Tickets State
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats>({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [ticketFilterStatus, setTicketFilterStatus] = useState<string>('all');
  const [ticketFilterCategory, setTicketFilterCategory] = useState<string>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<ITTicket | null>(null);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');

  // Ticket Form
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<TicketIssueType>('hardware');
  const [formPriority, setFormPriority] = useState<TicketPriority>('medium');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Policies State (Dynamic from Backend)
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [policySearch, setPolicySearch] = useState<string>('');
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyItem | null>(null);
  const [policySuccessBanner, setPolicySuccessBanner] = useState<string | null>(null);

  // Policy Form fields
  const [policyFormTitle, setPolicyFormTitle] = useState<string>('');
  const [policyFormCategory, setPolicyFormCategory] = useState<string>('HR & Time Off');
  const [policyFormSummary, setPolicyFormSummary] = useState<string>('');
  const [policyFormDetails, setPolicyFormDetails] = useState<string>('');
  const [policyFormQuestion, setPolicyFormQuestion] = useState<string>('');
  const [policyFormApproved, setPolicyFormApproved] = useState<boolean>(true);
  const [policyFormSubmitting, setPolicyFormSubmitting] = useState<boolean>(false);
  const [policyFormError, setPolicyFormError] = useState<string | null>(null);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch Policies from Backend
  const fetchPolicies = useCallback(async () => {
    try {
      // fetch all policies so admin can manage both approved and draft
      const res = await fetch('/api/policies?all=true');
      if (res.ok) {
        const data = await res.json();
        if (data?.policies && Array.isArray(data.policies)) {
          setPolicies(data.policies);
        }
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    }
  }, []);

  // Fetch Tickets from Backend
  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (ticketFilterStatus !== 'all') params.set('status', ticketFilterStatus);
      if (ticketFilterCategory !== 'all') params.set('issueType', ticketFilterCategory);
      if (ticketSearchQuery.trim()) params.set('search', ticketSearchQuery.trim());

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.tickets && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
        }
        if (data?.stats) {
          setTicketStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    }
  }, [ticketFilterStatus, ticketFilterCategory, ticketSearchQuery]);

  useEffect(() => {
    void fetchPolicies();
    void fetchTickets();
  }, [fetchPolicies, fetchTickets]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const approvedPolicies = policies.filter((p) => p.isApproved);

  const filteredApprovedPolicies = approvedPolicies.filter(
    (policy) =>
      policy.title.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.summary.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.category.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.details?.some((d) => d.toLowerCase().includes(policySearch.toLowerCase()))
  );

  const filteredAllPolicies = policies.filter(
    (policy) =>
      policy.title.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.summary.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.category.toLowerCase().includes(policySearch.toLowerCase()) ||
      policy.details?.some((d) => d.toLowerCase().includes(policySearch.toLowerCase()))
  );

  const sendQuestion = async (questionText: string) => {
    if (isLoading) return;

    const trimmed = questionText.trim();

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

      let data: {
        reply?: unknown;
        error?: unknown;
        code?: unknown;
        timestamp?: string;
        createdTicket?: ITTicket;
      } | null = null;
      try {
        data = await response.json();
      } catch {
        setError({
          type: 'UNEXPECTED_RESPONSE',
          title: 'Unexpected Response',
          message: 'The server returned a malformed response that could not be parsed. Please try again.',
          failedQuestion: trimmed,
        });
        return;
      }

      if (!response.ok) {
        const errorMsg =
          typeof data?.error === 'string' && data.error.trim().length > 0
            ? data.error
            : `The server responded with status ${response.status}.`;
        const errorCode =
          data?.code === 'UNEXPECTED_RESPONSE' ? 'UNEXPECTED_RESPONSE' : 'GEMINI_API_ERROR';

        setError({
          type: errorCode,
          title: errorCode === 'UNEXPECTED_RESPONSE' ? 'Unexpected AI Response' : 'AI Service Error',
          message: errorMsg,
          failedQuestion: trimmed,
        });
        return;
      }

      if (!data || typeof data.reply !== 'string' || data.reply.trim().length === 0) {
        setError({
          type: 'UNEXPECTED_RESPONSE',
          title: 'Unexpected Response',
          message: 'Received an empty or invalid response structure from the assistant.',
          failedQuestion: trimmed,
        });
        return;
      }

      if (data.createdTicket) {
        const created = data.createdTicket;
        setTickets((prev) => [created, ...prev.filter((t) => t.ticketId !== created.ticketId)]);
        void fetchTickets();
      }

      const assistantMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply.trim(),
        timestamp: data.timestamp || new Date().toISOString(),
        ticket: data.createdTicket,
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
      // fallback
    }
  };

  // Ticket creation handler
  const handleCreateTicketManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) {
      setFormError('Please enter both a title and description.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title: formTitle.trim(),
          issueType: formCategory,
          priority: formPriority,
          description: formDescription.trim(),
          createdBy: 'Priya',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          // ignore json parse error
        }
      } else {
        const text = await res.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            // non-json
          }
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to create ticket (${res.status}).`);
      }

      if (data?.ticket) {
        setTickets((prev) => [data.ticket, ...prev]);
        setNewTicketModalOpen(false);
        setFormTitle('');
        setFormDescription('');
        setFormCategory('hardware');
        setFormPriority('medium');
        void fetchTickets();
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error creating ticket');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Ticket Status update
  const handleUpdateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: `Status updated to ${newStatus} by employee.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.ticket) {
          setSelectedTicket(data.ticket);
          setTickets((prev) => prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)));
          void fetchTickets();
        }
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  // Ticket comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newCommentText.trim()) return;

    try {
      const res = await fetch(`/api/tickets/${selectedTicket.ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'Priya',
          text: newCommentText.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.ticket) {
          setSelectedTicket(data.ticket);
          setTickets((prev) => prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)));
          setNewCommentText('');
        }
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  // Policy Management Modal Handlers
  const handleOpenAddPolicy = () => {
    setEditingPolicy(null);
    setPolicyFormTitle('');
    setPolicyFormCategory('HR & Time Off');
    setPolicyFormSummary('');
    setPolicyFormDetails('');
    setPolicyFormQuestion('');
    setPolicyFormApproved(true);
    setPolicyFormError(null);
    setPolicyModalOpen(true);
  };

  const handleOpenEditPolicy = (policy: PolicyItem) => {
    setEditingPolicy(policy);
    setPolicyFormTitle(policy.title);
    setPolicyFormCategory(policy.category);
    setPolicyFormSummary(policy.summary);
    setPolicyFormDetails(policy.details?.join('\n') || '');
    setPolicyFormQuestion(policy.sampleQuestion || '');
    setPolicyFormApproved(policy.isApproved);
    setPolicyFormError(null);
    setPolicyModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyFormTitle.trim() || !policyFormSummary.trim()) {
      setPolicyFormError('Title and Summary are required.');
      return;
    }

    setPolicyFormSubmitting(true);
    setPolicyFormError(null);

    const detailsArray = policyFormDetails
      .split('\n')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const payload = {
      title: policyFormTitle.trim(),
      category: policyFormCategory.trim() || 'General Policy',
      summary: policyFormSummary.trim(),
      details: detailsArray.length > 0 ? detailsArray : undefined,
      sampleQuestion: policyFormQuestion.trim() || `What is the policy for ${policyFormTitle.trim()}?`,
      isApproved: policyFormApproved,
      updatedBy: 'Priya (Admin)',
    };

    try {
      const url = editingPolicy ? `/api/policies/${encodeURIComponent(editingPolicy.id)}` : '/api/policies';
      const method = editingPolicy ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          // ignore json parse error
        }
      } else {
        const text = await res.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            // response is non-JSON (e.g. HTML proxy error)
          }
        }
      }

      if (!res.ok) {
        const errorMsg =
          data?.error ||
          data?.message ||
          `Server returned status ${res.status} (${res.statusText || 'Error'}). Please try again.`;
        throw new Error(errorMsg);
      }

      if (!data?.policy) {
        throw new Error('Server saved the policy but did not return the policy record.');
      }

      setPolicyModalOpen(false);
      setPolicySuccessBanner(
        editingPolicy
          ? `Policy "${payload.title}" updated to v${data.policy.version}. Chatbot is now answering with the latest approved version.`
          : `New policy "${payload.title}" approved and published to AI knowledge base.`
      );
      window.setTimeout(() => setPolicySuccessBanner(null), 6000);
      void fetchPolicies();
    } catch (err: unknown) {
      setPolicyFormError(err instanceof Error ? err.message : 'Error saving policy');
    } finally {
      setPolicyFormSubmitting(false);
    }
  };

  const handleTogglePolicyApproval = async (policy: PolicyItem) => {
    try {
      const res = await fetch(`/api/policies/${policy.id}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isApproved: !policy.isApproved,
          updatedBy: 'Priya (Admin)',
        }),
      });

      if (res.ok) {
        void fetchPolicies();
        setPolicySuccessBanner(
          !policy.isApproved
            ? `Policy "${policy.title}" approved. Chatbot now includes this in knowledge base.`
            : `Policy "${policy.title}" deactivated. Chatbot will no longer use this policy.`
        );
        window.setTimeout(() => setPolicySuccessBanner(null), 5000);
      }
    } catch (err) {
      console.error('Failed to toggle approval:', err);
    }
  };

  const handleDeletePolicy = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? It will be removed from the AI knowledge base.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/policies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        void fetchPolicies();
        setPolicySuccessBanner(`Policy "${title}" removed from knowledge base.`);
        window.setTimeout(() => setPolicySuccessBanner(null), 5000);
      }
    } catch (err) {
      console.error('Failed to delete policy:', err);
    }
  };

  const navigationItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'ask-ai' as const, label: 'Ask AI', icon: MessageSquare, badge: messages.length > 0 ? messages.length : undefined },
    { id: 'tickets' as const, label: 'My Tickets', icon: ClipboardList, badge: ticketStats.total > 0 ? ticketStats.total : undefined },
    { id: 'policies' as const, label: 'Policies', icon: BookOpen, count: approvedPolicies.length },
    { id: 'policy-management' as const, label: 'Policy Management', icon: ShieldCheck, admin: true },
    { id: 'support' as const, label: 'Support', icon: LifeBuoy },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Top Header Bar Matching: 🏢 Company Helpdesk | Priya | 🔔 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Left Brand Lockup */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpenMobile((prev) => !prev)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Company Helpdesk
                  </h1>
                </div>
                <p data-testid="app-description" className="text-xs text-slate-500 hidden sm:block">
                  AI Employee Helpdesk Assistant · Dynamic Policy Knowledge & Backend Ticketing
                </p>
              </div>
            </div>
          </div>

          {/* Right User & Actions: 👤 Priya 🔔 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="clear-chat-button"
              onClick={handleClearChat}
              aria-label="Clear Chat"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>Clear Chat</span>
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-slate-900 rounded-full" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-40">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-900">Notifications & Services</span>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">{approvedPolicies.length} approved policies</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-2">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dynamic Policy Sync Active</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Authorized admins can update policies in Policy Management. Chatbot answers immediately sync to the latest approved version.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Capsule: 👤 Priya (Authorized Admin) */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-medium text-xs">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left hidden md:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 leading-tight">
                    Priya
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-1 rounded">
                    Admin
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block leading-tight">
                  Policy Lead & Engineering
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Container: Left Sidebar + Center/Right Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform lg:static lg:translate-x-0 ${
            sidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between lg:hidden">
            <span className="text-xs font-semibold text-slate-500">MENU</span>
            <button
              type="button"
              onClick={() => setSidebarOpenMobile(false)}
              className="p-1 text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : item.admin
                      ? 'text-slate-800 hover:bg-slate-100 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.admin ? 'text-slate-900' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.admin && !isActive && (
                    <span className="text-[10px] uppercase font-mono tracking-wider bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-semibold">
                      Admin
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                        isActive ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && !isActive && (
                    <span className="text-xs text-slate-400 font-mono tabular-nums">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Status Footer */}
          <div className="p-3.5 m-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Live Knowledge Sync</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Chatbot automatically loads the latest approved version on each query.
            </p>
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpenMobile && (
          <div
            onClick={() => setSidebarOpenMobile(false)}
            className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto">
          {/* Header context band */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                {activeTab.replace('-', ' ')}
              </span>
              <span>/</span>
              <span data-testid="app-title">AI Employee Helpdesk Assistant</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {approvedPolicies.length} approved policies in AI sync
              </span>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="sm:hidden text-xs text-slate-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* SUCCESS BANNER NOTIFICATION */}
          {policySuccessBanner && (
            <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{policySuccessBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setPolicySuccessBanner(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* VIEW: HOME & ASK AI */}
          {(activeTab === 'home' || activeTab === 'ask-ai') && (
            <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto">
              {/* Top Greeting & Center Prompt Section Matching Wireframe */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-6">
                <div className="text-center max-w-xl mx-auto mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2">
                    <span role="img" aria-label="waving hand">👋</span>
                    <span>How can I help you today?</span>
                  </h2>
                  <p className="text-sm text-slate-600 mt-2">
                    Ask questions about company policies, leave, work from home, or support processes.
                  </p>
                </div>

                {/* Central Input Box Form */}
                <form
                  onSubmit={handleFormSubmit}
                  noValidate
                  className="max-w-2xl mx-auto relative mb-6"
                >
                  <label htmlFor="central-question-input" className="sr-only">
                    Ask about company policies...
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="central-question-input"
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
                      placeholder="Ask about company policies..."
                      autoComplete="off"
                      className="w-full pl-4 pr-24 py-3.5 text-sm sm:text-base bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 shadow-xs transition-colors disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      data-testid="send-button"
                      disabled={isLoading}
                      className="absolute right-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:bg-slate-950 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Send</span>
                    </button>
                  </div>
                </form>

                {/* Suggested Questions */}
                <div className="max-w-2xl mx-auto pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-700 mb-2.5">
                    Suggested questions (Powered by latest approved policies):
                  </div>
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {DEFAULT_SUGGESTED_QUESTIONS.map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          onClick={() => void sendQuestion(question)}
                          disabled={isLoading}
                          className="group w-full text-left flex items-start gap-2 py-1 px-2 -mx-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-slate-700 hover:text-slate-900"
                        >
                          <span className="text-slate-400 group-hover:text-slate-900 transition-colors select-none">
                            •
                          </span>
                          <span className="flex-1 underline-offset-4 group-hover:underline">
                            {question}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-all mt-0.5" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Additional quick QA prompts toggle / hint */}
                  <div className="mt-3 pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Backend service tests:</span>
                    {ADDITIONAL_QA_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendQuestion(q)}
                        disabled={isLoading}
                        className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                      >
                        &ldquo;{q}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Error Banner Area */}
              {error && (
                <div
                  data-testid="error-banner"
                  role="alert"
                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-xs sm:text-sm">
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

              {/* Conversation Area */}
              <div
                data-testid="chat-message-area"
                role="log"
                aria-live="polite"
                aria-label="Chat message history"
                className="space-y-4"
              >
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      data-testid={isUser ? 'chat-message-user' : 'chat-message-assistant'}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 px-1">
                        <span className="font-medium text-slate-700">
                          {isUser ? 'Priya' : 'AI Helpdesk Assistant'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={msg.timestamp} className="font-mono tabular-nums text-[11px]">
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
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700 text-[11px]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span className="text-[11px]">Copy</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-2xl rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed whitespace-pre-wrap shadow-xs ${
                          isUser
                            ? 'bg-slate-900 text-white rounded-tr-none'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {msg.text}

                        {msg.ticket && (
                          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-mono font-bold text-xs text-slate-900">
                                {msg.ticket.ticketId}
                              </span>
                              <span className="text-xs text-slate-500 capitalize">
                                · {msg.ticket.title} ({msg.ticket.issueType})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTicket(msg.ticket || null);
                                setActiveTab('tickets');
                              }}
                              className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <span>View Ticket Details</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div
                    data-testid="loading-indicator"
                    role="status"
                    aria-live="polite"
                    className="flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 px-1">
                      <span className="font-medium text-slate-700">AI Helpdesk Assistant</span>
                      <span aria-hidden="true">·</span>
                      <span>Reviewing latest approved policy version...</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-5 py-3.5 text-sm text-slate-600 inline-flex items-center gap-3 shadow-xs">
                      <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" aria-hidden="true" />
                      <span>Generating approved response...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* VIEW: POLICY MANAGEMENT (Authorized Admin Area) */}
          {activeTab === 'policy-management' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-6">
              {/* Admin Banner & Heading */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono uppercase bg-slate-900 text-white px-2 py-0.5 rounded font-semibold tracking-wider">
                      Authorized Admin Console
                    </span>
                    <span className="text-xs text-slate-500">Priya (HR & IT Policy Lead)</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-slate-900" />
                    <span>Company Policy Management</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Update company policies in this area. All saved changes and new approvals are immediately compiled into the AI Helpdesk Assistant&apos;s live system prompt without server restarts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddPolicy}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 self-start md:self-auto shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add New Policy</span>
                </button>
              </div>

              {/* Live Status indicator */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Chatbot Synchronized:</strong> {approvedPolicies.length} approved policies are actively serving employee questions in the AI Chatbot knowledge base.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('ask-ai');
                  }}
                  className="font-semibold underline underline-offset-4 hover:text-emerald-800 shrink-0 cursor-pointer"
                >
                  Test in Chatbot →
                </button>
              </div>

              {/* Policies Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
                <div className="px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-600 grid grid-cols-12 gap-3">
                  <span className="col-span-3 sm:col-span-3">Policy Title</span>
                  <span className="col-span-4 sm:col-span-5">Summary & Rules</span>
                  <span className="col-span-2 sm:col-span-2">Version & Updated</span>
                  <span className="col-span-3 sm:col-span-2 text-right">Actions</span>
                </div>

                {filteredAllPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className="px-5 py-4 text-xs text-slate-700 grid grid-cols-12 gap-3 items-center hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="col-span-3 sm:col-span-3">
                      <span className="font-semibold text-slate-900 block text-sm">{policy.title}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{policy.category}</span>
                      <div className="mt-1">
                        {policy.isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Draft / Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-4 sm:col-span-5 min-w-0 pr-2">
                      <p className="text-slate-800 leading-relaxed font-medium">{policy.summary}</p>
                      {policy.details && policy.details.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-4 list-disc text-slate-600 text-[11px]">
                          {policy.details.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1 italic">
                        Sample: &ldquo;{policy.sampleQuestion}&rdquo;
                      </p>
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-slate-500 text-[11px]">
                      <span className="font-mono font-bold text-slate-800 block text-xs">
                        v{policy.version}
                      </span>
                      <span className="block mt-0.5">{formatDate(policy.updatedAt)}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{policy.updatedBy}</span>
                    </div>

                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPolicy(policy)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        title="Edit policy content"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleTogglePolicyApproval(policy)}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          policy.isApproved
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={policy.isApproved ? 'Deactivate from AI' : 'Approve for AI'}
                      >
                        {policy.isApproved ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeletePolicy(policy.id, policy.title)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        title="Delete policy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: REGULAR POLICIES (Employee Knowledge Base View) */}
          {activeTab === 'policies' && (
            <div className="p-6 sm:p-8 max-w-4xl w-full mx-auto">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Approved Company Policies</h2>
                    <p className="text-xs text-slate-500">
                      Official verified knowledge base ({approvedPolicies.length} active policies synced with AI)
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={policySearch}
                      onChange={(e) => setPolicySearch(e.target.value)}
                      placeholder="Search policies..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredApprovedPolicies.map((policy, idx) => (
                    <div
                      key={policy.id}
                      className="p-5 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors bg-white"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-mono tabular-nums">0{idx + 1} · {policy.category}</span>
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          v{policy.version}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mb-1.5">{policy.title}</h3>
                      <p className="text-sm text-slate-700 leading-relaxed mb-2">{policy.summary}</p>
                      {policy.details && policy.details.length > 0 && (
                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 mb-3">
                          {policy.details.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('ask-ai');
                          void sendQuestion(policy.sampleQuestion);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:text-slate-700 underline underline-offset-4 cursor-pointer"
                      >
                        <span>Ask AI about this</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: MY TICKETS */}
          {activeTab === 'tickets' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-slate-900" />
                    <span>IT Ticket Creation & Management Service</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct integration with backend ticketing service. Log new tickets or track existing resolutions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTicketModalOpen(true)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Ticket</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ask-ai');
                      void sendQuestion('Can you create an IT support ticket for my hardware problem?');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Ask AI to Create</span>
                  </button>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Total Tickets</span>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {ticketStats.total}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs text-amber-700 font-medium">Open</span>
                  <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
                    {ticketStats.open}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs text-blue-700 font-medium">In Progress</span>
                  <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums mt-1">
                    {ticketStats.inProgress}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs text-emerald-700 font-medium">Resolved</span>
                  <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                    {ticketStats.resolved}
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                  {['all', 'Open', 'In Progress', 'Resolved'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTicketFilterStatus(st)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        ticketFilterStatus === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'all' ? 'All Statuses' : st}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 mx-1" />

                  {['all', 'hardware', 'software'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTicketFilterCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize whitespace-nowrap cursor-pointer ${
                        ticketFilterCategory === cat
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'all' ? 'All Types' : cat}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={ticketSearchQuery}
                    onChange={(e) => setTicketSearchQuery(e.target.value)}
                    placeholder="Search by ID or title..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Tickets List */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
                <div className="px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-600 grid grid-cols-12 gap-3">
                  <span className="col-span-3 sm:col-span-2">Ticket ID</span>
                  <span className="col-span-5 sm:col-span-5">Summary</span>
                  <span className="col-span-2 sm:col-span-2">Assigned To</span>
                  <span className="col-span-2 sm:col-span-2">Priority</span>
                  <span className="hidden sm:block sm:col-span-1 text-right">Status</span>
                </div>

                {tickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-semibold text-slate-800 mb-1">No tickets found</p>
                    <p className="text-xs text-slate-500 mb-4">
                      Create an IT support ticket using the button above or by asking the AI assistant.
                    </p>
                    <button
                      type="button"
                      onClick={() => setNewTicketModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      + Create First Ticket
                    </button>
                  </div>
                ) : (
                  tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className="px-5 py-3.5 text-xs text-slate-700 grid grid-cols-12 gap-3 items-center hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <div className="col-span-3 sm:col-span-2">
                        <span className="font-mono font-bold text-slate-900 block">{t.ticketId}</span>
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {formatDate(t.createdAt)}
                        </span>
                      </div>

                      <div className="col-span-5 sm:col-span-5 min-w-0 pr-2">
                        <span className="font-semibold text-slate-900 truncate block">{t.title}</span>
                        <span className="text-slate-500 truncate block text-[11px] mt-0.5">{t.description}</span>
                      </div>

                      <div className="col-span-2 sm:col-span-2 text-slate-600 truncate">
                        <span className="block truncate">{t.assignedTo}</span>
                        <span className="text-[10px] text-slate-400 capitalize block">{t.issueType}</span>
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                            t.priority === 'urgent' || t.priority === 'high'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : t.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>

                      <div className="hidden sm:block sm:col-span-1 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            t.status === 'Open'
                              ? 'bg-amber-100 text-amber-800'
                              : t.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VIEW: SUPPORT */}
          {activeTab === 'support' && (
            <div className="p-6 sm:p-8 max-w-4xl w-full mx-auto">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">IT & HR Support Center</h2>
                  <p className="text-xs text-slate-500">Self-service portal access & ticket creation services</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">Corporate Password Self-Service</h3>
                    <p className="text-xs text-slate-600 mb-3">
                      Employees can reset their corporate password through the IT self-service portal.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('ask-ai');
                        void sendQuestion('How can I reset my corporate password?');
                      }}
                      className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ask AI for instructions</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">Hardware & Software Tickets</h3>
                    <p className="text-xs text-slate-600 mb-3">
                      Employees can create an IT support ticket for hardware or software issues directly via backend service.
                    </p>
                    <button
                      type="button"
                      onClick={() => setNewTicketModalOpen(true)}
                      className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Ticket Creation Dialog</span>
                      <Wrench className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 md:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">HR Assistance</h3>
                    <p className="text-xs text-slate-600 mb-3">
                      Questions or complex situations that cannot be handled by the approved knowledge base are directly routed to HR Assistance.
                    </p>
                    <div className="text-xs text-slate-500 font-mono">
                      <span>Contact: hr-assistance@company.internal · Extension: #4400</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="p-6 sm:p-8 max-w-4xl w-full mx-auto">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Preferences & Settings</h2>
                  <p className="text-xs text-slate-500">Manage employee profile preferences and session state</p>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Current User Profile</p>
                      <p className="text-xs text-slate-500">Priya · Authorized Admin (HR Policy Lead)</p>
                    </div>
                    <span className="text-xs bg-slate-900 text-white font-mono px-2 py-0.5 rounded-md">
                      ADMIN
                    </span>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Policy Management Privileges</p>
                      <p className="text-xs text-slate-500">Authorized to edit, approve, and add company policies</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('policy-management')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Open Policy Management
                    </button>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Clear Conversation Session</p>
                      <p className="text-xs text-slate-500">Erase current chat history and reset context</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearChat}
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear Chat History
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CREATE / EDIT POLICY (Admin Only) */}
      {policyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-900" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingPolicy ? `Edit Policy (v${editingPolicy.version})` : 'Add New Company Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {policyFormError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{policyFormError}</span>
              </div>
            )}

            <form onSubmit={handleSavePolicy} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Policy Title *
                </label>
                <input
                  type="text"
                  required
                  value={policyFormTitle}
                  onChange={(e) => setPolicyFormTitle(e.target.value)}
                  placeholder="e.g. Leave Policy, Parental Leave Policy"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  required
                  value={policyFormCategory}
                  onChange={(e) => setPolicyFormCategory(e.target.value)}
                  placeholder="e.g. HR & Time Off, Workplace Flexibility, Benefits"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Approved Rule / Summary *
                </label>
                <textarea
                  required
                  rows={2}
                  value={policyFormSummary}
                  onChange={(e) => setPolicyFormSummary(e.target.value)}
                  placeholder="e.g. Employees receive 14 casual leaves per calendar year."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Requirements / Documents (One per line)
                </label>
                <textarea
                  rows={3}
                  value={policyFormDetails}
                  onChange={(e) => setPolicyFormDetails(e.target.value)}
                  placeholder={"Medical bill\nPrescription\nReimbursement form"}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sample Employee Question
                </label>
                <input
                  type="text"
                  value={policyFormQuestion}
                  onChange={(e) => setPolicyFormQuestion(e.target.value)}
                  placeholder="e.g. How many casual leaves do I get?"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="policy-approved-check"
                  checked={policyFormApproved}
                  onChange={(e) => setPolicyFormApproved(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300"
                />
                <label htmlFor="policy-approved-check" className="text-xs font-medium text-slate-700 select-none">
                  Approve immediately for AI Chatbot knowledge base
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPolicyModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={policyFormSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {policyFormSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Publishing...</span>
                    </>
                  ) : (
                    <span>Save & Publish to AI</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW TICKET */}
      {newTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-slate-900" />
                <h3 className="text-base font-bold text-slate-900">Create IT Support Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewTicketModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicketManual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issue Summary / Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Laptop battery draining very quickly"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TicketIssueType)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority *
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description of Issue *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide any relevant hardware model, error codes, or behavior details..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewTicketModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Ticket...</span>
                    </>
                  ) : (
                    <span>Submit Ticket</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TICKET DETAILS & COMMENTS */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                    {selectedTicket.ticketId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedTicket.status === 'Open'
                        ? 'bg-amber-100 text-amber-800'
                        : selectedTicket.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedTicket.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Category</span>
                  <span className="font-medium text-slate-800 capitalize flex items-center gap-1">
                    {selectedTicket.issueType === 'hardware' ? <Laptop className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                    {selectedTicket.issueType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Priority</span>
                  <span className="font-medium text-slate-800 capitalize">{selectedTicket.priority}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Assigned Desk</span>
                  <span className="font-medium text-slate-800 truncate block">{selectedTicket.assignedTo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Reported</span>
                  <span className="font-medium text-slate-800 font-mono tabular-nums">
                    {formatDate(selectedTicket.createdAt)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white border border-slate-200 p-3 rounded-xl">
                  {selectedTicket.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Update Status:</span>
                <div className="flex items-center gap-1.5">
                  {(['Open', 'In Progress', 'Resolved'] as TicketStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => void handleUpdateTicketStatus(selectedTicket.ticketId, st)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        selectedTicket.status === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Activity & Comments ({selectedTicket.comments?.length || 0})</span>
                </h4>

                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {selectedTicket.comments?.map((comment) => (
                    <div key={comment.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-700">{comment.author}</span>
                        <span className="font-mono tabular-nums flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(comment.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{comment.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add a reply or update note..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    Reply
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
