import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Brain,
  Target,
  Flame,
  Loader2,
} from "lucide-react";

interface Question {
  id: number;
  question_number: string;
  question_text: string;
  answer_a: string | null;
  answer_b: string | null;
  answer_c: string | null;
  question_type: "TAK_NIE" | "ABC";
  media_filename: string | null;
  points: number;
  scope: string;
  category: string;
}

interface AnswerResult {
  question_id: number;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points: number;
  explanation: string;
}

export default function PracticePage() {
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [flashClass, setFlashClass] = useState("");
  const [sessionStats, setSessionStats] = useState({ answered: 0, correct: 0, streak: 0 });
  const [questionKey, setQuestionKey] = useState(0);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  const { data: questions, isLoading, refetch } = useQuery<Question[]>({
    queryKey: ["/api/questions/random?category=B&count=1", sessionId, questionKey],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/questions/random?category=B&count=1");
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: number; answer: string }) => {
      const res = await apiRequest("POST", `/api/questions/${questionId}/answer`, { answer });
      return res.json();
    },
    onSuccess: (data: AnswerResult) => {
      setResult(data);
      setAnswered(true);
      setFlashClass(data.is_correct ? "animate-flash-green" : "animate-flash-red");
      setSessionStats((prev) => ({
        answered: prev.answered + 1,
        correct: prev.correct + (data.is_correct ? 1 : 0),
        streak: data.is_correct ? prev.streak + 1 : 0,
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/questions/stats?category=B"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/profile"] });
    },
  });

  const question = questions?.[0];

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!question || answered) return;
      answerMutation.mutate({ questionId: question.id, answer });
    },
    [question, answered]
  );

  const handleNext = useCallback(() => {
    setAnswered(false);
    setResult(null);
    setFlashClass("");
    setQuestionKey((k) => k + 1);
  }, []);

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6 px-2 sm:px-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-practice-title">
            <BookOpen className="w-5 h-5 text-primary" />
            Ćwiczenia
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Losowe pytania z natychmiastową informacją zwrotną
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main question area */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <div className="space-y-2 mt-6">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : question ? (
            <Card className={flashClass}>
              <CardContent className="p-2 sm:p-6 pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{question.question_number}</Badge>
                  <Badge variant="secondary">{question.points} pkt</Badge>
                  <Badge variant="secondary" className="text-xs">
                    {question.scope === "PODSTAWOWY" ? "Podstawowy" : "Specjalistyczny"}
                  </Badge>
                </div>
                
                {question.media_filename && (
                  <div className="mb-4 sm:mb-6 mx-[-8px] sm:mx-0 rounded-none sm:rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    {question.media_filename.toLowerCase().endsWith(".wmv") || question.media_filename.toLowerCase().endsWith(".mp4") ? (
                      <video
                        src={`${API_BASE}/api/media/${question.media_filename.replace(/\.wmv$/i, ".mp4")}`}
                        controls
                        className="max-h-[280px] sm:max-h-[500px] w-full object-contain"
                      />
                    ) : (
                      <img
                        src={`${API_BASE}/api/media/${question.media_filename}`}
                        alt="Multimedia do pytania"
                        className="max-h-[280px] sm:max-h-[500px] w-full object-contain"
                      />
                    )}
                  </div>
                )}

                <p
                  className="text-base font-medium text-foreground leading-relaxed mb-6"
                  data-testid="text-practice-question"
                >
                  {question.question_text}
                </p>

                {question.question_type === "TAK_NIE" ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(["T", "N"] as const).map((ans) => {
                      let variant: "default" | "outline" | "destructive" = "outline";
                      let extraClass = "";
                      if (answered && result) {
                        if (ans === result.correct_answer) {
                          variant = "default";
                          extraClass = "bg-green-600 hover:bg-green-600 border-green-600";
                        } else if (ans === result.user_answer && !result.is_correct) {
                          variant = "destructive";
                        }
                      }
                      return (
                        <Button
                          key={ans}
                          variant={variant}
                          size="lg"
                          className={`h-14 text-base ${extraClass}`}
                          onClick={() => handleAnswer(ans)}
                          disabled={answered}
                          data-testid={`button-practice-${ans === "T" ? "tak" : "nie"}`}
                        >
                          {ans === "T" ? "TAK" : "NIE"}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(["A", "B", "C"] as const).map((letter) => {
                      const text =
                        letter === "A"
                          ? question.answer_a
                          : letter === "B"
                          ? question.answer_b
                          : question.answer_c;
                      if (!text) return null;
                      let variant: "default" | "outline" | "destructive" = "outline";
                      let extraClass = "";
                      if (answered && result) {
                        if (letter === result.correct_answer) {
                          variant = "default";
                          extraClass = "bg-green-600 hover:bg-green-600 border-green-600";
                        } else if (letter === result.user_answer && !result.is_correct) {
                          variant = "destructive";
                        }
                      }
                      return (
                        <Button
                          key={letter}
                          variant={variant}
                          className={`w-full justify-start h-auto py-3 px-4 text-left whitespace-normal ${extraClass}`}
                          onClick={() => handleAnswer(letter)}
                          disabled={answered}
                          data-testid={`button-practice-${letter.toLowerCase()}`}
                        >
                          <span className="font-bold mr-3 shrink-0">{letter}.</span>
                          <span className="text-sm">{text}</span>
                        </Button>
                      );
                    })}
                  </div>
                )}

                {/* Result feedback */}
                {answered && result && (
                  <div className="mt-6 space-y-3">



                    <Button
                      className="w-full"
                      onClick={handleNext}
                      data-testid="button-next-practice"
                    >
                      Następne pytanie
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak dostępnych pytań
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Sesja</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Odpowiedzi</span>
                  <span className="font-medium" data-testid="text-session-answered">
                    {sessionStats.answered}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Poprawne</span>
                  <span className="font-medium text-green-600" data-testid="text-session-correct">
                    {sessionStats.correct}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trafność</span>
                  <span className="font-medium" data-testid="text-session-accuracy">
                    {sessionStats.answered > 0
                      ? `${Math.round((sessionStats.correct / sessionStats.answered) * 100)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Seria</p>
                <p className="text-lg font-bold" data-testid="text-session-streak">
                  {sessionStats.streak}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
