

import { getClientFirestore, getFirebaseApp } from './firebase'; // Import the initialized app function
import { getFirestore, writeBatch, onSnapshot } from "firebase/firestore";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, runTransaction, query, where, Query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { cleanDataForFirestore } from './data-sanitizer';
import { buildStorageFilePath, sanitizeStoragePath } from './path-sanitizer';

// This must be imported here to use the type.
import type { UploadTaskSnapshot } from "firebase/storage";

const db = getClientFirestore();

export type WithId<T> = T & { id: string };
export type FirestoreQueryFilter = {
  field: string;
  operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';
  value: unknown;
};
export type FirestoreOrderBy = { field: string; direction: 'asc' | 'desc' };

/**
 * Uploads a file to a specified path in Firebase Storage.
 * @param file The file to upload.
 * @param storagePath The base path in Storage where the file should be saved.
 * @param requestId The ID of the workflow request for sub-folder organization.
 * @param fileName The name for the file. If not provided, the original file name is used.
 * @returns A promise that resolves to the download URL of the uploaded file.
 */
export const uploadFile = (
  file: File,
  storagePath: string,
  requestId: string,
  fileName?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Valida e sanitiza os caminhos para prevenir path traversal e outros problemas
      // Usa try-catch defensivo: se sanitização falhar, tenta usar o caminho original com validação mínima
      let sanitizedStoragePath: string;
      let sanitizedRequestId: string;
      
      try {
        sanitizedStoragePath = sanitizeStoragePath(storagePath);
        sanitizedRequestId = sanitizeStoragePath(requestId);
      } catch (error) {
        // Defensivo: se sanitização falhar (ex: caminho existente com formato incomum),
        // faz validação mínima apenas para prevenir path traversal
        console.warn("Aviso: Caminho não passou na sanitização completa, aplicando validação mínima:", error);
        
        // Validação mínima: apenas prevenir path traversal
        if (storagePath.includes('..') || requestId.includes('..')) {
          reject(new Error("Caminho inválido: não é permitido usar '..' (path traversal)."));
          return;
        }
        
        // Remove apenas barras no início/fim e normaliza separadores (mais conservador)
        sanitizedStoragePath = storagePath.trim().replace(/^\/+|\/+$/g, '').replace(/\\/g, '/').replace(/\/+/g, '/');
        sanitizedRequestId = requestId.trim().replace(/^\/+|\/+$/g, '').replace(/\\/g, '/').replace(/\/+/g, '/');
        
        if (!sanitizedStoragePath || !sanitizedRequestId) {
          reject(new Error("Caminho inválido detectado. Entre em contato com o administrador."));
          return;
        }
      }

      const currentApp = getFirebaseApp();
      const storage = getStorage(currentApp);

      // Nome do arquivo: timestamp + nome original (sanitização mínima)
      const originalFileName = fileName || file.name;
      const timestamp = Date.now();
      // Apenas remove barras do nome (crítico), mas mantém outros caracteres para compatibilidade
      // O encodeURIComponent já faz a codificação necessária para URLs
      const safeFileName = originalFileName.replace(/[/\\]/g, '_');
      const finalFileName = `${timestamp}-${encodeURIComponent(safeFileName)}`;
      
      // Constrói o caminho de forma segura usando a função utilitária
      const filePath = buildStorageFilePath(sanitizedStoragePath, sanitizedRequestId, finalFileName);
      
      const storageRef = ref(storage, filePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (_snapshot: UploadTaskSnapshot) => {
          // Progress can be monitored here if needed
        }, 
        (error) => {
          console.error("Upload Error Details:", error);
          reject(new Error(`Falha no upload: ${error.code}`));
        }, 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          }).catch(error => {
            reject(new Error(`Falha ao obter URL de download: ${error.code}`));
          });
        }
      );

    } catch (error) {
      console.error("Error setting up upload:", error);
      reject(new Error("Não foi possível iniciar o upload do arquivo."));
    }
  });
};


