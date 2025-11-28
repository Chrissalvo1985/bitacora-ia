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
  extractedText?: string; // Text extracted from PDFs
  originalSize?: number; // Original size before truncation
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
  
  // Note: Attachments are NOT stored - they're only used as context for AI analysis

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

// Multi-topic analysis types
export interface TaskAction {
  action: 'complete' | 'update';
  taskDescription: string; // Description to match existing task
  completionNotes?: string; // Notes when completing
  updates?: { assignee?: string; dueDate?: string; priority?: string }; // Updates to apply
}

export interface TopicEntry {
  targetBookName: string;
  targetBookId?: string; // ID if matched to existing book
  isNewBook: boolean;
  type: NoteType;
  content: string; // The specific content for this topic
  summary: string; // AI-generated summary for this topic
  tasks: { description: string; assignee?: string; dueDate?: string; priority?: string }[];
  entities: { name: string; type: string }[];
  taskActions: TaskAction[]; // Actions on existing tasks (complete, update)
}

export interface MultiTopicAnalysis {
  isMultiTopic: boolean; // Whether multiple topics were detected
  topics: TopicEntry[];
  overallContext: string; // Overall context/description of the note
  suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH';
}