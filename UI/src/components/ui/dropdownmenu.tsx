// Tremor Dropdown Menu [v0.0.3] – monochrome edition
"use client"

import * as DropdownMenuPrimitives from "@radix-ui/react-dropdown-menu"
import {
    RiArrowRightSLine,
    RiCheckboxBlankCircleLine,
    RiCheckLine,
    RiRadioButtonFill,
} from "@remixicon/react"
import * as React from "react"

import { cx } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*                                   ROOTS                                    */
/* -------------------------------------------------------------------------- */

const Dropdownmenu = DropdownMenuPrimitives.Root
Dropdownmenu.displayName = "DropdownMenu"

const DropdownMenuTrigger = DropdownMenuPrimitives.Trigger
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuGroup = DropdownMenuPrimitives.Group
DropdownMenuGroup.displayName = "DropdownMenuGroup"

const DropdownMenuSubMenu = DropdownMenuPrimitives.Sub
DropdownMenuSubMenu.displayName = "DropdownMenuSubMenu"

const DropdownMenuRadioGroup = DropdownMenuPrimitives.RadioGroup
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup"

/* -------------------------------------------------------------------------- */
/*                                SUB-TRIGGER                                */
/* -------------------------------------------------------------------------- */

const DropdownMenuSubMenuTrigger = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.SubTrigger>,
    Omit<
        React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.SubTrigger>,
        "asChild"
    >