/**
 * Attaches a real-time listener to a Firestore collection.
 * This function is designed to be used with react-query's useQuery hook.
 *
 * @param collectionName The name of the collection to listen to.
 * @param onData A callback function that will be called with the new data whenever it changes.
 * @returns An unsubscribe function to detach the listener.
 */
export const listenToCollection = <T>(
    collectionName: string,
    onData: (data: WithId<T>[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    try {
        const q = query(collection(db, collectionName));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data: WithId<T>[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as WithId<T>);
            });
            onData(data);
        }, (error) => {
            console.error(`Error listening to collection ${collectionName}:`, error);
            onError(new Error(`Não foi possível ouvir os dados de ${collectionName}.`));
        });

        return unsubscribe; // Return the unsubscribe function
    } catch (error) {
        console.error(`Error setting up listener for ${collectionName}:`, error);
        onError(new Error(`Falha ao configurar o ouvinte para ${collectionName}.`));
        return () => {}; // Return a no-op function if setup fails
    }
};

/**
 * Attaches a real-time listener to a Firestore collection with query filters and ordering.
 */
export const listenToCollectionWithQuery = <T>(
    collectionName: string,
    onData: (data: WithId<T>[]) => void,
    onError: (error: Error) => void,
    filters?: FirestoreQueryFilter[],
    orderBy?: FirestoreOrderBy[]
): (() => void) => {
    try {
        const collectionRef = collection(db, collectionName);
        let q: Query = query(collectionRef);

        if (filters && filters.length > 0) {
            filters.forEach(filter => {
                q = query(q, where(filter.field, filter.operator, filter.value));
            });
        }

        if (orderBy && orderBy.length > 0) {
            orderBy.forEach(order => {
                q = query(q, firestoreOrderBy(order.field, order.direction));
            });
        }

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data: WithId<T>[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as WithId<T>);
            });
            onData(data);
        }, (error) => {
            console.error(`Error listening to collection ${collectionName} with query:`, error);
            onError(new Error(`Não foi possível ouvir os dados de ${collectionName}.`));
        });

        return unsubscribe;
    } catch (error) {
        console.error(`Error setting up listener with query for ${collectionName}:`, error);
        onError(new Error(`Falha ao configurar o ouvinte para ${collectionName}.`));
        return () => {};
    }
};

/**
 * Fetches all documents from a specified collection.
 * @param collectionName The name of the collection.
 * @returns A promise that resolves to an array of documents with their IDs.
 */
export const getCollection = async <T>(collectionName: string): Promise<WithId<T>[]> => {
    try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        const data: WithId<T>[] = [];
        snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as WithId<T>);
        });
        return data;
    } catch (error) {
        console.error(`Error fetching collection ${collectionName}:`, error);
        throw new Error(`Não foi possível carregar a coleção de ${collectionName}.`);
    }
};

/**
 * Fetches documents from a collection with optional query filters and ordering.
 * @param collectionName The name of the collection.
 * @param filters Array of where clauses (field, operator, value).
 * @param orderBy Optional array of orderBy clauses (field, direction).
 * @returns A promise that resolves to an array of documents with their IDs.
 */
export const getCollectionWithQuery = async <T>(
    collectionName: string,
    filters?: FirestoreQueryFilter[],
    orderBy?: FirestoreOrderBy[]
): Promise<WithId<T>[]> => {
    try {
        const collectionRef = collection(db, collectionName);
        let q: Query = query(collectionRef);
        
        // Apply filters
        if (filters && filters.length > 0) {
            filters.forEach(filter => {
                q = query(q, where(filter.field, filter.operator, filter.value));
            });
        }
        
        // Apply ordering
        if (orderBy && orderBy.length > 0) {
            orderBy.forEach(order => {
                q = query(q, firestoreOrderBy(order.field, order.direction));
            });
        }
        
        const snapshot = await getDocs(q);
        const data: WithId<T>[] = [];
        snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as WithId<T>);
        });
        return data;
    } catch (error) {
        console.error(`Error fetching collection ${collectionName} with query:`, error);
        throw new Error(`Não foi possível carregar a coleção de ${collectionName} com os filtros especificados.`);
    }
};

