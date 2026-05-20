import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileCheck,
  BookOpen,
  Layers,
  GitFork,
  User,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Car,
  ChevronLeft,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Panel główny", icon: LayoutDashboard },
  { path: "/exam", label: "Egzamin", icon: FileCheck },
  { path: "/practice", label: "Ćwiczenia", icon: BookOpen },
  { path: "/flashcards", label: "Fiszki", icon: Layers },
  { path: "/intersections", label: "Skrzyżowania", icon: GitFork },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-16 border-b border-sidebar-border shrink-0 transition-all", sidebarCollapsed ? "justify-center px-0" : "px-4 gap-3")}>
          <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-primary flex items-center justify-center">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && <span className="font-bold text-sidebar-foreground text-base truncate">Prawo Jazdy</span>}
          <button
            className="ml-auto lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    sidebarCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-sidebar-border space-y-2 overflow-hidden">
          {user && (
            <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-2 px-2")}>
              <div 
                className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/40 transition-colors"
                onClick={() => { setLocation("/profile"); setSidebarOpen(false); }}
                title="Profil"
              >
                <span className="text-xs font-bold text-primary">
                  {user.username ? user.username.charAt(0).toUpperCase() : "?"}
                </span>
              </div>
              {!sidebarCollapsed && (
                <>
                  <span 
                    className="text-sm text-sidebar-foreground truncate flex-1 cursor-pointer hover:underline"
                    onClick={() => { setLocation("/profile"); setSidebarOpen(false); }}
                    title="Profil"
                  >
                    {user?.username || "Gość"}
                  </span>
                </>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full text-sidebar-foreground/70",
              sidebarCollapsed ? "justify-center px-0 h-10 w-10 mx-auto mt-2" : "justify-start gap-2"
            )}
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
            title={sidebarCollapsed ? (theme === "dark" ? "Tryb jasny" : "Tryb ciemny") : undefined}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!sidebarCollapsed && <span className="truncate">{theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full text-sidebar-foreground/70 mt-2",
              sidebarCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-start gap-2"
            )}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Rozwiń pasek" : "Zwiń pasek"}
          >
            <ChevronLeft className={cn("w-4 h-4 shrink-0 transition-transform", sidebarCollapsed ? "rotate-180" : "")} />
            {!sidebarCollapsed && <span className="truncate">Zwiń pasek</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center h-14 px-4 border-b border-border lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
            data-testid="button-open-sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-semibold text-foreground">Prawo Jazdy</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
