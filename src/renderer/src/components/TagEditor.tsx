import type { FormEventHandler } from 'react';
import { memo, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import invariant from 'tiny-invariant';
import { motion } from 'motion/react';
import { FaCheck, FaEdit, FaPlus, FaTrash, FaUndo } from 'react-icons/fa';

import type { SegmentTags } from '../types';
import { segmentTagsSchema } from '../types';
import CopyClipboardButton from './CopyClipboardButton';
import { errorToast } from '../swal';
import TextInput from './TextInput';
import Button from './Button';
import Warning from './Warning';


const { clipboard } = window.require('electron');

const activeColor = 'var(--gray-12)';

const emptyObject = {};

function TagEditor({ existingTags = emptyObject, customTags = emptyObject, editingTag, setEditingTag, onTagsChange, onTagReset, addTagTitle }: {
  existingTags?: SegmentTags,
  customTags?: SegmentTags | undefined,
  editingTag: string | undefined,
  setEditingTag: (v: string | undefined) => void,
  onTagsChange: (keyValues: Record<string, string>) => void,
  onTagReset: (tag: string) => void,
  addTagTitle: string,
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
    const text = clipboard.readText();
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
    const editingValTransformed = editingTag === 'language' ? editingTagVal.toLowerCase() : editingTagVal;
    onTagsChange({ [editingTag]: editingValTransformed });
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

  return (
    <>
      <table style={{ marginBottom: '1em', width: '100%' }}>
        <tbody>
          {Object.keys(effectiveTags).map((tag) => {
            const editingThis = tag === editingTag;
            const Icon = editingThis ? FaCheck : FaEdit;
            const thisTagCustom = customTags[tag] != null;
            const thisTagNew = existingTags[tag] == null;

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

                <td style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {editingThis ? (
                    <form style={{ display: 'inline' }} onSubmit={onSubmit}>
                      <TextInput ref={ref} placeholder={t('Enter value')} value={editingTagVal || ''} onChange={(e) => setEditingTagVal(e.target.value)} style={{ padding: '.4em', textTransform: editingTag === 'language' ? 'lowercase' : undefined }} />
                    </form>
                  ) : (
                    <span style={{ padding: '.3em 0', color: thisTagCustom ? activeColor : 'var(--gray-11)', fontWeight: thisTagCustom ? 'bold' : undefined }}>{effectiveTags[tag] ? String(effectiveTags[tag]) : `<${t('empty')}>`}</span>
                  )}
                  <Button disabled={editingTag != null && !editingThis} title={t('Edit')} style={{ marginLeft: '.4em' }} onClick={() => onEditClick(tag)}><Icon style={{ fontSize: '.9em', padding: '.5em', verticalAlign: 'middle' }} /></Button>
                  {editingThis && (
                    <Button title={thisTagNew ? t('Delete') : t('Reset')} onClick={onResetClick}>
                      {thisTagNew ? <FaTrash style={{ fontSize: '.9em', padding: '.5em', verticalAlign: 'middle' }} /> : <FaUndo style={{ fontSize: '.9em', padding: '.5em', verticalAlign: 'middle' }} />}
                    </Button>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      <form onSubmit={onAddSubmit} style={{ opacity: canAdd ? undefined : 0.5, marginBottom: '1em' }}>
        <TextInput ref={ref} disabled={!canAdd} value={newTagKeyInput} onChange={(e) => setNewTagKeyInput(e.target.value)} placeholder={addTagTitle} style={{ padding: '.4em', marginRight: '1em', verticalAlign: 'middle' }} />
        <Button type="submit" disabled={!canAdd} title={addTagTitle} onClick={add}><FaPlus style={{ padding: '.6em', verticalAlign: 'middle' }} /></Button>
      </form>

      {newTagKeyInputError && <Warning>{t('Invalid character(s) found in key')}</Warning>}

      <div style={{ marginBottom: '1em' }}>
        <CopyClipboardButton text={JSON.stringify(effectiveTags, null, 2)} style={{ marginRight: '.3em', verticalAlign: 'middle' }}>
          {({ onClick }) => <Button onClick={onClick} style={{ display: 'block' }}>{t('Copy to clipboard')}</Button>}
        </CopyClipboardButton>

        <Button onClick={onPasteClick}>{t('Paste')}</Button>
      </div>
    </>
  );
}

export default memo(TagEditor);
