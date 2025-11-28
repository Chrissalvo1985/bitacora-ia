export enum NoteType {
  NOTE = 'NOTE',
  TASK = 'TASK',
  DECISION = 'DECISION',
  IDEA = 'IDEA',
  RISK = 'RISK',
}

export enum EntryStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum EntityType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
  PROJECT = 'PROJECT',
  TOPIC = 'TOPIC',
}

export interface TaskItem {
  id?: string;
  description: string;
  assignee?: string;
  dueDate?: string; // ISO date string
  isDone: boolean;
  priority?: TaskPriority;
  completionNotes?: string; // Observaciones al completar la tarea
}

export interface Attachment {
  type: 'image' | 'document';
  mimeType: string;
  data: string; // Base64 string
  fileName: string;
}

export interface Entity {
  id?: string;
  name: string;
  type: EntityType;
}

export interface Entry {
  id: string;
  originalText: string;
  createdAt: number; // timestamp
  
  // AI Derived Data
  bookId: string;
  type: NoteType;
  summary: string;
  tasks: TaskItem[];
  entities: Entity[]; // People, companies identified
  
  attachment?: Attachment; // Optional attachment

  status: EntryStatus;
}

export interface Folder {
  id: string;
  name: string;
  color?: string; // Optional color for visual distinction
  createdAt: number;
  updatedAt?: number;
}

export interface Book {
  id: string;
  name: string;
  description?: string; // Short manual description (optional)
  context?: string; // AI generated context
  folderId?: string; // Optional folder ID for grouping
  createdAt: number;
  updatedAt?: number;
}

export interface SearchFilters {
  query?: string;
  bookId?: string;
  type?: NoteType;
  dateFrom?: string;
  dateTo?: string;
  assignee?: string;
}

export interface WeeklySummary {
  period: 'day' | 'week' | 'month';
  summary: string;
  topDecisions: Entry[];
  topTasks: TaskItem[];
  patterns?: string[];
  generatedAt: number;
}