/**
 * Fetches all documents from a specified subcollection.
 * @param collectionName The name of the parent collection.
 * @param docId The ID of the parent document.
 * @param subcollectionName The name of the subcollection.
 * @returns A promise that resolves to an array of documents with their IDs.
 */
export const getSubcollection = async <T>(collectionName: string, docId: string, subcollectionName: string): Promise<WithId<T>[]> => {
    try {
        const subcollectionRef = collection(db, collectionName, docId, subcollectionName);
        const snapshot = await getDocs(subcollectionRef);
        const data: WithId<T>[] = [];
        snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as WithId<T>);
        });
        return data;
    } catch (error) {
        console.error(`Error fetching subcollection ${subcollectionName} from ${collectionName}/${docId}:`, error);
        throw new Error(`Não foi possível carregar a subcoleção de ${subcollectionName}.`);
    }
}


/**
 * Fetches a single document by its ID from a specified collection.
 * @param collectionName The name of the collection.
 * @param id The ID of the document to fetch.
 * @returns A promise that resolves to the document data or null if not found.
 */
export const getDocument = async <T>(collectionName: string, id: string): Promise<WithId<T> | null> => {
    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as WithId<T>) : null;
    } catch (error) {
        console.error(`Error fetching document ${id} from ${collectionName}:`, error);
        throw new Error(`Não foi possível carregar o documento.`);
    }
}

/**
 * Adds a new document to a specified collection. It automatically cleans the data
 * to remove any `undefined` fields before sending it to Firestore.
 * @param collectionName The name of the collection.
 * @param data The data for the new document (without an ID).
 * @returns A promise that resolves to the new document data, including its new ID.
 */
export const addDocumentToCollection = async <T extends object>(collectionName: string, data: T): Promise<WithId<T>> => {
    try {
        const cleanedData = cleanDataForFirestore(data);
        const collectionRef = collection(db, collectionName);
        const docRef = await addDoc(collectionRef, cleanedData);
        return { id: docRef.id, ...data };
    } catch (error) {
        console.error(`Error adding document to ${collectionName}:`, error);
        if (error instanceof Error) {
            console.error('Data that caused the error:', data);
        }
        throw new Error('Não foi possível adicionar o novo item.');
    }
};

/**
 * Adds multiple documents to a specified collection in a single batch operation.
 * @param collectionName The name of the collection.
 * @param dataArray An array of documents to add.
 * @returns A promise that resolves when the batch write is complete.
 */
export const addMultipleDocumentsToCollection = async <T extends object>(collectionName: string, dataArray: T[]): Promise<void> => {
    try {
        const batch = writeBatch(db);
        const collectionRef = collection(db, collectionName);

        dataArray.forEach(data => {
            const cleanedData = cleanDataForFirestore(data);
            const docRef = doc(collectionRef); // Automatically generate a new ID
            batch.set(docRef, cleanedData);
        });

        await batch.commit();
    } catch (error) {
        const code =
            typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code: unknown }).code)
                : '';
        // Evita console.error com payload enorme: no Next.js isso abre o overlay vermelho mesmo com catch no caller.
        if (process.env.NODE_ENV === 'development') {
            console.warn(
                `[firestore] batch write failed (${collectionName})`,
                code || '(no code)',
                error instanceof Error ? error.message : error,
                { rowCount: dataArray.length }
            );
        }
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
            code ? `Não foi possível adicionar os itens em lote. [${code}] ${msg}` : `Não foi possível adicionar os itens em lote. ${msg}`
        );
    }
};

