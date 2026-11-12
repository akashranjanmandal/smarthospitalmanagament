"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FormSelect({ options, value, onValueChange, placeholder }) {
  const [internalValue, setInternalValue] = useState(value || "");

  useEffect(() => {
    setInternalValue(value || "");
  }, [value]);

  const handleChange = (val) => {
    setInternalValue(val);
    onValueChange?.(val);
  };

  const selectedLabel = options.find((o) => o.value === internalValue)?.label;

  return (
    <Select value={internalValue} onValueChange={handleChange}>
      <SelectTrigger className="w-full h-12 rounded-xl bg-background/50 border-border/60 focus:ring-2 focus:ring-primary/30 font-medium text-sm transition-all hover:bg-background">
        <SelectValue placeholder={placeholder}>
          {selectedLabel || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-2xl shadow-xl border-border/40 p-1">
        {options.map((option) => (
          <SelectItem 
            key={option.value || "empty"} 
            value={option.value || "empty"}
            className="rounded-xl font-medium cursor-pointer py-2.5 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}