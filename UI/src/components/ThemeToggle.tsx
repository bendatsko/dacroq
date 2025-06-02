"use client";

import * as React from "react";
import { RiMoonLine, RiSunLine, RiComputerLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Dropdownmenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownmenu";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Only show theme-specific icon after hydration to prevent SSR mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Get the appropriate icon based on current theme
  const getIcon = () => {
    if (!mounted) {
      // Show a neutral icon during SSR/before hydration
      return <RiSunLine className="h-[18px] w-[18px]" />;
    }
    
    switch (theme) {
      case "light":
        return <RiSunLine className="h-[18px] w-[18px]" />;
      case "dark":
        return <RiMoonLine className="h-[18px] w-[18px]" />;
      case "system":
        return <RiComputerLine className="h-[18px] w-[18px]" />;
      default:
        return <RiSunLine className="h-[18px] w-[18px]" />;
    }
  };

  return (
      <Dropdownmenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
              variant="ghost"
              size="sm"
              className="h-[27px] px-2 text-muted-foreground hover:text-foreground"
          >
            {getIcon()}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="end"
            className="bg-popover text-popover-foreground border-border"
            sideOffset={5}
        >
          <DropdownMenuItem
              onClick={() => setTheme("light")}
              className="text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&:focus]:outline-none [&:focus]:ring-0 [&:focus-visible]:outline-none [&:focus-visible]:ring-0"
              onMouseDown={(e) => e.preventDefault()}
          >
            <RiSunLine className="mr-2 h-4 w-4" />
            <span>Light</span>
          </DropdownMenuItem>
          <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className="text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&:focus]:outline-none [&:focus]:ring-0 [&:focus-visible]:outline-none [&:focus-visible]:ring-0"
              onMouseDown={(e) => e.preventDefault()}
          >
            <RiMoonLine className="mr-2 h-4 w-4" />
            <span>Dark</span>
          </DropdownMenuItem>
          <DropdownMenuItem
              onClick={() => setTheme("system")}
              className="text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&:focus]:outline-none [&:focus]:ring-0 [&:focus-visible]:outline-none [&:focus-visible]:ring-0"
              onMouseDown={(e) => e.preventDefault()}
          >
            <RiComputerLine className="mr-2 h-4 w-4" />
            <span>System</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </Dropdownmenu>
  );
}