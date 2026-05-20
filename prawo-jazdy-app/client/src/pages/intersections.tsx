import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitFork,
  CheckCircle2,
  XCircle,
  Undo2,
  RotateCcw,
  Lightbulb,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight as ArrowRightIcon,
} from "lucide-react";

interface Vehicle {
  id: number;
  vehicle_label: string;
  vehicle_type: string;
  direction_from: string;
  direction_to: string;
  position_description: string;
}

interface Scenario {
  id: number;
  name: string;
  description: string;
  difficulty: string;
  image_filename: string | null;
  vehicles?: Vehicle[];
  scenario_data?: any;
}

interface SolveResult {
  is_correct: boolean;
  submitted_order: string[];
  violations: { yielding_vehicle: string; priority_vehicle: string; rule: string; message: string }[];
  correct_order_example: string[];
}

const difficultyColors: Record<string, string> = {
  EASY: "bg-green-500/10 text-green-600",
  MEDIUM: "bg-yellow-500/10 text-yellow-600",
  HARD: "bg-red-500/10 text-red-600",
};
const difficultyLabels: Record<string, string> = {
  EASY: "Łatwy",
  MEDIUM: "Średni",
  HARD: "Trudny",
};

function getVehicleColor(type: string): string {
  switch (type) {
    case "EMERGENCY": return "#ef4444";
    case "TRAM": return "#f59e0b";
    case "TRUCK": return "#6b7280";
    case "BICYCLE": return "#10b981";
    case "PEDESTRIAN": return "#8b5cf6";
    case "USER": return "#22c55e";
    default: return "#3b82f6";
  }
}

function getVehicleSize(type: string): { w: number; h: number } {
  switch (type) {
    case "TRAM": return { w: 22, h: 50 };
    case "TRUCK": return { w: 22, h: 44 };
    case "BICYCLE": return { w: 14, h: 26 };
    case "PEDESTRIAN": return { w: 12, h: 12 };
    default: return { w: 20, h: 36 };
  }
}

function getDirectionPos(from: string): { x: number; y: number; rotation: number } {
  switch (from) {
    case "N": return { x: 215, y: 60, rotation: 180 };
    case "S": return { x: 185, y: 340, rotation: 0 };
    case "E": return { x: 340, y: 215, rotation: 270 };
    case "W": return { x: 60, y: 185, rotation: 90 };
    default: return { x: 200, y: 200, rotation: 0 };
  }
}

function directionArrow(from: string, to: string) {
  // Simple arrow showing direction of travel
  const arrows: Record<string, typeof ArrowUp> = {
    N: ArrowUp,
    S: ArrowDown,
    E: ArrowRightIcon,
    W: ArrowLeft,
  };
  return arrows[to] || ArrowUp;
}

