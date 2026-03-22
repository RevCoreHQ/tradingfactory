"use client";

import { SpecialText } from "@/components/ui/special-text";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black">
      <SpecialText className="text-2xl md:text-4xl text-black dark:text-white">
        Welcome to Trading Factory
      </SpecialText>
    </div>
  );
}
