import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { resolveMediaUrl } from "@/lib/media-url";
import { trpcClient } from "@/utils/trpc";

type SearchResult = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export function UserSearchBar({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (term: string) => {
    if (term.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await trpcClient.user.search.query({ query: term, limit: 8 });
      setResults(data);
      setIsOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToProfile = (userId: string) => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onNavigate?.();
    window.location.href = `/profile?userId=${encodeURIComponent(userId)}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goToProfile(results[activeIndex]!.id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search people..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-9 w-full rounded-lg border border-border/60 bg-background/60 pl-9 pr-8 text-sm outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        {query && !isLoading && (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((user, idx) => {
              const label = user.displayName?.trim() || user.name;
              const subtitle = user.displayName?.trim() ? user.name : null;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => goToProfile(user.id)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      idx === activeIndex ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      {user.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(user.avatarUrl)}
                          alt={label}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                          {label.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{label}</p>
                      {subtitle && (
                        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
