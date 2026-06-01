import type { FormEventHandler } from 'react';
import { memo, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import invariant from 'tiny-invariant';
import { motion } from 'motion/react';
import { FaCheck, FaClipboard, FaClipboardList, FaEdit, FaInfo, FaPlus, FaTrash, FaUndo } from 'react-icons/fa';
import { IconButton, Tooltip, Button, TextField } from '@radix-ui/themes';

import type { SegmentTags } from '../types';
import { segmentTagsSchema } from '../types';
import CopyClipboardButton from './CopyClipboardButton';
import { errorToast } from '../swal';
import Warning from './Warning';
import mainApi from '../mainApi';


const activeColor = 'var(--gray-12)';

const emptyObject = {};

function TagEditor({ existingTags = emptyObject, customTags = emptyObject, editingTag, setEditingTag, onTagsChange, onTagReset, addTagTitle, tagInfo, canDeleteExisting }: {
  existingTags?: SegmentTags,
  customTags?: SegmentTags | undefined,
  editingTag: string | undefined,
  setEditingTag: (v: string | undefined) => void,
  onTagsChange: (keyValues: Record<string, string>) => void,
  onTagReset: (tag: string) => void,
  addTagTitle: string,
  tagInfo?: Record<string, { description: string, url?: string }>,
  canDeleteExisting?: boolean,
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);

  const [editingTagVal, setEditingTagVal] = useState<string>();
  const [newTagKey, setNewTagKey] = useState<string>();
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
    ref.current?.focus();
  }, [editingTag]);

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
                      <TextField.Root ref={ref} placeholder={t('Enter value')} value={editingTagVal ?? ''} onChange={(e) => setEditingTagVal(e.target.value)} />
                    </form>
                  ) : (
                    renderValue({ isDeletedExisting, value, thisTagCustom })
                  )}

                  {tagInfo?.[tag] && !editingThis && (
                    <Tooltip content={tagInfo[tag].description}>
                      <IconButton size="1" variant="ghost" color="gray" style={{ cursor: tagInfo[tag]?.url ? 'pointer' : undefined }} onClick={() => tagInfo[tag]?.url && mainApi.openExternal(tagInfo[tag].url)}><FaInfo /></IconButton>
                    </Tooltip>
                  )}

                  <IconButton disabled={editingOther} size="1" variant="ghost" color={editingThis ? 'cyan' : 'gray'} title={t('Edit')} onClick={() => onEditClick(tag)}>{editingThis ? <FaCheck /> : <FaEdit />}</IconButton>

                  {editingThis && thisTagNew && (
                    <IconButton size="1" color="red" variant="ghost" title={t('Delete')} onClick={onResetClick}><FaTrash /></IconButton>
                  )}

                  {editingThis && !thisTagNew && (
                    <IconButton size="1" color="red" variant="ghost" title={t('Reset')} onClick={onResetClick}><FaUndo /></IconButton>
                  )}

                  {canDeleteExisting && !isDeletedExisting && !editingThis && existingTags[tag] != null && (
                    <IconButton disabled={editingOther} size="1" color="red" variant="ghost" title={t('Delete')} onClick={() => onDeleteExistingClick(tag)}><FaTrash /></IconButton>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      <form onSubmit={onAddSubmit} style={{ opacity: canAdd ? undefined : 0.5, marginBottom: '1em', display: 'flex', alignItems: 'center' }}>
        <TextField.Root ref={ref} disabled={!canAdd} value={newTagKeyInput} onChange={(e) => setNewTagKeyInput(e.target.value)} placeholder={addTagTitle} style={{ marginRight: '1em' }} />
        <IconButton size="2" type="submit" disabled={!canAdd} title={addTagTitle} onClick={add}><FaPlus /></IconButton>
      </form>

      {newTagKeyInputError && <Warning>{t('Invalid character(s) found in key')}</Warning>}

      <div style={{ marginBottom: '1em', display: 'flex', alignItems: 'center' }}>
        <CopyClipboardButton text={JSON.stringify(effectiveTags, null, 2)} style={{ marginRight: '.3em', verticalAlign: 'middle' }}>
          {({ onClick }) => <Button color="gray" size="1" onClick={onClick}><FaClipboardList />{t('Copy to clipboard')}</Button>}
        </CopyClipboardButton>

        <Button color="gray" size="1" onClick={onPasteClick}><FaClipboard />{t('Paste')}</Button>
      </div>
    </>
  );
}

export default memo(TagEditor);