function IntersectionSVG({
  vehicles,
  selectedOrder,
  onVehicleClick,
}: {
  vehicles: Vehicle[];
  selectedOrder: string[];
  onVehicleClick: (label: string) => void;
}) {
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-md mx-auto" data-testid="svg-intersection">
      {/* Roads */}
      <rect x="150" y="0" width="100" height="400" fill="hsl(var(--muted))" rx="2" />
      <rect x="0" y="150" width="400" height="100" fill="hsl(var(--muted))" rx="2" />

      {/* Road markings - center lines */}
      <line x1="200" y1="0" x2="200" y2="140" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.4" />
      <line x1="200" y1="260" x2="200" y2="400" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.4" />
      <line x1="0" y1="200" x2="140" y2="200" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.4" />
      <line x1="260" y1="200" x2="400" y2="200" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.4" />

      {/* Compass */}
      <text x="200" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="hsl(var(--muted-foreground))">N</text>
      <text x="200" y="396" textAnchor="middle" fontSize="12" fontWeight="bold" fill="hsl(var(--muted-foreground))">S</text>
      <text x="10" y="204" textAnchor="middle" fontSize="12" fontWeight="bold" fill="hsl(var(--muted-foreground))">W</text>
      <text x="390" y="204" textAnchor="middle" fontSize="12" fontWeight="bold" fill="hsl(var(--muted-foreground))">E</text>

      {/* Vehicles */}
      {vehicles.map((v) => {
        const pos = getDirectionPos(v.direction_from);
        const size = getVehicleSize(v.vehicle_type);
        const color = getVehicleColor(v.vehicle_type);
        const orderIndex = selectedOrder.indexOf(v.vehicle_label);
        const isSelected = orderIndex !== -1;

        return (
          <g
            key={v.id}
            transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rotation})`}
            className="cursor-pointer"
            onClick={() => onVehicleClick(v.vehicle_label)}
            data-testid={`vehicle-${v.vehicle_label}`}
          >
            {/* Vehicle body */}
            <rect
              x={-size.w / 2}
              y={-size.h / 2}
              width={size.w}
              height={size.h}
              rx={3}
              fill={color}
              stroke={isSelected ? "#ffffff" : "transparent"}
              strokeWidth={2}
              opacity={isSelected ? 1 : 0.85}
            />

            {/* Emergency lights */}
            {v.vehicle_type === "EMERGENCY" && (
              <>
                <rect x={-size.w / 2 + 2} y={-size.h / 2 + 2} width={6} height={4} rx={1} fill="#60a5fa" />
                <rect x={size.w / 2 - 8} y={-size.h / 2 + 2} width={6} height={4} rx={1} fill="#fbbf24" />
              </>
            )}

            {/* Label */}
            <text
              y={-size.h / 2 - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fill="hsl(var(--foreground))"
              transform={`rotate(${-pos.rotation})`}
            >
              {v.vehicle_label}
            </text>

            {/* Order number */}
            {isSelected && (
              <circle cx={size.w / 2 + 4} cy={-size.h / 2 - 4} r={9} fill="hsl(var(--primary))" />
            )}
            {isSelected && (
              <text
                x={size.w / 2 + 4}
                y={-size.h / 2 - 1}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="white"
                transform={`rotate(${-pos.rotation})`}
              >
                {orderIndex + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function IntersectionsPage() {
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const { data: scenarios, isLoading: loadingScenarios } = useQuery<Scenario[]>({
    queryKey: ["/api/intersections"],
  });

  const { data: scenario, isLoading: loadingScenario } = useQuery<Scenario>({
    queryKey: ["/api/intersections", selectedScenario],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/intersections/${selectedScenario}`);
      return res.json();
    },
    enabled: selectedScenario !== null,
  });

  const solveMutation = useMutation({
    mutationFn: async ({ scenarioId, order }: { scenarioId: number; order: string[] }) => {
      const res = await apiRequest("POST", `/api/intersections/${scenarioId}/solve`, { order });
      return res.json();
    },
    onSuccess: (data: SolveResult) => {
      setSolveResult(data);
    },
  });

  const hintMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      const res = await apiRequest("GET", `/api/intersections/${scenarioId}/hint`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setHint(data.hint);
    },
  });

  const handleVehicleClick = useCallback(
    (label: string) => {
      if (solveResult) return;
      setSelectedOrder((prev) => {
        if (prev.includes(label)) return prev;
        return [...prev, label];
      });
    },
    [solveResult]
  );

  const handleUndo = useCallback(() => {
    setSelectedOrder((prev) => prev.slice(0, -1));
  }, []);

  const handleReset = useCallback(() => {
    setSelectedOrder([]);
    setSolveResult(null);
    setHint(null);
  }, []);

  const handleCheck = useCallback(() => {
    if (!selectedScenario) return;
    solveMutation.mutate({ scenarioId: selectedScenario, order: selectedOrder });
  }, [selectedScenario, selectedOrder]);

  // Scenario list view
  if (selectedScenario === null) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="text-intersections-title">
            <GitFork className="w-5 h-5 text-primary" />
            Skrzyżowania
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ćwicz pierwszeństwo przejazdu na skrzyżowaniach
          </p>
        </div>

        {loadingScenarios ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scenarios?.map((s) => (
              <Card
                key={s.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => {
                  setSelectedScenario(s.id);
                  setSelectedOrder([]);
                  setSolveResult(null);
                  setHint(null);
                }}
                data-testid={`card-scenario-${s.id}`}
              >
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-foreground text-sm">{s.name}</h3>
                    <Badge className={difficultyColors[s.difficulty] || ""}>
                      {difficultyLabels[s.difficulty] || s.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Scenario detail view
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedScenario(null);
            handleReset();
          }}
          data-testid="button-back-scenarios"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Wróć do listy
        </Button>
      </div>

      {loadingScenario ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : scenario ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{scenario.name}</CardTitle>
                  <Badge className={difficultyColors[scenario.difficulty] || ""}>
                    {difficultyLabels[scenario.difficulty] || scenario.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{scenario.description}</p>
              </CardHeader>
              <CardContent>
                <IntersectionSVG
                  vehicles={scenario.vehicles || []}
                  selectedOrder={selectedOrder}
                  onVehicleClick={handleVehicleClick}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {/* Selected order */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium mb-2">Kolejność przejazdu</h3>
                {selectedOrder.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Kliknij pojazdy w kolejności, w jakiej powinny przejechać
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrder.map((label, i) => (
                      <Badge key={i} variant="secondary" data-testid={`badge-order-${i}`}>
                        {i + 1}. {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleUndo}
                disabled={selectedOrder.length === 0 || !!solveResult}
                data-testid="button-undo"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                Cofnij
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleReset}
                data-testid="button-reset"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>

            <Button
              className="w-full"
              onClick={handleCheck}
              disabled={
                selectedOrder.length === 0 ||
                solveMutation.isPending ||
                !!solveResult
              }
              data-testid="button-check-order"
            >
              {solveMutation.isPending ? "Sprawdzanie..." : "Sprawdź"}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => hintMutation.mutate(selectedScenario)}
              disabled={hintMutation.isPending}
              data-testid="button-hint"
            >
              <Lightbulb className="w-4 h-4 mr-1" />
              Podpowiedź
            </Button>

            {/* Hint display */}
            {hint && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm text-foreground" data-testid="text-hint">
                    💡 {hint}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Result display */}
            {solveResult && (
              <Card
                className={
                  solveResult.is_correct
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2" data-testid="text-solve-result">
                    {solveResult.is_correct ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-medium text-green-600 dark:text-green-400 text-sm">
                          Poprawna kolejność!
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-destructive" />
                        <span className="font-medium text-destructive text-sm">
                          Niepoprawna kolejność
                        </span>
                      </>
                    )}
                  </div>

                  {!solveResult.is_correct && solveResult.violations.length > 0 && (
                    <div className="space-y-1.5">
                      {solveResult.violations.map((v, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          ⚠ {v.yielding_vehicle} musi ustąpić {v.priority_vehicle}: {v.rule}
                        </p>
                      ))}
                      <div className="pt-1 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Poprawna kolejność:{" "}
                          <span className="font-medium text-foreground">
                            {solveResult.correct_order_example.join(" → ")}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
