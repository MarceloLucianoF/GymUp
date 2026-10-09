import React, { useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

// const { confirm, dialog } = useConfirm();
// if (!(await confirm({ title, message, danger: true }))) return;  ...  {dialog}
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setOptions(opts);
  }), []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={!!options}
      {...(options || {})}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}

export default useConfirm;
