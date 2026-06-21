import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Bell, Search, Trophy, CheckCircle2, 
  AlertTriangle, TrendingUp, TrendingDown, MoreHorizontal, Plus, ArrowRight 
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import StudentMetrics from "@/components/StudentMetrics";

interface TrainerProfile {
  id: string;
  full_name: string;
  college_id: string | null;
  department_id: string | null;
}

interface UserPerformance {
  user_id: string;
  total_score: number | null;
  tasks_completed: number | null;
  tasks_failed: number | null;
  avg_score: number | null;
  streak_days: number | null;
  current_level: string | null;
  last_task_completed_at: string | null;
  updated_at: string | null;
}

interface StudentRow {
  id: string;
  employee_id: string | null;
  full_name: string;
  track: string | null;
  college_id: string | null;
  total_score: number | null;
  current_streak: number | null;
  performance: UserPerformance | null;
}

export default function Dashboard() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [currentView, setCurrentView] = useState<'overview' | 'all' | 'at-risk'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function initDashboard() {
      try {
        setLoadError(null);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          navigate("/login");
          return;
        }

        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isTrainerRole = rolesData?.some(r => r.role === "trainer") || false;
        setIsTrainer(isTrainerRole);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, college_id, department_id")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        setTrainerProfile(profile);

        if (!profile.college_id && !isTrainerRole) {
          setStudents([]);
          return;
        }

        let studentsQuery = supabase
          .from("profiles")
          .select("id, employee_id, full_name, college_id, total_score, current_streak, track")
          .neq("id", user.id);

        if (isTrainerRole) {
          // Fetch assigned students for this trainer
          const { data: assignments } = await supabase
            .from("faculty_student_assignments")
            .select("student_id")
            .eq("faculty_id", user.id);

          const sIds = assignments?.map(a => a.student_id) || [];
          
          if (sIds.length > 0) {
            studentsQuery = studentsQuery.in("id", sIds);
          } else {
            studentsQuery = studentsQuery.in("id", ['00000000-0000-0000-0000-000000000000']);
          }
        } else {
          studentsQuery = studentsQuery.eq("college_id", profile.college_id);
          if (profile.department_id) {
            studentsQuery = studentsQuery.eq("department_id", profile.department_id);
          }
        }

        const { data: studentProfiles, error: studentsError } = await studentsQuery;

        if (studentsError) throw studentsError;

        const baseRows: StudentRow[] = (studentProfiles || []).map((s: any) => ({
          ...s,
          track: "Product", // Default fallback
          performance: null,
        }));

        const studentIds = baseRows.map((s) => s.id);
        if (studentIds.length > 0) {
          const { data: perfRows, error: perfError } = await supabase
            .from("user_performance")
            .select("user_id, total_score, tasks_completed, tasks_failed, avg_score, streak_days, current_level, last_task_completed_at, updated_at")
            .in("user_id", studentIds);

          if (perfError) throw perfError;

          const { data: trackRows } = await supabase
            .from("user_track_journey")
            .select("user_id, primary_track")
            .in("user_id", studentIds);

          const perfByUser = new Map<string, UserPerformance>();
          (perfRows || []).forEach((row) => perfByUser.set(row.user_id, row));
          
          const trackByUser = new Map<string, string>();
          (trackRows || []).forEach((row) => trackByUser.set(row.user_id, row.primary_track));

          baseRows.forEach((row) => {
            row.performance = perfByUser.get(row.id) ?? null;
            const t = trackByUser.get(row.id);
            if (t) {
              // Capitalize first letter (e.g. 'product' -> 'Product')
              row.track = t.charAt(0).toUpperCase() + t.slice(1);
            }
          });
        }

        setStudents(baseRows);
      } catch (err: any) {
        setLoadError(err?.message || "Failed to load dashboard data.");
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }

    initDashboard();
  }, [navigate]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const scoreDelta =
        (b.performance?.total_score ?? b.total_score ?? 0) -
        (a.performance?.total_score ?? a.total_score ?? 0);
      return scoreDelta !== 0 ? scoreDelta : (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [students]);

  // KPIs
  const activeTrainees = students.length;
  
  const avgScore = useMemo(() => {
    if (activeTrainees === 0) return 0;
    const total = students.reduce((acc, s) => acc + (s.performance?.avg_score ?? 0), 0);
    return Math.round(total / activeTrainees);
  }, [students, activeTrainees]);

  const placementReady = useMemo(() => {
    return students.filter(s => (s.performance?.total_score ?? s.total_score ?? 0) >= 80).length;
  }, [students]);

  const atRiskCount = useMemo(() => {
    return students.filter(s => {
      const score = s.performance?.total_score ?? s.total_score ?? 0;
      const streak = s.current_streak ?? 0;
      return score < 40 || (streak === 0 && score < 50);
    }).length;
  }, [students]);

  const trackCounts = useMemo(() => {
    const counts = { product: 0, service: 0 };
    students.forEach(s => {
      const track = s.track?.toLowerCase() || 'product';
      if (track.includes('service')) counts.service++;
      else counts.product++;
    });
    return counts;
  }, [students]);

  // Derived Alerts
  const pseudoAlerts = useMemo(() => {
    const alerts = [];
    const sortedByScore = [...students].sort((a, b) => (a.performance?.total_score ?? 0) - (b.performance?.total_score ?? 0));
    
    if (sortedByScore.length > 0 && (sortedByScore[0].performance?.total_score ?? 0) < 40) {
      alerts.push({ type: "crit", name: sortedByScore[0].full_name, desc: "Extremely low score. Needs immediate intervention.", time: "2h ago" });
    }
    if (sortedByScore.length > 1 && (sortedByScore[1].current_streak ?? 0) === 0) {
      alerts.push({ type: "warn", name: sortedByScore[1].full_name, desc: "Missed sessions. Activity dropped.", time: "1d ago" });
    }
    if (sortedStudents.length > 0 && (sortedStudents[0].performance?.total_score ?? 0) >= 90) {
      alerts.push({ type: "info", name: sortedStudents[0].full_name, desc: "Consistently high scores. Ready for placement.", time: "5h ago" });
    }
    return alerts;
  }, [students, sortedStudents]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 max-w-md bg-card p-8 rounded-xl shadow-card border border-border">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Failed to load dashboard</h2>
          <p className="text-muted-foreground text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground dot-grid font-sans selection:bg-primary/30">
      {/* Decorative Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse-slow" />
      
      <Sidebar 
        trainerName={trainerProfile?.full_name || "Trainer"} 
        trainerRole="Senior Trainer" 
        traineeCount={activeTrainees} 
        tracksCount={2} 
        avgScore={avgScore} 
        atRiskCount={atRiskCount}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto page-enter h-screen">
        {/* Topbar */}
        <div className="px-8 py-5 border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-heading">Trainer Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Current Batch · {activeTrainees} active trainees across 2 tracks
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Logout
          </button>
        </div>

        <div className="p-8">
          {currentView === 'overview' ? (
            <>
              {/* KPI Row */}
          <div className="grid grid-cols-5 gap-4 mb-6 card-enter-stagger">
            <KpiCard label="Active Trainees" value={activeTrainees} delta="▲ 6 joined this week" deltaUp sub="of 90 enrolled" color="bg-primary" />
            <KpiCard label="Avg Completion" value="68%" delta="▲ 4% vs last week" deltaUp sub="across all tracks" color="bg-success" />
            <KpiCard label="Avg Assessment Score" value={avgScore} delta="▲ 1.8 pts this month" deltaUp sub="out of 100" color="bg-warning" />
            <KpiCard label="At-Risk Trainees" value={atRiskCount} delta="▼ needs intervention" deltaUp={false} sub="<40% score" color="bg-destructive" />
            <KpiCard label="Placement Ready" value={placementReady} delta="▲ 5 new this week" deltaUp sub="JobReady Score ≥ 80" color="bg-accent" />
          </div>

          {/* Grid 2: Table & Alerts */}
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div className="col-span-2 bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden flex flex-col hover-magnetic">
              <div className="p-5 border-b border-border/40 flex items-center justify-between">
                <div>
                  <h2 className="font-bold font-heading text-sm">Trainee Performance Overview</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Sorted by JobReady Score · Live database</p>
                </div>
                <button onClick={() => setCurrentView('all')} className="text-xs font-semibold text-primary hover:text-primary-glow transition-colors">
                  View All →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Trainee</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Track</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Completion</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Assessments</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Attendance</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">JR Score</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Status</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sortedStudents.slice(0, 10).map((student) => {
                      const score = student.performance?.total_score ?? student.total_score ?? 0;
                      const attendance = Math.min(100, (student.current_streak ?? 0) * 5 + 40);
                      const isHigh = score >= 80;
                      const isMid = score >= 50 && score < 80;
                      const completion = Math.min(100, Math.floor(score * 1.2));
                      const track = student.track || "Product";
                      
                      return (
                        <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center font-bold text-white text-[10px] shadow-glow-primary flex-shrink-0">
                                {student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">{student.full_name}</div>
                                <div className="text-[10px] text-muted-foreground">{student.employee_id || student.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                              {track}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-progress-fill" style={{ width: `${completion}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium">{completion}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-bold text-xs ${isHigh ? 'text-success' : isMid ? 'text-warning' : 'text-destructive'}`}>
                              {student.performance?.avg_score || score}/100
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-medium ${attendance >= 80 ? 'text-success' : 'text-warning'}`}>{attendance}%</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-bold text-sm font-heading ${isHigh ? 'text-success' : isMid ? 'text-warning' : 'text-destructive'}`}>
                              {score}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-success' : isMid ? 'bg-warning' : 'bg-destructive'}`} />
                              <span className={`text-[10px] font-medium ${isHigh ? 'text-success' : isMid ? 'text-warning' : 'text-destructive'}`}>
                                {isHigh ? 'On Track' : isMid ? 'Review' : 'At Risk'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button 
                              onClick={() => setSelectedStudent(student)}
                              className="text-xs font-semibold text-primary hover:text-primary-glow transition-colors px-3 py-1.5 bg-primary/10 rounded-md opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto"
                            >
                              View <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden flex flex-col hover-magnetic min-h-0">
              <div className="flex items-center justify-between mb-4 p-5 pb-0">
                <h2 className="font-bold font-heading text-sm flex items-center gap-2">🏆 Top Performers</h2>
                <button className="text-xs font-semibold text-primary hover:text-primary-glow transition-colors">Full Board →</button>
              </div>

              <div className="flex flex-col flex-1 px-5 pb-5 min-h-0">
                {/* Podium */}
                <div className="relative pt-12 pb-0 flex items-end justify-center gap-1 border-b border-border/20 mb-4 bg-gradient-to-b from-primary/5 to-transparent rounded-xl overflow-hidden mt-2">
                  <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full aspect-square rounded-full border border-primary/10 -z-10" />
                  <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-square rounded-full border border-primary/20 -z-10" />

                  {/* Rank 2 (index 1) */}
                  {sortedStudents[1] && (
                    <div className="flex flex-col items-center flex-1 w-1/3">
                      <div className="flex flex-col items-center mb-2 z-10 relative group">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/80 to-rose-500/80 flex items-center justify-center font-bold text-white text-[10px] mb-1.5 shadow-md border-2 border-background ring-2 ring-transparent group-hover:ring-pink-500/30 transition-all">
                          {sortedStudents[1].full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="font-bold text-[10px] truncate w-[80px] text-center text-foreground">{sortedStudents[1].full_name.split(' ')[0]}</div>
                        <div className="flex items-center gap-1 mt-1 bg-pink-500/10 rounded-full pl-0.5 pr-1.5 py-0.5 border border-pink-500/20">
                          <span className="w-3.5 h-3.5 bg-pink-500 rounded-full text-[8px] flex items-center justify-center font-bold text-white">2</span>
                          <span className="text-[8px] text-pink-500 font-bold">{sortedStudents[1].performance?.total_score ?? sortedStudents[1].total_score ?? 0}</span>
                        </div>
                      </div>
                      <div className="w-full h-[80px] bg-gradient-to-t from-pink-600 to-pink-400 rounded-t-sm relative flex items-end justify-center pb-3 shadow-[0_-5px_15px_rgba(236,72,153,0.2)]">
                         <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-0 hover:opacity-100 transition-opacity rounded-t-sm" />
                         <span className="text-4xl font-bold text-white/50 select-none">2</span>
                      </div>
                    </div>
                  )}

                  {/* Rank 1 (index 0) */}
                  {sortedStudents[0] && (
                    <div className="flex flex-col items-center flex-1 w-1/3 z-20">
                      <div className="flex flex-col items-center mb-2 z-10 relative group">
                        <div className="absolute -top-7 text-warning text-xl animate-bounce">👑</div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white text-[12px] mb-1.5 shadow-glow-primary border-2 border-background ring-2 ring-transparent group-hover:ring-blue-500/30 transition-all">
                          {sortedStudents[0].full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="font-bold text-[11px] truncate w-[90px] text-center text-foreground">{sortedStudents[0].full_name.split(' ')[0]}</div>
                        <div className="flex items-center gap-1 mt-1 bg-blue-500/10 rounded-full pl-0.5 pr-2 py-0.5 border border-blue-500/20">
                          <span className="w-4 h-4 bg-blue-500 rounded-full text-[9px] flex items-center justify-center font-bold text-white">1</span>
                          <span className="text-[9px] text-blue-500 font-bold">{sortedStudents[0].performance?.total_score ?? sortedStudents[0].total_score ?? 0} pts</span>
                        </div>
                      </div>
                      <div className="w-full h-[110px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm relative flex items-end justify-center pb-5 shadow-[0_-5px_20px_rgba(59,130,246,0.3)]">
                         <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-0 hover:opacity-100 transition-opacity rounded-t-sm" />
                         <span className="text-5xl font-bold text-white/70 select-none">1</span>
                      </div>
                    </div>
                  )}

                  {/* Rank 3 (index 2) */}
                  {sortedStudents[2] && (
                    <div className="flex flex-col items-center flex-1 w-1/3">
                      <div className="flex flex-col items-center mb-2 z-10 relative group">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/80 to-violet-500/80 flex items-center justify-center font-bold text-white text-[10px] mb-1.5 shadow-md border-2 border-background ring-2 ring-transparent group-hover:ring-purple-500/30 transition-all">
                          {sortedStudents[2].full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="font-bold text-[10px] truncate w-[80px] text-center text-foreground">{sortedStudents[2].full_name.split(' ')[0]}</div>
                        <div className="flex items-center gap-1 mt-1 bg-purple-500/10 rounded-full pl-0.5 pr-1.5 py-0.5 border border-purple-500/20">
                          <span className="w-3.5 h-3.5 bg-purple-500 rounded-full text-[8px] flex items-center justify-center font-bold text-white">3</span>
                          <span className="text-[8px] text-purple-500 font-bold">{sortedStudents[2].performance?.total_score ?? sortedStudents[2].total_score ?? 0}</span>
                        </div>
                      </div>
                      <div className="w-full h-[65px] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm relative flex items-end justify-center pb-2 shadow-[0_-5px_15px_rgba(168,85,247,0.2)]">
                         <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-0 hover:opacity-100 transition-opacity rounded-t-sm" />
                         <span className="text-4xl font-bold text-white/50 select-none">3</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* List */}
                <div className="flex flex-col w-full text-sm flex-1 min-h-0">
                  <div className="grid grid-cols-[30px_1fr_40px] gap-3 px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="text-center">Rank</div>
                    <div>Name</div>
                    <div className="text-right">Score</div>
                  </div>
                  <div className="flex flex-col mt-1 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                    {sortedStudents.slice(3, 10).map((student, idx) => {
                      const score = student.performance?.total_score ?? student.total_score ?? 0;
                      const rank = idx + 4;
                      return (
                        <div key={student.id} className="grid grid-cols-[30px_1fr_40px] gap-3 px-2 py-2.5 items-center hover:bg-muted/30 rounded-lg transition-colors group">
                          <div className="text-center font-bold text-muted-foreground text-xs group-hover:text-foreground">{rank}</div>
                          <div className="flex items-center gap-2.5 min-w-0">
                             <div className="w-6 h-6 rounded-full bg-card border border-border/60 shadow-sm flex items-center justify-center text-[9px] font-bold text-muted-foreground flex-shrink-0 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                               {student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                             </div>
                             <div className="font-semibold text-xs truncate group-hover:text-primary transition-colors text-foreground">{student.full_name}</div>
                          </div>
                          <div className="text-right font-bold text-foreground text-xs">{score}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          </>
          ) : (
            <div className="bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden flex flex-col page-enter">
              <div className="p-6 border-b border-border/40 flex items-center justify-between bg-card/50">
                <div>
                  <h2 className="font-bold font-heading text-lg">
                    {currentView === 'all' ? 'All Trainees' : 'At-Risk Trainees'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentView === 'all' 
                      ? `Showing all ${sortedStudents.length} registered trainees in your batch.` 
                      : `Showing ${sortedStudents.filter(s => {
                          const score = s.performance?.total_score ?? s.total_score ?? 0;
                          const streak = s.performance?.streak_days ?? s.current_streak ?? 0;
                          return score < 40 || (streak === 0 && score < 50);
                        }).length} trainees requiring immediate attention.`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search trainee..." 
                      className="bg-background border border-border/60 text-xs pl-9 pr-4 py-2 rounded-lg focus:border-primary/50 outline-none w-48 lg:w-64 transition-colors" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                    />
                  </div>
                  <select 
                    className="bg-background border border-border/60 text-xs px-3 py-2 rounded-lg focus:border-primary/50 outline-none transition-colors" 
                    value={filterTrack} 
                    onChange={e => setFilterTrack(e.target.value)}
                  >
                    <option value="all">All Tracks</option>
                    <option value="Product">Product Track</option>
                    <option value="Service">Service Track</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Trainee</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Track</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Completion</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">JR Score</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40">Status</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sortedStudents
                      .filter(s => {
                        if (currentView !== 'all') {
                          const score = s.performance?.total_score ?? s.total_score ?? 0;
                          const streak = s.current_streak ?? 0;
                          const isAtRisk = score < 40 || (streak === 0 && score < 50);
                          if (!isAtRisk) return false;
                        }
                        
                        if (filterTrack !== 'all' && s.track !== filterTrack) {
                          return false;
                        }
                        
                        if (searchQuery.trim() !== '') {
                          const query = searchQuery.toLowerCase();
                          const matchesName = s.full_name?.toLowerCase().includes(query);
                          const matchesId = s.employee_id?.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
                          if (!matchesName && !matchesId) return false;
                        }

                        return true;
                      })
                      .map((student) => {
                        const score = student.performance?.total_score ?? student.total_score ?? 0;
                        const isHigh = score >= 80;
                        const isMid = score >= 50 && score < 80;
                        const completion = Math.min(100, Math.floor(score * 1.2));
                        const track = student.track || "Product";
                        
                        return (
                          <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center font-bold text-white text-xs shadow-glow-primary flex-shrink-0">
                                  {student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{student.full_name}</div>
                                  <div className="text-xs text-muted-foreground">{student.employee_id || student.id.slice(0, 8)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                {track}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                                  <div className="h-full bg-primary animate-progress-fill" style={{ width: `${completion}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">{completion}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`font-bold text-base font-heading ${isHigh ? 'text-success' : isMid ? 'text-warning' : 'text-destructive'}`}>
                                {score}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-success' : isMid ? 'bg-warning' : 'bg-destructive'}`} />
                                <span className={`text-xs font-medium ${isHigh ? 'text-success' : isMid ? 'text-warning' : 'text-destructive'}`}>
                                  {isHigh ? 'On Track' : isMid ? 'Review' : 'At Risk'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setSelectedStudent(student)}
                                className="text-sm font-semibold text-primary hover:text-primary-glow transition-colors px-4 py-2 bg-primary/10 rounded-lg opacity-0 group-hover:opacity-100 flex items-center gap-2 ml-auto"
                              >
                                View Details <ArrowRight size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
                {sortedStudents.filter(s => {
                  if (currentView === 'all') return true;
                  const score = s.performance?.total_score ?? s.total_score ?? 0;
                  const streak = s.current_streak ?? 0;
                  return score < 40 || (streak === 0 && score < 50);
                }).length === 0 && (
                  <div className="p-12 text-center text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-success/50 mb-3" />
                    <p>No at-risk trainees found! Everyone is doing great.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {selectedStudent && (
        <StudentMetrics 
          userId={selectedStudent.id} 
          fullName={selectedStudent.full_name} 
          currentStreak={selectedStudent.current_streak ?? 0}
          onClose={() => setSelectedStudent(null)} 
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, delta, deltaUp, sub, color }: { label: string, value: string | number, delta: string, deltaUp: boolean, sub: string, color: string }) {
  return (
    <div className="bg-card rounded-xl border border-border/60 p-4 relative overflow-hidden shadow-soft hover-magnetic group">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color} opacity-80 group-hover:opacity-100 transition-opacity`} />
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-1">{label}</div>
      <div className="font-heading text-3xl font-bold text-foreground my-1">{value}</div>
      <div className={`text-[10px] font-medium flex items-center gap-1 ${deltaUp ? 'text-success' : 'text-destructive'}`}>
        {delta}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
