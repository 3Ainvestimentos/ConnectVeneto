/**
 * @fileOverview A central utility for sanitizing data before it's sent to Firestore.
 */

/**
 * Deep clones an object and removes all properties with `undefined` values.
 * Firestore throws an error if you try to save an object containing `undefined`.
 * Using `JSON.parse(JSON.stringify(obj))` is a simple and effective way to achieve this
 * for the data structures used in this application (which do not rely on complex types
 * like Date objects, functions, or Symbols that would be lost in serialization).
 *
 * @param obj The object to clean.
 * @returns A new object with all `undefined` values and their corresponding keys removed.
 */
export const cleanDataForFirestore = <T extends object>(obj: T): T => {
  if (!obj) return obj;
  // This is a robust way to strip undefined values, which are not allowed by Firestore.
  // It works for the current data models in the app.
  const cleaned = JSON.parse(JSON.stringify(obj));
  return cleaned;
};
