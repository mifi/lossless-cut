import type { FormEventHandler, KeyboardEventHandler } from 'react';
import { memo, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuChevronDown, LuClipboard, LuClipboardList, LuCopy, LuCopyPlus, LuInfo, LuPencil, LuPlus, LuTrash2, LuUndo2 } from 'react-icons/lu';
import invariant from 'tiny-invariant';
import { motion } from 'motion/react';
import { IconButton, Tooltip, Button, TextArea, DropdownMenu } from '@radix-ui/themes';

import type { SegmentTags } from '../types';
import { segmentTagsSchema } from '../types';
import CopyClipboardButton from './CopyClipboardButton';
import { errorToast } from '../swal';
import Warning from './Warning';
import mainApi from '../mainApi';
import type { Suggestion } from './SuggestionTextField';
import SuggestionTextField from './SuggestionTextField';


const activeColor = 'var(--gray-12)';

const emptyObject = {};

export type TagInfo = Record<string, {
  description?: string,
  url?: string,
  suggestions?: Suggestion[],
  multiline?: boolean,
  // returns an error message if invalid
  validate?: (value: string) => string | undefined,
}>;

// For the containing dialog's `onEscapeKeyDown`: Esc discards the unsaved edit instead of closing the dialog.
// Handled at the dialog level so that it also works when the input doesn't have focus (or is not mounted, e.g. another tab)
export const cancelTagEditOnEscape = (editingTag: string | undefined, setEditingTag: (v: string | undefined) => void) => (e: KeyboardEvent) => {
  if (editingTag == null) return;
  e.preventDefault();
  setEditingTag(undefined);
};