>(({ className, children, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.SubTrigger
        ref={forwardedRef}
        className={cx(
            // base
            "relative flex cursor-default select-none items-center rounded py-1.5 pl-2 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
            // text
            "text-foreground",
            // disabled
            "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
            // focus / open
            "focus-visible:bg-muted data-[state=open]:bg-muted",
            // hover
            "hover:bg-muted/60",
            className,
        )}
        {...props}
    >
        {children}
        <RiArrowRightSLine className="ml-auto size-4 shrink-0" aria-hidden="true" />
    </DropdownMenuPrimitives.SubTrigger>
))
DropdownMenuSubMenuTrigger.displayName = "DropdownMenuSubMenuTrigger"

/* -------------------------------------------------------------------------- */
/*                               SUB-CONTENT                                 */
/* -------------------------------------------------------------------------- */

const DropdownMenuSubMenuContent = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.SubContent>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.SubContent>
>(({ className, collisionPadding = 8, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Portal>
        <DropdownMenuPrimitives.SubContent
            ref={forwardedRef}
            collisionPadding={collisionPadding}
            className={cx(
                // base
                "relative z-50 overflow-hidden rounded-md border p-1 shadow-xl shadow-black/[2.5%]",
                /* min / max */
                "min-w-32 max-h-[var(--radix-popper-available-height)]",
                // colors
                "bg-popover text-popover-foreground border-border",
                // transition
                "will-change-[transform,opacity] data-[state=closed]:animate-hide",
                "data-[side=bottom]:animate-slideDownAndFade data-[side=left]:animate-slideLeftAndFade data-[side=right]:animate-slideRightAndFade data-[side=top]:animate-slideUpAndFade",
                className,
            )}
            {...props}
        />
    </DropdownMenuPrimitives.Portal>
))
DropdownMenuSubMenuContent.displayName = "DropdownMenuSubMenuContent"

/* -------------------------------------------------------------------------- */
/*                                  CONTENT                                  */
/* -------------------------------------------------------------------------- */

const DropdownMenuContent = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.Content>
>(
    (
        {
            className,
            sideOffset = 8,
            collisionPadding = 8,
            align = "center",
            loop = true,
            ...props
        },
        forwardedRef,
    ) => (
        <DropdownMenuPrimitives.Portal>
            <DropdownMenuPrimitives.Content
                ref={forwardedRef}
                className={cx(
                    // base
                    "relative z-50 overflow-hidden rounded-md border p-1 shadow-xl shadow-black/[2.5%]",
                    "min-w-48 max-h-[var(--radix-popper-available-height)]",
                    // colors
                    "bg-popover text-popover-foreground border-border",
                    // transition
                    "will-change-[transform,opacity] data-[state=closed]:animate-hide",
                    "data-[side=bottom]:animate-slideDownAndFade data-[side=left]:animate-slideLeftAndFade data-[side=right]:animate-slideRightAndFade data-[side=top]:animate-slideUpAndFade",
                    className,
                )}
                sideOffset={sideOffset}
                align={align}
                collisionPadding={collisionPadding}
                loop={loop}
                {...props}
            />
        </DropdownMenuPrimitives.Portal>
    ),
)
DropdownMenuContent.displayName = "DropdownMenuContent"

/* -------------------------------------------------------------------------- */
/*                                   ITEM                                    */
/* -------------------------------------------------------------------------- */

const DropdownMenuItem = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.Item>,
    Omit<
        React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.Item>,
        "asChild"
    > & {
    shortcut?: string
    hint?: string
}
>(({ className, shortcut, hint, children, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Item
        ref={forwardedRef}
        className={cx(
            // base
            "group/DropdownMenuItem relative flex cursor-pointer select-none items-center rounded py-1.5 pl-2 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
            // text
            "text-foreground",
            // disabled
            "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
            // focus / hover
            "focus-visible:bg-muted hover:bg-muted/60",
            className,
        )}
        tremor-id="tremor-raw"
        {...props}
    >
        {children}
        {hint && (
            <span className="ml-auto pl-2 text-sm text-muted-foreground">{hint}</span>
        )}
        {shortcut && (
            <span className="ml-auto pl-2 text-sm tracking-widest text-muted-foreground">
        {shortcut}
      </span>
        )}
    </DropdownMenuPrimitives.Item>
))
DropdownMenuItem.displayName = "DropdownMenuItem"

/* -------------------------------------------------------------------------- */
/*                               CHECKBOX ITEM                               */
/* -------------------------------------------------------------------------- */

const DropdownMenuCheckboxItem = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.CheckboxItem>,
    Omit<
        React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.CheckboxItem>,
        "asChild"
    > & {
    shortcut?: string
    hint?: string
}
>(
    (
        { className, hint, shortcut, children, checked, ...props },
        forwardedRef,
    ) => (
        <DropdownMenuPrimitives.CheckboxItem
            ref={forwardedRef}
            className={cx(
                "relative flex cursor-pointer select-none items-center gap-x-2 rounded py-1.5 pl-8 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
                "text-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
                "focus-visible:bg-muted hover:bg-muted/60",
                className,
            )}
            checked={checked}
            {...props}
        >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitives.ItemIndicator>
          <RiCheckLine
              aria-hidden="true"
              className="size-full shrink-0 text-foreground"
          />
        </DropdownMenuPrimitives.ItemIndicator>
      </span>
            {children}
            {hint && (
                <span className="ml-auto text-sm font-normal text-muted-foreground">
          {hint}
        </span>
            )}
            {shortcut && (
                <span className="ml-auto text-sm font-normal tracking-widest text-muted-foreground">
          {shortcut}
        </span>
            )}
        </DropdownMenuPrimitives.CheckboxItem>
    ),
)
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

/* -------------------------------------------------------------------------- */
/*                                RADIO ITEM                                 */
/* -------------------------------------------------------------------------- */

const DropdownMenuRadioItem = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.RadioItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.RadioItem> & {
    shortcut?: string
    hint?: string
    iconType?: "check" | "radio"
}
>(
    (
        { className, hint, shortcut, children, iconType = "radio", ...props },
        forwardedRef,
    ) => (
        <DropdownMenuPrimitives.RadioItem
            ref={forwardedRef}
            className={cx(
                "group/DropdownMenuRadioItem relative flex cursor-pointer select-none items-center gap-x-2 rounded py-1.5 pl-8 pr-1 outline-none transition-colors data-[state=checked]:font-semibold sm:text-sm",
                "text-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground",
                "focus-visible:bg-muted hover:bg-muted/60",
                className,
            )}
            {...props}
        >
            {iconType === "radio" ? (
                <span className="absolute left-2 flex size-4 items-center justify-center">
          <RiRadioButtonFill
              aria-hidden="true"
              className="size-full shrink-0 text-foreground group-data-[state=checked]/DropdownMenuRadioItem:flex group-data-[state=unchecked]/DropdownMenuRadioItem:hidden"
          />
          <RiCheckboxBlankCircleLine
              aria-hidden="true"
              className="size-full shrink-0 text-muted-foreground group-data-[state=unchecked]/DropdownMenuRadioItem:flex group-data-[state=checked]/DropdownMenuRadioItem:hidden"
          />
        </span>
            ) : iconType === "check" ? (
                <span className="absolute left-2 flex size-4 items-center justify-center">
          <RiCheckLine
              aria-hidden="true"
              className="size-full shrink-0 text-foreground group-data-[state=checked]/DropdownMenuRadioItem:flex group-data-[state=unchecked]/DropdownMenuRadioItem:hidden"
          />
        </span>
            ) : null}
            {children}
            {hint && (
                <span className="ml-auto text-sm font-normal text-muted-foreground">
          {hint}
        </span>
            )}
            {shortcut && (
                <span className="ml-auto text-sm font-normal tracking-widest text-muted-foreground">
          {shortcut}
        </span>
            )}
        </DropdownMenuPrimitives.RadioItem>
    ),
)
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

/* -------------------------------------------------------------------------- */
/*                               MISC. PARTS                                 */
/* -------------------------------------------------------------------------- */

const DropdownMenuLabel = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.Label>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.Label>
>(({ className, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Label
        ref={forwardedRef}
        className={cx(
            "px-2 py-2 text-xs font-medium tracking-wide text-muted-foreground",
            className,
        )}
        {...props}
    />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitives.Separator>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitives.Separator>
>(({ className, ...props }, forwardedRef) => (
    <DropdownMenuPrimitives.Separator
        ref={forwardedRef}
        className={cx("-mx-1 my-1 h-px border-t border-border", className)}
        {...props}
    />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuIconWrapper = ({
                                     className,
                                     ...props
                                 }: React.HTMLAttributes<HTMLSpanElement>) => (
    <div
        className={cx(
            "text-muted-foreground group-data-[disabled]/DropdownMenuItem:text-muted-foreground",
            className,
        )}
        {...props}
    />
)
DropdownMenuIconWrapper.displayName = "DropdownMenuIconWrapper"

/* -------------------------------------------------------------------------- */
/*                                   EXPORTS                                 */
/* -------------------------------------------------------------------------- */

export {
    Dropdownmenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuIconWrapper,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSubMenu,
    DropdownMenuSubMenuContent,
    DropdownMenuSubMenuTrigger,
    DropdownMenuTrigger,
}