/**
 * Creates or overwrites a document with a specific ID.
 * @param collectionName The name of the collection.
 * @param id The ID of the document to create or overwrite.
 * @param data The data for the document.
 * @returns A promise that resolves to void on success.
 */
function firestoreThrownMessage(error: unknown, fallback: string): string {
    const code =
        typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
    if (code === "permission-denied") {
        return "Permissão negada pelo Firestore. Gravar documentos exige conta de super administrador (e-mail em superAdminEmails em systemSettings/config) e regras publicadas.";
    }
    if (code) {
        return `${fallback} [${code}]`;
    }
    return fallback;
}

export const setDocumentInCollection = async <T extends object>(collectionName: string, id: string, data: Partial<Omit<T, 'id'>>): Promise<void> => {
    try {
        const cleanedData = cleanDataForFirestore(data);
        const docRef = doc(db, collectionName, id);
        await setDoc(docRef, cleanedData, { merge: true }); // Use merge: true to avoid overwriting fields not in data
    } catch (error) {
        const code =
            typeof error === "object" && error !== null && "code" in error
                ? String((error as { code: unknown }).code)
                : "";
        // Next.js em dev abre overlay vermelho em todo console.error; permission-denied é esperado até haver super admin.
        if (code === "permission-denied") {
            console.warn(`[firestore] setDocumentInCollection permission-denied: ${collectionName}/${id}`, error);
        } else {
            console.error(`Error setting document ${id} in ${collectionName}:`, error);
        }
        if (process.env.NODE_ENV === "development") {
            const keys =
                data && typeof data === "object" ? Object.keys(data as object).join(", ") : "(n/a)";
            console.warn("[firestore] setDocumentInCollection payload keys:", keys);
        }
        throw new Error(firestoreThrownMessage(error, "Não foi possível salvar os dados."));
    }
};


/**
 * Updates an existing document in a specified collection. It automatically cleans the data
 * to remove any `undefined` fields before sending it to Firestore.
 * @param collectionName The name of the collection.
 * @param id The ID of the document to update.
 * @param data The partial data to update. The 'id' field will be ignored.
 * @returns A promise that resolves to void on success.
 */
export const updateDocumentInCollection = async <T extends object>(collectionName: string, id: string, data: Partial<Omit<T, 'id'>>): Promise<void> => {
    try {
        const cleanedData = cleanDataForFirestore(data);
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, cleanedData);
    } catch (error) {
        console.error(`Error updating document ${id} in ${collectionName}:`, error);
         if (error instanceof Error) {
            console.error('Data that caused the error:', data);
        }
        throw new Error('Não foi possível salvar as alterações.');
    }
};

/**
 * Deletes a document from a specified collection.
 * @param collectionName The name of the collection.
 * @param id The ID of the document to delete.
 * @returns A promise that resolves to void on success.
 */
export const deleteDocumentFromCollection = async (collectionName: string, id: string): Promise<void> => {
    try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error(`Error deleting document ${id} from ${collectionName}:`, error);
        throw new Error('Não foi possível remover o item.');
    }
};

/**
 * Gets the next sequential ID from a dedicated counter document in a Firestore transaction.
 * @param counterId The ID of the counter to use (e.g., 'workflowCounter').
 * @returns A promise that resolves to the next number in the sequence.
 */
export const getNextSequentialId = async (counterId: string): Promise<number> => {
  const counterRef = doc(db, 'counters', counterId);

  try {
    const newId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextValue = 1; // Default to 1 if counter doesn't exist
      if (counterDoc.exists()) {
        nextValue = (counterDoc.data().currentNumber || 0) + 1;
      }
      
      transaction.set(counterRef, { currentNumber: nextValue }, { merge: true });
      
      return nextValue;
    });
    return newId;
  } catch (error) {
    console.error("Transaction failed: ", error);
    throw new Error("Não foi possível gerar um novo ID para a solicitação.");
  }
};

export { writeBatch, doc, getFirestore };
