"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Prepends an option with an empty value, shown when nothing is selected. */
  emptyOption?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  id?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** @deprecated Search now happens in the trigger input. Kept for API compatibility. */
  searchable?: boolean;
};

export function SelectCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  emptyOption,
  className,
  triggerClassName,
  disabled,
  id,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
}: SelectComboboxProps) {
  const allOptions = React.useMemo(() => {
    if (emptyOption !== undefined) {
      return [{ value: "", label: emptyOption }, ...options];
    }
    return options;
  }, [options, emptyOption]);

  const selectedItem =
    allOptions.find((option) => option.value === value) ??
    (emptyOption !== undefined ? allOptions[0] : null);

  return (
    <Combobox
      items={allOptions}
      value={selectedItem}
      onValueChange={(item) => onValueChange(item?.value ?? "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(option) => option.label}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        disabled={disabled}
        placeholder={placeholder ?? searchPlaceholder ?? emptyOption ?? "Select..."}
        className={cn(
          "w-full rounded-lg bg-background shadow-sm transition-colors hover:border-foreground/40",
          triggerClassName,
          className
        )}
      />
      <ComboboxContent className="min-w-[var(--anchor-width)]">
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value || "__empty__"} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
