import React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  FolderOpen,
  FileText,
  Microscope,
  Video,
  BarChart2,
  Trophy,
  Download,
  Briefcase,
  Building2,
  Target
} from "lucide-react";

interface SidebarProps {
  trainerName: string;
  trainerRole: string;
  traineeCount: number;
  tracksCount: number;
  avgScore: number;
  atRiskCount: number;
  currentView: 'overview' | 'all' | 'at-risk';
  onViewChange: (view: 'overview' | 'all' | 'at-risk') => void;
  onLogout: () => void;
}

export default function Sidebar({ trainerName, trainerRole, traineeCount, tracksCount, avgScore, atRiskCount, currentView, onViewChange, onLogout }: SidebarProps) {
  return (
    <aside className="w-[220px] bg-card border-r border-border/40 flex flex-col h-screen shrink-0 sticky top-0">
      <div className="p-5 pb-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center font-bold text-white shadow-glow-primary">
          JR
        </div>
        <div>
          <div className="font-bold text-base text-foreground leading-tight">JobReady</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Trainer View</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 px-3 custom-scrollbar pb-6">
        {/* Overview */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">Overview</div>
          <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" active={currentView === 'overview'} onClick={() => onViewChange('overview')} />
          <NavItem icon={<Users size={16} />} label="All Trainees" badge={traineeCount} active={currentView === 'all'} onClick={() => onViewChange('all')} />
          <NavItem icon={<AlertTriangle size={16} />} label="At-Risk" badge={atRiskCount} badgeColor="bg-destructive" active={currentView === 'at-risk'} onClick={() => onViewChange('at-risk')} />
        </div>


      </div>

      {/* Trainer Card */}
      <div className="p-4 border-t border-border/40 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
              {trainerName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{trainerName}</div>
              <div className="text-xs text-muted-foreground truncate">{trainerRole}</div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/30 text-center">
          <div>
            <div className="font-bold text-primary">{traineeCount}</div>
            <div className="text-[10px] text-muted-foreground">Trainees</div>
          </div>
          <div>
            <div className="font-bold text-primary">{tracksCount}</div>
            <div className="text-[10px] text-muted-foreground">Tracks</div>
          </div>
          <div>
            <div className="font-bold text-primary">{avgScore}%</div>
            <div className="text-[10px] text-muted-foreground">Avg Score</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, badge, badgeColor = "bg-primary", onClick }: { icon: React.ReactNode, label: string, active?: boolean, badge?: number, badgeColor?: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 group text-sm font-medium",
      active 
        ? "bg-primary/10 text-primary" 
        : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
    )}>
      <div className={cn("flex-shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground transition-colors")}>
        {icon}
      </div>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className={cn("text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[20px]", badgeColor)}>
          {badge}
        </span>
      )}
    </div>
  );
}
