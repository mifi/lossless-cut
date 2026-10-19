import type { ComponentProps } from 'react';
import { useImperativeHandle, useRef } from 'react';
import { DropdownMenu, IconButton, TextField } from '@radix-ui/themes';
import { FaChevronDown } from 'react-icons/fa';


export interface Suggestion {
  value: string,
  label?: string,
}

// A text field with a dropdown of suggested values (Radix Themes has no combobox)
export default function SuggestionTextField({ ref, suggestions, onValueChange, disabled, ...props }: Omit<ComponentProps<typeof TextField.Root>, 'onChange'> & {
  suggestions: Suggestion[],
  onValueChange: (value: string) => void,
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <TextField.Root {...props} ref={inputRef} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      {suggestions.length > 0 && (
        <TextField.Slot side="right">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger disabled={disabled}>
              <IconButton type="button" size="1" variant="ghost" color="gray"><FaChevronDown /></IconButton>
            </DropdownMenu.Trigger>
            {/* Focus the input (not the trigger) after selecting, so that Enter submits */}
            <DropdownMenu.Content size="1" style={{ maxHeight: '20em' }} onCloseAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
              {suggestions.map(({ value, label }) => (
                <DropdownMenu.Item key={value} onSelect={() => onValueChange(value)}>{label ?? value}</DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </TextField.Slot>
      )}
    </TextField.Root>
  );
}
