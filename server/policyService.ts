import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export interface CreatePolicyInput {
  id?: string;
  title: string;
  category: string;
  summary: string;
  details?: string[];
  sampleQuestion?: string;
  isApproved?: boolean;
  updatedBy?: string;
}

export interface UpdatePolicyInput {
  title?: string;
  category?: string;
  summary?: string;
  details?: string[];
  sampleQuestion?: string;
  isApproved?: boolean;
  updatedBy?: string;
}

const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'policies.json');

const INITIAL_APPROVED_POLICIES: PolicyItem[] = [
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

class PolicyService {
  private policies: PolicyItem[] = [];
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
        this.policies = JSON.parse(fileContent);
      } else {
        this.policies = [...INITIAL_APPROVED_POLICIES];
        this.saveToFile();
      }
    } catch (err) {
      console.error('Error loading policies from file, using initial seed:', err);
      this.policies = [...INITIAL_APPROVED_POLICIES];
    }
    this.isLoaded = true;
  }

  private saveToFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.policies, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write policies to disk:', err);
    }
  }

  public getAll(): PolicyItem[] {
    this.ensureDataLoaded();
    return [...this.policies];
  }

  public getApproved(): PolicyItem[] {
    this.ensureDataLoaded();
    return this.policies.filter((p) => p.isApproved);
  }

  public getById(id: string): PolicyItem | undefined {
    this.ensureDataLoaded();
    return this.policies.find((p) => p.id === id);
  }

  public create(input: CreatePolicyInput): PolicyItem {
    this.ensureDataLoaded();
    const id =
      input.id?.trim() ||
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      `policy-${Date.now()}`;

    const now = new Date().toISOString();
    const newPolicy: PolicyItem = {
      id,
      title: input.title.trim(),
      category: input.category.trim() || 'General Policy',
      summary: input.summary.trim(),
      details: input.details?.filter((d) => d.trim().length > 0),
      sampleQuestion: input.sampleQuestion?.trim() || `What is the policy for ${input.title}?`,
      isApproved: input.isApproved !== undefined ? input.isApproved : true,
      version: 1,
      updatedAt: now,
      updatedBy: input.updatedBy || 'Priya (Admin)',
    };

    // Replace if same ID exists or append
    const existingIndex = this.policies.findIndex((p) => p.id === id);
    if (existingIndex >= 0) {
      this.policies[existingIndex] = newPolicy;
    } else {
      this.policies.push(newPolicy);
    }

    this.saveToFile();
    return newPolicy;
  }

  public update(id: string, updates: UpdatePolicyInput): PolicyItem | undefined {
    this.ensureDataLoaded();
    const policy = this.getById(id);
    if (!policy) return undefined;

    const now = new Date().toISOString();

    if (updates.title !== undefined) policy.title = updates.title.trim();
    if (updates.category !== undefined) policy.category = updates.category.trim();
    if (updates.summary !== undefined) policy.summary = updates.summary.trim();
    if (updates.details !== undefined) {
      policy.details = updates.details.filter((d) => d.trim().length > 0);
    }
    if (updates.sampleQuestion !== undefined) {
      policy.sampleQuestion = updates.sampleQuestion.trim();
    }
    if (updates.isApproved !== undefined) policy.isApproved = updates.isApproved;

    policy.version = (policy.version || 1) + 1;
    policy.updatedAt = now;
    policy.updatedBy = updates.updatedBy || 'Priya (Admin)';

    this.saveToFile();
    return policy;
  }

  public delete(id: string): boolean {
    this.ensureDataLoaded();
    const initialLen = this.policies.length;
    this.policies = this.policies.filter((p) => p.id !== id);
    if (this.policies.length !== initialLen) {
      this.saveToFile();
      return true;
    }
    return false;
  }

  /**
   * Dynamically constructs the system instruction for the Gemini chatbot
   * using the latest approved company policies.
   */
  public generateSystemInstruction(): string {
    const approved = this.getApproved();

    const policySections = approved
      .map((p) => {
        let block = `${p.title.toUpperCase()}:\n${p.summary}`;
        if (p.details && p.details.length > 0) {
          block += '\n' + p.details.map((d) => `- ${d}`).join('\n');
        }
        return block;
      })
      .join('\n\n');

    return `You are the "AI Employee Helpdesk Assistant", an internal company helpdesk assistant that answers employee questions about company policies and support processes.

The application uses an approved knowledge base and connects to a backend IT ticket-creation service.

APPROVED COMPANY KNOWLEDGE (LATEST VERSION ACTIVELY MAINTAINED BY POLICY MANAGEMENT):

${policySections}

BACKEND TICKET-CREATION SERVICE & TOOLS:
You have access to two backend tools:
1. "createITTicket": Call this whenever an employee asks to create, submit, open, log, or file an IT support ticket for a hardware or software issue (or reports an equipment or software problem requesting assistance). Pass the issueType ('hardware' or 'software'), title, description, and optional urgency ('low' | 'medium' | 'high' | 'urgent').
2. "getTicketStatus": Call this whenever an employee inquires about the status, progress, or details of a specific ticket (e.g., "What is the status of TK-2026-089?" or "Check ticket #TK-2026-042").

After running a tool, provide a clear, professional summary to the employee including the Ticket ID, category, and current status.

STRICT BEHAVIORAL RULES:
1. Answer employee questions clearly, concisely, and professionally using ONLY the APPROVED COMPANY KNOWLEDGE provided above, and the backend ticketing tools when ticket operations are requested.
2. ALWAYS use the exact details, numbers, conditions, and procedures from the approved knowledge above.
3. NEVER invent company policies or make up information not in the approved knowledge.
4. Direct any question that cannot be handled to HR Assistance. If the answer to an employee's question cannot be found in the approved company knowledge base or cannot be handled (and is not an IT ticket operation), you MUST direct the question to HR Assistance (for example: "I don't have enough information in the approved company knowledge base. Please direct your question to HR Assistance for further assistance.").
5. Maintain conversation context across messages while strictly adhering to the latest approved company knowledge base.
6. If an employee greets you (e.g., "Hello", "Hi") or asks what topics you can help with, introduce yourself as the AI Employee Helpdesk Assistant and list the policy topics you can assist with based on the approved knowledge above, noting that you can also create and check IT support tickets directly, and that questions that cannot be handled can be directed to HR Assistance.`;
  }
}

export const policyService = new PolicyService();
