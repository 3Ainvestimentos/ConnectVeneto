import { act, renderHook } from "@testing-library/react";
import { addDocumentToCollection } from "@/lib/firestore-service";
import { useDocumentViewTime, type DocumentView } from "@/hooks/useDocumentViewTime";

jest.mock("@/lib/firestore-service", () => ({
  addDocumentToCollection: jest.fn(() => Promise.resolve({ id: "x" })),
}));

const addMock = addDocumentToCollection as jest.Mock;

const view: DocumentView = {
  viewId: "view-1",
  documentId: "doc-1",
  documentName: "Simuladores Distress Test",
  contentType: "html",
  source: "biblioteca_comercial",
  segment: "commercial",
  userId: "VCS5",
  userName: "Victor Santos",
};

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeAll(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

beforeEach(() => {
  jest.useFakeTimers();
  addMock.mockClear();
  visibility = "visible";
});

afterEach(() => jest.useRealTimers());

const durations = () => addMock.mock.calls.map(([, data]) => data.details.durationSeconds);

test("grava o tempo com o documento aberto ao fechar", () => {
  const { rerender } = renderHook(({ v }) => useDocumentViewTime(v), {
    initialProps: { v: view as DocumentView | null },
  });

  act(() => jest.advanceTimersByTime(60_000));
  expect(addMock).not.toHaveBeenCalled();

  rerender({ v: null });

  expect(addMock).toHaveBeenCalledTimes(1);
  const [collection, data] = addMock.mock.calls[0];
  expect(collection).toBe("audit_logs");
  expect(data.eventType).toBe("document_view_time");
  expect(data.details).toMatchObject({ viewId: "view-1", documentId: "doc-1", endReason: "closed" });
  expect(data.details.durationSeconds).toBe(60);
});

test("não conta o tempo com a aba escondida e continua ao voltar", () => {
  const { rerender } = renderHook(({ v }) => useDocumentViewTime(v), {
    initialProps: { v: view as DocumentView | null },
  });

  act(() => jest.advanceTimersByTime(30_000));
  act(() => setVisibility("hidden"));
  act(() => jest.advanceTimersByTime(10 * 60_000));
  act(() => setVisibility("visible"));
  act(() => jest.advanceTimersByTime(20_000));
  rerender({ v: null });

  expect(durations()).toEqual([30, 20]);
  expect(addMock.mock.calls.map(([, d]) => d.details.endReason)).toEqual(["hidden", "closed"]);
});

test("para de contar depois de 30 min sem atividade", () => {
  const { rerender } = renderHook(({ v }) => useDocumentViewTime(v), {
    initialProps: { v: view as DocumentView | null },
  });

  act(() => jest.advanceTimersByTime(2 * 60 * 60_000));
  rerender({ v: null });

  const [seconds] = durations();
  expect(seconds).toBeGreaterThanOrEqual(30 * 60);
  expect(seconds).toBeLessThanOrEqual(30 * 60 + 10);
});

test("abrir e fechar na hora não grava nada", () => {
  const { rerender } = renderHook(({ v }) => useDocumentViewTime(v), {
    initialProps: { v: view as DocumentView | null },
  });
  rerender({ v: null });
  expect(addMock).not.toHaveBeenCalled();
});
