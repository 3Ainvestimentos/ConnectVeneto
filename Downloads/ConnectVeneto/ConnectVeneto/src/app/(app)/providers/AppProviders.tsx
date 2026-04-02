import { ApplicationsProvider } from "@/contexts/ApplicationsContext";
import { CollaboratorsProvider } from "@/components/providers/CollaboratorsProvider";
import { DocumentsProvider } from "@/contexts/DocumentsContext";
import { FabMessagesProvider } from "@/contexts/FabMessagesContext";
import { IdleFabMessagesProvider } from "@/contexts/IdleFabMessagesContext";
import { MessagesProvider } from "@/contexts/MessagesContext";
import { PollsProvider } from "@/contexts/PollsContext";
import { QuickLinksProvider } from "@/contexts/QuickLinksContext";
import { RankingsProvider } from "@/contexts/RankingsContext";
import { RequestsProvider } from "@/contexts/RequestsContext";
import { WorkflowAreasProvider } from "@/contexts/WorkflowAreasContext";
import { WorkflowsProvider } from "@/contexts/WorkflowsContext";
import { ContactsProvider } from "@/contexts/ContactsContext";
import { MeetingAnalysesProvider } from "@/contexts/MeetingAnalysesContext";
import { TripsBirthdaysProvider } from "@/contexts/TripsBirthdaysContext";
import { VacationProvider } from "@/contexts/VacationContext";
import { VacationApproversProvider } from "@/contexts/VacationApproversContext";
import { VacationRequestsProvider } from "@/contexts/VacationRequestsContext";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <CollaboratorsProvider>
      <WorkflowAreasProvider>
        <ApplicationsProvider>
          <DocumentsProvider>
            <MessagesProvider>
                  <WorkflowsProvider>
                    <QuickLinksProvider>
                      <PollsProvider>
                        <RankingsProvider>
                          <FabMessagesProvider>
                            <IdleFabMessagesProvider>
                              <ContactsProvider>
                                <MeetingAnalysesProvider>
                                  <TripsBirthdaysProvider>
                                    <VacationApproversProvider>
                                      <VacationRequestsProvider>
                                        <VacationProvider>
                                          <RequestsProvider>{children}</RequestsProvider>
                                        </VacationProvider>
                                      </VacationRequestsProvider>
                                    </VacationApproversProvider>
                                  </TripsBirthdaysProvider>
                                </MeetingAnalysesProvider>
                              </ContactsProvider>
                            </IdleFabMessagesProvider>
                          </FabMessagesProvider>
                        </RankingsProvider>
                      </PollsProvider>
                    </QuickLinksProvider>
                  </WorkflowsProvider>
              </MessagesProvider>
          </DocumentsProvider>
        </ApplicationsProvider>
      </WorkflowAreasProvider>
    </CollaboratorsProvider>
  );
}
