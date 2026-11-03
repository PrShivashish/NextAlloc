import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";

export type PortalType = "student" | "company" | "admin" | "public";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface UseChatbotReturn {
    messages: Message[];
    sendMessage: (content: string) => Promise<void>;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    isLoading: boolean;
    portalType: PortalType;
    clearMessages: () => void;
}

/**
 * Custom hook for managing chatbot state and communication.
 * Automatically detects the current portal from the URL and sends
 * portal-aware context to the backend for tailored responses.
 */
export function useChatbot(): UseChatbotReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Auto-detect portal from current route
    const [location] = useLocation();

    const portalType: PortalType = useMemo(() => {
        if (location.startsWith("/student")) return "student";
        if (location.startsWith("/company")) return "company";
        if (location.startsWith("/admin")) return "admin";
        return "public";
    }, [location]);

    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        // Add user message
        const userMessage: Message = {
            id: generateId(),
            role: "user",
            content: content.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: content.trim(),
                    portalType,
                    // Include recent message history for context
                    history: messages.slice(-6).map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!response.ok) {
                throw new Error(`Chat request failed: ${response.status}`);
            }

            const data = await response.json();

            // Add assistant response
            const assistantMessage: Message = {
                id: generateId(),
                role: "assistant",
                content: data.response || "I'm sorry, I couldn't process that request.",
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);

            // Add error message
            const errorMessage: Message = {
                id: generateId(),
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, messages, portalType]);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        sendMessage,
        isOpen,
        setIsOpen,
        isLoading,
        portalType,
        clearMessages,
    };
}
