import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import CustomVideoPlayer from "@/components/CustomVideoPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  FileCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Home,
  AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";

interface ExamQuestion {
  question_order: number;
  question_id: number;
  question_number: string;
  question_text: string;
  answer_a: string | null;
  answer_b: string | null;
  answer_c: string | null;
  question_type: "TAK_NIE" | "ABC";
  media_filename: string | null;
  points: number;
  scope: string;
}

interface ExamSession {
  session_id: string;
  category: string;
  total_questions: number;
  max_points: number;
  time_limit_minutes: number;
  questions: ExamQuestion[];
}

interface ExamAnswerDetail {
  question_order: number;
  question_id: number;
  question_text: string;
  user_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  media_filename: string | null;
  answer_a?: string | null;
  answer_b?: string | null;
  answer_c?: string | null;
  points_earned: number;
  points_possible: number;
}

interface ExamResults {
  session_id: string;
  total_points: number;
  max_points: number;
  passed: boolean;
  pass_threshold: number;
  answers?: any[];
}

type Phase = "start" | "exam" | "results";

export default function ExamPage() {
  const [phase, setPhase] = useState<Phase>("start");
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 min in seconds
  const [results, setResults] = useState<ExamResults | null>(null);
  const [, setLocation] = useLocation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [qPhase, setQPhase] = useState<"reading" | "playing" | "answering" | "specialized">("reading");
  const [qTimeLeft, setQTimeLeft] = useState(20);
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [category, setCategory] = useState("B");
  // Start exam mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/exam/start?category=" + category);
      return res.json();
    },
    onSuccess: (data: ExamSession) => {
      setSession(data);
      setPhase("exam");
      setCurrentIndex(0);
      setAnswers({});
      setTimeLeft(data.time_limit_minutes * 60);
    },
  });

  // Answer mutation
  const answerMutation = useMutation({
    mutationFn: async ({ sessionId, questionId, answer }: { sessionId: string; questionId: number; answer: string }) => {
      const res = await apiRequest("POST", "/api/exam/" + sessionId + "/answer", { question_id: questionId, answer });
      return res.json();
    },
  });

  // Finish mutation
  const finishMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", "/api/exam/" + sessionId + "/finish");
      return res.json();
    },
    onSuccess: (data: ExamResults) => {
      setResults(data);
      setPhase("results");
      queryClient.invalidateQueries({ queryKey: ["/api/exam/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/readiness?category=B"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/profile"] });
    },
  });

  const { data: detailedResults } = useQuery({
    queryKey: ["/api/exam/results", results?.session_id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/exam/" + results!.session_id + "/results");
      return res.json();
    },
    enabled: !!results?.session_id && phase === "results",
  });

  // Timer
  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — auto-finish
          if (session) {
            finishMutation.mutate(session.session_id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, session]);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min.toString().padStart(2, "0") + ":" + sec.toString().padStart(2, "0");
  };

  const currentQuestion = session?.questions[currentIndex];

  useEffect(() => {
    if (currentQuestion) {
      if (currentQuestion.question_type === "TAK_NIE") {
        setQPhase("reading");
        setQTimeLeft(20);
      } else {
        setQPhase("specialized");
        setQTimeLeft(50);
      }
    }
  }, [currentIndex, currentQuestion]);

  useEffect(() => {
    if (phase !== "exam" || !currentQuestion) return;

    const timer = setInterval(() => {
      setQTimeLeft((prev) => {
        if (qPhase === "playing") return prev;
        if (prev > 0) return prev - 1;
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, currentQuestion, qPhase]);

  useEffect(() => {
    if (qTimeLeft === 0) {
      if (qPhase === "reading") {
        const isVideo = currentQuestion?.media_filename?.toLowerCase().match(/\.(mp4|wmv)$/);
        if (isVideo) {
          setQPhase("playing");
        } else {
          setQPhase("answering");
          setQTimeLeft(15);
        }
      } else if (qPhase === "answering" || qPhase === "specialized") {
        if (session && currentIndex < session.questions.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else if (session) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishMutation.mutate(session.session_id);
        }
      }
    }
  }, [qTimeLeft, qPhase, currentQuestion, session, currentIndex, finishMutation]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!session || !currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: answer }));

      // Submit answer to backend
      answerMutation.mutate({
        sessionId: session.session_id,
        questionId: currentQuestion.question_id,
        answer,
      });
    },
    [session, currentQuestion]
  );

  const handleNext = useCallback(() => {
    if (!session) return;
    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Last question — finish exam
      if (timerRef.current) clearInterval(timerRef.current);
      finishMutation.mutate(session.session_id);
    }
  }, [session, currentIndex, finishMutation]);

  // Obsługa skrótów klawiszowych dla sprawnego rozwiązywania Egzaminu
  useEffect(() => {
    if (phase !== "exam" || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Zaniechaj jeśli użytkownik kliknie poza (z natywnym buttonem połączonym z fokusem spacja może podwójnie odpalić akcje, prewencja w e.preventDefault)
      if (qPhase === "reading") {
        if (e.code === "Space") {
          e.preventDefault();
          setQTimeLeft(0);
        }
      } else if (qPhase === "playing" || qPhase === "answering" || qPhase === "specialized") {
        if (e.code === "Space") {
          e.preventDefault(); // Zablokuj natywne zachowanie scrollowania / wciskania guzika pod focusem
          const isAnswered = !!answers[currentQuestion.question_id];
          if (isAnswered) {
            handleNext();
          }
        } else if (e.code === "Digit1" || e.code === "Numpad1") {
          e.preventDefault();
          if (currentQuestion.question_type === "TAK_NIE") handleAnswer("T");
          else handleAnswer("A");
        } else if (e.code === "Digit2" || e.code === "Numpad2") {
          e.preventDefault();
          if (currentQuestion.question_type === "TAK_NIE") handleAnswer("N");
          else handleAnswer("B");
        } else if (e.code === "Digit3" || e.code === "Numpad3") {
          if (currentQuestion.question_type !== "TAK_NIE") {
            e.preventDefault();
            handleAnswer("C");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, currentQuestion, qPhase, answers, handleNext, handleAnswer]);

  // START SCREEN
  if (phase === "start") {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Egzamin próbny</CardTitle>
                <p className="text-sm text-muted-foreground">Symulacja oficjalnego egzaminu</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Wybierz kategorię
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {["AM", "A1", "A2", "A", "B", "B1", "C1", "C", "D1", "D", "T"].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      Kategoria {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Liczba pytań</span>
                <span className="font-medium">32</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Czas</span>
                <span className="font-medium">25 minut</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Maks. punkty</span>
                <span className="font-medium">74 pkt</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Próg zdania</span>
                <span className="font-medium">68 pkt (92%)</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-yellow-500/10 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <p>
                Tak jak na prawdziwym egzaminie, nie możesz cofać się do wcześniejszych pytań.
                Odpowiedz na każde pytanie i przejdź dalej.
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="button-start-exam"
            >
              {startMutation.isPending ? "Rozpoczynanie..." : "Rozpocznij egzamin"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // EXAM SCREEN
  if (phase === "exam" && session && currentQuestion) {
    const answered = answers[currentQuestion.question_id] !== undefined;
    const progress = ((currentIndex + 1) / session.questions.length) * 100;
    const isUrgent = timeLeft < 120;

    return (
      <div className="p-2 sm:p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between px-2 sm:px-0">
          <div className="flex items-center gap-3">
            <Badge variant="outline" data-testid="badge-question-counter">
              Pytanie {currentIndex + 1}/{session.questions.length}
            </Badge>
            <Badge variant="outline">
              {currentQuestion.points} pkt
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {currentQuestion.scope === "PODSTAWOWY" ? "Podstawowy" : "Specjalistyczny"}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={"flex items-center gap-1.5 font-mono text-sm font-bold " + (
                qTimeLeft <= 5 && qPhase !== 'playing' ? "text-destructive animate-pulse" : "text-primary"
              )}
            >
              <Clock className="w-4 h-4" />
              {qPhase === "reading" ? "Zapoznaj się: " + qTimeLeft + "s" : qPhase === "playing" ? "Odtwarzanie..." : "Odpowiedź: " + qTimeLeft + "s"}
            </div>
            <div
              className={"flex items-center gap-1.5 font-mono text-sm font-bold " + (
                isUrgent ? "text-destructive" : "text-foreground"
              )}
              data-testid="text-timer"
            >
              <Clock className={"w-4 h-4 " + (isUrgent ? "animate-pulse" : "")} />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <div className="px-2 sm:px-0">
          <Progress value={progress} className="h-1.5" />
        </div>

        <Card>
          <CardContent className="p-2 sm:p-6 pt-4 sm:pt-6">
            <div className="flex justify-between items-start mb-6">
              <p
                className="text-base font-medium text-foreground leading-relaxed"
                data-testid="text-question"
              >
                {currentQuestion.question_text}
              </p>
              {qPhase === "reading" && (
                <Button variant="outline" size="sm" onClick={() => setQTimeLeft(0)} className="ml-4 shrink-0">
                  Gotowe
                </Button>
              )}
            </div>

            {currentQuestion.media_filename && qPhase !== "reading" && (
              <div className="mb-4 sm:mb-6 mx-[-8px] sm:mx-0 rounded-none sm:rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                {currentQuestion.media_filename.toLowerCase().endsWith(".wmv") || currentQuestion.media_filename.toLowerCase().endsWith(".mp4") ? (
                  <CustomVideoPlayer
                    mode="exam"
                    src={API_BASE + "/api/media/" + currentQuestion.media_filename.replace(/\.wmv$/i, ".mp4")}
                    onEnded={() => {
                      setQPhase("answering");
                      setQTimeLeft(15);
                    }}
                    className="max-h-[280px] sm:max-h-[500px]"
                  />
                ) : (
                  <img
                    src={API_BASE + "/api/media/" + currentQuestion.media_filename}
                    alt="Multimedia do pytania"
                    className="max-h-[280px] sm:max-h-[500px] w-full object-contain"
                  />
                )}
              </div>
            )}

            {currentQuestion.question_type === "TAK_NIE" ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={answers[currentQuestion.question_id] === "T" ? "default" : "outline"}
                  size="lg"
                  className="h-14 text-base"
                  disabled={qPhase === "reading"}
                  onClick={() => handleAnswer("T")}
                  data-testid="button-answer-tak"
                >
                  TAK
                </Button>
                <Button
                  variant={answers[currentQuestion.question_id] === "N" ? "default" : "outline"}
                  size="lg"
                  className="h-14 text-base"
                  disabled={qPhase === "reading"}
                  onClick={() => handleAnswer("N")}
                  data-testid="button-answer-nie"
                >
                  NIE
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {(["A", "B", "C"] as const).map((letter) => {
                  const answerText =
                    letter === "A"
                      ? currentQuestion.answer_a
                      : letter === "B"
                        ? currentQuestion.answer_b
                        : currentQuestion.answer_c;
                  if (!answerText) return null;
                  return (
                    <Button
                      key={letter}
                      variant={answers[currentQuestion.question_id] === letter ? "default" : "outline"}
                      className="w-full justify-start h-auto py-3 px-4 text-left whitespace-normal"
                      disabled={qPhase === "reading"}
                      onClick={() => handleAnswer(letter)}
                      data-testid={"button-answer-" + letter.toLowerCase()}
                    >
                      <span className="font-bold mr-3 shrink-0">{letter}.</span>
                      <span className="text-sm">{answerText}</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-end">
          <Button
            onClick={handleNext}
            disabled={!answered}
            data-testid="button-next-question"
          >
            {currentIndex === session.questions.length - 1 ? "Zakończ egzamin" : "Następne pytanie"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (phase === "results" && results) {
    const percentage = Math.round((results.total_points / results.max_points) * 100);

    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div
              className={"w-20 h-20 rounded-full mx-auto flex items-center justify-center " + (
                results.passed ? "bg-green-500/10" : "bg-destructive/10"
              )}
            >
              {results.passed ? (
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              ) : (
                <XCircle className="w-10 h-10 text-destructive" />
              )}
            </div>

            <div>
              <h2
                className={"text-2xl font-bold " + (results.passed ? "text-green-500" : "text-destructive")}
                data-testid="text-exam-result"
              >
                {results.passed ? "Zdany!" : "Niezdany"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {results.passed
                  ? "Gratulacje! Zdałbyś ten egzamin."
                  : "Nie martw się, spróbuj ponownie!"}
              </p>
            </div>

            <div className="text-5xl font-bold text-foreground" data-testid="text-exam-score">
              {results.total_points}
              <span className="text-xl text-muted-foreground">/{results.max_points}</span>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Wynik: <span className="font-bold text-foreground">{percentage}%</span>
              </span>
              <span className="text-muted-foreground">
                Próg: <span className="font-bold text-foreground">{results.pass_threshold} pkt</span>
              </span>
            </div>

            <Progress
              value={percentage}
              className="h-3 max-w-xs mx-auto"
              data-testid="progress-exam-result"
            />
          </CardContent>
        </Card>

        {detailedResults && detailedResults.answers && (
          <div className="space-y-4 mt-8">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                Podsumowanie odpowiedzi
              </h3>
              <div className="flex items-center gap-2">
                <label htmlFor="show-all-answers" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                  Pokaż wszystkie
                </label>
                <Switch
                  id="show-all-answers"
                  checked={showAllAnswers}
                  onCheckedChange={setShowAllAnswers}
                />
              </div>
            </div>

            {detailedResults.answers.filter((ans: ExamAnswerDetail) => showAllAnswers || !ans.is_correct).length === 0 && (
              <div className="text-center py-12 text-muted-foreground bg-accent/30 rounded-lg border border-dashed">
                <p className="font-medium text-lg text-foreground">Brak błędnych odpowiedzi!</p>
                <p className="text-sm mt-1">Bezbłędny wynik. Użyj przełącznika wyżej aby prześledzić wylosowane pytania. 🎉</p>
              </div>
            )}

            {detailedResults.answers
              .filter((ans: ExamAnswerDetail) => showAllAnswers || !ans.is_correct)
              .map((ans: ExamAnswerDetail) => (
                <Card key={ans.question_id} className={"border-l-4 " + (ans.is_correct ? "border-l-green-500" : "border-l-destructive")}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="font-medium text-sm leading-relaxed">
                        {ans.question_order}. {ans.question_text}
                      </p>
                      <Badge variant={ans.is_correct ? "default" : "destructive"} className={ans.is_correct ? "bg-green-500" : ""}>
                        {ans.is_correct ? ans.points_earned + " pkt" : "0/" + ans.points_possible + " pkt"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-4 bg-muted/50 p-3 rounded-md">
                      <div>
                        <span className="text-muted-foreground block mb-1">Twoja odpowiedź:</span>
                        <span className={"font-bold " + (ans.is_correct ? "text-green-600" : "text-destructive")}>
                          {ans.user_answer
                            ? (ans.user_answer === 'A' && ans.answer_a ? "A. " + ans.answer_a
                              : ans.user_answer === 'B' && ans.answer_b ? "B. " + ans.answer_b
                                : ans.user_answer === 'C' && ans.answer_c ? "C. " + ans.answer_c
                                  : ans.user_answer === 'T' ? 'TAK'
                                    : ans.user_answer === 'N' ? 'NIE'
                                      : ans.user_answer)
                            : "Brak odpowiedzi"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">Poprawna odpowiedź:</span>
                        <span className="font-bold text-green-600">
                          {ans.correct_answer === 'A' && ans.answer_a ? "A. " + ans.answer_a
                            : ans.correct_answer === 'B' && ans.answer_b ? "B. " + ans.answer_b
                              : ans.correct_answer === 'C' && ans.answer_c ? "C. " + ans.answer_c
                                : ans.correct_answer === 'T' ? 'TAK'
                                  : ans.correct_answer === 'N' ? 'NIE'
                                    : ans.correct_answer}
                        </span>
                      </div>
                    </div>
                    {ans.media_filename && (
                      <details className="mt-4 group rounded-md border p-3 border-border">
                        <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center outline-none">
                          Multimedia
                        </summary>
                        <div className="mt-4 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                          {ans.media_filename.toLowerCase().endsWith(".wmv") || ans.media_filename.toLowerCase().endsWith(".mp4") ? (
                            <CustomVideoPlayer
                              mode="review"
                              src={API_BASE + "/api/media/" + ans.media_filename.replace(/\.wmv$/i, ".mp4")}
                              className="max-h-[400px]"
                            />
                          ) : (
                            <img
                              src={ans.media_filename.match(/^[A-Z]-[0-9]+/) ? API_BASE + "/api/znaki/" + ans.media_filename : API_BASE + "/api/media/" + ans.media_filename}
                              alt="Media"
                              className="max-h-[400px] w-full object-contain drop-shadow-md"
                            />
                          )}
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setLocation("/")}
            data-testid="button-back-to-menu"
          >
            <Home className="w-4 h-4 mr-2" />
            Wróć do menu
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setPhase("start");
              setResults(null);
              setSession(null);
            }}
            data-testid="button-retry-exam"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
