import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileCheck,
  BookOpen,
  Layers,
  GitFork,
  Target,
  Brain,
  Trophy,
  Flame,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function ReadinessCircle({ score, status }: { score: number; status: string }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const statusColor =
    status === "GOTOWY"
      ? "text-green-500"
      : status === "PRAWIE_GOTOWY"
      ? "text-yellow-500"
      : status === "W_TRAKCIE_NAUKI"
      ? "text-blue-500"
      : "text-orange-500";

  const statusLabel =
    status === "GOTOWY"
      ? "Gotowy!"
      : status === "PRAWIE_GOTOWY"
      ? "Prawie gotowy"
      : status === "W_TRAKCIE_NAUKI"
      ? "W trakcie nauki"
      : "Wymaga więcej nauki";

  const strokeColor =
    status === "GOTOWY"
      ? "#22c55e"
      : status === "PRAWIE_GOTOWY"
      ? "#eab308"
      : status === "W_TRAKCIE_NAUKI"
      ? "#3b82f6"
      : "#f97316";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{Math.round(score)}%</span>
          <span className="text-xs text-muted-foreground">gotowość</span>
        </div>
      </div>
      <Badge variant="outline" className={`mt-3 ${statusColor}`} data-testid="badge-readiness-status">
        {statusLabel}
      </Badge>
    </div>
  );
}

const modeCards = [
  {
    path: "/exam",
    label: "Egzamin",
    desc: "32 pytania, 25 minut",
    icon: FileCheck,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    path: "/practice",
    label: "Ćwiczenia",
    desc: "Losowe pytania z wyjaśnieniami",
    icon: BookOpen,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    path: "/flashcards",
    label: "Fiszki",
    desc: "Znaki drogowe — powtórki SR",
    icon: Layers,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    path: "/intersections",
    label: "Skrzyżowania",
    desc: "Symulator pierwszeństwa przejazdu",
    icon: GitFork,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
];

export default function Dashboard() {
  const { data: readiness, isLoading: loadingReadiness } = useQuery<any>({
    queryKey: ["/api/readiness?category=B"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/questions/stats?category=B"],
  });

  const { data: gamification, isLoading: loadingGamification } = useQuery<any>({
    queryKey: ["/api/gamification/profile"],
  });

  const { data: examHistory } = useQuery<any[]>({
    queryKey: ["/api/exam/history"],
  });

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-dashboard-title">
            Panel główny
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Śledź swoje postępy i ćwicz przed egzaminem
          </p>
        </div>
      </div>

      {/* Top section: Readiness + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Readiness circle */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" />
              Gotowość do egzaminu
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            {loadingReadiness ? (
              <Skeleton className="w-40 h-40 rounded-full" />
            ) : (
              <ReadinessCircle
                score={readiness?.readiness_score ?? 0}
                status={readiness?.status ?? "WYMAGA_WIECEJ_NAUKI"}
              />
            )}
          </CardContent>
        </Card>

        {/* Stats cards */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Odpowiedzi</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-questions-answered">
                  {loadingStats ? <Skeleton className="h-7 w-16" /> : (stats?.questions_answered ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trafność</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-accuracy">
                  {loadingStats ? <Skeleton className="h-7 w-16" /> : `${stats?.accuracy_percent ?? 0}%`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zdane egzaminy</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-exams-passed">
                  {loadingGamification ? <Skeleton className="h-7 w-16" /> : `${gamification?.exams_passed ?? 0}/${gamification?.exams_taken ?? 0}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seria</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-streak">
                  {loadingGamification ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <>
                      {gamification?.current_streak ?? 0}{" "}
                      <span className="text-sm font-normal text-muted-foreground">dni</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gamification bar */}
      {gamification && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-level">
                  Poziom {gamification.level}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {gamification.total_points} XP
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {gamification.total_points % 100}/100 do następnego poziomu
              </span>
            </div>
            <Progress value={gamification.total_points % 100} className="h-2" data-testid="progress-xp" />
          </CardContent>
        </Card>
      )}

      {/* Mode navigation cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">TRYBY NAUKI</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {modeCards.map((card) => (
            <Link key={card.path} href={card.path}>
              <Card className="cursor-pointer hover:border-primary/30 transition-colors group" data-testid={`card-mode-${card.path.replace("/", "")}`}>
                <CardContent className="pt-5">
                  <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <p className="font-medium text-foreground text-sm">{card.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent exams */}
      {examHistory && examHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">OSTATNIE EGZAMINY</h2>
          <div className="space-y-2">
            {examHistory.slice(0, 5).map((exam: any, i: number) => (
              <Card key={i}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {exam.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {exam.total_points}/{exam.max_points} pkt
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {exam.passed ? "Zdany" : "Niezdany"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={exam.passed ? "default" : "destructive"} data-testid={`badge-exam-${i}`}>
                    {Math.round((exam.total_points / exam.max_points) * 100)}%
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
