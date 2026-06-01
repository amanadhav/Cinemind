"use client";

import { useState } from "react";
import { ChevronDown, FileText, Users, Blend } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

const ITEMS = [
  {
    icon: FileText,
    title: "Content-Based",
    body: "TF-IDF vectorization on genres, keywords, cast and director. Nearest neighbors via cosine similarity.",
  },
  {
    icon: Users,
    title: "Collaborative",
    body: "SVD matrix factorization on 100,836 ratings from 610 users. New users are projected into latent space from your ratings — no retraining required.",
  },
  {
    icon: Blend,
    title: "Hybrid",
    body: "Content similarity score and collaborative predicted rating are normalized and blended with equal weight. Source of each result is shown.",
  },
];

export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mx-auto max-w-3xl">
      <CollapsibleTrigger className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        How it works
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid gap-3 md:grid-cols-3">
        {ITEMS.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold text-foreground">
                  {title}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {body}
              </p>
            </CardContent>
          </Card>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
