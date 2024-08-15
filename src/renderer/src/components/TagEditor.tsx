import { memo, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, TrashIcon, ResetIcon, TickIcon, EditIcon, PlusIcon, Button, IconButton } from 'evergreen-ui';
import invariant from 'tiny-invariant';

import { askForMetadataKey } from '../dialogs';
import { SegmentTags, segmentTagsSchema } from '../types';
import CopyClipboardButton from './CopyClipboardButton';
import { errorToast } from '../swal';


const { clipboard } = window.require('electron');

const activeColor = '#429777';

const emptyObject = {};

function TagEditor({ existingTags = emptyObject, customTags = emptyObject, editingTag, setEditingTag, onTagsChange, onTagReset, addTagTitle, addTagText }: {
  existingTags?: SegmentTags, customTags?: SegmentTags | undefined, editingTag: string | undefined, setEditingTag: (v: string | undefined) => void, onTagsChange: (keyValues: Record<string, string>) => void, onTagReset: (tag: string) => void, addTagTitle: string, addTagText: string,
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);

  const [editingTagVal, setEditingTagVal] = useState<string>();
  const [newTag, setNewTag] = useState<string>();

  const mergedTags = useMemo(() => ({ ...existingTags, ...customTags, ...(newTag ? { [newTag]: '' } : undefined) }), [customTags, existingTags, newTag]);

  const onResetClick = useCallback(() => {
    invariant(editingTag != null);
    onTagReset(editingTag);
    setEditingTag(undefined);
    setNewTag(undefined);
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
    if (newTag) {
      saveTag();
      setNewTag(undefined);
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
  }, [editingTag, editingTagVal, existingTags, mergedTags, newTag, onResetClick, saveTag, setEditingTag]);

  function onSubmit(e) {
    e.preventDefault();
    onEditClick();
  }

  const onAddPress = useCallback(async (e) => {
    e.preventDefault();
    e.target.blur();

    if (newTag || editingTag != null) {
      // save any unsaved edit
      onEditClick();
    }

    const tag = await askForMetadataKey({ title: addTagTitle, text: addTagText });
    if (!tag || Object.keys(mergedTags).includes(tag)) return;
    setEditingTag(tag);
    setEditingTagVal('');
    setNewTag(tag);
  }, [addTagText, addTagTitle, editingTag, mergedTags, newTag, onEditClick, setEditingTag]);

  useEffect(() => {
    ref.current?.focus();
  }, [editingTag]);

  return (
    <>
      <table style={{ color: 'black', marginBottom: 10 }}>
        <tbody>
          {Object.keys(mergedTags).map((tag) => {
            const editingThis = tag === editingTag;
            const Icon = editingThis ? TickIcon : EditIcon;
            const thisTagCustom = customTags[tag] != null;
            const thisTagNew = existingTags[tag] == null;

            return (
              <tr key={tag}>
                <td style={{ paddingRight: 20, color: thisTagNew ? activeColor : 'rgba(0,0,0,0.6)' }}>{tag}</td>

                <td style={{ display: 'flex', alignItems: 'center' }}>
                  {editingThis ? (
                    <form style={{ display: 'inline' }} onSubmit={onSubmit}>
                      <TextInput ref={ref} placeholder={t('Enter value')} value={editingTagVal || ''} onChange={(e) => setEditingTagVal(e.target.value)} style={{ textTransform: editingTag === 'language' ? 'lowercase' : undefined }} />
                    </form>
                  ) : (
                    <span style={{ padding: '.5em 0', color: thisTagCustom ? activeColor : undefined, fontWeight: thisTagCustom ? 'bold' : undefined }}>{mergedTags[tag] ? String(mergedTags[tag]) : `<${t('empty')}>`}</span>
                  )}
                  {(editingTag == null || editingThis) && <IconButton icon={Icon} title={t('Edit')} appearance="minimal" style={{ marginLeft: '.4em' }} onClick={() => onEditClick(tag)} intent={editingThis ? 'success' : 'none'} />}
                  {editingThis && <IconButton icon={thisTagNew ? TrashIcon : ResetIcon} title={thisTagNew ? t('Delete') : t('Reset')} appearance="minimal" onClick={onResetClick} intent="danger" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Button iconBefore={PlusIcon} onClick={onAddPress}>{addTagTitle}</Button>

      <div style={{ marginTop: '1em' }}>
        <span style={{ marginRight: '1em' }}>{t('Batch')}:</span>
        <CopyClipboardButton text={JSON.stringify(mergedTags)} style={{ marginRight: '.3em', verticalAlign: 'middle' }} />

        <Button appearance="minimal" onClick={onPasteClick}>{t('Paste')}</Button>
      </div>
    </>
  );
}

export default memo(TagEditor);
