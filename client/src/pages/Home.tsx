import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <main className="container max-w-4xl px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <MessageSquare className="w-16 h-16 text-primary" />
            </div>
            <CardTitle className="text-4xl font-bold">Orkio v5 Platform</CardTitle>
            <CardDescription className="text-lg mt-2">
              AI-powered chat with persistent memory and multi-tenant support
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            {!loading && !isAuthenticated && (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Sign in to start chatting with AI</p>
                <Button asChild size="lg">
                  <a href={getLoginUrl()}>Sign In</a>
                </Button>
              </div>
            )}
            {!loading && isAuthenticated && user && (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Welcome back, {user.name || user.email}!</p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button asChild size="lg">
                    <Link href="/chat/default">Start Chatting</Link>
                  </Button>
                  {user.role === "admin" && (
                    <Button asChild size="lg" variant="secondary">
                      <Link href="/admin">Admin Console</Link>
                    </Button>
                  )}
                  <Button variant="outline" onClick={logout}>
                    Sign Out
                  </Button>
                </div>
              </div>
            )}
            {error && (
              <p className="text-destructive text-center">Error: {error.message}</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
