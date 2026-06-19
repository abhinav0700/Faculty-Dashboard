import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, BarChart2, Calendar, Loader2, Target, Trophy, X, Zap } from "lucide-react";

interface StudentMetricsProps {
  userId: string;
  fullName: string;
  currentStreak: number;
  onClose: () => void;
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

export default function StudentMetrics({ userId, fullName, currentStreak, onClose }: StudentMetricsProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<UserPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from("user_performance")
          .select("user_id, total_score, tasks_completed, tasks_failed, avg_score, streak_days, current_level, last_task_completed_at, updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        setMetrics(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load metrics.");
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [userId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasMetrics = !!metrics;
  const totalScore = metrics?.total_score ?? 0;
  const completed = metrics?.tasks_completed ?? 0;
  const failed = metrics?.tasks_failed ?? 0;
  const avgScore = metrics?.avg_score ?? 0;
  const streakDays = currentStreak;
  const currentLevel = metrics?.current_level ?? "beginner";

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card rounded-2xl shadow-elevated border border-border/60 w-full max-w-4xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <div>
            <h2 className="text-xl font-bold font-heading text-foreground">{fullName}</h2>
            <p className="text-sm text-muted-foreground">Detailed Performance Overview</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card-hover rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="h-80 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading performance metrics...</p>
            </div>
          ) : error ? (
            <div className="h-80 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive shadow-glow">
                <AlertCircle size={32} />
              </div>
              <p className="text-foreground font-medium mb-1">Failed to load metrics</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : !hasMetrics ? (
            <div className="h-80 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4 text-muted-foreground">
                <BarChart2 size={32} />
              </div>
              <p className="text-foreground font-medium mb-1">No metrics available</p>
              <p className="text-sm text-muted-foreground">This employee hasn't generated metrics in the system.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-2 gap-4">
                <MetricCard icon={<Trophy className="text-warning" />} label="Total Score" value={totalScore} highlight="text-warning" />
                <MetricCard icon={<Target className="text-primary" />} label="Avg Task Score" value={`${avgScore}/100`} highlight="text-primary" />
                <MetricCard icon={<Zap className="text-accent" />} label="Current Streak" value={`${streakDays} Days`} highlight="text-accent" />
                <MetricCard icon={<BarChart2 className="text-success" />} label="Current Level" value={currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)} highlight="text-success" />
              </div>

              <div className="bg-card rounded-xl border border-border/40 p-6 shadow-soft flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] -z-10" />
                <h3 className="text-sm font-semibold text-foreground mb-4 font-heading">Task Completion Rate</h3>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Completed Successfully</span>
                  <span className="font-bold text-success">{completed}</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full mb-4 overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.max(5, (completed / Math.max(1, completed + failed)) * 100)}%` }} />
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Failed / Skipped</span>
                  <span className="font-bold text-destructive">{failed}</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-destructive rounded-full" style={{ width: `${Math.max(5, (failed / Math.max(1, completed + failed)) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, highlight }: { icon: React.ReactNode, label: string, value: string | number, highlight: string }) {
  return (
    <div className="bg-background rounded-xl p-5 border border-border/40 flex flex-col justify-between hover-magnetic">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg bg-card border border-border/50 shadow-soft`}>{icon}</div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold font-heading ${highlight}`}>{value}</p>
      </div>
    </div>
  );
}
