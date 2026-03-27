
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, ExternalLink, FolderOpen, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';

type DriveGapi = {
  load: (api: string, callback: () => void) => void;
  client: {
    init: (config: {
      apiKey: string | undefined;
      discoveryDocs: string[];
    }) => Promise<void>;
    setToken: (token: { access_token: string }) => void;
    drive: {
      files: {
        list: (params: Record<string, string | number>) => Promise<{
          result?: { files?: DriveFile[] };
        }>;
        get: (params: { fileId: string; fields: string }) => Promise<{
          result: FolderInfo;
        }>;
      };
    };
  };
};

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
  mimeType: string;
}

interface FolderInfo {
    id: string;
    name: string;
}

const extractFolderIdFromUrl = (url: string): string | null => {
    const regex = /folders\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
};


export default function GoogleDriveFiles() {
  const { user, accessToken, signOut } = useAuth();
  const { collaborators } = useCollaborators();
  const [items, setItems] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [initialFolders, setInitialFolders] = useState<FolderInfo[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderInfo | null>(null);
  const [folderHistory, setFolderHistory] = useState<FolderInfo[]>([]);
  
  const currentUserCollab = useMemo(() => {
    if (!user) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  const listFiles = useCallback(async (folderId: string) => {
    if (!user || !accessToken) {
        throw new Error("Usuário não autenticado ou token de acesso inválido.");
    }
    
    const gapi = (window as unknown as Window & { gapi: DriveGapi }).gapi;
    gapi.client.setToken({ access_token: accessToken });
    
    const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: 100,
        fields: "nextPageToken, files(id, name, modifiedTime, webViewLink, iconLink, mimeType)",
        orderBy: 'folder,modifiedTime desc'
    });
    
    if (!response || !response.result) {
        throw new Error("A resposta da API do Google Drive foi inválida ou nula.");
    }
    
    setItems(response.result.files || []);
    setError(null);

  }, [user, accessToken]);


  const fetchFolderDetails = useCallback(async (folderId: string): Promise<FolderInfo> => {
    if (!accessToken) {
      throw new Error("Token de acesso ausente para consultar pasta no Drive.");
    }
    const gapi = (window as unknown as Window & { gapi: DriveGapi }).gapi;
    gapi.client.setToken({ access_token: accessToken });
    try {
      const response = await gapi.client.drive.files.get({
        fileId: folderId,
        fields: 'id, name',
      });
      return response.result;
    } catch (error) {
      console.error(`Failed to fetch details for folder ${folderId}`, error);
      return { id: folderId, name: `Pasta (${folderId.slice(0,5)}...)` }; // Fallback name
    }
  }, [accessToken]);


  const initializeDriveState = useCallback(async () => {
    try {
        const driveLinks = currentUserCollab?.googleDriveLinks;
        if (driveLinks && driveLinks.length > 1) {
            const folderIds = driveLinks.map(extractFolderIdFromUrl).filter((id): id is string => id !== null);
            const folderPromises = folderIds.map(id => fetchFolderDetails(id));
            const fetchedFolders = await Promise.all(folderPromises);
            setInitialFolders(fetchedFolders);
            setItems([]);
            setCurrentFolder(null);
            setFolderHistory([]);
        } else {
            const singleLink = driveLinks && driveLinks.length === 1 ? driveLinks[0] : 'https://drive.google.com/drive/my-drive';
            const folderId = singleLink ? extractFolderIdFromUrl(singleLink) || (singleLink.includes('my-drive') ? 'root' : '') : 'root';
            const rootFolder = { id: folderId, name: 'Início' };
            setInitialFolders([]);
            setCurrentFolder(rootFolder);
            setFolderHistory([]);
            if (folderId) await listFiles(folderId);
        }
        setError(null);
    } catch (e) {
        console.error("Erro ao processar pastas do Drive:", e);
        throw e;
    }
  }, [currentUserCollab, fetchFolderDetails, listFiles]);
  
  const initializeGapiClient = useCallback(() => {
    const init = async () => {
        try {
            await new Promise<void>((resolve, reject) => {
                const gapi = (window as unknown as Window & { gapi: DriveGapi }).gapi;
                gapi.load('client', () => {
                    gapi.client.init({
                        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
                    }).then(() => resolve(), (err: unknown) => reject(err));
                });
            });
            await initializeDriveState();
        } catch (e: unknown) {
             console.error("Erro ao inicializar ou buscar arquivos do Drive:", e);
             setError("Falha ao carregar os arquivos. Por favor, saia e faça login novamente para reautenticar.");
        }
    };

     if (typeof (window as unknown as Window & { gapi?: DriveGapi }).gapi !== 'undefined') {
        init();
    } else {
        setError("Não foi possível carregar a API do Google. Verifique sua conexão ou tente fazer login novamente.");
    }
  }, [initializeDriveState]);

  useEffect(() => {
    if (user && accessToken) {
        initializeGapiClient();
    } else if (user && !accessToken) {
        setError("Sua sessão de acesso ao Google Drive expirou. Faça login novamente para reautenticar.");
    } else if (!user) {
        setError("Usuário não autenticado.");
    }
  }, [user, accessToken, initializeGapiClient]);

  const handleFolderClick = async (folder: DriveFile | FolderInfo) => {
    try {
        const newFolder = { id: folder.id, name: folder.name };
        if (currentFolder) { 
            setFolderHistory(prev => [...prev, currentFolder]);
        }
        setCurrentFolder(newFolder);
        await listFiles(folder.id);
    } catch {
        setError("Ocorreu um erro ao carregar os arquivos. Por favor, saia e faça login novamente para reautenticar.");
    }
  };
  
  const handleBreadcrumbClick = async (folder: FolderInfo | null, index: number) => {
    try {
        if (folder === null) { 
            await initializeDriveState();
            return;
        }
        setCurrentFolder(folder);
        setFolderHistory(prev => prev.slice(0, index));
        await listFiles(folder.id);
    } catch {
        setError("Ocorreu um erro ao carregar os arquivos. Por favor, saia e faça login novamente para reautenticar.");
    }
  }

  const renderBreadcrumbs = () => {
    const rootName = initialFolders.length > 1 ? "Pastas" : "Início";
    
    const breadcrumbs = [
        { name: rootName, folder: folderHistory.length > 0 ? folderHistory[0] : null, index: -1},
        ...folderHistory.map((f, i) => ({ name: f.name, folder: f, index: i})),
    ];
    if (currentFolder && (folderHistory.length === 0 || currentFolder.id !== folderHistory[folderHistory.length - 1]?.id)) {
        breadcrumbs.push({ name: currentFolder.name, folder: currentFolder, index: folderHistory.length });
    }
    
    return (
      <div className="flex items-center text-sm text-muted-foreground flex-wrap">
          {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.folder?.id || `root-${index}`}>
                  <Button 
                      variant="link" 
                      onClick={() => index === 0 ? initializeDriveState() : handleBreadcrumbClick(crumb.folder, index-1)}
                      className={cn(
                          "p-1 h-auto text-muted-foreground hover:text-foreground",
                          index === breadcrumbs.length - 1 && "font-semibold text-foreground hover:text-foreground/80"
                      )}
                  >
                      {crumb.name}
                  </Button>
                   {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4" />}
              </React.Fragment>
          ))}
      </div>
    );
  }
  
  const renderContent = () => {
    const list = currentFolder ? items : initialFolders;

    if (list.length === 0) {
      return <p className="text-center text-muted-foreground text-sm py-4">Nenhum item encontrado.</p>
    }

    return (
       <ul className="space-y-3">
          {list.map((item: DriveFile | FolderInfo) => {
              const isDriveFile = 'mimeType' in item;
              const isFolder = isDriveFile ? item.mimeType === 'application/vnd.google-apps.folder' : true;

              return (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                      {isFolder ? (
                        <FolderOpen className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={(item as DriveFile).iconLink} alt="file icon" className="w-5 h-5 flex-shrink-0" />
                      )}
                      <div className="flex-grow truncate">
                          {isFolder ? (
                              <button onClick={() => handleFolderClick(item)} className="font-semibold hover:underline text-left flex items-center gap-1">
                                  {item.name}
                              </button>
                          ) : (
                              <a href={(item as DriveFile).webViewLink} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline flex items-center gap-1">
                                  {item.name}
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                          )}
                          {isDriveFile && <p className="text-xs text-muted-foreground">
                              Modificado {formatDistanceToNow(new Date((item as DriveFile).modifiedTime), { addSuffix: true, locale: ptBR })}
                          </p>}
                      </div>
                  </li>
              );
          })}
      </ul>
    );
  }


  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="font-headline text-foreground text-xl">Google Drive</CardTitle>
        <CardDescription>
            Navegue pelas suas pastas ou abra os arquivos diretamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow min-h-0 flex flex-col gap-2 overflow-hidden">
         {error ? (
            <div className="flex flex-col items-center justify-center text-center text-destructive p-4 h-full">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="font-semibold">Falha ao carregar</p>
                <p className="text-sm">{error}</p>
                <Button variant="destructive" size="sm" onClick={signOut} className="mt-2 text-xs">Fazer Login Novamente</Button>
            </div>
         ) : (
            <>
                <div className="flex-shrink-0">
                    {(currentFolder || initialFolders.length > 1) && renderBreadcrumbs()}
                </div>
                <div className="flex-grow relative">
                    <ScrollArea className="absolute inset-0 pr-3">
                        {renderContent()}
                    </ScrollArea>
                </div>
            </>
         )}
      </CardContent>
    </Card>
  );
}
