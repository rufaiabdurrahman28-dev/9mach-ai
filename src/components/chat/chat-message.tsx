'use client';

import { useMemo } from 'react';
import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CodeBlock } from './code-block';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const components: Components = useMemo(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const codeString = String(children).replace(/\n$/, '');
        if (match) {
          return <CodeBlock language={match[1]} code={codeString} />;
        }
        return (
          <code
            className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      },
      p({ children }) {
        return <p className="mb-3 last:mb-0 leading-7">{children}</p>;
      },
      ul({ children }) {
        return <ul className="mb-3 list-disc pl-6 space-y-1">{children}</ul>;
      },
      ol({ children }) {
        return <ol className="mb-3 list-decimal pl-6 space-y-1">{children}</ol>;
      },
      li({ children }) {
        return <li className="leading-7">{children}</li>;
      },
      h1({ children }) {
        return <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>;
      },
      h2({ children }) {
        return <h2 className="text-lg font-bold mb-2 mt-4">{children}</h2>;
      },
      h3({ children }) {
        return <h3 className="text-base font-bold mb-2 mt-3">{children}</h3>;
      },
      strong({ children }) {
        return <strong className="font-semibold">{children}</strong>;
      },
      blockquote({ children }) {
        return (
          <blockquote className="border-l-4 border-primary/30 pl-4 my-3 italic text-muted-foreground">
            {children}
          </blockquote>
        );
      },
      a({ href, children }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        );
      },
      table({ children }) {
        return (
          <div className="my-3 overflow-x-auto">
            <table className="w-full border-collapse border border-border">
              {children}
            </table>
          </div>
        );
      },
      th({ children }) {
        return (
          <th className="border border-border px-3 py-2 bg-muted text-left text-sm font-semibold">
            {children}
          </th>
        );
      },
      td({ children }) {
        return (
          <td className="border border-border px-3 py-2 text-sm">{children}</td>
        );
      },
    }),
    []
  );

  return (
    <div
      className={`flex gap-3 py-4 px-4 ${
        role === 'assistant' ? 'bg-muted/30' : ''
      }`}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={
            role === 'assistant'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
              : 'bg-primary text-primary-foreground'
          }
        >
          {role === 'assistant' ? (
            <Bot className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-1">
          {role === 'assistant' ? 'FrontEnd AI' : 'You'}
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {content ? (
            <ReactMarkdown components={components}>{content}</ReactMarkdown>
          ) : isStreaming ? (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
