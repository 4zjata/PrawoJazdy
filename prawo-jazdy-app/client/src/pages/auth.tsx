import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Car, Shield } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const res = await apiRequest("POST", "/api/auth/login", { username, password });
        const data = await res.json();
        // Backend nie poleca obiektu usera ale potrzebujemy username'u na potrzeby Sidebar'u i Layoutu w UI.
        login(data.access_token, { id: "0", username: username, email: "", created_at: "", last_active: "" });
      } else {
        const res = await apiRequest("POST", "/api/auth/register", { username, email, password });
        const user = await res.json();
        
        // Auto-login after register
        const loginRes = await apiRequest("POST", "/api/auth/login", { username, password });
        const loginData = await loginRes.json();
        login(loginData.access_token, user);
      }
      
      // Force reload UI after state propagation via wouter routing
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Błąd",
        description: err.message || "Wystąpił błąd podczas autoryzacji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Car className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Prawo Jazdy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Przygotuj się do egzaminu na prawo jazdy
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle data-testid="text-auth-title">
              {isLogin ? "Zaloguj się" : "Zarejestruj się"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Wpisz dane logowania, aby kontynuować"
                : "Utwórz konto, aby rozpocząć naukę"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nazwa użytkownika</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="jan_kowalski"
                  required
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jan@example.com"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-submit-auth"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isLogin ? "Logowanie..." : "Rejestracja..."}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {isLogin ? "Zaloguj się" : "Zarejestruj się"}
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setIsLogin(!isLogin)}
                data-testid="button-toggle-auth-mode"
              >
                {isLogin
                  ? "Nie masz konta? Zarejestruj się"
                  : "Masz już konto? Zaloguj się"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
