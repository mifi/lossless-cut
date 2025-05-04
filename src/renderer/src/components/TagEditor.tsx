import { memo, useRef, useState, useMemo, useCallback, useEffect, FormEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon, ResetIcon, TickIcon, EditIcon, PlusIcon, IconButton } from 'evergreen-ui';
import invariant from 'tiny-invariant';

import { SegmentTags, segmentTagsSchema } from '../types';
import CopyClipboardButton from './CopyClipboardButton';
import { errorToast } from '../swal';
import TextInput from './TextInput';
import Button from './Button';


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

  const mergedTags = useMemo(() => ({
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
      setEditingTagVal(tag && String(mergedTags[tag]));
    }
  }, [editingTag, editingTagVal, existingTags, mergedTags, newTagKey, onResetClick, saveTag, setEditingTag]);

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

    if (!newTagKeyInput || newTagKeyInputError || Object.keys(mergedTags).includes(newTagKeyInput)) return;
    setEditingTag(newTagKeyInput);
    setEditingTagVal('');
    setNewTagKey(newTagKeyInput);
    setNewTagKeyInput('');
  }, [editingTag, mergedTags, newTagKey, newTagKeyInput, newTagKeyInputError, onEditClick, setEditingTag]);

  const onAddSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
    e.preventDefault();
    add();
  }, [add]);

  useEffect(() => {
    ref.current?.focus();
  }, [editingTag]);

  return (
    <>
      <table style={{ marginBottom: 10 }}>
        <tbody>
          {Object.keys(mergedTags).map((tag) => {
            const editingThis = tag === editingTag;
            const Icon = editingThis ? TickIcon : EditIcon;
            const thisTagCustom = customTags[tag] != null;
            const thisTagNew = existingTags[tag] == null;

            return (
              <tr key={tag}>
                <td style={{ paddingRight: '1em', color: thisTagNew ? activeColor : 'var(--gray-11)' }}>{tag}</td>

                <td style={{ display: 'flex', alignItems: 'center' }}>
                  {editingThis ? (
                    <form style={{ display: 'inline' }} onSubmit={onSubmit}>
                      <TextInput ref={ref} placeholder={t('Enter value')} value={editingTagVal || ''} onChange={(e) => setEditingTagVal(e.target.value)} style={{ padding: '.4em', textTransform: editingTag === 'language' ? 'lowercase' : undefined }} />
                    </form>
                  ) : (
                    <span style={{ padding: '.5em 0', color: thisTagCustom ? activeColor : 'var(--gray-11)', fontWeight: thisTagCustom ? 'bold' : undefined }}>{mergedTags[tag] ? String(mergedTags[tag]) : `<${t('empty')}>`}</span>
                  )}
                  {(editingTag == null || editingThis) && <IconButton icon={Icon} title={t('Edit')} appearance="minimal" style={{ marginLeft: '.4em' }} onClick={() => onEditClick(tag)} intent={editingThis ? 'success' : 'none'} />}
                  {editingThis && <IconButton icon={thisTagNew ? TrashIcon : ResetIcon} title={thisTagNew ? t('Delete') : t('Reset')} appearance="minimal" onClick={onResetClick} intent="danger" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(!newTagKey && (editingTag == null || mergedTags[editingTag] == null)) && (
        <>
          <form onSubmit={onAddSubmit}>
            <TextInput value={newTagKeyInput} onChange={(e) => setNewTagKeyInput(e.target.value)} placeholder={addTagTitle} style={{ marginBottom: '1em', padding: '.4em', marginRight: '1em' }} />
            <Button type="button" title={addTagTitle} onClick={add} style={{ padding: '.3em' }}><PlusIcon style={{ verticalAlign: 'middle' }} /></Button>
          </form>

          {newTagKeyInputError && <div>{t('Invalid character(s) found in key')}</div>}
        </>
      )}

      <div style={{ marginTop: '1em', marginBottom: '1em' }}>
        <CopyClipboardButton text={JSON.stringify(mergedTags, null, 2)} style={{ marginRight: '.3em', verticalAlign: 'middle' }}>
          {({ onClick }) => <Button onClick={onClick} style={{ display: 'block' }}>{t('Copy to clipboard')}</Button>}
        </CopyClipboardButton>

        <Button onClick={onPasteClick}>{t('Paste')}</Button>
      </div>
    </>
  );
}

export default memo(TagEditor);
