"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Divider } from "@/components/Divider"
import { RiInformationLine, RiRefreshLine, RiShieldLine } from "@remixicon/react"
import { Button } from "@/components/Button"
import { agents } from "@/data/agents/agents"
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@tremor/react'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

function IndeterminateCheckbox({ indeterminate, className, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = !rest.checked && indeterminate
    }
  }, [ref, indeterminate])

  return (
    <input
      type="checkbox"
      ref={ref}
      className={classNames(
        'size-4 rounded border-tremor-border text-tremor-brand shadow-tremor-input focus:ring-tremor-brand-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-brand dark:shadow-dark-tremor-input dark:focus:ring-dark-tremor-brand-muted',
        className,
      )}
      {...rest}
    />
  )
}

interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  joinDate: string;
  lastOnlineDate: string | null;
  testsRun: number;
  accountState: "enabled" | "disabled";
  role: "user" | "moderator" | "admin";
  photoURL?: string;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [rowSelection, setRowSelection] = useState({})

  useEffect(() => {
    loadUsers()
    loadMaintenanceState()
  }, [])

  const loadMaintenanceState = async () => {
    try {
      const maintenanceRef = doc(db, "system", "maintenance");
      const maintenanceDoc = await getDoc(maintenanceRef);
      if (maintenanceDoc.exists()) {
        setMaintenanceMode(maintenanceDoc.data().enabled);
        setWhitelistedEmails(maintenanceDoc.data().whitelistedEmails || []);
      }
    } catch (error) {
      console.error("Error loading maintenance state:", error);
    }
  };

  const toggleMaintenanceMode = async () => {
    try {
      const maintenanceRef = doc(db, "system", "maintenance");
      await setDoc(maintenanceRef, {
        enabled: !maintenanceMode,
        whitelistedEmails,
        lastUpdated: new Date().toISOString()
      });
      setMaintenanceMode(!maintenanceMode);
      setError(null);
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      setError("Failed to toggle maintenance mode");
    }
  };

  const addWhitelistedEmail = async () => {
    if (!newEmail || whitelistedEmails.includes(newEmail)) return;
    try {
      const maintenanceRef = doc(db, "system", "maintenance");
      const updatedEmails = [...whitelistedEmails, newEmail];
      await setDoc(maintenanceRef, {
        enabled: maintenanceMode,
        whitelistedEmails: updatedEmails,
        lastUpdated: new Date().toISOString()
      });
      setWhitelistedEmails(updatedEmails);
      setNewEmail("");
      setError(null);
    } catch (error) {
      console.error("Error adding email to whitelist:", error);
      setError("Failed to add email to whitelist");
    }
  };

  const removeWhitelistedEmail = async (emailToRemove: string) => {
    try {
      const maintenanceRef = doc(db, "system", "maintenance");
      const updatedEmails = whitelistedEmails.filter(email => email !== emailToRemove);
      await setDoc(maintenanceRef, {
        enabled: maintenanceMode,
        whitelistedEmails: updatedEmails,
        lastUpdated: new Date().toISOString()
      });
      setWhitelistedEmails(updatedEmails);
      setError(null);
    } catch (error) {
      console.error("Error removing email from whitelist:", error);
      setError("Failed to remove email from whitelist");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const firestoreUsers: AdminUser[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        firestoreUsers.push({
          uid: doc.id,
          displayName: data.displayName || "Unknown User",
          email: data.email || "",
          joinDate: data.createdAt || new Date().toISOString(),
          lastOnlineDate: data.lastLogin || null,
          testsRun: data.testsRun || 0,
          accountState: data.accountState || "enabled",
          role: data.role || "user",
          photoURL: data.photoURL
        });
      });
      setUsers(firestoreUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      setError("Error loading user data. Using demo data.");
      const fallbackUsers: AdminUser[] = agents.map((agent, index) => ({
        uid: agent.agent_id,
        displayName: agent.full_name,
        email: agent.email,
        joinDate: agent.start_date,
        lastOnlineDate: new Date().toISOString(),
        testsRun: Math.floor(agent.minutes_called / 10),
        accountState: agent.registered ? "enabled" : "disabled",
        role: index < 3 ? "admin" : index < 10 ? "moderator" : "user"
      }));
      setUsers(fallbackUsers);
    } finally {
      setLoading(false);
    }
  };

  // Bulk actions for selected users
  const handleBulkDisable = async () => {
    try {
      const selectedIndices = Object.keys(rowSelection);
      const selectedUsers = selectedIndices.map(index => users[parseInt(index)]);

      for (const user of selectedUsers) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { accountState: "disabled" });
      }

      loadUsers();
      setRowSelection({});
    } catch (error) {
      console.error("Error disabling users:", error);
      setError("Failed to disable selected users");
    }
  };

  const handleBulkRoleChange = async (newRole: "user" | "moderator" | "admin") => {
    try {
      const selectedIndices = Object.keys(rowSelection);
      const selectedUsers = selectedIndices.map(index => users[parseInt(index)]);

      for (const user of selectedUsers) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { role: newRole });
      }

      loadUsers();
      setRowSelection({});
    } catch (error) {
      console.error("Error updating user roles:", error);
      setError("Failed to update roles for selected users");
    }
  };

  const columns = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <IndeterminateCheckbox
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler(),
          }}
          className="-translate-y-[1px]"
        />
      ),
      cell: ({ row }) => (
        <IndeterminateCheckbox
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
          className="-translate-y-[1px]"
        />
      ),
      enableSorting: false,
      meta: {
        align: 'text-left',
      },
    },
    {
      accessorKey: "displayName",
      header: "Name",
      enableSorting: true,
      meta: {
        align: 'text-left',
      },
      cell: ({ row }) => {
        const user = row.original as AdminUser
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
      header: "Email",
      enableSorting: true,
      meta: {
        align: 'text-left',
      }
    },
    {
      accessorKey: "joinDate",
      header: "Join Date",
      enableSorting: true,
      meta: {
        align: 'text-left',
      },
      cell: ({ row }) => {
        const joinDate = new Date(row.getValue("joinDate"))
        return <span>{joinDate.toLocaleDateString()}</span>
      }
    },
    {
      accessorKey: "lastOnlineDate",
      header: "Last Online",
      enableSorting: true,
      meta: {
        align: 'text-left',
      },
      cell: ({ row }) => {
        const lastOnlineDate = row.getValue("lastOnlineDate") as string | null
        if (!lastOnlineDate) return <span>Never</span>
        const date = new Date(lastOnlineDate)
        const today = new Date()
        const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 0) return <span>Today</span>
        if (diffDays === 1) return <span>Yesterday</span>
        return <span>{diffDays} days ago</span>
      }
    },
    {
      accessorKey: "testsRun",
      header: "Tests Run",
      enableSorting: true,
      meta: {
        align: 'text-left',
      }
    },
    {
      accessorKey: "accountState",
      header: "Status",
      enableSorting: true,
      meta: {
        align: 'text-left',
      },
      cell: ({ row }) => {
        const status = row.getValue("accountState") as string
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === "enabled"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500"
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        )
      }
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: {
        align: 'text-right',
      },
      cell: ({ row }) => {
        const user = row.original as AdminUser;
        const handleRoleChange = async (newRole: string) => {
          try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { role: newRole });
            loadUsers();
          } catch (error) {
            console.error("Error updating role:", error);
            setError("Failed to update user role");
          }
        };
        const handleStatusChange = async () => {
          try {
            const userRef = doc(db, "users", user.uid);
            const newState = user.accountState === "enabled" ? "disabled" : "enabled";
            await updateDoc(userRef, { accountState: newState });
            loadUsers();
          } catch (error) {
            console.error("Error updating status:", error);
            setError("Failed to update account status");
          }
        };
        return (
          <div className="flex gap-2 justify-end">
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStatusChange}
              className="h-8"
            >
              {user.accountState === "enabled" ? "Disable" : "Enable"}
            </Button>
          </div>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: users,
    columns,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      rowSelection,
    },
  });

  return (
    <main className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Admin Panel
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
            Manage users, permissions, and system status
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={maintenanceMode ? "destructive" : "secondary"}
            onClick={toggleMaintenanceMode}
            className="flex items-center gap-2"
          >
            <RiShieldLine className="size-4" />
            {maintenanceMode ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
          </Button>
          <Button
            variant="outline"
            onClick={() => loadUsers()}
            className="flex items-center gap-1"
          >
            <RiRefreshLine className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {maintenanceMode && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
          <h3 className="font-medium text-blue-900 dark:text-blue-200">Whitelist Configuration</h3>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              placeholder="Add email to whitelist"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 rounded-md border border-blue-200 bg-white px-3 py-1 text-sm placeholder:text-blue-400 dark:border-blue-900/50 dark:bg-blue-900/30 dark:placeholder:text-blue-500"
            />
            <Button variant="secondary" onClick={addWhitelistedEmail} size="sm">
              Add Email
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {whitelistedEmails.map((email) => (
              <div
                key={email}
                className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {email}
                <button
                  onClick={() => removeWhitelistedEmail(email)}
                  className="text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Divider className="my-4" />

      {error && (
        <div className="my-4 flex items-center gap-2 rounded-md bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/10 dark:text-amber-500">
          <RiInformationLine className="size-4" />
          <p>{error}</p>
        </div>
      )}

      <section className="mt-8 relative">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/10 border-t-gray-900 dark:border-gray-50/10 dark:border-t-gray-50"></div>
          </div>
        ) : (
          <div className="relative">
            <Table>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-b border-tremor-border dark:border-dark-tremor-border"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHeaderCell
                        key={header.id}
                        className={classNames(header.column.columnDef.meta.align)}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </TableHeaderCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => row.toggleSelected(!row.getIsSelected())}
                    className="select-none hover:bg-tremor-background-muted hover:dark:bg-dark-tremor-background-muted"
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        className={classNames(
                          row.getIsSelected()
                            ? 'bg-tremor-background-muted dark:bg-dark-tremor-background-muted'
                            : '',
                          cell.column.columnDef.meta.align,
                          'relative',
                        )}
                      >
                        {index === 0 && row.getIsSelected() && (
                          <div className="absolute inset-y-0 left-0 w-0.5 bg-tremor-brand dark:bg-dark-tremor-brand" />
                        )}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFoot>
                <TableRow>
                  <TableHeaderCell colSpan={1}>
                    <IndeterminateCheckbox
                      {...{
                        checked: table.getIsAllPageRowsSelected(),
                        indeterminate: table.getIsSomePageRowsSelected(),
                        onChange: table.getToggleAllPageRowsSelectedHandler(),
                      }}
                      className="-translate-y-[1px]"
                    />
                  </TableHeaderCell>
                  <TableHeaderCell colSpan={7} className="font-normal tabular-nums">
                    {Object.keys(rowSelection).length} of{' '}
                    {table.getRowModel().rows.length} Page Row(s) selected
                  </TableHeaderCell>
                </TableRow>
              </TableFoot>
            </Table>

            <div
              className={classNames(
                'absolute inset-x-0 -bottom-14 mx-auto flex w-fit items-center space-x-10 rounded-tremor-default border border-tremor-border bg-tremor-background p-2 shadow-tremor-dropdown dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:shadow-dark-tremor-dropdown',
                Object.keys(rowSelection).length > 0 ? '' : 'hidden',
              )}
            >
              <p className="select-none text-tremor-default">
                <span className="rounded bg-tremor-brand-faint px-2 py-1.5 font-medium tabular-nums text-tremor-brand-emphasis dark:bg-dark-tremor-brand-faint dark:text-dark-tremor-brand-emphasis">
                  {Object.keys(rowSelection).length}
                </span>
                <span className="ml-2 font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  selected
                </span>
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleBulkRoleChange("moderator")}
                  className="inline-flex items-center rounded bg-tremor-brand px-2 py-1.5 text-tremor-default font-semibold"
                >
                  Make Moderators
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBulkDisable}
                  className="inline-flex items-center rounded px-2 py-1.5 text-tremor-default font-semibold"
                >
                  Disable All
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}