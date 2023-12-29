import React, { memo, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, TrashIcon, TickIcon, EditIcon, PlusIcon, Button, IconButton } from 'evergreen-ui';

import { askForMetadataKey } from '../dialogs';


const activeColor = '#429777';

const emptyObject = {};

function TagEditor({ existingTags = emptyObject, customTags = emptyObject, editingTag, setEditingTag, onTagChange, onTagReset, addTagTitle, addTagText }) {
  const { t } = useTranslation();
  const ref = useRef();

  const [editingTagVal, setEditingTagVal] = useState();
  const [newTag, setNewTag] = useState();

  const mergedTags = useMemo(() => ({ ...existingTags, ...customTags, ...(newTag ? { [newTag]: '' } : {}) }), [customTags, existingTags, newTag]);

  const onResetClick = useCallback(() => {
    onTagReset(editingTag);
    setEditingTag();
    setNewTag();
  }, [editingTag, onTagReset, setEditingTag]);

  const onEditClick = useCallback((tag) => {
    if (newTag) {
      onTagChange(editingTag, editingTagVal);
      setEditingTag();
      setNewTag();
    } else if (editingTag != null) {
      if (editingTagVal !== existingTags[editingTag]) {
        onTagChange(editingTag, editingTagVal);
        setEditingTag();
      } else { // If not actually changed, no need to update
        onResetClick();
      }
    } else {
      setEditingTag(tag);
      setEditingTagVal(mergedTags[tag]);
    }
  }, [editingTag, editingTagVal, existingTags, mergedTags, newTag, onResetClick, onTagChange, setEditingTag]);

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
      <table style={{ color: 'black' }}>
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
                      <TextInput ref={ref} placeholder={t('Enter value')} value={editingTagVal || ''} onChange={(e) => setEditingTagVal(e.target.value)} />
                    </form>
                  ) : (
                    <span style={{ padding: '.5em 0', color: thisTagCustom ? activeColor : undefined, fontWeight: thisTagCustom ? 'bold' : undefined }}>{mergedTags[tag] || `<${t('empty')}>`}</span>
                  )}
                  {(editingTag == null || editingThis) && <IconButton icon={Icon} title={t('Edit')} appearance="minimal" style={{ marginLeft: '.4em' }} onClick={() => onEditClick(tag)} intent={editingThis ? 'success' : 'none'} />}
                  {editingThis && <IconButton icon={TrashIcon} title={thisTagCustom ? t('Delete') : t('Reset')} appearance="minimal" onClick={onResetClick} intent="danger" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Button style={{ marginTop: 10 }} iconBefore={PlusIcon} onClick={onAddPress}>{addTagTitle}</Button>
    </>
  );
}

export default memo(TagEditor);