function TagEditor({ existingTags = emptyObject, customTags = emptyObject, editingTag, setEditingTag, onTagsChange, onTagReset, addTagTitle, tagInfo, keySuggestions, canDeleteExisting, onApplyToAll, applyToAllTitle, copyFromSources = [] }: {
  existingTags?: SegmentTags,
  customTags?: SegmentTags | undefined,
  editingTag: string | undefined,
  setEditingTag: (v: string | undefined) => void,
  onTagsChange: (keyValues: Record<string, string>) => void,
  onTagReset: (tag: string) => void,
  addTagTitle: string,
  tagInfo?: TagInfo,
  keySuggestions?: readonly string[],
  canDeleteExisting?: boolean,
  onApplyToAll?: ((tag: string, value: string) => void) | undefined,
  applyToAllTitle?: string,
  // other tracks/files to copy metadata from
  copyFromSources?: { key: string, label: string, metadata: Record<string, string> }[],
}) {
  const { t } = useTranslation();
  const editRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const addRef = useRef<HTMLInputElement>(null);

  const [editingTagVal, setEditingTagVal] = useState<string>();
  const [newTagKeyState, setNewTagKey] = useState<string>();
  // the edit can also be discarded from outside (see cancelTagEditOnEscape), so only use it while editing
  const newTagKey = editingTag != null ? newTagKeyState : undefined;
  const [newTagKeyInput, setNewTagKeyInput] = useState<string>('');

  const newTagKeyInputError = useMemo(() => !!newTagKeyInput && newTagKeyInput.includes('='), [newTagKeyInput]);

  const effectiveTags = useMemo(() => ({
    ...existingTags,
    ...customTags,
    ...(newTagKey && { [newTagKey]: '' }),
  }), [customTags, existingTags, newTagKey]);

  const onResetClick = useCallback(() => {
    invariant(editingTag != null);
    onTagReset(editingTag);
    setEditingTag(undefined);
    setNewTagKey(undefined);
  }, [editingTag, onTagReset, setEditingTag]);

  const onPasteClick = useCallback(async () => {
    const text = await mainApi.readClipboardText();
    try {
      const json = JSON.parse(text);
      const newTags = segmentTagsSchema.parse(json);
      onTagsChange(newTags);
    } catch (e) {
      if (e instanceof Error) errorToast(e.message);
    }
  }, [onTagsChange]);

  // Only the keys that differ, so unchanged tags aren't shown as edited.
  // A copied value equal to the original resets the user's edit instead
  const onCopyFrom = useCallback((metadata: Record<string, string>) => {
    const changes = Object.entries(metadata).filter(([key, value]) => effectiveTags[key] !== value);
    changes.filter(([key, value]) => existingTags[key] === value).forEach(([key]) => onTagReset(key));
    onTagsChange(Object.fromEntries(changes.filter(([key, value]) => existingTags[key] !== value)));
  }, [effectiveTags, existingTags, onTagReset, onTagsChange]);

  const saveTag = useCallback(() => {
    invariant(editingTag != null);
    invariant(editingTagVal != null);
    onTagsChange({ [editingTag]: editingTagVal });
    setEditingTag(undefined);
  }, [editingTag, editingTagVal, onTagsChange, setEditingTag]);

  const onEditClick = useCallback((tag?: string) => {
    if (newTagKey) {
      saveTag();
      setNewTagKey(undefined);
    } else if (editingTag != null) {
      if (editingTagVal !== existingTags[editingTag]) {
        saveTag();
      } else { // If not actually changed, no need to update
        onResetClick();
      }
    } else {
      setEditingTag(tag);
      setEditingTagVal(tag && String(effectiveTags[tag]));
    }
  }, [editingTag, editingTagVal, existingTags, effectiveTags, newTagKey, onResetClick, saveTag, setEditingTag]);

  // Ctrl/Cmd+Enter saves (needed for multiline)
  const onEditKeyDown = useCallback<KeyboardEventHandler>((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onEditClick();
    }
  }, [onEditClick]);

  const onDeleteExistingClick = useCallback((tag: string) => {
    onTagsChange({ [tag]: '' }); // empty string means delete metadata in ffmpeg
    setEditingTag(undefined);
  }, [onTagsChange, setEditingTag]);

  const onSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
    e.preventDefault();
    onEditClick();
  }, [onEditClick]);

  const add = useCallback(() => {
    if (newTagKey || editingTag != null) {
      // save any unsaved edit
      onEditClick();
      return;
    }

    if (!newTagKeyInput || newTagKeyInputError || Object.keys(effectiveTags).includes(newTagKeyInput)) return;
    setEditingTag(newTagKeyInput);
    setEditingTagVal('');
    setNewTagKey(newTagKeyInput);
    setNewTagKeyInput('');
  }, [editingTag, effectiveTags, newTagKey, newTagKeyInput, newTagKeyInputError, onEditClick, setEditingTag]);

  const onAddSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
    e.preventDefault();
    add();
  }, [add]);

  useEffect(() => {
    (editingTag != null ? editRef : addRef).current?.focus();
  }, [editingTag]);

  const editingTagError = editingTag != null && editingTagVal ? tagInfo?.[editingTag]?.validate?.(editingTagVal) : undefined;

  const availableKeySuggestions = useMemo(() => (keySuggestions ?? []).filter((key) => effectiveTags[key] == null).map((value) => ({ value })), [effectiveTags, keySuggestions]);

  const canAdd = !newTagKey && (editingTag == null || effectiveTags[editingTag] == null);

  function renderValue({ isDeletedExisting, value, thisTagCustom }: {
    isDeletedExisting: boolean,
    value: string | undefined,
    thisTagCustom: boolean,
  }) {
    const emphasized = thisTagCustom || isDeletedExisting;
    const color = isDeletedExisting ? 'var(--red-10)' : (emphasized ? activeColor : 'var(--gray-11)');
    const displayValue = isDeletedExisting ? `<${t('deleted')}>` : (value ? String(value) : `<${t('empty')}>`);
    return (
      <span style={{ marginRight: '.5em', padding: '.3em 0', fontWeight: emphasized ? 'bold' : undefined, color }}>
        {displayValue}
      </span>
    );
  }

  return (
    <>
      <table style={{ marginBottom: '1em', width: '100%' }}>
        <tbody>
          {Object.keys(effectiveTags).map((tag) => {
            const editingThis = tag === editingTag;
            const thisTagCustom = customTags[tag] != null;
            const thisTagNew = existingTags[tag] == null;
            const value = effectiveTags[tag];
            const isDeletedExisting = !!canDeleteExisting && !value && !thisTagNew;
            const editingOther = editingTag != null && !editingThis;

            return (
              <motion.tr
                transition={{ duration: 0.2 }}
                layout
                key={tag}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <td style={{ paddingRight: '1em', color: thisTagNew ? activeColor : 'var(--gray-11)' }}>{tag}</td>

                <td style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.5em' }}>
                  {editingThis ? (
                    <form style={{ marginRight: '.5em', display: 'inline' }} onSubmit={onSubmit}>
                      {tagInfo?.[tag]?.multiline || editingTagVal?.includes('\n') ? (
                        <TextArea ref={editRef} placeholder={t('Enter value')} value={editingTagVal ?? ''} onChange={(e) => setEditingTagVal(e.target.value)} onKeyDown={onEditKeyDown} resize="vertical" style={{ width: '20em' }} />
                      ) : (
                        <SuggestionTextField ref={editRef} placeholder={t('Enter value')} value={editingTagVal ?? ''} onValueChange={setEditingTagVal} onKeyDown={onEditKeyDown} suggestions={tagInfo?.[tag]?.suggestions ?? []} />
                      )}
                    </form>
                  ) : (
                    renderValue({ isDeletedExisting, value, thisTagCustom })
                  )}

                  {tagInfo?.[tag]?.description && !editingThis && (
                    <Tooltip content={tagInfo[tag].description}>
                      <IconButton size="1" variant="ghost" color="gray" style={{ cursor: tagInfo[tag]?.url ? 'pointer' : undefined }} onClick={() => tagInfo[tag]?.url && mainApi.openExternal(tagInfo[tag].url)}><LuInfo /></IconButton>
                    </Tooltip>
                  )}

                  <IconButton disabled={editingOther} size="1" variant="ghost" color={editingThis ? 'violet' : 'gray'} title={t('Edit')} onClick={() => onEditClick(tag)}>{editingThis ? <LuCheck /> : <LuPencil />}</IconButton>

                  {editingThis && thisTagNew && (
                    <IconButton size="1" color="red" variant="ghost" title={t('Delete')} onClick={onResetClick}><LuTrash2 /></IconButton>
                  )}

                  {editingThis && !thisTagNew && (
                    <IconButton size="1" color="red" variant="ghost" title={t('Reset')} onClick={onResetClick}><LuUndo2 /></IconButton>
                  )}

                  {onApplyToAll && !editingThis && (
                    <IconButton disabled={editingOther} size="1" variant="ghost" color="gray" title={applyToAllTitle} onClick={() => onApplyToAll(tag, value ?? '')}><LuCopyPlus /></IconButton>
                  )}

                  {canDeleteExisting && !isDeletedExisting && !editingThis && existingTags[tag] != null && (
                    <IconButton disabled={editingOther} size="1" color="red" variant="ghost" title={t('Delete')} onClick={() => onDeleteExistingClick(tag)}><LuTrash2 /></IconButton>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      {editingTagError && <Warning style={{ marginBottom: '1em' }}>{editingTagError}</Warning>}

      <form onSubmit={onAddSubmit} style={{ opacity: canAdd ? undefined : 0.5, marginBottom: '1em', display: 'flex', alignItems: 'center' }}>
        <SuggestionTextField ref={addRef} disabled={!canAdd} value={newTagKeyInput} onValueChange={setNewTagKeyInput} suggestions={availableKeySuggestions} placeholder={addTagTitle} style={{ marginRight: '1em' }} />
        <IconButton size="2" type="submit" disabled={!canAdd} title={addTagTitle} onClick={add}><LuPlus /></IconButton>
      </form>

      {newTagKeyInputError && <Warning>{t('Invalid character(s) found in key')}</Warning>}

      <div style={{ marginBottom: '1em', display: 'flex', alignItems: 'center' }}>
        <CopyClipboardButton text={JSON.stringify(effectiveTags, null, 2)} style={{ marginRight: '.3em', verticalAlign: 'middle' }}>
          {({ onClick }) => <Button color="gray" variant="soft" radius="full" size="1" onClick={onClick}><LuClipboardList />{t('Copy to clipboard')}</Button>}
        </CopyClipboardButton>

        <Button color="gray" variant="soft" radius="full" size="1" disabled={editingTag != null} onClick={onPasteClick} style={{ marginRight: '.3em' }}><LuClipboard />{t('Paste')}</Button>

        {copyFromSources.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger disabled={editingTag != null}>
              <Button color="gray" variant="soft" radius="full" size="1"><LuCopy />{t('Copy from')}<LuChevronDown /></Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content size="1" style={{ maxHeight: '20em' }}>
              {copyFromSources.map(({ key, label, metadata }) => (
                <DropdownMenu.Item key={key} onSelect={() => onCopyFrom(metadata)}>{label}</DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>
    </>
  );
}

export default memo(TagEditor);
