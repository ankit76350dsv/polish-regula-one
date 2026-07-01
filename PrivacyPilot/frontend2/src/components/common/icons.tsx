/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  FolderKanban,
  Scale,
  ShieldAlert,
  Users,
  Globe,
  Skull,
  UserCheck,
  FileStack,
  BarChart3,
  CheckSquare,
  Files,
  Settings,
  HelpCircle,
  Activity,
  ToggleRight,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Shield,
  AlertOctagon,
  Search,
  Bell,
  ChevronRight,
  Plus,
  TrendingUp,
  X,
  Filter,
  Trash2,
  Edit,
  Check,
  FileText,
  MoreVertical,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  ArrowLeft,
  Mail,
  User,
  UserPlus,
  Menu,
  Clock,
  Send,
  AlertTriangle,
  LogOut,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
  Home,
  FolderKanban,
  Scale,
  ShieldAlert,
  Users,
  Globe,
  Skull,
  UserCheck,
  FileStack,
  BarChart3,
  CheckSquare,
  Files,
  Settings,
  HelpCircle,
  Activity,
  ToggleRight,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Shield,
  AlertOctagon,
  Search,
  Bell,
  ChevronRight,
  Plus,
  TrendingUp,
  X,
  Filter,
  Trash2,
  Edit,
  Check,
  FileText,
  MoreVertical,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  ArrowLeft,
  Mail,
  User,
  UserPlus,
  Menu,
  Clock,
  Send,
  AlertTriangle,
  LogOut,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
};

interface ComplianceIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
  size?: number;
}

export const ComplianceIcon: React.FC<ComplianceIconProps> = ({ name, className = '', size = 18, ...props }) => {
  const IconComponent = iconMap[name] || HelpCircle;
  return <IconComponent className={className} size={size} {...props} />;
};
export default ComplianceIcon;
