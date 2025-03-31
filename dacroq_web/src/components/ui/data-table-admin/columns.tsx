"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/Badge"
import { AdminUser } from "@/data/admin/schema"
import { formatDistanceToNow } from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/DropdownMenu"
import { Button } from "@/components/Button"
import { RiMoreLine } from "@remixicon/react"

export const columns: ColumnDef<AdminUser>[] = [
  {
    accessorKey: "displayName",
    header: "Name",
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="size-8 rounded-full border border-gray-300 dark:border-gray-800"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              {user.displayName.charAt(0)}
            </div>
          )}
          <span>{user.displayName}</span>
        </div>
      )
    }
  },
  {
    accessorKey: "email",
    header: "Email"
  },
  {
    accessorKey: "joinDate",
    header: "Join Date",
    cell: ({ row }) => {
      const joinDate = new Date(row.getValue("joinDate"))
      return <span>{joinDate.toLocaleDateString()}</span>
    }
  },
  {
    accessorKey: "lastOnlineDate",
    header: "Last Online",
    cell: ({ row }) => {
      const lastOnlineDate = row.getValue("lastOnlineDate") as string | null
      if (!lastOnlineDate) return <span>Never</span>

      const date = new Date(lastOnlineDate)
      return <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
    }
  },
  {
    accessorKey: "testsRun",
    header: "Tests Run"
  },
  {
    accessorKey: "accountState",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("accountState") as string
      return (
        <Badge variant={status === "enabled" ? "success" : "destructive"}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      )
    }
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      const badgeVariant =
        role === "admin" ? "default" :
          role === "moderator" ? "outline" : "secondary"

      return (
        <Badge variant={badgeVariant}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <RiMoreLine className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit user</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              {user.accountState === "enabled" ? "Disable account" : "Enable account"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  }
]