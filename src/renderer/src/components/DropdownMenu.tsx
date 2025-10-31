import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import styles from './DropdownMenu.module.css';
import { withClass } from './util';

export * from '@radix-ui/react-dropdown-menu';

export const Content = withClass(DropdownMenu.Content, styles['DropdownMenuContent']!);

export const Item = withClass(DropdownMenu.Item, styles['DropdownMenuItem']!);

export const Arrow = withClass(DropdownMenu.Arrow, styles['DropdownMenuArrow']!);

export const Separator = withClass(DropdownMenu.Separator, styles['DropdownMenuSeparator']!);

// eslint-disable-next-line react/jsx-props-no-spreading
export const Portal = (props: DropdownMenu.DropdownMenuPortalProps) => <DropdownMenu.Portal container={document.getElementById('app-root')!} {...props} />;
