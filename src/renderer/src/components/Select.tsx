import type { ChangeEvent, ReactElement, ReactNode, SelectHTMLAttributes } from 'react';
import { Children, isValidElement, memo, useCallback, useMemo, useRef } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { LuCheck, LuChevronDown, LuChevronUp } from 'react-icons/lu';

import styles from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Radix doesn't allow '' as an item value, but we use it as a real value in some places (e.g. "System language")
const emptyValue = '__llc-empty__';
const toInternal = (v: string) => (v === '' ? emptyValue : v);
const toExternal = (v: string) => (v === emptyValue ? '' : v);

interface Item { value: string, label: ReactNode, disabled: boolean }

// items before the first heading go in a section without heading
interface Section { heading?: string, items: Item[] }

const getText = (node: ReactNode): string => Children.toArray(node).map((n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : '')).join('');

// Drop-in replacement for a native <select> with <option> children, drawn with our own styled popup.
// A disabled option with value '' is the placeholder, and disabled "--- Heading ---" options become group headings.
function Select({ value, onChange, disabled, title, style, children, className, onMouseMove }: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const blurRequestedRef = useRef(false);

  const { sections, placeholder } = useMemo(() => {
    const ret: Section[] = [{ items: [] }];
    let placeholderText: ReactNode;
    Children.forEach(children, (child) => {
      if (!isValidElement(child) || child.type !== 'option') return;
      const { props } = child as ReactElement<{ value?: string | number, disabled?: boolean, children?: ReactNode }>;
      const text = getText(props.children).trim();
      const optionValue = props.value != null ? String(props.value) : text;
      if (props.disabled && optionValue === '') {
        if (/^-+.*-+$/.test(text)) ret.push({ heading: text.replaceAll(/^-+\s*|\s*-+$/g, ''), items: [] });
        else placeholderText ??= props.children;
        return;
      }
      ret.at(-1)!.items.push({ value: toInternal(optionValue), label: props.children, disabled: !!props.disabled });
    });
    return { sections: ret.filter((section) => section.items.length > 0), placeholder: placeholderText };
  }, [children]);

  const internalValue = value == null ? undefined : toInternal(String(value));
  const hasMatch = sections.some((section) => section.items.some((item) => item.value === internalValue));

  const handleValueChange = useCallback((newValue: string) => {
    if (onChange == null) return;
    // callers only use target.value, and blur() (via withBlur) to give keyboard shortcuts back to the app
    const target = {
      value: toExternal(newValue),
      blur: () => {
        blurRequestedRef.current = true;
        triggerRef.current?.blur();
      },
    };
    onChange({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
  }, [onChange]);

  // Radix moves focus back to the trigger after closing, which would undo the blur
  const handleCloseAutoFocus = useCallback((e: Event) => {
    if (!blurRequestedRef.current) return;
    blurRequestedRef.current = false;
    e.preventDefault();
    triggerRef.current?.blur();
  }, []);

  return (
    <RadixSelect.Root value={hasMatch ? internalValue : ''} onValueChange={handleValueChange} disabled={disabled}>
      <RadixSelect.Trigger ref={triggerRef} className={[styles['trigger'], ...(className ? [className] : [])].join(' ')} style={style} title={title} onMouseMove={onMouseMove as never}>
        <span className={styles['value']}>
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className={styles['chevron']}>
          <LuChevronDown />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal container={document.getElementById('app-root')}>
        <RadixSelect.Content className={styles['content']} position="popper" sideOffset={6} collisionPadding={10} onCloseAutoFocus={handleCloseAutoFocus}>
          <RadixSelect.ScrollUpButton className={styles['scrollButton']}>
            <LuChevronUp />
          </RadixSelect.ScrollUpButton>

          <RadixSelect.Viewport className={styles['viewport']}>
            {sections.map(({ heading, items }, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <RadixSelect.Group key={i}>
                {heading != null && <RadixSelect.Label className={styles['heading']}>{heading}</RadixSelect.Label>}

                {items.map((item) => (
                  <RadixSelect.Item key={item.value} value={item.value} disabled={item.disabled} className={styles['item']}>
                    <RadixSelect.ItemIndicator className={styles['indicator']}>
                      <LuCheck />
                    </RadixSelect.ItemIndicator>
                    <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Group>
            ))}
          </RadixSelect.Viewport>

          <RadixSelect.ScrollDownButton className={styles['scrollButton']}>
            <LuChevronDown />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export default memo(Select);
