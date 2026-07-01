import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE, getAuthToken } from "@/lib/queryClient";
import CustomVideoPlayer from "@/components/CustomVideoPlayer";
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
  Sparkles,
  Bot,
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

const formatMarkdown = (text: string) => {
  return text.split("\n").map((line, idx) => {
    const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");
    const cleanLine = isBullet ? line.replace(/^[\s-*]+/, "") : line;
    
    const parts = cleanLine.split(/\*\*([^*]+)\*\*/g);
    const formatted = parts.map((part, pIdx) => {
      if (pIdx % 2 === 1) {
        return <strong key={pIdx} className="font-bold text-foreground">{part}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <li key={idx} className="ml-4 list-disc text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {formatted}
        </li>
      );
    }
    return (
      <p key={idx} className="text-sm text-muted-foreground mt-2 leading-relaxed">
        {formatted}
      </p>
    );
  });
};

export default function PracticePage() {
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);
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

  // Auto reveal when user answers
  useEffect(() => {
    if (answered) {
      setShowAi(true);
    }
  }, [answered]);

  const loadAiExplanation = useCallback((questionId: number) => {
    setAiExplanation(null);
    setAiLoading(true);
    setAiError(null);
    setShowAi(false);

    let isMounted = true;
    let accumulatedText = "";
    let buffer = "";

    const fetchStream = async () => {
      try {
        const headers: Record<string, string> = {};
        const token = getAuthToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/api/questions/${questionId}/explain-ai`, {
          headers
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Błąd serwera (status ${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("Strumień odpowiedzi nie jest dostępny.");
        }

        const decoder = new TextDecoder();
        let done = false;

        while (!done && isMounted) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          const chunkValue = decoder.decode(value, { stream: !done });
          buffer += chunkValue;
          
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            
            if (cleanLine.startsWith("data: ")) {
              const dataStr = cleanLine.substring(6);
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                const content = parsed.choices?.[0]?.delta?.content;
                if (content && isMounted) {
                  accumulatedText += content;
                  setAiExplanation(accumulatedText);
                }
              } catch (e: any) {
                if (dataStr.includes('"error"')) {
                  try {
                    const parsed = JSON.parse(dataStr);
                    throw new Error(parsed.error);
                  } catch (jsonErr) {}
                }
                console.error("Błąd parsowania SSE chunk:", e);
              }
            }
          }
        }
        
        if (isMounted) {
          setAiLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("AI stream error:", err);
          setAiError(err.message || "Błąd podczas generowania podpowiedzi AI");
          setAiLoading(false);
        }
      }
    };

    fetchStream();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load AI explanation on question change
  useEffect(() => {
    if (!question) return;

    const isVideo = question.media_filename && (
      question.media_filename.toLowerCase().endsWith(".mp4") || 
      question.media_filename.toLowerCase().endsWith(".wmv")
    );

    if (isVideo) {
      setAiExplanation(null);
      setAiLoading(false);
      setAiError(null);
      setShowAi(false);
      return;
    }

    const cancel = loadAiExplanation(question.id);
    return cancel;
  }, [question?.id, loadAiExplanation]);

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

  // Obsługa skrótów klawiszowych dla sprawnego ćwiczenia
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (!question) return;

      if (e.code === "Space") {
        if (answered) {
          e.preventDefault();
          handleNext();
        }
      } else if (!answered) {
        if (e.code === "Digit1" || e.code === "Numpad1") {
          e.preventDefault();
          if (question.question_type === "TAK_NIE") handleAnswer("T");
          else handleAnswer("A");
        } else if (e.code === "Digit2" || e.code === "Numpad2") {
          e.preventDefault();
          if (question.question_type === "TAK_NIE") handleAnswer("N");
          else handleAnswer("B");
        } else if (e.code === "Digit3" || e.code === "Numpad3") {
          if (question.question_type !== "TAK_NIE") {
            e.preventDefault();
            handleAnswer("C");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, answered, handleAnswer, handleNext]);

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
            <>
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
                      <CustomVideoPlayer
                        mode="practice"
                        src={`${API_BASE}/api/media/${question.media_filename.replace(/\.wmv$/i, ".mp4")}`}
                        isAnswered={answered}
                        className="max-h-[280px] sm:max-h-[500px]"
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

            {/* Sekcja Asystenta AI */}
            {(() => {
              const isVideo = question?.media_filename && (
                question.media_filename.toLowerCase().endsWith(".mp4") || 
                question.media_filename.toLowerCase().endsWith(".wmv")
              );

              if (isVideo || !question) return null;

              return (
                <Card className="mt-4 border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-primary/5 shadow-sm overflow-hidden">
                  <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b border-purple-500/10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        Asystent AI
                        <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-1.5 py-0">
                          Sonnet
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {aiLoading && (
                      <div className="flex flex-col gap-3 py-2">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                          <span className="text-xs text-muted-foreground font-medium">
                            AI analizuje sytuację na drodze za pomocą wyszukiwania sieciowego...
                          </span>
                        </div>
                        <div className="space-y-2 mt-1">
                          <Skeleton className="h-4 w-full bg-purple-500/5" />
                          <Skeleton className="h-4 w-[90%] bg-purple-500/5" />
                          <Skeleton className="h-4 w-[75%] bg-purple-500/5" />
                        </div>
                      </div>
                    )}

                    {aiError && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="font-semibold">Wystąpił błąd</p>
                          <p className="text-muted-foreground">{aiError}</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-destructive font-medium text-[11px]"
                            onClick={() => loadAiExplanation(question.id)}
                          >
                            Spróbuj ponownie
                          </Button>
                        </div>
                      </div>
                    )}

                    {!aiLoading && !aiError && aiExplanation && (
                      <div>
                        {!showAi && !answered ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-purple-500/15 rounded-lg bg-purple-500/[0.02] p-4">
                            <Sparkles className="w-8 h-8 text-purple-400 mb-2 opacity-80" />
                            <p className="text-xs font-semibold text-foreground">Analiza AI jest gotowa</p>
                            <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
                              Rozwiąż pytanie lub kliknij poniżej, aby wyświetlić analizę AI i podpowiedź.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 h-9 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 font-semibold gap-1.5 text-xs shadow-sm"
                              onClick={() => setShowAi(true)}
                            >
                              <Brain className="w-3.5 h-3.5" />
                              Pokaż podpowiedź AI
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-fade-in">
                            <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3 sm:p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Bot className="w-4 h-4 text-purple-500" />
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">
                                  Analiza Asystenta AI
                                </span>
                              </div>
                              <div className="space-y-1">
                                {formatMarkdown(aiExplanation)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
            </>
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
                  <span
                    className={`font-medium ${
                      sessionStats.answered > 0
                        ? Math.round((sessionStats.correct / sessionStats.answered) * 100) >= 92
                          ? "text-green-600"
                          : "text-red-600"
                        : ""
                    }`}
                    data-testid="text-session-accuracy"
                  >
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
