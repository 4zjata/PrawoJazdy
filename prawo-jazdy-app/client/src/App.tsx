import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import ExamPage from "./pages/exam";
import PracticePage from "./pages/practice";
import FlashcardsPage from "./pages/flashcards";
import IntersectionsPage from "./pages/intersections";
import ProfilePage from "./pages/profile";
import NotFound from "./pages/not-found";

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/exam" component={ExamPage} />
        <Route path="/practice" component={PracticePage} />
        <Route path="/flashcards" component={FlashcardsPage} />
        <Route path="/intersections" component={IntersectionsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route component={AuthPage} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <AppRoutes />
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
