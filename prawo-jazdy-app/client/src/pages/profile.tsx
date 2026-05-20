import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
  User,
  Trophy,
  Target,
  Flame,
  Brain,
  Star,
  Medal,
  Award,
  Crown,
  Zap,
  CheckCircle2,
  BookOpen,
  LogOut,
} from "lucide-react";

// Default badges we display whether earned or not
const allBadges = [
  { key: "first_exam", label: "Pierwszy egzamin", icon: FileCheckIcon, desc: "Zdaj pierwszy egzamin" },
  { key: "perfect_score", label: "Perfekcja", icon: Star, desc: "Uzyskaj 74/74 pkt" },
  { key: "streak_7", label: "Tydzień nauki", icon: Flame, desc: "7 dni z rzędu" },
  { key: "streak_30", label: "Miesiąc nauki", icon: Crown, desc: "30 dni z rzędu" },
  { key: "100_questions", label: "Setnik", icon: Brain, desc: "Odpowiedz na 100 pytań" },
  { key: "500_questions", label: "Ekspert", icon: Zap, desc: "Odpowiedz na 500 pytań" },
  { key: "5_exams", label: "Wytrwały", icon: Medal, desc: "Ukończ 5 egzaminów" },
  { key: "accuracy_90", label: "Snajper", icon: Target, desc: "90% trafność" },
];

function FileCheckIcon(props: any) {
  return <CheckCircle2 {...props} />;
}

interface GamificationProfile {
  total_points: number;
  level: number;
  exams_taken: number;
  exams_passed: number;
  questions_answered: number;
  questions_correct: number;
  accuracy_percent: number;
  current_streak: number;
  best_streak: number;
  last_activity_date: string | null;
  badges: string[];
}

interface LeaderboardEntry {
  username: string;
  total_points: number;
  level: number;
  exams_passed: number;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();

  const { data: profile, isLoading: loadingProfile } = useQuery<GamificationProfile>({
    queryKey: ["/api/gamification/profile"],
  });

  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/gamification/leaderboard?limit=10"],
  });

  const xpInLevel = profile ? profile.total_points % 100 : 0;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-profile-title">
          <User className="w-5 h-5 text-primary" />
          Profil
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Twoje osiągnięcia i postępy
        </p>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {user?.username?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground" data-testid="text-username">
                {user?.username || "Użytkownik"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" data-testid="badge-level">
                  <Crown className="w-3 h-3 mr-1" />
                  Poziom {profile?.level ?? 0}
                </Badge>
                <span className="text-sm text-muted-foreground mr-auto">
                  {profile?.total_points ?? 0} XP
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={logout}
                  className="text-muted-foreground hover:text-destructive h-8"
                  data-testid="button-profile-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Wyloguj się
                </Button>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Postęp poziomu</span>
                  <span>{xpInLevel}/100 XP</span>
                </div>
                <Progress value={xpInLevel} className="h-2" data-testid="progress-level" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loadingProfile ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-4 text-center">
                <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-xl font-bold" data-testid="text-stat-exams">
                  {profile?.exams_passed ?? 0}/{profile?.exams_taken ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Zdane egzaminy</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Brain className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-xl font-bold" data-testid="text-stat-questions">
                  {profile?.questions_answered ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Odpowiedzi</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Target className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-xl font-bold" data-testid="text-stat-accuracy">
                  {profile?.accuracy_percent ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground">Trafność</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xl font-bold" data-testid="text-stat-streak">
                  {profile?.current_streak ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Seria dni (najlepsza: {profile?.best_streak ?? 0})
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">ODZNAKI</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {allBadges.map((badge) => {
            const earned = profile?.badges?.includes(badge.key);
            return (
              <Card
                key={badge.key}
                className={earned ? "" : "opacity-40"}
                data-testid={`badge-${badge.key}`}
              >
                <CardContent className="pt-4 text-center">
                  <badge.icon
                    className={`w-8 h-8 mx-auto mb-2 ${
                      earned ? "text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                  <p className="text-xs font-medium text-foreground">{badge.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{badge.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">RANKING</h2>
        <Card>
          <CardContent className="pt-4">
            {loadingLeaderboard ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-1">
                {leaderboard.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                      entry.username === user?.username ? "bg-primary/5" : ""
                    }`}
                    data-testid={`leaderboard-row-${i}`}
                  >
                    <span
                      className={`w-6 text-center font-bold text-sm ${
                        i === 0
                          ? "text-yellow-500"
                          : i === 1
                          ? "text-gray-400"
                          : i === 2
                          ? "text-orange-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {entry.username}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Poz. {entry.level}
                    </Badge>
                    <span className="text-sm font-bold text-foreground w-16 text-right">
                      {entry.total_points} XP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ranking jest pusty. Bądź pierwszy!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
