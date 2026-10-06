/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export const INITIAL_APPROVED_POLICIES: PolicyItem[] = [
  {
    id: 'leave-policy',
    title: 'Leave Policy',
    category: 'HR & Time Off',
    summary: 'Employees receive 12 casual leaves per calendar year.',
    sampleQuestion: 'How many casual leaves do I get?',
    isApproved: true,
    version: 1,
    updatedAt: '2026-09-01T09:00:00.000Z',
    updatedBy: 'Admin (HR Operations)',
  },
  {
    id: 'wfh-policy',
    title: 'Work From Home Policy',
    category: 'Workplace Flexibility',
    summary: 'Employees may work from home for up to 5 days per month.',
    sampleQuestion: 'Can I work from home for 5 days?',
    isApproved: true,
    version: 1,
    updatedAt: '2026-09-01T09:00:00.000Z',
    updatedBy: 'Admin (HR Operations)',
  },
  {
    id: 'medical-reimbursement',
    title: 'Medical Reimbursement Policy',
    category: 'Benefits & Claims',
    summary: 'Employees must submit the following documents for medical reimbursement:',
    details: ['Medical bill', 'Prescription', 'Reimbursement form'],
    sampleQuestion: 'What documents are needed for medical reimbursement?',
    isApproved: true,
    version: 1,
    updatedAt: '2026-09-01T09:00:00.000Z',
    updatedBy: 'Admin (Benefits Team)',
  },
  {
    id: 'password-policy',
    title: 'Corporate Password Policy',
    category: 'IT Security',
    summary: 'Employees can reset their corporate password through the IT self-service portal.',
    sampleQuestion: 'I need to reset my password',
    isApproved: true,
    version: 1,
    updatedAt: '2026-09-01T09:00:00.000Z',
    updatedBy: 'Admin (IT Security Lead)',
  },
  {
    id: 'it-support-policy',
    title: 'IT Support Policy',
    category: 'IT Helpdesk',
    summary: 'Employees can create an IT support ticket for hardware or software issues.',
    sampleQuestion: 'Can you create an IT support ticket for my laptop issue?',
    isApproved: true,
    version: 1,
    updatedAt: '2026-09-01T09:00:00.000Z',
    updatedBy: 'Admin (IT Helpdesk Manager)',
  },
];

export const INITIAL_SEED_TICKETS: ITTicket[] = [
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
    assignedTo: 'Workstation Hardware Support',
    createdAt: '2026-09-25T14:20:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
    createdBy: 'Priya',
    comments: [
      {
        id: 'c-2',
        author: 'Hardware Desk',
        text: 'New HDMI 2.1 cable delivered to desk 4B.',
        timestamp: '2026-09-26T10:00:00.000Z',
      },
    ],
  },
  {
    id: 'tk-3',
    ticketId: 'TK-2026-101',
    title: 'VPN connection timeout during remote login',
    issueType: 'software',
    priority: 'high',
    description: 'VPN gateway fails handshake on corporate Wi-Fi after client update.',
    status: 'In Progress',
    assignedTo: 'Network Infrastructure Team',
    createdAt: '2026-10-01T08:30:00.000Z',
    updatedAt: '2026-10-01T09:15:00.000Z',
    createdBy: 'Priya',
    comments: [
      {
        id: 'c-3',
        author: 'Network Team',
        text: 'Investigating regional gateway certificate expiry.',
        timestamp: '2026-10-01T09:15:00.000Z',
      },
    ],
  },
  {
    id: 'tk-4',
    ticketId: 'TK-2026-104',
    title: 'Ergonomic keyboard replacement',
    issueType: 'hardware',
    priority: 'medium',
    description: 'Requested ergonomic split keyboard for desk workstation.',
    status: 'Open',
    assignedTo: 'Workstation Hardware Support',
    createdAt: '2026-10-02T11:00:00.000Z',
    updatedAt: '2026-10-02T11:00:00.000Z',
    createdBy: 'Priya',
    comments: [],
  },
];
