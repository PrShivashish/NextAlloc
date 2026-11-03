import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Trash2, Bot, User, Loader2 } from "lucide-react";
import { useChatbot, type PortalType } from "@/hooks/useChatbot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PORTAL_CONFIG: Record<PortalType, { color: string; title: string; greeting: string }> = {
    student: {
        color: "from-blue-500 to-cyan-500",
        title: "Student Assistant",
        greeting: "Hi! I can help with internship applications and profile setup. Ask in English, Hinglish, ya Gujarati!",
    },
    company: {
        color: "from-purple-500 to-pink-500",
        title: "Company Assistant",
        greeting: "Hello! I can help with internships and candidate management. Aap English, Hinglish ya Gujarati mein pooch sakte hain!",
    },
    admin: {
        color: "from-orange-500 to-red-500",
        title: "Admin Assistant",
        greeting: "Welcome, Admin! I assist with metrics and system ops. Ask in English, Hinglish, or Gujarati.",
    },
    public: {
        color: "from-green-500 to-teal-500",
        title: "PM Internship Assistant",
        greeting: "Welcome! Kuch bhi poocho - English, Hinglish ya Gujarati mein. Main help karne ke liye hoon!",
    },
};

export function ChatbotWidget() {
    const { messages, sendMessage, isOpen, setIsOpen, isLoading, portalType, clearMessages } = useChatbot();
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const config = PORTAL_CONFIG[portalType];

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            sendMessage(input);
            setInput("");
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(true)}
                        className={cn(
                            "fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg",
                            "bg-gradient-to-r text-white",
                            config.color
                        )}
                        aria-label="Open chat"
                    >
                        <MessageCircle className="h-6 w-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] flex flex-col bg-background border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className={cn("bg-gradient-to-r text-white p-4 flex items-center justify-between", config.color)}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-full">
                                    <Bot className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">{config.title}</h3>
                                    <p className="text-xs text-white/80 capitalize">{portalType} Portal</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={clearMessages}
                                    className="h-8 w-8 text-white hover:bg-white/20"
                                    title="Clear chat"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsOpen(false)}
                                    className="h-8 w-8 text-white hover:bg-white/20"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
                            {/* Greeting message */}
                            {messages.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-3"
                                >
                                    <div className={cn("p-2 rounded-full bg-gradient-to-r h-fit", config.color)}>
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="flex-1 bg-background rounded-2xl rounded-tl-sm p-3 shadow-sm">
                                        <p className="text-sm">{config.greeting}</p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Message history */}
                            {messages.map((message, index) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
                                >
                                    <div
                                        className={cn(
                                            "p-2 rounded-full h-fit",
                                            message.role === "assistant"
                                                ? `bg-gradient-to-r ${config.color}`
                                                : "bg-muted"
                                        )}
                                    >
                                        {message.role === "assistant" ? (
                                            <Bot className="h-4 w-4 text-white" />
                                        ) : (
                                            <User className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div
                                        className={cn(
                                            "flex-1 max-w-[80%] rounded-2xl p-3 shadow-sm",
                                            message.role === "assistant"
                                                ? "bg-background rounded-tl-sm"
                                                : `bg-gradient-to-r ${config.color} text-white rounded-tr-sm`
                                        )}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-3"
                                >
                                    <div className={cn("p-2 rounded-full bg-gradient-to-r h-fit", config.color)}>
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="bg-background rounded-2xl rounded-tl-sm p-3 shadow-sm">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-3 border-t bg-background">
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type your message..."
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 text-sm bg-muted rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!input.trim() || isLoading}
                                    className={cn("rounded-full bg-gradient-to-r", config.color)}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
