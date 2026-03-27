/**
 * @fileOverview A mock Firestore service that uses localStorage to simulate database operations.
 * This allows for a fully functional development experience without a live Firebase backend.
 * Data persists across page reloads within the same browser.
 */

export type WithId<T> = T & { id: string };

const getFullKey = (collectionName: string) => `firebase_mock_${collectionName}`;

/**
 * Retrieves a collection from localStorage.
 * @param collectionName The name of the collection.
 * @returns A promise that resolves to an array of documents with their IDs.
 */
export const getCollection = async <T>(collectionName: string, mockData: WithId<T>[] = []): Promise<WithId<T>[]> => {
    if (typeof window === 'undefined') return mockData as WithId<T>[];
    try {
        const key = getFullKey(collectionName);
        const storedData = window.localStorage.getItem(key);
        if (!storedData) {
            // If no data, initialize with mock data
            window.localStorage.setItem(key, JSON.stringify(mockData));
            return mockData as WithId<T>[];
        }
        return JSON.parse(storedData) as WithId<T>[];
    } catch (error) {
        console.error(`Error fetching mock collection ${collectionName}:`, error);
        return mockData as WithId<T>[];
    }
};

/**
 * Adds a document to a collection in localStorage.
 * @param collectionName The name of the collection.
 * @param data The data for the new document.
 * @returns A promise that resolves to the new document with a generated ID.
 */
export const addDocumentToCollection = async <T extends object>(collectionName: string, data: T): Promise<WithId<T>> => {
    if (typeof window === 'undefined') throw new Error("LocalStorage is not available.");
    try {
        const currentData = await getCollection<T>(collectionName);
        const newItem: WithId<T> = { ...data, id: `mock_${Date.now()}_${Math.random()}` };
        const newData = [...currentData, newItem];
        window.localStorage.setItem(getFullKey(collectionName), JSON.stringify(newData));
        return newItem;
    } catch (error) {
        console.error(`Error adding mock document to ${collectionName}:`, error);
        throw new Error('Failed to add mock document.');
    }
};

/**
 * Updates a document in a collection in localStorage.
 * @param collectionName The name of the collection.
 * @param id The ID of the document to update.
 * @param data The partial data to update.
 * @returns A promise that resolves to void on success.
 */
export const updateDocumentInCollection = async <T extends object>(collectionName: string, id: string, data: Partial<Omit<T, 'id'>>): Promise<void> => {
    if (typeof window === 'undefined') throw new Error("LocalStorage is not available.");
    try {
        const currentData = await getCollection<WithId<T>>(collectionName);
        const newData = currentData.map(item =>
            item.id === id ? { ...item, ...data } : item
        );
        window.localStorage.setItem(getFullKey(collectionName), JSON.stringify(newData));
    } catch (error) {
        console.error(`Error updating mock document ${id} in ${collectionName}:`, error);
        throw new Error('Failed to update mock document.');
    }
};

/**
 * Deletes a document from a collection in localStorage.
 * @param collectionName The name of the collection.
 * @param id The ID of the document to delete.
 * @returns A promise that resolves to void on success.
 */
export const deleteDocumentFromCollection = async (collectionName: string, id: string): Promise<void> => {
    if (typeof window === 'undefined') throw new Error("LocalStorage is not available.");
    try {
        const currentData = await getCollection(collectionName);
        const newData = currentData.filter(item => item.id !== id);
        window.localStorage.setItem(getFullKey(collectionName), JSON.stringify(newData));
    } catch (error) {
        console.error(`Error deleting mock document ${id} from ${collectionName}:`, error);
        throw new Error('Failed to delete mock document.');
    }
};
