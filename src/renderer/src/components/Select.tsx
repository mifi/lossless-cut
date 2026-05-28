import type { ChangeEvent, ReactElement, ReactNode, SelectHTMLAttributes, WheelEvent } from 'react';
import { Children, forwardRef, isValidElement, memo, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FaCheck } from 'react-icons/fa';
import { IoChevronDown } from 'react-icons/io5';

import styles from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

interface OptionItem {
  disabled: boolean;
  key: string;
  label: ReactNode;
  value: string;
}

interface OptionGroup {
  key: string;
  label?: ReactNode;
  options: OptionItem[];
}

function nodeToText(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (isValidElement(child)) return nodeToText(child.props.children);
    return '';
  }).join('');
}

function parseOption(element: ReactElement, index: number): OptionItem | undefined {
  if (element.type !== 'option') return undefined;

  const { children, disabled = false, value } = element.props;
  const optionValue = value != null ? String(value) : nodeToText(children);

  return {
    disabled,
    key: element.key != null ? String(element.key) : `option-${index}-${optionValue}`,
    label: children,
    value: optionValue,
  };
}

function parseChildren(children: ReactNode): OptionGroup[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement(child)) return [];

    if (child.type === 'optgroup') {
      const options = Children.toArray(child.props.children).flatMap((optionChild, optionIndex) => {
        if (!isValidElement(optionChild)) return [];
        const option = parseOption(optionChild, optionIndex);
        return option != null ? [option] : [];
      });

      if (options.length === 0) return [];

      return [{
        key: child.key != null ? String(child.key) : `group-${index}`,
        label: child.props.label,
        options,
      }];
    }

    const option = parseOption(child, index);
    return option != null ? [{
      key: `group-${index}`,
      options: [option],
    }] : [];
  });
}

const Select = memo(forwardRef<HTMLSelectElement, SelectProps>(({
  children,
  className,
  defaultValue,
  disabled = false,
  id,
  name,
  onBlur,
  onChange,
  onFocus,
  required,
  style,
  tabIndex,
  title,
  value,
}, forwardedRef) => {
  const hiddenSelectRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const triggerStyle = useMemo(() => ({
    height: style?.height,
    minHeight: style?.minHeight,
    maxHeight: style?.maxHeight,
  }), [style]);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => {
    if (value != null) return String(value);
    if (defaultValue == null || Array.isArray(defaultValue)) return '';
    return String(defaultValue);
  });

  useImperativeHandle(forwardedRef, () => hiddenSelectRef.current!, []);

  const groups = useMemo(() => parseChildren(children), [children]);
  const options = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const currentValue = value != null ? String(value) : uncontrolledValue;
  const selectedOption = options.find((option) => option.value === currentValue) ?? options[0];
  const isDisabled = disabled || options.length === 0;

  const handleValueChange = (nextValue: string) => {
    if (isDisabled || nextValue === currentValue) return;

    if (value == null) setUncontrolledValue(nextValue);
    if (hiddenSelectRef.current != null) hiddenSelectRef.current.value = nextValue;

    const target = hiddenSelectRef.current ?? Object.assign(document.createElement('select'), {
      value: nextValue,
      blur: () => triggerRef.current?.blur(),
    });

    onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
    triggerRef.current?.blur();
  };

  const handleViewportWheelCapture = (event: WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (viewport == null || viewport.scrollHeight <= viewport.clientHeight) return;
    event.stopPropagation();
  };

  return (
    <div className={styles['container']} style={style}>
      {/* Keep a native select in the DOM for refs and form compatibility without exposing the Windows popup. */}
      <select
        aria-hidden="true"
        className={styles['hiddenSelect']}
        defaultValue={value == null ? defaultValue : undefined}
        id={id}
        name={name}
        onChange={undefined}
        ref={hiddenSelectRef}
        required={required}
        tabIndex={-1}
        value={value != null ? currentValue : undefined}
      >
        {children}
      </select>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            aria-disabled={isDisabled}
            className={[styles['select'], ...(className ? [className] : [])].join(' ')}
            disabled={isDisabled}
            onBlur={onBlur}
            onFocus={onFocus}
            ref={triggerRef}
            style={triggerStyle}
            tabIndex={tabIndex}
            title={title}
            type="button"
          >
            <span className={styles['value']}>{selectedOption?.label}</span>
            <IoChevronDown aria-hidden="true" className={styles['icon']} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal container={document.getElementById('app-root')!}>
          <DropdownMenu.Content align="start" className={styles['content']} sideOffset={6}>
            <div className={styles['viewport']} onWheelCapture={handleViewportWheelCapture} ref={viewportRef}>
              {groups.map((group, groupIndex) => (
                <div className={styles['group']} key={group.key}>
                  {group.label != null ? <div className={styles['groupLabel']}>{group.label}</div> : null}
                  {group.options.map((option) => (
                    <DropdownMenu.Item
                      className={[
                        styles['item'],
                        option.value === currentValue ? styles['itemSelected'] : '',
                      ].filter(Boolean).join(' ')}
                      disabled={option.disabled}
                      key={option.key}
                      onSelect={() => handleValueChange(option.value)}
                    >
                      <span className={styles['itemLabel']}>{option.label}</span>
                      {option.value === currentValue ? <FaCheck aria-hidden="true" className={styles['check']} /> : null}
                    </DropdownMenu.Item>
                  ))}
                  {groupIndex < groups.length - 1 ? <DropdownMenu.Separator className={styles['separator']} /> : null}
                </div>
              ))}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}));

export default Select;
