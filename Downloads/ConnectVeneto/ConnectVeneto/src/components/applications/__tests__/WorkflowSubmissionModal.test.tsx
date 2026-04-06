import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowSubmissionModal from '../WorkflowSubmissionModal';
import { WorkflowDefinition } from '@/contexts/ApplicationsContext';
import { useWorkflows } from '@/contexts/WorkflowsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { useWorkflowAreas } from '@/contexts/WorkflowAreasContext';

// Mock dos hooks e dependências
jest.mock('@/contexts/WorkflowsContext');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/CollaboratorsContext');
jest.mock('@/contexts/WorkflowAreasContext');
jest.mock('@/hooks/use-toast');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockUseWorkflows = useWorkflows as jest.MockedFunction<typeof useWorkflows>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseCollaborators = useCollaborators as jest.MockedFunction<typeof useCollaborators>;
const mockGetCollaboratorUserId = getCollaboratorUserId as jest.MockedFunction<typeof getCollaboratorUserId>;
const mockUseWorkflowAreas = useWorkflowAreas as jest.MockedFunction<typeof useWorkflowAreas>;

describe('WorkflowSubmissionModal - Campos com IDs Duplicados', () => {
  // Mock de workflow com campos duplicados (mesmo ID)
  const workflowDefinitionWithDuplicatedIds: WorkflowDefinition = {
    id: 'test-workflow-1',
    name: 'Alteração de Cargo / Remuneração / Time',
    description: 'Teste workflow',
    icon: 'Users',
    areaId: 'test-area',
    ownerEmail: 'owner@test.com',
    allowedUserIds: ['all'],
    fields: [
      {
        id: 'email_corporativo', // ID duplicado
        label: 'E-mail - Corporativo - Líder',
        type: 'text',
        required: true,
        placeholder: 'email@exemplo.com',
      },
      {
        id: 'setor_area',
        label: 'Setor/Área',
        type: 'text',
        required: true,
      },
      {
        id: 'nome_colaborador',
        label: 'Nome e Sobrenome - Colaborador',
        type: 'text',
        required: true,
      },
      {
        id: 'email_corporativo', // ID duplicado - mesmo ID do primeiro campo
        label: 'E-mail - Corporativo - Colaborador',
        type: 'text',
        required: true,
        placeholder: 'email@exemplo.com',
      },
    ],
    statuses: [
      { id: 'pending', label: 'Pendente' },
    ],
  };

  const mockUser = {
    email: 'test@test.com',
    uid: 'user123',
  };

  const mockCollaborator = {
    id: 'collab1',
    idVeneto: 'collab1',
    name: 'Test User',
    email: 'test@test.com',
    axis: 'Test',
    area: 'Test',
    position: 'Test',
    segment: 'Test',
    leader: 'Test',
    city: 'Test',
    permissions: {
      isAdmin: false,
      isSuperAdmin: false,
      canManageApplications: false,
      canManageCollaborators: false,
      canManageContacts: false,
      canManageDocuments: false,
      canManageHighlights: false,
      canManageNews: false,
      canManageNewsletter: false,
      canManageQuickLinks: false,
      canViewAudit: false,
      canManageFabMessages: false,
      canManageIdleFabMessages: false,
      canManagePolls: false,
      canManageWorkflows: false,
    },
  };

  const mockWorkflowArea = {
    id: 'test-area',
    name: 'Test Area',
    storageFolderPath: 'test/folder',
  };

  beforeEach(() => {
    mockGetCollaboratorUserId.mockImplementation((collaborator) => collaborator?.idVeneto || null);

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
    } as unknown);

    mockUseCollaborators.mockReturnValue({
      collaborators: [mockCollaborator],
      loading: false,
      addCollaborator: jest.fn(),
      updateCollaborator: jest.fn(),
      deleteCollaboratorMutation: {} as unknown,
      addMultipleCollaborators: jest.fn(),
    } as unknown);

    mockUseWorkflowAreas.mockReturnValue({
      workflowAreas: [mockWorkflowArea],
      loading: false,
      addWorkflowArea: jest.fn(),
      updateWorkflowArea: jest.fn(),
      deleteWorkflowAreaMutation: {} as unknown,
    } as unknown);

    const mockAddRequest = jest.fn().mockResolvedValue({ id: 'request123' });
    const mockUpdateRequestAndNotify = jest.fn().mockResolvedValue(undefined);

    mockUseWorkflows.mockReturnValue({
      requests: [],
      loading: false,
      addRequest: mockAddRequest,
      updateRequestAndNotify: mockUpdateRequestAndNotify,
      deleteRequestMutation: {} as unknown,
      updateRequestStatusMutation: {} as unknown,
      assignRequestMutation: {} as unknown,
      markAsViewedMutation: {} as unknown,
      archiveRequestMutation: {} as unknown,
      addActionRequestMutation: {} as unknown,
      respondToActionRequestMutation: {} as unknown,
    } as unknown);
  });

  it('deve renderizar campos com IDs duplicados independentemente', async () => {
    render(
      <WorkflowSubmissionModal
        open={true}
        onOpenChange={jest.fn()}
        workflowDefinition={workflowDefinitionWithDuplicatedIds}
      />
    );

    // Deve encontrar ambos os campos, mesmo com o mesmo ID
    const leaderEmailInput = screen.getByLabelText(/E-mail - Corporativo - Líder/i);
    const collaboratorEmailInput = screen.getByLabelText(/E-mail - Corporativo - Colaborador/i);

    expect(leaderEmailInput).toBeInTheDocument();
    expect(collaboratorEmailInput).toBeInTheDocument();
  });

  it('deve permitir digitar valores diferentes em campos com IDs duplicados', async () => {
    const user = userEvent.setup();
    
    render(
      <WorkflowSubmissionModal
        open={true}
        onOpenChange={jest.fn()}
        workflowDefinition={workflowDefinitionWithDuplicatedIds}
      />
    );

    const leaderEmailInput = screen.getByLabelText(/E-mail - Corporativo - Líder/i) as HTMLInputElement;
    const collaboratorEmailInput = screen.getByLabelText(/E-mail - Corporativo - Colaborador/i) as HTMLInputElement;

    // Digita valores diferentes em cada campo
    await user.type(leaderEmailInput, 'lider@test.com');
    await user.type(collaboratorEmailInput, 'colaborador@test.com');

    // Verifica que os valores são independentes
    expect(leaderEmailInput.value).toBe('lider@test.com');
    expect(collaboratorEmailInput.value).toBe('colaborador@test.com');
    expect(leaderEmailInput.value).not.toBe(collaboratorEmailInput.value);
  });

  it('deve mapear valores corretamente no submit, mesmo com IDs duplicados', async () => {
    const user = userEvent.setup();
    const mockUpdateRequestAndNotify = jest.fn().mockResolvedValue(undefined);
    
    mockUseWorkflows.mockReturnValue({
      requests: [],
      loading: false,
      addRequest: jest.fn().mockResolvedValue({ id: 'request123' }),
      updateRequestAndNotify: mockUpdateRequestAndNotify,
      deleteRequestMutation: {} as unknown,
      updateRequestStatusMutation: {} as unknown,
      assignRequestMutation: {} as unknown,
      markAsViewedMutation: {} as unknown,
      archiveRequestMutation: {} as unknown,
      addActionRequestMutation: {} as unknown,
      respondToActionRequestMutation: {} as unknown,
    } as unknown);

    render(
      <WorkflowSubmissionModal
        open={true}
        onOpenChange={jest.fn()}
        workflowDefinition={workflowDefinitionWithDuplicatedIds}
      />
    );

    // Preenche os campos
    const leaderEmailInput = screen.getByLabelText(/E-mail - Corporativo - Líder/i);
    const collaboratorEmailInput = screen.getByLabelText(/E-mail - Corporativo - Colaborador/i);
    const setorInput = screen.getByLabelText(/Setor\/Área/i);
    const nomeInput = screen.getByLabelText(/Nome e Sobrenome - Colaborador/i);

    await user.type(leaderEmailInput, 'lider@test.com');
    await user.type(setorInput, 'TI');
    await user.type(nomeInput, 'João Silva');
    await user.type(collaboratorEmailInput, 'colaborador@test.com');

    // Submete o formulário
    const submitButton = screen.getByText(/Enviar Solicitação/i);
    await user.click(submitButton);

    // Aguarda o submit ser processado
    await waitFor(() => {
      expect(mockUpdateRequestAndNotify).toHaveBeenCalled();
    });

    // Verifica que o último valor do campo duplicado foi preservado
    const callArgs = mockUpdateRequestAndNotify.mock.calls[0][0];
    expect(callArgs.formData.email_corporativo).toBe('colaborador@test.com'); // Último valor deve ser preservado
    expect(callArgs.formData.setor_area).toBe('TI');
    expect(callArgs.formData.nome_colaborador).toBe('João Silva');
  });
});

