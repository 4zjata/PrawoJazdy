import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface Flashcard {
  id: number;
  sign_code: string;
  sign_name: string;
  description: string;
  category: string;
}

const CATEGORIES = [
  { key: "OSTRZEGAWCZE", label: "Ostrzegawcze" },
  { key: "ZAKAZU", label: "Zakazu" },
  { key: "NAKAZU", label: "Nakazu" },
  { key: "INFORMACYJNE", label: "Informacyjne" },
  { key: "KIERUNKU", label: "Kierunku" },
  { key: "UZUPELNIAJACE", label: "Uzupełniające" },
  { key: "POZIOME", label: "Poziome" },
  { key: "LOSOWE", label: "Mix (Losowe)" },
];

const ratingButtons = [
  { min: 0, max: 1, label: "Nie wiem", color: "bg-red-500 hover:bg-red-600 text-white" },
  { min: 2, max: 3, label: "Częściowo", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  { min: 4, max: 5, label: "Wiem", color: "bg-green-500 hover:bg-green-600 text-white" },
];

export default function FlashcardsPage() {
  const [category, setCategory] = useState("OSTRZEGAWCZE");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mode, setMode] = useState<"browse" | "review">("browse");

  const { data: flashcards, isLoading } = useQuery<Flashcard[]>({
    queryKey: ["/api/flashcards", category],
    queryFn: async () => {
      const url = category === "LOSOWE" ? `/api/flashcards` : `/api/flashcards?category=${category}`;
      const res = await apiRequest("GET", url);
      const data = await res.json();
      
      // Jeżeli to tryb losowy, na wejściu mieszamy całą pule znaków
      if (category === "LOSOWE" && Array.isArray(data)) {
        return data.sort(() => Math.random() - 0.5);
      }
      return data;
    },
  });

  const { data: reviewCards } = useQuery<Flashcard[]>({
    queryKey: ["/api/flashcards/review?count=20"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/flashcards/review?count=20");
      return res.json();
    },
    enabled: mode === "review",
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, quality }: { id: number; quality: number }) => {
      const res = await apiRequest("POST", `/api/flashcards/${id}/review`, { quality });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/review?count=20"] });
    },
  });

  const cards = mode === "review" ? reviewCards : flashcards;
  const currentCard = cards?.[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleRate = useCallback(
    (quality: number) => {
      if (!currentCard) return;
      reviewMutation.mutate({ id: currentCard.id, quality });
      setIsFlipped(false);
      setTimeout(() => {
        if (cards && currentIndex < cards.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setCurrentIndex(0);
        }
      }, 300);
    },
    [currentCard, cards, currentIndex]
  );

  const handlePrev = useCallback(() => {
    if (isFlipped) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex((prev) => Math.max(0, prev - 1)), 300);
    } else {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
  }, [isFlipped]);

  const handleNext = useCallback(() => {
    if (!cards) return;
    if (isFlipped) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1)), 300);
    } else {
      setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1));
    }
  }, [cards, isFlipped]);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-flashcards-title">
            <Layers className="w-5 h-5 text-primary" />
            Fiszki — Znaki drogowe
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ucz się znaków drogowych metodą powtórek
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mode === "browse" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("browse"); setCurrentIndex(0); setIsFlipped(false); }}
            data-testid="button-mode-browse"
          >
            Przeglądaj
          </Button>
          <Button
            variant={mode === "review" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("review"); setCurrentIndex(0); setIsFlipped(false); }}
            data-testid="button-mode-review"
          >
            Powtórki
          </Button>
        </div>
      </div>

      {/* Category tabs (only in browse mode) */}
      {mode === "browse" && (
        <div className="mb-4 overflow-x-auto">
          <Tabs
            value={category}
            onValueChange={(val) => {
              setCategory(val);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
          >
            <TabsList className="inline-flex w-auto">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.key}
                  value={cat.key}
                  className="text-xs whitespace-nowrap"
                  data-testid={`tab-${cat.key.toLowerCase()}`}
                >
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : cards && cards.length > 0 && currentCard ? (
        <>
          {/* Flashcard */}
          <div className="perspective-1000 mb-4">
            <div
              className={`relative w-full h-72 cursor-pointer preserve-3d transition-transform duration-500 ${
                isFlipped ? "rotate-y-180" : ""
              }`}
              onClick={handleFlip}
              data-testid="card-flashcard"
            >
              {/* Front */}
              <Card className="absolute inset-0 backface-hidden flex items-center justify-center">
                <CardContent className="text-center py-6">
                  <div className="h-56 mb-4 flex items-center justify-center">
                    <img 
                      src={`${API_BASE}/api/znaki/${currentCard.sign_code}.png`} 
                      alt={currentCard.sign_code} 
                      className="max-w-full object-contain drop-shadow-md"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Kliknij, aby obrócić
                  </p>
                </CardContent>
              </Card>

              {/* Back */}
              <Card className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center">
                <CardContent className="text-center py-6 px-8">
                  <Badge variant="secondary" className="mb-4">
                    {currentCard.category}
                  </Badge>
                  <h2 className="text-xl font-bold text-foreground mb-3" data-testid="text-flashcard-back-title">
                    {currentCard.sign_name}
                  </h2>
                  <p className="text-sm text-foreground leading-relaxed" data-testid="text-flashcard-back">
                    {currentCard.description}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Rating buttons (shown when flipped) */}
          {isFlipped && (
            <div className="flex gap-2 mb-4" data-testid="flashcard-rating">
              {ratingButtons.map((btn) => (
                <Button
                  key={btn.label}
                  className={`flex-1 ${btn.color}`}
                  onClick={() => handleRate(btn.max)}
                  data-testid={`button-rate-${btn.min}`}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              data-testid="button-prev-card"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Poprzedni
            </Button>
            <span className="text-sm text-muted-foreground" data-testid="text-card-counter">
              {currentIndex + 1} / {cards.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === cards.length - 1}
              data-testid="button-next-card"
            >
              Następny
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {mode === "review"
                ? "Brak fiszek do powtórki. Świetna robota!"
                : "Brak fiszek w tej kategorii"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
