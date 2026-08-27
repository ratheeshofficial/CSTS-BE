import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../tickets/entities/ticket.entity';
import { UserRole } from '../../users/entities/user.entity';

export const SEED_ADMIN_EMAIL = 'admin@csts.local';
export const SEED_PASSWORD = 'Password123!';

export interface SeedUserRecord {
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
}

export interface SeedTicketRecord {
  key: string;
  customerEmail: string;
  assignedAgentEmail: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  title: string;
  description: string;
}

export interface SeedCommentRecord {
  ticketKey: string;
  authorEmail: string;
  message: string;
}

export const SEED_USERS: SeedUserRecord[] = [
  {
    name: 'System Admin',
    email: SEED_ADMIN_EMAIL,
    role: UserRole.ADMIN,
  },
  {
    name: 'Priya Agent',
    email: 'agent1@csts.local',
    role: UserRole.SUPPORT_AGENT,
  },
  {
    name: 'Raj Agent',
    email: 'agent2@csts.local',
    role: UserRole.SUPPORT_AGENT,
  },
  {
    name: 'Alice Customer',
    email: 'alice@example.com',
    role: UserRole.CUSTOMER,
  },
  {
    name: 'Bob Customer',
    email: 'bob@example.com',
    role: UserRole.CUSTOMER,
  },
  {
    name: 'Carol Customer',
    email: 'carol@example.com',
    role: UserRole.CUSTOMER,
    isActive: false,
  },
];

export const SEED_TICKETS: SeedTicketRecord[] = [
  {
    key: 'double-charge',
    customerEmail: 'alice@example.com',
    assignedAgentEmail: null,
    status: TicketStatus.OPEN,
    priority: TicketPriority.HIGH,
    category: TicketCategory.PAYMENT,
    title: 'Charged twice at checkout',
    description:
      'I was billed twice for order 1234. The second charge appeared on my statement this morning.',
  },
  {
    key: 'wrong-item',
    customerEmail: 'alice@example.com',
    assignedAgentEmail: 'agent1@csts.local',
    status: TicketStatus.ASSIGNED,
    priority: TicketPriority.MEDIUM,
    category: TicketCategory.ORDER,
    title: 'Wrong item in order #4521',
    description:
      'Order 4521 arrived today but contained a different SKU than the one I purchased.',
  },
  {
    key: 'stuck-delivery',
    customerEmail: 'bob@example.com',
    assignedAgentEmail: 'agent1@csts.local',
    status: TicketStatus.IN_PROGRESS,
    priority: TicketPriority.URGENT,
    category: TicketCategory.DELIVERY,
    title: 'Package stuck in transit',
    description:
      'Tracking has shown "in transit" for five days with no scan updates. Need this delivered before Friday.',
  },
  {
    key: 'password-reset',
    customerEmail: 'bob@example.com',
    assignedAgentEmail: 'agent2@csts.local',
    status: TicketStatus.RESOLVED,
    priority: TicketPriority.LOW,
    category: TicketCategory.ACCOUNT,
    title: "Can't reset password",
    description:
      'The password reset email never arrived. I tried three times from two different inboxes.',
  },
  {
    key: 'app-crash',
    customerEmail: 'carol@example.com',
    assignedAgentEmail: 'agent1@csts.local',
    status: TicketStatus.CLOSED,
    priority: TicketPriority.MEDIUM,
    category: TicketCategory.TECHNICAL,
    title: 'App crash on login',
    description:
      'The mobile app crashes immediately after tapping Sign in on Android 14.',
  },
  {
    key: 'general-feedback',
    customerEmail: 'alice@example.com',
    assignedAgentEmail: null,
    status: TicketStatus.OPEN,
    priority: TicketPriority.LOW,
    category: TicketCategory.OTHER,
    title: 'General feedback',
    description:
      'The new ticket history view is helpful. A filter by date range would make it even better.',
  },
];

export const SEED_COMMENTS: SeedCommentRecord[] = [
  {
    ticketKey: 'double-charge',
    authorEmail: 'alice@example.com',
    message: 'Receipt attached for order 1234.',
  },
  {
    ticketKey: 'wrong-item',
    authorEmail: 'agent1@csts.local',
    message: 'Looking into warehouse logs.',
  },
  {
    ticketKey: 'wrong-item',
    authorEmail: 'alice@example.com',
    message: 'Thanks — order ID is 4521.',
  },
  {
    ticketKey: 'stuck-delivery',
    authorEmail: 'agent1@csts.local',
    message: 'Escalated to courier partner.',
  },
  {
    ticketKey: 'password-reset',
    authorEmail: 'agent2@csts.local',
    message: 'Reset link sent; closing as resolved.',
  },
  {
    ticketKey: 'app-crash',
    authorEmail: 'carol@example.com',
    message: 'Still happening on Android 14.',
  },
  {
    ticketKey: 'app-crash',
    authorEmail: 'agent1@csts.local',
    message: 'Fixed in v1.2.3 — closing.',
  },
];
