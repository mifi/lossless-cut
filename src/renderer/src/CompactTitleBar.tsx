import type { MouseEvent } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { TopMenuId } from '../../main/menu.js';
import mainApi from './mainApi';
import styles from './CompactTitleBar.module.css';


// Merges the OS title bar and the native application menu into a single compact row (similar to
// VS Code), used when the "Compact title bar" setting is enabled (Windows/Linux only, see
// createWindow() in src/main/index.ts). The buttons below don't reimplement the menu contents -
// clicking one pops the *existing* native menu (built in src/main/menu.ts) positioned under the
// button, so shortcuts/behavior stay identical to the normal always-visible menu bar.
// https://github.com/mifi/lossless-cut/issues/798
const topMenuIds: TopMenuId[] = ['file', 'edit', 'segments', 'view', 'tools', 'help'];

function CompactTitleBar({ title }: { title: string }) {
  const { t } = useTranslation();

  const labels: Record<TopMenuId, string> = {
    file: t('File'),
    edit: t('Edit'),
    segments: t('Segments'),
    view: t('View'),
    tools: t('Tools'),
    help: t('Help'),
  };

  async function onMenuButtonClick(id: TopMenuId, e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    await mainApi.popupAppMenu(id, Math.round(rect.left), Math.round(rect.bottom));
  }

  return (
    <div className={styles['wrapper']}>
      <div className={styles['menuButtons']}>
        {topMenuIds.map((id) => (
          <button
            key={id}
            type="button"
            className={styles['menuButton']}
            onClick={(e) => onMenuButtonClick(id, e)}
          >
            {labels[id]}
          </button>
        ))}
      </div>

      <div className={styles['title']}>{title}</div>

      {/* Reserves space so the title text doesn't run under the native minimize/maximize/close
          buttons that Electron's Window Controls Overlay draws on top of this row. */}
      <div className={styles['controlsSpacer']} />
    </div>
  );
}

export default memo(CompactTitleBar);
