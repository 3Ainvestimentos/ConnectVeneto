
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { DocumentType } from '@/app/(app)/documents/page';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, Download, ChevronDown, ChevronUp, FileType, Folder } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { addDocumentToCollection } from '@/lib/firestore-service';
import { findCollaboratorByEmail } from '@/lib/email-utils';

interface DocumentRepositoryClientProps {
  initialDocuments: DocumentType[];
  categories: string[];
  types: string[];
}

// Debounce hook
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};


const getFileIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'pdf': return <FileType className="h-5 w-5 text-red-500" />;
    case 'docx':
    case 'doc': return <FileType className="h-5 w-5 text-blue-500" />;
    case 'pptx':
    case 'ppt': return <FileType className="h-5 w-5 text-orange-500" />;
    case 'xlsx':
    case 'xls': return <FileType className="h-5 w-5 text-green-500" />;
    default: return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
};

type SortKey = keyof DocumentType | '';
type SortDirection = 'asc' | 'desc';

export default function DocumentRepositoryClient({ initialDocuments, categories, types }: DocumentRepositoryClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('lastModified');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms delay

  const handleDownload = (doc: DocumentType) => {
    const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);
    if (!user || !currentUserCollab) return;

    addDocumentToCollection('audit_logs', {
      eventType: 'document_download',
      userId: getCollaboratorUserId(currentUserCollab),
      userName: currentUserCollab.name,
      timestamp: new Date().toISOString(),
      details: {
        documentId: doc.id,
        documentName: doc.name,
        contentType: 'document',
        contentId: doc.id,
        contentTitle: doc.name,
      }
    });

    // Open download link in a new tab
    window.open(doc.downloadUrl, '_blank');
  };

  const filteredAndSortedDocuments = useMemo(() => {
    let items = initialDocuments;

    if (debouncedSearchTerm) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    if (selectedCategories.length > 0) {
      items = items.filter(item => selectedCategories.includes(item.category));
    }
    
    if (selectedTypes.length > 0) {
      items = items.filter(item => selectedTypes.includes(item.type));
    }

    if (sortKey) {
      items.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          if (sortKey === 'lastModified') {
            comparison = new Date(valA).getTime() - new Date(valB).getTime();
          } else {
            comparison = valA.localeCompare(valB);
          }
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return items;
  }, [initialDocuments, debouncedSearchTerm, selectedCategories, selectedTypes, sortKey, sortDirection]);

  // Effect to log search term
  useEffect(() => {
      const termToLog = debouncedSearchTerm.trim();
      if (termToLog.length > 2) {
          const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);
          if (!currentUserCollab) return;

          const resultsCount = filteredAndSortedDocuments.length;

          addDocumentToCollection('audit_logs', {
              eventType: 'search_term_used',
              userId: getCollaboratorUserId(currentUserCollab),
              userName: currentUserCollab.name,
              timestamp: new Date().toISOString(),
              details: {
                  term: termToLog,
                  source: 'document_repository',
                  resultsCount,
                  hasResults: resultsCount > 0,
              }
          }).catch(console.error);
      }
  }, [debouncedSearchTerm, user, collaborators, filteredAndSortedDocuments.length]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };
  
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };


  return (
    <div>
      <div className="mb-6 p-4 bg-card rounded-lg sticky top-[var(--header-height)] z-30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 font-body"
              aria-label="Pesquisar documentos"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto justify-between font-body hover:bg-background hover:text-foreground">
                Categorias ({selectedCategories.length || 'Todas'}) <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 font-body">
              <DropdownMenuLabel>Filtrar por Categoria</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map(category => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto justify-between font-body hover:bg-background hover:text-foreground">
                Tipos ({selectedTypes.length || 'Todos'}) <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 font-body">
              <DropdownMenuLabel>Filtrar por Tipo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {types.map(type => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={() => toggleType(type)}
                >
                  {type.toUpperCase()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredAndSortedDocuments.length > 0 ? (
        <Card className="shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 font-body">
                  Nome {sortKey === 'name' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
                <TableHead onClick={() => handleSort('category')} className="cursor-pointer hover:bg-muted/50 font-body">
                  Categoria {sortKey === 'category' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
                <TableHead onClick={() => handleSort('size')} className="cursor-pointer hover:bg-muted/50 font-body">
                  Tamanho {sortKey === 'size' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
                <TableHead onClick={() => handleSort('lastModified')} className="cursor-pointer hover:bg-muted/50 font-body">
                  Modificado em {sortKey === 'lastModified' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
                <TableHead className="text-right font-body">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedDocuments.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-muted/30">
                  <TableCell>{getFileIcon(doc.type)}</TableCell>
                  <TableCell className="font-medium font-body">{doc.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-body">{doc.category}</Badge></TableCell>
                  <TableCell className="font-body">{doc.size}</TableCell>
                  <TableCell className="font-body">
                    {new Date(doc.lastModified).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} aria-label="Baixar documento" className="hover:bg-muted">
                        <Download className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
         <div className="text-center py-12">
          <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-muted-foreground font-headline">Nenhum documento encontrado.</p>
          <p className="text-muted-foreground font-body">Tente ajustar seus filtros ou termos de pesquisa.</p>
        </div>
      )}
    </div>
  );
}
