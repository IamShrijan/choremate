import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User as UserIcon, Check, X } from "lucide-react";
import { chatbotAPI, notificationsAPI } from "../utils/api";

export default function AIChatbotPage({ onBack }) {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [isMockMode, setIsMockMode] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Suggested tasks
    const suggestedTasks = [
        "I'm busy this weekend, please reassign my chores",
        "Show me my upcoming chores",
        "I need help with tomorrow's chores",
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchHistory = async () => {
        try {
            const history = await chatbotAPI.getConversations();
            
            // Map the DB schema to our UI schema
            const mappedMessages = history.map((msg) => ({
                id: msg.id,
                type: msg.created_by === "system" ? "ai" : msg.created_by,
                text: msg.content,
                timestamp: new Date(msg.created_at.endsWith("Z") ? msg.created_at : msg.created_at + "Z"),
            }));

            // Prepend a welcome message if the history is empty
            if (mappedMessages.length === 0) {
                mappedMessages.push({
                    id: 'welcome',
                    type: "ai",
                    text: "Hello! I'm your ChoreMate AI assistant. I can help you reassign chores to your roommates based on their availability and workload. How can I assist you today?",
                    timestamp: new Date(),
                });
            }
            
            setMessages(mappedMessages);
        } catch (error) {
            console.error("Failed to load conversation history:", error);
        }
    };

    useEffect(() => {
        fetchHistory();

        // Listen for SSE notification push (which now includes async chat responses)
        const es = notificationsAPI.openStream();
        es.addEventListener('new_notification', () => {
            // Re-fetch conversation history to see the new AI response
            fetchHistory();
            // Remove the hardcoded loading state if we had one
            setMessages(prev => prev.filter(m => m.id !== 'loading...'));
            setLoading(false);
        });

        return () => es.close();
    }, []);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || loading) return;

        const userMessage = {
            id: Date.now(),
            type: "user",
            text: inputMessage,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputMessage("");
        setLoading(true);
        setPendingAction(null);

        try {
            const response = await chatbotAPI.chat({
                message: inputMessage,
                conversation_id: conversationId,
                use_mock: isMockMode,
            });

            // SQS Async mode: response is just {status: "processing", task_id: ...}
            if (response.status === "processing") {
                // Show a loading indicator message temporarily
                const loadingMessage = {
                    id: 'loading...',
                    type: "ai",
                    text: "Thinking... (Simulated LLM delay)",
                    timestamp: new Date(),
                    proposedAction: null,
                };
                setMessages((prev) => [...prev, loadingMessage]);
                // We leave setLoading(true) until the SSE push arrives
                return;
            }

            // Fallback for real time mode or approveAction
            fetchHistory();
            
        } catch (error) {
            console.error("Failed to send message:", error);
            const errorMessage = {
                id: Date.now() + 1,
                type: "ai",
                text: "I'm sorry, something went wrong. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            setLoading(false);
        }

    };

    const handleApproveAction = async (approved) => {
        if (!pendingAction) return;

        setLoading(true);

        try {
            const response = await chatbotAPI.approveAction({
                action_id: pendingAction.action_id,
                approved: approved,
                conversation_id: conversationId,
            });

            const aiMessage = {
                id: Date.now(),
                type: "ai",
                text: response.response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, aiMessage]);
            setPendingAction(null);
        } catch (error) {
            console.error("Failed to process action:", error);
            const errorMessage = {
                id: Date.now(),
                type: "ai",
                text: "I'm sorry, I couldn't process that action. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleSuggestedTask = (task) => {
        setInputMessage(task);
        inputRef.current?.focus();
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#ffffff",
                position: "relative",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid #e5e7eb",
                    backgroundColor: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <button
                        onClick={onBack}
                        style={{
                            padding: "8px",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: "#7c3aed",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Bot style={{ width: "24px", height: "24px", color: "white" }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: 0 }}>
                                AI Chatbot
                            </h2>
                            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                                Always here to help
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mock Mode Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "12px", color: "#6b7280", fontWeight: "500", cursor: "pointer" }} onClick={() => setIsMockMode(!isMockMode)}>
                        Mock Mode
                    </label>
                    <div 
                        onClick={() => setIsMockMode(!isMockMode)}
                        style={{
                            width: "36px", height: "20px", borderRadius: "10px", 
                            backgroundColor: isMockMode ? "#7c3aed" : "#d1d5db",
                            position: "relative", cursor: "pointer", transition: "background-color 0.2s"
                        }}
                    >
                        <div style={{
                            width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "white",
                            position: "absolute", top: "2px", left: isMockMode ? "18px" : "2px",
                            transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                        }}/>
                    </div>
                </div>
            </div>

            {/* Chat Messages Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                }}
            >
                {messages.map((message) => (
                    <div key={message.id}>
                        <div
                            style={{
                                display: "flex",
                                gap: "12px",
                                alignItems: "flex-start",
                                flexDirection: message.type === "user" ? "row-reverse" : "row",
                            }}
                        >
                            <div
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    backgroundColor: message.type === "ai" ? "#7c3aed" : "#e5e7eb",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {message.type === "ai" ? (
                                    <Bot style={{ width: "20px", height: "20px", color: "white" }} />
                                ) : (
                                    <UserIcon style={{ width: "20px", height: "20px", color: "#6b7280" }} />
                                )}
                            </div>

                            <div
                                style={{
                                    maxWidth: "70%",
                                    padding: "12px 16px",
                                    borderRadius: "12px",
                                    backgroundColor: message.type === "ai" ? "#f3f4f6" : "#7c3aed",
                                    color: message.type === "ai" ? "#111827" : "white",
                                    fontSize: "14px",
                                    lineHeight: "1.6",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {message.text}
                            </div>

                            <div
                                style={{
                                    fontSize: "11px",
                                    color: "#9ca3af",
                                    alignSelf: "flex-end",
                                    paddingBottom: "4px",
                                }}
                            >
                                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Approval Buttons */}
                {pendingAction && !loading && (
                    <div
                        style={{
                            display: "flex",
                            gap: "12px",
                            marginLeft: "48px",
                            marginTop: "8px",
                        }}
                    >
                        <button
                            onClick={() => handleApproveAction(true)}
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "#16a34a",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "600",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <Check style={{ width: "16px", height: "16px" }} />
                            Yes, Reassign
                        </button>
                        <button
                            onClick={() => handleApproveAction(false)}
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "#dc2626",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "600",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <X style={{ width: "16px", height: "16px" }} />
                            Cancel
                        </button>
                    </div>
                )}

                {/* Loading indicator */}
                {loading && (
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                backgroundColor: "#7c3aed",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Bot style={{ width: "20px", height: "20px", color: "white" }} />
                        </div>
                        <div
                            style={{
                                padding: "12px 16px",
                                borderRadius: "12px",
                                backgroundColor: "#f3f4f6",
                                display: "flex",
                                gap: "4px",
                            }}
                        >
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#9ca3af", animation: "bounce 1.4s infinite ease-in-out" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#9ca3af", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0.2s" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#9ca3af", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0.4s" }} />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Tasks */}
            {messages.length === 1 && (
                <div
                    style={{
                        padding: "16px 24px",
                        borderTop: "1px solid #e5e7eb",
                        backgroundColor: "#f9fafb",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        flexShrink: 0,
                    }}
                >
                    {suggestedTasks.map((task, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestedTask(task)}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "20px",
                                fontSize: "13px",
                                color: "#374151",
                                cursor: "pointer",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#7c3aed";
                                e.currentTarget.style.color = "#7c3aed";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "#e5e7eb";
                                e.currentTarget.style.color = "#374151";
                            }}
                        >
                            {task}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div
                style={{
                    padding: "16px 24px",
                    borderTop: "1px solid #e5e7eb",
                    backgroundColor: "white",
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                    <textarea
                        ref={inputRef}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        disabled={loading || pendingAction}
                        style={{
                            flex: 1,
                            padding: "12px 16px",
                            border: "1px solid #e5e7eb",
                            borderRadius: "12px",
                            fontSize: "14px",
                            fontFamily: "inherit",
                            resize: "none",
                            minHeight: "44px",
                            maxHeight: "120px",
                            lineHeight: "1.5",
                            opacity: pendingAction ? 0.5 : 1,
                        }}
                        rows={1}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || loading || pendingAction}
                        style={{
                            padding: "12px",
                            backgroundColor: inputMessage.trim() && !loading && !pendingAction ? "#7c3aed" : "#d1d5db",
                            color: "white",
                            border: "none",
                            borderRadius: "12px",
                            cursor: inputMessage.trim() && !loading && !pendingAction ? "pointer" : "not-allowed",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.2s",
                        }}
                    >
                        <Send style={{ width: "20px", height: "20px" }} />
                    </button>
                </div>
                <p style={{ fontSize: "11px", color: "#9ca3af", margin: "8px 0 0 0" }}>
                    {pendingAction ? "Please approve or cancel the action above" : "AI can make mistakes. Check important information."}
                </p>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
