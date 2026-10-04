import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export interface CreateTicketInput {
  title: string;
  issueType: TicketIssueType;
  description: string;
  priority?: TicketPriority;
  createdBy?: string;
  assignedTo?: string;
}

const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');

const INITIAL_SEED_TICKETS: ITTicket[] = [
  {
    id: 'tk-1',
    ticketId: 'TK-2026-089',
    title: 'Corporate password portal access check',
    issueType: 'software',
    priority: 'medium',
    description: 'Self-service portal access verification and single sign-on authentication sync.',
    status: 'Resolved',
    assignedTo: 'IT Security & Access Desk',
    createdAt: '2026-09-28T09:15:00.000Z',
    updatedAt: '2026-09-28T11:45:00.000Z',
    createdBy: 'Priya',
    comments: [
      {
        id: 'c-1',
        author: 'IT Security Desk',
        text: 'Portal credentials synchronized. Employee confirmed login is operational.',
        timestamp: '2026-09-28T11:45:00.000Z',
      },
    ],
  },
  {
    id: 'tk-2',
    ticketId: 'TK-2026-042',
    title: 'External monitor HDMI cable request',
    issueType: 'hardware',
    priority: 'low',
    description: 'Hardware cable replacement for dual-monitor workstation docking station.',
    status: 'Resolved',
    assignedTo: 'Hardware Services Desk',
    createdAt: '2026-09-24T14:30:00.000Z',
    updatedAt: '2026-09-24T16:00:00.000Z',
    createdBy: 'Priya',
    comments: [
      {
        id: 'c-2',
        author: 'Hardware Services',
        text: 'Standard 4K HDMI cable dispatched and tested with employee monitor setup.',
        timestamp: '2026-09-24T16:00:00.000Z',
      },
    ],
  },
];

class TicketService {
  private tickets: ITTicket[] = [];
  private isLoaded = false;

  constructor() {
    this.ensureDataLoaded();
  }

  private ensureDataLoaded() {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        this.tickets = JSON.parse(fileContent);
      } else {
        this.tickets = [...INITIAL_SEED_TICKETS];
        this.saveToFile();
      }
    } catch (err) {
      console.error('Error loading tickets from file, using seed memory:', err);
      this.tickets = [...INITIAL_SEED_TICKETS];
    }
    this.isLoaded = true;
  }

  private saveToFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.tickets, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write tickets to disk:', err);
    }
  }

  private getNextTicketNumber(): number {
    let max = 100;
    for (const t of this.tickets) {
      const match = t.ticketId.match(/TK-\d{4}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max + 1;
  }

  public getAll(filters?: {
    status?: string;
    search?: string;
    issueType?: string;
  }): { tickets: ITTicket[]; stats: { total: number; open: number; inProgress: number; resolved: number } } {
    this.ensureDataLoaded();

    let result = [...this.tickets];

    if (filters?.status && filters.status !== 'all') {
      result = result.filter(
        (t) => t.status.toLowerCase() === filters.status?.toLowerCase()
      );
    }

    if (filters?.issueType && filters.issueType !== 'all') {
      result = result.filter(
        (t) => t.issueType.toLowerCase() === filters.issueType?.toLowerCase()
      );
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.ticketId.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignedTo.toLowerCase().includes(q)
      );
    }

    // Sort by createdAt descending
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const stats = {
      total: this.tickets.length,
      open: this.tickets.filter((t) => t.status === 'Open').length,
      inProgress: this.tickets.filter((t) => t.status === 'In Progress').length,
      resolved: this.tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length,
    };

    return { tickets: result, stats };
  }

  public getById(idOrTicketId: string): ITTicket | undefined {
    this.ensureDataLoaded();
    const query = idOrTicketId.trim().toUpperCase();
    return this.tickets.find(
      (t) => t.id === idOrTicketId || t.ticketId.toUpperCase() === query
    );
  }

  public create(input: CreateTicketInput): ITTicket {
    this.ensureDataLoaded();

    const nextNum = this.getNextTicketNumber();
    const ticketId = `TK-2026-${nextNum}`;
    const now = new Date().toISOString();

    const assignedTo =
      input.assignedTo ||
      (input.issueType === 'hardware'
        ? 'Hardware Support Desk'
        : 'Systems & Application Support');

    const newTicket: ITTicket = {
      id: `tk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ticketId,
      title: input.title.trim(),
      issueType: input.issueType === 'hardware' ? 'hardware' : 'software',
      priority: input.priority || 'medium',
      description: input.description.trim(),
      status: 'Open',
      assignedTo,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy || 'Priya',
      comments: [
        {
          id: `c-init-${Date.now()}`,
          author: 'System',
          text: `Ticket logged by ${input.createdBy || 'Priya'} via Helpdesk Service.`,
          timestamp: now,
        },
      ],
    };

    this.tickets.unshift(newTicket);
    this.saveToFile();
    return newTicket;
  }

  public updateStatus(
    idOrTicketId: string,
    status: TicketStatus,
    note?: string
  ): ITTicket | undefined {
    this.ensureDataLoaded();
    const ticket = this.getById(idOrTicketId);
    if (!ticket) return undefined;

    const now = new Date().toISOString();
    ticket.status = status;
    ticket.updatedAt = now;

    if (note && note.trim()) {
      ticket.comments.push({
        id: `c-${Date.now()}`,
        author: 'IT Support Team',
        text: note.trim(),
        timestamp: now,
      });
    }

    this.saveToFile();
    return ticket;
  }

  public addComment(
    idOrTicketId: string,
    author: string,
    text: string
  ): ITTicket | undefined {
    this.ensureDataLoaded();
    const ticket = this.getById(idOrTicketId);
    if (!ticket) return undefined;

    const now = new Date().toISOString();
    ticket.comments.push({
      id: `c-${Date.now()}`,
      author: author || 'Priya',
      text: text.trim(),
      timestamp: now,
    });
    ticket.updatedAt = now;

    this.saveToFile();
    return ticket;
  }

  public delete(idOrTicketId: string): boolean {
    this.ensureDataLoaded();
    const initialLen = this.tickets.length;
    this.tickets = this.tickets.filter(
      (t) => t.id !== idOrTicketId && t.ticketId.toUpperCase() !== idOrTicketId.trim().toUpperCase()
    );
    if (this.tickets.length !== initialLen) {
      this.saveToFile();
      return true;
    }
    return false;
  }
}

export const ticketService = new TicketService();
