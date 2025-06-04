"use client";
import React, { useEffect } from 'react';
import { useRouter } from "next/navigation";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-muted-foreground  rounded-full border-t-transparent"></div>
    </div>
  );
}

