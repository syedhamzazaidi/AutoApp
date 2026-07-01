import * as React from "react";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";

type ToastMessage = {
  id: string;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (message: Omit<ToastMessage, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((message: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { ...message, id }]);
    setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider>
        {children}
        {messages.map((m) => (
          <div key={m.id} className="fixed bottom-4 right-4 z-50 rounded-md border bg-background p-4 shadow-lg">
            <p className="font-medium">{m.title}</p>
            {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
          </div>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToasterProvider");
  return ctx;
}
