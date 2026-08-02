import type { ReactNode } from "react";

interface FormFieldProps {
    /** Matches the `id` of the control passed as children. */
    htmlFor: string;
    label: string;
    hint?: ReactNode;
    children: ReactNode;
}

/* One question and the control that answers it. The hint is wired to the
 * control by id, so a screen reader reads it with the field rather than
 * leaving it stranded underneath. */
export const FormField = ({ htmlFor, label, hint, children }: FormFieldProps) => (
    <div className="field">
        <label className="field__label" htmlFor={htmlFor}>
            {label}
        </label>
        {children}
        {hint ? (
            <p className="field__hint" id={`${htmlFor}-hint`}>
                {hint}
            </p>
        ) : null}
    </div>
);
