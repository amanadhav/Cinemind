import { Clapperboard } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscoverTab } from "@/components/discover-tab";
import { ForYouTab } from "@/components/for-you-tab";
import { HybridTab } from "@/components/hybrid-tab";
import { HowItWorks } from "@/components/how-it-works";
import { ErrorBoundary } from "@/components/error-boundary";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Clapperboard className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">CineMind</h1>
        </div>
        <p className="text-muted-foreground">
          Personalized movie recommendations powered by content-based and
          collaborative filtering.
        </p>
      </header>

      <Tabs defaultValue="for-you" className="w-full">
        <div className="mb-8 flex justify-center">
          <TabsList>
            <TabsTrigger value="for-you">For You</TabsTrigger>
            <TabsTrigger value="discover">Discover by Movie</TabsTrigger>
            <TabsTrigger value="mix-it">Mix It</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="for-you">
          <ErrorBoundary label="For You">
            <ForYouTab />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="discover">
          <ErrorBoundary label="Discover by Movie">
            <DiscoverTab />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="mix-it">
          <ErrorBoundary label="Mix It">
            <HybridTab />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      <section className="mt-14">
        <HowItWorks />
      </section>

      <footer className="mt-16 border-t pt-6 text-center text-xs text-muted-foreground">
        Built with Next.js, shadcn/ui, and a Flask + scikit-learn / SciPy backend.
      </footer>
    </main>
  );
}
