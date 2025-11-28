import React from 'react';
import { 
  Book, 
  CheckCircle2, 
  Sparkles, 
  AlertOctagon, 
  StickyNote, 
  Gavel,
  LayoutGrid,
  Mic,
  Send,
  Plus,
  Search,
  Menu,
  X,
  ChevronRight,
  Loader2,
  Home,
  ListTodo,
  Library,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Edit,
  Lock,
  Calendar,
  Clock,
  CheckCircle,
  RefreshCw,
  Shield,
  Monitor,
  Check,
  List,
  Grid3x3,
  ArrowRight,
  BarChart3,
  Eraser,
  Users
} from 'lucide-react';
import { NoteType } from './types';

export const APP_NAME = "Bitácora";

export const ICONS = {
  Book,
  CheckCircle2,
  Sparkles,
  AlertOctagon,
  StickyNote,
  Gavel,
  LayoutGrid,
  Mic,
  Send,
  Plus,
  Search,
  Menu,
  X,
  ChevronRight,
  Loader2,
  Home,
  ListTodo,
  Library,
  Paperclip,
  ImageIcon,
  FileText,
  Edit,
  Lock,
  Calendar,
  Clock,
  CheckCircle,
  RefreshCw,
  Shield,
  Monitor,
  Check,
  List,
  Grid3x3,
  ArrowRight,
  BarChart3,
  Eraser,
  Users
};

// Estilos más vibrantes y redondeados ("pill" style)
export const TYPE_STYLES: Record<NoteType, string> = {
  [NoteType.NOTE]: 'bg-gray-100 text-gray-600 border-gray-200',
  [NoteType.TASK]: 'bg-blue-100 text-blue-700 border-blue-200',
  [NoteType.DECISION]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [NoteType.IDEA]: 'bg-amber-100 text-amber-700 border-amber-200',
  [NoteType.RISK]: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const TYPE_LABELS: Record<NoteType, string> = {
  [NoteType.NOTE]: 'Nota',
  [NoteType.TASK]: 'Misión',
  [NoteType.DECISION]: 'Acuerdo',
  [NoteType.IDEA]: 'Idea Brillante',
  [NoteType.RISK]: 'Ojo / Riesgo',
};

export const TYPE_ICONS: Record<NoteType, React.ReactNode> = {
  [NoteType.NOTE]: <StickyNote size={14} />,
  [NoteType.TASK]: <CheckCircle2 size={14} />,
  [NoteType.DECISION]: <Gavel size={14} />,
  [NoteType.IDEA]: <Sparkles size={14} />,
  [NoteType.RISK]: <AlertOctagon size={14} />,
};