"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const AccordionContext = React.createContext<{
  value: string | null;
  onChange: (value: string) => void;
}>({
  value: null,
  onChange: () => {},
});

export function Accordion({
  children,
  type = "single",
  collapsible = false,
  className,
  ...props
}: {
  children: React.ReactNode;
  type?: "single" | "multiple";
  collapsible?: boolean;
  className?: string;
}) {
  const [value, setValue] = React.useState<string | null>(null);

  const onChange = React.useCallback((newValue: string) => {
    setValue((prev) => (prev === newValue && collapsible ? null : newValue));
  }, [collapsible]);

  return (
    <AccordionContext.Provider value={{ value, onChange }}>
      <div className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  children,
  value,
  className,
  ...props
}: {
  children: React.ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("border rounded-md", className)} {...props}>
      {children}
    </div>
  );
}

export function AccordionTrigger({
  children,
  className,
  value,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  value: string;
}) {
  const { value: contextValue, onChange } = React.useContext(AccordionContext);
  const isOpen = contextValue === value;

  return (
    <button
      className={cn(
        "flex w-full items-center justify-between p-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      onClick={() => onChange(value)}
      data-value={value}
      {...props}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 transition-transform duration-200"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

export function AccordionContent({
  children,
  className,
  value,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  value: string;
}) {
  const { value: contextValue } = React.useContext(AccordionContext);
  const isOpen = contextValue === value;

  return (
    <div
      className={cn(
        "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
      data-value={value}
      {...props}
    >
      <div className="pb-4 pt-0">{children}</div>
    </div>
  );
} 