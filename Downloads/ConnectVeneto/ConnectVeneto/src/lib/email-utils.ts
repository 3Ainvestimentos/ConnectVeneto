/**
 * Utilitários para normalização de emails.
 */

/**
 * Normaliza email para comparação consistente.
 * @param email - Email a ser normalizado
 * @returns Email normalizado ou null se email for inválido
 */
export const normalizeEmail = (email: string | null | undefined): string | null => {
    if (!email) return null;
    return email.trim().toLowerCase();
};

/**
 * Busca colaborador por email com normalização automática.
 * 
 * @param collaborators - Lista de colaboradores
 * @param userEmail - Email do usuário
 * @returns Colaborador encontrado ou undefined
 */
export const findCollaboratorByEmail = <T extends { email: string }>(
    collaborators: T[],
    userEmail: string | null | undefined
): T | undefined => {
    if (!userEmail || !collaborators?.length) return undefined;
    const normalizedUserEmail = normalizeEmail(userEmail);
    return collaborators.find(c => normalizeEmail(c.email) === normalizedUserEmail);
};

/**
 * Filtra colaboradores por lista de emails com normalização
 * Útil para routing rules e notificações
 * 
 * @param collaborators - Lista de colaboradores
 * @param emails - Lista de emails para filtrar
 * @returns Colaboradores que correspondem aos emails (normalizados)
 */
export const filterCollaboratorsByEmails = <T extends { email: string }>(
    collaborators: T[],
    emails: string[]
): T[] => {
    if (!emails?.length || !collaborators?.length) return [];
    const normalizedEmails = emails.map(e => normalizeEmail(e)).filter((e): e is string => e !== null);
    return collaborators.filter(c => {
        const normalizedCollabEmail = normalizeEmail(c.email);
        return normalizedCollabEmail && normalizedEmails.includes(normalizedCollabEmail);
    });
};

/**
 * Verifica se dois emails são equivalentes (considerando normalização)
 * 
 * @param email1 - Primeiro email
 * @param email2 - Segundo email
 * @returns true se os emails são equivalentes após normalização
 */
export const emailsMatch = (
    email1: string | null | undefined,
    email2: string | null | undefined
): boolean => {
    if (!email1 || !email2) return false;
    return normalizeEmail(email1) === normalizeEmail(email2);
};

