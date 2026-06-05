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
  ComboboxTrigger,
  ComboboxValue,
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
  /** Show a search field inside the popup. Defaults to true when there are more than 6 options. */
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
  searchable,
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

  const showSearch = searchable ?? allOptions.length > 6;

  return (
    <Combobox
      items={allOptions}
      value={selectedItem}
      onValueChange={(item) => onValueChange(item?.value ?? "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxTrigger
        id={id}
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors hover:border-foreground/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
              triggerClassName,
              className
            )}
          />
        }
      >
        <ComboboxValue placeholder={placeholder ?? emptyOption ?? "Select..."} />
      </ComboboxTrigger>
      <ComboboxContent className="min-w-[var(--anchor-width)]">
        {showSearch && (
          <ComboboxInput showTrigger={false} placeholder={searchPlaceholder} />
        )}
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
