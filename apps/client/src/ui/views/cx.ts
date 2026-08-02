/* Class-name joining for the view layer. A helper, not a component, so
 * it sits beside the level folders rather than inside one. */

export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
    return values.filter(Boolean).join(" ");
}
