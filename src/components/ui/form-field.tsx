import React from "react";

/**
 * Shared building blocks for the three story editors (text / video /
 * carousel). Previously copy-pasted into each editor; extracted so the
 * label-association logic lives in one place.
 */

export const FormBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-4 p-6" style={{ border: '1px solid var(--line)', background: 'var(--overlay-panel-soft)' }}>
    <div className="eyebrow">{title}</div>
    {children}
  </div>
);

const isNativeControl = (
  node: React.ReactNode
): node is React.ReactElement<{ id?: string }> =>
  React.isValidElement(node) &&
  typeof node.type === "string" &&
  ["input", "textarea", "select"].includes(node.type);

export const Field: React.FC<{
  label: string;
  required?: boolean;
  compact?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, compact, error, children }) => {
  const reactId = React.useId();

  // Associate the <label> with its control. Works both for a single native
  // child and for multi-child fields (textarea + character counter): the
  // FIRST native <input>/<textarea>/<select> gets the id. Radix <Select>
  // children are skipped so we never point htmlFor at an id that isn't
  // rendered.
  let controlId: string | undefined;
  const childArray = React.Children.toArray(children);
  const wired = childArray.map((child) => {
    if (controlId === undefined && isNativeControl(child)) {
      controlId = child.props.id ?? reactId;
      return React.cloneElement(child, { id: controlId, key: child.key ?? "field-control" });
    }
    return child;
  });

  return (
    <div className={compact ? '' : 'flex flex-col'}>
      <label htmlFor={controlId} style={{ marginBottom: compact ? 4 : 8 }}>
        {label}
        {required && <span style={{ color: 'var(--oxblood-2)', marginLeft: 4 }}>*</span>}
      </label>
      {wired}
      {error && (
        <p className="font-ui text-[10px] uppercase mt-1.5" style={{ letterSpacing: '0.15em', color: 'var(--oxblood-2)' }}>
          {error}
        </p>
      )}
    </div>
  );
};
