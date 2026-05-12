'use client';

import {
  Code2,
  Palette,
  Layout,
  Zap,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface PromptSuggestionsProps {
  onPromptClick: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    icon: Code2,
    title: 'React Component',
    prompt: 'Build a reusable React component for a responsive card with image, title, description, and action button using TypeScript and Tailwind CSS',
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    border: 'hover:border-sky-200 dark:hover:border-sky-800',
  },
  {
    icon: Palette,
    title: 'CSS Animation',
    prompt: 'Create a smooth CSS animation for a loading spinner using Tailwind CSS, with multiple variants (dots, bars, circle)',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    border: 'hover:border-purple-200 dark:hover:border-purple-800',
  },
  {
    icon: Layout,
    title: 'Layout Pattern',
    prompt: 'Create a responsive dashboard layout with a sidebar navigation, header, and main content area using Tailwind CSS and Next.js',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'hover:border-amber-200 dark:hover:border-amber-800',
  },
  {
    icon: Zap,
    title: 'Performance',
    prompt: 'What are the best practices for optimizing React/Next.js app performance? Include code splitting, lazy loading, and caching strategies with examples',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'hover:border-rose-200 dark:hover:border-rose-800',
  },
  {
    icon: ShieldCheck,
    title: 'Accessibility',
    prompt: 'How do I make a React modal component fully accessible? Include ARIA attributes, focus trapping, and keyboard navigation with TypeScript code',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    border: 'hover:border-teal-200 dark:hover:border-teal-800',
  },
  {
    icon: Smartphone,
    title: 'Responsive Design',
    prompt: 'Create a responsive navigation component that collapses into a hamburger menu on mobile, using React, TypeScript and Tailwind CSS',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/50',
    border: 'hover:border-orange-200 dark:hover:border-orange-800',
  },
];

export function PromptSuggestions({ onPromptClick }: PromptSuggestionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion.title}
          onClick={() => onPromptClick(suggestion.prompt)}
          className={`flex items-start gap-3 p-4 rounded-xl border border-border/50 ${suggestion.bg} ${suggestion.border} transition-all duration-200 text-left group hover:shadow-sm`}
        >
          <div
            className={`p-2 rounded-lg ${suggestion.bg} ${suggestion.color} group-hover:scale-110 transition-transform`}
          >
            <suggestion.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm mb-1">{suggestion.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {suggestion.prompt}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
