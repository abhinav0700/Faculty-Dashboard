import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  ChevronRight,
  GraduationCap,
  Loader2,
  LogOut,
  Search,
  SearchX,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
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
  college_id: string | null;
  total_score: number | null;
  current_streak: number | null;
  performance: UserPerformance | null;
}

export default function Dashboard() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const [collegeName, setCollegeName] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
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
          setCollegeName(null);
          return;
        }

        let collegeNameStr = null;
        if (profile.college_id) {
          const { data: collegeData } = await supabase
            .from("colleges")
            .select("name")
            .eq("id", profile.college_id)
            .maybeSingle();
          collegeNameStr = collegeData?.name ?? null;
        }
        setCollegeName(collegeNameStr);

        if (profile.department_id) {
          const { data: deptData } = await supabase
            .from("departments")
            .select("name")
            .eq("id", profile.department_id)
            .maybeSingle();
          setDepartmentName(deptData?.name ?? null);
        } else {
          setDepartmentName(null);
        }

        let studentsQuery = supabase
          .from("profiles")
          .select("id, employee_id, full_name, college_id, total_score, current_streak")
          .neq("id", user.id);

        if (isTrainerRole) {
          const { data: sIds, error: rpcError } = await supabase.rpc("get_student_ids");
            
          if (sIds && sIds.length > 0) {
            // Splitting into chunks if necessary, but assuming < 1000 for now
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

        const baseRows: StudentRow[] = (studentProfiles || []).map((s) => ({
          ...s,
          performance: null,
        }));

        const studentIds = baseRows.map((s) => s.id);
        if (studentIds.length > 0) {
          const { data: perfRows, error: perfError } = await supabase
            .from("user_performance")
            .select("user_id, total_score, tasks_completed, tasks_failed, avg_score, streak_days, current_level, last_task_completed_at, updated_at")
            .in("user_id", studentIds);

          if (perfError) throw perfError;

          const perfByUser = new Map<string, UserPerformance>();
          (perfRows || []).forEach((row) => perfByUser.set(row.user_id, row));
          baseRows.forEach((row) => {
            row.performance = perfByUser.get(row.id) ?? null;
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
      if (scoreDelta !== 0) return scoreDelta;

      const streakDelta =
        (b.performance?.streak_days ?? b.current_streak ?? 0) -
        (a.performance?.streak_days ?? a.current_streak ?? 0);
      if (streakDelta !== 0) return streakDelta;

      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [students]);

  const rankById = useMemo(() => {
    const map = new Map<string, number>();
    sortedStudents.forEach((s, index) => map.set(s.id, index + 1));
    return map;
  }, [sortedStudents]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sortedStudents;
    return sortedStudents.filter((s) => (s.full_name ?? "").toLowerCase().includes(query));
  }, [sortedStudents, searchTerm]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <GraduationCap size={24} />
          </div>
          <span className="font-bold text-xl text-slate-900">JobReady</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<Users size={20} />} label="Employee Body" active />
          {/* <NavItem icon={<Trophy size={20} />} label="Analytics" /> */}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full p-3 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors font-medium"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-20 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-900 hidden md:block">Trainer Oversight</h1>
            <div className="md:hidden bg-blue-600 p-2 rounded-lg text-white">
              <GraduationCap size={20} />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden sm:block">
              <Bell className="text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full" />
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{trainerProfile?.full_name}</p>
                <p className="text-xs text-slate-500">
                  {departmentName ? `${departmentName} Department` : collegeName || "Institution"}
                </p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                {trainerProfile?.full_name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {loadError && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-4 rounded-xl">
                {loadError}
              </div>
            )}

            {!loadError && trainerProfile && !trainerProfile.college_id && !isTrainer && (
              <div className="bg-amber-50 border border-amber-100 text-amber-800 text-sm p-4 rounded-xl">
                Your account doesn’t have a `college_id` assigned yet, so there are no employees to show.
              </div>
            )}

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search employees by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Registered Employees</h2>
                <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  {students.length} Total
                </span>
              </div>

              {filteredStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Rank</th>
                        <th className="px-6 py-4">Employee Name</th>
                        <th className="px-6 py-4">Total Score</th>
                        <th className="px-6 py-4">Streak</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student, index) => {
                        const rank = rankById.get(student.id) ?? (index + 1);
                        const score = student.performance?.total_score ?? student.total_score ?? 0;
                        const streak = student.performance?.streak_days ?? student.current_streak ?? 0;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${rank <= 3 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"
                                  }`}
                              >
                                {rank}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors cursor-default">
                                {student.full_name}
                              </div>
                              <div className="text-xs text-slate-500">ID: {student.employee_id || student.id.slice(0, 8)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700">{score}</span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600"
                                    style={{ width: `${Math.min((score / 1000) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 space-x-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold ring-1 ring-inset ring-orange-200/50">
                                <Zap size={12} fill="currentColor" />
                                {streak}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelectedStudent(student)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-all active:scale-95"
                              >
                                View
                                <ChevronRight size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                  <SearchX size={48} className="mb-4 stroke-1 opacity-50" />
                  <p className="text-lg font-medium text-slate-500">No employees found matching your search</p>
                  <p className="text-sm">Try adjusting your search term</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedStudent && (
        <StudentMetrics
          userId={selectedStudent.id}
          fullName={selectedStudent.full_name}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${active ? "bg-blue-600/10 text-blue-600 font-bold" : "text-slate-500 hover:bg-slate-50 font-medium"
        }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

